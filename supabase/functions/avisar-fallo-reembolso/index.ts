import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { enviarAlerta, datosAnfitrion } from "../_shared/alertas.ts"
import { resumenMontos, pesos } from "../_shared/montos.ts"

// Alerta activa cuando un reembolso a Mercado Pago falla.
//
// Contexto: cuando un reembolso falla (p. ej. el anfitrión no tiene saldo en
// MP), las Edge Functions de reembolso (cancelar-evento, gestionar-solicitud,
// resolver-reporte, eliminar-cuenta) NO borran nada y registran el fallo en la
// tabla fallos_reembolso. Pero eso solo se ve entrando al panel de Admin. Esta
// función avisa en el momento por Telegram y correo, para no depender de que
// alguien revise el panel.
//
// La dispara un trigger pg_net en cada INSERT a fallos_reembolso (migración
// 20260710120000). Así NO hay que tocar las 4 funciones de reembolso (que
// manejan dinero real) — el aviso vive por completo fuera de ellas.
//
// A partir de aquí solo avisa del PRIMER fallo. El seguimiento (reintento
// automático cada 8 h, motivo real de MP, recuperación y vencimiento de los
// 180 días) lo hace reintentar-reembolsos.

const ALERTA_WEBHOOK_SECRET = Deno.env.get("ALERTA_WEBHOOK_SECRET")

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  // Autenticación por secreto compartido: el Database Webhook manda este header
  // (configurado en el dashboard). Fail-closed: sin el secreto, o si no
  // coincide, se rechaza — así nadie puede disparar correos pegándole a la URL.
  const secretRecibido = req.headers.get("x-alerta-secret")
  if (!ALERTA_WEBHOOK_SECRET || secretRecibido !== ALERTA_WEBHOOK_SECRET) {
    return new Response("No autorizado", { status: 401 })
  }

  let payload: { type?: string; record?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return new Response("JSON inválido", { status: 400 })
  }

  // El webhook dispara en INSERT; el registro insertado viene en `record`.
  const r = payload?.record
  if (payload?.type !== "INSERT" || !r) {
    // No es un insert que nos interese: responder 200 para que no reintente.
    return new Response("Ignorado", { status: 200 })
  }

  const paymentIds = Array.isArray(r.payment_ids) ? r.payment_ids.join(", ") : "—"

  // Nombre, teléfono y WhatsApp del anfitrión, para poder contactarlo de
  // inmediato desde la alerta. Se resuelve por el evento (no por usuario_id,
  // que en un reporte resuelto es el admin, no el anfitrión).
  let tituloEvento = String(r.evento_id ?? "—")
  let filasAnfitrion: [string, unknown][] = []
  let filasMonto: [string, unknown][] = []
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!)
    const { data: evento } = await supabase.from("eventos").select("anfitrion_id, titulo").eq("id", r.evento_id).single()
    if (evento?.titulo) tituloEvento = evento.titulo
    const datos = await datosAnfitrion(supabase, evento?.anfitrion_id ?? null)
    filasAnfitrion = [
      ["Anfitrión", datos.nombre],
      ["Teléfono", datos.telefono],
      ...(datos.whatsapp ? [["WhatsApp", datos.whatsapp] as [string, unknown]] : []),
    ]

    // Cuánto dinero quedó sin devolver, YA en esta primera alerta (si se
    // esperara al primer reintento, la sabrías hasta 8 horas después).
    const { data: cred } = await supabase
      .from("mp_credenciales")
      .select("mp_access_token")
      .eq("id", evento?.anfitrion_id)
      .single()
    if (cred?.mp_access_token && Array.isArray(r.payment_ids)) {
      const m = await resumenMontos(supabase, r.payment_ids as string[], [], cred.mp_access_token)
      filasMonto = [["Dinero sin devolver", pesos(m.pendiente)], ["Boletos afectados", m.boletos]]
      await supabase.from("fallos_reembolso").update({
        monto_pendiente: m.pendiente,
        monto_recuperado: m.recuperado,
        boletos_afectados: m.boletos,
      }).eq("id", r.id)
    }
  } catch (e) {
    console.error("[avisar-fallo-reembolso] No se pudieron resolver los datos del anfitrión:", e)
  }

  const { telegram, correo } = await enviarAlerta({
    titulo: "🔴 VELA — Reembolso fallido",
    resumen: "Un reembolso a Mercado Pago no se pudo completar (lo más común: el anfitrión no tiene saldo). Nada se borró. El reintento automático corre cada 8 horas y te avisará si se recupera; el motivo exacto de Mercado Pago aparecerá tras el primer reintento.",
    filas: [
      ...filasAnfitrion,
      ["Evento", tituloEvento],
      ...filasMonto,
      ["Origen", r.contexto],
      ["Pagos MP", paymentIds],
      ["Detalle", r.detalle],
      ["Fecha", r.created_at],
    ],
  })

  // Solo pedir reintento a pg_net si NINGUNA vía salió: si al menos una
  // llegó, el admin ya está avisado y reintentar duplicaría alertas.
  if (!telegram && !correo) {
    return new Response("Ninguna alerta pudo enviarse", { status: 500 })
  }
  return new Response("OK", { status: 200 })
})
