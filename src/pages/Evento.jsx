import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { supabase } from "../supabase"
import { useNavigate, useParams, Link } from "react-router-dom"

export default function Evento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [evento, setEvento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [comprando, setComprando] = useState(false)
  const [tieneBoleto, setTieneBoleto] = useState(false)
  const [exito, setExito] = useState(false)
  const [estadoBoleto, setEstadoBoleto] = useState("activo")
  const [asistentes, setAsistentes] = useState(0)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: ev } = await supabase
        .from("eventos")
        .select("*, profiles(nombre)")
        .eq("id", id)
        .single()
      setEvento(ev)
      console.log("anfitrion_id:", ev?.anfitrion_id)

      const { count } = await supabase
        .from("boletos")
        .select("*", { count: "exact", head: true })
        .eq("evento_id", id)
        .eq("estado", "activo")
      setAsistentes(count || 0)

      if (user) {
        const { data: boleto } = await supabase
          .from("boletos")
          .select("id, estado")
          .eq("evento_id", id)
          .eq("usuario_id", user.id)
          .single()
        if (boleto) {
          setTieneBoleto(true)
          setEstadoBoleto(boleto.estado)
        }
      }

      setLoading(false)
    }
    cargar()
  }, [id])

  const handleComprar = async () => {
    if (!user) { navigate("/login"); return }
    setComprando(true)

    if (evento.tipo_boleto === "solicitud") {
      const { error } = await supabase.from("boletos").insert({
        evento_id: id,
        usuario_id: user.id,
        estado: "pendiente"
      })
      if (!error) {
        setTieneBoleto(true)
        setExito(true)
        setEstadoBoleto("pendiente")
      }
      setComprando(false)
      return
    }

    if (evento.precio === 0) {
      const { error } = await supabase.from("boletos").insert({
        evento_id: id,
        usuario_id: user.id,
        estado: "activo"
      })
      if (!error) {
        setTieneBoleto(true)
        setAsistentes(a => a + 1)
        setExito(true)
        setEstadoBoleto("activo")
      }
      setComprando(false)
      return
    }

    // Evento de pago — redirigir a Stripe
    // Crear boleto pendiente_pago antes de ir a Stripe
    const { error: boletoError } = await supabase.from("boletos").insert({
      evento_id: id,
      usuario_id: user.id,
      estado: "pendiente_pago"
    })
    if (boletoError) { setComprando(false); return }

    const { data: anfitrion } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", evento.anfitrion_id)
      .single()

    if (!anfitrion?.stripe_account_id) {
      alert("El anfitrión aún no ha conectado su cuenta de pagos.")
      setComprando(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-pago-stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        evento_id: id,
        titulo: evento.titulo,
        precio: evento.precio,
        usuario_id: user.id,
        anfitrion_stripe_id: anfitrion.stripe_account_id,
      })
    })

    const data = await response.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert("Error al procesar el pago. Intenta de nuevo.")
      setComprando(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando evento...
    </div>
  )

  if (!evento) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Evento no encontrado. <Link to="/" style={{ color: "#a78bfa", marginLeft: "8px" }}>Volver al inicio</Link>
    </div>
  )

  const pct = Math.round((asistentes / evento.capacidad) * 100)
  const almostFull = pct >= 85
  const fecha = new Date(evento.fecha)
  const fechaFormato = fecha.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const horaFormato = fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })

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
          Volver
        </Link>
      </nav>

      {/* IMAGEN HERO */}
      <div style={{ position: "relative", height: "380px", overflow: "hidden" }}>
        <img src={evento.imagen_url || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80"} alt={evento.titulo}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(8,8,8,0.95) 100%)" }} />
        <div style={{ position: "absolute", bottom: "40px", left: "64px" }}>
          <span style={{ background: "rgba(124,58,237,0.8)", backdropFilter: "blur(12px)", borderRadius: "999px", padding: "6px 16px", fontSize: "13px", fontWeight: 600, marginBottom: "12px", display: "inline-block" }}>{evento.categoria}</span>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: 700, letterSpacing: "-1px", margin: "8px 0 0" }}>{evento.titulo}</h1>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 64px", display: "grid", gridTemplateColumns: "1fr 360px", gap: "48px", alignItems: "start" }}>

        {/* COLUMNA IZQUIERDA */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700 }}>
              {evento.profiles?.nombre?.charAt(0) || "A"}
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{evento.profiles?.nombre || "Anfitrión"}</div>
              <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.4)" }}>Organizador del evento</div>
            </div>
          </div>

          {evento.descripcion && (
            <div style={{ marginBottom: "36px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 600, marginBottom: "14px" }}>Acerca del evento</h2>
              <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.75, fontSize: "15px", fontWeight: 400 }}>{evento.descripcion}</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {[
              { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, label: "Fecha", value: fechaFormato },
              { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: "Hora", value: horaFormato },
              { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, label: "Ubicación", value: evento.ubicacion },
              { icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>, label: "Asistentes", value: `${asistentes} / ${evento.capacidad}` },
            ].map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={{ color: "#a78bfa", flexShrink: 0, marginTop: "2px" }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "4px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>{item.label}</div>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>{asistentes} de {evento.capacidad} lugares ocupados</span>
              {almostFull && <span style={{ fontSize: "13px", color: "#a78bfa", fontWeight: 600 }}>¡Casi lleno!</span>}
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "999px", height: "6px", overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                style={{ background: "linear-gradient(90deg, #6d28d9, #a78bfa)", height: "6px", borderRadius: "999px" }}
              />
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA - COMPRAR */}
        <div style={{ position: "sticky", top: "88px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "28px" }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>Precio por boleto</div>
              <div style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-1px" }}>
                {evento.precio === 0 ? "Gratis" : `$${evento.precio}`}
                {evento.precio > 0 && <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginLeft: "6px", fontWeight: 400 }}>MXN</span>}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px", padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: "16px" }}>{evento.tipo_boleto === "instantaneo" ? "⚡" : "📋"}</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{evento.tipo_boleto === "instantaneo" ? "Boleto instantáneo" : "Por solicitud"}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{evento.tipo_boleto === "instantaneo" ? "Recibes tu boleto al instante" : "El anfitrión debe aprobar"}</div>
              </div>
            </div>

            {exito && (
              <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", color: "#34d399", fontSize: "13.5px", textAlign: "center" }}>
                {estadoBoleto === "activo" ? "✓ ¡Boleto obtenido exitosamente!" : "⏳ Solicitud enviada, espera la aprobación del anfitrión"}
              </div>
            )}

            {tieneBoleto ? (
              <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
                <div style={{ fontSize: "20px", marginBottom: "6px" }}>{estadoBoleto === "pendiente" ? "⏳" : "🎟️"}</div>
                <div style={{ fontWeight: 600, color: "#34d399", fontSize: "14px" }}>{estadoBoleto === "pendiente" ? "Solicitud enviada" : "Ya tienes tu boleto"}</div>
                <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>{estadoBoleto === "pendiente" ? "El anfitrión debe aprobarla" : "Revísalo en Mis Boletos"}</div>
              </div>
            ) : (
              <motion.button onClick={handleComprar} whileHover={{ opacity: 0.9 }} whileTap={{ scale: 0.97 }} disabled={comprando || asistentes >= evento.capacidad}
                style={{ width: "100%", background: asistentes >= evento.capacidad ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: asistentes >= evento.capacidad ? "rgba(255,255,255,0.4)" : "white", padding: "15px", fontWeight: 700, fontSize: "15px", cursor: comprando || asistentes >= evento.capacidad ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: asistentes >= evento.capacidad ? "none" : "0 0 20px rgba(124,58,237,0.35)" }}
              >
                {comprando ? "Procesando..." : asistentes >= evento.capacidad ? "Evento lleno" : evento.precio === 0 ? "Obtener boleto gratis" : `Comprar boleto · $${evento.precio}`}
              </motion.button>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center", marginTop: "16px" }}>
              <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>Reembolso garantizado si el evento se cancela</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
