// Detección del plazo de liberación del dinero en la cuenta de Mercado Pago
// del anfitrión. FASE B: solo OBSERVA (registra y alerta en logs), no bloquea.
//
// Por qué: los reembolsos salen del saldo de MP del anfitrión. El plazo de
// liberación lo elige él en su cuenta (al instante / 7 días / 30 días) y no
// se puede forzar desde la API. Si está en "al instante", puede retirar el
// dinero en cuanto vende y cualquier reembolso posterior falla por falta de
// saldo. Lo único robusto es leer, en cada pago ya verificado contra la API
// de MP, cuánto tardará ese dinero en liberarse (money_release_date vs
// date_approved) — cada venta re-verifica, así que un cambio de configuración
// del anfitrión se detecta solo en su siguiente venta.
//
// Se llama DESPUÉS de que los boletos del pago ya se activaron: pase lo que
// pase aquí adentro, la confirmación del pago no se toca — todo va en
// try/catch y los fallos solo se registran en logs.

// deno-lint-ignore no-explicit-any
export async function detectarLiberacion(supabase: any, pago: any, eventoId: string, anfitrionId: string, origen: string): Promise<void> {
  try {
    const releaseRaw = pago?.money_release_date ?? null
    const approvedRaw = pago?.date_approved ?? pago?.date_created ?? null

    const release = releaseRaw ? Date.parse(releaseRaw) : NaN
    const approved = approvedRaw ? Date.parse(approvedRaw) : NaN

    if (!Number.isFinite(release) || !Number.isFinite(approved)) {
      // Dato faltante o con formato inesperado. En observación esto es
      // justo lo que queremos ver ANTES de activar bloqueos: se registra
      // como incidente para revisarlo, sin bloquear a nadie.
      console.error(`[LIBERACION] Datos ilegibles en pago ${pago?.id} (${origen}): release=${JSON.stringify(releaseRaw)} approved=${JSON.stringify(approvedRaw)}`)
      const { error } = await supabase.from("incidentes_liberacion").upsert({
        anfitrion_id: anfitrionId,
        evento_id: eventoId,
        mp_payment_id: String(pago?.id ?? ""),
        tipo: "dato_ilegible",
        money_release_date: releaseRaw === null ? null : String(releaseRaw),
        date_approved: approvedRaw === null ? null : String(approvedRaw),
        origen,
        detalle: "money_release_date o date_approved vacíos o ilegibles; revisar el formato antes de activar la Fase C",
      }, { onConflict: "mp_payment_id,tipo", ignoreDuplicates: true })
      if (error) console.error(`[LIBERACION] No se pudo registrar el incidente:`, error.message)
      return
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

    if (inmediata) {
      console.error(`[LIBERACION] Liberación inmediata detectada: anfitrión ${anfitrionId}, pago ${pago.id}, ${diasRedondeados} días (${origen})`)
      const { error } = await supabase.from("incidentes_liberacion").upsert({
        anfitrion_id: anfitrionId,
        evento_id: eventoId,
        mp_payment_id: String(pago.id),
        tipo: "liberacion_inmediata",
        liberacion_dias: diasRedondeados,
        money_release_date: String(releaseRaw),
        date_approved: String(approvedRaw),
        origen,
        detalle: `El dinero de este pago se libera al anfitrión en ${diasRedondeados} días — su cuenta de MP está en "al instante". Fase de observación: no se bloqueó nada.`,
      }, { onConflict: "mp_payment_id,tipo", ignoreDuplicates: true })
      if (error) console.error(`[LIBERACION] No se pudo registrar el incidente:`, error.message)
    }
  } catch (e) {
    // Nunca romper la confirmación de un pago por un fallo de la detección.
    // deno-lint-ignore no-explicit-any
    console.error(`[LIBERACION] Error detectando liberación (${origen}):`, (e as any)?.message ?? e)
  }
}
