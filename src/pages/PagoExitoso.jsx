import { useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../supabase"

export default function PagoExitoso() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const activarBoleto = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      console.log("usuario en pago exitoso:", user?.id)
      if (user) {
        const { data, error } = await supabase
          .from("boletos")
          .update({ estado: "activo" })
          .eq("usuario_id", user.id)
          .eq("estado", "pendiente_pago")
          .select()
        console.log("boletos actualizados:", data, "error:", error)
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