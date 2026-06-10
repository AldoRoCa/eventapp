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
    const { evento_id, titulo, precio, usuario_id, anfitrion_mp_token, cantidad } = await req.json()

    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!
    const siteUrl = Deno.env.get("SITE_URL")!
    const comision = Math.round(precio * 0.10)

    const preference = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anfitrion_mp_token}`,
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