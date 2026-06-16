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
    const { reporte_id, accion } = await req.json() // accion: "aprobar" | "rechazar"
 
    if (accion !== "aprobar" && accion !== "rechazar") {
      return new Response(JSON.stringify({ error: "Acción inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }
 
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!
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
      reembolsados = conPago.length
 
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