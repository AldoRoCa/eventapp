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
    const { boleto_id, accion } = await req.json()
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!
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
      .eq("endpoint", "gestionar-solicitud")
      .gte("window_start", windowStart)

    if ((count || 0) >= 30) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "gestionar-solicitud",
      window_start: new Date().toISOString(),
    })

    const { data: boleto } = await supabase
      .from("boletos")
      .select("*, eventos(precio, anfitrion_id)")
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
      return new Response(JSON.stringify({ error: "Sin permiso para gestionar esta solicitud" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    if (accion === "aprobar") {
      await supabase.from("boletos").update({ estado: "activo" }).eq("id", boleto_id)

    } else if (accion === "rechazar") {
      if (boleto.mp_payment_id) {
        await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}/refunds`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${mpToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({})
        })
      }
      await supabase.from("boletos").update({ estado: "rechazado" }).eq("id", boleto_id)
    }

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