import { useEffect, useState } from "react"
import { construirQueryMapa, mapaEmbedSrc, mapaLinkHref } from "../mapaUtils"

// Mini-mapa sin API key (truco "output=embed" de Google Maps, sin costo ni
// configuración de Google Cloud). El iframe no recibe clics (pointerEvents:
// "none") y todo el bloque es un <a> hacia Google Maps: en celular evita que
// arrastrar el mapa "atrape" el scroll de la página, y cumple lo que un
// usuario espera al ver un mini-mapa — que sea un hipervínculo a la
// ubicación exacta, no un mapa interactivo de verdad.
export default function MiniMapaUbicacion({ ubicacion, estado, height = "180px" }) {
  const [query, setQuery] = useState(() => construirQueryMapa(ubicacion, estado))

  useEffect(() => {
    const t = setTimeout(() => setQuery(construirQueryMapa(ubicacion, estado)), 600)
    return () => clearTimeout(t)
  }, [ubicacion, estado])

  if (!ubicacion || !ubicacion.trim()) {
    return (
      <div style={{ height, borderRadius: "14px", border: "1.5px dashed rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px", textAlign: "center", padding: "0 20px" }}>
        Escribe una ubicación para ver el mapa
      </div>
    )
  }

  return (
    <a
      href={mapaLinkHref(query)}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir en Google Maps"
      style={{ position: "relative", display: "block", height, borderRadius: "14px", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.08)", textDecoration: "none" }}
    >
      <iframe
        src={mapaEmbedSrc(query)}
        title="Mini mapa de ubicación"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ width: "100%", height: "100%", border: 0, pointerEvents: "none" }}
      />
      <div style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(19,17,26,0.92)", border: "1px solid rgba(139,107,255,0.4)", borderRadius: "999px", padding: "5px 12px", fontSize: "11.5px", fontWeight: 600, color: "#a78bfa", display: "flex", alignItems: "center", gap: "5px", boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
        Abrir en Google Maps
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H8M17 7V16" /></svg>
      </div>
    </a>
  )
}
