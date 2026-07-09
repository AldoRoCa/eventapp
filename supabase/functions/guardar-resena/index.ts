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
    const { boleto_id, estrellas_evento, estrellas_anfitrion, comentario } = await req.json()

    if (
      !Number.isInteger(estrellas_evento) || estrellas_evento < 1 || estrellas_evento > 5 ||
      !Number.isInteger(estrellas_anfitrion) || estrellas_anfitrion < 1 || estrellas_anfitrion > 5
    ) {
      return new Response(JSON.stringify({ error: "Las calificaciones deben ser un número entre 1 y 5" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const comentarioLimpio = typeof comentario === "string" ? comentario.trim().slice(0, 1000) : null

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }

    // Rate limiting básico
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "guardar-resena")
      .gte("window_start", windowStart)

    if ((count || 0) >= 20) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "guardar-resena",
      window_start: new Date().toISOString(),
    })

    // Verificar boleto: pertenece al usuario, está activo, y el evento ya
    // pasó su margen de tolerancia.
    const { data: boleto, error: boletoError } = await supabase
      .from("boletos")
      .select("id, usuario_id, estado, evento_id, eventos(id, fecha, anfitrion_id, duracion_horas)")
      .eq("id", boleto_id)
      .single()

    if (boletoError || !boleto) {
      return new Response(JSON.stringify({ error: "Boleto no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    if (boleto.usuario_id !== user.id) {
      return new Response(JSON.stringify({ error: "Este boleto no te pertenece" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    if (boleto.estado !== "activo") {
      return new Response(JSON.stringify({ error: "Solo se pueden reseñar boletos activos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const evento = boleto.eventos as unknown as { id: string; fecha: string; anfitrion_id: string; duracion_horas: number | null } | null

    if (!evento) {
      return new Response(JSON.stringify({ error: "El evento ya no existe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Solo se puede reseñar un evento que ya finalizó (misma regla que
    // usa el resto de la app: fecha + duración configurable del evento).
    const fechaLimite = new Date(evento.fecha).getTime() + (evento.duracion_horas ?? 5) * 60 * 60 * 1000
    if (Date.now() < fechaLimite) {
      return new Response(JSON.stringify({ error: "Solo puedes reseñar un evento después de que haya pasado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // upsert: si ya existe una reseña para este boleto (constraint
    // unique(boleto_id)), la actualiza en vez de fallar — esto cubre
    // tanto "crear" como "editar" con la misma función.
    const { error: upsertError } = await supabase.from("resenas").upsert({
      evento_id: evento.id,
      boleto_id: boleto.id,
      usuario_id: user.id,
      anfitrion_id: evento.anfitrion_id,
      estrellas_evento,
      estrellas_anfitrion,
      comentario: comentarioLimpio || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "boleto_id" })

    if (upsertError) throw upsertError

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