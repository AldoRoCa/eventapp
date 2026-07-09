// Comprime y redimensiona una imagen antes de subirla a Supabase.
//
// Por qué: las fotos que suben los anfitriones suelen pesar ~1MB (PNG grandes).
// Eso trae dos problemas: (1) WhatsApp NO muestra la vista previa de un evento
// si su imagen pesa más de ~300KB — la descarta y deja solo el texto; y (2) el
// egress del free tier de Supabase (5GB/mes) se consume rápido si cada visita a
// un evento descarga ~1MB. Bajar a máx. 1200px de ancho y JPEG calidad ~0.8
// deja las imágenes en ~100–250KB: arregla la vista previa y reduce el egress
// ~6×, sin perder calidad perceptible en pantalla.
//
// Devuelve un File JPEG. Si algo falla (formato raro, error de canvas), devuelve
// el archivo original sin romper la subida.
export function comprimirImagen(file, maxAncho = 1200, calidad = 0.8) {
  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith("image/")) return resolve(file)

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const escala = Math.min(1, maxAncho / img.width) // solo achica, nunca agranda
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)

        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        // Fondo blanco: si el PNG tenía transparencia, al pasar a JPEG queda
        // blanco en vez de negro.
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file)
            const nombre = (file.name || "imagen").replace(/\.[^.]+$/, "") + ".jpg"
            resolve(new File([blob], nombre, { type: "image/jpeg" }))
          },
          "image/jpeg",
          calidad
        )
      } catch {
        resolve(file)
      }
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
