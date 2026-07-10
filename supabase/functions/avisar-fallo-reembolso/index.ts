import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Alerta activa cuando un reembolso a Mercado Pago falla.
//
// Contexto: cuando un reembolso falla (p. ej. el anfitrión no tiene saldo en
// MP), las Edge Functions de reembolso (cancelar-evento, gestionar-solicitud,
// resolver-reporte, eliminar-cuenta) NO borran nada y registran el fallo en la
// tabla fallos_reembolso. Pero eso solo se ve entrando al panel de Admin. Esta
// función manda un correo de aviso en el momento, para no depender de que
// alguien revise el panel.
//
// La dispara un Database Webhook de Supabase en cada INSERT a fallos_reembolso
// (ver la migración que crea el trigger). Así NO hay que tocar las 4 funciones
// de reembolso (que manejan dinero real) — el aviso vive por completo fuera de
// ellas.
//
// Envía el correo con Resend (https://resend.com). Con la cuenta de Resend
// creada con el propio correo destino, se puede enviar desde el remitente de
// prueba onboarding@resend.dev hacia ese correo sin verificar un dominio.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const ALERTA_WEBHOOK_SECRET = Deno.env.get("ALERTA_WEBHOOK_SECRET")
const EMAIL_TO = Deno.env.get("ALERTA_EMAIL_TO") ?? "velaeventapp@gmail.com"
const EMAIL_FROM = Deno.env.get("ALERTA_EMAIL_FROM") ?? "VELA Alertas <onboarding@resend.dev>"

function esc(v: unknown): string {
  return String(v ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

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

  if (!RESEND_API_KEY) {
    console.error("[avisar-fallo-reembolso] Falta RESEND_API_KEY")
    return new Response("Falta configuración de correo", { status: 500 })
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

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:8px">
      <h2 style="color:#dc2626;margin:0 0 4px">⚠️ Reembolso fallido en VELA</h2>
      <p style="color:#374151;margin:0 0 16px">Un reembolso a Mercado Pago no se pudo completar. Nada se borró; requiere seguimiento manual.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;color:#111827">
        <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Contexto</td><td style="padding:6px 10px">${esc(r.contexto)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Detalle</td><td style="padding:6px 10px">${esc(r.detalle)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Evento</td><td style="padding:6px 10px">${esc(r.evento_id)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Usuario</td><td style="padding:6px 10px">${esc(r.usuario_id)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Pagos MP</td><td style="padding:6px 10px">${esc(paymentIds)}</td></tr>
        <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Fecha</td><td style="padding:6px 10px">${esc(r.created_at)}</td></tr>
      </table>
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0">Revisa la pestaña "Reembolsos fallidos" en el panel de Admin para darle seguimiento y marcarlo como resuelto.</p>
    </div>`

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_TO],
        subject: `⚠️ Reembolso fallido: ${esc(r.contexto)}`,
        html,
      }),
    })

    if (!resp.ok) {
      const txt = await resp.text()
      console.error("[avisar-fallo-reembolso] Resend rechazó el envío:", resp.status, txt)
      // 500 para que el webhook reintente (fallo transitorio de Resend).
      return new Response("Error al enviar correo", { status: 500 })
    }
  } catch (e) {
    console.error("[avisar-fallo-reembolso] Error de red enviando correo:", e)
    return new Response("Error de red", { status: 500 })
  }

  return new Response("OK", { status: 200 })
})
