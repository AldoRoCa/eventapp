import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsFor } from "../_shared/cors.ts"
import { detectarLiberacion } from "../_shared/liberacion.ts"

serve(async (req) => {
  const corsHeaders = corsFor(req)
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
      // mp-webhook llega server-a-server y suele ganarle al navegador del
      // comprador: si ya procesó este mismo pago, aquí no queda ningún
      // "pendiente_pago" — pero eso no es un error. Reportar el estado real
      // de los boletos de ESTE pago para que PagoExitoso diga la verdad.
      const { data: yaProcesados } = await supabase
        .from("boletos")
        .select("estado")
        .eq("usuario_id", user.id)
        .eq("evento_id", evento_id)
        .eq("mp_payment_id", String(payment_id))
      if (yaProcesados && yaProcesados.length > 0) {
        const estado = yaProcesados.some((b) => b.estado === "activo") ? "activo"
          : yaProcesados.some((b) => b.estado === "pendiente") ? "pendiente"
          : yaProcesados.every((b) => b.estado === "rechazado") ? "reembolsado"
          : yaProcesados[0].estado
        return new Response(JSON.stringify({ ok: true, estado, ya_procesado: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }
      return new Response(JSON.stringify({ error: "No hay boletos pendientes de pago para este evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Token de Mercado Pago del anfitrión, para consultar el pago con su cuenta
    const { data: evento } = await supabase
      .from("eventos")
      .select("anfitrion_id, tipo_boleto")
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

    // En eventos de solicitud, pagar no activa el boleto: queda pendiente
    // de que el anfitrión lo apruebe (gestionar-solicitud). Si lo rechaza,
    // el pago se reembolsa automáticamente.
    const nuevoEstado = evento.tipo_boleto === "solicitud" ? "pendiente" : "activo"

    // Cuánto se pagó por CADA boleto: el monto real que cobró Mercado Pago
    // repartido entre los boletos que cubre ese pago (una compra de N boletos
    // es un solo pago). Se guarda porque es lo que hay que devolver si el
    // anfitrión rechaza uno — y con comisión escalonada y descuentos por
    // paquete ya no se puede reconstruir con una fórmula desde el precio.
    const totalPagado = Number(pago.transaction_amount) || 0
    const montoPorBoleto = Math.round((totalPagado / boletosPendientes.length) * 100) / 100

    // El `in(id)` fija exactamente el lote que se acaba de contar, y el filtro
    // por estado se conserva para que siga siendo idempotente: si mp-webhook
    // ya activó estos boletos, aquí no coincide ninguna fila y no se les
    // regenera el código de check-in.
    const { error: updateError } = await supabase
      .from("boletos")
      .update({ estado: nuevoEstado, mp_payment_id: String(payment_id), codigo_grupo: codigo, monto_pagado: montoPorBoleto })
      .in("id", boletosPendientes.map((b) => b.id))
      .eq("usuario_id", user.id)
      .eq("evento_id", evento_id)
      .eq("estado", "pendiente_pago")

    if (updateError) {
      return new Response(JSON.stringify({ error: "No se pudieron activar los boletos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    // Detección de liberación inmediata (Fase C): corre DESPUÉS de activar
    // los boletos y jamás rompe la confirmación. Si la cuenta de MP del
    // anfitrión libera el dinero al instante, el detector pausa sus ventas
    // y reembolsa ESTE pago (recién aprobado: el dinero sigue ahí) — en ese
    // caso se le dice la verdad al comprador con estado "reembolsado".
    const resultadoDeteccion = await detectarLiberacion(supabase, pago, String(evento_id), evento.anfitrion_id, anfitrionCredenciales.mp_access_token, "confirmar-pago-mp")

    return new Response(JSON.stringify({ ok: true, estado: resultadoDeteccion === "reembolsado" ? "reembolsado" : nuevoEstado }), {
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
