// Cálculo de comisiones y descuentos: FUENTE ÚNICA DE VERDAD del frontend.
//
// ⚠️ ESTE ARCHIVO TIENE UN GEMELO: supabase/functions/_shared/comision.ts
// Las Edge Functions son Deno y no pueden importar de src/, así que la misma
// matemática existe en dos lados. SI TOCAS UNO, TOCA EL OTRO — si divergen,
// el precio que ve el comprador deja de coincidir con lo que se le cobra.
// Hay una prueba (comisionUtils.test.js) que importa los dos y falla si dan
// resultados distintos; no la borres.
//
// Antes esto no se cumplía: 11 lugares del frontend calculaban "* 1.10" a mano
// y solo DesgloseGanancias importaba de aquí. Eso ya causó un bug real de
// comisión (10% calculado sobre un precio que ya traía 10% encima).
//
// Módulo puro (sin DOM, sin React): por eso es fácil de testear.

// ---------------------------------------------------------------------------
// Comisión de VELA: escalonada según el precio del boleto
// ---------------------------------------------------------------------------
// La paga el ASISTENTE (se suma encima del precio del anfitrión), no el
// anfitrión. Es escalonada con un principio: VELA cobra poco donde Mercado
// Pago ya cobra mucho. En un boleto de $30, la tarifa de MP ($4 fijos + IVA)
// ya se lleva ~16%; sumarle 10% de VELA lo volvía impagable. En boletos caros
// ese costo fijo pesa poco y el 10% sí cabe.
//
// El escalón lo decide el precio REAL del boleto — o sea el precio ya con
// descuento de paquete, si aplica. Regla única: "el escalón lo manda lo que
// realmente cuesta el boleto".
export const ESCALONES_COMISION = [
  { desde: 0, hasta: 49, porcentaje: 0 },
  { desde: 50, hasta: 99, porcentaje: 0.05 },
  { desde: 100, hasta: 199, porcentaje: 0.08 },
  { desde: 200, hasta: Infinity, porcentaje: 0.10 },
]

// Mercado Pago México rechaza cobros con tarjeta menores a $5 MXN
// (min_allowed_amount de todos los medios de tarjeta). Un cobro entre $0.01 y
// $4.99 hace que el checkout rechace la tarjeta en tiempo real.
export const MINIMO_MP = 5

// Tarifa estándar de Mercado Pago México (Checkout Pro, dinero al instante):
// 3.49% del monto cobrado + $4.00 MXN fijos por operación, todo con 16% de IVA.
// Verificada al centavo contra recibos reales (un cobro de $6 → cargo de $4.88).
// Esta tarifa SÍ sale del lado del anfitrión. Si MP cambia tarifas, se ajusta aquí.
export const MP_PORCENTAJE = 0.0349
export const MP_FIJO = 4
export const MP_IVA = 1.16

// Porcentaje de comisión que le toca a un precio (0, 0.05, 0.08 o 0.10).
export function porcentajeComision(precio) {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  const escalon = ESCALONES_COMISION.find(e => p >= e.desde && p <= e.hasta)
  return escalon ? escalon.porcentaje : 0
}

// Precio final que paga el asistente por un boleto: el precio del anfitrión más
// la comisión de VELA de su escalón. Se redondea a peso entero (es lo que se le
// cobra en Mercado Pago).
export function precioConComision(precio) {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  return Math.round(p * (1 + porcentajeComision(p)))
}

// Comisión de VELA en pesos (la diferencia entre lo que paga el asistente y el
// precio del anfitrión). La paga el asistente, no el anfitrión.
export function comisionVela(precio) {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  return precioConComision(p) - p
}

// ---------------------------------------------------------------------------
// Descuento por paquete
// ---------------------------------------------------------------------------
// El anfitrión configura "x% de descuento al comprar y boletos en la misma
// compra". Le sale barato porque el cargo fijo de MP ($4 + IVA = $4.64) se
// cobra UNA vez por compra, no por boleto: cada boleto extra en el mismo pago
// le ahorra exactamente $4.64.

