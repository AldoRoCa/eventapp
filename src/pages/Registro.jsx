import { useState } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

export default function Registro() {
  const [nombre, setNombre] = useState("")
  const [nombreReal, setNombreReal] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [error, setError] = useState("")
  const [registrado, setRegistrado] = useState(false)
  const navigate = useNavigate()

  const handleAvatar = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("La imagen no puede pesar más de 5MB"); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleRegistro = async () => {
    setLoading(true)
    setError("")
    if (!nombre || !nombreReal || !email || !password) { setError("Por favor llena todos los campos"); setLoading(false); return }
    if (nombreReal.trim().length < 3) { setError("Por favor ingresa tu nombre completo real"); setLoading(false); return }
    if (nombreReal.trim().length > 100) { setError("El nombre completo no puede tener más de 100 caracteres"); setLoading(false); return }
    if (nombre.trim().length > 50) { setError("El nombre de usuario no puede tener más de 50 caracteres"); setLoading(false); return }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); setLoading(false); return }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre, nombre_real: nombreReal.trim() } } })
    if (error) {
      if (error.message.includes("already registered") || error.message.includes("User already registered")) {
        setError("Ya existe una cuenta con ese correo. Intenta iniciar sesión.")
      } else if (error.message.includes("rate limit")) {
        setError("Demasiados intentos. Espera unos minutos y vuelve a intentar.")
      } else {
        setError("Error al crear la cuenta. Verifica tu correo e intenta de nuevo.")
      }
    } else if (data.user && !data.session) {
      // Supabase exige confirmar el correo antes de dar una sesión activa
      // (signUp crea el usuario pero no lo deja entrar todavía), así que
      // subir la foto aquí fallaría (sin sesión, las reglas de seguridad
      // bloquean la subida). En vez de eso, la guardamos temporalmente en
      // este navegador; App.jsx la sube en cuanto el usuario confirme su
      // correo e inicie sesión por primera vez.
      if (avatarFile && data.user) {
        const ext = avatarFile.name.split(".").pop()
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(",")[1])
          reader.readAsDataURL(avatarFile)
        })
        localStorage.setItem(`vela_avatar_pendiente_${data.user.id}`, JSON.stringify({ base64, ext }))
      }
      setRegistrado(true)
    } else {
      if (avatarFile && data.user) {
        const ext = avatarFile.name.split(".").pop()
        const nombreArchivo = `${data.user.id}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from("avatars").upload(nombreArchivo, avatarFile)
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(nombreArchivo)
          await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", data.user.id)
        }
      }
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

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)", width: "700px", height: "400px", background: "radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: "420px", background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.09)", borderRadius: "24px", padding: "40px", position: "relative", boxShadow: "0 0 0 1px rgba(124,58,237,0.08), 0 32px 64px rgba(0,0,0,0.4)" }}
      >
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "200px", height: "2px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)", borderRadius: "999px" }} />

        {registrado ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "999px", background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" fill="none" stroke="#a78bfa" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "white", marginBottom: "10px", letterSpacing: "-0.5px" }}>Revisa tu correo</h1>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: 1.6, marginBottom: "8px" }}>
              Te enviamos un link de confirmación a<br /><strong style={{ color: "white" }}>{email}</strong>
            </p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", lineHeight: 1.6, marginBottom: "28px" }}>
              Da clic en el link para activar tu cuenta. Si no lo ves, revisa también tu carpeta de spam.
            </p>
            <Link to="/login" style={{ display: "block", width: "100%", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "rgba(255,255,255,0.7)", padding: "12px", fontWeight: 600, fontSize: "14px", textDecoration: "none", boxSizing: "border-box" }}>
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
        <>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", justifyContent: "center" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", color: "white" }}>VELA</span>
        </div>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "white", marginBottom: "8px", letterSpacing: "-0.5px", textAlign: "center" }}>Crea tu cuenta</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px", textAlign: "center", fontWeight: 400 }}>Empieza a descubrir eventos</p>

        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", color: "#f87171", fontSize: "13.5px" }}
          >{error}</motion.div>
        )}

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Nombre completo (real)</label>
          <input type="text" value={nombreReal} onChange={e => setNombreReal(e.target.value)} placeholder="Como aparece en tu identificación" maxLength={100} style={inputStyle} />
          <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.3)", marginTop: "6px", lineHeight: 1.5 }}>
            Se usará para el registro al comprar boletos. Si es incorrecto, el check-in en los eventos no se hará correctamente.
          </p>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Nombre de usuario</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Como te verán otros usuarios" maxLength={50} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Correo electrónico</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" maxLength={255} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" maxLength={72} onKeyDown={e => e.key === "Enter" && handleRegistro()} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "28px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Foto de perfil <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>(opcional)</span></label>
          <label style={{ cursor: "pointer", display: "block" }}>
            <input type="file" accept="image/*" onChange={handleAvatar} style={{ display: "none" }} />
            {avatarPreview ? (
              <div style={{ display: "flex", alignItems: "center", gap: "14px", background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.25)", borderRadius: "12px", padding: "12px 16px" }}>
                <img src={avatarPreview} alt="preview" style={{ width: "44px", height: "44px", borderRadius: "999px", objectFit: "cover", border: "2px solid rgba(124,58,237,0.5)", boxShadow: "0 0 12px rgba(124,58,237,0.3)" }} />
                <span style={{ color: "#a78bfa", fontSize: "13.5px", fontWeight: 500 }}>Cambiar foto</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", border: "1.5px dashed rgba(255,255,255,0.12)", borderRadius: "12px", padding: "12px 16px", transition: "border 0.2s" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "999px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" fill="none" stroke="#a78bfa" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13.5px" }}>Subir foto de perfil</span>
              </div>
            )}
          </label>
        </div>

        <motion.button onClick={handleRegistro} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={loading}
          className="btn-3d"
          style={{ width: "100%", border: "none", borderRadius: "12px", color: "white", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}
        >{loading ? "Creando cuenta..." : "Crear cuenta"}</motion.button>

        <p style={{ textAlign: "center", marginTop: "24px", color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>Inicia sesión</Link>
        </p>

        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <Link to="/" style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Volver al inicio
          </Link>
        </div>
        </>
        )}
      </motion.div>
    </div>
  )
}