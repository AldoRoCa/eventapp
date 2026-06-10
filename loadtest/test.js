import http from 'k6/http'
import { sleep, check } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // sube a 10 usuarios en 30s
    { duration: '1m', target: 50 },   // sube a 50 usuarios en 1 min
    { duration: '30s', target: 0 },   // baja a 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% de requests < 2 segundos
    http_req_failed: ['rate<0.05'],    // menos del 5% de errores
  },
}

const BASE_URL = 'https://eventapp-flax.vercel.app'

export default function () {
  // Test página principal
  const home = http.get(BASE_URL)
  check(home, { 'home status 200': (r) => r.status === 200 })

  sleep(1)

  // Test página explorar
  const explorar = http.get(`${BASE_URL}/explorar`)
  check(explorar, { 'explorar status 200': (r) => r.status === 200 })

  sleep(1)
}