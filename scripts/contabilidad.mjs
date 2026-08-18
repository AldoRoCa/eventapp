// Hoja de conciliación contable de VELA — corre en tu PC, no en el servidor.
//
//   npm run contabilidad            (conciliación completa, consulta Mercado Pago)
//   npm run contabilidad -- --sin-mp   (solo contra nuestra base, mucho más rápido)
//
// Qué contesta: por cada operación, cuánto se DEBÍA cobrar y cuánto se cobró
// REALMENTE, cuánto le tocaba a VELA y cuánto recibió, y cuánto acabó en el
// bolsillo del anfitrión. Los renglones que no cuadran salen marcados para que
// se puedan ver de un vistazo en Excel.
//
// De dónde sale cada cosa:
//   • Lo ESPERADO se calcula con src/comisionUtils.js — exactamente el mismo
//     código que usa la app para cobrar. Si alguien alterara la matemática, el
//     esperado cambiaría igual que el cobro y no se notaría; por eso el
//     esperado se compara contra Mercado Pago, que es la fuente independiente.
//   • Lo REAL sale de la API de Mercado Pago (transaction_amount, fee_details,
//     net_received_amount). Eso es lo que hace que esto sirva para detectar un
//     cobro alterado: MP no miente a favor de nadie.
//
// Genera un archivo por mes en contabilidad/ (2026-08.csv, 2026-09.csv...) más
// un resumen.csv con los totales de cada mes. Se abren directo en Excel.
//
// LÍMITES QUE HAY QUE TENER PRESENTES:
//   • Un evento CANCELADO se borra de la base junto con sus boletos, así que
//     desaparece de esta conciliación. Sus movimientos siguen en Mercado Pago,
//     pero de nuestro lado ya no hay con qué compararlos.
//   • Lo esperado usa el precio ACTUAL del evento. Si el anfitrión cambió el
//     precio después de vender, el descuadre es legítimo y no un robo.
//   • Los boletos regalados (descuento del 100%) no tienen pago, así que no
//     aparecen como renglones; van contados aparte en el resumen.

