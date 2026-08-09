import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../supabase"

export default function PagoExitoso() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [estado, setEstado] = useState("verificando") // verificando | confirmado | pendiente | reembolsado | error

  useEffect(() => {
    const activarBoleto = async () => {
      const evento_id = searchParams.get("evento_id")
      const payment_id = searchParams.get("collection_id")
      let resultado = "error"

      const { data: { session } } = await supabase.auth.getSession()
      if (session && evento_id && payment_id) {
        // El estado real del pago se verifica del lado del servidor contra
        // la API de Mercado Pago — nunca se confía en el query param de la URL.
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirmar-pago-mp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ evento_id, payment_id })
          })
          const data = await res.json().catch(() => ({}))
          // "reembolsado": el detector de liberación inmediata devolvió el
          // pago automáticamente (ver _shared/liberacion.ts) — decírselo al
          // comprador con la verdad, no con un "pago exitoso" falso.
          if (res.ok) resultado = data.estado === "pendiente" ? "pendiente" : data.estado === "reembolsado" ? "reembolsado" : "confirmado"
        } catch {
          resultado = "error"
        }
      }
      setEstado(resultado)
      // Los mensajes de solicitud pendiente y de reembolso son más largos;
      // dar tiempo de leerlos
      setTimeout(() => navigate("/mis-boletos"), resultado === "pendiente" ? 5000 : resultado === "reembolsado" ? 8000 : 3000)
    }
    activarBoleto()
  }, [navigate, searchParams])

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "48px" }}>
        {estado === "error" ? (
          <>
            <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>⚠</div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>No pudimos confirmar tu pago</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "8px" }}>Si el cargo se realizó, tu boleto se activará en unos minutos. Si no aparece en Mis Boletos, contáctanos.</p>
          </>
        ) : estado === "reembolsado" ? (
          <>
            <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>↩</div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>Tu pago fue devuelto</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "8px" }}>El pago se procesó, pero se reembolsó automáticamente: las ventas de este organizador están pausadas por una revisión de seguridad de su cuenta de cobro. El dinero volverá a tu método de pago; el tiempo exacto depende de tu banco.</p>
          </>
        ) : estado === "pendiente" ? (
          <>
            <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>⏳</div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>¡Pago recibido!</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "8px" }}>Este evento es por solicitud: el anfitrión debe aprobar tu boleto. Si lo rechaza, se te reembolsará automáticamente.</p>
          </>
        ) : (
          <>
            <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>✓</div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>¡Pago exitoso!</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "15px", marginBottom: "8px" }}>Tu boleto ha sido confirmado.</p>
          </>
        )}
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Redirigiendo a Mis Boletos...</p>
      </motion.div>
    </div>
  )
}