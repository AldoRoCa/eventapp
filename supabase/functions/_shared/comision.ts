// Cálculo de comisiones y descuentos para las Edge Functions.
//
// ⚠️ ESTE ARCHIVO ES EL GEMELO DE src/comisionUtils.js
// Las Edge Functions son Deno y no pueden importar de src/, así que la misma
// matemática existe en dos lados. SI TOCAS UNO, TOCA EL OTRO — si divergen, el
// precio que ve el comprador en la página deja de coincidir con lo que se le
// cobra en Mercado Pago. La prueba de paridad vive en src/comisionUtils.test.js
// (importa este archivo y el otro y compara resultados); córrela con `npm test`
// después de cualquier cambio aquí.
//
// A propósito NO usa nada de Deno (ni Deno.env, ni fetch, ni supabase): es
// matemática pura, para que Vitest lo pueda importar tal cual desde Node.
//
// Quién manda: de estas dos copias, la que decide lo que REALMENTE se cobra es
// esta (la usa crear-pago-mp con datos leídos de la base). La del frontend solo
// muestra.

export const ESCALONES_COMISION = [
  { desde: 0, hasta: 49, porcentaje: 0 },
  { desde: 50, hasta: 99, porcentaje: 0.05 },
  { desde: 100, hasta: 199, porcentaje: 0.08 },
  { desde: 200, hasta: Infinity, porcentaje: 0.10 },
]

// Mercado Pago México rechaza cobros con tarjeta menores a $5 MXN.
export const MINIMO_MP = 5

export const MP_PORCENTAJE = 0.0349
export const MP_FIJO = 4
export const MP_IVA = 1.16

export type EventoPrecio = {
  precio?: number | null
  descuento_porcentaje?: number | null
  descuento_min_boletos?: number | null
}

export type DesglosePrecio = {
  aplicaDescuento: boolean
  cantidad: number
  precioAnfitrion: number
  unitario: number
  total: number
  unitarioSinDescuento: number
  ahorro: number
  gratis: boolean
  cobrable: boolean
}

export function porcentajeComision(precio: number | null | undefined): number {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  const escalon = ESCALONES_COMISION.find(e => p >= e.desde && p <= e.hasta)
  return escalon ? escalon.porcentaje : 0
}

export function precioConComision(precio: number | null | undefined): number {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  return Math.round(p * (1 + porcentajeComision(p)))
}

export function comisionVela(precio: number | null | undefined): number {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  return precioConComision(p) - p
}

export function aplicaDescuentoPaquete(
  cantidad: number | null | undefined,
  descuentoPorcentaje: number | null | undefined,
  descuentoMinBoletos: number | null | undefined,
): boolean {
  const pct = Number(descuentoPorcentaje)
  const min = Number(descuentoMinBoletos)
  const cant = Number(cantidad)
  return (
    Number.isFinite(pct) && pct > 0 &&
    Number.isFinite(min) && min >= 2 &&
    Number.isFinite(cant) && cant >= min
  )
}

export function precioConDescuento(
  precio: number | null | undefined,
  descuentoPorcentaje: number | null | undefined,
): number {
  const p = Number(precio)
  const pct = Number(descuentoPorcentaje)
  if (!Number.isFinite(p) || p <= 0) return 0
  if (!Number.isFinite(pct) || pct <= 0) return p
  return Math.max(0, Math.round(p * (1 - Math.min(pct, 100) / 100)))
}

// Un cobro solo es válido si es exactamente $0 (boleto gratis) o de $5 para
// arriba. La franja de $0.01 a $4.99 la rechaza Mercado Pago.
export function esMontoCobrable(monto: number | null | undefined): boolean {
  const m = Number(monto)
  if (!Number.isFinite(m) || m < 0) return false
  return m === 0 || m >= MINIMO_MP
}

export function desglosePrecio(evento: EventoPrecio | null | undefined, cantidad: number = 1): DesglosePrecio {
  const cant = Math.max(1, Math.floor(Number(cantidad) || 1))
  const precio = Number(evento?.precio) || 0
  const aplica = aplicaDescuentoPaquete(cant, evento?.descuento_porcentaje, evento?.descuento_min_boletos)
  const precioAnfitrion = aplica ? precioConDescuento(precio, evento?.descuento_porcentaje) : precio
  const unitario = precioConComision(precioAnfitrion)
  const unitarioSinDescuento = precioConComision(precio)
  return {
    aplicaDescuento: aplica,
    cantidad: cant,
    precioAnfitrion,
    unitario,
    total: unitario * cant,
    unitarioSinDescuento,
    ahorro: (unitarioSinDescuento - unitario) * cant,
    gratis: unitario === 0,
    cobrable: esMontoCobrable(unitario),
  }
}

export function cargoMercadoPagoSobreCobro(montoCobrado: number | null | undefined): number {
  const m = Number(montoCobrado)
  if (!Number.isFinite(m) || m <= 0) return 0
  return (m * MP_PORCENTAJE + MP_FIJO) * MP_IVA
}

export function cargoMercadoPago(precio: number | null | undefined): number {
  return cargoMercadoPagoSobreCobro(precioConComision(precio))
}

export function gananciaNetaBoleto(precio: number | null | undefined): number {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  return p - cargoMercadoPago(p)
}
