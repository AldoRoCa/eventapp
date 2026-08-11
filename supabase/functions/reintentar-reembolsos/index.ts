import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { enviarAlerta, datosAnfitrion } from "../_shared/alertas.ts"
import { resumenMontos, pesos } from "../_shared/montos.ts"

// Reintento automático de reembolsos fallidos. La dispara pg_cron cada 8 horas
// (ver migración 20260809140000).
//
// Por qué existe: Mercado Pago NO reintenta un reembolso que falló. La llamada
// devuelve error (típicamente saldo insuficiente en la cuenta del anfitrión) y
// ahí muere — no queda encolado ni hay estado "pendiente". Si el dinero vuelve
// a entrar a esa cuenta mañana, nada lo cobra solo.
//
// Regla de este trabajo: NO se toca ninguna de las 4 funciones de reembolso que
// ya funcionan (cancelar-evento, gestionar-solicitud, resolver-reporte,
// eliminar-cuenta). Esta función solo lee lo que ellas dejaron registrado en
// fallos_reembolso y vuelve a intentar, con el mismo patrón defensivo:
// GET previo para no reembolsar doble + X-Idempotency-Key.

// Límite duro de MP: un pago solo se puede reembolsar dentro de los 180 días
// de su aprobación. Pasado eso es imposible aunque haya saldo.
const DIAS_LIMITE_MP = 180
// Avisar cuando queden menos de estos días, para poder actuar a tiempo.
const DIAS_AVISO_VENCIMIENTO = 15
// El cron corre cada 8 h, así que cada 3 intentos ≈ un resumen diario. Sin
// esto, un anfitrión que tarda una semana en reponer saldo generaría 21
// mensajes idénticos y el bot se volvería ruido que se ignora.
const INTENTOS_POR_RESUMEN = 3

const ALERTA_WEBHOOK_SECRET = Deno.env.get("ALERTA_WEBHOOK_SECRET")

