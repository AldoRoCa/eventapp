import { useState, useEffect } from "react"
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

export default function Admin() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState([])
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState("")
  const [tab, setTab] = useState("solicitudes")
  const [anfitriones, setAnfitriones] = useState([])
  const [reportes, setReportes] = useState([])
  const [fallosReembolso, setFallosReembolso] = useState([])
  const [incidentes, setIncidentes] = useState([]) // liberación inmediata de MP
  const [nombresIncidentes, setNombresIncidentes] = useState({}) // { [anfitrion_id]: nombre }
  const [conteosIncidentes, setConteosIncidentes] = useState({}) // { "anfitrion|evento": veces detectado }
  const [ineUrls, setIneUrls] = useState({}) // { [solicitud.id]: signedUrl }

  const cargarSolicitudes = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("tipo", "anfitrion")
      .eq("estado_anfitrion", "pendiente")
      .order("created_at", { ascending: true })
    setSolicitudes(data || [])

    // ine-docs es un bucket privado — se necesita una URL firmada temporal
    // por cada identificación para poder mostrarla en este panel.
    const urls = {}
    for (const sol of data || []) {
      if (!sol.ine_url) continue
      const { data: firmada } = await supabase.storage.from("ine-docs").createSignedUrl(sol.ine_url, 300)
      if (firmada?.signedUrl) urls[sol.id] = firmada.signedUrl
    }
    setIneUrls(urls)
  }

  const cargarAnfitriones = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("tipo", "anfitrion")
      .eq("estado_anfitrion", "aprobado")
      .order("created_at", { ascending: false })
    setAnfitriones(data || [])
  }

  const cargarReportes = async () => {
    const { data } = await supabase
      .from("reportes_eventos")
      .select("*")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true })
    setReportes(data || [])
  }

  const cargarFallosReembolso = async () => {
    const { data } = await supabase
      .from("fallos_reembolso")
      .select("*")
      .eq("resuelto", false)
      .order("created_at", { ascending: false })
    setFallosReembolso(data || [])
  }

  const cargarIncidentes = async () => {
    const { data } = await supabase
      .from("incidentes_liberacion")
      .select("*")
      .eq("resuelto", false)
      .order("created_at", { ascending: false })
    setIncidentes(data || [])
    // Nombres de los anfitriones involucrados, para no mostrar solo UUIDs
    const ids = [...new Set((data || []).map(i => i.anfitrion_id))]
    if (ids.length > 0) {
      const { data: perfiles } = await supabase.from("profiles").select("id, nombre").in("id", ids)
      const mapa = {}
      for (const p of perfiles || []) mapa[p.id] = p.nombre
      setNombresIncidentes(mapa)
    }
    // Historial completo (incluye resueltos, que no se borran) para marcar
    // reincidencias: si el mismo evento ya había sido detectado, la tarjeta
    // muestra "2.º intento", "3.º intento", etc.
    const { data: historial } = await supabase
      .from("incidentes_liberacion")
      .select("anfitrion_id, evento_id")
      .eq("tipo", "liberacion_inmediata")
    const conteos = {}
    for (const h of historial || []) {
      const clave = `${h.anfitrion_id}|${h.evento_id}`
      conteos[clave] = (conteos[clave] || 0) + 1
    }
    setConteosIncidentes(conteos)
  }

  useEffect(() => {
    const verificar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      const { data: perfil } = await supabase.from("profiles").select("es_admin").eq("id", user.id).single()
      if (!perfil?.es_admin) { navigate("/"); return }
      await cargarSolicitudes()
      await cargarAnfitriones()
      await cargarReportes()
      await cargarFallosReembolso()
      await cargarIncidentes()
      setLoading(false)
    }
    verificar()
  }, [navigate])

  const resolverReporte = async (reporte, accion) => {
    const confirmText = accion === "aprobar"
      ? `¿Aprobar este reporte? Se reembolsarán y eliminarán TODOS los boletos del evento "${reporte.evento_titulo_snapshot}".`
      : `¿Rechazar este reporte? No se hará ningún reembolso.`
    if (!window.confirm(confirmText)) return

    setProcesando(reporte.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolver-reporte`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reporte_id: reporte.id, accion }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMensaje(json.error || "No se pudo resolver el reporte.")
      } else {
        setReportes(prev => prev.filter(r => r.id !== reporte.id))
        setMensaje(
          accion === "aprobar"
            ? `Reporte aprobado. ${json.reembolsados > 0 ? `Se procesaron ${json.reembolsados} reembolso${json.reembolsados > 1 ? "s" : ""}.` : "El evento ya no tenía boletos pendientes de reembolso."}`
            : "Reporte rechazado."
        )
      }
    } catch {
      setMensaje("Error de conexión al resolver el reporte.")
    }
    setTimeout(() => setMensaje(""), 4000)
    setProcesando(null)
  }

  const marcarResueltoFallo = async (id) => {
    setProcesando(id)
    const { error } = await supabase.from("fallos_reembolso").update({ resuelto: true }).eq("id", id)
    if (!error) {
      setFallosReembolso(prev => prev.filter(f => f.id !== id))
      setMensaje("Fallo de reembolso marcado como resuelto.")
      setTimeout(() => setMensaje(""), 3000)
    }
    setProcesando(null)
  }

  const desbloquearAnfitrion = async (anfitrionId) => {
    const nombre = nombresIncidentes[anfitrionId] || "este anfitrión"
    if (!window.confirm(`¿Desbloquear a ${nombre}? Hazlo solo si ya te mandó captura de su plazo de liberación corregido (14 o 30 días). Su próxima venta se vuelve a verificar automáticamente: si no lo cambió de verdad, se bloquea solo otra vez.`)) return
    setProcesando(anfitrionId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/desbloquear-anfitrion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ anfitrion_id: anfitrionId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMensaje(json.error || "No se pudo desbloquear al anfitrión.")
      } else {
        setIncidentes(prev => prev.filter(i => i.anfitrion_id !== anfitrionId))
        setMensaje(`✓ ${nombre} desbloqueado. Su próxima venta volverá a verificar su cuenta.`)
      }
    } catch {
      setMensaje("Error de conexión al desbloquear.")
    }
    setTimeout(() => setMensaje(""), 4000)
    setProcesando(null)
  }

  const aprobar = async (id, nombre) => {
    setProcesando(id)
    await supabase.from("profiles").update({ estado_anfitrion: "aprobado" }).eq("id", id)
    setSolicitudes(prev => prev.filter(s => s.id !== id))
    setAnfitriones(prev => [...prev, { id, nombre, estado_anfitrion: "aprobado" }])
    setMensaje(`✓ ${nombre} aprobado como anfitrión.`)
    setTimeout(() => setMensaje(""), 3000)
    setProcesando(null)
  }

  const rechazar = async (id, nombre) => {
    if (!window.confirm(`¿Rechazar la solicitud de ${nombre}? Su cuenta volverá a ser de asistente.`)) return
    setProcesando(id)
    await supabase.from("profiles").update({ tipo: "asistente", estado_anfitrion: "pendiente" }).eq("id", id)
    setSolicitudes(prev => prev.filter(s => s.id !== id))
    setMensaje(`Solicitud de ${nombre} rechazada.`)
    setTimeout(() => setMensaje(""), 3000)
    setProcesando(null)
  }

  const revocar = async (id, nombre) => {
    if (!window.confirm(`¿Revocar los permisos de anfitrión de ${nombre}?`)) return
    setProcesando(id)
    await supabase.from("profiles").update({ tipo: "asistente", estado_anfitrion: "pendiente" }).eq("id", id)
    setAnfitriones(prev => prev.filter(a => a.id !== id))
    setMensaje(`Permisos de ${nombre} revocados.`)
    setTimeout(() => setMensaje(""), 3000)
    setProcesando(null)
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Verificando acceso...
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: isMobile ? "0 14px" : "0 64px", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "12px", minWidth: 0 }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)", flexShrink: 0 }}>
            <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          {!isMobile && <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>VELA</span>}
          <span style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "999px", padding: "3px 10px", fontSize: "12px", fontWeight: 600, color: "#f87171", whiteSpace: "nowrap" }}>Admin</span>
        </div>
        <Link to="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {isMobile ? "Salir" : "Salir del panel"}
        </Link>
      </nav>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobile ? "28px 16px" : "48px 64px" }}>

        <div style={{ marginBottom: "36px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "6px" }}>Panel de administración</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>Gestiona solicitudes de anfitriones y usuarios de la plataforma.</p>
        </div>

        <AnimatePresence>
          {mensaje && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}
            >{mensaje}</motion.div>
          )}
        </AnimatePresence>

        {fallosReembolso.length > 0 && tab !== "reembolsos" && (
          <div onClick={() => setTab("reembolsos")}
            style={{ cursor: "pointer", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: "12px", padding: "14px 18px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px" }}
          >
            <span style={{ fontSize: "22px", flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "#f87171" }}>
                {fallosReembolso.length} reembolso{fallosReembolso.length > 1 ? "s" : ""} {fallosReembolso.length > 1 ? "fallaron" : "falló"} y {fallosReembolso.length > 1 ? "requieren" : "requiere"} tu atención
              </div>
              <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
                Un reembolso a un comprador no se pudo procesar (probable saldo insuficiente del anfitrión en Mercado Pago). Toca para ver el detalle.
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "4px", width: isMobile ? "100%" : "fit-content", flexWrap: "wrap" }}>
          {[
            { id: "solicitudes", label: isMobile ? `Solicitudes ${solicitudes.length > 0 ? `(${solicitudes.length})` : ""}` : `Solicitudes pendientes ${solicitudes.length > 0 ? `(${solicitudes.length})` : ""}` },
            { id: "anfitriones", label: isMobile ? `Anfitriones (${anfitriones.length})` : `Anfitriones aprobados (${anfitriones.length})` },
            { id: "reportes", label: isMobile ? `Reportes ${reportes.length > 0 ? `(${reportes.length})` : ""}` : `Reportes de eventos ${reportes.length > 0 ? `(${reportes.length})` : ""}` },
            { id: "reembolsos", label: isMobile ? `Reembolsos ${fallosReembolso.length > 0 ? `(${fallosReembolso.length})` : ""}` : `Reembolsos fallidos ${fallosReembolso.length > 0 ? `(${fallosReembolso.length})` : ""}` },
            { id: "liberacion", label: isMobile ? `Liberación ${incidentes.length > 0 ? `(${incidentes.length})` : ""}` : `Liberación MP ${incidentes.length > 0 ? `(${incidentes.length})` : ""}` },
          ].map(t => (
            <motion.button key={t.id} onClick={() => setTab(t.id)} whileTap={{ scale: 0.97 }}
              style={{ padding: isMobile ? "8px 12px" : "8px 20px", borderRadius: "9px", cursor: "pointer", border: "none", background: tab === t.id ? "rgba(124,58,237,0.3)" : "transparent", color: tab === t.id ? "white" : "rgba(255,255,255,0.45)", fontSize: isMobile ? "12.5px" : "14px", fontWeight: tab === t.id ? 600 : 500, fontFamily: "inherit", transition: "all 0.15s", flex: isMobile ? "1" : "none", whiteSpace: "nowrap" }}
            >{t.label}</motion.button>
          ))}
        </div>

        {tab === "solicitudes" && (
          <div>
            {solicitudes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>No hay solicitudes pendientes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Cuando alguien solicite ser anfitrión aparecerá aquí</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {solicitudes.map((sol, i) => (
                  <motion.div key={sol.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{ width: "48px", height: "48px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "18px", flexShrink: 0 }}>
                          {sol.avatar_url ? <img src={sol.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : sol.nombre?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "2px" }}>{sol.nombre}</div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>{sol.email}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                        <motion.button onClick={() => aprobar(sol.id, sol.nombre)} whileTap={{ scale: 0.97 }} disabled={procesando === sol.id}
                          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", color: "#34d399", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                        >{procesando === sol.id ? "..." : "✓ Aprobar"}</motion.button>
                        <motion.button onClick={() => rechazar(sol.id, sol.nombre)} whileTap={{ scale: 0.97 }} disabled={procesando === sol.id}
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#f87171", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                        >✕ Rechazar</motion.button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "12px", marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Teléfono</div>
                        <div style={{ fontSize: "13.5px" }}>{sol.telefono || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Instagram</div>
                        <div style={{ fontSize: "13.5px" }}>{sol.instagram || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fecha de nacimiento</div>
                        <div style={{ fontSize: "13.5px" }}>{sol.fecha_nacimiento ? new Date(sol.fecha_nacimiento).toLocaleDateString("es-MX") : "—"}</div>
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bio</div>
                        <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{sol.bio || "—"}</div>
                      </div>
                      {ineUrls[sol.id] && (
                        <div style={{ gridColumn: "1/-1" }}>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Identificación oficial</div>
                          <img src={ineUrls[sol.id]} alt="INE" style={{ maxWidth: "320px", width: "100%", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)" }} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "anfitriones" && (
          <div>
            {anfitriones.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>👤</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>No hay anfitriones aprobados aún</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {anfitriones.map((anf, i) => (
                  <motion.div key={anf.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}
                  >
                    <div style={{ width: "40px", height: "40px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                      {anf.avatar_url ? <img src={anf.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : anf.nombre?.charAt(0) || "U"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{anf.nombre}</div>
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px" }}>{anf.email}</div>
                    </div>
                    <motion.button onClick={() => revocar(anf.id, anf.nombre)} whileTap={{ scale: 0.97 }} disabled={procesando === anf.id}
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#f87171", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >{procesando === anf.id ? "..." : "Revocar"}</motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "reportes" && (
          <div>
            {reportes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🛡️</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>No hay reportes pendientes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Cuando alguien reporte un evento aparecerá aquí</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {reportes.map((rep, i) => {
                  const motivoLabel = rep.motivo === "no_ocurrio" ? "El evento no ocurrió" : rep.motivo === "anfitrion_no_responde" ? "El anfitrión no responde" : "Otro"
                  return (
                    <motion.div key={rep.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      style={{ background: "#0f0f11", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "16px", padding: "24px" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>{rep.evento_titulo_snapshot}</div>
                          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Anfitrión: {rep.anfitrion_nombre_snapshot || "Desconocido"}</div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", marginTop: "4px" }}>Reportado el {new Date(rep.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                          <motion.button onClick={() => resolverReporte(rep, "aprobar")} whileTap={{ scale: 0.97 }} disabled={procesando === rep.id}
                            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#f87171", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                          >{procesando === rep.id ? "..." : "Aprobar y reembolsar"}</motion.button>
                          <motion.button onClick={() => resolverReporte(rep, "rechazar")} whileTap={{ scale: 0.97 }} disabled={procesando === rep.id}
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "rgba(255,255,255,0.6)", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                          >Rechazar</motion.button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Motivo</div>
                          <div style={{ fontSize: "13.5px", color: "#f87171", fontWeight: 600 }}>{motivoLabel}</div>
                        </div>
                        {rep.descripcion && (
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Descripción del usuario</div>
                            <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{rep.descripcion}</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === "reembolsos" && (
          <div>
            {fallosReembolso.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>💸</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>No hay reembolsos fallidos</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Cuando un reembolso a un comprador falle (p. ej. saldo insuficiente del anfitrión) aparecerá aquí</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {fallosReembolso.map((f, i) => {
                  const contextoLabel = { "cancelar-evento": "Cancelación de evento", "gestionar-solicitud": "Rechazo de solicitud", "resolver-reporte": "Reporte aprobado", "eliminar-cuenta": "Baja de cuenta" }[f.contexto] || f.contexto
                  return (
                    <motion.div key={f.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      style={{ background: "#0f0f11", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "16px", padding: "24px" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px", color: "#f87171" }}>{contextoLabel}</div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{new Date(f.created_at).toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                        <motion.button onClick={() => marcarResueltoFallo(f.id)} whileTap={{ scale: 0.97 }} disabled={procesando === f.id}
                          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", color: "#34d399", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                        >{procesando === f.id ? "..." : "Marcar resuelto"}</motion.button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Detalle</div>
                          <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{f.detalle || "—"}</div>
                        </div>
                        {f.evento_id && (
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>ID del evento</div>
                            <div style={{ fontSize: "12.5px", fontFamily: "monospace", color: "rgba(255,255,255,0.5)", wordBreak: "break-all" }}>{f.evento_id}</div>
                          </div>
                        )}
                        {f.payment_ids && f.payment_ids.length > 0 && (
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pagos sin reembolsar (Mercado Pago)</div>
                            <div style={{ fontSize: "12.5px", fontFamily: "monospace", color: "rgba(255,255,255,0.5)", wordBreak: "break-all" }}>{f.payment_ids.join(", ")}</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === "liberacion" && (
          <div>
            {incidentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔓</div>
                <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>Sin incidentes de liberación</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Cuando se detecte una venta de una cuenta de Mercado Pago que libera el dinero al instante, aparecerá aquí — con las ventas del anfitrión ya pausadas y el pago detector ya reembolsado automáticamente</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {incidentes.map((inc, i) => {
                  const esInmediata = inc.tipo === "liberacion_inmediata"
                  // Reincidencia sobre el mismo evento (cuenta también los
                  // incidentes ya resueltos): 1 = primera vez, sin marcador.
                  const intento = esInmediata ? (conteosIncidentes[`${inc.anfitrion_id}|${inc.evento_id}`] || 1) : 1
                  return (
                    <motion.div key={inc.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      style={{ background: "#0f0f11", border: `1px solid ${esInmediata ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.12)"}`, borderRadius: "16px", padding: "24px" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px", color: esInmediata ? "#fbbf24" : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {esInmediata ? "Liberación inmediata detectada" : "Dato de liberación ilegible"}
                            {intento > 1 && (
                              <span style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171", borderRadius: "999px", padding: "2px 10px", fontSize: "11.5px", fontWeight: 700 }}>
                                {intento}.º intento en este evento
                              </span>
                            )}
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{new Date(inc.created_at).toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · vía {inc.origen}</div>
                        </div>
                        <motion.button onClick={() => desbloquearAnfitrion(inc.anfitrion_id)} whileTap={{ scale: 0.97 }} disabled={procesando === inc.anfitrion_id}
                          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", color: "#34d399", padding: "9px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                        >{procesando === inc.anfitrion_id ? "..." : "Desbloquear anfitrión"}</motion.button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginTop: "20px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Anfitrión</div>
                          <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.7)" }}>{nombresIncidentes[inc.anfitrion_id] || "—"}</div>
                          <div style={{ fontSize: "11.5px", fontFamily: "monospace", color: "rgba(255,255,255,0.35)", wordBreak: "break-all" }}>{inc.anfitrion_id}</div>
                        </div>
                        {inc.liberacion_dias !== null && (
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Plazo de liberación detectado</div>
                            <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.6)" }}>{inc.liberacion_dias} días</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Detalle</div>
                          <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{inc.detalle || "—"}</div>
                        </div>
                        {inc.mp_payment_id && (
                          <div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pago detector (Mercado Pago)</div>
                            <div style={{ fontSize: "12.5px", fontFamily: "monospace", color: "rgba(255,255,255,0.5)", wordBreak: "break-all" }}>{inc.mp_payment_id}</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}