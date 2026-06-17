import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
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

export default function PanelAnfitrion() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("eventos")
  const [solicitudes, setSolicitudes] = useState([])
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [asistentes, setAsistentes] = useState([])
  const [loadingAsistentes, setLoadingAsistentes] = useState(false)
  const [subiendoAvatar, setSubiendoAvatar] = useState(false)
  const [cancelando, setCancelando] = useState(null)
  const [editando, setEditando] = useState(null)
  const [formEditar, setFormEditar] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [modalAvatar, setModalAvatar] = useState(false)
  const [fotoZoom, setFotoZoom] = useState(null)
  const avatarRef = useRef(null)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      setUser(user)
      const { data: perfil } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (!perfil || perfil.tipo !== "anfitrion" || perfil.estado_anfitrion !== "aprobado") { navigate("/ser-anfitrion"); return }
      setPerfil(perfil)
      const { data: eventos } = await supabase.from("eventos").select("*").eq("anfitrion_id", user.id).order("created_at", { ascending: false })
      setEventos(eventos || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const verAsistentes = async (evento) => {
    setEventoSeleccionado(evento)
    setLoadingAsistentes(true)
    setTab("asistentes")
    const { data } = await supabase.from("boletos").select("*, profiles(nombre, email, avatar_url)").eq("evento_id", evento.id).eq("estado", "activo")
    setAsistentes(data || [])
    setLoadingAsistentes(false)
  }

  const verSolicitudes = async () => {
    setLoadingSolicitudes(true)
    setTab("solicitudes")
    const eventosIds = eventos.map(e => e.id)
    if (eventosIds.length === 0) { setSolicitudes([]); setLoadingSolicitudes(false); return }
    const { data } = await supabase.from("boletos").select("*, eventos(titulo, fecha), profiles(nombre, email, avatar_url)").in("evento_id", eventosIds).eq("estado", "pendiente")
    setSolicitudes(data || [])
    setLoadingSolicitudes(false)
  }

  const aprobarSolicitud = async (boletoId) => {
    setProcesando(boletoId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestionar-solicitud`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ boleto_id: boletoId, accion: "aprobar" })
    })
    setSolicitudes(prev => prev.filter(s => s.id !== boletoId))
    setProcesando(null)
  }

  const rechazarSolicitud = async (boletoId) => {
    setProcesando(boletoId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestionar-solicitud`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ boleto_id: boletoId, accion: "rechazar" })
    })
    setSolicitudes(prev => prev.filter(s => s.id !== boletoId))
    setProcesando(null)
  }

  const cancelarEvento = async (eventoId) => {
    if (!window.confirm("¿Estás seguro de cancelar este evento? Se procesarán los reembolsos automáticamente.")) return
    setCancelando(eventoId)
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancelar-evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ evento_id: eventoId, anfitrion_id: user.id })
    })
    const data = await response.json()
    if (data.ok) {
      setEventos(prev => prev.filter(e => e.id !== eventoId))
      setMensaje(`Evento cancelado. ${data.reembolsados > 0 ? `Se procesaron ${data.reembolsados} reembolso${data.reembolsados > 1 ? "s" : ""}.` : ""}`)
      setTimeout(() => setMensaje(""), 5000)
    } else {
      setMensaje("Error al cancelar el evento. Intenta de nuevo.")
      setTimeout(() => setMensaje(""), 3000)
    }
    setCancelando(null)
  }

  const abrirEditar = (evento) => {
    setEditando(evento.id)
    const fechaLocal = evento.fecha ? new Date(evento.fecha) : null
    setFormEditar({
      titulo: evento.titulo,
      descripcion: evento.descripcion || "",
      ubicacion: evento.ubicacion,
      estado_evento: evento.estado_evento || "",
      capacidad: evento.capacidad,
      precio: evento.precio,
      max_boletos_por_persona: evento.max_boletos_por_persona || 5,
      // Extraídas ambas de la MISMA fecha ya convertida a hora local —
      // antes "fecha" se tomaba directo del string UTC sin convertir,
      // mientras "hora" sí se convertía, lo cual desalineaba la fecha un
      // día para eventos guardados después de las 6pm hora de Querétaro.
      fecha: fechaLocal ? `${fechaLocal.getFullYear()}-${String(fechaLocal.getMonth() + 1).padStart(2, "0")}-${String(fechaLocal.getDate()).padStart(2, "0")}` : "",
      hora: fechaLocal ? fechaLocal.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
    })
  }

  const guardarEdicion = async () => {
    const titulo = formEditar.titulo.trim()
    const ubicacion = formEditar.ubicacion.trim()

    const eventoOriginal = eventos.find(e => e.id === editando)
    if (eventoOriginal && new Date(eventoOriginal.fecha) < new Date(Date.now() - 5 * 60 * 60 * 1000)) {
      setMensaje("Este evento ya finalizó (pasaron más de 5 horas desde su inicio) y no se puede editar.")
      setTimeout(() => setMensaje(""), 4000)
      setEditando(null)
      return
    }

    if (!titulo || !ubicacion || !formEditar.fecha || !formEditar.hora || !formEditar.capacidad) {
      setMensaje("Por favor llena todos los campos obligatorios")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if (titulo.length > 150) {
      setMensaje("El título no puede tener más de 150 caracteres")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if (ubicacion.length > 200) {
      setMensaje("La ubicación no puede tener más de 200 caracteres")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if ((formEditar.descripcion || "").length > 2000) {
      setMensaje("La descripción no puede tener más de 2000 caracteres")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const capacidad = parseInt(formEditar.capacidad)
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 50000) {
      setMensaje("La capacidad debe ser un número entre 1 y 50,000")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const precio = formEditar.precio === "" ? 0 : parseInt(formEditar.precio)
    if (!Number.isInteger(precio) || precio < 0 || precio > 50000) {
      setMensaje("El precio debe ser un número entre 0 y 50,000")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const maxBoletos = formEditar.max_boletos_por_persona === "" ? 5 : parseInt(formEditar.max_boletos_por_persona)
    if (!Number.isInteger(maxBoletos) || maxBoletos < 1 || maxBoletos > 20) {
      setMensaje("El máximo de boletos por persona debe ser un número entre 1 y 20")
      setTimeout(() => setMensaje(""), 3000)
      return
    }

    setGuardando(true)
    const fechaCompleta = new Date(`${formEditar.fecha}T${formEditar.hora}:00`).toISOString()
    const { data, error } = await supabase.from("eventos").update({
      titulo, descripcion: (formEditar.descripcion || "").trim(), ubicacion,
      estado_evento: formEditar.estado_evento || null, capacidad,
      precio, max_boletos_por_persona: maxBoletos,
      fecha: fechaCompleta,
    }).eq("id", editando).select()

    if (!error && data && data.length > 0) {
      setEventos(prev => prev.map(e => e.id === editando ? { ...e, ...formEditar, titulo, ubicacion, capacidad, precio, max_boletos_por_persona: maxBoletos, fecha: fechaCompleta } : e))
      setEditando(null)
      setMensaje("Evento actualizado correctamente.")
      setTimeout(() => setMensaje(""), 3000)
    } else if (!error && (!data || data.length === 0)) {
      // RLS bloqueó la actualización sin lanzar un error explícito (esto
      // pasa, por ejemplo, si el evento ya finalizó hace más de 5 horas
      // justo mientras el modal estaba abierto).
      setMensaje("No se pudo guardar: este evento ya no se puede editar (probablemente finalizó).")
      setTimeout(() => setMensaje(""), 4000)
      setEditando(null)
    } else {
      setMensaje("Error al actualizar el evento. Intenta de nuevo.")
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
    const nombre = `${user.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from("avatars").upload(nombre, file)
    if (uploadError) { setMensaje("Error al subir la imagen."); setSubiendoAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(nombre)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id)
    setPerfil(prev => ({ ...prev, avatar_url: `${publicUrl}?t=${Date.now()}` }))
    setSubiendoAvatar(false)
    setMensaje("Foto de perfil actualizada.")
    setTimeout(() => setMensaje(""), 3000)
  }

  const conectarMP = () => {
    const clientId = import.meta.env.VITE_MP_CLIENT_ID
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-oauth`
    const url = `https://auth.mercadopago.com.mx/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${user.id}&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.location.href = url
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "10px 14px", color: "white", fontSize: "14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(124,58,237,0.1)",
    transition: "border 0.2s"
  }

  const tabs = [
    { id: "eventos", label: "Mis eventos" },
    { id: "asistentes", label: eventoSeleccionado ? (isMobile ? "Asistentes" : `Asistentes · ${eventoSeleccionado.titulo}`) : "Asistentes" },
    { id: "solicitudes", label: isMobile ? "Solicitudes" : "Solicitudes pendientes" },
  ]

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando panel...
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
          {!isMobile && "Inicio"}
        </Link>
      </nav>

      {/* HEADER con degradado */}
      <div style={{ background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 40%, #080808 100%)", padding: isMobile ? "28px 18px 24px" : "48px 64px 40px", borderBottom: "1px solid rgba(124,58,237,0.12)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-60px", right: "10%", width: "500px", height: "300px", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative" }}>

          {/* Perfil card dentro del header */}
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? "16px" : "28px", flexDirection: isMobile ? "column" : "row" }}>

            {/* Avatar + info */}
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "16px" : "24px", flex: 1 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: isMobile ? "68px" : "80px", height: isMobile ? "68px" : "80px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? "26px" : "30px", fontWeight: 700, boxShadow: "0 0 28px rgba(124,58,237,0.45), 0 0 0 2px rgba(124,58,237,0.25)" }}>
                  {perfil?.avatar_url ? (
                    <img src={perfil.avatar_url} alt="avatar" onClick={() => setModalAvatar(true)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
                  ) : perfil?.nombre?.charAt(0) || "A"}
                </div>
                <input type="file" ref={avatarRef} accept="image/*" onChange={subirAvatar} style={{ display: "none" }} />
                <motion.button onClick={() => avatarRef.current.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} disabled={subiendoAvatar}
                  style={{ position: "absolute", bottom: 0, right: 0, width: "26px", height: "26px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 8px rgba(124,58,237,0.5)" }}
                >
                  {subiendoAvatar ? <div style={{ width: "9px", height: "9px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "999px", animation: "spin 0.8s linear infinite" }} /> : <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
                </motion.button>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: isMobile ? "1.2rem" : "1.4rem", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>{perfil?.nombre}</h1>
                  <span style={{ background: "rgba(124,58,237,0.25)", border: "1.5px solid rgba(124,58,237,0.4)", borderRadius: "999px", padding: "2px 10px", fontSize: "11.5px", fontWeight: 600, color: "#a78bfa" }}>⚡ Anfitrión</span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "0 0 10px" }}>{perfil?.email}</p>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "10px", padding: "6px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", color: "#a78bfa" }}>{eventos.length}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>Eventos</div>
                  </div>
                  <div style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "10px", padding: "6px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", color: "#a78bfa" }}>{eventos.reduce((acc, e) => acc + (e.capacidad || 0), 0)}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>Cupos totales</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: "10px", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "center" : "flex-end", flexWrap: "wrap" }}>
              <motion.button onClick={() => navigate("/crear-evento")} whileTap={{ scale: 0.97 }}
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: "white", padding: isMobile ? "10px 16px" : "11px 22px", fontWeight: 600, fontSize: isMobile ? "13px" : "14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 0 18px rgba(124,58,237,0.4)" }}
              >+ Crear evento</motion.button>

              {perfil?.mp_access_token ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "8px", padding: "5px 11px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#34d399" }} />
                    <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>MP conectado ✓</span>
                  </div>
                  <motion.button onClick={conectarMP} whileTap={{ scale: 0.97 }}
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px", color: "rgba(255,255,255,0.35)", padding: "3px 9px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
                  >Reconectar</motion.button>
                </div>
              ) : (
                <motion.button onClick={conectarMP} whileTap={{ scale: 0.97 }}
                  style={{ background: "rgba(9,103,210,0.15)", border: "1.5px solid rgba(9,103,210,0.3)", borderRadius: "10px", color: "#60a5fa", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >💳 Conectar Mercado Pago</motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "20px 18px 48px" : "36px 64px 60px" }}>

        <AnimatePresence>
          {mensaje && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "12px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}
            >✓ {mensaje}</motion.div>
          )}
        </AnimatePresence>

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "4px", width: isMobile ? "100%" : "fit-content" }}>
          {tabs.map(t => (
            <motion.button key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "solicitudes") verSolicitudes() }}
              whileTap={{ scale: 0.97 }}
              style={{ flex: isMobile ? 1 : "none", padding: isMobile ? "9px 8px" : "8px 20px", borderRadius: "10px", cursor: "pointer", border: "none", background: tab === t.id ? "rgba(124,58,237,0.35)" : "transparent", color: tab === t.id ? "white" : "rgba(255,255,255,0.45)", fontSize: isMobile ? "12.5px" : "14px", fontWeight: tab === t.id ? 600 : 500, fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap", boxShadow: tab === t.id ? "0 0 12px rgba(124,58,237,0.25)" : "none" }}
            >{t.label}</motion.button>
          ))}
        </div>

        {/* TAB: EVENTOS */}
        {tab === "eventos" && (
          <div>
            {eventos.length === 0 ? (
              <div style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "16px" }}>📅</div>
                <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>Aún no tienes eventos</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px" }}>Crea tu primer evento y empieza a vender boletos</div>
                <motion.button onClick={() => navigate("/crear-evento")} whileTap={{ scale: 0.97 }}
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: "white", padding: "12px 28px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 18px rgba(124,58,237,0.35)" }}
                >Crear evento</motion.button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {eventos.map(ev => {
                  const fecha = new Date(ev.fecha)
                  const pasado = fecha < new Date()
                  const finalizado = fecha < new Date(Date.now() - 5 * 60 * 60 * 1000)
                  return (
                    <motion.div key={ev.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: isMobile ? "16px" : "20px 24px" }}
                    >
                      {isMobile ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px", gap: "10px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.titulo}</div>
                              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12.5px" }}>
                                {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {ev.ubicacion}
                              </div>
                            </div>
                            <span style={{ background: pasado ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.2)", border: `1.5px solid ${pasado ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.35)"}`, borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 600, color: pasado ? "rgba(255,255,255,0.4)" : "#a78bfa", flexShrink: 0 }}>
                              {pasado ? "Finalizado" : "Activo"}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <motion.button onClick={() => navigate(`/evento/${ev.id}`)} whileTap={{ scale: 0.95 }}
                              style={{ flex: 1, background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "9px", color: "#a78bfa", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Ir a evento</motion.button>
                            <motion.button onClick={() => verAsistentes(ev)} whileTap={{ scale: 0.95 }}
                              style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: "rgba(255,255,255,0.7)", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Asistentes</motion.button>
                            <motion.button onClick={() => !finalizado && abrirEditar(ev)} whileTap={{ scale: finalizado ? 1 : 0.95 }} disabled={finalizado}
                              title={finalizado ? "No se puede editar un evento finalizado" : ""}
                              style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: finalizado ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: finalizado ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                            >Editar</motion.button>
                            <motion.button onClick={() => cancelarEvento(ev.id)} whileTap={{ scale: 0.95 }} disabled={cancelando === ev.id}
                              style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >{cancelando === ev.id ? "..." : "Cancelar"}</motion.button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                              <span style={{ fontWeight: 600, fontSize: "15.5px" }}>{ev.titulo}</span>
                              <span style={{ background: pasado ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.2)", border: `1.5px solid ${pasado ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.35)"}`, borderRadius: "999px", padding: "2px 10px", fontSize: "11px", fontWeight: 600, color: pasado ? "rgba(255,255,255,0.4)" : "#a78bfa" }}>
                                {pasado ? "Finalizado" : "Activo"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "20px", color: "rgba(255,255,255,0.4)", fontSize: "13px", flexWrap: "wrap" }}>
                              <span>📅 {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                              <span>📍 {ev.ubicacion}</span>
                              <span>👥 {ev.capacidad} cupos</span>
                              <span>💰 {ev.precio === 0 ? "Gratis" : `$${ev.precio} MXN`}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <motion.button onClick={() => navigate(`/evento/${ev.id}`)} whileTap={{ scale: 0.97 }}
                              style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "9px", color: "#a78bfa", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Ir a evento</motion.button>
                            <motion.button onClick={() => verAsistentes(ev)} whileTap={{ scale: 0.97 }}
                              style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: "rgba(255,255,255,0.7)", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Ver asistentes</motion.button>
                            <motion.button onClick={() => !finalizado && abrirEditar(ev)} whileTap={{ scale: finalizado ? 1 : 0.97 }} disabled={finalizado}
                              title={finalizado ? "No se puede editar un evento finalizado" : ""}
                              style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: finalizado ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: finalizado ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                            >Editar</motion.button>
                            <motion.button onClick={() => cancelarEvento(ev.id)} whileTap={{ scale: 0.97 }} disabled={cancelando === ev.id}
                              style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >{cancelando === ev.id ? "..." : "Cancelar"}</motion.button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: SOLICITUDES */}
        {tab === "solicitudes" && (
          <div>
            {loadingSolicitudes ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)" }}>Cargando solicitudes...</div>
            ) : solicitudes.length === 0 ? (
              <div style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "16px" }}>✅</div>
                <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>No hay solicitudes pendientes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Cuando alguien solicite un boleto aparecerá aquí</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {solicitudes.map((sol, i) => (
                  <motion.div key={sol.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: isMobile ? "14px" : "16px 20px", display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: "12px", flexDirection: isMobile ? "column" : "row" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                        {sol.profiles?.avatar_url ? <img src={sol.profiles.avatar_url} alt="" onClick={() => setFotoZoom(sol.profiles.avatar_url)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} /> : sol.profiles?.nombre?.charAt(0) || "U"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{sol.profiles?.nombre || "Usuario"}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px" }}>{sol.eventos?.titulo} · {sol.profiles?.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", width: isMobile ? "100%" : "auto" }}>
                      <motion.button onClick={() => aprobarSolicitud(sol.id)} whileTap={{ scale: 0.97 }} disabled={procesando === sol.id}
                        style={{ flex: isMobile ? 1 : "none", background: "rgba(16,185,129,0.15)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "9px", color: "#34d399", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >{procesando === sol.id ? "..." : "✓ Aprobar"}</motion.button>
                      <motion.button onClick={() => rechazarSolicitud(sol.id)} whileTap={{ scale: 0.97 }} disabled={procesando === sol.id}
                        style={{ flex: isMobile ? 1 : "none", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >✕ Rechazar</motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: ASISTENTES */}
        {tab === "asistentes" && (
          <div>
            {!eventoSeleccionado ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>
                Selecciona un evento desde "Mis eventos" para ver sus asistentes
              </div>
            ) : loadingAsistentes ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)" }}>Cargando asistentes...</div>
            ) : asistentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "16px" }}>👥</div>
                <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>Aún no hay asistentes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Comparte tu evento para que la gente se registre</div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "16px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>{asistentes.length} asistente{asistentes.length !== 1 ? "s" : ""} en <span style={{ color: "#a78bfa" }}>{eventoSeleccionado.titulo}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {asistentes.map((boleto, i) => (
                    <motion.div key={boleto.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: isMobile ? "14px" : "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}
                    >
                      <div style={{ width: "38px", height: "38px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                        {boleto.profiles?.avatar_url ? <img src={boleto.profiles.avatar_url} alt="" onClick={() => setFotoZoom(boleto.profiles.avatar_url)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} /> : boleto.profiles?.nombre?.charAt(0) || "U"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{boleto.profiles?.nombre || "Usuario"}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{boleto.profiles?.email}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "999px", padding: "4px 11px", flexShrink: 0 }}>
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
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
            onClick={e => e.target === e.currentTarget && setEditando(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: "#111113", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: isMobile ? "24px 18px" : "32px", width: "100%", maxWidth: "560px", maxHeight: "92vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>Editar evento</h2>
                <button onClick={() => setEditando(null)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "18px", cursor: "pointer", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Nombre *</label>
                  <input value={formEditar.titulo} onChange={e => setFormEditar(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Descripción</label>
                  <textarea value={formEditar.descripcion} onChange={e => setFormEditar(f => ({ ...f, descripcion: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Fecha</label>
                    <input type="date" value={formEditar.fecha} onChange={e => setFormEditar(f => ({ ...f, fecha: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Hora</label>
                    <input type="time" value={formEditar.hora} onChange={e => setFormEditar(f => ({ ...f, hora: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Ubicación</label>
                  <input value={formEditar.ubicacion} onChange={e => setFormEditar(f => ({ ...f, ubicacion: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Estado</label>
                  <select value={formEditar.estado_evento || ""} onChange={e => setFormEditar(f => ({ ...f, estado_evento: e.target.value }))} style={{ ...inputStyle, cursor: "pointer", colorScheme: "dark" }}>
                    <option value="" style={{ background: "#111" }}>Selecciona un estado</option>
                    {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                      <option key={e} value={e} style={{ background: "#111" }}>{e}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Capacidad</label>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>¿Cuántas personas pueden asistir?</div>
                    <input type="number" value={formEditar.capacidad} onChange={e => setFormEditar(f => ({ ...f, capacidad: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Precio (MXN)</label>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Lo que recibirás por cada boleto</div>
                    <input type="number" value={formEditar.precio} onChange={e => setFormEditar(f => ({ ...f, precio: e.target.value }))} disabled={!perfil?.mp_access_token}
                      style={{ ...inputStyle, opacity: perfil?.mp_access_token ? 1 : 0.5, cursor: perfil?.mp_access_token ? "text" : "not-allowed" }} />
                    {!perfil?.mp_access_token && (
                      <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginTop: "5px" }}>Conecta Mercado Pago para poder cobrar por tus boletos.</div>
                    )}
                    {formEditar.precio > 0 && (
                      <div style={{ marginTop: "8px", padding: "10px 14px", background: "rgba(124,58,237,0.1)", border: "1.5px solid rgba(124,58,237,0.22)", borderRadius: "10px", fontSize: "13px" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Precio final al asistente: </span>
                        <span style={{ color: "#a78bfa", fontWeight: 700 }}>${Math.round(parseInt(formEditar.precio) * 1.10)} MXN</span>
                        <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "11px", marginLeft: "5px" }}>(+10% VELA)</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Límite de boletos por persona</label>
                  <input type="number" value={formEditar.max_boletos_por_persona} onChange={e => setFormEditar(f => ({ ...f, max_boletos_por_persona: e.target.value }))} min="1" max="20" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <motion.button onClick={guardarEdicion} whileTap={{ scale: 0.97 }} disabled={guardando}
                  style={{ flex: 1, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "11px", color: "white", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: guardando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: guardando ? 0.7 : 1, boxShadow: "0 0 16px rgba(124,58,237,0.35)" }}
                >{guardando ? "Guardando..." : "Guardar cambios"}</motion.button>
                <motion.button onClick={() => setEditando(null)} whileTap={{ scale: 0.97 }}
                  style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: "11px", color: "rgba(255,255,255,0.6)", padding: "12px 20px", fontWeight: 500, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >Cancelar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL AVATAR PROPIO */}
      {modalAvatar && perfil?.avatar_url && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setModalAvatar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", width: "100%" }}>
            <img src={perfil.avatar_url} alt={perfil.nombre} style={{ width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }} />
            <div style={{ textAlign: "center", marginTop: "16px", color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>{perfil.nombre}</div>
          </motion.div>
        </motion.div>
      )}

      {/* ZOOM FOTO ASISTENTE */}
      {fotoZoom && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setFotoZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <motion.img initial={{ scale: 0.85 }} animate={{ scale: 1 }} src={fotoZoom} alt="foto"
            style={{ maxWidth: "400px", width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          />
        </motion.div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}