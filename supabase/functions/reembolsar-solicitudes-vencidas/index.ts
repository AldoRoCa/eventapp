import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { enviarAlerta, datosAnfitrion } from "../_shared/alertas.ts"

// Solicitudes que el anfitrión nunca respondió y su evento ya terminó.
// La dispara pg_cron cada hora (ver migración 20260810140000).
//
// Por qué existe: un boleto en estado "pendiente" no lo tocaba NADIE. El único
// cron que limpiaba boletos era el de "pendiente_pago" (pagos abandonados), y
// gestionar-solicitud no tiene ninguna verificación de fecha. Resultado: si un
// asistente pagaba una solicitud y el anfitrión no respondía, el evento pasaba,
// el dinero se quedaba con el anfitrión y el comprador nunca entró — hacer-checkin
// exige estado "activo", así que en la puerta lo habrían rechazado. La solicitud
// quedaba viva para siempre, y a los 180 días MP ya no permite reembolsarla.
//
// Decisión explícita del usuario (2026-08-10), sabiendo que esto mueve dinero de
// la cuenta del anfitrión sin preguntarle: "se está usando dinero del usuario sin
// haberle dado entrada al evento, entonces creo que yo sí lo haría a la ligera.
// Por respeto."
//
// Regla de este trabajo, igual que en reintentar-reembolsos: NO se toca ninguna
// de las 4 funciones de reembolso que ya funcionan. Esta reusa su mismo patrón
// defensivo (GET previo para no reembolsar doble + X-Idempotency-Key + no marcar
// nada si el reembolso falla) y, cuando falla, deja el caso en fallos_reembolso
// para que la maquinaria de reintento y alertas que ya existe se encargue.

// Margen después de que el evento termina, antes de devolver el dinero. Le da al
// anfitrión una última ventana (puede estar cerrando el evento) y evita chocar
// con una aprobación tardía que esté ocurriendo en ese momento.
const HORAS_GRACIA = 2

// Duración máxima que puede tener un evento (ver eventoUtils / CrearEvento). Se
// usa solo para el prefiltro en la base; la condición fina se calcula abajo.
const MAX_DURACION_HORAS = 24

const MOTIVO = "El evento terminó sin que el anfitrión respondiera tu solicitud. Se canceló automáticamente y, si habías pagado, el reembolso ya fue enviado a tu medio de pago."

