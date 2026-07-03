import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { supabase, getUserSafe } from "../supabase"
import { Link, useNavigate } from "react-router-dom"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

export default function SerAnfitrion() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState("")
  const [ineFile, setIneFile] = useState(null)
  const [inePreview, setInePreview] = useState(null)
  const [form, setForm] = useState({ nombre: "", telefono: "", fecha_nacimiento: "", bio: "", instagram: "", tipo_eventos: "" })

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      setUser(user)
      const { data: perfil } = await supabase.from("profiles").select("nombre, tipo").eq("id", user.id).single()
      if (perfil) {
        setForm(f => ({ ...f, nombre: perfil.nombre || "" }))
        if (perfil.tipo === "anfitrion") setExito(true)
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleIne = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("La imagen no puede pesar más de 5MB"); return }
    setIneFile(file)
    setInePreview(URL.createObjectURL(file))
  }

  const calcularEdad = (fechaNacimiento) => {
    const hoy = new Date()
    const nacimiento = new Date(fechaNacimiento)
    let edad = hoy.getFullYear() - nacimiento.getFullYear()
    const mes = hoy.getMonth() - nacimiento.getMonth()
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--
    return edad
  }

  const handleEnviar = async () => {
    setError("")
    if (!form.nombre || !form.telefono || !form.fecha_nacimiento || !form.bio || !form.tipo_eventos) { setError("Por favor llena todos los campos obligatorios"); return }
    if (!ineFile) { setError("Por favor sube una foto de tu INE para verificar tu identidad"); return }
    if (calcularEdad(form.fecha_nacimiento) < 18) { setError("Debes ser mayor de 18 años para registrarte como anfitrión en VELA"); return }
    setEnviando(true)
    const extension = ineFile.name.split(".").pop()
    const nombreArchivo = `${user.id}-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from("ine-docs").upload(nombreArchivo, ineFile)
    if (uploadError) { setError("Error al subir la imagen. Intenta de nuevo."); setEnviando(false); return }
    // El bucket ine-docs es privado (identificaciones oficiales), así que
    // aquí se guarda solo el nombre del archivo, no una URL pública — el
    // panel de admin genera una URL firmada temporal para poder verla.
    const { error: updateError } = await supabase.from("profiles").update({
      nombre: form.nombre, telefono: form.telefono, fecha_nacimiento: form.fecha_nacimiento,
      bio: form.bio, instagram: form.instagram, ine_url: nombreArchivo,
      tipo: "anfitrion", estado_anfitrion: "pendiente",
    }).eq("id", user.id)
    if (updateError) { setError("Error al guardar tu información. Intenta de nuevo.") } else { setExito(true) }
    setEnviando(false)
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "12px",
    padding: "12px 16px", color: "white", fontSize: "14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    boxShadow: "0 0 0 1px rgba(124,58,237,0.08) inset, 0 2px 8px rgba(0,0,0,0.25)",
    transition: "border 0.2s"
  }

  const labelStyle = { display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: `0 ${isMobile ? "18px" : "64px"}`, height: isMobile ? "56px" : "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(124,58,237,0.55)" }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {!isMobile && "Volver"}
        </Link>
      </nav>

      {exito ? (
        /* PANTALLA DE ÉXITO */
        <div style={{ maxWidth: "560px", margin: "0 auto", padding: isMobile ? "60px 18px" : "80px 24px", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 0 40px rgba(124,58,237,0.5)", fontSize: "36px" }}>⚡</div>
            <h1 style={{ fontSize: isMobile ? "1.7rem" : "2rem", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>Solicitud enviada</h1>
            <p style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: "12px", fontSize: "15px" }}>
              Tu solicitud está siendo revisada. En cuanto verifiquemos tu identidad activaremos tu cuenta de anfitrión.
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", lineHeight: 1.7, marginBottom: "36px", fontSize: "13.5px" }}>
              Este proceso puede tomar hasta 24 horas hábiles.
            </p>
            <motion.button onClick={() => navigate("/")} whileTap={{ scale: 0.97 }}
              className="btn-3d"
              style={{ border: "none", borderRadius: "12px", color: "white", padding: "13px 28px", fontWeight: 700, fontSize: "15px", cursor: "pointer", fontFamily: "inherit" }}
            >Volver al inicio</motion.button>
          </motion.div>
        </div>
      ) : (
        <>
          {/* HEADER con degradado */}
          <div style={{ background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 40%, #080808 100%)", padding: isMobile ? "32px 18px 28px" : "52px 64px 44px", borderBottom: "1px solid rgba(124,58,237,0.12)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "300px", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ maxWidth: "720px", margin: "0 auto", position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(124,58,237,0.15)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "999px", padding: "5px 14px", marginBottom: "14px" }}>
                <span style={{ color: "#a78bfa", fontSize: "12.5px", fontWeight: 600 }}>⚡ Programa de anfitriones</span>
              </div>
              <h1 style={{ fontSize: isMobile ? "1.7rem" : "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "10px" }}>Conviértete en anfitrión</h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14.5px", lineHeight: 1.7, fontWeight: 400, margin: 0 }}>
                Crea eventos públicos o privados, gestiona boletos y llega a toda la comunidad de VELA.
              </p>
            </div>
          </div>

          <div style={{ maxWidth: "720px", margin: "0 auto", padding: isMobile ? "24px 18px 48px" : "40px 24px 60px" }}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

              {/* BENEFICIOS */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "10px", marginBottom: "32px" }}>
                {[
                  { icon: "🎟️", title: "Vende boletos", desc: "Gestiona cupos y pagos desde un solo lugar" },
                  { icon: "📊", title: "Panel de control", desc: "Ve quién asiste en tiempo real" },
                  { icon: "🛡️", title: "Contratos protegidos", desc: "Reembolsos automáticos si cancelas" },
                ].map((b, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: isMobile ? "16px" : "20px 18px" }}>
                    <div style={{ fontSize: "22px", marginBottom: "8px" }}>{b.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: "13.5px", marginBottom: "5px" }}>{b.title}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12.5px", lineHeight: 1.5 }}>{b.desc}</div>
                  </div>
                ))}
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", color: "#f87171", fontSize: "13.5px" }}
                >{error}</motion.div>
              )}

              {/* INFO PERSONAL */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: isMobile ? "20px 16px" : "28px", marginBottom: "14px" }}>
                <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "20px", color: "rgba(255,255,255,0.8)" }}>Información personal</h2>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                  <div>
                    <label style={labelStyle}>Nombre completo *</label>
                    <input value={form.nombre} onChange={e => handleChange("nombre", e.target.value)} placeholder="Tu nombre completo" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Teléfono *</label>
                    <input value={form.telefono} onChange={e => handleChange("telefono", e.target.value)} placeholder="442 123 4567" style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Fecha de nacimiento *</label>
                  <input type="date" value={form.fecha_nacimiento} onChange={e => handleChange("fecha_nacimiento", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
                  <p style={{ marginTop: "5px", fontSize: "12px", color: "rgba(255,255,255,0.28)" }}>Debes ser mayor de 18 años para ser anfitrión.</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={labelStyle}>Tipo de eventos que organizas *</label>
                    <input value={form.tipo_eventos} onChange={e => handleChange("tipo_eventos", e.target.value)} placeholder="Ej. Fiestas, conciertos..." style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Instagram <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>(opcional)</span></label>
                    <input value={form.instagram} onChange={e => handleChange("instagram", e.target.value)} placeholder="@tuusuario" style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* BIO */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: isMobile ? "20px 16px" : "28px", marginBottom: "14px" }}>
                <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "20px", color: "rgba(255,255,255,0.8)" }}>Sobre ti</h2>
                <label style={labelStyle}>Cuéntanos quién eres *</label>
                <textarea value={form.bio} onChange={e => handleChange("bio", e.target.value)}
                  placeholder="Describe quién eres, qué tipo de eventos organizas y tu experiencia..." rows={4}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </div>

              {/* INE */}
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: isMobile ? "20px 16px" : "28px", marginBottom: "14px" }}>
                <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "8px", color: "rgba(255,255,255,0.8)" }}>Verificación de identidad</h2>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginBottom: "18px", lineHeight: 1.6 }}>
                  Sube una foto clara de tu identificación oficial (frente). Esta información es confidencial y solo se usa para verificar tu identidad. Documentos aceptados: INE, Pasaporte, Cédula profesional o Cartilla militar.
                </p>
                <label style={{ display: "block", cursor: "pointer" }}>
                  <input type="file" accept="image/*" onChange={handleIne} style={{ display: "none" }} />
                  {inePreview ? (
                    <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: "1.5px solid rgba(124,58,237,0.4)" }}>
                      <img src={inePreview} alt="INE" style={{ width: "100%", maxHeight: "200px", objectFit: "cover" }} />
                      <div style={{ position: "absolute", bottom: "12px", right: "12px", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: "white" }}>
                        Cambiar imagen
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "14px", padding: isMobile ? "32px 16px" : "40px 24px", textAlign: "center", transition: "border-color 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                    >
                      <div style={{ fontSize: "30px", marginBottom: "10px" }}>🪪</div>
                      <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>Sube tu identificación oficial</div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px" }}>INE, Pasaporte, Cédula o Cartilla · JPG, PNG · Máx 5MB</div>
                    </div>
                  )}
                </label>
              </div>

              {/* AVISO */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <svg width="15" height="15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: "2px" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p style={{ color: "rgba(255,255,255,0.32)", fontSize: "13px", lineHeight: 1.6, fontWeight: 400, margin: 0 }}>
                  Tu solicitud será revisada en un plazo de 24 horas. Al enviarla aceptas ser responsable de los eventos que publiques y cumplir con las políticas de seguridad de VELA.
                </p>
              </div>

              <motion.button onClick={handleEnviar} whileTap={{ scale: 0.97 }} disabled={enviando}
                className="btn-3d"
                style={{ width: "100%", border: "none", borderRadius: "14px", color: "white", padding: "15px", fontWeight: 700, fontSize: "15px", cursor: enviando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: enviando ? 0.7 : 1 }}
              >{enviando ? "Enviando solicitud..." : "Enviar solicitud"}</motion.button>

            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}