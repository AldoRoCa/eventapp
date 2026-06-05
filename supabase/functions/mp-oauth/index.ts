import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state") // user_id del anfitrión

    if (!code || !state) {
      return new Response("Parámetros inválidos", { status: 400 })
    }

    // Intercambiar code por access token
    const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("MP_CLIENT_ID"),
        client_secret: Deno.env.get("MP_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
        redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-oauth`,
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      return new Response("Error al obtener token", { status: 400 })
    }

    // Guardar token en Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )

    await supabase
      .from("profiles")
      .update({
        mp_access_token: tokenData.access_token,
        mp_user_id: String(tokenData.user_id),
      })
      .eq("id", state)

    // Redirigir al panel
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `${Deno.env.get("SITE_URL")}/panel?mp=conectado`,
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})