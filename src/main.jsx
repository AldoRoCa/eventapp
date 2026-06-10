import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from "@sentry/react"
import './index.css'
import App from './App.jsx'

Sentry.init({
  dsn: "https://05e09a00446bcc42915def690405fe7d@o4511539764854784.ingest.us.sentry.io/4511539772784640",
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)