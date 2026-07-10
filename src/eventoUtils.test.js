import { describe, it, expect } from "vitest"
import {
  horasDuracion,
  horasRegistro,
  eventoFinalizado,
  registroFinalizado,
} from "./eventoUtils"

const HORA = 60 * 60 * 1000

// Helper: una fecha a N horas del ahora (negativo = en el pasado).
const haceHoras = (n) => new Date(Date.now() + n * HORA).toISOString()

describe("horasDuracion / horasRegistro", () => {
  it("usa 5 horas por defecto cuando no se define la duración", () => {
    expect(horasDuracion({})).toBe(5)
    expect(horasDuracion(null)).toBe(5)
  })

  it("respeta la duración definida por el evento", () => {
    expect(horasDuracion({ duracion_horas: 3 })).toBe(3)
  })

  it("la ventana de registro cae de vuelta a la duración si no se define", () => {
    expect(horasRegistro({ duracion_horas: 8 })).toBe(8)
    expect(horasRegistro({ duracion_horas: 8, tiempo_registro_horas: 2 })).toBe(2)
  })
})

describe("eventoFinalizado", () => {
  it("es falso sin fecha", () => {
    expect(eventoFinalizado({})).toBe(false)
  })

  it("un evento futuro no está finalizado", () => {
    expect(eventoFinalizado({ fecha: haceHoras(2), duracion_horas: 3 })).toBe(false)
  })

  it("un evento que empezó hace más que su duración está finalizado", () => {
    // empezó hace 4h, dura 3h → terminó hace 1h.
    expect(eventoFinalizado({ fecha: haceHoras(-4), duracion_horas: 3 })).toBe(true)
  })

  it("dentro de su ventana de duración sigue activo", () => {
    // empezó hace 1h, dura 5h → aún faltan 4h.
    expect(eventoFinalizado({ fecha: haceHoras(-1), duracion_horas: 5 })).toBe(false)
  })
})

describe("registroFinalizado", () => {
  it("usa su propia ventana de registro cuando se define", () => {
    // empezó hace 3h; registro de 2h → ya cerró; duración de 10h → evento sigue vivo.
    const evento = { fecha: haceHoras(-3), duracion_horas: 10, tiempo_registro_horas: 2 }
    expect(registroFinalizado(evento)).toBe(true)
    expect(eventoFinalizado(evento)).toBe(false)
  })
})
