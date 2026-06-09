import { useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../supabase"

export default function PagoExitoso() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const activarBoleto = async () => {
      const evento_id = searchParams.get("evento_id")
      const usuario_id = searchParams.get("usuario_id")
      const status = searchParams.get("collection_status")
      const payment_id = searchParams.get("collection_id")

      if (usuario_id && evento_id && status === "approved") {
        await supabase
          .from("boletos")
          .update({ estado: "activo", mp_payment_id: payment_id || null })
          .eq("usuario_id", usuario_id)
          .eq("evento_id", evento_id)
          .eq("estado", "pendiente_pago")
      } else if (status !== "approved") {
        await supabase
          .from("boletos")
          .delete()
          .eq("usuario_id", usuario_id)
          .eq("evento_id", evento_id)
          .eq("estado", "pendiente_pago")
      }
      setTimeout(() => navigate("/mis-boletos"), 3000)
    }
    activarBoleto()
  }, [])

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "48px" }}>
        <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>✓</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>¡Pago exitoso!</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "15px", marginBottom: "8px" }}>Tu boleto ha sido confirmado.</p>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Redirigiendo a Mis Boletos...</p>
      </motion.div>
    </div>
  )
}