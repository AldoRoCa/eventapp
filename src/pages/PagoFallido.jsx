import { motion } from "framer-motion"
import { Link } from "react-router-dom"

export default function PagoFallido() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "white" }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "48px" }}>
        <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: "36px" }}>✕</div>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>Pago cancelado</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "15px", marginBottom: "24px" }}>No se realizó ningún cargo. Puedes intentarlo de nuevo.</p>
        <Link to="/" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", borderRadius: "12px", color: "white", padding: "12px 28px", fontWeight: 600, fontSize: "14px", textDecoration: "none", display: "inline-block" }}>Volver al inicio</Link>
      </motion.div>
    </div>
  )
}