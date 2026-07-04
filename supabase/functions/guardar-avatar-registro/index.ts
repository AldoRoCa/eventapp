import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const EXTENSIONES_VALIDAS = ["jpg", "jpeg", "png", "webp", "gif"]
const MAX_BYTES = 5 * 1024 * 1024

// Sube la foto de perfil elegida durante el registro justo después de crear
// la cuenta — ANTES de que el usuario confirme su correo, así que no hay
// sesión/JWT todavía (por eso esta función no la verifica y sube el archivo
// con service_role). Reemplaza al enfoque anterior de guardarla en
// localStorage del navegador y subirla hasta la primera sesión real: ese
// enfoque solo funcionaba si el usuario volvía a confirmar su correo en el
// MISMO dispositivo/navegador donde se registró — si abría el link de
// confirmación en otro dispositivo (p.ej. revisa su correo en el celular
// pero se registró en la PC), la foto nunca se subía en ningún lado.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { user_id, base64, ext } = await req.json()

    if (!user_id || !base64 || !ext) {
      return new Response(JSON.stringify({ error: "Faltan datos" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const extensionLimpia = String(ext).toLowerCase().replace(/[^a-z0-9]/g, "")
    if (!EXTENSIONES_VALIDAS.includes(extensionLimpia)) {
      return new Response(JSON.stringify({ error: "Formato de imagen no válido" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // Nunca confiar en que el user_id que manda el cliente sea legítimo:
    // solo se acepta si es una cuenta real, creada hace poco, y que
    // todavía no confirma su correo — exactamente la ventana en la que
    // Registro.jsx llama a esta función. Evita que alguien mande un
    // user_id ajeno para sobreescribir la foto de otra persona.
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      })
    }

    const creadoHace = Date.now() - new Date(userData.user.created_at).getTime()
    if (userData.user.email_confirmed_at || creadoHace > 60 * 60 * 1000) {
      return new Response(JSON.stringify({ error: "Esta cuenta ya no puede recibir la foto de registro por esta vía" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      })
    }

    // Rate limiting (mismo patrón que el resto de las funciones)
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user_id)
      .eq("endpoint", "guardar-avatar-registro")
      .gte("window_start", windowStart)

    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Demasiados intentos. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user_id,
      endpoint: "guardar-avatar-registro",
      window_start: new Date().toISOString(),
    })

    let binario: string
    try {
      binario = atob(base64)
    } catch {
      return new Response(JSON.stringify({ error: "Imagen inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    if (binario.length > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "La imagen no puede pesar más de 5MB" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)

    const nombreArchivo = `${user_id}-${Date.now()}.${extensionLimpia}`
    const { error: uploadError } = await supabase.storage.from("avatars").upload(nombreArchivo, bytes, {
      contentType: `image/${extensionLimpia === "jpg" ? "jpeg" : extensionLimpia}`,
    })

    if (uploadError) {
      return new Response(JSON.stringify({ error: "No se pudo subir la imagen" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      })
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(nombreArchivo)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user_id)

    return new Response(JSON.stringify({ ok: true, avatar_url: publicUrl }), {
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