const CONTEXTO_LABEL: Record<string, string> = {
  "cancelar-evento": "Cancelación de evento",
  "gestionar-solicitud": "Rechazo de solicitud",
  "resolver-reporte": "Reporte aprobado",
  "eliminar-cuenta": "Baja de cuenta",
  "liberacion-inmediata": "Detección de liberación inmediata",
  "solicitud-vencida": "Solicitud nunca respondida (evento terminado)",
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  // Mismo secreto compartido que las otras alertas, fail-closed.
  if (!ALERTA_WEBHOOK_SECRET || req.headers.get("x-alerta-secret") !== ALERTA_WEBHOOK_SECRET) {
    return new Response("No autorizado", { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  )

  const { data: fallos, error: errFallos } = await supabase
    .from("fallos_reembolso")
    .select("*")
    .eq("resuelto", false)
    .eq("incobrable", false)
    .order("created_at", { ascending: true })
    .limit(50)

  if (errFallos) {
    console.error("[reintentar-reembolsos] No se pudieron leer los fallos:", errFallos.message)
    return new Response("Error leyendo fallos", { status: 500 })
  }
  if (!fallos || fallos.length === 0) {
    return new Response(JSON.stringify({ ok: true, sin_pendientes: true }), { status: 200 })
  }

  const resumen = { revisados: 0, recuperados: 0, incobrables: 0 }

  for (const fallo of fallos) {
    resumen.revisados++
    try {
      await procesarFallo(supabase, fallo, resumen)
    } catch (e) {
      // Un fallo no debe impedir procesar los demás.
      // deno-lint-ignore no-explicit-any
      console.error(`[reintentar-reembolsos] Error procesando fallo ${fallo.id}:`, (e as any)?.message ?? e)
    }
  }

  return new Response(JSON.stringify({ ok: true, ...resumen }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  })
})

// deno-lint-ignore no-explicit-any
async function procesarFallo(supabase: any, fallo: any, resumen: { recuperados: number; incobrables: number }) {
  const todos: string[] = fallo.payment_ids ?? []
  const yaRecuperados: string[] = fallo.payment_ids_recuperados ?? []
  const pendientes = todos.filter((p) => !yaRecuperados.includes(p))
  const intentos = (fallo.intentos ?? 0) + 1

  if (pendientes.length === 0) {
    await supabase.from("fallos_reembolso").update({ resuelto: true }).eq("id", fallo.id)
    return
  }

  // El anfitrión se resuelve por el evento del fallo: el evento sigue
  // existiendo justamente porque el reembolso fallido impidió borrarlo. Así
  // no hace falta que las 4 funciones de reembolso guarden el anfitrión.
  const { data: evento } = await supabase
    .from("eventos")
    .select("anfitrion_id, titulo")
    .eq("id", fallo.evento_id)
    .single()

  if (!evento?.anfitrion_id) {
    await marcarIntento(supabase, fallo.id, intentos, "No se pudo identificar al anfitrión (el evento ya no existe). Requiere revisión manual.", yaRecuperados)
    await avisarSiToca(supabase, fallo, intentos, {
      titulo: "⚠️ VELA — Reembolso pendiente sin anfitrión identificable",
      resumen: "El evento de este fallo ya no existe, así que no se puede obtener el token de Mercado Pago para reintentar. Requiere revisión manual.",
      anfitrionId: null,
      tituloEvento: fallo.evento_id,
      pendientes,
      intentos,
      error: "Evento inexistente",
    })
    return
  }

  const { data: cred } = await supabase
    .from("mp_credenciales")
    .select("mp_access_token")
    .eq("id", evento.anfitrion_id)
    .single()

  if (!cred?.mp_access_token) {
    await marcarIntento(supabase, fallo.id, intentos, "El anfitrión no tiene credenciales de Mercado Pago conectadas.", yaRecuperados)
    await avisarSiToca(supabase, fallo, intentos, {
      titulo: "⚠️ VELA — Reembolso pendiente sin credenciales de MP",
      resumen: "El anfitrión desconectó su cuenta de Mercado Pago o nunca la conectó. No se puede reintentar hasta que la reconecte.",
      anfitrionId: evento.anfitrion_id,
      tituloEvento: evento.titulo,
      pendientes,
      intentos,
      error: "Sin credenciales de MP",
    })
    return
  }

  const token = cred.mp_access_token
  const recuperadosAhora: string[] = []
  let ultimoError = ""
  let vencido = false
  let diasRestantesMin = Infinity

  for (const paymentId of pendientes) {
    const r = await reintentarPago(paymentId, token)
    if (r.recuperado) { recuperadosAhora.push(paymentId); continue }
    if (r.vencido) { vencido = true }
    if (r.diasRestantes !== null && r.diasRestantes < diasRestantesMin) diasRestantesMin = r.diasRestantes
    if (r.error) ultimoError = r.error
  }

  const recuperadosTotal = [...yaRecuperados, ...recuperadosAhora]
  const siguenPendientes = todos.filter((p) => !recuperadosTotal.includes(p))
  const todoResuelto = siguenPendientes.length === 0
  // Solo se declara incobrable si TODO lo que queda ya venció.
  const incobrable = !todoResuelto && vencido && diasRestantesMin === Infinity

  // Cuánto dinero queda realmente sin devolver, leído de MP.
  const montos = await resumenMontos(supabase, todos, recuperadosTotal, token)

  await supabase.from("fallos_reembolso").update({
    intentos,
    ultimo_intento_en: new Date().toISOString(),
    ultimo_error: todoResuelto ? null : (ultimoError || fallo.ultimo_error),
    payment_ids_recuperados: recuperadosTotal,
    resuelto: todoResuelto,
    incobrable,
    monto_pendiente: montos.pendiente,
    monto_recuperado: montos.recuperado,
    boletos_afectados: montos.boletos,
  }).eq("id", fallo.id)

  const datos = await datosAnfitrion(supabase, evento.anfitrion_id)
  const filasBase = [
    ["Anfitrión", datos.nombre],
    ["Teléfono", datos.telefono],
    ...(datos.whatsapp ? [["WhatsApp", datos.whatsapp] as [string, unknown]] : []),
    ["Evento", evento.titulo],
    ["Dinero sin devolver", pesos(montos.pendiente)],
    ["Boletos afectados", montos.boletos],
    ["Origen del reembolso", CONTEXTO_LABEL[fallo.contexto] ?? fallo.contexto],
  ] as [string, unknown][]

  if (todoResuelto) {
    resumen.recuperados++
    await enviarAlerta({
      titulo: "✅ VELA — Reembolso recuperado automáticamente",
      resumen: `El reembolso que había fallado se completó solo en el intento ${intentos}. Los compradores ya tienen su dinero de vuelta. No tienes que hacer nada.`,
      colorHtml: "#059669",
      filas: [...filasBase, ["Dinero devuelto", pesos(montos.recuperado)], ["Pagos reembolsados", recuperadosTotal.join(", ")], ["Intentos", intentos]],
    })
    return
  }

  if (incobrable) {
    resumen.incobrables++
    await enviarAlerta({
      titulo: "🔴 VELA — Reembolso INCOBRABLE (pasaron los 180 días)",
      resumen: `Mercado Pago ya no permite reembolsar estos pagos: pasaron los ${DIAS_LIMITE_MP} días desde su aprobación. Hay que resolverlo fuera de la plataforma con el comprador y el anfitrión.`,
      filas: [...filasBase, ["Pagos sin reembolsar", siguenPendientes.join(", ")], ["Intentos", intentos]],
    })
    return
  }

  await avisarSiToca(supabase, fallo, intentos, {
    titulo: diasRestantesMin <= DIAS_AVISO_VENCIMIENTO
      ? `⚠️ VELA — Reembolso pendiente, quedan ${Math.max(0, Math.floor(diasRestantesMin))} días`
      : "⏳ VELA — Reembolso todavía pendiente",
    resumen: diasRestantesMin <= DIAS_AVISO_VENCIMIENTO
      ? `Se está agotando el plazo de ${DIAS_LIMITE_MP} días de Mercado Pago para reembolsar. Conviene contactar al anfitrión ya.`
      : "El reintento automático sigue corriendo cada 8 horas. Este aviso se repite una vez al día mientras no se resuelva.",
    colorHtml: "#d97706",
    anfitrionId: evento.anfitrion_id,
    tituloEvento: evento.titulo,
    pendientes: siguenPendientes,
    intentos,
    error: ultimoError,
    forzar: diasRestantesMin <= DIAS_AVISO_VENCIMIENTO,
    filasBase,
  })
}

// Un reintento sobre un pago concreto. Mismo patrón defensivo que las
// funciones de reembolso existentes: GET previo (por si ya se reembolsó por
// otra vía) y X-Idempotency-Key nuevo por intento.
async function reintentarPago(paymentId: string, token: string): Promise<{ recuperado: boolean; vencido: boolean; diasRestantes: number | null; error: string }> {
  try {
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const pago = await consulta.json()

    if (consulta.ok && (pago.status === "refunded" || pago.status === "cancelled")) {
      return { recuperado: true, vencido: false, diasRestantes: null, error: "" }
    }
    if (!consulta.ok) {
      return { recuperado: false, vencido: false, diasRestantes: null, error: `No se pudo consultar el pago en MP (${consulta.status}).` }
    }

    // Ventana de 180 días desde la aprobación del pago.
    let diasRestantes: number | null = null
    const aprobado = pago.date_approved ? Date.parse(pago.date_approved) : NaN
    if (Number.isFinite(aprobado)) {
      const transcurridos = (Date.now() - aprobado) / 86400000
      diasRestantes = DIAS_LIMITE_MP - transcurridos
      if (diasRestantes <= 0) {
        return { recuperado: false, vencido: true, diasRestantes: null, error: `Pasaron los ${DIAS_LIMITE_MP} días desde la aprobación del pago: MP ya no permite reembolsarlo.` }
      }
    }

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    })

    if (res.ok) return { recuperado: true, vencido: false, diasRestantes, error: "" }

    // El error TEXTUAL de MP: esto es lo que hasta ahora se perdía en los logs
    // y por lo que el detalle del fallo solo decía "¿saldo insuficiente?".
    const detalle = await res.json().catch(() => ({}))
    const msg = detalle?.message || detalle?.error || JSON.stringify(detalle).slice(0, 300)
    return { recuperado: false, vencido: false, diasRestantes, error: `MP respondió ${res.status}: ${msg}` }
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    return { recuperado: false, vencido: false, diasRestantes: null, error: `Error de red: ${(e as any)?.message ?? e}` }
  }
}

