// Detección y bloqueo de "liberación inmediata" del dinero en la cuenta de
// Mercado Pago del anfitrión (Fase C: detecta Y actúa).
//
// Por qué: los reembolsos salen del saldo de MP del anfitrión. El plazo de
// liberación lo elige él en su cuenta (al instante / 14 días / 30 días) y no
// se puede forzar desde la API. Si está en "al instante", puede retirar el
// dinero en cuanto vende y cualquier reembolso posterior falla por falta de
// saldo. Lo único robusto es leer, en cada pago ya verificado contra la API
// de MP, cuánto tardará ese dinero en liberarse (money_release_date vs
// date_approved) — cada venta re-verifica, así que un cambio de configuración
// del anfitrión se detecta solo en su siguiente venta.
//
// Al detectar liberación inmediata (acordado con el admin, 2026-08-08):
//   1. Pausar las ventas de TODOS los eventos del anfitrión (la configuración
//      es de su cuenta, no de un evento) — sin cancelar ni borrar nada.
//   2. Reembolsar SOLO el pago que disparó la detección: se aprobó hace
//      segundos, así que ese dinero está en su saldo con certeza. La
//      exposición máxima queda en un solo pago por anfitrión.
//   3. Marcar los boletos de ese pago como rechazados, con motivo visible.
//   4. El desbloqueo es manual: el admin usa la Edge Function
//      desbloquear-anfitrion cuando el anfitrión demuestre (captura) que
//      cambió su plazo a 7/30 días. La siguiente venta re-verifica de todas
//      formas: si no lo cambió de verdad, se vuelve a bloquear solo.
//
// El candado real de venta vive en crear-pago-mp (lee
// mp_credenciales.liberacion_inmediata, tabla sin acceso de cliente);
// eventos.ventas_pausadas es informativo/de UI.
//
// Se llama DESPUÉS de que los boletos del pago ya se activaron: pase lo que
// pase aquí adentro, la confirmación del pago no se toca — todo va en
// try/catch y los fallos solo se registran.
//
// Devuelve "reembolsado" si este pago terminó reembolsado por la detección
// (para que confirmar-pago-mp le diga la verdad al comprador), o null.

