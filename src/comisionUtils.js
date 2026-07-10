// Cálculo de comisiones, fuente única de verdad.
//
// Antes, el "+10%" de VELA y la tarifa de Mercado Pago vivían calculados a mano
// en varios lugares (Evento.jsx, DesgloseGanancias.jsx, la Edge Function
// crear-pago-mp). Eso ya causó un bug real: dos cálculos independientes del 10%
// que coincidían por redondeo en montos chicos pero divergían en grandes.
// Centralizar la matemática aquí evita que se vuelvan a separar.
//
// Módulo puro (sin DOM, sin React): por eso es fácil de testear.

// 10% que VELA suma al precio del anfitrión. Lo paga el ASISTENTE (se agrega
// encima del precio), no el anfitrión.
export const COMISION_VELA = 0.10

// Tarifa estándar de Mercado Pago México (Checkout Pro, dinero al instante):
// 3.49% del monto cobrado + $4.00 MXN fijos por operación, todo con 16% de IVA.
// Verificada al centavo contra recibos reales (venta de $6 → cargo de $4.88).
// Esta tarifa SÍ sale del lado del anfitrión. Si MP cambia tarifas, se ajusta aquí.
export const MP_PORCENTAJE = 0.0349
export const MP_FIJO = 4
export const MP_IVA = 1.16

// Precio final que paga el asistente: el precio del anfitrión + la comisión de
// VELA. Se redondea a peso entero (es lo que se le cobra en Mercado Pago).
export function precioConComision(precioAnfitrion) {
  return Math.round(precioAnfitrion * (1 + COMISION_VELA))
}

// Comisión de VELA en pesos (la diferencia entre lo que paga el asistente y el
// precio del anfitrión). La paga el asistente, no el anfitrión.
export function comisionVela(precioAnfitrion) {
  return precioConComision(precioAnfitrion) - precioAnfitrion
}

// Tarifa que Mercado Pago le cobra al anfitrión por procesar el pago. Se calcula
// sobre el monto REALMENTE cobrado al asistente (precioConComision), que es la
// base sobre la que MP aplica su porcentaje.
export function cargoMercadoPago(precioAnfitrion) {
  const cobrado = precioConComision(precioAnfitrion)
  return (cobrado * MP_PORCENTAJE + MP_FIJO) * MP_IVA
}

// Lo que le queda neto al anfitrión por cada boleto, ya descontada la tarifa de
// Mercado Pago (la comisión de VELA no se le descuenta: la pagó el asistente).
export function gananciaNetaBoleto(precioAnfitrion) {
  return precioAnfitrion - cargoMercadoPago(precioAnfitrion)
}
