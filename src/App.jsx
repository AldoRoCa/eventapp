import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"

import { Routes, Route, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { supabase } from "./supabase"
import Login from "./pages/Login"
import Registro from "./pages/Registro"
import Evento from "./pages/Evento"
import CrearEvento from "./pages/CrearEvento"
import MisBoletos from "./pages/MisBoletos"
import Explorar from "./pages/Explorar"
import SerAnfitrion from "./pages/SerAnfitrion"
import PanelAnfitrion from "./pages/PanelAnfitrion"
import UnirseCooperador from "./pages/UnirseCooperador"
import Perfil from "./pages/Perfil"
import Admin from "./pages/Admin"
import PagoExitoso from "./pages/PagoExitoso"
import PagoFallido from "./pages/PagoFallido"
import Reembolsos from "./pages/Reembolsos"
import PoliticasSeguridad from "./pages/PoliticasSeguridad"
import AcercaDeVela from "./pages/AcercaDeVela"
import Terminos from "./pages/Terminos"
import Privacidad from "./pages/Privacidad"
import Contacto from "./pages/Contacto"
import ParticleHero from "./components/ParticleHero"

// Hook para detectar si es móvil
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

const categories = [
  { name: "Fiestas", count: 24, color: "#a78bfa", glow: "#7c3aed", bg: "rgba(124,58,237,0.18)", border: "rgba(124,58,237,0.45)" },
  { name: "Universitarios", count: 18, color: "#60a5fa", glow: "#2563eb", bg: "rgba(37,99,235,0.18)", border: "rgba(37,99,235,0.45)" },
  { name: "Cultura", count: 12, color: "#34d399", glow: "#059669", bg: "rgba(5,150,105,0.18)", border: "rgba(5,150,105,0.45)" },
  { name: "Autos", count: 8, color: "#fbbf24", glow: "#d97706", bg: "rgba(217,119,6,0.18)", border: "rgba(217,119,6,0.45)" },
  { name: "Belleza", count: 15, color: "#f472b6", glow: "#db2777", bg: "rgba(219,39,119,0.18)", border: "rgba(219,39,119,0.45)" },
  { name: "Tecnología", count: 10, color: "#22d3ee", glow: "#0891b2", bg: "rgba(8,145,178,0.18)", border: "rgba(8,145,178,0.45)" },
  { name: "Gastronomía", count: 14, color: "#f87171", glow: "#dc2626", bg: "rgba(220,38,38,0.18)", border: "rgba(220,38,38,0.45)" },
  { name: "Deportes", count: 0, color: "#4ade80", glow: "#16a34a", bg: "rgba(22,163,74,0.18)", border: "rgba(22,163,74,0.45)" },
]

const categoryIcons = {
  "Fiestas": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  "Universitarios": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  "Cultura": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  "Autos": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h11l4 4h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 9l2-4h8l2 4"/></svg>,
  "Belleza": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 2L9.5 9H2l5.9 4.3-2.2 6.8L12 16l6.3 4.1-2.2-6.8L22 9h-7.5z"/></svg>,
  "Tecnología": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  "Gastronomía": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  "Deportes": <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>,
}

const BadgeIcon = ({ type }) => {
  if (type === "verificado") return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  if (type === "reembolso") return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  if (type === "boleto") return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  return null
}

function CategoryCard({ cat, activa, onClick }) {
  const [hovered, setHovered] = useState(false)
  const [touched, setTouched] = useState(false)
  const active = hovered || touched || activa
  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onTouchStart={() => setTouched(true)}
      onTouchEnd={(e) => { e.preventDefault(); setTimeout(() => setTouched(false), 400); onClick() }}
      onClick={(e) => { if (e.isTrusted) onClick() }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      style={{
        borderRadius: "18px", padding: "28px 20px", cursor: "pointer",
        background: active ? `linear-gradient(135deg, ${cat.bg}, rgba(0,0,0,0.4))` : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? cat.border : "rgba(255,255,255,0.07)"}`,
        boxShadow: active ? `0 0 0 1px ${cat.glow}40, 0 0 40px ${cat.glow}50, 0 0 80px ${cat.glow}25, inset 0 0 40px ${cat.glow}10` : "none",
        transition: "background 0.3s, border 0.3s, box-shadow 0.3s",
        position: "relative", overflow: "hidden",
      }}
    >
      {active && <div style={{ position: "absolute", inset: 0, borderRadius: "18px", background: `radial-gradient(circle at 30% 30%, ${cat.glow}20 0%, transparent 60%)`, pointerEvents: "none" }} />}
      <div style={{ color: cat.color, marginBottom: "14px", filter: active ? `drop-shadow(0 0 8px ${cat.glow}90)` : "none", transition: "filter 0.3s", position: "relative" }}>{categoryIcons[cat.name]}</div>
      <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px", color: active ? cat.color : "white", textShadow: active ? `0 0 20px ${cat.glow}80` : "none", transition: "color 0.3s, text-shadow 0.3s", position: "relative" }}>{cat.name}</div>
    </motion.div>
  )
}

function EventCard({ ev }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const pct = Math.round((ev.attendees / ev.capacity) * 100)
  const almostFull = pct >= 85
  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      onClick={() => navigate(`/evento/${ev.id}`)}
      style={{ borderRadius: "20px", overflow: "hidden", cursor: "pointer", background: "#0f0f11", border: `1px solid ${hovered ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)"}`, boxShadow: hovered ? "0 24px 48px rgba(0,0,0,0.6)" : "none", transition: "border 0.2s, box-shadow 0.2s" }}
    >
      <div style={{ position: "relative", height: "200px", overflow: "hidden" }}>
        <motion.img src={ev.img} alt={ev.title} animate={{ scale: hovered ? 1.07 : 1 }} transition={{ duration: 0.4 }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.75) 100%)" }} />
        <span style={{ position: "absolute", top: "14px", left: "14px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "999px", padding: "5px 14px", fontSize: "12.5px", fontWeight: 600 }}>{ev.category}</span>
        <span style={{ position: "absolute", top: "14px", right: "14px", background: ev.type === "Instantáneo" ? "rgba(124,58,237,0.7)" : "rgba(37,99,235,0.7)", backdropFilter: "blur(12px)", border: `1px solid ${ev.type === "Instantáneo" ? "rgba(167,139,250,0.35)" : "rgba(96,165,250,0.35)"}`, borderRadius: "999px", padding: "5px 14px", fontSize: "12.5px", fontWeight: 600 }}>{ev.type === "Instantáneo" ? "⚡ " : "📋 "}{ev.type}</span>
      </div>
      <div style={{ padding: "22px 24px" }}>
        <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "4px", letterSpacing: "-0.3px" }}>{ev.title}</div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginBottom: "16px", fontWeight: 400 }}>{ev.host}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", color: "rgba(255,255,255,0.5)", fontSize: "13.5px" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {ev.date}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", color: "rgba(255,255,255,0.5)", fontSize: "13.5px" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {ev.location}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", color: "rgba(255,255,255,0.5)", fontSize: "13.5px" }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.6, flexShrink: 0 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              {ev.attendees}/{ev.capacity} asistentes
            </div>
            {almostFull && <span style={{ fontSize: "12.5px", color: "#a78bfa", fontWeight: 600 }}>Solo {ev.capacity - ev.attendees} lugares</span>}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "999px", height: "3px", marginBottom: "18px", overflow: "hidden" }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 }} style={{ background: "linear-gradient(90deg, #6d28d9, #a78bfa)", height: "3px", borderRadius: "999px" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: "22px", letterSpacing: "-0.5px" }}>${ev.price}</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginLeft: "4px", fontWeight: 400 }}>MXN</span>
          </div>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={e => { e.stopPropagation(); navigate(`/evento/${ev.id}`) }}
            style={{ background: hovered ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.05)", border: `1px solid ${hovered ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", color: hovered ? "#c4b5fd" : "rgba(255,255,255,0.7)", padding: "10px 18px", fontSize: "13.5px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", fontFamily: "inherit" }}
          >Ver detalles</motion.button>
        </div>
      </div>
    </motion.div>
  )
}

