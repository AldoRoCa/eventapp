import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsFor } from "../_shared/cors.ts"

// Desbloquea a un anfitrión pausado por liberación inmediata (ver
// _shared/liberacion.ts). Solo el admin, y solo cuando el anfitrión le
// demostró (captura de Mercado Pago → Tu negocio → Costos) que cambió su
// plazo de liberación a 14 o 30 días.
//
// Qué hace: limpia la marca en mp_credenciales (vuelve a null = "sin
// verificar", NO a false — la próxima venta re-verifica contra la API de MP
// de todos modos: si el anfitrión no lo cambió de verdad, se vuelve a
// bloquear solo con esa venta, y lo único expuesto es ese pago recién
// cobrado, que el detector reembolsa al instante), despausa sus eventos y
// marca sus incidentes como resueltos.

serve(async (req) => {
  const corsHeaders = corsFor(req)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { anfitrion_id } = await req.json()

    if (!anfitrion_id) {
      return new Response(JSON.stringify({ error: "Falta el anfitrión" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Identificar al llamante por su JWT y exigir que sea admin — el
    // desbloqueo cruza una frontera de permisos (toca eventos y credenciales
    // de otro usuario), por eso vive en una Edge Function y no en una
    // política RLS.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    const { data: perfil } = await supabase
      .from("profiles")
      .select("es_admin")
      .eq("id", user.id)
      .single()

    if (!perfil?.es_admin) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    // Rate limiting (mismo patrón que el resto de funciones de admin)
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "desbloquear-anfitrion")
      .gte("window_start", windowStart)

    if ((count || 0) >= 30) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "desbloquear-anfitrion",
      window_start: new Date().toISOString(),
    })

    // 1. Limpiar la marca de liberación (null = sin verificar; la próxima
    //    venta la vuelve a escribir con datos reales).
    const { error: errCred } = await supabase
      .from("mp_credenciales")
      .update({ liberacion_inmediata: null, liberacion_dias: null, liberacion_verificada_en: null })
      .eq("id", anfitrion_id)

    if (errCred) {
      return new Response(JSON.stringify({ error: "No se pudo limpiar la marca del anfitrión" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    // 2. Despausar sus eventos.
    const { error: errEventos } = await supabase
      .from("eventos")
      .update({ ventas_pausadas: false, pausa_motivo: null })
      .eq("anfitrion_id", anfitrion_id)

    if (errEventos) {
      return new Response(JSON.stringify({ error: "Se limpió la marca pero no se pudieron despausar los eventos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    // 3. Marcar sus incidentes pendientes como resueltos.
    await supabase
      .from("incidentes_liberacion")
      .update({ resuelto: true })
      .eq("anfitrion_id", anfitrion_id)
      .eq("resuelto", false)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
