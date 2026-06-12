import { useState } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleLogin = async () => {
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError("Correo o contraseña incorrectos")
    } else {
      navigate("/")
    }
    setLoading(false)
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "12px",
    padding: "12px 16px", color: "white", fontSize: "14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    boxShadow: "0 0 0 1px rgba(124,58,237,0.08) inset, 0 2px 8px rgba(0,0,0,0.3)",
    transition: "border 0.2s"
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", background: "radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.12) 0%, #080808 60%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "24px" }}>

      {/* Glow central */}
      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: "700px", height: "400px", background: "radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: "24px", padding: "40px", position: "relative", boxShadow: "0 0 0 1px rgba(124,58,237,0.08), 0 32px 64px rgba(0,0,0,0.4)" }}
      >
        {/* Glow interior sutil */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "200px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)", borderRadius: "999px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px", justifyContent: "center" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "white" }}>VELA</span>
        </div>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "white", marginBottom: "8px", letterSpacing: "-0.5px", textAlign: "center" }}>Bienvenido de vuelta</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "32px", textAlign: "center", fontWeight: 400 }}>Inicia sesión para continuar</p>

        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#f87171", fontSize: "13.5px" }}
          >{error}</motion.div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" style={inputStyle} />
        </div>

        <div style={{ marginBottom: "28px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} style={inputStyle} />
        </div>

        <motion.button onClick={handleLogin} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={loading}
          className="btn-3d"
          style={{ width: "100%", border: "none", borderRadius: "12px", color: "white", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
        >{loading ? "Iniciando sesión..." : "Iniciar sesión"}</motion.button>

        <p style={{ textAlign: "center", marginTop: "24px", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
          ¿No tienes cuenta?{" "}
          <Link to="/registro" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>Regístrate</Link>
        </p>

        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <Link to="/" style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Volver al inicio
          </Link>
        </div>
      </motion.div>
    </div>
  )
}