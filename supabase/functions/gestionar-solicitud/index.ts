import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://eventapp-flax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  try {
    const { boleto_id, accion } = await req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Identificar al usuario autenticado a partir de su token
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
      .eq("endpoint", "gestionar-solicitud")
      .gte("window_start", windowStart)

    if ((count || 0) >= 30) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "gestionar-solicitud",
      window_start: new Date().toISOString(),
    })

    const { data: boleto } = await supabase
      .from("boletos")
      .select("*, eventos(precio, anfitrion_id)")
      .eq("id", boleto_id)
      .single()

    if (!boleto) {
      return new Response(JSON.stringify({ error: "Boleto no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Verificar que el usuario autenticado es el anfitrión del evento
    if (boleto.eventos?.anfitrion_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sin permiso para gestionar esta solicitud" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    if (accion === "aprobar") {
      await supabase.from("boletos").update({ estado: "activo" }).eq("id", boleto_id)

    } else if (accion === "rechazar") {
      if (boleto.mp_payment_id) {
        // El pago lo cobró la cuenta de Mercado Pago del anfitrión, así
        // que el reembolso debe hacerse con su token OAuth — el token de
        // la plataforma recibe 404 de MP en /refunds.
        const { data: cred } = await supabase
          .from("mp_credenciales")
          .select("mp_access_token")
          .eq("id", user.id)
          .single()

        if (!cred?.mp_access_token) {
          return new Response(JSON.stringify({ error: "No se encontró tu cuenta de Mercado Pago conectada. No se puede rechazar sin reembolsar el boleto pagado." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          })
        }

        const ok = await reembolsarBoleto(supabase, boleto, cred.mp_access_token)
        if (!ok) {
          return new Response(JSON.stringify({ error: "Mercado Pago no pudo procesar el reembolso (¿saldo insuficiente en tu cuenta?). El boleto NO fue rechazado; intenta de nuevo." }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 502,
          })
        }
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

// Reembolsa la parte de un boleto rechazado. Un solo pago de MP puede
// cubrir varios boletos comprados juntos; si quedan otros boletos vivos
// en el mismo pago, se reembolsa solo el monto de este boleto (precio
// unitario que pagó el comprador, con el 10% incluido). Si es el último,
// se reembolsa lo que quede del pago completo.
// deno-lint-ignore no-explicit-any
async function reembolsarBoleto(supabase: any, boleto: any, token: string): Promise<boolean> {
  try {
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const pago = await consulta.json()
    if (consulta.ok && pago.status === "refunded") return true

    const { count } = await supabase
      .from("boletos")
      .select("*", { count: "exact", head: true })
      .eq("mp_payment_id", boleto.mp_payment_id)
      .neq("estado", "rechazado")

    const montoUnitario = Math.round((boleto.eventos?.precio || 0) * 1.10)
    const body = (count || 1) > 1 && montoUnitario > 0 ? { amount: montoUnitario } : {}

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}))
      console.log(`Reembolso rechazado por MP para pago ${boleto.mp_payment_id}:`, res.status, JSON.stringify(detalle))
    }
    return res.ok
  } catch (e) {
    console.log(`Error de red reembolsando pago ${boleto.mp_payment_id}:`, e.message)
    return false
  }
}