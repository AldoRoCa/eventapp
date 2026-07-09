// Función serverless de Vercel para vistas previas por evento (Open Graph).
//
// El sitio es una SPA: los crawlers (WhatsApp, Facebook, Twitter, Google) que
// NO ejecutan JavaScript solo ven los metadatos genéricos del index.html. Esta
// función se coloca delante de `/evento/:id` (ver el rewrite en vercel.json):
// toma el index.html real del sitio y le inyecta el título, la descripción y
// la imagen DE ESE evento, para que al compartir el link salga su vista previa.
//
// Red de seguridad: ante CUALQUIER error (evento inexistente, falla la consulta
// a Supabase, etc.) devuelve el index.html sin tocar. La SPA arranca igual y la
// página nunca se rompe — la meta dinámica es una mejora, no una dependencia.

const SUPABASE_URL = "https://jvjngaxpqdeababfxecp.supabase.co"
const SUPABASE_KEY = "sb_publishable_uglG9QxSBBwVAWMyFCyxiw_IheVeC0l"

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function resumen(s) {
  const limpio = String(s || "").replace(/\s+/g, " ").trim()
  return limpio.length > 160 ? limpio.slice(0, 157) + "…" : limpio
}

export default async function handler(req, res) {
  const host = req.headers.host
  const id = (req.query?.id || "").toString()

  // 1. Traer el index.html real del sitio (con los assets hasheados del build).
  //    Sin esto no hay nada que servir, así que si falla vamos a la home.
  let html
  try {
    const r = await fetch(`https://${host}/index.html`)
    html = await r.text()
  } catch {
    res.setHeader("Location", "/")
    return res.status(302).end()
  }

  // 2. Intentar inyectar la meta del evento. Si algo falla, se devuelve el
  //    index.html plano (la SPA funciona igual).
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/eventos?id=eq.${encodeURIComponent(id)}&select=titulo,descripcion,imagen_url`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const filas = await r.json()
    const evento = Array.isArray(filas) ? filas[0] : null
    if (!evento) throw new Error("evento no encontrado")

    const titulo = `${evento.titulo} · VELA`
    const desc = resumen(evento.descripcion) || "Descubre este evento en VELA y compra tus boletos de forma segura, con reembolso garantizado."
    const imagen = evento.imagen_url || `https://${host}/hero-bolt-poster.jpg`
    const urlEvento = `https://${host}/evento/${encodeURIComponent(id)}`

    const metaEvento =
      `<title>${esc(titulo)}</title>\n` +
      `    <meta name="description" content="${esc(desc)}" />\n` +
      `    <meta property="og:type" content="website" />\n` +
      `    <meta property="og:site_name" content="VELA" />\n` +
      `    <meta property="og:locale" content="es_MX" />\n` +
      `    <meta property="og:title" content="${esc(titulo)}" />\n` +
      `    <meta property="og:description" content="${esc(desc)}" />\n` +
      `    <meta property="og:url" content="${esc(urlEvento)}" />\n` +
      `    <meta property="og:image" content="${esc(imagen)}" />\n` +
      `    <meta name="twitter:card" content="summary_large_image" />\n` +
      `    <meta name="twitter:title" content="${esc(titulo)}" />\n` +
      `    <meta name="twitter:description" content="${esc(desc)}" />\n` +
      `    <meta name="twitter:image" content="${esc(imagen)}" />`

    // Quitar la meta genérica del index.html para no duplicarla, y sustituir
    // el <title> por el bloque del evento.
    html = html
      .replace(/<meta\s+name="description"[^>]*>\s*/i, "")
      .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
      .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "")
      .replace(/<title>[\s\S]*?<\/title>/i, metaEvento)
  } catch {
    // Se queda el index.html plano — la vista previa será la genérica del sitio.
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  // Cache en el edge de Vercel: reduce la latencia de la opción A (no golpea
  // Supabase en cada visita) y sirve rápido a los crawlers.
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  return res.status(200).send(html)
}
