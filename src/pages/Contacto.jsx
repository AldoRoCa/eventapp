import { useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"

export default function Contacto() {
  const [copiado, setCopiado] = useState(false)
  const email = "panel.admin2026eventapp@gmail.com"

  const copiar = () => {
    navigator.clipboard.writeText(email)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(124,58,237,0.5)" }}>
            <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Inicio
        </Link>
      </nav>

      <div style={{ maxWidth: "520px", margin: "0 auto", padding: "72px 24px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 0 32px rgba(124,58,237,0.4)", fontSize: "28px" }}>✉️</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px" }}>Contacto</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", lineHeight: 1.7, marginBottom: "36px" }}>
            ¿Tienes dudas, reportes o sugerencias? Escríbenos directamente.
          </p>

          {/* Tarjeta de email */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "24px", marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500 }}>Correo de contacto</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#a78bfa", marginBottom: "20px", wordBreak: "break-all" }}>{email}</div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <motion.button onClick={copiar} whileTap={{ scale: 0.97 }}
                style={{ background: copiado ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.15)", border: `1.5px solid ${copiado ? "rgba(16,185,129,0.35)" : "rgba(124,58,237,0.35)"}`, borderRadius: "10px", color: copiado ? "#34d399" : "#a78bfa", padding: "10px 20px", fontWeight: 600, fontSize: "13.5px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {copiado ? (
                  <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
                ) : (
                  <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar correo</>
                )}
              </motion.button>
              <motion.a href={`https://mail.google.com/mail/?view=cm&to=${email}`} target="_blank" rel="noopener noreferrer" whileTap={{ scale: 0.97 }}
                style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "rgba(255,255,255,0.7)", padding: "10px 20px", fontWeight: 600, fontSize: "13.5px", cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Abrir Gmail
              </motion.a>
            </div>
          </div>

          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12.5px", lineHeight: 1.6 }}>
            Respondemos en un plazo de 24–48 horas hábiles.
          </p>
        </motion.div>
      </div>
    </div>
  )
}