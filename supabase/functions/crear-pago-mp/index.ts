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

    // Mercado Pago México rechaza pagos con tarjeta menores a $5 MXN
    // (min_allowed_amount de todos los medios de tarjeta). Un boleto más
    // barato hace que el checkout rechace la tarjeta en tiempo real con
    // "La operación no acepta este medio de pago".
    if (typeof precio !== "number" || !Number.isFinite(precio) || precio < 5) {
      return new Response(JSON.stringify({ error: "El monto mínimo por boleto es $5 MXN (límite de Mercado Pago para pagos con tarjeta)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

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

    const { data: anfitrionCredenciales, error: anfitrionError } = await supabase
      .from("mp_credenciales")
      .select("mp_access_token")
      .eq("id", evento.anfitrion_id)
      .single()

    if (anfitrionError || !anfitrionCredenciales?.mp_access_token) {
      return new Response(JSON.stringify({ error: "El anfitrión no ha conectado su cuenta de Mercado Pago" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const anfitrionMpToken = anfitrionCredenciales.mp_access_token

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

    const siteUrl = Deno.env.get("SITE_URL")!
    // marketplace_fee es un monto absoluto sobre toda la preferencia, así
    // que la comisión se calcula sobre el total (precio × cantidad), no
    // sobre un solo boleto.
    const comision = Math.round(precio * (cantidad || 1) * 0.10)

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
        // Si el pago queda "in_process" (común con débito — el banco pide
        // reintento diferido) y se resuelve minutos/horas después, el
        // comprador ya no está en pago-exitoso para que confirmar-pago-mp
        // lo active. MP llama esta URL cada vez que el pago cambia de
        // estado, y mp-webhook hace la misma verificación/activación.
        notification_url: `${siteUrl}/functions/v1/mp-webhook?evento_id=${evento_id}`,
        metadata: {
          evento_id,
          usuario_id,
        }
      })
    })

    const data = await preference.json()

    if (!data.init_point) {
      // Respuesta cruda de MP para diagnóstico en los logs de la función
      console.log("MP rechazó la preferencia:", JSON.stringify(data))
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