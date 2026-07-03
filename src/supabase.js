import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jvjngaxpqdeababfxecp.supabase.co'
export const supabaseKey = 'sb_publishable_uglG9QxSBBwVAWMyFCyxiw_IheVeC0l'

export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * supabase.auth.getUser() hace una llamada de red real para validar el
 * token contra el servidor, sin timeout propio. Si esa llamada tarda o
 * se queda colgada (común justo después de recargar la pestaña o volver
 * de segundo plano en móvil), cualquier página que la espere con `await`
 * se queda atascada en su estado de carga para siempre — el usuario ve
 * la app "a medias" hasta forzar un refresh manual.
 *
 * getUserSafe() agrega un timeout corto; si getUser() no responde a
 * tiempo, recurre a getSession() (que lee la sesión cacheada en
 * localStorage, sin red, y responde casi instantáneo) en vez de quedarse
 * esperando indefinidamente. Esto prioriza que la app SIEMPRE termine de
 * cargar sobre la validación más estricta de getUser().
 */
export async function getUserSafe(timeoutMs = 4000) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ])
    return result
  } catch {
    const { data: { session } } = await supabase.auth.getSession()
    return { data: { user: session?.user ?? null }, error: null }
  }
}