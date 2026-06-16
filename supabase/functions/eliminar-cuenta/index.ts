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
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    )
 
    // Identificar al usuario autenticado a partir de su token — solo se
    // puede dar de baja LA PROPIA cuenta, nunca la de otra persona.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
 
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      })
    }
 
    const ahora = new Date().toISOString()
 
    // Eventos futuros del anfitrión (los pasados se conservan como
    // historial y no se tocan).
    const { data: eventosFuturos } = await supabase
      .from("eventos")
      .select("id")
      .eq("anfitrion_id", user.id)
      .gt("fecha", ahora)
 
    let eventosReembolsados = 0
    let eventosEliminadosSinBoletos = 0
    let totalReembolsos = 0
 
    for (const evento of eventosFuturos || []) {
      const { data: boletos } = await supabase
        .from("boletos")
        .select("id, mp_payment_id, estado")
        .eq("evento_id", evento.id)
        .in("estado", ["activo", "pendiente"])
 
      const tieneBoletos = (boletos || []).length > 0
 
      if (tieneBoletos) {
        const conPago = (boletos || []).filter(b => b.mp_payment_id)
        for (const boleto of conPago) {
          await fetch(`https://api.mercadopago.com/v1/payments/${boleto.mp_payment_id}/refunds`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${mpToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          })
        }
        totalReembolsos += conPago.length
        eventosReembolsados++
      } else {
        eventosEliminadosSinBoletos++
      }
 
      // En ambos casos (con o sin boletos) el evento futuro se elimina.
      await supabase.from("boletos").delete().eq("evento_id", evento.id)
      await supabase.from("eventos").delete().eq("id", evento.id)
    }
 
    // Anonimizar el perfil en vez de borrar la fila por completo: esto
    // preserva la integridad referencial de eventos PASADOS (que se
    // conservan como historial) y de boletos que ese usuario compró en
    // eventos de otros anfitriones. anfitrion_id/usuario_id en esas
    // tablas seguirían apuntando a un id válido, solo que ya "vacío".
    await supabase
      .from("profiles")
      .update({
        nombre: "Usuario eliminado",
        email: null,
        avatar_url: null,
        telefono: null,
        bio: null,
        instagram: null,
        fecha_nacimiento: null,
        ine_url: null,
        mp_access_token: null,
        mp_user_id: null,
        estado_anfitrion: "eliminado",
      })
      .eq("id", user.id)
 
    // Eliminar la cuenta de autenticación — sin esto, el usuario podría
    // seguir iniciando sesión aunque su perfil esté vacío.
    await supabase.auth.admin.deleteUser(user.id)
 
    return new Response(JSON.stringify({
      ok: true,
      eventosReembolsados,
      eventosEliminadosSinBoletos,
      totalReembolsos,
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