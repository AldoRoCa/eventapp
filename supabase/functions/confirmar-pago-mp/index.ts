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
    const { evento_id, payment_id } = await req.json()

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Identificar al usuario autenticado a partir de su token — nunca
    // confiar en un usuario_id que venga del body o de la URL.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    if (!evento_id || !payment_id) {
      return new Response(JSON.stringify({ error: "Faltan datos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "confirmar-pago-mp")
      .gte("window_start", windowStart)

    if ((count || 0) >= 30) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "confirmar-pago-mp",
      window_start: new Date().toISOString(),
    })

    // Boletos pendientes de pago de este usuario para este evento
    const { data: boletosPendientes } = await supabase
      .from("boletos")
      .select("id, evento_id, usuario_id")
      .eq("usuario_id", user.id)
      .eq("evento_id", evento_id)
      .eq("estado", "pendiente_pago")

    if (!boletosPendientes || boletosPendientes.length === 0) {
      return new Response(JSON.stringify({ error: "No hay boletos pendientes de pago para este evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Token de Mercado Pago del anfitrión, para consultar el pago con su cuenta
    const { data: evento } = await supabase
      .from("eventos")
      .select("anfitrion_id")
      .eq("id", evento_id)
      .single()

    if (!evento) {
      return new Response(JSON.stringify({ error: "El evento ya no existe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    const { data: anfitrionCredenciales } = await supabase
      .from("mp_credenciales")
      .select("mp_access_token")
      .eq("id", evento?.anfitrion_id)
      .single()

    if (!anfitrionCredenciales?.mp_access_token) {
      return new Response(JSON.stringify({ error: "No se pudo verificar el pago" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // Verificar el pago directo con Mercado Pago — nunca confiar en el
    // estado que llega por la URL de retorno.
    const pagoRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { "Authorization": `Bearer ${anfitrionCredenciales.mp_access_token}` }
    })
    const pago = await pagoRes.json()

    if (!pagoRes.ok || pago.status !== "approved") {
      return new Response(JSON.stringify({ error: "El pago no está aprobado", estado_pago: pago.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (String(pago.metadata?.usuario_id) !== user.id || String(pago.metadata?.evento_id) !== String(evento_id)) {
      return new Response(JSON.stringify({ error: "El pago no corresponde a este boleto" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const { data: codigo } = await supabase.rpc("generar_codigo_checkin")

    const { error: updateError } = await supabase
      .from("boletos")
      .update({ estado: "activo", mp_payment_id: String(payment_id), codigo_grupo: codigo })
      .eq("usuario_id", user.id)
      .eq("evento_id", evento_id)
      .eq("estado", "pendiente_pago")

    if (updateError) {
      return new Response(JSON.stringify({ error: "No se pudieron activar los boletos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
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
