import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

// Recuperación de contraseña. Una sola página cubre los dos momentos del
// flujo, porque son la misma conversación con el usuario:
//
//   1. "pedir"  → escribe su correo y le mandamos el enlace.
//   2. "nueva"  → llegó desde ese enlace (Supabase deja una sesión temporal de
//                 tipo recovery) y escribe su contraseña nueva.
//
// Antes NO existía ninguna forma de recuperar contraseña: quien se registraba
// con correo y la olvidaba quedaba fuera para siempre.
//
// Nota sobre cuentas de Google: si alguien entró siempre con Google, nunca
// tuvo contraseña. Usar esta pantalla le CREA una, y a partir de ahí puede
// entrar por las dos vías — Supabase liga ambas identidades al mismo usuario
// (verificado: un mismo correo con proveedores "email" y "google").

export default function RestablecerContrasena() {
  const navigate = useNavigate()
  const [modo, setModo] = useState("pidiendo") // pidiendo | nueva | enviado | listo
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // Supabase procesa el enlace del correo y emite un evento PASSWORD_RECOVERY
    // con una sesión temporal que solo sirve para cambiar la contraseña.
    // El callback es SÍNCRONO a propósito: poner un await a Supabase aquí
    // adentro bloquea la inicialización del cliente (bug ya documentado).
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setModo("nueva")
    })

    // Respaldo del evento anterior. No se puede depender del hash de la URL
    // (`type=recovery`): el cliente de Supabase lo procesa y lo BORRA de la
    // barra de direcciones antes de que esta página alcance a montarse —
    // comprobado en el navegador. Lo que sí queda es la sesión que ese enlace
    // creó, así que basta preguntar si hay una.
    //
    // Efecto secundario deseable: alguien que ya inició sesión y entra aquí a
    // propósito también puede cambiar su contraseña, sin pasar por el correo.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) setModo(m => (m === "pidiendo" ? "nueva" : m))
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const enviarEnlace = async () => {
    if (!email.trim()) { setError("Escribe tu correo electrónico."); return }
    setCargando(true)
    setError("")
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/restablecer-contrasena`,
    })
    // A propósito NO se distingue entre "correo existe" y "no existe": decirlo
    // permitiría averiguar quién tiene cuenta en VELA probando correos.
    if (err && err.message?.toLowerCase().includes("rate")) {
      setError("Ya pediste un enlace hace poco. Espera unos minutos e intenta de nuevo.")
    } else {
      setModo("enviado")
    }
    setCargando(false)
  }

  const guardarPassword = async () => {
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return }
    if (password !== password2) { setError("Las contraseñas no coinciden."); return }
    setCargando(true)
    setError("")
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError("No se pudo guardar la contraseña. Pide un enlace nuevo e intenta otra vez.")
      setCargando(false)
      return
    }
    setModo("listo")
    setCargando(false)
    setTimeout(() => navigate("/"), 2500)
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
      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: "700px", height: "400px", background: "radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: "24px", padding: "40px", position: "relative", boxShadow: "0 0 0 1px rgba(124,58,237,0.08), 0 32px 64px rgba(0,0,0,0.4)" }}
      >
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "200px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)", borderRadius: "999px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px", justifyContent: "center" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "white" }}>VELA</span>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#f87171", fontSize: "13.5px" }}
          >{error}</motion.div>
        )}

        {modo === "enviado" ? (
          <>
            <div style={{ width: "56px", height: "56px", borderRadius: "999px", background: "rgba(16,185,129,0.15)", border: "1.5px solid rgba(16,185,129,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "24px" }}>✉️</div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "white", marginBottom: "10px", letterSpacing: "-0.5px", textAlign: "center" }}>Revisa tu correo</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textAlign: "center", lineHeight: 1.65 }}>
              Si ese correo tiene una cuenta en VELA, te mandamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.
            </p>
          </>
        ) : modo === "listo" ? (
          <>
            <div style={{ width: "56px", height: "56px", borderRadius: "999px", background: "rgba(16,185,129,0.15)", border: "1.5px solid rgba(16,185,129,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "24px" }}>✓</div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "white", marginBottom: "10px", letterSpacing: "-0.5px", textAlign: "center" }}>Contraseña actualizada</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", textAlign: "center" }}>Ya puedes usarla para entrar. Te llevamos al inicio...</p>
          </>
        ) : modo === "nueva" ? (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "white", marginBottom: "8px", letterSpacing: "-0.5px", textAlign: "center" }}>Crea tu contraseña nueva</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "28px", textAlign: "center" }}>Elige una que no uses en otros sitios.</p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: "7px" }}>Contraseña nueva</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle} />
            </div>
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: "7px" }}>Repite la contraseña</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && guardarPassword()} style={inputStyle} />
            </div>

            <motion.button onClick={guardarPassword} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={cargando}
              className="btn-3d"
              style={{ width: "100%", border: "none", borderRadius: "12px", color: "white", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: cargando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: cargando ? 0.7 : 1 }}
            >{cargando ? "Guardando..." : "Guardar contraseña"}</motion.button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "white", marginBottom: "8px", letterSpacing: "-0.5px", textAlign: "center" }}>¿Olvidaste tu contraseña?</h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "28px", textAlign: "center", lineHeight: 1.6 }}>
              Escribe tu correo y te mandamos un enlace para crear una nueva.
            </p>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.6)", marginBottom: "7px" }}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" onKeyDown={e => e.key === "Enter" && enviarEnlace()} style={inputStyle} />
            </div>

            <motion.button onClick={enviarEnlace} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={cargando}
              className="btn-3d"
              style={{ width: "100%", border: "none", borderRadius: "12px", color: "white", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: cargando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: cargando ? 0.7 : 1 }}
            >{cargando ? "Enviando..." : "Enviarme el enlace"}</motion.button>

            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, margin: "16px 2px 0", textAlign: "center" }}>
              ¿Entras con Google? No necesitas contraseña: usa el botón de Google en la pantalla de inicio de sesión.
            </p>
          </>
        )}

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <Link to="/login" style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Volver a iniciar sesión
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