import { createClient } from "@supabase/supabase-js"
import { mkdirSync, writeFileSync } from "node:fs"
import { desglosePrecio } from "../src/comisionUtils.js"

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY
const CONSULTAR_MP = !process.argv.includes("--sin-mp")
const CARPETA = "contabilidad"

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(`
Faltan credenciales. Agrega a tu archivo .env (que NO se sube a git):

  SERVICE_ROLE_KEY=...

La encuentras en Supabase → Project Settings → API → service_role.
OJO: esa llave abre la base completa, sin RLS. Va SIN el prefijo VITE_ para
que Vite no la incluya en el sitio publicado.
`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Un dato que no se pudo calcular debe quedar VACÍO, no en 0.00: un cero
// parecería "esperábamos cobrar nada y cuadró", que es justo lo contrario de
// "no sabemos". Ojo con Number(null) === 0, que es de donde venía la confusión.
const pesos = (n) => {
  if (n === null || n === undefined || n === "") return ""
  return Number.isFinite(Number(n)) ? Number(n).toFixed(2) : ""
}
const mes = (fecha) => (fecha ? String(fecha).slice(0, 7) : "sin-fecha")

// Excel en Windows abre los CSV en ANSI y destroza los acentos si no ve el BOM.
const BOM = "﻿"
const celda = (v) => {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const aCSV = (filas) => BOM + filas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n"

// ---------------------------------------------------------------------------
// 1. Traer todo lo nuestro
// ---------------------------------------------------------------------------
console.log("Leyendo la base…")

const { data: boletos, error: errBoletos } = await supabase
  .from("boletos")
  .select("id, evento_id, usuario_id, estado, monto_pagado, mp_payment_id, created_at")
  .not("mp_payment_id", "is", null)
  .order("created_at", { ascending: true })

if (errBoletos) {
  console.error("No se pudieron leer los boletos:", errBoletos.message)
  process.exit(1)
}

const { data: gratis } = await supabase
  .from("boletos")
  .select("id", { count: "exact", head: false })
  .is("mp_payment_id", null)
  .in("estado", ["activo", "pendiente"])

const { data: eventos } = await supabase
  .from("eventos")
  .select("id, titulo, precio, descuento_porcentaje, descuento_min_boletos, anfitrion_id")

const { data: perfiles } = await supabase.from("profiles").select("id, nombre")

const eventoPorId = new Map((eventos || []).map((e) => [e.id, e]))
const nombrePorId = new Map((perfiles || []).map((p) => [p.id, p.nombre]))

// ---------------------------------------------------------------------------
// 2. Agrupar por PAGO, que es la unidad real de Mercado Pago
// ---------------------------------------------------------------------------
// Una compra de N boletos es un solo pago: conciliar por boleto daría N veces
// el mismo movimiento y ningún total cuadraría.
const pagos = new Map()
for (const b of boletos || []) {
  const id = String(b.mp_payment_id)
  if (!pagos.has(id)) pagos.set(id, [])
  pagos.get(id).push(b)
}

console.log(`${pagos.size} operaciones a conciliar (${(boletos || []).length} boletos).`)
if (!CONSULTAR_MP) console.log("Modo --sin-mp: no se consultará Mercado Pago.")

// ---------------------------------------------------------------------------
// 3. Tokens de MP por anfitrión (solo si vamos a consultar)
// ---------------------------------------------------------------------------
const tokenPorAnfitrion = new Map()
if (CONSULTAR_MP) {
  const { data: credenciales } = await supabase
    .from("mp_credenciales")
    .select("id, mp_access_token")
  for (const c of credenciales || []) tokenPorAnfitrion.set(c.id, c.mp_access_token)
}

async function consultarPago(paymentId, anfitrionId) {
  const token = tokenPorAnfitrion.get(anfitrionId)
  if (!token) return { error: "el anfitrión no tiene Mercado Pago conectado" }
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return { error: `Mercado Pago respondió ${r.status}` }
    const p = await r.json()
    const fees = p.fee_details || []
    const busca = (tipo) => fees.find((f) => f.type === tipo)?.amount ?? null
    return {
      cobrado: p.transaction_amount,
      reembolsado: p.transaction_amount_refunded ?? 0,
      // application_fee es la comisión de VELA (el marketplace_fee que puso
      // crear-pago-mp); mercadopago_fee es lo que cobra MP por procesar.
      comisionVela: busca("application_fee"),
      tarifaMP: busca("mercadopago_fee"),
      netoAnfitrion: p.transaction_details?.net_received_amount ?? null,
      estado: p.status,
      fecha: p.date_approved || p.date_created,
    }
  } catch (e) {
    return { error: `error de red: ${e.message}` }
  }
}

// ---------------------------------------------------------------------------
// 4. Conciliar operación por operación
// ---------------------------------------------------------------------------
const filasPorMes = new Map()
const totales = new Map()
let descuadres = 0
let sinVerificar = 0
let procesados = 0

for (const [paymentId, delPago] of pagos) {
  procesados++
  if (procesados % 25 === 0) console.log(`  ${procesados}/${pagos.size}…`)

  const evento = eventoPorId.get(delPago[0].evento_id)
  const cantidad = delPago.length

  // Lo que se DEBÍA cobrar, con la misma matemática de la app.
  const esperado = evento ? desglosePrecio(evento, cantidad) : null
  const esperadoTotal = esperado ? esperado.total : null
  const esperadoVela = esperado ? (esperado.unitario - esperado.precioAnfitrion) * cantidad : null

  // Lo que dice nuestra base que se cobró (suma de lo guardado por boleto).
  const registrado = delPago.reduce((t, b) => t + (Number(b.monto_pagado) || 0), 0)

  const mp = CONSULTAR_MP ? await consultarPago(paymentId, evento?.anfitrion_id) : { error: "no consultado" }
  if (mp.error) sinVerificar++

  // El cobro real: el de MP si se pudo consultar; si no, lo que registramos.
  const cobradoReal = mp.error ? registrado : mp.cobrado
  const diferencia = esperadoTotal === null || cobradoReal === null || cobradoReal === undefined
    ? null
    : Math.round((cobradoReal - esperadoTotal) * 100) / 100

  const reembolsado = Number(mp.reembolsado) || 0
  const estadoPago = mp.error ? "" : mp.estado

  let alerta = "OK"
  if (!evento) alerta = "EVENTO BORRADO"
  else if (mp.error) alerta = `SIN VERIFICAR (${mp.error})`
  else if (diferencia !== null && diferencia !== 0) alerta = "DESCUADRE"
  else if (reembolsado > 0) alerta = estadoPago === "refunded" ? "reembolsado" : "reembolso parcial"
  if (alerta === "DESCUADRE") descuadres++

  const fechaRef = (mp.fecha || delPago[0].created_at || "").slice(0, 10)
  const m = mes(mp.fecha || delPago[0].created_at)

  if (!filasPorMes.has(m)) filasPorMes.set(m, [])
  filasPorMes.get(m).push([
    fechaRef,
    evento?.titulo ?? "(evento borrado)",
    nombrePorId.get(evento?.anfitrion_id) ?? "",
    cantidad,
    evento?.precio ?? "",
    esperado?.aplicaDescuento ? `${evento.descuento_porcentaje}% desde ${evento.descuento_min_boletos}` : "",
    pesos(esperadoTotal),
    pesos(cobradoReal),
    pesos(diferencia),
    pesos(esperadoVela),
    pesos(mp.comisionVela),
    pesos(mp.tarifaMP),
    pesos(mp.netoAnfitrion),
    pesos(reembolsado),
    estadoPago,
    delPago.map((b) => b.estado).join(" / "),
    paymentId,
    alerta,
  ])

  const t = totales.get(m) || { operaciones: 0, boletos: 0, esperado: 0, cobrado: 0, vela: 0, tarifaMP: 0, neto: 0, reembolsado: 0, descuadres: 0 }
  t.operaciones++
  t.boletos += cantidad
  t.esperado += esperadoTotal || 0
  t.cobrado += cobradoReal || 0
  t.vela += Number(mp.comisionVela) || 0
  t.tarifaMP += Number(mp.tarifaMP) || 0
  t.neto += Number(mp.netoAnfitrion) || 0
  t.reembolsado += reembolsado
  if (alerta === "DESCUADRE") t.descuadres++
  totales.set(m, t)
}

// ---------------------------------------------------------------------------
// 5. Escribir los archivos
// ---------------------------------------------------------------------------
mkdirSync(CARPETA, { recursive: true })

const ENCABEZADO = [
  "fecha", "evento", "anfitrion", "boletos", "precio_lista", "descuento",
  "esperado_total", "cobrado_real", "diferencia",
  "vela_esperado", "vela_real", "tarifa_mp", "neto_anfitrion",
  "reembolsado", "estado_pago", "estado_boletos", "payment_id", "alerta",
]

for (const [m, filas] of [...filasPorMes].sort()) {
  writeFileSync(`${CARPETA}/${m}.csv`, aCSV([ENCABEZADO, ...filas]), "utf8")
  console.log(`  → ${CARPETA}/${m}.csv (${filas.length} operaciones)`)
}

const resumen = [[
  "mes", "operaciones", "boletos", "esperado_total", "cobrado_real", "diferencia",
  "vela_real", "tarifa_mp", "neto_anfitriones", "reembolsado", "descuadres",
]]
for (const [m, t] of [...totales].sort()) {
  resumen.push([
    m, t.operaciones, t.boletos, pesos(t.esperado), pesos(t.cobrado),
    pesos(t.cobrado - t.esperado), pesos(t.vela), pesos(t.tarifaMP),
    pesos(t.neto), pesos(t.reembolsado), t.descuadres,
  ])
}
writeFileSync(`${CARPETA}/resumen.csv`, aCSV(resumen), "utf8")

console.log(`  → ${CARPETA}/resumen.csv`)
console.log("")
console.log(`Operaciones conciliadas: ${pagos.size}`)
console.log(`Boletos sin pago (gratis o regalados): ${(gratis || []).length}`)
if (sinVerificar > 0) console.log(`Sin verificar contra Mercado Pago: ${sinVerificar}`)
console.log(descuadres > 0
  ? `\n⚠️  ${descuadres} operación(es) NO cuadran. Búscalas por "DESCUADRE" en la columna alerta.`
  : `\n✅ Todo cuadra: lo cobrado coincide con lo que debía cobrarse en todas las operaciones.`)
