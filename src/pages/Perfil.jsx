import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "../supabase"
import { Link, useNavigate } from "react-router-dom"

export default function Perfil() {
  const navigate = useNavigate()
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

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando perfil...
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

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "48px 24px" }}>

        <AnimatePresence>
          {mensaje && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}
            >✓ {mensaje}</motion.div>
          )}
        </AnimatePresence>

        {/* PERFIL */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "32px", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>

            {/* AVATAR */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div
                onClick={() => perfil?.avatar_url && setModalAvatar(true)}
                style={{ width: "88px", height: "88px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: 700, cursor: perfil?.avatar_url ? "pointer" : "default", boxShadow: "0 0 24px rgba(124,58,237,0.35)" }}
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
                style={{ position: "absolute", bottom: 0, right: 0, width: "28px", height: "28px", borderRadius: "999px", background: "#7c3aed", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                {subiendoAvatar ? (
                  <div style={{ width: "10px", height: "10px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "999px", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                )}
              </motion.button>
            </div>

            {/* INFO */}
            <div style={{ flex: 1 }}>
              {editandoNombre ? (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                  <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && guardarNombre()}
                    style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "8px 12px", color: "white", fontSize: "16px", fontFamily: "inherit", outline: "none", width: "220px" }}
                    autoFocus
                  />
                  <motion.button onClick={guardarNombre} whileTap={{ scale: 0.97 }} disabled={guardandoNombre}
                    style={{ background: "#7c3aed", border: "none", borderRadius: "8px", color: "white", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >{guardandoNombre ? "..." : "Guardar"}</motion.button>
                  <button onClick={() => setEditandoNombre(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "18px" }}>×</button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>{perfil?.nombre}</h1>
                  <motion.button onClick={() => setEditandoNombre(true)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "2px", display: "flex" }}
                    title="Editar nombre"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </motion.button>
                </div>
              )}
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "12px" }}>{user?.email}</div>
              <div style={{ display: "flex", gap: "20px" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "18px" }}>{boletos.length}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12.5px" }}>Boletos activos</div>
                </div>
                {perfil?.tipo === "anfitrion" && (
                  <div>
                    <motion.button onClick={() => navigate("/panel")} whileHover={{ color: "#a78bfa" }}
                      style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "8px", color: "#a78bfa", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >⚡ Ir al panel de anfitrión</motion.button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOLETOS */}
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "20px", letterSpacing: "-0.3px" }}>Mis boletos</h2>
        {boletos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎟️</div>
            <div style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px" }}>No tienes boletos todavía</div>
            <Link to="/explorar" style={{ color: "#a78bfa", fontSize: "14px", textDecoration: "none" }}>Explorar eventos →</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {boletos.map((boleto, i) => {
              const ev = boleto.eventos
              const fecha = ev?.fecha ? new Date(ev.fecha) : null
              return (
                <motion.div key={boleto.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", overflow: "hidden", display: "grid", gridTemplateColumns: "140px 1fr auto" }}
                >
                  <div style={{ position: "relative", minHeight: "110px" }}>
                    <img src={ev?.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80"} alt={ev?.titulo}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 50%, #0f0f11 100%)" }} />
                  </div>
                  <div style={{ padding: "18px 16px" }}>
                    <span style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "999px", padding: "2px 10px", fontSize: "11px", fontWeight: 600, color: "#a78bfa", marginBottom: "8px", display: "inline-block" }}>{ev?.categoria}</span>
                    <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>{ev?.titulo}</div>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12.5px" }}>
                      {fecha ? `${fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · ${fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : ""} · {ev?.ubicacion}
                    </div>
                  </div>
                  <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontWeight: 700, fontSize: "18px" }}>{ev?.precio === 0 ? "Gratis" : `$${ev?.precio}`}</div>
                    <Link to={`/evento/${boleto.evento_id}`} style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Ver evento →</Link>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL AVATAR */}
      <AnimatePresence>
        {modalAvatar && perfil?.avatar_url && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModalAvatar(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          >
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }} onClick={e => e.stopPropagation()}
              style={{ maxWidth: "400px", width: "100%", position: "relative" }}
            >
              <img src={perfil.avatar_url} alt={perfil.nombre} style={{ width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }} />
              <div style={{ textAlign: "center", marginTop: "16px", color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>{perfil.nombre}</div>
              <button onClick={() => setModalAvatar(false)} style={{ position: "absolute", top: "-12px", right: "-12px", width: "32px", height: "32px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
