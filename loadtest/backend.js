// Test de carga del BACKEND real (Supabase/PostgREST), que es lo que se
// satura con usuarios concurrentes — el HTML de Vercel viene de un CDN y
// escala solo. Simula el patrón de un usuario navegando: abre la home
// (consulta de eventos con conteo de asistentes), luego abre un evento
// (detalle + conteo de boletos activos).
// Correr con: & "C:\Program Files\k6\k6.exe" run loadtest/backend.js
import http from 'k6/http'
import { sleep, check } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // calentamiento
    { duration: '1m', target: 150 },   // sube a 150 usuarios simultáneos
    { duration: '1m', target: 150 },   // sostiene 150
    { duration: '30s', target: 0 },    // baja
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% de requests < 2 segundos
    http_req_failed: ['rate<0.05'],    // menos del 5% de errores
  },
}

const SUPABASE_URL = 'https://jvjngaxpqdeababfxecp.supabase.co'
// Publishable key (misma que usa el navegador; no es un secreto)
const KEY = 'sb_publishable_uglG9QxSBBwVAWMyFCyxiw_IheVeC0l'
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

export default function () {
  // 1. Home: eventos futuros con conteo de asistentes (consulta nueva)
  const fecha = new Date().toISOString()
  const home = http.get(
    `${SUPABASE_URL}/rest/v1/eventos?select=*,profiles(nombre),boletos(count)&boletos.estado=eq.activo&fecha=gte.${fecha}&order=fecha.asc`,
    { headers: HEADERS, tags: { name: 'home_eventos' } }
  )
  check(home, { 'home eventos 200': (r) => r.status === 200 })

  sleep(Math.random() * 2 + 1)

  // 2. Explorar: mismos eventos sin filtro de futuro estricto
  const explorar = http.get(
    `${SUPABASE_URL}/rest/v1/eventos?select=*,profiles(nombre),boletos(count)&boletos.estado=eq.activo&fecha=gte.${new Date(Date.now() - 86400000).toISOString()}&order=fecha.asc`,
    { headers: HEADERS, tags: { name: 'explorar_eventos' } }
  )
  check(explorar, { 'explorar 200': (r) => r.status === 200 })

  sleep(Math.random() * 2 + 1)

  // 3. Detalle de un evento (como Evento.jsx): primer evento que exista
  const lista = explorar.json()
  if (Array.isArray(lista) && lista.length > 0) {
    const id = lista[0].id
    const detalle = http.get(
      `${SUPABASE_URL}/rest/v1/eventos?select=id,titulo,descripcion,categoria,fecha,ubicacion,capacidad,precio,tipo_boleto,imagen_url,anfitrion_id,profiles(nombre,avatar_url)&id=eq.${id}`,
      { headers: HEADERS, tags: { name: 'evento_detalle' } }
    )
    check(detalle, { 'detalle 200': (r) => r.status === 200 })

    const conteo = http.get(
      `${SUPABASE_URL}/rest/v1/boletos?select=id&evento_id=eq.${id}&estado=eq.activo`,
      { headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' }, tags: { name: 'conteo_asistentes' } }
    )
    check(conteo, { 'conteo ok': (r) => r.status === 200 || r.status === 206 })
  }

  sleep(Math.random() * 2 + 1)
}
