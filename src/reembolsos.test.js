import { describe, it, expect } from "vitest"
import {
  dedupPaymentIds,
  montoUnitarioBoleto,
  decidirReembolso,
  cuerpoReembolso,
  yaReembolsado,
  resultadoReembolsos,
} from "../supabase/functions/_shared/reembolsos.ts"

// Pruebas de la lógica de reembolsos. NO mueven dinero ni llaman a Mercado
// Pago: prueban las decisiones, que es donde han estado los bugs reales.
//
// Cada bloque de abajo corresponde a algo que ya salió mal en producción o que
// estuvo a punto de salir mal. Si una de estas pruebas se pone en rojo, es muy
// probable que alguien esté a punto de devolver un monto equivocado.

describe("un pago de MP puede cubrir varios boletos", () => {
  it("reembolsa por pago, no por boleto: los ids se deduplican", () => {
    // Una compra de 3 boletos es UN pago. Sin deduplicar, se le pediría a MP
    // el mismo reembolso 3 veces: la primera pasa y las otras dos fallan, y
    // como el resultado sí se revisa, la operación entera se daría por fallida
    // aunque el dinero ya hubiera vuelto.
    const boletos = [
      { id: "a", mp_payment_id: "111" },
      { id: "b", mp_payment_id: "111" },
      { id: "c", mp_payment_id: "111" },
    ]
    expect(dedupPaymentIds(boletos)).toEqual(["111"])
  })

  it("separa compras distintas del mismo evento", () => {
    const boletos = [
      { id: "a", mp_payment_id: "111" },
      { id: "b", mp_payment_id: "222" },
      { id: "c", mp_payment_id: "111" },
    ]
    expect(dedupPaymentIds(boletos)).toEqual(["111", "222"])
  })

  it("ignora los boletos sin pago (gratis o regalados con 100% de descuento)", () => {
    // Un boleto sin mp_payment_id nunca pasó por Mercado Pago. Colarlo aquí
    // haría que se intentara reembolsar el pago "null".
    const boletos = [
      { id: "a", mp_payment_id: null },
      { id: "b", mp_payment_id: undefined },
      { id: "c", mp_payment_id: "" },
      { id: "d", mp_payment_id: "333" },
    ]
    expect(dedupPaymentIds(boletos)).toEqual(["333"])
  })

  it("normaliza a texto (MP a veces devuelve el id como número)", () => {
    expect(dedupPaymentIds([{ mp_payment_id: 111 }, { mp_payment_id: "111" }])).toEqual(["111"])
  })

  it("no truena con una lista vacía o nula", () => {
    expect(dedupPaymentIds([])).toEqual([])
    expect(dedupPaymentIds(null)).toEqual([])
    expect(dedupPaymentIds(undefined)).toEqual([])
  })
})

describe("cuánto se le devuelve a un boleto", () => {
  it("usa el monto REAL que se pagó, no una fórmula", () => {
    // Con comisión escalonada y descuentos por paquete, el precio del evento
    // ya no permite reconstruir lo que se cobró.
    expect(montoUnitarioBoleto({ monto_pagado: 20 }, 40)).toBe(20)
    expect(montoUnitarioBoleto({ monto_pagado: 95 }, 100)).toBe(95)
  })

  it("acepta montos con decimales (un pago repartido entre varios boletos)", () => {
    expect(montoUnitarioBoleto({ monto_pagado: 55.5 }, 100)).toBe(55.5)
  })

  it("respeta el 0 como valor real, no como dato faltante", () => {
    // Un boleto regalado por un descuento del 100% tiene monto_pagado = 0.
    // Si se confundiera con null, se le devolvería precio × 1.10 de un pago
    // que nunca existió.
    expect(montoUnitarioBoleto({ monto_pagado: 0 }, 100)).toBe(0)
  })

  it("cae al respaldo precio × 1.10 solo en boletos anteriores a la columna", () => {
    // Esos sí se compraron cuando la comisión era 10% fijo, así que para ellos
    // la fórmula vieja es la correcta.
    expect(montoUnitarioBoleto({ monto_pagado: null }, 40)).toBe(44)
    expect(montoUnitarioBoleto({}, 100)).toBe(110)
    expect(montoUnitarioBoleto(null, 200)).toBe(220)
  })

  it("sin precio de evento devuelve 0, que después se trata como inseguro", () => {
    expect(montoUnitarioBoleto({ monto_pagado: null }, null)).toBe(0)
    expect(montoUnitarioBoleto({ monto_pagado: null }, undefined)).toBe(0)
  })
})