const ALERTA_WEBHOOK_SECRET = Deno.env.get("ALERTA_WEBHOOK_SECRET")

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  // Mismo secreto compartido que las otras alertas/crons, fail-closed.
  if (!ALERTA_WEBHOOK_SECRET || req.headers.get("x-alerta-secret") !== ALERTA_WEBHOOK_SECRET) {
    return new Response("No autorizado", { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!
  )

  // Prefiltro generoso en la base (cualquier evento que empezó hace más que la
  // gracia); la condición real —que haya pasado su duración completa más la
  // gracia— se evalúa abajo, porque depende de duracion_horas de cada evento.
  const corteAmplio = new Date(Date.now() - HORAS_GRACIA * 60 * 60 * 1000).toISOString()

  const { data: pendientes, error: errPendientes } = await supabase
    .from("boletos")
    .select("id, evento_id, usuario_id, mp_payment_id, monto_pagado, eventos!inner(id, titulo, fecha, precio, duracion_horas, anfitrion_id)")
    .eq("estado", "pendiente")
    .lt("eventos.fecha", corteAmplio)
    .limit(200)

  if (errPendientes) {
    console.error("[solicitudes-vencidas] No se pudieron leer las solicitudes:", errPendientes.message)
    return new Response("Error leyendo solicitudes", { status: 500 })
  }

  const ahora = Date.now()
  // deno-lint-ignore no-explicit-any
  const vencidas = (pendientes ?? []).filter((b: any) => {
    const ev = b.eventos
    if (!ev?.fecha) return false
    const duracion = Number(ev.duracion_horas) || MAX_DURACION_HORAS
    const finMasGracia = new Date(ev.fecha).getTime() + (duracion + HORAS_GRACIA) * 60 * 60 * 1000
    return finMasGracia <= ahora
  })

  if (vencidas.length === 0) {
    return new Response(JSON.stringify({ ok: true, sin_pendientes: true }), { status: 200 })
  }

  const resumen = { revisadas: 0, canceladas: 0, reembolsadas: 0, fallidas: 0, montoDevuelto: 0 }
  // Un token por anfitrión, no uno por boleto.
  const tokens = new Map<string, string | null>()

  for (const boleto of vencidas) {
    resumen.revisadas++
    try {
      await procesar(supabase, boleto, tokens, resumen)
    } catch (e) {
      // Una solicitud problemática no debe impedir procesar las demás.
      // deno-lint-ignore no-explicit-any
      console.error(`[solicitudes-vencidas] Error procesando boleto ${boleto.id}:`, (e as any)?.message ?? e)
    }
  }

  // Solo se avisa cuando SÍ se devolvió dinero: los reembolsos que fallan ya
  // disparan su propia alerta al insertarse en fallos_reembolso (trigger
  // notificar_fallo_reembolso), y duplicarla volvería ruido el bot.
  if (resumen.reembolsadas > 0) {
    await enviarAlerta({
      titulo: resumen.fallidas > 0
        ? "⚠️ VELA — Solicitudes vencidas: algún reembolso falló"
        : "↩️ VELA — Solicitudes vencidas reembolsadas automáticamente",
      resumen: resumen.fallidas > 0
        ? "Se cancelaron solicitudes que el anfitrión nunca respondió, pero al menos un reembolso no pasó. Los que fallaron quedaron registrados en Reembolsos fallidos y el reintento automático los seguirá intentando."
        : "Solicitudes que el anfitrión nunca respondió antes de que terminara su evento. Se cancelaron y se devolvió el dinero a los compradores.",
      filas: [
        ["Solicitudes vencidas revisadas", resumen.revisadas],
        ["Canceladas", resumen.canceladas],
        ["Con reembolso enviado", resumen.reembolsadas],
        ["Reembolsos fallidos", resumen.fallidas],
        ["Dinero devuelto", `$${resumen.montoDevuelto.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN`],
      ],
      colorHtml: resumen.fallidas > 0 ? "#dc2626" : "#2563eb",
    })
  }

  return new Response(JSON.stringify({ ok: true, ...resumen }), { status: 200 })
})

// deno-lint-ignore no-explicit-any
async function procesar(supabase: any, boleto: any, tokens: Map<string, string | null>, resumen: any) {
  const evento = boleto.eventos

  // Solicitud gratis: no hay dinero de por medio, solo se cierra.
  if (!boleto.mp_payment_id) {
    await supabase.from("boletos")
      .update({ estado: "rechazado", motivo_rechazo: "El evento terminó sin que el anfitrión respondiera tu solicitud." })
      .eq("id", boleto.id)
      .eq("estado", "pendiente")
    resumen.canceladas++
    return
  }

  if (!tokens.has(evento.anfitrion_id)) {
    const { data: cred } = await supabase
      .from("mp_credenciales")
      .select("mp_access_token")
      .eq("id", evento.anfitrion_id)
      .single()
    tokens.set(evento.anfitrion_id, cred?.mp_access_token ?? null)
  }
  const token = tokens.get(evento.anfitrion_id)

  if (!token) {
    // Sin token no se puede devolver nada, y el boleto NO se toca: marcarlo
    // rechazado sin reembolsar sería quedarse con el dinero.
    await registrarFallo(supabase, boleto, evento, "El anfitrión no tiene credenciales de Mercado Pago conectadas, así que no se pudo reembolsar una solicitud vencida.")
    resumen.fallidas++
    return
  }

  const r = await reembolsar(supabase, boleto, token, evento)

  if (!r.ok) {
    await registrarFallo(supabase, boleto, evento, `Mercado Pago rechazó el reembolso automático de una solicitud vencida: ${r.error || "error desconocido"}`)
    resumen.fallidas++
    return
  }

  // Solo después de que el dinero volvió se marca el boleto. El filtro por
  // estado mantiene la operación idempotente si dos ciclos se traslapan.
  await supabase.from("boletos")
    .update({ estado: "rechazado", motivo_rechazo: MOTIVO })
    .eq("id", boleto.id)
    .eq("estado", "pendiente")

  resumen.canceladas++
  resumen.reembolsadas++
  resumen.montoDevuelto += r.monto
  console.error(`[solicitudes-vencidas] Reembolsada solicitud vencida ${boleto.id} del evento "${evento.titulo}" por $${r.monto}`)
}

