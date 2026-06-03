import { useState } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, Link } from "react-router-dom"

const categorias = ["Fiestas", "Universitarios", "Cultura", "Autos", "Belleza", "Tecnología", "Gastronomía", "Gaming", "Música", "Deportes", "Arte", "Negocios"]

export default function CrearEvento() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState(false)

  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    categoria: "",
    fecha: "",
    hora: "",
    ubicacion: "",
    capacidad: "",
    precio: "",
    tipo_boleto: "instantaneo",
    imagen_url: "",
  })

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
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

    const fechaCompleta = `${form.fecha}T${form.hora}:00`

    const { error } = await supabase.from("eventos").insert({
      titulo: form.titulo,
      descripcion: form.descripcion,
      categoria: form.categoria,
      fecha: fechaCompleta,
      ubicacion: form.ubicacion,
      capacidad: parseInt(form.capacidad),
      precio: parseInt(form.precio) || 0,
      tipo_boleto: form.tipo_boleto,
      imagen_url: form.imagen_url || null,
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
    fontFamily: "inherit", outline: "none", boxSizing: "border-box"
  }

  const labelStyle = {
    display: "block", fontSize: "13.5px", fontWeight: 500,
    color: "rgba(255,255,255,0.6)", marginBottom: "8px"
  }

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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => handleChange("fecha", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={labelStyle}>Hora *</label>
                <input type="time" value={form.hora} onChange={e => handleChange("hora", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Ubicación *</label>
              <input value={form.ubicacion} onChange={e => handleChange("ubicacion", e.target.value)} placeholder="Ej. Club Aurora, Juriquilla, Querétaro" style={inputStyle} />
            </div>
          </div>

          {/* SECCIÓN 3: Boletos */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "28px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "24px", color: "rgba(255,255,255,0.8)" }}>Boletos y acceso</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Capacidad máxima *</label>
                <input type="number" value={form.capacidad} onChange={e => handleChange("capacidad", e.target.value)} placeholder="Ej. 200" min="1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Precio por boleto (MXN)</label>
                <input type="number" value={form.precio} onChange={e => handleChange("precio", e.target.value)} placeholder="0 = Gratis" min="0" style={inputStyle} />
              </div>
            </div>

            <div>
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
              <label style={labelStyle}>URL de imagen (opcional)</label>
              <input value={form.imagen_url} onChange={e => handleChange("imagen_url", e.target.value)} placeholder="https://..." style={inputStyle} />
              <p style={{ marginTop: "8px", fontSize: "12.5px", color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>Pega el link de una imagen de internet. Próximamente podrás subir imágenes directamente.</p>
            </div>
          </div>

          <motion.button onClick={handleSubmit} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={loading}
            style={{ width: "100%", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "14px", color: "white", padding: "16px", fontWeight: 700, fontSize: "16px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1, boxShadow: "0 0 24px rgba(124,58,237,0.35)" }}
          >
            {loading ? "Creando evento..." : "Publicar evento"}
          </motion.button>

        </motion.div>
      </div>
    </div>
  )
}
