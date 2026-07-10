// Comprime y redimensiona una imagen antes de subirla a Supabase.
//
// Por qué: las fotos que suben los anfitriones suelen pesar ~1MB. Eso trae dos
// problemas: (1) WhatsApp NO muestra la vista previa de un evento si su imagen
// pesa más de ~300KB — la descarta y deja solo el texto; y (2) el egress del
// free tier de Supabase (5GB/mes) se consume rápido si cada visita descarga
// ~1MB. Redimensionar a máx. 1200px y comprimir a JPEG deja las imágenes bien
// por debajo de ese límite, sin perder calidad perceptible en pantalla.
//
// La calidad NO es fija: se baja de forma adaptativa (0.8 → 0.4) hasta que el
// resultado quede bajo el objetivo (~250KB, con margen frente al límite de
// WhatsApp). Así una foto muy detallada también termina lo bastante ligera.
//
// Devuelve un File JPEG. Si algo falla, devuelve el original sin romper la subida.
export function comprimirImagen(file, maxAncho = 1200, objetivoBytes = 250 * 1024) {
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

        const nombre = (file.name || "imagen").replace(/\.[^.]+$/, "") + ".jpg"

        // Baja la calidad hasta quedar bajo el objetivo, o hasta tocar el piso
        // (0.4). El piso evita degradar de más una imagen que ya no comprime.
        const intentar = (calidad) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file)
              if (blob.size <= objetivoBytes || calidad <= 0.4) {
                return resolve(new File([blob], nombre, { type: "image/jpeg" }))
              }
              intentar(Math.round((calidad - 0.1) * 10) / 10)
            },
            "image/jpeg",
            calidad
          )
        }
        intentar(0.8)
      } catch {
        resolve(file)
      }
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// Igual que comprimirImagen pero con parámetros para avatares. Un avatar se
// muestra chico (máx ~88px de lado en la UI), así que 512px y un objetivo de
// ~120KB sobran de calidad y bajan mucho el peso (una foto de celular de ~3MB
// termina en unos KB). Se usa en el cambio de foto (Perfil) y en el registro.
export function comprimirAvatar(file) {
  return comprimirImagen(file, 512, 120 * 1024)
}