// deno-lint-ignore no-explicit-any
export async function detectarLiberacion(supabase: any, pago: any, eventoId: string, anfitrionId: string, mpToken: string, origen: string): Promise<"reembolsado" | null> {
  try {
    const releaseRaw = pago?.money_release_date ?? null
    const approvedRaw = pago?.date_approved ?? pago?.date_created ?? null

    const release = releaseRaw ? Date.parse(releaseRaw) : NaN
    const approved = approvedRaw ? Date.parse(approvedRaw) : NaN

    if (!Number.isFinite(release) || !Number.isFinite(approved)) {
      // Dato faltante o con formato inesperado: se registra para revisión
      // del admin, sin bloquear a nadie (no castigar a un anfitrión por un
      // hueco en los datos de MP).
      console.error(`[LIBERACION] Datos ilegibles en pago ${pago?.id} (${origen}): release=${JSON.stringify(releaseRaw)} approved=${JSON.stringify(approvedRaw)}`)
      const { error } = await supabase.from("incidentes_liberacion").upsert({
        anfitrion_id: anfitrionId,
        evento_id: eventoId,
        mp_payment_id: String(pago?.id ?? ""),
        tipo: "dato_ilegible",
        money_release_date: releaseRaw === null ? null : String(releaseRaw),
        date_approved: approvedRaw === null ? null : String(approvedRaw),
        origen,
        detalle: "money_release_date o date_approved vacíos o ilegibles; no se bloqueó nada. Revisar el pago en el panel de MP.",
      }, { onConflict: "mp_payment_id,tipo", ignoreDuplicates: true })
      if (error) console.error(`[LIBERACION] No se pudo registrar el incidente:`, error.message)
      return null
    }

    const dias = (release - approved) / 86400000
    const diasRedondeados = Math.round(dias * 100) / 100
    const inmediata = dias < 1

    const { error: errCred } = await supabase
      .from("mp_credenciales")
      .update({
        liberacion_inmediata: inmediata,
        liberacion_dias: diasRedondeados,
        liberacion_verificada_en: new Date().toISOString(),
      })
      .eq("id", anfitrionId)
    if (errCred) console.error(`[LIBERACION] No se pudo actualizar mp_credenciales:`, errCred.message)

    // Espejo en profiles para que el Panel de Anfitrión pueda mostrar si su
    // configuración ya fue verificada por una venta real (mp_credenciales no
    // es legible por el cliente: guarda el token). null = sin verificar.
    const { error: errPerfil } = await supabase
      .from("profiles")
      .update({ mp_liberacion_verificada_en: inmediata ? null : new Date().toISOString() })
      .eq("id", anfitrionId)
    if (errPerfil) console.error(`[LIBERACION] No se pudo actualizar profiles:`, errPerfil.message)

    if (!inmediata) return null

    console.error(`[LIBERACION] Liberación inmediata detectada: anfitrión ${anfitrionId}, pago ${pago.id}, ${diasRedondeados} días (${origen})`)

    // El upsert contra el índice único (mp_payment_id, tipo) hace de candado:
    // confirmar-pago-mp y mp-webhook pueden ver el mismo pago casi a la vez,
    // pero solo la ruta que logra INSERTAR el incidente ejecuta las acciones
    // (pausa + reembolso). La otra recibe [] y solo reporta el estado.
    const { data: insertado, error: errInc } = await supabase.from("incidentes_liberacion").upsert({
      anfitrion_id: anfitrionId,
      evento_id: eventoId,
      mp_payment_id: String(pago.id),
      tipo: "liberacion_inmediata",
      liberacion_dias: diasRedondeados,
      money_release_date: String(releaseRaw),
      date_approved: String(approvedRaw),
      origen,
      detalle: `El dinero de este pago se libera al anfitrión en ${diasRedondeados} días (cuenta en "al instante"). Acciones automáticas: ventas del anfitrión pausadas + reembolso del pago detector. Desbloquear solo cuando mande captura de su plazo corregido (14 o 30 días).`,
    }, { onConflict: "mp_payment_id,tipo", ignoreDuplicates: true }).select()

    if (errInc) {
      console.error(`[LIBERACION] No se pudo registrar el incidente:`, errInc.message)
      return null
    }

    if (!insertado || insertado.length === 0) {
      // La otra ruta ganó el candado y está actuando (o ya actuó) sobre este
      // mismo pago. Reportar el estado real de los boletos.
      const { data: b } = await supabase
        .from("boletos")
        .select("estado")
        .eq("mp_payment_id", String(pago.id))
        .limit(1)
      return b?.[0]?.estado === "rechazado" ? "reembolsado" : null
    }

    // 1. Pausar las ventas de TODOS los eventos del anfitrión — su
    //    configuración de liberación es de cuenta, no de un evento.
    const { error: errPausa } = await supabase
      .from("eventos")
      .update({
        ventas_pausadas: true,
        pausa_motivo: "Cuenta de Mercado Pago con liberación inmediata del dinero. Cambia el plazo de liberación a 14 o 30 días (Mercado Pago → Tu perfil → Negocio → Comisiones y MSI → pestaña Checkout) y manda captura al admin para reactivar tus ventas.",
      })
      .eq("anfitrion_id", anfitrionId)
    if (errPausa) console.error(`[LIBERACION] No se pudieron pausar los eventos:`, errPausa.message)

    // 2. Reembolsar este pago completo. Si falla (no debería: el dinero
    //    acaba de entrar), se registra en fallos_reembolso — eso dispara el
    //    correo de alerta ya existente — y los boletos NO se marcan
    //    rechazados (mismo principio que gestionar-solicitud: nunca dejar
    //    un boleto "rechazado" con un pago sin reembolsar).
    const reembolsado = await reembolsarPagoDetector(String(pago.id), mpToken)
    if (!reembolsado) {
      await supabase.from("fallos_reembolso").insert({
        contexto: "liberacion-inmediata",
        usuario_id: anfitrionId,
        evento_id: eventoId,
        payment_ids: [String(pago.id)],
        detalle: "El reembolso automático del pago detector falló. Las ventas del anfitrión quedaron pausadas; reintentar el reembolso manualmente desde el panel de MP o contactar al anfitrión.",
      })
      return null
    }

    // 3. Marcar los boletos de este pago como rechazados, con motivo que el
    //    comprador pueda entender.
    const { error: errBol } = await supabase
      .from("boletos")
      .update({
        estado: "rechazado",
        motivo_rechazo: "Tu pago fue reembolsado automáticamente por una revisión de seguridad de la cuenta de cobro del organizador. El dinero vuelve a tu método de pago (el tiempo depende de tu banco).",
      })
      .eq("mp_payment_id", String(pago.id))
      .eq("evento_id", eventoId)
    if (errBol) console.error(`[LIBERACION] No se pudieron marcar los boletos:`, errBol.message)

    return "reembolsado"
  } catch (e) {
    // Nunca romper la confirmación de un pago por un fallo de la detección.
    // deno-lint-ignore no-explicit-any
    console.error(`[LIBERACION] Error detectando liberación (${origen}):`, (e as any)?.message ?? e)
    return null
  }
}

// Reembolso del pago detector, con el token del anfitrión (el único con
// autoridad sobre sus pagos). Mismo patrón defensivo que las funciones de
// reembolso existentes (que NO se tocan): GET previo para no reembolsar
// doble, X-Idempotency-Key, y solo true si MP confirmó.
async function reembolsarPagoDetector(paymentId: string, token: string): Promise<boolean> {
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
      console.error(`[ALERTA-REEMBOLSO] Reembolso del pago detector ${paymentId} rechazado por MP:`, res.status, JSON.stringify(detalle))
    }
    return res.ok
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    console.error(`[ALERTA-REEMBOLSO] Error de red reembolsando pago detector ${paymentId}:`, (e as any)?.message ?? e)
    return false
  }
}
