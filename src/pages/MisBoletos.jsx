import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { Link, useNavigate } from "react-router-dom"

export default function MisBoletos() {
  const [boletos, setBoletos] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate("/login"); return }
      setUser(user)

      const { data } = await supabase
        .from("boletos")
        .select("*, eventos(titulo, fecha, ubicacion, categoria, imagen_url, precio, tipo_boleto, profiles(nombre))")
        .eq("usuario_id", user.id)
        .in("estado", ["activo", "pendiente"])
        .order("created_at", { ascending: false })

      const boletosData = data || []
      setBoletos(boletosData)
      setLoading(false)
      
    }
    cargar()
  }, [])

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando tus boletos...
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
          Volver al inicio
        </Link>
      </nav>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "56px 24px" }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          <div style={{ marginBottom: "40px" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "8px" }}>Mis boletos</h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", fontWeight: 400 }}>
              {boletos.length === 0 ? "No tienes boletos todavía." : `Tienes ${boletos.length} boleto${boletos.length > 1 ? "s" : ""} activo${boletos.length > 1 ? "s" : ""}.`}
            </p>
            {boletos.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "10px", padding: "10px 16px" }}>
                <svg width="14" height="14" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Los boletos se eliminan automáticamente 30 días después del evento. Te recomendamos tomar captura de pantalla como comprobante.</span>
              </div>
            )}
          </div>

          {boletos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "20px" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎟️</div>
              <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>Aún no tienes boletos</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px" }}>Explora eventos y compra tu primer boleto</div>
              <Link to="/" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", borderRadius: "10px", color: "white", padding: "12px 28px", fontWeight: 600, fontSize: "14px", textDecoration: "none", display: "inline-block" }}>
                Explorar eventos
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {boletos.map((boleto, i) => {
                const ev = boleto.eventos
                const fecha = ev?.fecha ? new Date(ev.fecha) : null
                const ahora = new Date()
                const usado = fecha && boleto.estado === "activo" && (ahora - fecha) > 5 * 60 * 60 * 1000
                const fechaFormato = fecha ? fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Fecha no disponible"
                const horaFormato = fecha ? fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""

                return (
                  <motion.div key={boleto.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", overflow: "hidden", display: "grid", gridTemplateColumns: "200px 1fr auto" }}
                  >
                    {/* imagen */}
                    <div style={{ position: "relative", height: "100%", minHeight: "140px" }}>
                      <img src={ev?.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80"} alt={ev?.titulo}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #0f0f11 100%)" }} />
                    </div>

                    {/* info */}
                    <div style={{ padding: "24px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <span style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: "999px", padding: "3px 10px", fontSize: "12px", fontWeight: 600, color: "#a78bfa" }}>{ev?.categoria}</span>
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

                    {/* precio y estado */}
                    <div style={{ padding: "24px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>Pagado</div>
                        <div style={{ fontWeight: 700, fontSize: "22px", letterSpacing: "-0.5px" }}>{ev?.precio === 0 ? "Gratis" : `$${ev?.precio}`}</div>
                        {ev?.precio > 0 && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>MXN</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: boleto.estado === "pendiente" ? "rgba(245,158,11,0.1)" : usado ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.1)", border: `1px solid ${boleto.estado === "pendiente" ? "rgba(245,158,11,0.25)" : usado ? "rgba(255,255,255,0.1)" : "rgba(16,185,129,0.25)"}`, borderRadius: "999px", padding: "5px 12px" }}>
                          <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: boleto.estado === "pendiente" ? "#f59e0b" : usado ? "rgba(255,255,255,0.3)" : "#34d399"}} />
                          <span style={{ fontSize: "12px", color: boleto.estado === "pendiente" ? "#f59e0b" : usado ? "rgba(255,255,255,0.3)" : "#34d399", fontWeight: 600 }}>{boleto.estado === "pendiente" ? "Pendiente" : usado ? "Usado" : "Activo"}</span>
                        </div>
                        <Link to={`/evento/${boleto.evento_id}`} style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Ver evento →</Link>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
