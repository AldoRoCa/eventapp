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

export default function Perfil() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [boletos, setBoletos] = useState([])
  const [loading, setLoading] = useState(true)
  const [subiendoAvatar, setSubiendoAvatar] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [modalAvatar, setModalAvatar] = useState(false)
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [confirmacionTexto, setConfirmacionTexto] = useState("")
  const [eliminando, setEliminando] = useState(false)
  const avatarRef = useRef(null)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      setUser(user)
      const { data: perfil } = await supabase.from("profiles").select("id, nombre, avatar_url, tipo").eq("id", user.id).single()
      setPerfil(perfil)
      setNuevoNombre(perfil?.nombre || "")
      const { data: boletos } = await supabase
        .from("boletos")
        .select("*, eventos(titulo, fecha, ubicacion, categoria, imagen_url, precio)")
        .eq("usuario_id", user.id)
        .eq("estado", "activo")
        .order("created_at", { ascending: false })
      setBoletos(boletos || [])
      setLoading(false)
    }
    cargar()
  }, [])

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

  const guardarNombre = async () => {
    if (!nuevoNombre.trim()) return
    setGuardandoNombre(true)
    await supabase.from("profiles").update({ nombre: nuevoNombre }).eq("id", user.id)
    setPerfil(prev => ({ ...prev, nombre: nuevoNombre }))
    setEditandoNombre(false)
    setGuardandoNombre(false)
    setMensaje("Nombre actualizado.")
    setTimeout(() => setMensaje(""), 3000)
  }

  const eliminarCuenta = async () => {
    if (confirmacionTexto !== "ELIMINAR") return
    setEliminando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eliminar-cuenta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      })
      const json = await res.json()
      if (!res.ok) {
        setMensaje(json.error || "No se pudo eliminar la cuenta. Intenta de nuevo.")
        setEliminando(false)
        return
      }
      // La cuenta ya fue eliminada en el servidor — cerrar sesión local y
      // sacar al usuario a la pantalla de inicio.
      await supabase.auth.signOut()
      navigate("/")
    } catch {
      setMensaje("Error de conexión. Intenta de nuevo.")
      setEliminando(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando perfil...
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
      <div style={{ background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 40%, #080808 100%)", padding: isMobile ? "32px 18px 28px" : "52px 64px 44px", borderBottom: "1px solid rgba(124,58,237,0.12)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-60px", right: "20%", width: "500px", height: "280px", background: "radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "860px", margin: "0 auto", position: "relative" }}>
          <h1 style={{ fontSize: isMobile ? "1.7rem" : "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "4px" }}>Mi perfil</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: 0 }}>Gestiona tu cuenta y tus boletos</p>
        </div>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: isMobile ? "24px 18px 48px" : "40px 24px 60px" }}>

        <AnimatePresence>
          {mensaje && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "12px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}
            >✓ {mensaje}</motion.div>
          )}
        </AnimatePresence>

        {/* TARJETA PERFIL */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "22px", padding: isMobile ? "24px 20px" : "32px", marginBottom: "32px", position: "relative", overflow: "hidden" }}>
          {/* Glow sutil */}
          <div style={{ position: "absolute", top: "-40px", left: "-40px", width: "200px", height: "200px", background: "radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? "18px" : "24px", position: "relative" }}>

            {/* AVATAR */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                onClick={() => perfil?.avatar_url && setModalAvatar(true)}
                style={{ width: isMobile ? "76px" : "88px", height: isMobile ? "76px" : "88px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? "28px" : "32px", fontWeight: 700, cursor: perfil?.avatar_url ? "pointer" : "default", boxShadow: "0 0 28px rgba(124,58,237,0.4), 0 0 0 2px rgba(124,58,237,0.2)" }}
              >
                {perfil?.avatar_url ? (
                  <img src={perfil.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  perfil?.nombre?.charAt(0) || "U"
                )}
              </div>
              <input type="file" ref={avatarRef} accept="image/*" onChange={subirAvatar} style={{ display: "none" }} />
              <motion.button onClick={() => avatarRef.current.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                disabled={subiendoAvatar}
                style={{ position: "absolute", bottom: 0, right: 0, width: "28px", height: "28px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 10px rgba(124,58,237,0.5)" }}
              >
                {subiendoAvatar ? (
                  <div style={{ width: "10px", height: "10px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "999px", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                )}
              </motion.button>
            </div>

            {/* INFO */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editandoNombre ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px", flexWrap: "wrap" }}>
                  <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && guardarNombre()}
                    style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(124,58,237,0.4)", borderRadius: "10px", padding: "8px 12px", color: "white", fontSize: "15px", fontFamily: "inherit", outline: "none", width: isMobile ? "100%" : "220px" }}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <motion.button onClick={guardarNombre} whileTap={{ scale: 0.97 }} disabled={guardandoNombre}
                      style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "8px", color: "white", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 12px rgba(124,58,237,0.4)" }}
                    >{guardandoNombre ? "..." : "Guardar"}</motion.button>
                    <button onClick={() => setEditandoNombre(false)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "16px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px", flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: isMobile ? "1.2rem" : "1.3rem", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>{perfil?.nombre}</h2>
                  <motion.button onClick={() => setEditandoNombre(true)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "2px", display: "flex" }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </motion.button>
                </div>
              )}
              <div style={{ color: "rgba(255,255,255,0.38)", fontSize: "13.5px", marginBottom: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.2)", borderRadius: "10px", padding: "8px 16px" }}>
                  <div style={{ fontWeight: 700, fontSize: "17px", color: "#a78bfa" }}>{boletos.length}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11.5px" }}>Boletos activos</div>
                </div>
                {perfil?.tipo === "anfitrion" && (
                  <motion.button onClick={() => navigate("/panel")} whileTap={{ scale: 0.97 }}
                    style={{ background: "rgba(124,58,237,0.15)", border: "1.5px solid rgba(124,58,237,0.35)", borderRadius: "10px", color: "#a78bfa", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 12px rgba(124,58,237,0.15)" }}
                  >⚡ Ir al panel de anfitrión</motion.button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOLETOS */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "18px", letterSpacing: "-0.3px" }}>Mis boletos activos</h2>
        {boletos.length === 0 ? (
          <div style={{ textAlign: "center", padding: isMobile ? "48px 20px" : "60px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎟️</div>
            <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px" }}>No tienes boletos todavía</div>
            <Link to="/explorar" style={{ color: "#a78bfa", fontSize: "14px", textDecoration: "none", fontWeight: 500 }}>Explorar eventos →</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {boletos.map((boleto, i) => {
              const ev = boleto.eventos
              const fecha = ev?.fecha ? new Date(ev.fecha) : null
              return (
                <motion.div key={boleto.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden" }}
                >
                  {isMobile ? (
                    <div style={{ display: "flex", gap: "0" }}>
                      <div style={{ position: "relative", width: "100px", flexShrink: 0 }}>
                        <img src={ev?.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80"} alt={ev?.titulo}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 40%, #0f0f11 100%)" }} />
                      </div>
                      <div style={{ padding: "14px 14px 14px 10px", flex: 1, minWidth: 0 }}>
                        <span style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "999px", padding: "2px 9px", fontSize: "11px", fontWeight: 600, color: "#a78bfa", marginBottom: "6px", display: "inline-block" }}>{ev?.categoria}</span>
                        <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev?.titulo}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginBottom: "10px" }}>
                          {fecha ? `${fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · ${fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ fontWeight: 700, fontSize: "16px" }}>{ev?.precio === 0 ? "Gratis" : `$${ev?.precio}`}</div>
                          <Link to={`/evento/${boleto.evento_id}`} style={{ fontSize: "12.5px", color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>Ver →</Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto" }}>
                      <div style={{ position: "relative", minHeight: "110px" }}>
                        <img src={ev?.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80"} alt={ev?.titulo}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 50%, #0f0f11 100%)" }} />
                      </div>
                      <div style={{ padding: "18px 16px" }}>
                        <span style={{ background: "rgba(124,58,237,0.2)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "999px", padding: "2px 10px", fontSize: "11px", fontWeight: 600, color: "#a78bfa", marginBottom: "8px", display: "inline-block" }}>{ev?.categoria}</span>
                        <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>{ev?.titulo}</div>
                        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12.5px" }}>
                          {fecha ? `${fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · ${fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""} · {ev?.ubicacion}
                        </div>
                      </div>
                      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontWeight: 700, fontSize: "18px" }}>{ev?.precio === 0 ? "Gratis" : `$${ev?.precio}`}</div>
                        <Link to={`/evento/${boleto.evento_id}`} style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                          Ver evento
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {/* ZONA DE PELIGRO */}
        <div style={{ marginTop: "48px", padding: "20px", background: "rgba(239,68,68,0.04)", border: "1.5px solid rgba(239,68,68,0.15)", borderRadius: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "14.5px", marginBottom: "4px", color: "#f87171" }}>Eliminar cuenta</div>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", lineHeight: 1.6, marginBottom: "14px" }}>
            Esta acción es permanente. Si tienes eventos futuros con boletos vendidos, se reembolsarán automáticamente a los compradores antes de eliminar tu cuenta.
          </p>
          <button onClick={() => setModalEliminar(true)}
            style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "10px", color: "#f87171", padding: "9px 18px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >Eliminar mi cuenta</button>
        </div>
      </div>

      {/* MODAL AVATAR */}
      <AnimatePresence>
        {modalAvatar && perfil?.avatar_url && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModalAvatar(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          >
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }} onClick={e => e.stopPropagation()}
              style={{ maxWidth: "400px", width: "100%", position: "relative" }}
            >
              <img src={perfil.avatar_url} alt={perfil.nombre} style={{ width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }} />
              <div style={{ textAlign: "center", marginTop: "16px", color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>{perfil.nombre}</div>
              <button onClick={() => setModalAvatar(false)}
                style={{ position: "absolute", top: "-12px", right: "-12px", width: "32px", height: "32px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.15)", color: "white", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >×</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL ELIMINAR CUENTA */}
      <AnimatePresence>
        {modalEliminar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => !eliminando && setModalEliminar(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "#111114", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "18px", padding: "26px 24px", maxWidth: "420px", width: "100%" }}
            >
              <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "6px", color: "#f87171" }}>¿Eliminar tu cuenta?</div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", lineHeight: 1.6, marginBottom: "18px" }}>
                Esta acción no se puede deshacer. Tus eventos futuros con boletos vendidos se cancelarán y reembolsarán automáticamente. Tus eventos ya pasados se conservan como historial.
              </p>
              <label style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>
                Escribe <strong style={{ color: "white" }}>ELIMINAR</strong> para confirmar
              </label>
              <input value={confirmacionTexto} onChange={e => setConfirmacionTexto(e.target.value)} disabled={eliminando}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "10px 12px", color: "white", fontSize: "14px", fontFamily: "inherit", marginBottom: "20px" }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => { setModalEliminar(false); setConfirmacionTexto("") }} disabled={eliminando}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >Cancelar</button>
                <button onClick={eliminarCuenta} disabled={confirmacionTexto !== "ELIMINAR" || eliminando}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: confirmacionTexto === "ELIMINAR" && !eliminando ? "#ef4444" : "rgba(239,68,68,0.25)", color: "white", fontWeight: 600, fontSize: "14px", cursor: confirmacionTexto === "ELIMINAR" && !eliminando ? "pointer" : "default", fontFamily: "inherit" }}
                >{eliminando ? "Eliminando..." : "Eliminar cuenta"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}