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
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const usuario_id = url.searchParams.get("state")

    if (!code || !usuario_id) {
      return new Response("Faltan parámetros", { status: 400 })
    }

    const clientId = Deno.env.get("MP_CLIENT_ID")!
    const clientSecret = Deno.env.get("MP_CLIENT_SECRET")!
    const siteUrl = Deno.env.get("SITE_URL")!

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

    // Guardar token en el perfil del anfitrión
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
      .eq("id", usuario_id)

    return Response.redirect(`${siteUrl}/panel?mp=conectado`, 302)

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})