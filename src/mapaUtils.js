export function construirQueryMapa(ubicacion, estado) {
  return [ubicacion, estado, "México"].filter(Boolean).join(", ")
}

export function mapaEmbedSrc(query) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

export function mapaLinkHref(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