function HowItWorksCard({ step }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 280, damping: 20 }} style={{ textAlign: "center", cursor: "default" }}>
      <motion.div animate={{ background: hovered ? step.bgHover : step.bg, borderColor: hovered ? step.borderHover : step.border, boxShadow: hovered ? `0 0 28px ${step.glow}50, 0 0 60px ${step.glow}20` : "none" }} transition={{ duration: 0.25 }}
        style={{ width: "76px", height: "76px", borderRadius: "22px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: step.color, border: `1px solid ${step.border}` }}
      >
        <div style={{ filter: hovered ? `drop-shadow(0 0 8px ${step.glow}90)` : "none", transition: "filter 0.3s" }}>{step.svg}</div>
      </motion.div>
      <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "12px", letterSpacing: "-0.2px" }}>{step.title}</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14.5px", lineHeight: 1.7, fontWeight: 400 }}>{step.desc}</div>
    </motion.div>
  )
}

function FeatureBadge({ label, color, border, icon }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.97 }}
      style={{ display: "flex", alignItems: "center", gap: "8px", border: `1px solid ${hovered ? border : border + "70"}`, borderRadius: "999px", padding: "9px 20px", fontSize: "13.5px", fontWeight: 500, color: hovered ? "white" : color, background: hovered ? `${border}28` : `#0e0e10`, backgroundImage: hovered ? "none" : `linear-gradient(${border}1a, ${border}1a)`, cursor: "default", transition: "all 0.2s", boxShadow: hovered ? `0 0 16px ${border}35` : "none" }}
    >
      <span style={{ color: hovered ? "white" : color, display: "flex" }}>{icon}</span>
      {label}
    </motion.div>
  )
}

