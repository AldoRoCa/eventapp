import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
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

function StarPicker({ value, onChange, label }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>{label}</label>
      <div style={{ display: "flex", gap: "4px" }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", fontSize: "26px", lineHeight: 1, color: n <= value ? "#facc15" : "rgba(255,255,255,0.15)" }}
          >★</button>
        ))}
      </div>
    </div>
  )
}

export default function MisBoletos() {
  const isMobile = useIsMobile()
  const [boletos, setBoletos] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [reportando, setReportando] = useState(null) // boleto_id del modal abierto
  const [motivoReporte, setMotivoReporte] = useState("no_ocurrio")
  const [descripcionReporte, setDescripcionReporte] = useState("")
  const [enviandoReporte, setEnviandoReporte] = useState(false)
  const [reportesEnviados, setReportesEnviados] = useState({}) // { [boleto_id]: true }
  const [mensaje, setMensaje] = useState("")
  const [resenando, setResenando] = useState(null) // boleto_id del modal de reseña abierto
  const [estrellasEvento, setEstrellasEvento] = useState(0)
  const [estrellasAnfitrion, setEstrellasAnfitrion] = useState(0)
  const [comentarioResena, setComentarioResena] = useState("")
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [resenasGuardadas, setResenasGuardadas] = useState({}) // { [boleto_id]: { estrellas_evento, estrellas_anfitrion, comentario } }
  const [qrExpandido, setQrExpandido] = useState(null) // boleto_id cuyo QR está visible
  const navigate = useNavigate()

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      setUser(user)
      const { data } = await supabase
        .from("boletos")
        .select("*, eventos(titulo, fecha, ubicacion, categoria, imagen_url, precio, tipo_boleto, profiles(nombre)), mp_payment_id, codigo_grupo, nombre_registro")
        .eq("usuario_id", user.id)
        .in("estado", ["activo", "pendiente"])
        .order("created_at", { ascending: false })
      setBoletos(data || [])

      // Saber qué boletos ya fueron reportados, para no mostrar el botón
      // de "Reportar" otra vez (el backend lo rechazaría de todos modos,
      // pero así el usuario ve el estado correcto sin necesidad de intentarlo).
      const { data: reportes } = await supabase
        .from("reportes_eventos")
        .select("boleto_id")
        .eq("usuario_id", user.id)
      const mapa = {}
      for (const r of reportes || []) mapa[r.boleto_id] = true
      setReportesEnviados(mapa)

      // Cargar reseñas ya hechas por el usuario, para mostrar "editar"
      // en vez de "dejar reseña", y poder pre-llenar el formulario.
      const { data: resenas } = await supabase
        .from("resenas")
        .select("boleto_id, estrellas_evento, estrellas_anfitrion, comentario")
        .eq("usuario_id", user.id)
      const mapaResenas = {}
      for (const r of resenas || []) mapaResenas[r.boleto_id] = r
      setResenasGuardadas(mapaResenas)

      setLoading(false)
    }
    cargar()
  }, [])

  const enviarReporte = async () => {
    if (!reportando) return
    setEnviandoReporte(true)
    setMensaje("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reportar-evento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          boleto_id: reportando,
          motivo: motivoReporte,
          descripcion: descripcionReporte.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMensaje(json.error || "No se pudo enviar el reporte. Intenta de nuevo.")
      } else {
        setReportesEnviados(prev => ({ ...prev, [reportando]: true }))
        setReportando(null)
        setMotivoReporte("no_ocurrio")
        setDescripcionReporte("")
        setMensaje("Reporte enviado. Nuestro equipo lo revisará.")
        setTimeout(() => setMensaje(""), 5000)
      }
    } catch {
      setMensaje("Error de conexión. Intenta de nuevo.")
    }
    setEnviandoReporte(false)
  }

  const abrirResena = (boletoId) => {
    const existente = resenasGuardadas[boletoId]
    setEstrellasEvento(existente?.estrellas_evento || 0)
    setEstrellasAnfitrion(existente?.estrellas_anfitrion || 0)
    setComentarioResena(existente?.comentario || "")
    setResenando(boletoId)
  }

  const enviarResena = async () => {
    if (!resenando || estrellasEvento === 0 || estrellasAnfitrion === 0) return
    setEnviandoResena(true)
    setMensaje("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guardar-resena`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          boleto_id: resenando,
          estrellas_evento: estrellasEvento,
          estrellas_anfitrion: estrellasAnfitrion,
          comentario: comentarioResena.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMensaje(json.error || "No se pudo guardar la reseña. Intenta de nuevo.")
      } else {
        setResenasGuardadas(prev => ({ ...prev, [resenando]: { estrellas_evento: estrellasEvento, estrellas_anfitrion: estrellasAnfitrion, comentario: comentarioResena.trim() || null } }))
        setResenando(null)
        setMensaje("¡Gracias por tu reseña!")
        setTimeout(() => setMensaje(""), 4000)
      }
    } catch {
      setMensaje("Error de conexión. Intenta de nuevo.")
    }
    setEnviandoResena(false)
  }

  const borrarResena = async () => {
    if (!resenando) return
    if (!window.confirm("¿Borrar tu reseña? Esta acción no se puede deshacer.")) return
    setEnviandoResena(true)
    // RLS (auth.uid() = usuario_id) garantiza que solo se pueda borrar la
    // propia reseña — no se necesita una edge function para esto.
    const { error } = await supabase.from("resenas").delete().eq("boleto_id", resenando)
    if (!error) {
      setResenasGuardadas(prev => {
        const copia = { ...prev }
        delete copia[resenando]
        return copia
      })
      setResenando(null)
      setMensaje("Reseña eliminada.")
      setTimeout(() => setMensaje(""), 3000)
    } else {
      setMensaje("No se pudo eliminar la reseña. Intenta de nuevo.")
    }
    setEnviandoResena(false)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando tus boletos...
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
        <div style={{ position: "absolute", top: "-40px", left: "30%", width: "500px", height: "250px", background: "radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "860px", margin: "0 auto", position: "relative" }}>
          <h1 style={{ fontSize: isMobile ? "1.8rem" : "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "6px" }}>Mis boletos</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14.5px", fontWeight: 400, margin: 0 }}>
            {boletos.length === 0 ? "No tienes boletos todavía." : `Tienes ${boletos.length} boleto${boletos.length > 1 ? "s" : ""} activo${boletos.length > 1 ? "s" : ""}.`}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: isMobile ? "24px 18px 48px" : "40px 24px 60px" }}>

        {boletos.length > 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "28px", background: "rgba(124,58,237,0.07)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "12px", padding: "12px 16px" }}>
            <svg width="14" height="14" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: "2px" }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Los boletos se eliminan automáticamente 30 días después del evento. Te recomendamos tomar captura de pantalla como comprobante.</span>
          </div>
        )}

        {boletos.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎟️</div>
            <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>Aún no tienes boletos</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px" }}>Explora eventos y compra tu primer boleto</div>
            <Link to="/" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", borderRadius: "12px", color: "white", padding: "12px 28px", fontWeight: 600, fontSize: "14px", textDecoration: "none", display: "inline-block", boxShadow: "0 0 20px rgba(124,58,237,0.35)" }}>
              Explorar eventos
            </Link>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {boletos.map((boleto, i) => {
              const ev = boleto.eventos
              const fecha = ev?.fecha ? new Date(ev.fecha) : null
              const ahora = new Date()
              const usado = fecha && boleto.estado === "activo" && (ahora - fecha) > 5 * 60 * 60 * 1000
              const fechaFormato = fecha ? fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Fecha no disponible"
              const horaFormato = fecha ? fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""

              const estadoColor = boleto.estado === "pendiente" ? "#f59e0b" : usado ? "rgba(255,255,255,0.3)" : "#34d399"
              const estadoBg = boleto.estado === "pendiente" ? "rgba(245,158,11,0.1)" : usado ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.1)"
              const estadoBorder = boleto.estado === "pendiente" ? "rgba(245,158,11,0.3)" : usado ? "rgba(255,255,255,0.1)" : "rgba(16,185,129,0.3)"
              const estadoLabel = boleto.estado === "pendiente" ? "Pendiente" : usado ? "Usado" : "Activo"

              return (
                <motion.div key={boleto.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "20px", overflow: "hidden" }}
                >
                  {isMobile ? (
                    /* MÓVIL: layout vertical */
                    <div>
                      {/* Imagen arriba */}
                      <div style={{ position: "relative", height: "150px" }}>
                        <img src={ev?.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80"} alt={ev?.titulo}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(15,15,17,0.9))" }} />
                        {/* Badge categoría sobre imagen */}
                        <span style={{ position: "absolute", top: "12px", left: "12px", background: "rgba(124,58,237,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "999px", padding: "4px 12px", fontSize: "12px", fontWeight: 600, color: "white" }}>{ev?.categoria}</span>
                        {/* Badge estado sobre imagen */}
                        <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", alignItems: "center", gap: "5px", background: estadoBg, border: `1px solid ${estadoBorder}`, backdropFilter: "blur(8px)", borderRadius: "999px", padding: "4px 10px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: estadoColor }} />
                          <span style={{ fontSize: "11.5px", color: estadoColor, fontWeight: 600 }}>{estadoLabel}</span>
                        </div>
                      </div>
                      {/* Info abajo */}
                      <div style={{ padding: "18px 18px 20px" }}>
                        <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "3px", letterSpacing: "-0.3px" }}>{ev?.titulo}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px", marginBottom: "14px" }}>por {ev?.profiles?.nombre || "Anfitrión"}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {fechaFormato} · {horaFormato}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            {ev?.ubicacion}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "2px" }}>Pagado</div>
                            <div style={{ fontWeight: 700, fontSize: "20px", letterSpacing: "-0.5px" }}>{ev?.precio === 0 ? "Gratis" : `$${ev?.precio}`}</div>
                            {ev?.precio > 0 && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>MXN</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                            <Link to={`/evento/${boleto.evento_id}`} style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                              Ver evento
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            </Link>
                            {boleto.mp_payment_id && (
                              <a href="https://www.mercadopago.com.mx/activities" target="_blank" rel="noopener noreferrer" style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.35)", textDecoration: "none", fontWeight: 500 }}>Comprobante →</a>
                            )}
                          </div>
                        </div>

                        {/* CÓDIGO + QR de check-in */}
                        {boleto.codigo_grupo && boleto.estado === "activo" && (
                          <div style={{ marginTop: "14px", padding: "14px", background: "rgba(124,58,237,0.07)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                              <div>
                                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "4px" }}>Código de entrada</div>
                                <div style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "4px", fontFamily: "monospace", color: "#c4b5fd" }}>{boleto.codigo_grupo}</div>
                                {boleto.nombre_registro && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>A nombre de: {boleto.nombre_registro}</div>}
                              </div>
                              <button onClick={() => setQrExpandido(qrExpandido === boleto.id ? null : boleto.id)}
                                style={{ background: "rgba(124,58,237,0.15)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "10px", padding: "8px 12px", color: "#a78bfa", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                              >{qrExpandido === boleto.id ? "Ocultar QR" : "Ver QR"}</button>
                            </div>
                            {qrExpandido === boleto.id && (
                              <div style={{ display: "flex", justifyContent: "center", padding: "16px", background: "white", borderRadius: "10px" }}>
                                <QRCodeSVG value={boleto.codigo_grupo} size={180} />
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", marginTop: "10px" }}>
                          {usado && boleto.estado === "activo" && !reportesEnviados[boleto.id] && (
                            <button onClick={() => setReportando(boleto.id)} style={{ fontSize: "12.5px", color: "#f87171", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontFamily: "inherit" }}>Reportar evento</button>
                          )}
                          {reportesEnviados[boleto.id] && (
                            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Reporte enviado</span>
                          )}
                          {usado && boleto.estado === "activo" && (
                            <button onClick={() => abrirResena(boleto.id)} style={{ fontSize: "12.5px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontFamily: "inherit" }}>
                              {resenasGuardadas[boleto.id] ? "Editar reseña" : "Dejar reseña"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* DESKTOP: layout horizontal */
                    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto" }}>
                      {/* Imagen */}
                      <div style={{ position: "relative", minHeight: "150px" }}>
                        <img src={ev?.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80"} alt={ev?.titulo}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #0f0f11 100%)" }} />
                      </div>
                      {/* Info */}
                      <div style={{ padding: "24px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ background: "rgba(124,58,237,0.2)", border: "1.5px solid rgba(124,58,237,0.35)", borderRadius: "999px", padding: "3px 12px", fontSize: "12px", fontWeight: 600, color: "#a78bfa" }}>{ev?.categoria}</span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "4px", letterSpacing: "-0.3px" }}>{ev?.titulo}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginBottom: "16px" }}>por {ev?.profiles?.nombre || "Anfitrión"}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {fechaFormato} · {horaFormato}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            {ev?.ubicacion}
                          </div>
                        </div>
                      </div>
                      {/* Precio y estado */}
                      <div style={{ padding: "24px 24px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", borderLeft: "1px solid rgba(255,255,255,0.06)", minWidth: "160px" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>Pagado</div>
                          <div style={{ fontWeight: 700, fontSize: "22px", letterSpacing: "-0.5px" }}>{ev?.precio === 0 ? "Gratis" : `$${ev?.precio}`}</div>
                          {ev?.precio > 0 && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>MXN</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: estadoBg, border: `1.5px solid ${estadoBorder}`, borderRadius: "999px", padding: "5px 12px" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: estadoColor }} />
                            <span style={{ fontSize: "12px", color: estadoColor, fontWeight: 600 }}>{estadoLabel}</span>
                          </div>
                          <Link to={`/evento/${boleto.evento_id}`} style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                            Ver evento
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          </Link>
                          {boleto.mp_payment_id && (
                            <a href="https://www.mercadopago.com.mx/activities" target="_blank" rel="noopener noreferrer" style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.35)", textDecoration: "none", fontWeight: 500 }}>Comprobante →</a>
                          )}
                          {usado && boleto.estado === "activo" && !reportesEnviados[boleto.id] && (
                            <button onClick={() => setReportando(boleto.id)} style={{ fontSize: "12.5px", color: "#f87171", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontFamily: "inherit" }}>Reportar evento</button>
                          )}
                          {reportesEnviados[boleto.id] && (
                            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Reporte enviado</span>
                          )}
                          {usado && boleto.estado === "activo" && (
                            <button onClick={() => abrirResena(boleto.id)} style={{ fontSize: "12.5px", color: "#a78bfa", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, fontFamily: "inherit" }}>
                              {resenasGuardadas[boleto.id] ? "Editar reseña" : "Dejar reseña"}
                            </button>
                          )}
                        </div>

                        {/* CÓDIGO + QR de check-in — versión desktop */}
                        {boleto.codigo_grupo && boleto.estado === "activo" && (
                          <div style={{ marginTop: "16px", padding: "16px", background: "rgba(124,58,237,0.07)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                            <div>
                              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "6px" }}>Código de entrada</div>
                              <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "5px", fontFamily: "monospace", color: "#c4b5fd" }}>{boleto.codigo_grupo}</div>
                              {boleto.nombre_registro && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>A nombre de: {boleto.nombre_registro}</div>}
                              <button onClick={() => setQrExpandido(qrExpandido === boleto.id ? null : boleto.id)}
                                style={{ marginTop: "10px", background: "rgba(124,58,237,0.15)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "8px", padding: "6px 14px", color: "#a78bfa", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                              >{qrExpandido === boleto.id ? "Ocultar QR" : "Ver QR"}</button>
                            </div>
                            {qrExpandido === boleto.id && (
                              <div style={{ background: "white", padding: "12px", borderRadius: "10px", flexShrink: 0 }}>
                                <QRCodeSVG value={boleto.codigo_grupo} size={140} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Mensaje flotante de éxito/error */}
      {mensaje && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#1a1a1d", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "12px", padding: "12px 20px", fontSize: "13.5px", zIndex: 200, maxWidth: "90vw", textAlign: "center" }}
        >
          {mensaje}
        </motion.div>
      )}

      {/* MODAL: reportar evento */}
      {reportando && (
        <div onClick={() => !enviandoReporte && setReportando(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            style={{ background: "#111114", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "18px", padding: "26px 24px", maxWidth: "420px", width: "100%" }}
          >
            <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>Reportar evento</div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginBottom: "18px", lineHeight: 1.5 }}>
              Usa esto solo si el evento no ocurrió o el anfitrión no cumplió. Un administrador revisará tu reporte.
            </p>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Motivo</label>
              <select value={motivoReporte} onChange={e => setMotivoReporte(e.target.value)}
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 12px", color: "white", fontSize: "14px", fontFamily: "inherit", colorScheme: "dark" }}
              >
                <option value="no_ocurrio">El evento no ocurrió</option>
                <option value="anfitrion_no_responde">El anfitrión no responde</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Cuéntanos qué pasó (opcional)</label>
              <textarea value={descripcionReporte} onChange={e => setDescripcionReporte(e.target.value.slice(0, 1000))} rows={4}
                placeholder="Describe brevemente lo que sucedió..."
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 12px", color: "white", fontSize: "14px", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setReportando(null)} disabled={enviandoReporte}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button onClick={enviarReporte} disabled={enviandoReporte}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: enviandoReporte ? "rgba(239,68,68,0.4)" : "#ef4444", color: "white", fontWeight: 600, fontSize: "14px", cursor: enviandoReporte ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {enviandoReporte ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: dejar/editar reseña */}
      {resenando && (
        <div onClick={() => !enviandoResena && setResenando(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            style={{ background: "#111114", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "18px", padding: "26px 24px", maxWidth: "420px", width: "100%" }}
          >
            <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>{resenasGuardadas[resenando] ? "Editar reseña" : "Dejar reseña"}</div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginBottom: "18px", lineHeight: 1.5 }}>
              Comparte tu experiencia con este evento y este anfitrión.
            </p>

            <StarPicker label="¿Cómo calificarías el evento?" value={estrellasEvento} onChange={setEstrellasEvento} />
            <StarPicker label="¿Cómo calificarías al anfitrión?" value={estrellasAnfitrion} onChange={setEstrellasAnfitrion} />

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>Comentario (opcional)</label>
              <textarea value={comentarioResena} onChange={e => setComentarioResena(e.target.value.slice(0, 1000))} rows={4}
                placeholder="Cuéntanos cómo estuvo..."
                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 12px", color: "white", fontSize: "14px", fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5, marginBottom: "18px" }}>
              Tu nombre y foto de perfil serán visibles junto a esta reseña. Te pedimos expresarte con respeto, incluso si tu experiencia no fue buena.
            </p>

            <div style={{ display: "flex", gap: "10px" }}>
              {resenasGuardadas[resenando] && (
                <button onClick={borrarResena} disabled={enviandoResena}
                  style={{ padding: "11px 16px", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Borrar
                </button>
              )}
              <button onClick={() => setResenando(null)} disabled={enviandoResena}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.6)", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancelar
              </button>
              <button onClick={enviarResena} disabled={enviandoResena || estrellasEvento === 0 || estrellasAnfitrion === 0}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: (enviandoResena || estrellasEvento === 0 || estrellasAnfitrion === 0) ? "rgba(124,58,237,0.3)" : "#7c3aed", color: "white", fontWeight: 600, fontSize: "14px", cursor: (enviandoResena || estrellasEvento === 0 || estrellasAnfitrion === 0) ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {enviandoResena ? "Guardando..." : "Guardar reseña"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}