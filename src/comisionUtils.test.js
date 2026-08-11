import { describe, it, expect } from "vitest"
import {
  porcentajeComision,
  precioConComision,
  comisionVela,
  precioConDescuento,
  aplicaDescuentoPaquete,
  esMontoCobrable,
  desglosePrecio,
  cargoMercadoPago,
  cargoMercadoPagoSobreCobro,
  gananciaNetaBoleto,
  MINIMO_MP,
} from "./comisionUtils"

// La copia de las Edge Functions (Deno). Se importa aquí para la prueba de
// paridad del final: si las dos copias divergen, el precio que ve el comprador
// deja de coincidir con lo que se le cobra.
import * as deno from "../supabase/functions/_shared/comision.ts"

describe("comisión escalonada de VELA (la paga el asistente)", () => {
  it("cobra 0% de $5 a $49", () => {
    expect(porcentajeComision(5)).toBe(0)
    expect(porcentajeComision(30)).toBe(0)
    expect(porcentajeComision(49)).toBe(0)
    // Un boleto de $40 se ve $40: el asistente no paga nada encima.
    expect(precioConComision(40)).toBe(40)
    expect(comisionVela(40)).toBe(0)
  })

  it("cobra 5% de $50 a $99", () => {
    expect(porcentajeComision(50)).toBe(0.05)
    expect(porcentajeComision(99)).toBe(0.05)
    expect(precioConComision(50)).toBe(53) // round(52.5)
    expect(precioConComision(80)).toBe(84)
    expect(precioConComision(99)).toBe(104) // round(103.95)
  })

  it("cobra 8% de $100 a $199", () => {
    expect(porcentajeComision(100)).toBe(0.08)
    expect(porcentajeComision(199)).toBe(0.08)
    // Un boleto de $100 se ve $108.
    expect(precioConComision(100)).toBe(108)
    expect(comisionVela(100)).toBe(8)
    expect(precioConComision(199)).toBe(215) // round(214.92)
  })

  it("cobra 10% de $200 en adelante", () => {
    expect(porcentajeComision(200)).toBe(0.10)
    expect(porcentajeComision(5000)).toBe(0.10)
    expect(precioConComision(200)).toBe(220)
    expect(precioConComision(500)).toBe(550)
    expect(comisionVela(500)).toBe(50)
  })

  it("respeta los límites exactos de cada escalón", () => {
    // $49 → $49 (0%) pero $50 → $53 (5%): el brinco en el límite es
    // deliberado y conocido, no un error de redondeo.
    expect(precioConComision(49)).toBe(49)
    expect(precioConComision(50)).toBe(53)
    expect(precioConComision(99)).toBe(104)
    expect(precioConComision(100)).toBe(108)
    expect(precioConComision(199)).toBe(215)
    expect(precioConComision(200)).toBe(220)
  })

  it("un evento gratis no cobra comisión", () => {
    expect(precioConComision(0)).toBe(0)
    expect(comisionVela(0)).toBe(0)
    expect(porcentajeComision(0)).toBe(0)
  })
})

describe("descuento por paquete", () => {
  it("solo aplica a partir del número de boletos configurado", () => {
    // 10% al llevar 5 o más
    expect(aplicaDescuentoPaquete(4, 10, 5)).toBe(false)
    expect(aplicaDescuentoPaquete(5, 10, 5)).toBe(true)
    expect(aplicaDescuentoPaquete(9, 10, 5)).toBe(true)
  })

  it("no aplica si el evento no tiene descuento configurado", () => {
    expect(aplicaDescuentoPaquete(10, null, null)).toBe(false)
    expect(aplicaDescuentoPaquete(10, 0, 5)).toBe(false)
    expect(aplicaDescuentoPaquete(10, 10, null)).toBe(false)
  })

  it("exige un umbral de al menos 2 boletos (con 1 no sería un paquete)", () => {
    expect(aplicaDescuentoPaquete(1, 10, 1)).toBe(false)
    expect(aplicaDescuentoPaquete(3, 10, 1)).toBe(false)
  })

  it("baja el precio del anfitrión, redondeado a peso", () => {
    expect(precioConDescuento(100, 10)).toBe(90)
    expect(precioConDescuento(99, 10)).toBe(89) // round(89.1)
    expect(precioConDescuento(35, 15)).toBe(30) // round(29.75)
  })

  it("con 100% de descuento el boleto queda en $0", () => {
    expect(precioConDescuento(100, 100)).toBe(0)
    expect(precioConDescuento(5, 100)).toBe(0)
  })
})

