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
    const { evento_id } = await req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Identificar al usuario autenticado a partir de su token — nunca
    // confiar en un anfitrion_id que mande el cliente.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "cancelar-evento")
      .gte("window_start", windowStart)

    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "cancelar-evento",
      window_start: new Date().toISOString(),
    })

    // Verificar que el usuario autenticado es el dueño del evento
    const { data: evento } = await supabase
      .from("eventos")
      .select("id, anfitrion_id")
      .eq("id", evento_id)
      .eq("anfitrion_id", user.id)
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

    // Un solo pago puede cubrir varios boletos comprados juntos (todos
    // comparten el mismo mp_payment_id), así que se reembolsa por pago,
    // no por boleto — reembolsar dos veces el mismo pago falla en MP.
    const paymentIds = [...new Set(
      (boletos || []).filter(b => b.mp_payment_id).map(b => String(b.mp_payment_id))
    )]

    if (paymentIds.length > 0) {
      // Los pagos los cobró la cuenta de Mercado Pago del anfitrión, así
      // que solo su token OAuth puede reembolsarlos — el token de la
      // plataforma recibe 404 de MP en /refunds.
      const { data: cred } = await supabase
        .from("mp_credenciales")
        .select("mp_access_token")
        .eq("id", user.id)
        .single()

      if (!cred?.mp_access_token) {
        return new Response(JSON.stringify({ error: "No se encontró tu cuenta de Mercado Pago conectada. No se puede cancelar sin reembolsar los boletos pagados." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        })
      }

      const fallidos: string[] = []
      for (const paymentId of paymentIds) {
        const ok = await reembolsarPago(paymentId, cred.mp_access_token)
        if (!ok) fallidos.push(paymentId)
      }

      if (fallidos.length > 0) {
        // No borrar nada: los boletos y sus mp_payment_id se conservan
        // para poder reintentar la cancelación (los pagos ya reembolsados
        // se detectan y no se cobran doble).
        console.log("Reembolsos fallidos en cancelar-evento:", JSON.stringify({ evento_id, fallidos }))
        return new Response(JSON.stringify({ error: `No se pudieron reembolsar ${fallidos.length} de ${paymentIds.length} pagos (¿saldo insuficiente en tu cuenta de Mercado Pago?). El evento NO se canceló; intenta de nuevo en unos minutos.` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        })
      }
    }

    // Eliminar todos los boletos del evento
    await supabase.from("boletos").delete().eq("evento_id", evento_id)

    // Eliminar el evento
    await supabase.from("eventos").delete().eq("id", evento_id)

    return new Response(JSON.stringify({ ok: true, reembolsados: paymentIds.length }), {
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

// Reembolsa el total de un pago con el token del anfitrión. Devuelve true
// solo si Mercado Pago confirmó el reembolso (o si el pago ya estaba
// reembolsado de un intento anterior).
async function reembolsarPago(paymentId: string, token: string): Promise<boolean> {
  try {
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const pago = await consulta.json()
    if (consulta.ok && pago.status === "refunded") return true

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}))
      console.log(`Reembolso rechazado por MP para pago ${paymentId}:`, res.status, JSON.stringify(detalle))
    }
    return res.ok
  } catch (e) {
    console.log(`Error de red reembolsando pago ${paymentId}:`, e.message)
    return false
  }
}
