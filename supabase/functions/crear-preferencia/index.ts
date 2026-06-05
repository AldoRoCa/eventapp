import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { evento_id, titulo, precio, cantidad, anfitrion_mp_token, comprador_email } = await req.json()

    const comision = Math.round(precio * 0.10)
    const total = precio + comision

    const preferencia = {
      items: [
        {
          id: evento_id,
          title: titulo,
          quantity: cantidad || 1,
          unit_price: total,
          currency_id: "MXN",
        }
      ],
      payer: {
        email: comprador_email,
      },
      marketplace_fee: comision,
      back_urls: {
        success: `${Deno.env.get("SITE_URL")}/pago-exitoso`,
        failure: `${Deno.env.get("SITE_URL")}/pago-fallido`,
        pending: `${Deno.env.get("SITE_URL")}/pago-pendiente`,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-pago`,
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anfitrion_mp_token}`,
      },
      body: JSON.stringify(preferencia),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
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