import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const RATE_LIMIT = 10 // máximo 10 pagos por hora por usuario

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { evento_id, titulo, precio, usuario_id, cantidad } = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Buscar el token de Mercado Pago del anfitrión del evento. Esto se
    // hace aquí, con service_role, para que el token NUNCA viaje al
    // navegador del comprador.
    const { data: evento, error: eventoError } = await supabase
      .from("eventos")
      .select("anfitrion_id")
      .eq("id", evento_id)
      .single()

    if (eventoError || !evento) {
      return new Response(JSON.stringify({ error: "Evento no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    const { data: anfitrionProfile, error: anfitrionError } = await supabase
      .from("profiles")
      .select("mp_access_token")
      .eq("id", evento.anfitrion_id)
      .single()

    if (anfitrionError || !anfitrionProfile?.mp_access_token) {
      return new Response(JSON.stringify({ error: "El anfitrión no ha conectado su cuenta de Mercado Pago" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const anfitrionMpToken = anfitrionProfile.mp_access_token

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", usuario_id)
      .eq("endpoint", "crear-pago")
      .gte("window_start", windowStart)

    if ((count || 0) >= RATE_LIMIT) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: usuario_id,
      endpoint: "crear-pago",
      window_start: new Date().toISOString(),
    })

    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!
    const siteUrl = Deno.env.get("SITE_URL")!
    const comision = Math.round(precio * 0.10)

    const preference = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anfitrionMpToken}`,
        "X-Integrator-Id": Deno.env.get("MP_CLIENT_ID")!,
      },
      body: JSON.stringify({
        items: [{
          title: titulo,
          quantity: cantidad || 1,
          unit_price: precio,
          currency_id: "MXN",
        }],
        marketplace: Deno.env.get("MP_CLIENT_ID")!,
        marketplace_fee: comision,
        back_urls: {
          success: `${siteUrl}/pago-exitoso?evento_id=${evento_id}&usuario_id=${usuario_id}&collection_status=approved`,
          failure: `${siteUrl}/pago-fallido?evento_id=${evento_id}&usuario_id=${usuario_id}`,
          pending: `${siteUrl}/pago-exitoso?evento_id=${evento_id}&usuario_id=${usuario_id}&collection_status=pending`,
        },
        auto_return: "approved",
        metadata: {
          evento_id,
          usuario_id,
        }
      })
    })

    const data = await preference.json()

    if (!data.init_point) {
      return new Response(JSON.stringify({ error: "Error creando preferencia", detalle: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    return new Response(JSON.stringify({ url: data.init_point }), {
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