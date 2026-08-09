// Envío de alertas al admin por Telegram y correo (Resend).
//
// Lo usan avisar-fallo-reembolso y reintentar-reembolsos. NO lo usa
// avisar-incidente-liberacion: esa función ya está probada en producción y no
// se toca por una refactorización cosmética — si algún día se modifica por
// otro motivo, que se mude a este módulo.
//
// Telegram es opcional: si faltan sus secretos, el correo sale igual. Quien
// llama decide qué hacer si NINGUNA vía salió (normalmente responder 500 para
// que pg_net reintente).

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const EMAIL_TO = Deno.env.get("ALERTA_EMAIL_TO") ?? "velaeventapp@gmail.com"
const EMAIL_FROM = Deno.env.get("ALERTA_EMAIL_FROM") ?? "VELA Alertas <onboarding@resend.dev>"
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")

export function esc(v: unknown): string {
  return String(v ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Nombre, teléfono y link de WhatsApp del anfitrión, para que la alerta sirva
// tal cual y el admin pueda escribirle sin ir a buscar sus datos.
// deno-lint-ignore no-explicit-any
export async function datosAnfitrion(supabase: any, anfitrionId: string | null) {
  const vacio = { nombre: "—", telefono: "—", whatsapp: null as string | null }
  if (!anfitrionId) return vacio
  try {
    const { data } = await supabase.from("profiles").select("nombre, telefono").eq("id", anfitrionId).single()
    if (!data) return vacio
    let whatsapp: string | null = null
    if (data.telefono) {
      // El teléfono se captura en formato libre ("442 123 4567"): se limpia a
      // dígitos y, si son los 10 de un número mexicano, se antepone 521.
      const digitos = String(data.telefono).replace(/\D/g, "")
      if (digitos.length === 10) whatsapp = `https://wa.me/521${digitos}`
      else if (digitos.length > 10) whatsapp = `https://wa.me/${digitos}`
    }
    return { nombre: data.nombre || "—", telefono: data.telefono || "—", whatsapp }
  } catch {
    return vacio
  }
}

export type Fila = [string, unknown]

export async function enviarAlerta(opts: {
  titulo: string
  resumen: string
  filas: Fila[]
  colorHtml?: string
}): Promise<{ telegram: boolean; correo: boolean }> {
  const { titulo, resumen, filas, colorHtml = "#dc2626" } = opts
  let telegram = false
  let correo = false

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const texto = [
      titulo,
      "",
      ...filas.map(([k, v]) => `${k}: ${v ?? "—"}`),
      "",
      resumen,
    ].join("\n")
    try {
      const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sin parse_mode: el texto lleva nombres y errores crudos de MP que
        // podrían romper el formato de Markdown y hacer fallar el envío.
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: texto, disable_web_page_preview: true }),
      })
      telegram = resp.ok
      if (!resp.ok) console.error("[alertas] Telegram rechazó el envío:", resp.status, await resp.text())
    } catch (e) {
      console.error("[alertas] Error de red con Telegram:", e)
    }
  } else {
    console.error("[alertas] Telegram no configurado (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID) — solo correo")
  }

  if (RESEND_API_KEY) {
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:8px">
        <h2 style="color:${colorHtml};margin:0 0 4px">${esc(titulo)}</h2>
        <p style="color:#374151;margin:0 0 16px">${esc(resumen)}</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;color:#111827">
          ${filas.map(([k, v]) => `<tr><td style="padding:6px 10px;background:#f3f4f6;font-weight:600">${esc(k)}</td><td style="padding:6px 10px">${esc(v)}</td></tr>`).join("")}
        </table>
      </div>`
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: EMAIL_FROM, to: [EMAIL_TO], subject: titulo, html }),
      })
      correo = resp.ok
      if (!resp.ok) console.error("[alertas] Resend rechazó el envío:", resp.status, await resp.text())
    } catch (e) {
      console.error("[alertas] Error de red con Resend:", e)
    }
  } else {
    console.error("[alertas] Falta RESEND_API_KEY")
  }

  return { telegram, correo }
}