// El descuento necesita un umbral de al menos 2 boletos (con 1 no sería un
// descuento por paquete, sería simplemente un precio más bajo).
export function aplicaDescuentoPaquete(cantidad, descuentoPorcentaje, descuentoMinBoletos) {
  const pct = Number(descuentoPorcentaje)
  const min = Number(descuentoMinBoletos)
  const cant = Number(cantidad)
  return (
    Number.isFinite(pct) && pct > 0 &&
    Number.isFinite(min) && min >= 2 &&
    Number.isFinite(cant) && cant >= min
  )
}

// Precio del anfitrión ya con el descuento aplicado, redondeado a peso entero.
// Con 100% de descuento da 0 (boleto gratis).
export function precioConDescuento(precio, descuentoPorcentaje) {
  const p = Number(precio)
  const pct = Number(descuentoPorcentaje)
  if (!Number.isFinite(p) || p <= 0) return 0
  if (!Number.isFinite(pct) || pct <= 0) return p
  return Math.max(0, Math.round(p * (1 - Math.min(pct, 100) / 100)))
}

// Un cobro solo es válido si es exactamente $0 (boleto gratis) o de $5 para
// arriba. La franja de $0.01 a $4.99 la rechaza Mercado Pago.
export function esMontoCobrable(monto) {
  const m = Number(monto)
  if (!Number.isFinite(m) || m < 0) return false
  return m === 0 || m >= MINIMO_MP
}

// Desglose completo de una compra. Recibe la fila del evento tal como viene de
// la base (mismos nombres de columna en el navegador y en las Edge Functions),
// así que las dos copias de esta matemática reciben exactamente lo mismo.
//
//   precioAnfitrion → lo que recibe el anfitrión por boleto (ya con descuento)
//   unitario        → lo que paga el asistente por boleto (con comisión)
//   total           → lo que se le cobra en Mercado Pago por toda la compra
//   ahorro          → cuánto se ahorró contra comprar sin descuento
export function desglosePrecio(evento, cantidad = 1) {
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

// Lo que el asistente pagó por un boleto que YA compró (para Mis Boletos y
// Perfil). Prefiere el monto real guardado al confirmar el pago; los boletos
// anteriores a la columna monto_pagado caen al precio de lista con comisión,
// que es lo que se les cobró en su momento.
//
// Solo existe aquí y no en _shared/comision.ts a propósito: es una función de
// presentación, y el servidor nunca muestra precios.
export function montoPagadoBoleto(boleto, evento) {
  const guardado = Number(boleto?.monto_pagado)
  if (boleto?.monto_pagado !== null && boleto?.monto_pagado !== undefined && Number.isFinite(guardado) && guardado >= 0) {
    return guardado
  }
  return precioConComision(evento?.precio)
}

// ---------------------------------------------------------------------------
// Tarifa de Mercado Pago (la paga el anfitrión)
// ---------------------------------------------------------------------------

// Sobre el monto REALMENTE cobrado al asistente, que es la base sobre la que MP
// aplica su porcentaje.
export function cargoMercadoPagoSobreCobro(montoCobrado) {
  const m = Number(montoCobrado)
  if (!Number.isFinite(m) || m <= 0) return 0
  return (m * MP_PORCENTAJE + MP_FIJO) * MP_IVA
}

// Tarifa de MP para un boleto de este precio, comprado solo.
export function cargoMercadoPago(precio) {
  return cargoMercadoPagoSobreCobro(precioConComision(precio))
}

// Lo que le queda neto al anfitrión por cada boleto, ya descontada la tarifa de
// Mercado Pago (la comisión de VELA no se le descuenta: la pagó el asistente).
export function gananciaNetaBoleto(precio) {
  const p = Number(precio)
  if (!Number.isFinite(p) || p <= 0) return 0
  return p - cargoMercadoPago(p)
}
