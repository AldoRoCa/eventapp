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
    const body = await req.json()
    
    if (body.type !== "payment") {
      return new Response("ok", { status: 200 })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      return new Response("ok", { status: 200 })
    }

    // Obtener detalles del pago desde MP
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
      },
    })
    const payment = await mpResponse.json()

    if (payment.status !== "approved") {
      return new Response("ok", { status: 200 })
    }

    // Activar boleto en Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    const eventoId = payment.items?.[0]?.id
    if (!eventoId) {
      return new Response("ok", { status: 200 })
    }

    await supabase
      .from("boletos")
      .update({ estado: "activo" })
      .eq("evento_id", eventoId)
      .eq("estado", "pendiente_pago")

    return new Response("ok", { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})