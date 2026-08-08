/**
 * Origen permitido para llamar a las Edge Functions desde el navegador.
 *
 * Antes esto era una sola cadena fija ("https://eventapp-flax.vercel.app")
 * copiada en las 15 funciones. Cuando el sitio se movió al dominio propio
 * (www.velaapp.online) TODAS las Edge Functions dejaron de funcionar desde
 * el sitio real — comprar boletos, check-in, reembolsos, reseñas, baja de
 * cuenta — porque el navegador bloquea la petición antes de mandarla y la
 * reporta como un genérico "Failed to fetch", sin pista de la causa. El
 * resto de la app seguía bien porque la API REST de Supabase acepta
 * cualquier origen; solo estas funciones tenían la restricción.
 *
 * Ahora la lista vive en un solo lugar. Para dar de alta otro dominio,
 * agrégalo aquí y vuelve a desplegar las funciones.
 */
export const ORIGENES_PERMITIDOS = [
  "https://www.velaapp.online",   // dominio real (canónico: el apex redirige aquí)
  "https://velaapp.online",       // por si alguna vez el apex deja de redirigir
  "https://eventapp-flax.vercel.app", // URL de Vercel, se conserva para pruebas
]

/**
 * Devuelve las cabeceras CORS para ESTA petición.
 *
 * Se responde con el origen exacto de quien llama (no con "*") solo si está
 * en la lista blanca; si no, se responde con el dominio canónico, lo que
 * hace que el navegador del llamante no autorizado bloquee la respuesta.
 *
 * `Vary: Origin` es necesario porque la respuesta cambia según el origen:
 * sin él, una caché intermedia podría servirle a un dominio la cabecera
 * calculada para otro.
 */
export function corsFor(req: Request) {
  const origen = req.headers.get("Origin") ?? ""
  return {
    "Access-Control-Allow-Origin": ORIGENES_PERMITIDOS.includes(origen)
      ? origen
      : ORIGENES_PERMITIDOS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  }
}
