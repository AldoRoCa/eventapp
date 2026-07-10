import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase, getUserSafe } from "../supabase"
import { useNavigate, useParams, Link } from "react-router-dom"
import { eventoFinalizado } from "../eventoUtils"
import MiniMapaUbicacion from "../components/MiniMapaUbicacion"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

export default function Evento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [evento, setEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [comprando, setComprando] = useState(false)
  const [tieneBoleto, setTieneBoleto] = useState(false)
  const [exito, setExito] = useState(false)
  const [estadoBoleto, setEstadoBoleto] = useState("activo")
  const [asistentes, setAsistentes] = useState(0)
  const [cantidad, setCantidad] = useState(1)
  const [nombreRegistro, setNombreRegistro] = useState("")
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [boletosUsuario, setBoletosUsuario] = useState(0)
  const [fotoZoom, setFotoZoom] = useState(null)
  const [ratingAnfitrion, setRatingAnfitrion] = useState(null) // { promedio, total } o null si no hay reseñas
  const [comentariosAnfitrion, setComentariosAnfitrion] = useState([])

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      setUser(user)
      if (user) {
        const { data: perfil } = await supabase.from("profiles").select("nombre_real").eq("id", user.id).single()
        if (perfil?.nombre_real) setNombreRegistro(perfil.nombre_real)
      }
      const { data: ev } = await supabase
        .from("eventos")
        .select("id, titulo, descripcion, categoria, fecha, ubicacion, estado_evento, capacidad, precio, tipo_boleto, imagen_url, anfitrion_id, max_boletos_por_persona, duracion_horas, tiempo_registro_horas, created_at, profiles(nombre, avatar_url)")
        .eq("id", id).single()
      setEvento(ev)

      if (ev?.anfitrion_id) {
        const { data: resenas } = await supabase
          .from("resenas")
          .select("usuario_id, estrellas_anfitrion, comentario, created_at")
          .eq("anfitrion_id", ev.anfitrion_id)
          .order("created_at", { ascending: false })
        if (resenas && resenas.length > 0) {
          const promedio = resenas.reduce((sum, r) => sum + r.estrellas_anfitrion, 0) / resenas.length
          setRatingAnfitrion({ promedio, total: resenas.length })

          const conComentario = resenas.filter(r => r.comentario && r.comentario.trim().length > 0)

          // Se hace por separado de la consulta a "resenas" (en vez de un
          // join anidado resenas->profiles) porque PostgREST no resuelve
          // bien ese join cuando profiles tiene varias políticas RLS de
          // SELECT activas — el join devolvía profiles=null en el
          // cliente aunque los datos sí existieran en la base.
          if (conComentario.length > 0) {
            const idsUnicos = [...new Set(conComentario.map(r => r.usuario_id))]
            const { data: perfiles } = await supabase
              .from("profiles")
              .select("id, nombre, avatar_url")
              .in("id", idsUnicos)
            const perfilesPorId = {}
            for (const p of perfiles || []) perfilesPorId[p.id] = p
            setComentariosAnfitrion(conComentario.map(r => ({ ...r, profiles: perfilesPorId[r.usuario_id] || null })))
          }
        }
      }
      const { count } = await supabase.from("boletos").select("*", { count: "exact", head: true }).eq("evento_id", id).eq("estado", "activo")
      setAsistentes(count || 0)
      if (user) {
        const { data: boletos } = await supabase.from("boletos").select("id, estado").eq("evento_id", id).eq("usuario_id", user.id).in("estado", ["activo", "pendiente"]).order("created_at", { ascending: false })
        const cantidadActual = boletos?.length || 0
        setBoletosUsuario(boletos?.filter(b => b.estado === "activo").length || 0)
        if (cantidadActual > 0) {
          const limite = ev?.max_boletos_por_persona || 5
          const activos = boletos.filter(b => b.estado === "activo").length
          const pendientes = boletos.filter(b => b.estado === "pendiente").length
          if (activos > 0) setEstadoBoleto("activo")
          else if (pendientes > 0) setEstadoBoleto("pendiente")
          if (cantidadActual >= limite) setTieneBoleto(true)
          else if (ev?.tipo_boleto === "solicitud" && pendientes > 0 && activos === 0) setTieneBoleto(true)
        }
      }
      setLoading(false)
    }
    cargar()
  }, [id])

  const limite = evento?.max_boletos_por_persona || 5
  const espaciosDisponibles = Math.max(0, evento?.capacidad - asistentes)
  const maxComprable = Math.min(limite - boletosUsuario, espaciosDisponibles)

  const cambiarCantidad = (nueva) => {
    if (nueva < 1 || nueva > maxComprable) return
    setCantidad(nueva)
  }

  // El aforo y el límite por persona ahora se validan de forma atómica en la
  // base (trigger trg_verificar_aforo). El conteo del cliente es solo UX: si
  // dos personas compran los últimos lugares a la vez, una recibe este error
  // aunque su botón todavía se viera disponible.
  const mensajeErrorBoleto = (error) => {
    const m = error?.message || ""
    if (m.includes("AFORO_LLENO")) return "Este evento acaba de llenarse — ya no hay lugares disponibles."
    if (m.includes("LIMITE_PERSONA")) return "Alcanzaste el máximo de boletos por persona para este evento."
    return "No se pudo completar tu registro. Intenta de nuevo."
  }

  const handleComprar = async () => {
    if (!user) { navigate("/login"); return }
    if (finalizado) { alert("Este evento ya finalizó y no se pueden comprar más boletos."); return }
    if (!nombreRegistro.trim()) { alert("Por favor ingresa el nombre a quien se registrará el boleto."); return }
    if (nombreRegistro.trim().length > 100) { alert("El nombre no puede tener más de 100 caracteres."); return }
    setComprando(true)
    const nombreNormalizado = nombreRegistro.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (evento.tipo_boleto === "solicitud") {
      if (evento.precio === 0) {
        const { data: codigo } = await supabase.rpc("generar_codigo_checkin")
        const inserts = Array.from({ length: cantidad }, () => ({ evento_id: id, usuario_id: user.id, estado: "pendiente", nombre_registro: nombreRegistro.trim(), nombre_registro_normalizado: nombreNormalizado, codigo_grupo: codigo }))
        const { error } = await supabase.from("boletos").insert(inserts)
        if (!error) { setTieneBoleto(true); setExito(true); setEstadoBoleto("pendiente") }
        else alert(mensajeErrorBoleto(error))
        setComprando(false); return
      } else {
        // Limpiar intentos de compra abandonados de este mismo evento antes
        // de crear los nuevos: si quedaba un "pendiente_pago" de un intento
        // previo (pago que nunca se confirmó), confirmar-pago-mp activa TODOS
        // los boletos pendientes de pago de este usuario+evento de un jalón —
        // dejar viejos sueltos hacía que un solo pago activara boletos de más.
        await supabase.from("boletos").delete().eq("evento_id", id).eq("usuario_id", user.id).eq("estado", "pendiente_pago")
        const inserts = Array.from({ length: cantidad }, () => ({ evento_id: id, usuario_id: user.id, estado: "pendiente_pago", nombre_registro: nombreRegistro.trim(), nombre_registro_normalizado: nombreNormalizado }))
        const { error: boletoError } = await supabase.from("boletos").insert(inserts)
        if (boletoError) { alert(mensajeErrorBoleto(boletoError)); setComprando(false); return }
        const { data: anfitrion } = await supabase.from("profiles").select("mp_user_id").eq("id", evento.anfitrion_id).single()
        if (!anfitrion?.mp_user_id) { alert("El anfitrión aún no ha conectado su cuenta de Mercado Pago."); setComprando(false); return }
        const { data: { session } } = await supabase.auth.getSession()
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-pago-mp`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` }, body: JSON.stringify({ evento_id: id, titulo: evento.titulo, precio: evento.precio, usuario_id: user.id, cantidad }) })
        const data = await response.json()
        if (data.url) window.location.href = data.url
        else { alert(data.error || "Error al procesar el pago. Intenta de nuevo."); setComprando(false) }
        return
      }
    }
    if (evento.precio === 0) {
      const { data: codigo } = await supabase.rpc("generar_codigo_checkin")
      const inserts = Array.from({ length: cantidad }, () => ({ evento_id: id, usuario_id: user.id, estado: "activo", nombre_registro: nombreRegistro.trim(), nombre_registro_normalizado: nombreNormalizado, codigo_grupo: codigo }))
      const { error } = await supabase.from("boletos").insert(inserts)
      if (!error) { setTieneBoleto(true); setAsistentes(a => a + cantidad); setExito(true); setEstadoBoleto("activo") }
      else alert(mensajeErrorBoleto(error))
      setComprando(false); return
    }
    // Misma limpieza de intentos abandonados que en el flujo de solicitud
    // con pago — evita que un solo pago confirmado active boletos de más.
    await supabase.from("boletos").delete().eq("evento_id", id).eq("usuario_id", user.id).eq("estado", "pendiente_pago")
    const inserts = Array.from({ length: cantidad }, () => ({ evento_id: id, usuario_id: user.id, estado: "pendiente_pago", nombre_registro: nombreRegistro.trim(), nombre_registro_normalizado: nombreNormalizado }))
    const { error: boletoError } = await supabase.from("boletos").insert(inserts)
    if (boletoError) { alert(mensajeErrorBoleto(boletoError)); setComprando(false); return }
    const { data: anfitrion } = await supabase.from("profiles").select("mp_user_id").eq("id", evento.anfitrion_id).single()
    if (!anfitrion?.mp_user_id) { alert("El anfitrión aún no ha conectado su cuenta de Mercado Pago."); setComprando(false); return }
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-pago-mp`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` }, body: JSON.stringify({ evento_id: id, titulo: evento.titulo, precio: evento.precio, usuario_id: user.id, cantidad }) })
    const data = await response.json()
    if (data.url) window.location.href = data.url
    else { alert(data.error || "Error al procesar el pago. Intenta de nuevo."); setComprando(false) }
  }

  if (loading) return <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cargando evento...</div>
  if (!evento) return <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Evento no encontrado. <Link to="/" style={{ color: "#a78bfa", marginLeft: "8px" }}>Volver al inicio</Link></div>

  const pct = Math.round((asistentes / evento.capacidad) * 100)
  const almostFull = pct >= 85
  // Mismo margen de 5 horas usado en PanelAnfitrion (editar) y MisBoletos
  // (reportar/reseñar) — consistente en toda la app hasta que el sistema
  // de check-in redefina cómo se determina el fin de un evento.
  const finalizado = eventoFinalizado(evento)
  const fecha = new Date(evento.fecha)
  const fechaFormato = fecha.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const horaFormato = fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  const precioTotal = Math.round(evento.precio * 1.10) * cantidad

  const detalles = [
    { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: "Fecha", value: fechaFormato, color: "#a78bfa", glow: "#7c3aed" },
    { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: "Hora", value: horaFormato, color: "#60a5fa", glow: "#2563eb" },
    { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, label: "Ubicación", value: evento.ubicacion, color: "#34d399", glow: "#059669" },
    { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>, label: "Asistentes", value: `${asistentes} / ${evento.capacidad}`, color: "#fbbf24", glow: "#d97706" },
  ]

  // Elemento JSX precalculado (no un componente definido dentro del
  // render): se usa dos veces en el árbol (layout móvil y escritorio) sin
  // que React lo desmonte/remonte, porque no es un tipo de componente
  // nuevo en cada render — es el mismo valor reutilizado.
  const bloqueCompra = (
    <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(255,255,255,0.02) 100%)", border: "1.5px solid rgba(124,58,237,0.2)", borderRadius: "22px", padding: isMobile ? "22px 18px" : "28px", position: "relative", overflow: "hidden", boxShadow: "0 0 40px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      {/* Línea superior brillante */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "160px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.6), transparent)" }} />

      {/* PRECIO */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 500 }}>
          {evento.precio === 0 ? "Precio" : cantidad > 1 ? `${cantidad} boletos` : "Precio por boleto"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-1px" }}>
            {evento.precio === 0 ? "Gratis" : `$${precioTotal}`}
          </span>
          {evento.precio > 0 && <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>MXN</span>}
        </div>
        {evento.precio > 0 && cantidad > 1 && (
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
            ${evento.precio} × {cantidad} boletos
          </div>
        )}
      </div>

      {/* SELECTOR CANTIDAD */}
      {!tieneBoleto && maxComprable > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginBottom: "10px", fontWeight: 500 }}>
            Cantidad · máx. {limite} por persona
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => cambiarCantidad(cantidad - 1)} disabled={cantidad <= 1}
              style={{ width: "38px", height: "38px", borderRadius: "10px", border: `1.5px solid ${cantidad <= 1 ? "rgba(255,255,255,0.08)" : "rgba(124,58,237,0.35)"}`, background: cantidad <= 1 ? "rgba(255,255,255,0.03)" : "rgba(124,58,237,0.12)", color: cantidad <= 1 ? "rgba(255,255,255,0.2)" : "white", fontSize: "20px", cursor: cantidad <= 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", transition: "all 0.15s", boxShadow: cantidad <= 1 ? "none" : "0 0 10px rgba(124,58,237,0.2)" }}
            >−</button>
            <span style={{ fontSize: "20px", fontWeight: 800, minWidth: "28px", textAlign: "center", letterSpacing: "-0.5px" }}>{cantidad}</span>
            <button onClick={() => cambiarCantidad(cantidad + 1)} disabled={cantidad >= maxComprable}
              style={{ width: "38px", height: "38px", borderRadius: "10px", border: `1.5px solid ${cantidad >= maxComprable ? "rgba(255,255,255,0.08)" : "rgba(124,58,237,0.35)"}`, background: cantidad >= maxComprable ? "rgba(255,255,255,0.03)" : "rgba(124,58,237,0.12)", color: cantidad >= maxComprable ? "rgba(255,255,255,0.2)" : "white", fontSize: "20px", cursor: cantidad >= maxComprable ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", transition: "all 0.15s", boxShadow: cantidad >= maxComprable ? "none" : "0 0 10px rgba(124,58,237,0.2)" }}
            >+</button>
          </div>
          {boletosUsuario > 0 && (
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>
              Ya tienes {boletosUsuario} boleto{boletosUsuario > 1 ? "s" : ""} para este evento
            </div>
          )}
        </div>
      )}

      {/* NOMBRE DE REGISTRO (check-in) */}
      {!tieneBoleto && user && (
        <div style={{ marginBottom: "20px", padding: "14px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>
            Boleto{cantidad > 1 ? "s" : ""} a nombre de
          </div>
          {editandoNombre ? (
            <input value={nombreRegistro} onChange={e => setNombreRegistro(e.target.value)} placeholder="Nombre completo" maxLength={100}
              onBlur={() => setEditandoNombre(false)} autoFocus
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: "8px", padding: "9px 11px", color: "white", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <span style={{ fontSize: "14.5px", fontWeight: 600 }}>{nombreRegistro || "Sin nombre"}</span>
              <button onClick={() => setEditandoNombre(true)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                Cambiar
              </button>
            </div>
          )}
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "6px", lineHeight: 1.4 }}>
            Este nombre se usará para el check-in en la entrada. Si compras para alguien más, cámbialo por el nombre de esa persona.
          </div>
        </div>
      )}

      {/* TIPO BOLETO */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: evento.tipo_boleto === "instantaneo" ? "rgba(124,58,237,0.2)" : "rgba(37,99,235,0.2)", border: `1px solid ${evento.tipo_boleto === "instantaneo" ? "rgba(167,139,250,0.3)" : "rgba(96,165,250,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0 }}>
          {evento.tipo_boleto === "instantaneo" ? "⚡" : "📋"}
        </div>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>{evento.tipo_boleto === "instantaneo" ? "Boleto instantáneo" : "Por solicitud"}</div>
          <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.6)" }}>{evento.tipo_boleto === "instantaneo" ? "Recibes tu boleto al instante" : "El anfitrión debe aprobar"}</div>
        </div>
      </div>

      <AnimatePresence>
        {exito && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", color: "#34d399", fontSize: "13.5px", textAlign: "center" }}
          >
            {estadoBoleto === "activo" ? `✓ ¡${cantidad > 1 ? `${cantidad} boletos obtenidos` : "Boleto obtenido"} exitosamente!` : "⏳ Solicitud enviada, espera la aprobación"}
          </motion.div>
        )}
      </AnimatePresence>

      {tieneBoleto ? (
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "14px", padding: "18px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "8px" }}>{estadoBoleto === "pendiente" ? "⏳" : "🎟️"}</div>
          <div style={{ fontWeight: 700, color: "#34d399", fontSize: "14px" }}>
            {estadoBoleto === "pendiente" ? "Solicitud enviada" : boletosUsuario >= limite ? "Ya alcanzaste el límite" : "¡Ya tienes tu boleto!"}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
            {estadoBoleto === "pendiente" ? "El anfitrión debe aprobarla" : "Revísalo en Mis Boletos"}
          </div>
        </div>
      ) : (
        <motion.button onClick={handleComprar} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={comprando || asistentes >= evento.capacidad || finalizado}
          className={(asistentes >= evento.capacidad || finalizado) ? "" : "btn-3d"}
          style={{ width: "100%", background: (asistentes >= evento.capacidad || finalizado) ? "rgba(255,255,255,0.06)" : undefined, border: (asistentes >= evento.capacidad || finalizado) ? "1px solid rgba(255,255,255,0.1)" : "none", borderRadius: "14px", color: (asistentes >= evento.capacidad || finalizado) ? "rgba(255,255,255,0.35)" : "white", padding: "16px", fontWeight: 700, fontSize: "15px", cursor: (comprando || asistentes >= evento.capacidad || finalizado) ? "not-allowed" : "pointer", fontFamily: "inherit" }}
        >
          {comprando ? "Procesando..." : finalizado ? "Este evento ya finalizó" : asistentes >= evento.capacidad ? "Evento lleno" : evento.precio === 0 ? `Obtener ${cantidad > 1 ? `${cantidad} boletos gratis` : "boleto gratis"}` : `Comprar · $${Math.round(evento.precio * 1.10) * cantidad} MXN`}
        </motion.button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center", marginTop: "14px" }}>
        <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.25)" }}>Reembolso garantizado si el evento se cancela</span>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ZOOM FOTO */}
      {fotoZoom && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setFotoZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(14px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <motion.img initial={{ scale: 0.85 }} animate={{ scale: 1 }} src={fotoZoom} alt="portada"
            style={{ maxWidth: "500px", width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.7)", margin: "auto" }}
            onClick={e => e.stopPropagation()}
          />
        </motion.div>
      )}

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: isMobile ? "0 18px" : "0 64px", height: isMobile ? "56px" : "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(124,58,237,0.55)" }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", transition: "all 0.2s" }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {!isMobile && "Volver"}
        </Link>
      </nav>

      {/* IMAGEN HERO */}
      <div
        style={{ position: "relative", height: isMobile ? "260px" : "420px", overflow: "hidden", cursor: "zoom-in" }}
        onClick={() => setFotoZoom(evento.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80")}
      >
        <motion.img
          src={evento.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80"}
          alt={evento.titulo}
          initial={{ scale: 1.05 }} animate={{ scale: 1 }} transition={{ duration: 0.8 }}
          style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
        />
        {/* Degradado mejorado */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 40%, rgba(8,8,8,0.97) 100%)", pointerEvents: "none" }} />
        {/* Glow lateral izquierdo */}
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "300px", height: "200px", background: "radial-gradient(ellipse at bottom left, rgba(124,58,237,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "absolute", bottom: isMobile ? "20px" : "44px", left: isMobile ? "18px" : "64px", right: isMobile ? "18px" : "64px" }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <span style={{ background: "rgba(124,58,237,0.85)", backdropFilter: "blur(12px)", borderRadius: "999px", padding: "5px 14px", fontSize: "12px", fontWeight: 600, marginBottom: "10px", display: "inline-block", boxShadow: "0 0 16px rgba(124,58,237,0.4)" }}>{evento.categoria}</span>
            <h1 style={{ fontSize: isMobile ? "1.5rem" : "clamp(1.8rem, 4vw, 3rem)", fontWeight: 700, letterSpacing: "-0.5px", margin: "8px 0 0", lineHeight: 1.2 }}>{evento.titulo}</h1>
          </motion.div>
        </div>

        {/* Hint de zoom */}
        <div style={{ position: "absolute", top: isMobile ? "12px" : "16px", right: isMobile ? "12px" : "20px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", borderRadius: "8px", padding: "5px 10px", display: "flex", alignItems: "center", gap: "5px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>Ampliar</span>
        </div>
      </div>

      {/* CONTENIDO MÓVIL */}
      {isMobile ? (
        <div style={{ padding: "24px 18px 56px" }}>

          {/* BLOQUE COMPRA ARRIBA */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: "32px" }}>
            {bloqueCompra}
          </motion.div>

          {/* ANFITRIÓN */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px", padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" }}
          >
            <div style={{ width: "40px", height: "40px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700, flexShrink: 0, cursor: evento.profiles?.avatar_url ? "pointer" : "default", boxShadow: "0 0 12px rgba(124,58,237,0.3)" }}
              onClick={() => evento.profiles?.avatar_url && setFotoZoom(evento.profiles.avatar_url)}>
              {evento.profiles?.avatar_url ? <img src={evento.profiles.avatar_url} alt={evento.profiles.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : evento.profiles?.nombre?.charAt(0) || "A"}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{evento.profiles?.nombre || "Anfitrión"}</div>
              {ratingAnfitrion ? (
                <div style={{ fontSize: "12px", color: "#facc15", display: "flex", alignItems: "center", gap: "4px" }}>
                  ★ {ratingAnfitrion.promedio.toFixed(1)} <span style={{ color: "rgba(255,255,255,0.3)" }}>({ratingAnfitrion.total} reseña{ratingAnfitrion.total > 1 ? "s" : ""})</span>
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Organizador del evento</div>
              )}
            </div>
          </motion.div>

          {/* DESCRIPCIÓN */}
          {evento.descripcion && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.2px" }}>Acerca del evento</h2>
              <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8, fontSize: "14.5px", fontWeight: 400 }}>{evento.descripcion}</p>
            </motion.div>
          )}

          {/* GRID DETALLES */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
            {detalles.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                style={{ background: "rgba(255,255,255,0.03)", border: `1.5px solid rgba(255,255,255,0.07)`, borderRadius: "14px", padding: "14px", display: "flex", alignItems: "flex-start", gap: "10px", position: "relative", overflow: "hidden" }}
              >
                <div style={{ position: "absolute", bottom: 0, right: 0, width: "60px", height: "60px", background: `radial-gradient(circle, ${item.glow}15 0%, transparent 70%)`, pointerEvents: "none" }} />
                <div style={{ color: item.color, flexShrink: 0, marginTop: "1px", filter: `drop-shadow(0 0 6px ${item.glow}60)` }}>{item.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.3)", marginBottom: "3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>{item.label}</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, wordBreak: "break-word", lineHeight: 1.3 }}>{item.value}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* MINI MAPA */}
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.2px" }}>Cómo llegar</h2>
            <MiniMapaUbicacion ubicacion={evento.ubicacion} estado={evento.estado_evento} height="200px" />
          </div>

          {/* BARRA CAPACIDAD */}
          <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.6)" }}>{asistentes} de {evento.capacidad} lugares</span>
              {almostFull && <span style={{ fontSize: "12.5px", color: "#a78bfa", fontWeight: 700 }}>¡Casi lleno!</span>}
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }}
                style={{ background: "linear-gradient(90deg, #6d28d9, #a78bfa, #818cf8)", height: "6px", borderRadius: "999px", boxShadow: "0 0 8px rgba(124,58,237,0.5)" }}
              />
            </div>
          </div>

          {comentariosAnfitrion.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.2px" }}>
                Reseñas del anfitrión {ratingAnfitrion && <span style={{ color: "#facc15", fontSize: "13.5px", fontWeight: 600 }}>★ {ratingAnfitrion.promedio.toFixed(1)}</span>}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {comentariosAnfitrion.map((r, i) => (
                  <div key={i} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.06)", borderRadius: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      {r.profiles?.avatar_url ? (
                        <img src={r.profiles.avatar_url} alt="" onClick={() => setFotoZoom(r.profiles.avatar_url)} style={{ width: "26px", height: "26px", borderRadius: "999px", objectFit: "cover", cursor: "pointer" }} />
                      ) : (
                        <div style={{ width: "26px", height: "26px", borderRadius: "999px", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "#a78bfa" }}>
                          {(r.profiles?.nombre || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{r.profiles?.nombre || "Usuario"}</span>
                    </div>
                    <div style={{ color: "#facc15", fontSize: "12px", marginBottom: "5px" }}>
                      {"★".repeat(r.estrellas_anfitrion)}<span style={{ color: "rgba(255,255,255,0.12)" }}>{"★".repeat(5 - r.estrellas_anfitrion)}</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>{r.comentario}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      ) : (
        /* CONTENIDO DESKTOP */
        <div style={{ maxWidth: "1160px", margin: "0 auto", padding: "52px 64px", display: "grid", gridTemplateColumns: "1fr 380px", gap: "56px", alignItems: "start" }}>

          {/* COLUMNA IZQUIERDA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            {/* ANFITRIÓN */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "36px", padding: "16px 20px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "16px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", fontWeight: 700, cursor: evento.profiles?.avatar_url ? "pointer" : "default", boxShadow: "0 0 16px rgba(124,58,237,0.35)", flexShrink: 0 }}
                onClick={() => evento.profiles?.avatar_url && setFotoZoom(evento.profiles.avatar_url)}>
                {evento.profiles?.avatar_url ? <img src={evento.profiles.avatar_url} alt={evento.profiles.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : evento.profiles?.nombre?.charAt(0) || "A"}
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>{evento.profiles?.nombre || "Anfitrión"}</div>
                {ratingAnfitrion ? (
                  <div style={{ fontSize: "12.5px", color: "#facc15", display: "flex", alignItems: "center", gap: "4px" }}>
                    ★ {ratingAnfitrion.promedio.toFixed(1)} <span style={{ color: "rgba(255,255,255,0.3)" }}>({ratingAnfitrion.total} reseña{ratingAnfitrion.total > 1 ? "s" : ""})</span>
                  </div>
                ) : (
                  <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.35)" }}>Organizador del evento</div>
                )}
              </div>
            </div>

            {/* DESCRIPCIÓN */}
            {evento.descripcion && (
              <div style={{ marginBottom: "40px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", letterSpacing: "-0.3px" }}>Acerca del evento</h2>
                <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.85, fontSize: "15.5px", fontWeight: 400 }}>{evento.descripcion}</p>
              </div>
            )}

            {/* GRID DETALLES */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "28px" }}>
              {detalles.map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px", display: "flex", alignItems: "flex-start", gap: "14px", position: "relative", overflow: "hidden", transition: "border 0.2s" }}
                  whileHover={{ borderColor: `${item.glow}40` }}
                >
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: "80px", height: "80px", background: `radial-gradient(circle, ${item.glow}12 0%, transparent 70%)`, pointerEvents: "none" }} />
                  <div style={{ color: item.color, flexShrink: 0, marginTop: "2px", filter: `drop-shadow(0 0 8px ${item.glow}60)` }}>{item.icon}</div>
                  <div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>{item.label}</div>
                    <div style={{ fontSize: "14.5px", fontWeight: 600, lineHeight: 1.4 }}>{item.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* MINI MAPA */}
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", letterSpacing: "-0.3px" }}>Cómo llegar</h2>
              <MiniMapaUbicacion ubicacion={evento.ubicacion} estado={evento.estado_evento} height="240px" />
            </div>

            {/* BARRA CAPACIDAD */}
            <div style={{ padding: "20px 22px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.06)", borderRadius: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                <span style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.6)" }}>{asistentes} de {evento.capacidad} lugares ocupados</span>
                {almostFull && <span style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 700, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", padding: "3px 10px", borderRadius: "999px" }}>¡Casi lleno!</span>}
              </div>
              <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "999px", height: "7px", overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }}
                  style={{ background: "linear-gradient(90deg, #6d28d9, #a78bfa, #818cf8)", height: "7px", borderRadius: "999px", boxShadow: "0 0 10px rgba(124,58,237,0.6)" }}
                />
              </div>
            </div>

            {comentariosAnfitrion.length > 0 && (
              <div style={{ marginTop: "28px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", letterSpacing: "-0.3px" }}>
                  Reseñas del anfitrión {ratingAnfitrion && <span style={{ color: "#facc15", fontSize: "15px", fontWeight: 600 }}>★ {ratingAnfitrion.promedio.toFixed(1)}</span>}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {comentariosAnfitrion.map((r, i) => (
                    <div key={i} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.06)", borderRadius: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "9px" }}>
                        {r.profiles?.avatar_url ? (
                          <img src={r.profiles.avatar_url} alt="" onClick={() => setFotoZoom(r.profiles.avatar_url)} style={{ width: "30px", height: "30px", borderRadius: "999px", objectFit: "cover", cursor: "pointer" }} />
                        ) : (
                          <div style={{ width: "30px", height: "30px", borderRadius: "999px", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12.5px", fontWeight: 700, color: "#a78bfa" }}>
                            {(r.profiles?.nombre || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontSize: "13.5px", fontWeight: 600 }}>{r.profiles?.nombre || "Usuario"}</span>
                      </div>
                      <div style={{ color: "#facc15", fontSize: "13px", marginBottom: "6px" }}>
                        {"★".repeat(r.estrellas_anfitrion)}<span style={{ color: "rgba(255,255,255,0.12)" }}>{"★".repeat(5 - r.estrellas_anfitrion)}</span>
                      </div>
                      <p style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>{r.comentario}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* COLUMNA DERECHA */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            style={{ position: "sticky", top: "88px" }}
          >
            {bloqueCompra}
          </motion.div>
        </div>
      )}
    </div>
  )
}