function HomePage({ user, perfil, onLogout, setFotoZoom }) {
  const isMobile = useIsMobile()
  const [busquedaHero, setBusquedaHero] = useState("")
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [estadoHero, setEstadoHero] = useState("")
  const [fechaHero, setFechaHero] = useState("")
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [esAnfitrion, setEsAnfitrion] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const cargarPerfil = async () => {
      if (!user) return
      const { data } = await supabase.from("profiles").select("tipo, estado_anfitrion").eq("id", user.id).single()
      if (data && data.tipo === "anfitrion" && data.estado_anfitrion === "aprobado") setEsAnfitrion(true)
    }
    cargarPerfil()
  }, [user])

  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ["eventos", categoriaActiva, estadoHero, fechaHero],
    // Reusar el resultado por 1 minuto: sin esto, cada vez que la pestaña
    // recupera el foco se repite la consulta completa a Supabase.
    staleTime: 60 * 1000,
    queryFn: async () => {
      // boletos(count) + filtro en la relación: la base de datos cuenta los
      // asistentes activos por evento en vez de mandar todas las filas de
      // boletos al navegador (con eventos grandes eso crecía sin límite).
      let query = supabase
        .from("eventos")
        .select("*, profiles(nombre), boletos(count)")
        .eq("boletos.estado", "activo")
        .gte("fecha", new Date().toISOString())
        .order("fecha", { ascending: true })

      if (categoriaActiva) query = query.eq("categoria", categoriaActiva)
      if (estadoHero) query = query.eq("estado_evento", estadoHero)

      if (fechaHero) {
        const ahora = new Date()
        if (fechaHero === "hoy") {
          const finHoy = new Date(); finHoy.setHours(23, 59, 59, 999)
          query = query.lte("fecha", finHoy.toISOString())
        } else if (fechaHero === "finde") {
          const dia = ahora.getDay()
          const diffSab = dia === 0 ? -1 : 6 - dia
          const sabado = new Date(ahora); sabado.setDate(ahora.getDate() + diffSab); sabado.setHours(0, 0, 0, 0)
          const domingo = new Date(sabado); domingo.setDate(sabado.getDate() + 1); domingo.setHours(23, 59, 59, 999)
          query = query.gte("fecha", sabado.toISOString()).lte("fecha", domingo.toISOString())
        } else if (fechaHero === "semana") {
          const finSemana = new Date(ahora); finSemana.setDate(ahora.getDate() + (7 - ahora.getDay())); finSemana.setHours(23, 59, 59, 999)
          query = query.lte("fecha", finSemana.toISOString())
        } else if (fechaHero === "mes") {
          const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999)
          query = query.lte("fecha", finMes.toISOString())
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })

  const heroBadges = [
    { label: "Eventos verificados", color: "#34d399", border: "#059669", iconType: "verificado" },
    { label: "Reembolso garantizado", color: "#60a5fa", border: "#2563eb", iconType: "reembolso" },
    { label: "Boletos instantáneos", color: "#a78bfa", border: "#7c3aed", iconType: "boleto" },
  ]

  const howItWorks = [
    { color: "#a78bfa", glow: "#7c3aed", bg: "rgba(124,58,237,0.1)", bgHover: "rgba(124,58,237,0.22)", border: "rgba(124,58,237,0.2)", borderHover: "rgba(124,58,237,0.55)", title: "Encuentra tu evento", desc: "Explora eventos verificados. Filtra por categoría, fecha o ubicación.", svg: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { color: "#60a5fa", glow: "#2563eb", bg: "rgba(37,99,235,0.1)", bgHover: "rgba(37,99,235,0.22)", border: "rgba(37,99,235,0.2)", borderHover: "rgba(37,99,235,0.55)", title: "Compra tu boleto", desc: "Compra segura con reembolso garantizado. Boletos instantáneos o por solicitud.", svg: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
    { color: "#34d399", glow: "#059669", bg: "rgba(5,150,105,0.1)", bgHover: "rgba(5,150,105,0.22)", border: "rgba(5,150,105,0.2)", borderHover: "rgba(5,150,105,0.55)", title: "Vive la experiencia", desc: "Presenta tu boleto digital y disfruta. Simple, rápido y seguro.", svg: <svg width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  ]

  const ctaBadges = [
    { label: "Gestión en tiempo real", color: "#a78bfa", border: "#7c3aed", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: "Contratos protegidos", color: "#60a5fa", border: "#2563eb", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { label: "Verificación de anfitriones", color: "#34d399", border: "#059669", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
  ]

  return (
    <div style={{ minHeight: "100vh", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflowX: "hidden" }}>

      {/* ── NAVBAR ── */}
      {isMobile ? (
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Fila 1: Logo + perfil + salir */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", height: "56px" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(124,58,237,0.5)" }}>
                <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "0.5px" }}>VELA</span>
            </div>
            {/* Perfil + Salir */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {user ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer" }} onClick={() => navigate("/perfil")}>
                    {perfil?.avatar_url ? (
                      <img src={perfil.avatar_url} alt="avatar" onClick={e => { e.stopPropagation(); setFotoZoom(perfil.avatar_url) }} style={{ width: "30px", height: "30px", borderRadius: "999px", objectFit: "cover", border: "1.5px solid rgba(124,58,237,0.5)" }} />
                    ) : (
                      <div style={{ width: "30px", height: "30px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>
                        {(perfil?.nombre || user.email)?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {perfil?.nombre || user.email.split("@")[0]}
                    </span>
                  </div>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={onLogout}
                    style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(255,255,255,0.15)", padding: "6px 13px", borderRadius: "9px", fontWeight: 500, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
                  >Salir</motion.button>
                </>
              ) : (
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/login")}
                  style={{ backgroundColor: "transparent", color: "white", border: "1.5px solid rgba(255,255,255,0.22)", padding: "7px 16px", borderRadius: "9px", fontWeight: 600, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
                >Iniciar sesión</motion.button>
              )}
            </div>
          </div>
          {/* Fila 2: Links de navegación */}
          <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "0 4px" }}>
            {[
              { label: "Explorar", path: "/explorar" },
              { label: "Crear Evento", path: "/crear-evento" },
              { label: "Mis Boletos", path: "/mis-boletos" },
            ].map(item => (
              <motion.button key={item.path} whileTap={{ scale: 0.95 }} onClick={() => navigate(item.path)}
                style={{ flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500, padding: "11px 4px", cursor: "pointer", fontFamily: "inherit" }}
              >{item.label}</motion.button>
            ))}
          </div>
        </nav>
      ) : (
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: "rgba(8,8,8,0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 64px", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
              <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>VELA</span>
          </div>
          <div style={{ display: "flex", gap: "36px", alignItems: "center" }}>
            <motion.span onClick={() => navigate("/explorar")} whileHover={{ color: "white" }} style={{ color: "rgba(255,255,255,0.55)", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>Explorar</motion.span>
            <motion.span onClick={() => navigate("/crear-evento")} whileHover={{ color: "white" }} style={{ color: "rgba(255,255,255,0.55)", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>Crear Evento</motion.span>
            <motion.span onClick={() => navigate("/mis-boletos")} whileHover={{ color: "white" }} style={{ color: "rgba(255,255,255,0.55)", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>Mis Boletos</motion.span>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => navigate("/perfil")}>
                  {perfil?.avatar_url ? (
                    <img src={perfil.avatar_url} alt="avatar" onClick={e => { e.stopPropagation(); setFotoZoom(perfil.avatar_url) }} style={{ width: "32px", height: "32px", borderRadius: "999px", objectFit: "cover", border: "1.5px solid rgba(124,58,237,0.5)", cursor: "pointer" }} />
                  ) : (
                    <div style={{ width: "32px", height: "32px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                      {(perfil?.nombre || user.email)?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
                    {perfil?.nombre || user.email.split("@")[0]}
                  </span>
                </div>
                <motion.button whileHover={{ borderColor: "rgba(255,255,255,0.55)" }} whileTap={{ scale: 0.97 }} onClick={onLogout}
                  style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(255,255,255,0.15)", padding: "8px 18px", borderRadius: "10px", fontWeight: 500, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >Salir</motion.button>
              </div>
            ) : (
              <motion.button whileHover={{ borderColor: "rgba(255,255,255,0.55)", backgroundColor: "rgba(255,255,255,0.07)" }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/login")}
                style={{ backgroundColor: "transparent", color: "white", border: "1.5px solid rgba(255,255,255,0.22)", padding: "9px 22px", borderRadius: "10px", fontWeight: 600, fontSize: "15px", cursor: "pointer", fontFamily: "inherit" }}
              >Iniciar sesión</motion.button>
            )}
          </div>
        </nav>
      )}

      {/* Espaciador: compensa el navbar fijo */}
      <div style={{ height: isMobile ? "94px" : "68px" }} />

      {/* ── HERO ── */}
      <ParticleHero>
        <div style={{ width: "100%", maxWidth: "1000px", margin: "0 auto", textAlign: "center", padding: isMobile ? "0 18px" : "0 24px" }}>
        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          style={{ fontSize: isMobile ? "2.6rem" : "clamp(3rem, 6vw, 5.2rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: isMobile ? "-1px" : "-2px", margin: "0 0 16px", position: "relative" }}
        >
          Descubre eventos<br />
          <span style={{ background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #60a5fa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>cerca de ti</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ color: "rgba(255,255,255,0.45)", fontSize: isMobile ? "1rem" : "1.1rem", margin: "0 0 28px", lineHeight: 1.7, fontWeight: 400 }}
        >Conecta con experiencias únicas. Encuentra fiestas, conciertos, talleres y más.</motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: isMobile ? "28px" : "52px", flexWrap: "wrap" }}
        >
          {heroBadges.map(b => <FeatureBadge key={b.label} label={b.label} color={b.color} border={b.border} icon={<BadgeIcon type={b.iconType} />} />)}
        </motion.div>

        {/* Barra de búsqueda */}
        {isMobile ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {/* Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "0 16px", background: "rgba(255,255,255,0.05)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <svg width="17" height="17" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={busquedaHero} onChange={e => setBusquedaHero(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate(`/explorar?q=${encodeURIComponent(busquedaHero)}&estado=${encodeURIComponent(estadoHero)}&fecha=${encodeURIComponent(fechaHero)}`)} placeholder="Buscar eventos..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: "15px", padding: "14px 0", fontFamily: "inherit" }} />
            </div>
            {/* Filtros en fila */}
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", padding: "0 12px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <select value={estadoHero} onChange={e => setEstadoHero(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: estadoHero ? "white" : "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: "12px 0" }}
                >
                  <option value="" style={{ background: "#111" }}>Todo México</option>
                  {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                    <option key={e} value={e} style={{ background: "#111" }}>{e}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", padding: "0 12px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <select value={fechaHero} onChange={e => setFechaHero(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: fechaHero ? "white" : "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", padding: "12px 0" }}
                >
                  <option value="" style={{ background: "#111" }}>Fecha</option>
                  <option value="hoy" style={{ background: "#111" }}>Hoy</option>
                  <option value="finde" style={{ background: "#111" }}>Fin de semana</option>
                  <option value="semana" style={{ background: "#111" }}>Esta semana</option>
                  <option value="mes" style={{ background: "#111" }}>Este mes</option>
                </select>
              </div>
            </div>
            {/* Botón buscar */}
            <motion.button whileTap={{ scale: 0.97 }} className="btn-3d"
              style={{ width: "100%", padding: "14px", fontSize: "15px" }}
              onClick={() => navigate(`/explorar?q=${encodeURIComponent(busquedaHero)}&estado=${encodeURIComponent(estadoHero)}&fecha=${encodeURIComponent(fechaHero)}`)}
            >Buscar</motion.button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: "flex", maxWidth: "860px", margin: "0 auto", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div style={{ display: "flex", alignItems: "center", flex: 1, padding: "0 20px", gap: "12px", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)" }}>
              <svg width="17" height="17" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={busquedaHero} onChange={e => setBusquedaHero(e.target.value)} onKeyDown={e => e.key === "Enter" && navigate(`/explorar?q=${encodeURIComponent(busquedaHero)}&estado=${encodeURIComponent(estadoHero)}&fecha=${encodeURIComponent(fechaHero)}`)} placeholder="Buscar eventos..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "white", fontSize: "15px", padding: "16px 0", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", padding: "0 20px", gap: "9px", cursor: "pointer", background: "rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.08)", borderRight: "1px solid rgba(255,255,255,0.08)", minWidth: "175px", justifyContent: "center" }}>
              <svg width="15" height="15" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <select value={estadoHero} onChange={e => setEstadoHero(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: estadoHero ? "white" : "rgba(255,255,255,0.6)", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", width: "140px" }}
              >
                <option value="" style={{ background: "#111" }}>Todo México</option>
                {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                  <option key={e} value={e} style={{ background: "#111" }}>{e}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", padding: "0 20px", gap: "9px", cursor: "pointer", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.08)", minWidth: "165px", justifyContent: "center" }}>
              <svg width="15" height="15" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <select value={fechaHero} onChange={e => setFechaHero(e.target.value)}
                style={{ background: "transparent", border: "none", outline: "none", color: fechaHero ? "white" : "rgba(255,255,255,0.6)", fontSize: "14px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", width: "140px" }}
              >
                <option value="" style={{ background: "#111" }}>Cualquier fecha</option>
                <option value="hoy" style={{ background: "#111" }}>Hoy</option>
                <option value="finde" style={{ background: "#111" }}>Este fin de semana</option>
                <option value="semana" style={{ background: "#111" }}>Esta semana</option>
                <option value="mes" style={{ background: "#111" }}>Este mes</option>
              </select>
            </div>
            <motion.button whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }}
              className="btn-3d" style={{ padding: "0 32px", fontSize: "15px", whiteSpace: "nowrap", minWidth: "110px" }}
              onClick={() => navigate(`/explorar?q=${encodeURIComponent(busquedaHero)}&estado=${encodeURIComponent(estadoHero)}&fecha=${encodeURIComponent(fechaHero)}`)}
            >Buscar</motion.button>
          </motion.div>
        )}
        </div>
      </ParticleHero>

      {/* ── CATEGORIES ── */}
      <section style={{ padding: isMobile ? "40px 18px 48px" : "56px 64px 64px", maxWidth: "1360px", margin: "0 auto" }}>
        <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          style={{ fontSize: isMobile ? "1.4rem" : "1.7rem", fontWeight: 700, marginBottom: "20px", letterSpacing: "-0.3px" }}
        >Explorar categorías {categoriaActiva && <span style={{ fontSize: "1rem", fontWeight: 500, color: "#a78bfa" }}>· {categoriaActiva}</span>}</motion.h2>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "12px" }}>
          {categories.map((cat, i) => (
            <motion.div key={cat.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <CategoryCard cat={cat} activa={categoriaActiva === cat.name} onClick={() => setCategoriaActiva(categoriaActiva === cat.name ? null : cat.name)} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── EVENTS ── */}
      <section style={{ padding: isMobile ? "0 18px 64px" : "0 64px 80px", maxWidth: "1360px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", marginBottom: "24px", gap: isMobile ? "14px" : "0" }}>
          <motion.h2 initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            style={{ fontSize: isMobile ? "1.4rem" : "1.7rem", fontWeight: 700, margin: 0, letterSpacing: "-0.3px" }}
          >{categoriaActiva ? `Eventos · ${categoriaActiva}` : "Eventos destacados"}</motion.h2>
          <div style={{ display: "flex", gap: "8px" }}>
            {["Todos", "Estudiantes", "Verificados"].map(f => (
              <motion.button key={f} onClick={() => setActiveFilter(f)} whileTap={{ scale: 0.95 }}
                style={{ padding: isMobile ? "7px 14px" : "9px 20px", borderRadius: "10px", cursor: "pointer", border: `1px solid ${activeFilter === f ? "rgba(124,58,237,0.65)" : "rgba(255,255,255,0.1)"}`, background: activeFilter === f ? "rgba(124,58,237,0.22)" : "transparent", color: activeFilter === f ? "white" : "rgba(255,255,255,0.45)", fontSize: isMobile ? "13px" : "14px", fontWeight: activeFilter === f ? 600 : 500, fontFamily: "inherit", transition: "all 0.15s" }}
              >{f}</motion.button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? "16px" : "18px" }}>
          {loadingEventos ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "48px" }}>Cargando eventos...</div>
          ) : (eventos.length > 0 ? eventos.map(ev => ({
            id: ev.id,
            title: ev.titulo,
            host: "@" + (ev.profiles?.nombre?.split(" ")[0]?.toLowerCase() || "anfitrion"),
            category: ev.categoria,
            date: new Date(ev.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
            location: ev.ubicacion,
            attendees: ev.boletos?.[0]?.count || 0,
            capacity: ev.capacidad,
            price: ev.precio === 0 ? 0 : Math.round(ev.precio * 1.10),
            type: ev.tipo_boleto === "instantaneo" ? "Instantáneo" : "Solicitud",
            img: ev.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80"
          })) : []).map((ev, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: isMobile ? 0 : i * 0.08 }}>
              <EventCard ev={ev} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: isMobile ? "56px 18px" : "80px 64px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: "center", fontSize: isMobile ? "1.6rem" : "2.1rem", fontWeight: 700, marginBottom: isMobile ? "40px" : "68px", letterSpacing: "-0.5px" }}
        >
          Cómo funciona{" "}<span style={{ background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>VELA</span>
        </motion.h2>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? "36px" : "48px", maxWidth: isMobile ? "360px" : "960px", margin: "0 auto" }}>
          {howItWorks.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: isMobile ? 0 : i * 0.12 }}>
              <HowItWorksCard step={step} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOST CTA ── */}
      <section style={{ padding: isMobile ? "32px 18px 56px" : "56px 64px 80px" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ maxWidth: "1230px", margin: "0 auto", background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 50%, #0d0b2e 100%)", border: "1px solid rgba(124,58,237,0.18)", borderRadius: "24px", padding: isMobile ? "40px 20px" : "72px 64px", textAlign: "center", position: "relative", overflow: "hidden" }}
        >
          <div style={{ position: "absolute", top: "-80px", left: "50%", transform: "translateX(-50%)", width: "600px", height: "320px", background: "radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 70%)", pointerEvents: "none" }} />
          <h2 style={{ fontSize: isMobile ? "1.5rem" : "2.1rem", fontWeight: 700, marginBottom: "14px", letterSpacing: "-0.5px", position: "relative" }}>{esAnfitrion ? "Ya eres anfitrión en VELA 🎉" : "¿Quieres organizar un evento?"}</h2>
          <p style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: "32px", maxWidth: isMobile ? "100%" : "560px", margin: "0 auto 32px", fontSize: isMobile ? "14.5px" : "16px", fontWeight: 400, padding: isMobile ? "0 4px" : "0" }}>{esAnfitrion ? "Crea tu próximo evento, revisa tus asistentes y gestiona solicitudes desde tu panel." : "Crea eventos públicos o privados. Gestiona boletos, cupos y pagos desde una sola plataforma."}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "32px", flexWrap: "wrap", position: "relative" }}>
            {ctaBadges.map(b => <FeatureBadge key={b.label} label={b.label} color={b.color} border={b.border} icon={b.icon} />)}
          </div>
          <motion.button whileHover={{ boxShadow: "0 0 36px rgba(124,58,237,0.6)", opacity: 0.92 }} whileTap={{ scale: 0.97 }} onClick={() => navigate(esAnfitrion ? "/panel" : "/ser-anfitrion")}
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "14px", color: "white", padding: isMobile ? "14px 32px" : "16px 40px", fontWeight: 600, fontSize: isMobile ? "15px" : "16px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 24px rgba(124,58,237,0.35)", position: "relative" }}
          >{esAnfitrion ? "Ir a mi panel" : "Conviértete en anfitrión"}</motion.button>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: isMobile ? "40px 18px 36px" : "56px 64px 48px" }}>
        <div style={{ maxWidth: "1230px", margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.6fr 1fr 1fr 1fr", gap: isMobile ? "32px 20px" : "48px" }}>
          {/* Logo + descripción — ocupa las 2 columnas en móvil */}
          <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(124,58,237,0.4)" }}>
                <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span style={{ fontWeight: 700, fontSize: "16px", letterSpacing: "0.5px" }}>VELA</span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13.5px", lineHeight: 1.7, maxWidth: isMobile ? "100%" : "210px", fontWeight: 400 }}>Conectando a la comunidad a través de experiencias únicas.</p>
          </div>
          {[
            { title: "Para asistentes", links: [
              { label: "Explorar eventos", href: "/explorar" },
              { label: "Mis boletos", href: "/mis-boletos" },
              { label: "Reembolsos", href: "/reembolsos" },
            ]},
            { title: "Para anfitriones", links: [
              { label: "Crear evento", href: "/crear-evento" },
              { label: "Verificación", href: "/ser-anfitrion" },
              { label: "Políticas de seguridad", href: "/seguridad" },
            ]},
            { title: "Empresa", links: [
              { label: "Acerca de VELA", href: "/acerca" },
              { label: "Términos de uso", href: "/terminos" },
              { label: "Privacidad", href: "/privacidad" },
              { label: "Contacto", href: "/contacto" },
            ]},
          ].map(col => (
            <div key={col.title}>
              <div style={{ fontWeight: 600, fontSize: "13.5px", marginBottom: "14px", color: "rgba(255,255,255,0.8)" }}>{col.title}</div>
              {col.links.map(link => (
                <motion.a key={link.label} href={link.href} whileHover={{ color: "rgba(255,255,255,0.75)" }} style={{ display: "block", marginBottom: "10px", color: "rgba(255,255,255,0.35)", textDecoration: "none", fontSize: "13.5px", fontWeight: 400 }}>{link.label}</motion.a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ maxWidth: "1230px", margin: "32px auto 0", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px", color: "rgba(255,255,255,0.2)", fontSize: "13px", fontWeight: 400 }}>
          © 2025 VELA · Todos los derechos reservados
        </div>
      </footer>
    </div>
  )
}

// Si el usuario subió una foto de perfil al registrarse pero su cuenta
// todavía no tenía sesión activa (falta confirmar el correo), la foto se
// guarda temporalmente en localStorage (ver Registro.jsx). Aquí, en cuanto
// haya una sesión real para ese mismo usuario, se sube y se limpia.
async function subirAvatarPendiente(userId) {
  const clave = `vela_avatar_pendiente_${userId}`
  const pendiente = localStorage.getItem(clave)
  if (!pendiente) return null
  localStorage.removeItem(clave)
  try {
    const { base64, ext } = JSON.parse(pendiente)
    const binario = atob(base64)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
    const nombreArchivo = `${userId}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from("avatars").upload(nombreArchivo, bytes)
    if (uploadError) return null
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(nombreArchivo)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)
    return publicUrl
  } catch {
    return null
  }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [fotoZoom, setFotoZoom] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        let { data } = await supabase.from("profiles").select("nombre, avatar_url").eq("id", session.user.id).single()
        const avatarSubido = await subirAvatarPendiente(session.user.id)
        if (avatarSubido) data = { ...data, avatar_url: avatarSubido }
        setPerfil(data)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        let { data } = await supabase.from("profiles").select("nombre, avatar_url").eq("id", session.user.id).single()
        const avatarSubido = await subirAvatarPendiente(session.user.id)
        if (avatarSubido) data = { ...data, avatar_url: avatarSubido }
        setPerfil(data)
      } else {
        setPerfil(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <>
      {fotoZoom && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setFotoZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <motion.img initial={{ scale: 0.85 }} animate={{ scale: 1 }} src={fotoZoom} alt="foto"
            style={{ maxWidth: "400px", width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          />
        </motion.div>
      )}
      <Routes>
        <Route path="/" element={<HomePage user={user} perfil={perfil} onLogout={handleLogout} setFotoZoom={setFotoZoom} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/crear-evento" element={<CrearEvento />} />
        <Route path="/evento/:id" element={<Evento />} />
        <Route path="/mis-boletos" element={<MisBoletos />} />
        <Route path="/explorar" element={<Explorar />} />
        <Route path="/ser-anfitrion" element={<SerAnfitrion />} />
        <Route path="/panel" element={<PanelAnfitrion />} />
        <Route path="/unirse-cooperador/:codigo" element={<UnirseCooperador />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/pago-exitoso" element={<PagoExitoso />} />
        <Route path="/pago-fallido" element={<PagoFallido />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/reembolsos" element={<Reembolsos />} />
        <Route path="/seguridad" element={<PoliticasSeguridad />} />
        <Route path="/acerca" element={<AcercaDeVela />} />
        <Route path="/contacto" element={<Contacto />} />
      </Routes>
    </>
  )
}