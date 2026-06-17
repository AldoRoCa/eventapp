import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { supabase, getUserSafe } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

const categorias = ["Fiestas", "Universitarios", "Cultura", "Autos", "Belleza", "Tecnología", "Gastronomía", "Música", "Deportes", "Arte", "Negocios"]

export default function CrearEvento() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [verificando, setVerificando] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState(false)
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const errorRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [error])
  const [form, setForm] = useState({
    titulo: "", descripcion: "", categoria: "", fecha: "", hora: "",
    ubicacion: "", estado_evento: "", capacidad: "", precio: "",
    max_boletos_por_persona: "5", tipo_boleto: "instantaneo", imagen_url: "",
  })

  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      const { data: perfil } = await supabase.from("profiles").select("tipo, estado_anfitrion, mp_access_token").eq("id", user.id).single()
      if (!perfil || perfil.tipo !== "anfitrion" || perfil.estado_anfitrion !== "aprobado") { navigate("/ser-anfitrion"); return }
      setPerfil(perfil)
      setVerificando(false)
    }
    verificar()
  }, [])

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { setError("La imagen no puede pesar más de 8MB"); return }
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setError("")

    const titulo = form.titulo.trim()
    const ubicacion = form.ubicacion.trim()

    if (!titulo || !form.categoria || !form.fecha || !form.hora || !ubicacion || !form.capacidad) {
      setError("Por favor llena todos los campos obligatorios")
      return
    }
    if (titulo.length > 150) {
      setError("El título no puede tener más de 150 caracteres")
      return
    }
    if (ubicacion.length > 200) {
      setError("La ubicación no puede tener más de 200 caracteres")
      return
    }
    if (form.descripcion.length > 2000) {
      setError("La descripción no puede tener más de 2000 caracteres")
      return
    }
    const capacidad = parseInt(form.capacidad)
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 50000) {
      setError("La capacidad debe ser un número entre 1 y 50,000")
      return
    }
    const precio = form.precio === "" ? 0 : parseInt(form.precio)
    if (!Number.isInteger(precio) || precio < 0 || precio > 50000) {
      setError("El precio debe ser un número entre 0 y 50,000")
      return
    }
    const maxBoletos = form.max_boletos_por_persona === "" ? 5 : parseInt(form.max_boletos_por_persona)
    if (!Number.isInteger(maxBoletos) || maxBoletos < 1 || maxBoletos > 20) {
      setError("El máximo de boletos por persona debe ser un número entre 1 y 20")
      return
    }

    setLoading(true)
    const { data: { user } } = await getUserSafe()
    if (!user) { setError("Debes iniciar sesión para crear un evento"); setLoading(false); return }

    const fechaCompleta = new Date(`${form.fecha}T${form.hora}:00`).toISOString()
    let imagenUrl = form.imagen_url || null
    if (imagenFile) {
      const ext = imagenFile.name.split(".").pop()
      const nombreArchivo = `${user.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("event-images").upload(nombreArchivo, imagenFile)
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from("event-images").getPublicUrl(nombreArchivo)
        imagenUrl = publicUrl
      }
    }

    const { error } = await supabase.from("eventos").insert({
      titulo, descripcion: form.descripcion.trim(), categoria: form.categoria,
      fecha: fechaCompleta, ubicacion, estado_evento: form.estado_evento || null,
      capacidad, precio,
      max_boletos_por_persona: maxBoletos,
      tipo_boleto: form.tipo_boleto, imagen_url: imagenUrl, anfitrion_id: user.id,
    })

    if (error) { setError("Error al crear el evento. Intenta de nuevo.") }
    else { setExito(true); setTimeout(() => navigate("/"), 2000) }
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

  const labelStyle = { display: "block", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: "7px" }

  const cardStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1.5px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: isMobile ? "20px 16px" : "28px",
    marginBottom: "14px",
    position: "relative",
    overflow: "hidden"
  }

  if (verificando) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Verificando acceso...
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
          {!isMobile && "Volver al inicio"}
        </Link>
      </nav>

      {/* HEADER con degradado */}
      <div style={{ background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 40%, #080808 100%)", padding: isMobile ? "32px 18px 28px" : "52px 64px 44px", borderBottom: "1px solid rgba(124,58,237,0.12)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "300px", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "720px", margin: "0 auto", position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", background: "rgba(124,58,237,0.15)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "999px", padding: "4px 14px", marginBottom: "14px" }}>
            <svg width="13" height="13" fill="none" stroke="#a78bfa" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span style={{ color: "#a78bfa", fontSize: "12.5px", fontWeight: 600 }}>Nuevo evento</span>
          </div>
          <h1 style={{ fontSize: isMobile ? "1.8rem" : "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "6px" }}>Crear evento</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14.5px", fontWeight: 400, margin: 0 }}>Completa los datos y empieza a vender boletos.</p>
        </div>
      </div>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: isMobile ? "24px 18px 48px" : "36px 24px 60px" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {exito && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "12px", padding: "12px 16px", marginBottom: "20px", color: "#34d399", fontSize: "13.5px" }}
            >✓ Evento creado exitosamente. Redirigiendo...</motion.div>
          )}

          {/* SECCIÓN 1: Info básica */}
          <div style={cardStyle}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />
            <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "20px", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>1</span>
              Información básica
            </h2>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Nombre del evento *</label>
              <input value={form.titulo} onChange={e => handleChange("titulo", e.target.value)} placeholder="Ej. Noche de Electrónica en Juriquilla" style={inputStyle} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Descripción</label>
              <textarea value={form.descripcion} onChange={e => handleChange("descripcion", e.target.value)} placeholder="Describe tu evento, qué incluye, qué esperar..." rows={4}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Categoría *</label>
              <select value={form.categoria} onChange={e => handleChange("categoria", e.target.value)} style={{ ...inputStyle, cursor: "pointer", colorScheme: "dark" }}>
                <option value="" style={{ background: "#111" }}>Selecciona una categoría</option>
                {categorias.map(c => <option key={c} value={c} style={{ background: "#111" }}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* SECCIÓN 2: Fecha y lugar */}
          <div style={cardStyle}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />
            <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "20px", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>2</span>
              Fecha y lugar
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              <div>
                <label style={labelStyle}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => handleChange("fecha", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={labelStyle}>Hora *</label>
                <input type="time" value={form.hora} onChange={e => handleChange("hora", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Ubicación *</label>
                <input value={form.ubicacion} onChange={e => handleChange("ubicacion", e.target.value)} placeholder="Ej. Club Aurora, Juriquilla" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Estado *</label>
                <select value={form.estado_evento} onChange={e => handleChange("estado_evento", e.target.value)} style={{ ...inputStyle, cursor: "pointer", colorScheme: "dark" }}>
                  <option value="" style={{ background: "#111" }}>Selecciona un estado</option>
                  {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                    <option key={e} value={e} style={{ background: "#111" }}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Boletos */}
          <div style={cardStyle}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />
            <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "20px", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>3</span>
              Boletos y acceso
            </h2>

            {!perfil?.mp_access_token && (
              <div style={{ marginBottom: "16px", padding: "11px 14px", background: "rgba(245,158,11,0.08)", border: "1.5px solid rgba(245,158,11,0.2)", borderRadius: "10px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#fbbf24" }}>⚠️ Conecta Mercado Pago en tu panel para poder cobrar por tus eventos.</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
              <div>
                <label style={labelStyle}>Capacidad máxima *</label>
                <input type="number" value={form.capacidad} onChange={e => handleChange("capacidad", e.target.value)} placeholder="Ej. 200" min="1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Precio por boleto (MXN)</label>
                <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Lo que recibirás por cada boleto</div>
                <input type="number" value={form.precio}
                  onChange={e => perfil?.mp_access_token ? handleChange("precio", e.target.value) : null}
                  placeholder={perfil?.mp_access_token ? "0 = Gratis" : "Activa MP para cobrar"}
                  min="0"
                  style={{ ...inputStyle, opacity: perfil?.mp_access_token ? 1 : 0.5, cursor: perfil?.mp_access_token ? "text" : "not-allowed" }}
                />
                {form.precio > 0 && (
                  <div style={{ marginTop: "8px", padding: "10px 14px", background: "rgba(124,58,237,0.1)", border: "1.5px solid rgba(124,58,237,0.22)", borderRadius: "10px", fontSize: "13px" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Precio final al asistente: </span>
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>${Math.round(parseInt(form.precio) * 1.10)} MXN</span>
                    <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "11px", marginLeft: "5px" }}>(+10% VELA)</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Límite de boletos por persona</label>
              <input type="number" value={form.max_boletos_por_persona} onChange={e => handleChange("max_boletos_por_persona", e.target.value)} placeholder="5" min="1" max="20" style={inputStyle} />
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.28)", marginTop: "5px" }}>¿Cuántos boletos puede comprar una misma persona? Por defecto son 5.</p>
            </div>

            <div>
              <label style={labelStyle}>Tipo de boleto</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[
                  { value: "instantaneo", label: "⚡ Instantáneo", desc: "El comprador recibe su boleto al instante" },
                  { value: "solicitud", label: "📋 Por solicitud", desc: "Tú apruebas cada solicitud manualmente" },
                ].map(opt => (
                  <motion.div key={opt.value} onClick={() => handleChange("tipo_boleto", opt.value)} whileTap={{ scale: 0.98 }}
                    style={{ padding: "14px", borderRadius: "14px", cursor: "pointer", border: `1.5px solid ${form.tipo_boleto === opt.value ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.08)"}`, background: form.tipo_boleto === opt.value ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.02)", transition: "all 0.2s", boxShadow: form.tipo_boleto === opt.value ? "0 0 16px rgba(124,58,237,0.2)" : "none" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "13.5px", marginBottom: "4px" }}>{opt.label}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: 400, lineHeight: 1.4 }}>{opt.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Imagen */}
          <div style={{ ...cardStyle, marginBottom: "28px" }}>
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)" }} />
            <h2 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: "20px", color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>4</span>
              Imagen del evento <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.28)", fontWeight: 400 }}>(opcional)</span>
            </h2>
            <label style={{ display: "block", cursor: "pointer", marginBottom: "14px" }}>
              <input type="file" accept="image/*" onChange={handleImagen} style={{ display: "none" }} />
              {imagenPreview ? (
                <div style={{ position: "relative", borderRadius: "14px", overflow: "hidden", border: "1.5px solid rgba(124,58,237,0.4)", boxShadow: "0 0 20px rgba(124,58,237,0.15)" }}>
                  <img src={imagenPreview} alt="preview" style={{ width: "100%", maxHeight: "220px", objectFit: "cover" }} />
                  <div style={{ position: "absolute", bottom: "12px", right: "12px", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: "white" }}>Cambiar imagen</div>
                </div>
              ) : (
                <div style={{ border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "14px", padding: isMobile ? "28px 16px" : "36px 24px", textAlign: "center", transition: "border-color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                >
                  <div style={{ fontSize: "28px", marginBottom: "10px" }}>🖼️</div>
                  <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>Subir imagen</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px" }}>JPG, PNG o WEBP · Máximo 8MB</div>
                </div>
              )}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>o pega un link</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
            </div>
            <input value={form.imagen_url} onChange={e => handleChange("imagen_url", e.target.value)} placeholder="https://..." style={inputStyle} />
          </div>

          {error && (
            <motion.div ref={errorRef} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "12px 16px", marginBottom: "16px", color: "#f87171", fontSize: "13.5px" }}
            >{error}</motion.div>
          )}

          <motion.button onClick={handleSubmit} whileTap={{ scale: 0.97 }} disabled={loading}
            className="btn-3d"
            style={{ width: "100%", borderRadius: "14px", padding: "16px", fontSize: "16px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, border: "none", color: "white", fontFamily: "inherit" }}
          >
            {loading ? "Creando evento..." : "✦ Publicar evento"}
          </motion.button>

        </motion.div>
      </div>
    </div>
  )
}