describe("desglose de una compra completa", () => {
  const evento = { precio: 100, descuento_porcentaje: 10, descuento_min_boletos: 5 }

  it("sin alcanzar el paquete, cobra el precio de lista con su escalón", () => {
    const d = desglosePrecio(evento, 2)
    expect(d.aplicaDescuento).toBe(false)
    expect(d.precioAnfitrion).toBe(100)
    expect(d.unitario).toBe(108) // 8%
    expect(d.total).toBe(216)
    expect(d.ahorro).toBe(0)
  })

  it("al alcanzar el paquete, el escalón se recalcula sobre el precio YA con descuento", () => {
    // $100 − 10% = $90 → escalón de $50-99 → 5% → el asistente paga $95.
    // (Decisión explícita: "el escalón lo manda lo que realmente cuesta el
    // boleto", no el precio de lista.)
    const d = desglosePrecio(evento, 5)
    expect(d.aplicaDescuento).toBe(true)
    expect(d.precioAnfitrion).toBe(90)
    expect(d.unitario).toBe(95)
    expect(d.total).toBe(475)
    // Contra $108 × 5 = $540 sin descuento.
    expect(d.ahorro).toBe(65)
  })

  it("con 100% de descuento la compra sale gratis", () => {
    const d = desglosePrecio({ precio: 80, descuento_porcentaje: 100, descuento_min_boletos: 3 }, 3)
    expect(d.precioAnfitrion).toBe(0)
    expect(d.unitario).toBe(0)
    expect(d.total).toBe(0)
    expect(d.gratis).toBe(true)
    // $0 SÍ es cobrable en el sentido de "válido": se entrega gratis, sin
    // pasar por Mercado Pago.
    expect(d.cobrable).toBe(true)
  })

  it("un evento gratis sigue gratis con cualquier cantidad", () => {
    const d = desglosePrecio({ precio: 0 }, 3)
    expect(d.total).toBe(0)
    expect(d.gratis).toBe(true)
  })

  it("cantidades inválidas se tratan como 1 boleto", () => {
    expect(desglosePrecio({ precio: 100 }, 0).cantidad).toBe(1)
    expect(desglosePrecio({ precio: 100 }, -3).cantidad).toBe(1)
    expect(desglosePrecio({ precio: 100 }, undefined).cantidad).toBe(1)
  })
})

describe("mínimo de $5 de Mercado Pago (regla innegociable)", () => {
  it("acepta $0 (gratis) y cualquier monto de $5 para arriba", () => {
    expect(esMontoCobrable(0)).toBe(true)
    expect(esMontoCobrable(MINIMO_MP)).toBe(true)
    expect(esMontoCobrable(5)).toBe(true)
    expect(esMontoCobrable(1000)).toBe(true)
  })

  it("rechaza la franja prohibida de $0.01 a $4.99", () => {
    expect(esMontoCobrable(0.01)).toBe(false)
    expect(esMontoCobrable(1)).toBe(false)
    expect(esMontoCobrable(3)).toBe(false)
    expect(esMontoCobrable(4.99)).toBe(false)
  })

  it("detecta el descuento prohibido que dejaría el cobro en la franja muerta", () => {
    // Boleto de $5 con 50% de descuento → $3 (0% de comisión) → NO cobrable.
    const d = desglosePrecio({ precio: 5, descuento_porcentaje: 50, descuento_min_boletos: 2 }, 2)
    expect(d.unitario).toBe(3)
    expect(d.cobrable).toBe(false)

    // Boleto de $40 con 90% de descuento → $4 → NO cobrable.
    const d2 = desglosePrecio({ precio: 40, descuento_porcentaje: 90, descuento_min_boletos: 2 }, 2)
    expect(d2.unitario).toBe(4)
    expect(d2.cobrable).toBe(false)
  })

  it("un descuento que deja el boleto en $5 justo sí es válido", () => {
    const d = desglosePrecio({ precio: 50, descuento_porcentaje: 90, descuento_min_boletos: 2 }, 2)
    expect(d.precioAnfitrion).toBe(5)
    expect(d.unitario).toBe(5) // escalón de 0%
    expect(d.cobrable).toBe(true)
  })
})

