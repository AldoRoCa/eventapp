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
    const { reporte_id, accion } = await req.json() // accion: "aprobar" | "rechazar"
 
    if (accion !== "aprobar" && accion !== "rechazar") {
      return new Response(JSON.stringify({ error: "Acción inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
 
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )
 
    // Identificar al usuario autenticado y verificar que sea admin.
    // NUNCA confiar en un flag "soy admin" mandado por el cliente.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
 
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }
 
    const { data: perfil } = await supabase
      .from("profiles")
      .select("es_admin")
      .eq("id", user.id)
      .single()
 
    if (!perfil?.es_admin) {
      return new Response(JSON.stringify({ error: "Solo un administrador puede resolver reportes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "resolver-reporte")
      .gte("window_start", windowStart)

    if ((count || 0) >= 50) {
      return new Response(JSON.stringify({ error: "Demasiados intentos. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "resolver-reporte",
      window_start: new Date().toISOString(),
    })

    const { data: reporte, error: reporteError } = await supabase
      .from("reportes_eventos")
      .select("*")
      .eq("id", reporte_id)
      .single()
 
    if (reporteError || !reporte) {
      return new Response(JSON.stringify({ error: "Reporte no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }
 
    if (reporte.estado !== "pendiente") {
      return new Response(JSON.stringify({ error: "Este reporte ya fue resuelto" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
 
    let reembolsados = 0

    if (accion === "aprobar" && reporte.evento_id) {
      // Reembolsar y borrar el evento completo — misma lógica que
      // cancelar-evento, ya que "aprobar un reporte" significa que el
      // evento se considera fraudulento/abandonado en su totalidad.
      const { data: boletos } = await supabase
        .from("boletos")
        .select("id, mp_payment_id, estado")
        .eq("evento_id", reporte.evento_id)
        .in("estado", ["activo", "pendiente"])

      // Un solo pago puede cubrir varios boletos comprados juntos, así
      // que se reembolsa por pago, no por boleto.
      const paymentIds = [...new Set(
        (boletos || []).filter(b => b.mp_payment_id).map(b => String(b.mp_payment_id))
      )]

      if (paymentIds.length > 0) {
        // Los pagos los cobró la cuenta de Mercado Pago del ANFITRIÓN del
        // evento reportado (no la del admin que resuelve), así que el
        // reembolso se hace con su token OAuth — el token de la plataforma
        // recibe 404 de MP en /refunds.
        const { data: eventoReportado } = await supabase
          .from("eventos")
          .select("anfitrion_id")
          .eq("id", reporte.evento_id)
          .single()

        const { data: cred } = await supabase
          .from("mp_credenciales")
          .select("mp_access_token")
          .eq("id", eventoReportado?.anfitrion_id)
          .single()

        if (!cred?.mp_access_token) {
          return new Response(JSON.stringify({ error: "El anfitrión del evento no tiene cuenta de Mercado Pago conectada; no se pueden reembolsar los boletos pagados. El reporte queda pendiente." }), {
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
          // No borrar nada ni resolver el reporte: los boletos y sus
          // mp_payment_id se conservan para reintentar (los pagos ya
          // reembolsados se detectan y no se cobran doble).
          console.error("[ALERTA-REEMBOLSO] Reembolsos fallidos en resolver-reporte:", JSON.stringify({ reporte_id, evento_id: reporte.evento_id, fallidos }))
          // Persistir el fallo para el panel de admin (best-effort).
          await supabase.from("fallos_reembolso").insert({
            contexto: "resolver-reporte",
            usuario_id: user.id,
            evento_id: reporte.evento_id,
            payment_ids: fallidos,
            detalle: `No se pudieron reembolsar ${fallidos.length} de ${paymentIds.length} pagos al aprobar un reporte (¿saldo insuficiente en la cuenta de Mercado Pago del anfitrión del evento?).`,
          })
          return new Response(JSON.stringify({ error: `No se pudieron reembolsar ${fallidos.length} de ${paymentIds.length} pagos (¿saldo insuficiente en la cuenta del anfitrión?). El reporte queda pendiente; intenta de nuevo más tarde.` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 502,
          })
        }
      }

      reembolsados = paymentIds.length

      await supabase.from("boletos").delete().eq("evento_id", reporte.evento_id)
      await supabase.from("eventos").delete().eq("id", reporte.evento_id)
    }
    // Si accion === "rechazar", o el evento ya no existe (evento_id es
    // null porque alguien más ya lo borró antes), no se toca dinero —
    // solo se actualiza el estado del reporte abajo.
 
    await supabase
      .from("reportes_eventos")
      .update({ estado: accion === "aprobar" ? "aprobado" : "rechazado", resuelto_at: new Date().toISOString() })
      .eq("id", reporte_id)
 
    return new Response(JSON.stringify({ ok: true, reembolsados }), {
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
      console.error(`[ALERTA-REEMBOLSO] Reembolso rechazado por MP para pago ${paymentId}:`, res.status, JSON.stringify(detalle))
    }
    return res.ok
  } catch (e) {
    console.error(`[ALERTA-REEMBOLSO] Error de red reembolsando pago ${paymentId}:`, e.message)
    return false
  }
}