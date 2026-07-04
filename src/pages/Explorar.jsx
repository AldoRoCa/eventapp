import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { eventoFinalizado } from "../eventoUtils"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

const categorias = ["Todas", "Fiestas", "Universitarios", "Cultura", "Autos", "Belleza", "Tecnología", "Gastronomía", "Música", "Deportes", "Arte", "Negocios"]

export default function Explorar() {
  const isMobile = useIsMobile()
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const location = useLocation()
  const navigate = useNavigate()
  const [categoria, setCategoria] = useState("Todas")
  const [orden, setOrden] = useState("fecha")
  const [fechaFiltro, setFechaFiltro] = useState("")
  const [estadoFiltro, setEstadoFiltro] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const q = params.get("q")
    const estado = params.get("estado")
    const fecha = params.get("fecha")
    if (q) setBusqueda(q)
    if (estado) setEstadoFiltro(estado)
    if (fecha) setFechaFiltro(fecha)
  }, [location.search])

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      // boletos(count) + filtro en la relación: la base cuenta los asistentes
      // activos en vez de mandar todas las filas de boletos al navegador.
      // El filtro de fecha descarta en el servidor los eventos que ya no
      // pueden estar vivos (duración máxima 24h) — antes se bajaban TODOS
      // los eventos de la historia y se filtraban en el cliente.
      let query = supabase
        .from("eventos")
        .select("*, profiles(nombre), boletos(count)")
        .eq("boletos.estado", "activo")
        .gte("fecha", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      if (categoria !== "Todas") query = query.eq("categoria", categoria)
      if (orden === "fecha") query = query.order("fecha", { ascending: true })
      if (orden === "precio_asc") query = query.order("precio", { ascending: true })
      if (orden === "precio_desc") query = query.order("precio", { ascending: false })
      const { data, error } = await query
      if (!error && data) setEventos(data)
      setLoading(false)
    }
    cargar()
  }, [categoria, orden])

  const eventosFiltrados = eventos.filter(ev => {
    if (eventoFinalizado(ev)) return false
    const textoOk = !busqueda || ev.titulo.toLowerCase().includes(busqueda.toLowerCase()) || ev.ubicacion?.toLowerCase().includes(busqueda.toLowerCase()) || ev.categoria?.toLowerCase().includes(busqueda.toLowerCase())
    const normalizar = str => str?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ""
    const estadoOk = !estadoFiltro || normalizar(ev.estado_evento) === normalizar(estadoFiltro)
    const fecha = new Date(ev.fecha)
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1)
    const diasHastaViernes = (5 - hoy.getDay() + 7) % 7 || 7
    const inicioFinde = new Date(hoy); inicioFinde.setDate(hoy.getDate() + (hoy.getDay() >= 5 ? 0 : diasHastaViernes))
    const finFinde = new Date(inicioFinde); finFinde.setDate(inicioFinde.getDate() + (7 - inicioFinde.getDay()) % 7 + 1)
    const finSemana = new Date(hoy); finSemana.setDate(hoy.getDate() + 7)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    let fechaOk = true
    if (fechaFiltro === "hoy") fechaOk = fecha >= hoy && fecha < manana
    if (fechaFiltro === "finde") fechaOk = fecha >= inicioFinde && fecha <= finFinde
    if (fechaFiltro === "semana") fechaOk = fecha >= hoy && fecha <= finSemana
    if (fechaFiltro === "mes") fechaOk = fecha >= hoy && fecha <= finMes
    return textoOk && estadoOk && fechaOk
  })

  const px = isMobile ? "18px" : "64px"

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: `0 ${px}`, height: isMobile ? "56px" : "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
      <div style={{
        background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 40%, #080808 100%)",
        padding: isMobile ? "36px 18px 28px" : "56px 64px 44px",
        borderBottom: "1px solid rgba(124,58,237,0.15)",
        position: "relative", overflow: "hidden"
      }}>
        {/* Glow decorativo */}
        <div style={{ position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "300px", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative" }}>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: isMobile ? "1.8rem" : "2.2rem", fontWeight: 700, letterSpacing: "-0.8px", marginBottom: "6px" }}
          >Explorar eventos</motion.h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14.5px", marginBottom: isMobile ? "24px" : "32px" }}>Encuentra tu próxima experiencia</p>

          {/* BARRA DE BÚSQUEDA */}
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "0 16px", gap: "10px" }}>
                <svg width="15" height="15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar eventos..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: "14.5px", padding: "13px 0", fontFamily: "inherit" }}
                />
                {busqueda && <button onClick={() => setBusqueda("")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px" }}>×</button>}
              </div>
              <select value={orden} onChange={e => setOrden(e.target.value)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "white", padding: "12px 16px", fontSize: "14px", cursor: "pointer", outline: "none", fontFamily: "inherit", colorScheme: "dark", width: "100%" }}
              >
                <option value="fecha" style={{ background: "#111" }}>Más próximos</option>
                <option value="precio_asc" style={{ background: "#111" }}>Precio: menor a mayor</option>
                <option value="precio_desc" style={{ background: "#111" }}>Precio: mayor a menor</option>
              </select>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", flex: 1, background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "0 16px", gap: "10px", transition: "border 0.2s" }}>
                <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, lugar o categoría..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: "14.5px", padding: "14px 0", fontFamily: "inherit" }}
                />
                {busqueda && <button onClick={() => setBusqueda("")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>×</button>}
              </div>
              <select value={orden} onChange={e => setOrden(e.target.value)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "14px", color: "white", padding: "0 20px", fontSize: "14px", cursor: "pointer", outline: "none", fontFamily: "inherit", minWidth: "185px", colorScheme: "dark" }}
              >
                <option value="fecha" style={{ background: "#111" }}>Más próximos</option>
                <option value="precio_asc" style={{ background: "#111" }}>Precio: menor a mayor</option>
                <option value="precio_desc" style={{ background: "#111" }}>Precio: mayor a menor</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "24px 18px 48px" : "36px 64px 60px" }}>

        {/* FILTROS DE CATEGORÍA */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "28px" }}>
          {categorias.map(cat => (
            <motion.button key={cat} onClick={() => setCategoria(cat)} whileTap={{ scale: 0.93 }}
              style={{
                padding: isMobile ? "7px 14px" : "8px 18px",
                borderRadius: "999px", cursor: "pointer",
                border: `1.5px solid ${categoria === cat ? "rgba(124,58,237,0.7)" : "rgba(255,255,255,0.1)"}`,
                background: categoria === cat ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.03)",
                color: categoria === cat ? "white" : "rgba(255,255,255,0.5)",
                fontSize: isMobile ? "12.5px" : "13.5px",
                fontWeight: categoria === cat ? 600 : 400,
                fontFamily: "inherit", transition: "all 0.15s",
                boxShadow: categoria === cat ? "0 0 12px rgba(124,58,237,0.3)" : "none"
              }}
            >{cat}</motion.button>
          ))}
        </div>

        {/* CONTADOR RESULTADOS */}
        <div style={{ marginBottom: "18px", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
          {loading ? "Buscando..." : `${eventosFiltrados.length} evento${eventosFiltrados.length !== 1 ? "s" : ""} encontrado${eventosFiltrados.length !== 1 ? "s" : ""}`}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px", color: "rgba(255,255,255,0.3)" }}>Cargando eventos...</div>
        ) : eventosFiltrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
            <div style={{ fontSize: "44px", marginBottom: "16px" }}>🔍</div>
            <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>No encontramos eventos</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "24px" }}>Intenta con otra búsqueda o categoría</div>
            <button onClick={() => { setBusqueda(""); setCategoria("Todas"); setEstadoFiltro(""); setFechaFiltro("") }}
              style={{ background: "rgba(124,58,237,0.2)", border: "1.5px solid rgba(124,58,237,0.45)", borderRadius: "10px", color: "#a78bfa", padding: "10px 24px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 12px rgba(124,58,237,0.2)" }}
            >Limpiar filtros</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? "14px" : "18px" }}>
            {eventosFiltrados.map((ev, i) => {
              const asistentes = ev.boletos?.[0]?.count || 0
              const fechaFormato = new Date(ev.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              return (
                <motion.div key={ev.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: isMobile ? 0 : i * 0.05 }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(`/evento/${ev.id}`)}
                  style={{ borderRadius: "20px", overflow: "hidden", background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.07)", cursor: "pointer", transition: "border 0.2s, box-shadow 0.2s" }}
                  onHoverStart={e => e.currentTarget && (e.currentTarget.style.borderColor = "rgba(124,58,237,0.35)")}
                  onHoverEnd={e => e.currentTarget && (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
                >
                  <div style={{ position: "relative", height: isMobile ? "170px" : "180px", overflow: "hidden" }}>
                    <motion.img
                      src={ev.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&q=80"}
                      alt={ev.titulo}
                      whileHover={{ scale: 1.05 }} transition={{ duration: 0.4 }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.72))" }} />
                    <span style={{ position: "absolute", top: "12px", left: "12px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "999px", padding: "4px 12px", fontSize: "12px", fontWeight: 600 }}>{ev.categoria}</span>
                    <span style={{ position: "absolute", top: "12px", right: "12px", background: ev.tipo_boleto === "instantaneo" ? "rgba(124,58,237,0.75)" : "rgba(37,99,235,0.75)", backdropFilter: "blur(12px)", border: `1px solid ${ev.tipo_boleto === "instantaneo" ? "rgba(167,139,250,0.3)" : "rgba(96,165,250,0.3)"}`, borderRadius: "999px", padding: "4px 12px", fontSize: "12px", fontWeight: 600 }}>
                      {ev.tipo_boleto === "instantaneo" ? "⚡ Instantáneo" : "📋 Solicitud"}
                    </span>
                  </div>
                  <div style={{ padding: isMobile ? "16px" : "18px 20px" }}>
                    <div style={{ fontWeight: 700, fontSize: "15.5px", marginBottom: "3px", letterSpacing: "-0.2px" }}>{ev.titulo}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px", marginBottom: "12px" }}>por {ev.profiles?.nombre || "Anfitrión"}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", fontSize: "12.5px" }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {fechaFormato}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255,255,255,0.5)", fontSize: "12.5px" }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {ev.ubicacion}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "19px", letterSpacing: "-0.5px" }}>{ev.precio === 0 ? "Gratis" : `$${Math.round(ev.precio * 1.10)}`}</span>
                        {ev.precio > 0 && <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginLeft: "4px" }}>MXN</span>}
                      </div>
                      <motion.span whileHover={{ x: 2 }} style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
                        Ver detalles
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      </motion.span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}