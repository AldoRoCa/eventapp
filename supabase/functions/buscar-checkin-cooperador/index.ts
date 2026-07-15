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
    const { cooperador_id, query } = await req.json()

    if (!cooperador_id) {
      return new Response(JSON.stringify({ error: "Faltan datos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // El cooperador no tiene sesión — su único "permiso" es que su
    // cooperador_id exista todavía (el anfitrión pudo haberlo quitado).
    const { data: cooperador } = await supabase
      .from("cooperadores_evento")
      .select("evento_id")
      .eq("id", cooperador_id)
      .single()

    if (!cooperador) {
      return new Response(JSON.stringify({ error: "Ya no tienes acceso al check-in de este evento" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    // Rate limiting básico, identificado por el propio cooperador_id ya
    // que no hay usuario autenticado.
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", cooperador_id)
      .eq("endpoint", "buscar-checkin-cooperador")
      .gte("window_start", windowStart)

    if ((count || 0) >= 300) {
      return new Response(JSON.stringify({ error: "Demasiadas búsquedas. Espera un momento." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: cooperador_id,
      endpoint: "buscar-checkin-cooperador",
      window_start: new Date().toISOString(),
    })

    // Si no viene query, esto es solo un "ping" para confirmar que el
    // cooperador_id sigue siendo válido (usado al abrir la pantalla, para
    // saber si el anfitrión ya lo quitó de la lista) — no busca nada.
    let data: unknown[] = []
    if (typeof query === "string" && query.trim().length > 0) {
      const termino = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      const esCodigo = /^[A-Z2-9]{3,6}$/.test(query.trim().toUpperCase())

      let filtro = supabase
        .from("boletos")
        // Solo los campos que necesita la pantalla del cooperador: id (para
        // el check-in), nombre y código (para identificar), y checkin_en (para
        // mostrar si ya entró). 'estado' ya se filtra abajo y 'created_at' no
        // se usa — minimización de datos expuestos a alguien sin cuenta.
        .select("id, nombre_registro, codigo_grupo, checkin_en")
        .eq("evento_id", cooperador.evento_id)
        .eq("estado", "activo")

      // Lo escrito PODRÍA ser un código de grupo, pero también un nombre corto
      // sin espacios ("ana", "maria") — buscar en ambos campos, no adivinar.
      // Seguro para .or(): esCodigo garantiza que solo hay letras/dígitos.
      filtro = esCodigo
        ? filtro.or(`codigo_grupo.eq.${query.trim().toUpperCase()},nombre_registro_normalizado.ilike.*${termino}*`)
        : filtro.ilike("nombre_registro_normalizado", `%${termino}%`)

      const resultado = await filtro.order("nombre_registro_normalizado")
      data = resultado.data || []
    }

    const grupos: Record<string, { codigo: string | null; nombre: string; boletos: unknown[] }> = {}
    for (const b of data || []) {
      const key = b.codigo_grupo || b.id
      if (!grupos[key]) grupos[key] = { codigo: b.codigo_grupo, nombre: b.nombre_registro, boletos: [] }
      grupos[key].boletos.push(b)
    }

    return new Response(JSON.stringify({ ok: true, resultados: Object.values(grupos) }), {
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
