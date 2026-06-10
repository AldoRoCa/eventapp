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
    const { evento_id, anfitrion_id } = await req.json()
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Verificar que el anfitrión es dueño del evento
    const { data: evento } = await supabase
      .from("eventos")
      .select("id, anfitrion_id")
      .eq("id", evento_id)
      .eq("anfitrion_id", anfitrion_id)
      .single()

    if (!evento) {
      return new Response(JSON.stringify({ error: "Evento no encontrado o sin permiso" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    // Obtener todos los boletos activos y pendientes con payment_id
    const { data: boletos } = await supabase
      .from("boletos")
      .select("id, mp_payment_id, estado")
      .eq("evento_id", evento_id)
      .in("estado", ["activo", "pendiente"])

    // Reembolsar todos los boletos que tienen payment_id
    const reembolsos = (boletos || []).filter(b => b.mp_payment_id)
    for (const boleto of reembolsos) {
      await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}/refunds`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${mpToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({})
      })
    }

    // Eliminar todos los boletos del evento
    await supabase.from("boletos").delete().eq("evento_id", evento_id)

    // Eliminar el evento
    await supabase.from("eventos").delete().eq("id", evento_id)

    return new Response(JSON.stringify({ ok: true, reembolsados: reembolsos.length }), {
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
