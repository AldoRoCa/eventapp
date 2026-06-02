import { useState } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

export default function Registro() {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleRegistro = async () => {
    setLoading(true)
    setError("")
    if (!nombre || !email || !password) {
      setError("Por favor llena todos los campos")
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setLoading(false)
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } }
    })
    if (error) {
      setError("Error al crear la cuenta. Intenta con otro correo.")
    } else {
      navigate("/")
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "24px" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "40px", position: "relative" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px", justifyContent: "center" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(124,58,237,0.45)" }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "white" }}>VELA</span>
        </div>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "white", marginBottom: "8px", letterSpacing: "-0.5px", textAlign: "center" }}>Crea tu cuenta</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "32px", textAlign: "center", fontWeight: 400 }}>Empieza a descubrir eventos</p>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#f87171", fontSize: "13.5px" }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre"
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 16px", color: "white", fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 16px", color: "white", fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "13.5px", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            onKeyDown={e => e.key === "Enter" && handleRegistro()}
            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 16px", color: "white", fontSize: "14px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        <motion.button
          onClick={handleRegistro}
          whileHover={{ opacity: 0.9 }}
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          style={{ width: "100%", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: "white", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1, boxShadow: "0 0 20px rgba(124,58,237,0.3)" }}
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </motion.button>

        <p style={{ textAlign: "center", marginTop: "24px", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>Inicia sesión</Link>
        </p>
      </motion.div>
    </div>
  )
}