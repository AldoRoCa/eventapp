import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Mercado Pago llama esta URL server-a-server cada vez que un pago cambia
// de estado (la configuramos como notification_url al crear la preferencia
// en crear-pago-mp). Cubre el caso en que un pago queda "in_process" (p.ej.
// "deferred_retry" en débito — el banco pide reintentar) y se resuelve
// minutos/horas después, cuando el comprador ya no está en pago-exitoso
// para que confirmar-pago-mp lo active.
//
// Nunca se confía en el payload de la notificación por sí solo: solo dice
// "hay un cambio en el pago X", así que siempre se vuelve a consultar el
// pago real contra la API de MP (con el token del anfitrión del evento,
// el único con autoridad sobre ese pago) antes de activar nada — mismo
// principio que confirmar-pago-mp. La firma HMAC (abajo) es una capa
// adicional para rechazar notificaciones falsas antes de gastar esa
// llamada a la API; si MP_WEBHOOK_SECRET no está configurado, se omite
// sin bloquear nada (compatibilidad hacia atrás mientras se configura).
async function firmaValida(req: Request, dataId: string | null): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET")
  if (!secret) return true

  const xSignature = req.headers.get("x-signature")
  const xRequestId = req.headers.get("x-request-id")
  if (!xSignature || !xRequestId || !dataId) return false

  const partes: Record<string, string> = {}
  for (const parte of xSignature.split(",")) {
    const [clave, valor] = parte.split("=")
    if (clave && valor) partes[clave.trim()] = valor.trim()
  }
  const ts = partes["ts"]
  const v1 = partes["v1"]
  if (!ts || !v1) return false

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const firmaBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest))
  const calculada = Array.from(new Uint8Array(firmaBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return calculada === v1
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const evento_id = url.searchParams.get("evento_id")

    // El id del pago puede venir en el body (webhooks v2: POST JSON) o en
    // query params (IPN clásico: topic=payment&id=... / data.id=...). La
    // firma solo se valida contra el id de la query (así lo especifica MP),
    // no contra el del body.
    const dataIdQuery = url.searchParams.get("data.id") || url.searchParams.get("id")

    if (!(await firmaValida(req, dataIdQuery))) {
      return new Response(JSON.stringify({ error: "Firma inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    let paymentId = dataIdQuery
    let tipo = url.searchParams.get("type") || url.searchParams.get("topic")
    if (!paymentId && req.method === "POST") {
      const body = await req.json().catch(() => null)
      paymentId = body?.data?.id ? String(body.data.id) : null
      tipo = body?.type || tipo
    }

    // Solo nos interesan notificaciones de pagos; otros topics (p.ej.
    // "merchant_order") se reconocen y se ignoran sin error.
    if (tipo && tipo !== "payment") {
      return new Response(JSON.stringify({ ok: true, ignorado: tipo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    if (!evento_id || !paymentId) {
      return new Response(JSON.stringify({ error: "Faltan datos en la notificación" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // 200 para que MP no reintente algo que nunca va a tener datos
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Rate limiting por evento (no hay usuario autenticado: la llamada
    // viene de los servidores de MP, no de un navegador).
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", evento_id)
      .eq("endpoint", "mp-webhook")
      .gte("window_start", windowStart)

    if ((count || 0) >= 60) {
      return new Response(JSON.stringify({ error: "Demasiadas notificaciones para este evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: evento_id,
      endpoint: "mp-webhook",
      window_start: new Date().toISOString(),
    })

    const { data: evento } = await supabase
      .from("eventos")
      .select("anfitrion_id, tipo_boleto")
      .eq("id", evento_id)
      .single()

    if (!evento) {
      // El evento ya no existe (se canceló, etc.) — nada que activar.
      return new Response(JSON.stringify({ ok: true, evento_inexistente: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const { data: cred } = await supabase
      .from("mp_credenciales")
      .select("mp_access_token")
      .eq("id", evento.anfitrion_id)
      .single()

    if (!cred?.mp_access_token) {
      return new Response(JSON.stringify({ ok: true, sin_credenciales: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // Verificar el pago real con Mercado Pago — la notificación en sí no
    // es prueba de nada, solo un aviso de "revisa este pago".
    const pagoRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${cred.mp_access_token}` },
    })
    const pago = await pagoRes.json()

    if (!pagoRes.ok) {
      // Pago no encontrado con este token — no corresponde a este evento,
      // o la notificación llegó fuera de orden. No es un error nuestro.
      return new Response(JSON.stringify({ ok: true, pago_no_encontrado: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // El evento_id del pago real (metadata que puso crear-pago-mp) debe
    // coincidir con el de la URL — evita activar boletos de otro evento
    // si alguien llama esta URL a mano con un evento_id/payment_id que no
    // corresponden entre sí.
    if (String(pago.metadata?.evento_id) !== String(evento_id)) {
      return new Response(JSON.stringify({ error: "El pago no corresponde a este evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    if (pago.status !== "approved") {
      // Sigue in_process, o quedó rejected/cancelled — nada que activar
      // todavía. MP volverá a notificar si el estado cambia de nuevo.
      return new Response(JSON.stringify({ ok: true, estado_pago: pago.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const usuario_id = pago.metadata?.usuario_id
    if (!usuario_id) {
      return new Response(JSON.stringify({ error: "El pago no tiene usuario_id en su metadata" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    const { data: codigo } = await supabase.rpc("generar_codigo_checkin")

    // Mismo criterio que confirmar-pago-mp: en eventos de solicitud, pagar
    // no activa el boleto directo, queda pendiente de aprobación.
    const nuevoEstado = evento.tipo_boleto === "solicitud" ? "pendiente" : "activo"

    // Update idempotente: si el comprador ya alcanzó a confirmar el pago
    // por su cuenta (PagoExitoso -> confirmar-pago-mp), los boletos ya no
    // están en "pendiente_pago" y esta notificación no afecta ninguna fila.
    const { error: updateError } = await supabase
      .from("boletos")
      .update({ estado: nuevoEstado, mp_payment_id: String(paymentId), codigo_grupo: codigo })
      .eq("usuario_id", usuario_id)
      .eq("evento_id", evento_id)
      .eq("estado", "pendiente_pago")

    if (updateError) {
      // Error real de nuestro lado (no del pago) — devolver 500 para que
      // MP reintente la notificación más tarde.
      return new Response(JSON.stringify({ error: "No se pudieron activar los boletos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ ok: true, estado: nuevoEstado }), {
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
