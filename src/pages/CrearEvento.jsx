import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

const categorias = ["Fiestas", "Universitarios", "Cultura", "Autos", "Belleza", "Tecnología", "Gastronomía", "Gaming", "Música", "Deportes", "Arte", "Negocios"]

export default function CrearEvento() {
  const navigate = useNavigate()
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate("/login"); return }
      const { data: perfil } = await supabase.from("profiles").select("tipo, estado_anfitrion, mp_access_token").eq("id", user.id).single()
      if (!perfil || perfil.tipo !== "anfitrion" || perfil.estado_anfitrion !== "aprobado") { navigate("/ser-anfitrion"); return }
      setPerfil(perfil)
      setVerificando(false)
    }
    verificar()
  }, [])

  

  const [loading, setLoading] = useState(false)
  
  const [error, setError] = useState("")
  const [exito, setExito] = useState(false)
const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    categoria: "",
    fecha: "",
    hora: "",
    ubicacion: "",
    estado_evento: "",
    capacidad: "",
    precio: "",
    max_boletos_por_persona: "5",
    tipo_boleto: "instantaneo",
    imagen_url: "",
  })

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }
  const handleImagen = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      setError("La imagen no puede pesar más de 8MB")
      return
    }
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setError("")
    if (!form.titulo || !form.categoria || !form.fecha || !form.hora || !form.ubicacion || !form.capacidad) {
      setError("Por favor llena todos los campos obligatorios")
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError("Debes iniciar sesión para crear un evento")
      setLoading(false)
      return
    }

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
      titulo: form.titulo,
      descripcion: form.descripcion,
      categoria: form.categoria,
      fecha: fechaCompleta,
      ubicacion: form.ubicacion,
      estado_evento: form.estado_evento || null,
      capacidad: parseInt(form.capacidad),
      precio: parseInt(form.precio) || 0,
      max_boletos_por_persona: parseInt(form.max_boletos_por_persona) || 5,
      tipo_boleto: form.tipo_boleto,
      imagen_url: imagenUrl,
      anfitrion_id: user.id,
    })

    if (error) {
      setError("Error al crear el evento. Intenta de nuevo.")
      console.error(error)
    } else {
      setExito(true)
      setTimeout(() => navigate("/"), 2000)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "12px 16px", color: "white", fontSize: "14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 -1px 0 rgba(0,0,0,0.3) inset, 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(124,58,237,0.15)",
    transition: "all 0.2s"
  }

  const labelStyle = {
    display: "block", fontSize: "13.5px", fontWeight: 500,
    color: "rgba(255,255,255,0.6)", marginBottom: "8px"
  }

  if (verificando) return <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Verificando acceso...</div>

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 64px", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Volver al inicio
        </Link>
      </nav>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "56px 24px" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          <div style={{ marginBottom: "40px" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "8px" }}>Crear evento</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", fontWeight: 400 }}>Completa los datos de tu evento y empieza a vender boletos.</p>
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", color: "#f87171", fontSize: "13.5px" }}>
              {error}
            </div>
          )}

          {exito && (
            <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}>
              ✓ Evento creado exitosamente. Redirigiendo...
            </div>
          )}

          {/* SECCIÓN 1: Info básica */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "28px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "24px", color: "rgba(255,255,255,0.8)" }}>Información básica</h2>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Nombre del evento *</label>
              <input value={form.titulo} onChange={e => handleChange("titulo", e.target.value)} placeholder="Ej. Noche de Electrónica en Juriquilla" style={inputStyle} />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Descripción</label>
              <textarea value={form.descripcion} onChange={e => handleChange("descripcion", e.target.value)} placeholder="Describe tu evento, qué incluye, qué esperar..." rows={4}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            <div>
              <label style={labelStyle}>Categoría *</label>
              <select value={form.categoria} onChange={e => handleChange("categoria", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="" style={{ background: "#111" }}>Selecciona una categoría</option>
                {categorias.map(c => <option key={c} value={c} style={{ background: "#111" }}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* SECCIÓN 2: Fecha y lugar */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "28px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "24px", color: "rgba(255,255,255,0.8)" }}>Fecha y lugar</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", alignItems: "start" }}>
              <div>
                <label style={labelStyle}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => handleChange("fecha", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={labelStyle}>Hora *</label>
                <input type="time" value={form.hora} onChange={e => handleChange("hora", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Ubicación *</label>
                <input value={form.ubicacion} onChange={e => handleChange("ubicacion", e.target.value)} placeholder="Ej. Club Aurora, Juriquilla" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Estado *</label>
                <select value={form.estado_evento} onChange={e => handleChange("estado_evento", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="" style={{ background: "#111" }}>Selecciona un estado</option>
                  {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                    <option key={e} value={e} style={{ background: "#111" }}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Boletos */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "28px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "24px", color: "rgba(255,255,255,0.8)" }}>Boletos y acceso</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", alignItems: "start" }}>
              <div>
                <label style={labelStyle}>Capacidad máxima *</label>
                <div style={{ height: "24px" }} />
                <input type="number" value={form.capacidad} onChange={e => handleChange("capacidad", e.target.value)} placeholder="Ej. 200" min="1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Precio por boleto (MXN)</label>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>Lo que recibirás por cada boleto vendido</div>
                <input type="number" value={form.precio} onChange={e => perfil?.mp_access_token ? handleChange("precio", e.target.value) : null} placeholder={perfil?.mp_access_token ? "0 = Gratis" : "Activa Mercado Pago para cobrar"} min="0" style={{ ...inputStyle, opacity: perfil?.mp_access_token ? 1 : 0.5, cursor: perfil?.mp_access_token ? "text" : "not-allowed" }} />
                {form.precio > 0 && (
                  <div style={{ marginTop: "8px", padding: "10px 14px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "8px", fontSize: "13px" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Precio final al asistente: </span>
                    <span style={{ color: "#a78bfa", fontWeight: 700 }}>${Math.round(parseInt(form.precio) * 1.10)} MXN</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", marginLeft: "6px" }}>(incluye 10% de comisión VELA)</span>
                  </div>
                )}
              </div>
            </div>
            {!perfil?.mp_access_token && (
              <div style={{ marginBottom: "20px", padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "8px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#fbbf24" }}>⚠️ Conecta Mercado Pago en tu panel para poder cobrar por tus eventos.</span>
              </div>
            )}

            <div style={{ marginTop: "20px" }}>
              <label style={labelStyle}>Límite de boletos por persona</label>
              <input type="number" value={form.max_boletos_por_persona} onChange={e => handleChange("max_boletos_por_persona", e.target.value)} placeholder="5" min="1" max="20" style={inputStyle} />
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "6px" }}>¿Cuántos boletos puede comprar una misma persona? Útil si quieres que vengan grupos. Por defecto son 5.</p>
            </div>

            <div style={{ marginTop: "20px" }}>
              <label style={labelStyle}>Tipo de boleto</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {[
                  { value: "instantaneo", label: "⚡ Instantáneo", desc: "El comprador recibe su boleto al instante" },
                  { value: "solicitud", label: "📋 Por solicitud", desc: "Tú apruebas cada solicitud manualmente" },
                ].map(opt => (
                  <div key={opt.value} onClick={() => handleChange("tipo_boleto", opt.value)}
                    style={{ padding: "16px", borderRadius: "12px", cursor: "pointer", border: `1px solid ${form.tipo_boleto === opt.value ? "rgba(124,58,237,0.6)" : "rgba(255,255,255,0.08)"}`, background: form.tipo_boleto === opt.value ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.02)", transition: "all 0.2s" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>{opt.label}</div>
                    <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Imagen */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "28px", marginBottom: "32px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "24px", color: "rgba(255,255,255,0.8)" }}>Imagen del evento</h2>
            <div>
              <label style={labelStyle}>Imagen del evento (opcional)</label>
              <label style={{ display: "block", cursor: "pointer", marginBottom: "12px" }}>
                <input type="file" accept="image/*" onChange={handleImagen} style={{ display: "none" }} />
                {imagenPreview ? (
                  <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(124,58,237,0.4)" }}>
                    <img src={imagenPreview} alt="preview" style={{ width: "100%", maxHeight: "200px", objectFit: "cover" }} />
                    <div style={{ position: "absolute", bottom: "12px", right: "12px", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: "white" }}>Cambiar imagen</div>
                  </div>
                ) : (
                  <div style={{ border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "12px", padding: "32px 24px", textAlign: "center" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                  >
                    <div style={{ fontSize: "28px", marginBottom: "10px" }}>🖼️</div>
                    <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>Subir imagen</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>JPG, PNG o WEBP · Máximo 8MB</div>
                  </div>
                )}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>o pega un link</span>
                <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              </div>
              <input value={form.imagen_url} onChange={e => handleChange("imagen_url", e.target.value)} placeholder="https://..." style={{ ...inputStyle, marginTop: "12px" }} />
            </div>
          </div>

          <motion.button onClick={handleSubmit} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={loading}
            className="btn-3d" style={{ width: "100%", borderRadius: "14px", padding: "16px", fontSize: "16px", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Creando evento..." : "Publicar evento"}
          </motion.button>

        </motion.div>
      </div>
    </div>
  )
}
