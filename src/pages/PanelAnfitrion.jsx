import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "../supabase"
import { Link, useNavigate } from "react-router-dom"

export default function PanelAnfitrion() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("eventos")
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [asistentes, setAsistentes] = useState([])
  const [loadingAsistentes, setLoadingAsistentes] = useState(false)
  const [subiendoAvatar, setSubiendoAvatar] = useState(false)
  const [cancelando, setCancelando] = useState(null)
  const [editando, setEditando] = useState(null)
  const [formEditar, setFormEditar] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const avatarRef = useRef(null)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate("/login"); return }
      setUser(user)

      const { data: perfil } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (!perfil || perfil.tipo !== "anfitrion") {
        navigate("/ser-anfitrion")
        return
      }
      setPerfil(perfil)

      const { data: eventos } = await supabase
        .from("eventos")
        .select("*")
        .eq("anfitrion_id", user.id)
        .order("fecha", { ascending: true })

      setEventos(eventos || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const verAsistentes = async (evento) => {
    setEventoSeleccionado(evento)
    setLoadingAsistentes(true)
    setTab("asistentes")
    const { data } = await supabase
      .from("boletos")
      .select("*, profiles(nombre, email, avatar_url)")
      .eq("evento_id", evento.id)
      .eq("estado", "activo")
    setAsistentes(data || [])
    setLoadingAsistentes(false)
  }

  const cancelarEvento = async (eventoId) => {
    if (!window.confirm("¿Estás seguro de cancelar este evento? Se notificará a todos los asistentes y se procesarán los reembolsos.")) return
    setCancelando(eventoId)
    const { error } = await supabase
      .from("eventos")
      .delete()
      .eq("id", eventoId)
    if (!error) {
      setEventos(prev => prev.filter(e => e.id !== eventoId))
      setMensaje("Evento cancelado correctamente.")
      setTimeout(() => setMensaje(""), 3000)
    }
    setCancelando(null)
  }

  const abrirEditar = (evento) => {
    setEditando(evento.id)
    setFormEditar({
      titulo: evento.titulo,
      descripcion: evento.descripcion || "",
      ubicacion: evento.ubicacion,
      capacidad: evento.capacidad,
      precio: evento.precio,
      fecha: evento.fecha ? evento.fecha.split("T")[0] : "",
      hora: evento.fecha ? evento.fecha.split("T")[1]?.slice(0, 5) : "",
    })
  }

  const guardarEdicion = async () => {
    setGuardando(true)
    const fechaCompleta = `${formEditar.fecha}T${formEditar.hora}:00`
    const { error } = await supabase
      .from("eventos")
      .update({
        titulo: formEditar.titulo,
        descripcion: formEditar.descripcion,
        ubicacion: formEditar.ubicacion,
        capacidad: parseInt(formEditar.capacidad),
        precio: parseInt(formEditar.precio) || 0,
        fecha: fechaCompleta,
      })
      .eq("id", editando)

    if (!error) {
      setEventos(prev => prev.map(e => e.id === editando ? { ...e, ...formEditar, fecha: fechaCompleta } : e))
      setEditando(null)
      setMensaje("Evento actualizado correctamente.")
      setTimeout(() => setMensaje(""), 3000)
    }
    setGuardando(false)
  }

  const subirAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setMensaje("La imagen no puede pesar más de 5MB"); return }
    setSubiendoAvatar(true)
    const ext = file.name.split(".").pop()
    const nombre = `${user.id}-avatar.${ext}`
    await supabase.storage.from("avatars").upload(nombre, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(nombre)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id)
    setPerfil(prev => ({ ...prev, avatar_url: publicUrl }))
    setSubiendoAvatar(false)
    setMensaje("Foto de perfil actualizada.")
    setTimeout(() => setMensaje(""), 3000)
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "10px 14px", color: "white", fontSize: "14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box"
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando panel...
    </div>
  )

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
          Inicio
        </Link>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 64px" }}>

        {/* MENSAJE */}
        <AnimatePresence>
          {mensaje && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}
            >✓ {mensaje}</motion.div>
          )}
        </AnimatePresence>

        {/* PERFIL */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "32px", marginBottom: "48px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "32px" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: "88px", height: "88px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: 700, boxShadow: "0 0 24px rgba(124,58,237,0.4)" }}>
              {perfil?.avatar_url ? (
                <img src={perfil.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                perfil?.nombre?.charAt(0) || "A"
              )}
            </div>
            <input type="file" ref={avatarRef} accept="image/*" onChange={subirAvatar} style={{ display: "none" }} />
            <motion.button onClick={() => avatarRef.current.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
              disabled={subiendoAvatar}
              style={{ position: "absolute", bottom: 0, right: 0, width: "28px", height: "28px", borderRadius: "999px", background: "#7c3aed", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              {subiendoAvatar ? (
                <div style={{ width: "10px", height: "10px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "999px", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              )}
            </motion.button>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.3px" }}>{perfil?.nombre}</h1>
              <span style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: "999px", padding: "3px 10px", fontSize: "12px", fontWeight: 600, color: "#a78bfa" }}>⚡ Anfitrión</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "16px" }}>{perfil?.email}</p>
            <div style={{ display: "flex", gap: "24px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "20px" }}>{eventos.length}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Eventos creados</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "20px" }}>{eventos.reduce((acc, e) => acc + (e.capacidad || 0), 0)}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Cupos totales</div>
              </div>
            </div>
          </div>
          <motion.button onClick={() => navigate("/crear-evento")} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }}
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: "white", padding: "12px 24px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 0 16px rgba(124,58,237,0.3)" }}
          >+ Crear evento</motion.button>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "4px", width: "fit-content" }}>
          {[
            { id: "eventos", label: "Mis eventos" },
            { id: "asistentes", label: eventoSeleccionado ? `Asistentes · ${eventoSeleccionado.titulo}` : "Asistentes" },
          ].map(t => (
            <motion.button key={t.id} onClick={() => setTab(t.id)} whileTap={{ scale: 0.97 }}
              style={{ padding: "8px 20px", borderRadius: "9px", cursor: "pointer", border: "none", background: tab === t.id ? "rgba(124,58,237,0.3)" : "transparent", color: tab === t.id ? "white" : "rgba(255,255,255,0.45)", fontSize: "14px", fontWeight: tab === t.id ? 600 : 500, fontFamily: "inherit", transition: "all 0.15s", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >{t.label}</motion.button>
          ))}
        </div>

        {/* EVENTOS */}
        {tab === "eventos" && (
          <div>
            {eventos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📅</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>Aún no tienes eventos</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px" }}>Crea tu primer evento y empieza a vender boletos</div>
                <motion.button onClick={() => navigate("/crear-evento")} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }}
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "10px", color: "white", padding: "12px 28px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >Crear evento</motion.button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {eventos.map(ev => {
                  const fecha = new Date(ev.fecha)
                  const pasado = fecha < new Date()
                  return (
                    <motion.div key={ev.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, fontSize: "16px" }}>{ev.titulo}</span>
                          <span style={{ background: pasado ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.2)", border: `1px solid ${pasado ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.35)"}`, borderRadius: "999px", padding: "2px 10px", fontSize: "11px", fontWeight: 600, color: pasado ? "rgba(255,255,255,0.4)" : "#a78bfa" }}>
                            {pasado ? "Finalizado" : "Activo"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "20px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                          <span>📅 {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>📍 {ev.ubicacion}</span>
                          <span>👥 {ev.capacidad} cupos</span>
                          <span>💰 {ev.precio === 0 ? "Gratis" : `$${ev.precio} MXN`}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <motion.button onClick={() => verAsistentes(ev)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: "rgba(255,255,255,0.7)", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                        >Ver asistentes</motion.button>
                        <motion.button onClick={() => abrirEditar(ev)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: "rgba(255,255,255,0.7)", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                        >Editar</motion.button>
                        <motion.button onClick={() => cancelarEvento(ev.id)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          disabled={cancelando === ev.id}
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                        >{cancelando === ev.id ? "..." : "Cancelar"}</motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ASISTENTES */}
        {tab === "asistentes" && (
          <div>
            {!eventoSeleccionado ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>
                Selecciona un evento para ver sus asistentes
              </div>
            ) : loadingAsistentes ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)" }}>Cargando asistentes...</div>
            ) : asistentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>Aún no hay asistentes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Comparte tu evento para que la gente se registre</div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "16px", color: "rgba(255,255,255,0.4)", fontSize: "13.5px" }}>{asistentes.length} asistente{asistentes.length !== 1 ? "s" : ""} registrado{asistentes.length !== 1 ? "s" : ""}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {asistentes.map((boleto, i) => (
                    <motion.div key={boleto.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}
                    >
                      <div style={{ width: "40px", height: "40px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                        {boleto.profiles?.avatar_url ? (
                          <img src={boleto.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          boleto.profiles?.nombre?.charAt(0) || "U"
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{boleto.profiles?.nombre || "Usuario"}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px" }}>{boleto.profiles?.email}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "999px", padding: "4px 12px" }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#34d399" }} />
                        <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>Confirmado</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL EDITAR */}
      <AnimatePresence>
        {editando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
            onClick={(e) => e.target === e.currentTarget && setEditando(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.3px" }}>Editar evento</h2>
                <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Nombre *</label>
                  <input value={formEditar.titulo} onChange={e => setFormEditar(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Descripción</label>
                  <textarea value={formEditar.descripcion} onChange={e => setFormEditar(f => ({ ...f, descripcion: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Fecha</label>
                    <input type="date" value={formEditar.fecha} onChange={e => setFormEditar(f => ({ ...f, fecha: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Hora</label>
                    <input type="time" value={formEditar.hora} onChange={e => setFormEditar(f => ({ ...f, hora: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Ubicación</label>
                  <input value={formEditar.ubicacion} onChange={e => setFormEditar(f => ({ ...f, ubicacion: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Capacidad</label>
                    <input type="number" value={formEditar.capacidad} onChange={e => setFormEditar(f => ({ ...f, capacidad: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Precio (MXN)</label>
                    <input type="number" value={formEditar.precio} onChange={e => setFormEditar(f => ({ ...f, precio: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <motion.button onClick={guardarEdicion} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={guardando}
                  style={{ flex: 1, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "10px", color: "white", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: guardando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: guardando ? 0.7 : 1 }}
                >{guardando ? "Guardando..." : "Guardar cambios"}</motion.button>
                <motion.button onClick={() => setEditando(null)} whileHover={{ borderColor: "rgba(255,255,255,0.3)" }} whileTap={{ scale: 0.97 }}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", color: "rgba(255,255,255,0.6)", padding: "12px 20px", fontWeight: 500, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >Cancelar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