// deno-lint-ignore no-explicit-any
async function marcarIntento(supabase: any, id: string, intentos: number, error: string, recuperados: string[]) {
  await supabase.from("fallos_reembolso").update({
    intentos,
    ultimo_intento_en: new Date().toISOString(),
    ultimo_error: error,
    payment_ids_recuperados: recuperados,
  }).eq("id", id)
}

// Aviso de "sigue pendiente": solo cada INTENTOS_POR_RESUMEN ciclos (≈1 vez al
// día con el cron de 8 h), o siempre si se está agotando el plazo de MP.
// deno-lint-ignore no-explicit-any
async function avisarSiToca(supabase: any, fallo: any, intentos: number, o: {
  titulo: string
  resumen: string
  anfitrionId: string | null
  tituloEvento: string
  pendientes: string[]
  intentos: number
  error: string
  colorHtml?: string
  forzar?: boolean
  filasBase?: [string, unknown][]
}) {
  if (!o.forzar && intentos % INTENTOS_POR_RESUMEN !== 0) return

  const filas = o.filasBase ?? (await (async () => {
    const d = await datosAnfitrion(supabase, o.anfitrionId)
    return [
      ["Anfitrión", d.nombre],
      ["Teléfono", d.telefono],
      ...(d.whatsapp ? [["WhatsApp", d.whatsapp] as [string, unknown]] : []),
      ["Evento", o.tituloEvento],
    ] as [string, unknown][]
  })())

  await enviarAlerta({
    titulo: o.titulo,
    resumen: o.resumen,
    colorHtml: o.colorHtml ?? "#d97706",
    filas: [
      ...filas,
      ["Pagos sin reembolsar", o.pendientes.join(", ")],
      ["Intentos", o.intentos],
      ["Motivo real (Mercado Pago)", o.error || "—"],
    ],
  })

  await supabase.from("fallos_reembolso").update({ ultimo_aviso_en: new Date().toISOString() }).eq("id", fallo.id)
}
