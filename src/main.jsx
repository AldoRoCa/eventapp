import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from "@sentry/react"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

// Quita datos personales antes de mandar un evento a Sentry: campos de
// usuario que el SDK pudiera adjuntar (email/ip) y cualquier email que
// aparezca en mensajes, breadcrumbs, extra, etc.
function limpiarPII(event) {
  if (event.user) {
    delete event.user.email
    delete event.user.username
    delete event.user.ip_address
  }
  const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const redactar = (obj, prof = 0) => {
    if (!obj || typeof obj !== "object" || prof > 6) return
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      if (typeof v === "string") obj[k] = v.replace(EMAIL, "[email-redactado]")
      else if (typeof v === "object") redactar(v, prof + 1)
    }
  }
  try { redactar(event) } catch { /* si la limpieza falla, mejor no perder el evento */ }
  return event
}

Sentry.init({
  dsn: "https://05e09a00446bcc42915def690405fe7d@o4511539764854784.ingest.us.sentry.io/4511539772784640",
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  beforeSend(event) {
    // No capturar nada en desarrollo (ruido + posibles datos locales).
    if (import.meta.env.DEV) return null
    return limpiarPII(event)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)