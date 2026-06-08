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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    const { data: boleto } = await supabase
      .from("boletos")
      .select("*, eventos(precio, anfitrion_id), profiles(stripe_account_id)")
      .eq("id", boleto_id)
      .single()

    if (!boleto) {
      return new Response(JSON.stringify({ error: "Boleto no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    if (accion === "aprobar") {
      // Transferir fondos al anfitrión
      const { data: anfitrion } = await supabase
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", boleto.eventos.anfitrion_id)
        .single()

      if (boleto.stripe_payment_intent_id && anfitrion?.stripe_account_id) {
        const precio = boleto.eventos.precio
        const monto_anfitrion = Math.round(precio * 0.90 * 100)

        await fetch("https://api.stripe.com/v1/transfers", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "amount": String(monto_anfitrion),
            "currency": "mxn",
            "destination": anfitrion.stripe_account_id,
            "source_transaction": boleto.stripe_payment_intent_id,
          }).toString()
        })
      }

      await supabase.from("boletos").update({ estado: "activo" }).eq("id", boleto_id)

    } else if (accion === "rechazar") {
      // Reembolsar al usuario
      if (boleto.stripe_payment_intent_id) {
        await fetch("https://api.stripe.com/v1/refunds", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "payment_intent": boleto.stripe_payment_intent_id,
          }).toString()
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