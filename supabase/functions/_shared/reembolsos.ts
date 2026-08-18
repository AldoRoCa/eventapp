// Lógica pura de los reembolsos: las decisiones, no las llamadas.
//
// A propósito NO hace red ni toca la base — solo recibe datos y devuelve
// decisiones. Por eso Vitest lo puede importar tal cual desde Node y probarlo
// SIN dinero real y SIN llamar a Mercado Pago (ver src/reembolsos.test.js).
//
// Por qué existe: estas cuatro reglas son la parte más enredada del sistema y
// ya causaron dos bugs con dinero de por medio (reembolsar N veces el mismo
// pago, y devolver un monto calculado con una fórmula que dejó de ser cierta).
// Escribirlas una sola vez y dejarlas bajo prueba es más barato que volver a
// descubrirlas en un recibo.
//
// Lo usan las CINCO funciones que reembolsan: cancelar-evento,
// gestionar-solicitud, resolver-reporte, eliminar-cuenta y
// reembolsar-solicitudes-vencidas. Ya no queda ninguna copia inline de estas
// reglas — si cambias algo aquí, cambia para todas, que es justamente el punto.

// deno-lint-ignore no-explicit-any
type BoletoLike = { mp_payment_id?: any; monto_pagado?: any }

// ---------------------------------------------------------------------------
// 1. Un pago puede cubrir varios boletos
// ---------------------------------------------------------------------------
// Cuando alguien compra 3 boletos juntos, los 3 comparten el MISMO
// mp_payment_id. Reembolsar por boleto significa pedirle a MP tres veces el
// mismo pago: la primera pasa y las otras dos fallan, y como el resultado se
// mira, la operación entera se marca como fallida aunque el dinero sí volvió.
// Por eso siempre se reembolsa por PAGO, no por boleto.
export function dedupPaymentIds(boletos: BoletoLike[] | null | undefined): string[] {
  return [...new Set(
    (boletos || [])
      .filter((b) => b?.mp_payment_id)
      .map((b) => String(b.mp_payment_id))
  )]
}

// ---------------------------------------------------------------------------
// 2. Cuánto se le devuelve a UN boleto
// ---------------------------------------------------------------------------
// El monto real que se cobró por ese boleto, guardado al confirmar el pago
// (transaction_amount de MP ÷ boletos que cubre). El respaldo `precio × 1.10`
// existe SOLO para boletos anteriores a esa columna, que sí se compraron
// cuando la comisión era 10% fijo.
//
// Cuidado con el 0: un boleto regalado por un descuento del 100% tiene
// monto_pagado = 0, y eso es un valor REAL, no un dato faltante. Si se
// confundiera con null, se le devolvería `precio × 1.10` de un pago que
// nunca existió.
export function montoUnitarioBoleto(boleto: BoletoLike | null | undefined, precioEvento: unknown): number {
  const guardado = boleto?.monto_pagado
  if (guardado !== null && guardado !== undefined && Number.isFinite(Number(guardado))) {
    return Number(guardado)
  }
  return Math.round((Number(precioEvento) || 0) * 1.10)
}

// ---------------------------------------------------------------------------
// 3. Reembolso parcial o total
// ---------------------------------------------------------------------------
// Si el pago cubre otros boletos que siguen vivos, solo se devuelve la parte de
// este boleto; si es el último, se devuelve lo que quede del pago (cuerpo vacío
// = total, que es como MP entiende "todo lo que reste").
//
// El tercer caso, "inseguro", es la trampa: si quedan otros boletos vivos pero
// no sabemos cuánto vale este, un cuerpo vacío reembolsaría el pago COMPLETO y
// arrastraría boletos de otras personas que sí fueron aprobados. Antes eso
// habría pasado en silencio; ahora se declara imposible y quien llama lo trata
// como reembolso fallido.
export type DecisionReembolso =
  | { tipo: "total" }
  | { tipo: "parcial"; amount: number }
  | { tipo: "inseguro" }

export function decidirReembolso(monto: number, boletosVivosDelPago: number): DecisionReembolso {
  const vivos = Number(boletosVivosDelPago) || 1
  if (vivos > 1) {
    if (!(monto > 0)) return { tipo: "inseguro" }
    return { tipo: "parcial", amount: monto }
  }
  return { tipo: "total" }
}

// Cuerpo que se le manda a MP en /refunds a partir de la decisión.
export function cuerpoReembolso(decision: DecisionReembolso): Record<string, number> {
  return decision.tipo === "parcial" ? { amount: decision.amount } : {}
}

// ---------------------------------------------------------------------------
// 4. ¿Hace falta llamar a MP?
// ---------------------------------------------------------------------------
// Se consulta el pago ANTES de reembolsar. Si ya está devuelto (por ejemplo
// porque un intento anterior sí pasó, o porque el anfitrión lo devolvió a
// mano), se da por bueno sin volver a pedirlo — pedirlo otra vez falla y
// haría ver como error algo que ya está resuelto.
//
// Si la consulta NO se pudo hacer, se intenta el reembolso igual: es preferible
// un intento que falle a dar por perdido un pago que quizá sí se puede
// devolver.
export function yaReembolsado(consultaOk: boolean, estadoPago: unknown): boolean {
  return consultaOk === true && estadoPago === "refunded"
}

// ---------------------------------------------------------------------------
// 5. Qué se puede hacer después de intentar los reembolsos
// ---------------------------------------------------------------------------
// La regla de oro de todo el sistema: **si un reembolso falla, no se borra ni
// se marca nada**. Nada de cancelar el evento, marcar el boleto como rechazado
// o dar de baja la cuenta mientras haya dinero sin devolver — porque al borrar
// se pierden los mp_payment_id y con ellos la posibilidad de reintentar.
export type ResultadoReembolsos = {
  todoOk: boolean
  aplicarCambios: boolean
  registrarFallo: boolean
  fallidos: string[]
  total: number
}

export function resultadoReembolsos(paymentIds: string[], fallidos: string[]): ResultadoReembolsos {
  const ids = paymentIds || []
  const malos = fallidos || []
  const todoOk = malos.length === 0
  return {
    todoOk,
    aplicarCambios: todoOk,
    registrarFallo: !todoOk,
    fallidos: malos,
    total: ids.length,
  }
}
