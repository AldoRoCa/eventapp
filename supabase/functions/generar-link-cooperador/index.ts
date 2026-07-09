import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://eventapp-flax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  try {
    const { evento_id, acepta_responsabilidad } = await req.json()

    if (!evento_id) {
      return new Response(JSON.stringify({ error: "Falta el evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
    // La casilla de aceptación se valida aquí, no solo en el frontend: sin
    // este flag en el cuerpo de la petición, el link nunca se genera, sin
    // importar qué tan manipulado esté el botón en el navegador del anfitrión.
    if (acepta_responsabilidad !== true) {
      return new Response(JSON.stringify({ error: "Debes aceptar la cláusula de responsabilidad para generar el link" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "generar-link-cooperador")
      .gte("window_start", windowStart)

    if ((count || 0) >= 20) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "generar-link-cooperador",
      window_start: new Date().toISOString(),
    })

    const { data: evento } = await supabase
      .from("eventos")
      .select("id, anfitrion_id")
      .eq("id", evento_id)
      .single()

    if (!evento || evento.anfitrion_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sin permiso sobre este evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    const codigo = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
    const { data: invitacion, error: insertError } = await supabase
      .from("invitaciones_cooperador")
      .insert({
        evento_id,
        codigo,
        created_by: user.id,
        responsabilidad_aceptada_en: new Date().toISOString(),
      })
      .select("id, codigo")
      .single()

    if (insertError || !invitacion) {
      return new Response(JSON.stringify({ error: "No se pudo generar el link" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ ok: true, id: invitacion.id, codigo: invitacion.codigo }), {
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