// Mismo patrón que gestionar-solicitud: un pago puede cubrir varios boletos
// comprados juntos, así que si quedan otros vivos se devuelve solo la parte de
// este boleto; si es el último, se devuelve lo que quede del pago completo.
// deno-lint-ignore no-explicit-any
async function reembolsar(supabase: any, boleto: any, token: string, evento: any): Promise<{ ok: boolean; monto: number; error?: string }> {
  // Lo que se pagó por ESTE boleto. Los boletos anteriores a la columna
  // monto_pagado la tienen en null: para ellos vale el mismo respaldo que usa
  // gestionar-solicitud (se compraron cuando la comisión era 10% fijo).
  //
  // Ojo, esto NO es cosmético: sin el respaldo, un boleto viejo daría monto 0,
  // el body saldría vacío y MP reembolsaría el pago COMPLETO — arrastrando a
  // los demás boletos de esa misma compra, que quizá sí fueron aprobados.
  const monto = boleto.monto_pagado != null
    ? Number(boleto.monto_pagado) || 0
    : Math.round((Number(evento?.precio) || 0) * 1.10)
  try {
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const pago = await consulta.json()
    // Ya devuelto (por ejemplo, porque el reintento automático lo recuperó en
    // un ciclo anterior): se da por bueno y el boleto se cierra.
    if (consulta.ok && pago.status === "refunded") return { ok: true, monto: 0 }

    const { count } = await supabase
      .from("boletos")
      .select("*", { count: "exact", head: true })
      .eq("mp_payment_id", boleto.mp_payment_id)
      .neq("estado", "rechazado")

    const body = (count || 1) > 1 && monto > 0 ? { amount: monto } : {}

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}))
      const texto = detalle?.message || detalle?.error || `HTTP ${res.status}`
      console.error(`[ALERTA-REEMBOLSO] Reembolso automático rechazado por MP para pago ${boleto.mp_payment_id}:`, res.status, JSON.stringify(detalle))
      return { ok: false, monto: 0, error: String(texto) }
    }
    const devuelto = await res.json().catch(() => ({}))
    return { ok: true, monto: Number(devuelto?.amount) || monto }
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    const msg = (e as any)?.message ?? String(e)
    console.error(`[ALERTA-REEMBOLSO] Error de red reembolsando pago ${boleto.mp_payment_id}:`, msg)
    return { ok: false, monto: 0, error: msg }
  }
}

// Deja el caso en la tabla que ya alimenta el panel de Admin, la alerta de
// Telegram y el reintento cada 8 horas. Sin duplicar: si ese pago ya tiene un
// fallo sin resolver, no se inserta otro (este cron corre cada hora).
// deno-lint-ignore no-explicit-any
async function registrarFallo(supabase: any, boleto: any, evento: any, detalle: string) {
  const paymentId = String(boleto.mp_payment_id)
  const { data: yaRegistrado } = await supabase
    .from("fallos_reembolso")
    .select("id")
    .eq("resuelto", false)
    .contains("payment_ids", [paymentId])
    .limit(1)

  if (yaRegistrado && yaRegistrado.length > 0) return

  await supabase.from("fallos_reembolso").insert({
    contexto: "solicitud-vencida",
    usuario_id: boleto.usuario_id,
    evento_id: evento.id,
    payment_ids: [paymentId],
    detalle,
  })
}
