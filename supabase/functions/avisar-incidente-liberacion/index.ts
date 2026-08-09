import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Alerta activa cuando el detector de liberación inmediata registra un
// incidente (ver _shared/liberacion.ts): manda un mensaje de Telegram al
// celular del admin Y un correo (Resend), para que pueda escribirle al
// anfitrión por WhatsApp en el momento, sin depender de revisar el panel.
//
// La dispara un trigger pg_net en cada INSERT a incidentes_liberacion —
// mismo patrón ya probado con fallos_reembolso/avisar-fallo-reembolso. El
// detector NO se toca: la alerta vive por completo fuera de él.
//
// Telegram es opcional: si TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no están
// configurados, se salta y el correo sale igual. Solo se responde error
// (para que pg_net reintente) si NINGUNA de las dos vías pudo salir.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const ALERTA_WEBHOOK_SECRET = Deno.env.get("ALERTA_WEBHOOK_SECRET")
const EMAIL_TO = Deno.env.get("ALERTA_EMAIL_TO") ?? "velaeventapp@gmail.com"
const EMAIL_FROM = Deno.env.get("ALERTA_EMAIL_FROM") ?? "VELA Alertas <onboarding@resend.dev>"
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")

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

  // Mismo secreto compartido que avisar-fallo-reembolso, fail-closed: nadie
  // puede disparar alertas pegándole a la URL sin el header correcto.
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

  const r = payload?.record
  if (payload?.type !== "INSERT" || !r) {
    return new Response("Ignorado", { status: 200 })
  }

  // Nombre del anfitrión y título del evento, para que la alerta sirva tal
  // cual (el admin va a contactar al anfitrión por WhatsApp). Si la consulta
  // falla, la alerta sale igual con los UUIDs.
  let nombreAnfitrion = String(r.anfitrion_id ?? "—")
  let tituloEvento = String(r.evento_id ?? "—")
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )
    const [{ data: perfil }, { data: evento }] = await Promise.all([
      supabase.from("profiles").select("nombre").eq("id", r.anfitrion_id).single(),
      supabase.from("eventos").select("titulo").eq("id", r.evento_id).single(),
    ])
    if (perfil?.nombre) nombreAnfitrion = `${perfil.nombre} (${r.anfitrion_id})`
    if (evento?.titulo) tituloEvento = evento.titulo
  } catch (e) {
    console.error("[avisar-incidente-liberacion] No se pudieron resolver nombres:", e)
  }

  const esInmediata = r.tipo === "liberacion_inmediata"
  const titulo = esInmediata ? "🚨 VELA — Liberación inmediata detectada" : "⚠️ VELA — Dato de liberación ilegible"
  const resumen = esInmediata
    ? "Ventas del anfitrión pausadas y pago detector reembolsado automáticamente. Cuando te mande su captura del plazo corregido (14 o 30 días), desbloquéalo en Admin → Liberación MP."
    : "No se bloqueó nada: el pago llegó sin fecha de liberación legible. Revisar el incidente en Admin → Liberación MP."

  const textoTelegram = [
    titulo,
    `Anfitrión: ${nombreAnfitrion}`,
    `Evento: ${tituloEvento}`,
    `Pago MP: ${r.mp_payment_id ?? "—"}${esInmediata ? " (reembolsado)" : ""}`,
    esInmediata ? `Liberación detectada: ${r.liberacion_dias ?? "?"} días` : null,
    "",
    resumen,
  ].filter((l) => l !== null).join("\n")

  let telegramOk = false
  let correoOk = false

  // 1. Telegram (opcional — si no está configurado, el correo sale igual)
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: textoTelegram }),
      })
      telegramOk = resp.ok
      if (!resp.ok) console.error("[avisar-incidente-liberacion] Telegram rechazó el envío:", resp.status, await resp.text())
    } catch (e) {
      console.error("[avisar-incidente-liberacion] Error de red con Telegram:", e)
    }
  } else {
    console.error("[avisar-incidente-liberacion] Telegram no configurado (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID) — solo correo")
  }

  // 2. Correo (Resend, mismos secrets que avisar-fallo-reembolso)
  if (RESEND_API_KEY) {
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:8px">
        <h2 style="color:${esInmediata ? "#d97706" : "#6b7280"};margin:0 0 4px">${esc(titulo)}</h2>
        <p style="color:#374151;margin:0 0 16px">${esc(resumen)}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;color:#111827">
          <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Anfitrión</td><td style="padding:6px 10px">${esc(nombreAnfitrion)}</td></tr>
          <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Evento</td><td style="padding:6px 10px">${esc(tituloEvento)}</td></tr>
          <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Pago MP</td><td style="padding:6px 10px">${esc(r.mp_payment_id)}</td></tr>
          <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Liberación (días)</td><td style="padding:6px 10px">${esc(r.liberacion_dias)}</td></tr>
          <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Origen</td><td style="padding:6px 10px">${esc(r.origen)}</td></tr>
          <tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">Fecha</td><td style="padding:6px 10px">${esc(r.created_at)}</td></tr>
        </table>
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
          subject: titulo,
          html,
        }),
      })
      correoOk = resp.ok
      if (!resp.ok) console.error("[avisar-incidente-liberacion] Resend rechazó el envío:", resp.status, await resp.text())
    } catch (e) {
      console.error("[avisar-incidente-liberacion] Error de red con Resend:", e)
    }
  } else {
    console.error("[avisar-incidente-liberacion] Falta RESEND_API_KEY")
  }

  // Solo pedir reintento si NINGUNA vía salió — si al menos una llegó, el
  // admin ya está avisado y reintentar duplicaría alertas.
  if (!telegramOk && !correoOk) {
    return new Response("Ninguna alerta pudo enviarse", { status: 500 })
  }
  return new Response("OK", { status: 200 })
})
