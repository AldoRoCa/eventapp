import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  try {
    const { boleto_id } = await req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Identificar al usuario autenticado a partir de su token
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
      .eq("endpoint", "hacer-checkin")
      .gte("window_start", windowStart)

    if ((count || 0) >= 120) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "hacer-checkin",
      window_start: new Date().toISOString(),
    })

    const { data: boleto } = await supabase
      .from("boletos")
      .select("id, estado, checkin_en, eventos(anfitrion_id)")
      .eq("id", boleto_id)
      .single()

    if (!boleto) {
      return new Response(JSON.stringify({ error: "Boleto no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Verificar que el usuario autenticado es el anfitrión del evento
    if (boleto.eventos?.anfitrion_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sin permiso para hacer check-in de este boleto" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    if (boleto.estado !== "activo") {
      return new Response(JSON.stringify({ error: "El boleto no está activo (pago o solicitud no confirmados)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (boleto.checkin_en) {
      return new Response(JSON.stringify({ error: "Este boleto ya tiene check-in registrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      })
    }

    const ahora = new Date().toISOString()
    const { data: actualizado, error: updateError } = await supabase
      .from("boletos")
      .update({ checkin_en: ahora })
      .eq("id", boleto_id)
      .is("checkin_en", null)
      .select("id, checkin_en")
      .single()

    if (updateError || !actualizado) {
      return new Response(JSON.stringify({ error: "Este boleto ya tiene check-in registrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      })
    }

    return new Response(JSON.stringify({ ok: true, checkin_en: actualizado.checkin_en }), {
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
