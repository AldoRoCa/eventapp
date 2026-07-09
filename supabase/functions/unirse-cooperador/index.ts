import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://eventapp-flax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const LIMITE_COOPERADORES = 20

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  try {
    const { codigo, nombre } = await req.json()

    if (!codigo || typeof codigo !== "string") {
      return new Response(JSON.stringify({ error: "Link de invitación inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
    const nombreLimpio = typeof nombre === "string" ? nombre.trim().slice(0, 100) : ""
    if (!nombreLimpio) {
      return new Response(JSON.stringify({ error: "Escribe tu nombre para continuar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // No hay sesión de usuario (los cooperadores no necesitan cuenta), así
    // que el rate limit se identifica por el propio código del link.
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", codigo)
      .eq("endpoint", "unirse-cooperador")
      .gte("window_start", windowStart)

    if ((count || 0) >= 30) {
      return new Response(JSON.stringify({ error: "Demasiados intentos. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: codigo,
      endpoint: "unirse-cooperador",
      window_start: new Date().toISOString(),
    })

    const { data: invitacion } = await supabase
      .from("invitaciones_cooperador")
      .select("id, evento_id, activa, eventos(titulo)")
      .eq("codigo", codigo)
      .single()

    if (!invitacion || !invitacion.activa) {
      return new Response(JSON.stringify({ error: "Este link de invitación ya no es válido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    const { count: totalCooperadores } = await supabase
      .from("cooperadores_evento")
      .select("*", { count: "exact", head: true })
      .eq("evento_id", invitacion.evento_id)

    if ((totalCooperadores || 0) >= LIMITE_COOPERADORES) {
      return new Response(JSON.stringify({ error: "Este evento ya alcanzó el límite de cooperadores" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const { data: cooperador, error: insertError } = await supabase
      .from("cooperadores_evento")
      .insert({ evento_id: invitacion.evento_id, nombre: nombreLimpio, invitacion_id: invitacion.id })
      .select("id")
      .single()

    if (insertError || !cooperador) {
      return new Response(JSON.stringify({ error: "No se pudo completar el registro" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    const eventoTitulo = (invitacion.eventos as unknown as { titulo: string } | null)?.titulo ?? ""

    return new Response(JSON.stringify({
      ok: true,
      cooperador_id: cooperador.id,
      evento_id: invitacion.evento_id,
      evento_titulo: eventoTitulo,
    }), {
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
