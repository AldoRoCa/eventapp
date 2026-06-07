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
    const { usuario_id, email } = await req.json()
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!

    // Crear cuenta Connect de Stripe para el anfitrión
    const accountResponse = await fetch("https://api.stripe.com/v1/accounts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "type": "express",
        "country": "MX",
        "email": email,
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
      }).toString()
    })

    const account = await accountResponse.json()

    if (!account.id) {
      return new Response(JSON.stringify({ error: "Error creando cuenta Stripe", detalle: account }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // Guardar stripe_account_id en Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    await supabase
      .from("profiles")
      .update({ stripe_account_id: account.id })
      .eq("id", usuario_id)

    // Crear link de onboarding
    const linkResponse = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "account": account.id,
        "refresh_url": `${Deno.env.get("SITE_URL")}/panel?stripe=refresh`,
        "return_url": `${Deno.env.get("SITE_URL")}/panel?stripe=conectado`,
        "type": "account_onboarding",
      }).toString()
    })

    const link = await linkResponse.json()

    return new Response(JSON.stringify({ url: link.url }), {
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