import { describe, it, expect } from "vitest"
import {
  precioConComision,
  comisionVela,
  cargoMercadoPago,
  gananciaNetaBoleto,
  COMISION_VELA,
} from "./comisionUtils"

describe("comisión de VELA (10%, la paga el asistente)", () => {
  it("agrega 10% al precio del anfitrión, redondeado a peso", () => {
    expect(precioConComision(100)).toBe(110)
    expect(precioConComision(500)).toBe(550)
    // $5 (mínimo de MP) → el asistente paga $6 (round(5.5))
    expect(precioConComision(5)).toBe(6)
  })

  it("la comisión es la diferencia entre lo que paga el asistente y el precio del anfitrión", () => {
    expect(comisionVela(100)).toBe(10)
    expect(comisionVela(5)).toBe(1)
  })

  it("COMISION_VELA es el 10%", () => {
    expect(COMISION_VELA).toBe(0.10)
  })
})

describe("tarifa de Mercado Pago (la paga el anfitrión)", () => {
  it("coincide con el recibo real: venta de $6 → cargo de $4.88", () => {
    // precio del anfitrión $5 → el asistente paga $6 → MP cobra ~$4.88.
    expect(cargoMercadoPago(5)).toBeCloseTo(4.88, 2)
  })

  it("como proporción, el cargo baja mucho en precios reales", () => {
    // En $500 el cargo fijo de $4 pesa poco: la tarifa queda en ~5% del precio.
    const cargo = cargoMercadoPago(500)
    expect(cargo / 500).toBeLessThan(0.06)
  })
})

describe("ganancia neta del anfitrión por boleto", () => {
  it("en montos chicos el cargo fijo de MP se come casi todo", () => {
    // $5: gana centavos (documentado). La comisión de VELA NO se le descuenta.
    expect(gananciaNetaBoleto(5)).toBeCloseTo(5 - cargoMercadoPago(5), 6)
    expect(gananciaNetaBoleto(5)).toBeLessThan(1)
  })

  it("en precios reales conserva la mayor parte del precio", () => {
    expect(gananciaNetaBoleto(500)).toBeGreaterThan(470)
  })
})
