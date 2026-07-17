// Función serverless de Vercel que genera el sitemap.xml real del sitio.
//
// El sitio es una SPA: sin esta función, /sitemap.xml caía en el rewrite
// catch-all de la SPA (ver vercel.json) y servía el index.html completo en
// vez de un XML — Google Search Console no puede leer un sitemap así. Se
// coloca delante de /sitemap.xml (ver el rewrite en vercel.json).
//
// Incluye las páginas públicas fijas más los eventos activos/próximos
// (mismo filtro que ya usa Explorar.jsx: fecha >= ahora-24h, para no listar
// eventos claramente terminados). Consulta pública a Supabase, sin auth —
// mismo patrón que api/og-evento.js.

const SUPABASE_URL = "https://jvjngaxpqdeababfxecp.supabase.co"
const SUPABASE_KEY = "sb_publishable_uglG9QxSBBwVAWMyFCyxiw_IheVeC0l"

const PAGINAS_ESTATICAS = [
  { ruta: "/", prioridad: "1.0", frecuencia: "daily" },
  { ruta: "/explorar", prioridad: "0.9", frecuencia: "hourly" },
  { ruta: "/ser-anfitrion", prioridad: "0.7", frecuencia: "monthly" },
  { ruta: "/acerca", prioridad: "0.5", frecuencia: "monthly" },
  { ruta: "/contacto", prioridad: "0.4", frecuencia: "monthly" },
  { ruta: "/terminos", prioridad: "0.3", frecuencia: "yearly" },
  { ruta: "/privacidad", prioridad: "0.3", frecuencia: "yearly" },
  { ruta: "/seguridad", prioridad: "0.3", frecuencia: "yearly" },
  { ruta: "/reembolsos", prioridad: "0.3", frecuencia: "yearly" },
]

export default async function handler(req, res) {
  const base = `https://${req.headers.host}`
  const urls = PAGINAS_ESTATICAS.map(
    (p) => `  <url>\n    <loc>${base}${p.ruta}</loc>\n    <changefreq>${p.frecuencia}</changefreq>\n    <priority>${p.prioridad}</priority>\n  </url>`
  )

  try {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/eventos?select=id,fecha&fecha=gte.${hace24h}&order=fecha.desc&limit=500`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
    const eventos = await r.json()
    if (Array.isArray(eventos)) {
      for (const ev of eventos) {
        urls.push(
          `  <url>\n    <loc>${base}/evento/${ev.id}</loc>\n    <lastmod>${new Date(ev.fecha).toISOString().slice(0, 10)}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`
        )
      }
    }
  } catch {
    // Si falla la consulta a Supabase, el sitemap sale igual con las
    // páginas estáticas — nunca se rompe por completo.
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.join("\n") +
    `\n</urlset>\n`

  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200")
  return res.status(200).send(xml)
}
