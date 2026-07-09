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

    // Rate limiting
    const windowStartLimit = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("identifier", user.id)
      .eq("endpoint", "eliminar-cuenta")
      .gte("window_start", windowStartLimit)

    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Demasiados intentos. Intenta más tarde." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      })
    }

    await supabase.from("rate_limits").insert({
      identifier: user.id,
      endpoint: "eliminar-cuenta",
      window_start: new Date().toISOString(),
    })

    const ahora = new Date().toISOString()

    // Eventos futuros del anfitrión (los pasados se conservan como
    // historial y no se tocan).
    const { data: eventosFuturos } = await supabase
      .from("eventos")
      .select("id")
      .eq("anfitrion_id", user.id)
      .gt("fecha", ahora)

    // Recolectar, ANTES de borrar nada, todos los pagos a reembolsar de
    // todos los eventos futuros. La baja de cuenta reembolsa varios eventos
    // a la vez, así que se procesa en dos fases estrictas para no dejar la
    // cuenta a medio borrar: (1) reembolsar TODO, y solo si todo salió bien,
    // (2) borrar y anonimizar. Si un solo reembolso falla, no se borra nada.
    let eventosReembolsados = 0
    let eventosEliminadosSinBoletos = 0

    // Un mismo pago (mp_payment_id) puede cubrir varios boletos comprados
    // juntos; se reembolsa por pago, no por boleto (reembolsar dos veces el
    // mismo pago falla en MP). Se deduplica globalmente entre todos los
    // eventos futuros del anfitrión.
    const paymentIds = new Set<string>()

    for (const evento of eventosFuturos || []) {
      const { data: boletos } = await supabase
        .from("boletos")
        .select("id, mp_payment_id, estado")
        .eq("evento_id", evento.id)
        .in("estado", ["activo", "pendiente"])

      const tieneBoletos = (boletos || []).length > 0
      if (tieneBoletos) {
        eventosReembolsados++
        for (const b of boletos || []) {
          if (b.mp_payment_id) paymentIds.add(String(b.mp_payment_id))
        }
      } else {
        eventosEliminadosSinBoletos++
      }
    }

    const pagosUnicos = [...paymentIds]

    if (pagosUnicos.length > 0) {
      // Los pagos los cobró la cuenta de Mercado Pago del propio anfitrión
      // (el usuario que se da de baja), así que solo su token OAuth puede
      // reembolsarlos — el token de la plataforma (MP_ACCESS_TOKEN) recibe
      // 404 de MP en /refunds. Este era el bug: antes se usaba el token de
      // plataforma y se borraban boletos/eventos aunque el reembolso fallara.
      const { data: cred } = await supabase
        .from("mp_credenciales")
        .select("mp_access_token")
        .eq("id", user.id)
        .single()

      if (!cred?.mp_access_token) {
        return new Response(JSON.stringify({ error: "Tienes eventos futuros con boletos pagados pero no se encontró tu cuenta de Mercado Pago conectada. No se puede dar de baja la cuenta sin reembolsar a los compradores." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        })
      }

      const fallidos: string[] = []
      for (const paymentId of pagosUnicos) {
        const ok = await reembolsarPago(paymentId, cred.mp_access_token)
        if (!ok) fallidos.push(paymentId)
      }

      if (fallidos.length > 0) {
        // No borrar ni anonimizar nada: los boletos y sus mp_payment_id se
        // conservan para reintentar la baja (los pagos ya reembolsados se
        // detectan con un GET previo y no se cobran doble).
        console.log("Reembolsos fallidos en eliminar-cuenta:", JSON.stringify({ user_id: user.id, fallidos }))
        // Persistir el fallo para el panel de admin (best-effort).
        await supabase.from("fallos_reembolso").insert({
          contexto: "eliminar-cuenta",
          usuario_id: user.id,
          evento_id: null,
          payment_ids: fallidos,
          detalle: `No se pudieron reembolsar ${fallidos.length} de ${pagosUnicos.length} pagos al dar de baja la cuenta (¿saldo insuficiente en la cuenta de Mercado Pago del anfitrión?).`,
        })
        return new Response(JSON.stringify({ error: `No se pudieron reembolsar ${fallidos.length} de ${pagosUnicos.length} pagos (¿saldo insuficiente en tu cuenta de Mercado Pago?). Tu cuenta NO se dio de baja; intenta de nuevo en unos minutos.` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        })
      }
    }

    // A partir de aquí todos los reembolsos (si los hubo) están confirmados.
    // Ahora sí es seguro borrar los eventos futuros y sus boletos.
    for (const evento of eventosFuturos || []) {
      await supabase.from("boletos").delete().eq("evento_id", evento.id)
      await supabase.from("eventos").delete().eq("id", evento.id)
    }

    // Anonimizar el perfil en vez de borrar la fila por completo: esto
    // preserva la integridad referencial de eventos PASADOS (que se
    // conservan como historial) y de boletos que ese usuario compró en
    // eventos de otros anfitriones. anfitrion_id/usuario_id en esas
    // tablas seguirían apuntando a un id válido, solo que ya "vacío".
    await supabase.from("mp_credenciales").delete().eq("id", user.id)

    // Borrar los archivos reales del storage — antes solo se limpiaba el
    // campo en profiles, pero la identificación oficial (dato sensible)
    // se quedaba guardada indefinidamente en el bucket.
    const { data: perfilActual } = await supabase.from("profiles").select("ine_url").eq("id", user.id).single()
    if (perfilActual?.ine_url) {
      await supabase.storage.from("ine-docs").remove([perfilActual.ine_url])
    }
    const { data: avatares } = await supabase.storage.from("avatars").list("", { search: `${user.id}-` })
    if (avatares && avatares.length > 0) {
      await supabase.storage.from("avatars").remove(avatares.map(a => a.name))
    }

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
      totalReembolsos: pagosUnicos.length,
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

// Reembolsa el total de un pago con el token del anfitrión. Devuelve true
// solo si Mercado Pago confirmó el reembolso (o si el pago ya estaba
// reembolsado de un intento anterior). Mismo patrón que cancelar-evento.
async function reembolsarPago(paymentId: string, token: string): Promise<boolean> {
  try {
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    })
    const pago = await consulta.json()
    if (consulta.ok && pago.status === "refunded") return true

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const detalle = await res.json().catch(() => ({}))
      console.log(`Reembolso rechazado por MP para pago ${paymentId}:`, res.status, JSON.stringify(detalle))
    }
    return res.ok
  } catch (e) {
    console.log(`Error de red reembolsando pago ${paymentId}:`, e.message)
    return false
  }
}
