// Cuánto dinero hay realmente en juego en un reembolso fallido.
//
// El monto se lee de Mercado Pago (transaction_amount del pago), no se calcula
// del precio del evento: el precio pudo cambiar después de la compra, y lo que
// hay que devolverle al comprador es lo que se le cobró.
//
// Lo usan avisar-fallo-reembolso (para que la PRIMERA alerta ya traiga el
// monto) y reintentar-reembolsos (para mantenerlo al día conforme se recupera).

export type ResumenMontos = {
  pendiente: number
  recuperado: number
  // Pagos que ya figuran como reembolsados en MP aunque nuestra fila no lo
  // supiera todavía (p. ej. si el anfitrión los devolvió a mano).
  yaReembolsados: string[]
  boletos: number
}

// deno-lint-ignore no-explicit-any
export async function resumenMontos(supabase: any, paymentIds: string[], recuperados: string[], token: string): Promise<ResumenMontos> {
  const r: ResumenMontos = { pendiente: 0, recuperado: 0, yaReembolsados: [], boletos: 0 }

  for (const id of paymentIds) {
    try {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      })
      if (!resp.ok) continue
      const pago = await resp.json()
      const monto = Number(pago.transaction_amount) || 0
      const devuelto = pago.status === "refunded" || pago.status === "cancelled"
      if (devuelto) r.yaReembolsados.push(String(id))
      if (devuelto || recuperados.includes(id)) r.recuperado += monto
      else r.pendiente += monto
    } catch (e) {
      // Un pago ilegible no debe tumbar el resumen completo.
      console.error(`[montos] No se pudo leer el pago ${id}:`, e)
    }
  }

  // Cuántos boletos cubren esos pagos: una compra grupal es UN pago que cubre
  // varios boletos, así que el conteo no es el número de pagos.
  try {
    const { count } = await supabase
      .from("boletos")
      .select("*", { count: "exact", head: true })
      .in("mp_payment_id", paymentIds)
    r.boletos = count ?? 0
  } catch (e) {
    console.error("[montos] No se pudieron contar los boletos:", e)
  }

  return r
}

export function pesos(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—"
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
}