describe("tarifa de Mercado Pago (la paga el anfitrión)", () => {
  it("coincide con el recibo real: un cobro de $6 → cargo de $4.88", () => {
    // El ancla empírica es sobre el MONTO COBRADO, no sobre el precio del
    // anfitrión: con la comisión escalonada, un boleto de $5 ya no se cobra
    // en $6 (cae en el escalón de 0%), pero la fórmula es la misma.
    expect(cargoMercadoPagoSobreCobro(6)).toBeCloseTo(4.88, 2)
  })

  it("como proporción, el cargo baja mucho en precios reales", () => {
    // En $500 el cargo fijo de $4 pesa poco: la tarifa queda en ~5% del precio.
    const cargo = cargoMercadoPago(500)
    expect(cargo / 500).toBeLessThan(0.06)
  })
})

describe("ganancia neta del anfitrión por boleto", () => {
  it("en montos chicos el cargo fijo de MP se come casi todo", () => {
    // $5: gana centavos (documentado). La comisión de VELA NO se le descuenta
    // — y en este escalón ni siquiera existe.
    expect(gananciaNetaBoleto(5)).toBeCloseTo(5 - cargoMercadoPago(5), 6)
    expect(gananciaNetaBoleto(5)).toBeLessThan(1)
  })

  it("en precios reales conserva la mayor parte del precio", () => {
    expect(gananciaNetaBoleto(500)).toBeGreaterThan(470)
  })
})

// ---------------------------------------------------------------------------
// La prueba que evita que las dos copias se separen
// ---------------------------------------------------------------------------
describe("paridad entre src/comisionUtils.js y _shared/comision.ts", () => {
  const precios = [0, 5, 30, 49, 50, 51, 99, 100, 150, 199, 200, 201, 500, 1234, 50000]
  const cantidades = [1, 2, 3, 5, 10]
  const descuentos = [null, 5, 10, 25, 50, 90, 100]
  const minimos = [null, 2, 3, 5]

  it("las funciones sueltas dan el mismo resultado en todos los precios", () => {
    for (const p of precios) {
      expect(deno.porcentajeComision(p)).toBe(porcentajeComision(p))
      expect(deno.precioConComision(p)).toBe(precioConComision(p))
      expect(deno.comisionVela(p)).toBe(comisionVela(p))
      expect(deno.cargoMercadoPago(p)).toBeCloseTo(cargoMercadoPago(p), 10)
      expect(deno.gananciaNetaBoleto(p)).toBeCloseTo(gananciaNetaBoleto(p), 10)
      expect(deno.esMontoCobrable(p)).toBe(esMontoCobrable(p))
    }
  })

  it("el desglose completo coincide en toda la rejilla precio × cantidad × descuento", () => {
    let combinaciones = 0
    for (const precio of precios) {
      for (const cantidad of cantidades) {
        for (const descuento_porcentaje of descuentos) {
          for (const descuento_min_boletos of minimos) {
            const evento = { precio, descuento_porcentaje, descuento_min_boletos }
            expect(deno.desglosePrecio(evento, cantidad)).toEqual(desglosePrecio(evento, cantidad))
            combinaciones++
          }
        }
      }
    }
    // Que la rejilla realmente se haya recorrido (si alguien la vacía por
    // accidente, esta prueba dejaría de proteger nada sin fallar).
    expect(combinaciones).toBe(precios.length * cantidades.length * descuentos.length * minimos.length)
  })

  it("las constantes del escalonado son idénticas en las dos copias", () => {
    expect(deno.ESCALONES_COMISION).toEqual([
      { desde: 0, hasta: 49, porcentaje: 0 },
      { desde: 50, hasta: 99, porcentaje: 0.05 },
      { desde: 100, hasta: 199, porcentaje: 0.08 },
      { desde: 200, hasta: Infinity, porcentaje: 0.10 },
    ])
    expect(deno.MINIMO_MP).toBe(MINIMO_MP)
  })
})
