import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsFor } from "../_shared/cors.ts"
import { modoLiberacion } from "../_shared/liberacion.ts"
import { desglosePrecio } from "../_shared/comision.ts"

const RATE_LIMIT = 10 // máximo 10 pagos por hora por usuario

serve(async (req) => {
  const corsHeaders = corsFor(req)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Del navegador solo se acepta QUÉ evento se quiere comprar. Todo lo que
    // determina cuánto se cobra —precio, descuento por paquete, cantidad de
    // boletos y quién compra— se lee o se cuenta aquí, del lado del servidor.
    //
    // Antes esta función se creía el `precio` y la `cantidad` que le mandaba
    // el navegador. Eso permitía pagar $5 por un boleto de $500 desde la
    // consola: confirmar-pago-mp verifica que el pago esté aprobado y sea de
    // ese usuario y evento, pero nunca verificó el MONTO. Con descuentos por
    // paquete el agujero habría sido peor (bastaba mentir en la cantidad para
    // disparar el precio de paquete llevando un solo boleto).
    const { evento_id } = await req.json()

    if (!evento_id) {
      return new Response(JSON.stringify({ error: "Falta el evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Identificar al comprador por su token — nunca por un usuario_id que
    // venga del body (mismo criterio que confirmar-pago-mp).
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    // Datos del evento, incluido su descuento por paquete. Esto se hace aquí,
    // con service_role, para que el token de MP del anfitrión NUNCA viaje al
    // navegador del comprador.
    const { data: evento, error: eventoError } = await supabase
      .from("eventos")
      .select("titulo, precio, anfitrion_id, ventas_pausadas, tipo_boleto, descuento_porcentaje, descuento_min_boletos")
      .eq("id", evento_id)
      .single()

    if (eventoError || !evento) {
      return new Response(JSON.stringify({ error: "Evento no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    if (!(Number(evento.precio) > 0)) {
      return new Response(JSON.stringify({ error: "Este evento es gratis y no requiere pago" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const { data: anfitrionCredenciales, error: anfitrionError } = await supabase
      .from("mp_credenciales")
      .select("mp_access_token, liberacion_inmediata")
      .eq("id", evento.anfitrion_id)
      .single()

    if (anfitrionError || !anfitrionCredenciales?.mp_access_token) {
      return new Response(JSON.stringify({ error: "El anfitrión no ha conectado su cuenta de Mercado Pago" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // `ventas_pausadas` se respeta SIEMPRE, en cualquier modo: es un estado
    // explícito y visible que el admin puede quitar con "Desbloquear
    // anfitrión". Cambiar de modo no despausa a nadie por su cuenta.
    if (evento.ventas_pausadas === true) {
      return new Response(JSON.stringify({ error: "Las ventas de este organizador están pausadas temporalmente mientras corrige la configuración de cobro de su cuenta de Mercado Pago. Intenta de nuevo más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    // Los otros dos candados del sistema de liberación solo aplican en modo
    // "estricto" (ver ajustes_plataforma.modo_liberacion): la marca de cuenta
    // con liberación inmediata y el paso 2 de la conexión con MP. En "avisar"
    // y "apagado" el anfitrión vende sin fricción y el sistema solo observa.
    const modo = await modoLiberacion(supabase)

    if (modo === "estricto") {
      // Si la cuenta de MP del anfitrión libera el dinero al instante
      // (detectado en una venta anterior), un reembolso futuro podría fallar
      // por falta de saldo. La fuente de verdad es mp_credenciales, que no
      // tiene acceso de cliente.
      if (anfitrionCredenciales.liberacion_inmediata === true) {
        return new Response(JSON.stringify({ error: "Las ventas de este organizador están pausadas temporalmente mientras corrige la configuración de cobro de su cuenta de Mercado Pago. Intenta de nuevo más tarde." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        })
      }

      // Segundo paso de la conexión con MP (declarar que configuró sus
      // plazos, ver /conectar-mercadopago). La interfaz ya no deja poner
      // precio sin esto, pero el candado real vive aquí: si solo se validara
      // en el navegador, bastaría crear el evento desde la consola.
      const { data: perfilAnfitrion } = await supabase
        .from("profiles")
        .select("mp_config_confirmada_en")
        .eq("id", evento.anfitrion_id)
        .single()

      if (!perfilAnfitrion?.mp_config_confirmada_en) {
        return new Response(JSON.stringify({ error: "Este organizador todavía no ha terminado de configurar sus cobros. Intenta de nuevo más tarde." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        })
      }
    }

    const anfitrionMpToken = anfitrionCredenciales.mp_access_token

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "crear-pago")
      .gte("window_start", windowStart)

    if ((count || 0) >= RATE_LIMIT) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "crear-pago",
      window_start: new Date().toISOString(),
    })

    // CUÁNTOS boletos se están comprando: se cuentan las reservas que el
    // comprador acaba de crear (estado "pendiente_pago"), no se le pregunta al
    // navegador. Es la misma lista que después activará confirmar-pago-mp, y
    // ya viene limitada por el aforo y el máximo por persona (trigger
    // verificar_aforo_boleto), así que nadie puede inflarla para alcanzar el
    // umbral de un descuento por paquete.
    const { data: boletosPendientes } = await supabase
      .from("boletos")
      .select("id")
      .eq("usuario_id", user.id)
      .eq("evento_id", evento_id)
      .eq("estado", "pendiente_pago")

    const cantidad = boletosPendientes?.length || 0
    if (cantidad === 0) {
      return new Response(JSON.stringify({ error: "No hay boletos por pagar. Vuelve a intentar la compra." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // Aquí se decide TODO el dinero de esta compra: descuento por paquete (si
    // la cantidad alcanza el umbral que puso el anfitrión) y comisión de VELA
    // según el escalón del precio ya con descuento. Misma matemática que ve el
    // comprador en la página, porque las dos copias están sincronizadas
    // (ver _shared/comision.ts).
    const desglose = desglosePrecio(evento, cantidad)

    // Mercado Pago México rechaza pagos con tarjeta menores a $5 MXN
    // (min_allowed_amount de todos los medios de tarjeta). Un boleto más
    // barato hace que el checkout rechace la tarjeta en tiempo real con
    // "La operación no acepta este medio de pago". El mínimo aplica sobre lo
    // que realmente se le cobra a la tarjeta: el precio ya con descuento y con
    // comisión. Un boleto de $0 sí es válido — se entrega gratis, más abajo.
    if (!desglose.cobrable) {
      return new Response(JSON.stringify({ error: `Con este descuento el boleto queda en $${desglose.unitario} MXN, y Mercado Pago no acepta cobros menores a $5. Avísale al organizador.` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // Boletos gratis por un descuento del 100%: no hay nada que cobrar, así
    // que no se crea preferencia (Mercado Pago no acepta un pago de $0). Se
    // activan aquí mismo, con service_role, igual que hace confirmar-pago-mp.
    // Se quedan SIN mp_payment_id, que es justo lo que hace que las funciones
    // de reembolso los salten (todas filtran por ese campo antes de devolver).
    if (desglose.gratis) {
      const { data: codigo } = await supabase.rpc("generar_codigo_checkin")
      const nuevoEstado = evento.tipo_boleto === "solicitud" ? "pendiente" : "activo"

      const { error: activarError } = await supabase
        .from("boletos")
        .update({ estado: nuevoEstado, codigo_grupo: codigo, monto_pagado: 0 })
        .in("id", boletosPendientes!.map((b: { id: string }) => b.id))
        .eq("usuario_id", user.id)
        .eq("evento_id", evento_id)
        .eq("estado", "pendiente_pago")

      if (activarError) {
        return new Response(JSON.stringify({ error: "No se pudieron entregar los boletos. Intenta de nuevo." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        })
      }

      return new Response(JSON.stringify({ gratis: true, estado: nuevoEstado, cantidad }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const siteUrl = Deno.env.get("SITE_URL")!
    // OJO: SITE_URL es el sitio web (donde vuelve el COMPRADOR tras pagar).
    // El webhook NO vive ahí, vive en Supabase. Se armaba con siteUrl y por
    // eso la notification_url apuntaba al frontend: Vercel reescribe
    // cualquier ruta a index.html y respondía 200 con HTML, así que Mercado
    // Pago daba la notificación por entregada y ni siquiera reintentaba —
    // mp-webhook nunca llegaba a ejecutarse.
    const funcionesUrl = Deno.env.get("SUPABASE_URL")!

    // marketplace_fee es un monto absoluto sobre toda la preferencia: el extra
    // exacto que el comprador paga por encima del precio del anfitrión, por
    // cantidad de boletos. Así el anfitrión recibe su precio completo (menos
    // el cargo propio, inevitable, de Mercado Pago) y la plataforma se queda
    // con su comisión real, no con un porcentaje calculado sobre un precio que
    // ya traía comisión encima.
    //
    // En el escalón de $5 a $49 la comisión es 0% y el campo se OMITE en vez
    // de mandarse en cero: es lo mismo semánticamente y no depende de cómo
    // trate MP un fee de $0.
    const comision = Math.round((desglose.unitario - desglose.precioAnfitrion) * cantidad)

    const preferencia: Record<string, unknown> = {
      items: [{
        title: evento.titulo,
        quantity: cantidad,
        unit_price: desglose.unitario,
        currency_id: "MXN",
      }],
      marketplace: Deno.env.get("MP_CLIENT_ID")!,
      back_urls: {
        success: `${siteUrl}/pago-exitoso?evento_id=${evento_id}&usuario_id=${user.id}&collection_status=approved`,
        failure: `${siteUrl}/pago-fallido?evento_id=${evento_id}&usuario_id=${user.id}`,
        pending: `${siteUrl}/pago-exitoso?evento_id=${evento_id}&usuario_id=${user.id}&collection_status=pending`,
      },
      auto_return: "approved",
      // Si el pago queda "in_process" (común con débito — el banco pide
      // reintento diferido) y se resuelve minutos/horas después, el
      // comprador ya no está en pago-exitoso para que confirmar-pago-mp
      // lo active. MP llama esta URL cada vez que el pago cambia de
      // estado, y mp-webhook hace la misma verificación/activación.
      notification_url: `${funcionesUrl}/functions/v1/mp-webhook?evento_id=${evento_id}`,
      metadata: {
        evento_id,
        usuario_id: user.id,
      },
    }
    if (comision > 0) preferencia.marketplace_fee = comision

    const preference = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anfitrionMpToken}`,
        "X-Integrator-Id": Deno.env.get("MP_CLIENT_ID")!,
      },
      body: JSON.stringify(preferencia),
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
