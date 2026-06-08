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
    const { evento_id, titulo, precio, usuario_id, anfitrion_stripe_id } = await req.json()
    const comision = Math.round(precio * 0.10)
    const total = precio + comision
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Buscar o crear Stripe Customer
    const { data: perfil } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", usuario_id)
      .single()

    let customerId = perfil?.stripe_customer_id

    if (!customerId) {
      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "email": perfil?.email || "",
          "metadata[usuario_id]": usuario_id,
        }).toString()
      })
      const customer = await customerRes.json()
      customerId = customer.id

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", usuario_id)
    }

    const params: Record<string, string> = {
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": "mxn",
      "line_items[0][price_data][product_data][name]": titulo,
      "line_items[0][price_data][unit_amount]": String(total * 100),
      "line_items[0][quantity]": "1",
      "mode": "payment",
      "customer": customerId,
      "payment_intent_data[setup_future_usage]": "on_session",
      "success_url": `${Deno.env.get("SITE_URL")}/pago-exitoso?evento_id=${evento_id}&usuario_id=${usuario_id}`,
      "cancel_url": `${Deno.env.get("SITE_URL")}/evento/${evento_id}`,
      "payment_intent_data[application_fee_amount]": String(comision * 100),
      "payment_intent_data[transfer_data][destination]": anfitrion_stripe_id,
      "metadata[evento_id]": evento_id,
      "metadata[usuario_id]": usuario_id,
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString()
    })

    const session = await response.json()
    return new Response(JSON.stringify({ url: session.url }), {
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