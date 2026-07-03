// Lógica de tiempo de vida de un evento, compartida entre todas las
// páginas. Antes esto estaba hardcodeado a "5 horas" en 6 lugares
// distintos del código — ahora cada evento define su propia duración
// (duracion_horas) y, opcionalmente, una ventana de registro/entrada
// distinta (tiempo_registro_horas). Si esta última no se define, se usa
// la misma duración del evento.

export function horasDuracion(evento) {
  return evento?.duracion_horas ?? 5
}

export function horasRegistro(evento) {
  return evento?.tiempo_registro_horas ?? horasDuracion(evento)
}

// Un evento se considera finalizado cuando pasó su hora de inicio más su
// duración. A partir de eso: desaparece de "Explorar", su estatus en el
// Panel de Anfitrión cambia a "Finalizado", y sus boletos se muestran
// como "Usado" en Mis Boletos.
export function eventoFinalizado(evento) {
  if (!evento?.fecha) return false
  return new Date(evento.fecha).getTime() + horasDuracion(evento) * 60 * 60 * 1000 < Date.now()
}

// La ventana de registro/entrada es solo informativa (no bloquea el
// check-in): indica hasta qué hora se espera que sigan llegando
// asistentes, para que el anfitrión lo tenga como referencia.
export function registroFinalizado(evento) {
  if (!evento?.fecha) return false
  return new Date(evento.fecha).getTime() + horasRegistro(evento) * 60 * 60 * 1000 < Date.now()
}
