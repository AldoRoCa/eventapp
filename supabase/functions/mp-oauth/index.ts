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
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    if (!code || !state) {
      return new Response("Faltan parámetros", { status: 400 })
    }

    const clientId = Deno.env.get("MP_CLIENT_ID")!
    const clientSecret = Deno.env.get("MP_CLIENT_SECRET")!
    const siteUrl = Deno.env.get("SITE_URL")!

    const supabaseState = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    // El "state" es un código de un solo uso generado por la app (ver
    // PanelAnfitrion.jsx), no el id del usuario directo — así nadie puede
    // falsificarlo para ligar su propio token al perfil de otro anfitrión.
    const { data: estadoGuardado } = await supabaseState
      .from("mp_oauth_state")
      .delete()
      .eq("state", state)
      .select("usuario_id")
      .single()

    if (!estadoGuardado?.usuario_id) {
      return new Response("Solicitud de conexión inválida o expirada", { status: 400 })
    }

    const usuario_id = estadoGuardado.usuario_id

    // Rate limiting
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabaseState
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", usuario_id)
      .eq("endpoint", "mp-oauth")
      .gte("window_start", windowStart)

    if ((count || 0) >= 10) {
      return new Response("Demasiados intentos. Espera un momento.", { status: 429 })
    }

    await supabaseState.from("rate_limits").insert({
      identifier: usuario_id,
      endpoint: "mp-oauth",
      window_start: new Date().toISOString(),
    })

    // Intercambiar código por access token
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-oauth`,
      })
    })

    const tokenData = await tokenRes.json()

    if (!tokenData.access_token) {
      return Response.redirect(`${siteUrl}/panel?mp=error`, 302)
    }

    // mp_access_token es un secreto y vive en una tabla aparte
    // (mp_credenciales) que solo el sistema puede leer/escribir — nunca
    // se expone junto al resto del perfil, que sí es legible por otros
    // usuarios de la app. mp_user_id no es secreto, se queda en profiles.
    await supabaseState
      .from("mp_credenciales")
      .upsert({ id: usuario_id, mp_access_token: tokenData.access_token })

    await supabaseState
      .from("profiles")
      .update({ mp_user_id: String(tokenData.user_id) })
      .eq("id", usuario_id)

    return Response.redirect(`${siteUrl}/panel?mp=conectado`, 302)

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})