describe("reembolso parcial o total", () => {
  it("si el pago cubre otros boletos vivos, solo devuelve la parte de este", () => {
    // Aprobar uno y rechazar otro de la misma compra: devolver el pago
    // completo le quitaría el boleto al que sí fue aprobado.
    expect(decidirReembolso(20, 2)).toEqual({ tipo: "parcial", amount: 20 })
    expect(cuerpoReembolso(decidirReembolso(20, 2))).toEqual({ amount: 20 })
  })

  it("si es el último boleto vivo, devuelve lo que quede del pago", () => {
    // Cuerpo vacío = "todo lo que reste", que es como lo entiende MP.
    expect(decidirReembolso(20, 1)).toEqual({ tipo: "total" })
    expect(cuerpoReembolso(decidirReembolso(20, 1))).toEqual({})
  })

  it("se niega a reembolsar cuando el monto es desconocido y hay boletos ajenos", () => {
    // ESTA es la trampa cara: con monto 0 y otros boletos vivos, el cuerpo
    // saldría vacío y MP devolvería el pago COMPLETO, arrastrando boletos de
    // otras personas que sí fueron aprobados. Se declara imposible.
    expect(decidirReembolso(0, 3)).toEqual({ tipo: "inseguro" })
    expect(decidirReembolso(-5, 2)).toEqual({ tipo: "inseguro" })
  })

  it("con un solo boleto vivo, un monto desconocido no es peligroso", () => {
    // No hay boletos ajenos que arrastrar: devolver el pago completo es
    // exactamente lo correcto.
    expect(decidirReembolso(0, 1)).toEqual({ tipo: "total" })
  })

  it("trata un conteo ausente como un solo boleto", () => {
    expect(decidirReembolso(20, 0)).toEqual({ tipo: "total" })
    expect(decidirReembolso(20, null)).toEqual({ tipo: "total" })
  })
})

describe("consulta previa: no reembolsar dos veces", () => {
  it("un pago ya devuelto se da por bueno sin volver a pedirlo", () => {
    // Volver a pedirlo falla, y ese fallo haría ver como error algo que ya
    // está resuelto (lo que bloquearía la cancelación o el rechazo).
    expect(yaReembolsado(true, "refunded")).toBe(true)
  })

  it("un pago aprobado sí se reembolsa", () => {
    expect(yaReembolsado(true, "approved")).toBe(false)
  })

  it("si la consulta falla, se intenta el reembolso de todos modos", () => {
    // Preferimos un intento que falle a dar por perdido un pago que quizá sí
    // se puede devolver.
    expect(yaReembolsado(false, "refunded")).toBe(false)
    expect(yaReembolsado(false, undefined)).toBe(false)
  })
})

describe("la regla de oro: si un reembolso falla, no se borra ni se marca nada", () => {
  it("con todos los reembolsos exitosos, la operación puede completarse", () => {
    const r = resultadoReembolsos(["111", "222"], [])
    expect(r.todoOk).toBe(true)
    expect(r.aplicarCambios).toBe(true)
    expect(r.registrarFallo).toBe(false)
  })

  it("con un solo reembolso fallido, NO se aplica nada", () => {
    // Cancelar el evento o marcar el boleto rechazado borraría los
    // mp_payment_id, y con ellos la única forma de reintentar el reembolso.
    const r = resultadoReembolsos(["111", "222", "333"], ["222"])
    expect(r.todoOk).toBe(false)
    expect(r.aplicarCambios).toBe(false)
    expect(r.registrarFallo).toBe(true)
  })

  it("solo se registran como fallidos los pagos que realmente fallaron", () => {
    // Los que sí se devolvieron no deben reintentarse: MP los rechazaría y
    // el caso se vería como irrecuperable sin serlo.
    const r = resultadoReembolsos(["111", "222", "333"], ["222"])
    expect(r.fallidos).toEqual(["222"])
    expect(r.total).toBe(3)
  })

  it("no truena con listas vacías", () => {
    const r = resultadoReembolsos([], [])
    expect(r.todoOk).toBe(true)
    expect(r.total).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// El caso completo que costó dinero de verdad
// ---------------------------------------------------------------------------
describe("caso real: compra de 2 boletos con descuento, se aprueba uno y se rechaza otro", () => {
  it("devuelve exactamente lo que se cobró por el boleto rechazado", () => {
    // Producción, 10 de agosto: evento de $40 por solicitud con 50% de
    // descuento a partir de 2 boletos. MP cobró $40 por los dos ($20 c/u).
    // Al rechazar uno debe devolver $20 — con la fórmula vieja habría
    // intentado $44 sobre un pago de $40.
    const boletoRechazado = { mp_payment_id: "172250130567", monto_pagado: 20 }
    const boletosVivosDelPago = 2 // el aprobado y el que se está rechazando

    const monto = montoUnitarioBoleto(boletoRechazado, 40)
    expect(monto).toBe(20)

    const decision = decidirReembolso(monto, boletosVivosDelPago)
    expect(cuerpoReembolso(decision)).toEqual({ amount: 20 })

    // Y lo que la fórmula vieja habría mandado, para que quede constancia:
    expect(Math.round(40 * 1.10)).toBe(44)
  })
})
