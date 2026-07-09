import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://eventapp-flax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}
 
const MOTIVOS_VALIDOS = ["no_ocurrio", "anfitrion_no_responde", "otro"]

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  try {
    const { boleto_id, motivo, descripcion } = await req.json()
 
    if (!MOTIVOS_VALIDOS.includes(motivo)) {
      return new Response(JSON.stringify({ error: "Motivo de reporte inválido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
 
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )
 
    // Identificar al usuario autenticado a partir de su token.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
 
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }
 
    // Rate limiting básico (reusa la misma tabla rate_limits que el
    // resto de las funciones).
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "reportar-evento")
      .gte("window_start", windowStart)
 
    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }
 
    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "reportar-evento",
      window_start: new Date().toISOString(),
    })
 
    // Verificar que el boleto existe, le pertenece al usuario autenticado
    // (NUNCA confiar en un usuario_id mandado por el cliente), está
    // activo, y traer los datos del evento/anfitrión para el snapshot.
    const { data: boleto, error: boletoError } = await supabase
      .from("boletos")
      .select("id, usuario_id, estado, evento_id, eventos(id, titulo, fecha, anfitrion_id, duracion_horas, profiles(nombre))")
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
      return new Response(JSON.stringify({ error: "Solo se pueden reportar boletos activos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
 
    const evento = boleto.eventos as unknown as {
      id: string; titulo: string; fecha: string; anfitrion_id: string; duracion_horas: number | null
      profiles: { nombre: string } | null
    } | null

    if (!evento) {
      return new Response(JSON.stringify({ error: "El evento ya no existe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    // Prevenir reportes prematuros: el evento debe haber finalizado (misma
    // regla que usa el resto de la app: fecha + duración configurable).
    const fechaLimite = new Date(evento.fecha).getTime() + (evento.duracion_horas ?? 5) * 60 * 60 * 1000
    if (Date.now() < fechaLimite) {
      return new Response(JSON.stringify({ error: "Este evento todavía no puede reportarse — espera a que haya pasado su fecha y hora." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
 
    // Insertar el reporte con snapshot. El constraint unique(boleto_id)
    // en la tabla evita que el mismo boleto se reporte dos veces — si ya
    // existe, esto fallará con un error de Postgres que capturamos abajo.
    const { error: insertError } = await supabase.from("reportes_eventos").insert({
      evento_id: evento.id,
      boleto_id: boleto.id,
      usuario_id: user.id,
      evento_titulo_snapshot: evento.titulo,
      anfitrion_id_snapshot: evento.anfitrion_id,
      anfitrion_nombre_snapshot: evento.profiles?.nombre ?? null,
      motivo,
      descripcion: descripcion || null,
    })
 
    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(JSON.stringify({ error: "Ya reportaste este boleto anteriormente" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        })
      }
      throw insertError
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