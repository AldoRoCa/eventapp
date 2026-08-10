import { useState, useEffect } from "react"
import { motion } from "framer-motion"
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

// Página de costos de MP donde se eligen los plazos de liberación. OJO: cae en
// la pestaña "Point", no en "Checkout" — por eso la primera instrucción del
// paso 2 es cambiar de pestaña (verificado en la cuenta real, 2026-08-09).
const URL_COSTOS_MP = "https://www.mercadopago.com.mx/costs-section/merchant-svcs/processing/options"

// Los ajustes exactos, EN EL MISMO ORDEN en que aparecen en la pestaña
// Checkout de Mercado Pago, para que el anfitrión los vaya siguiendo de arriba
// hacia abajo sin perderse.
const AJUSTES = [
  { seccion: "Saldo en Mercado Pago Wallet", valor: "14 días", fijo: false },
  { seccion: "Medios de pago en efectivo", valor: "3 días", fijo: true },
  { seccion: "Tarjeta de crédito", valor: "14 días", fijo: false },
  { seccion: "Tarjeta de débito", valor: "14 días", fijo: false },
  { seccion: "Transferencias SPEI", valor: "14 días", fijo: false },
  { seccion: "Compra ahora, paga después", valor: "14 días", fijo: false },
  { seccion: "Vale de despensa", valor: "14 días", fijo: true },
  { seccion: "Oxxo y depósitos", valor: "3 días", fijo: true },
]

// Definido a nivel de módulo, NO dentro del render: un componente creado
// dentro del cuerpo de otro es un tipo nuevo en cada render y React lo
// remonta, perdiendo su estado (mismo error que ya se corrigió en
// BloqueCompra de Evento.jsx).
function Paso({ numero, titulo, listo, isMobile, children }) {
  return (
    <div style={{ background: "#0f0f11", border: `1.5px solid ${listo ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.08)"}`, borderRadius: "16px", padding: isMobile ? "20px" : "28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "999px", background: listo ? "rgba(16,185,129,0.15)" : "rgba(124,58,237,0.18)", border: `1.5px solid ${listo ? "rgba(16,185,129,0.4)" : "rgba(124,58,237,0.35)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: listo ? "#34d399" : "#a78bfa", flexShrink: 0 }}>
          {listo ? "✓" : numero}
        </div>
        <h2 style={{ fontSize: isMobile ? "16px" : "17px", fontWeight: 700, margin: 0 }}>{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

export default function ConectarMercadoPago() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modoEstricto, setModoEstricto] = useState(true)
  const [abrioLink, setAbrioLink] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      setUser(user)
      const { data } = await supabase
        .from("profiles")
        .select("tipo, estado_anfitrion, mp_user_id, mp_config_confirmada_en, mp_liberacion_verificada_en")
        .eq("id", user.id)
        .single()
      if (!data || data.tipo !== "anfitrion" || data.estado_anfitrion !== "aprobado") { navigate("/panel"); return }
      setPerfil(data)
      // En modo "avisar"/"apagado" el paso 2 no bloquea el cobro, así que se
      // presenta como recomendación en vez de requisito.
      const { data: ajuste } = await supabase.from("ajustes_plataforma").select("valor").eq("clave", "modo_liberacion").single()
      setModoEstricto((ajuste?.valor || "estricto") === "estricto")
      setLoading(false)
    }
    cargar()
  }, [navigate])

  const conectarMP = async () => {
    // Mismo flujo de siempre: el "state" de OAuth no puede ser el user.id
    // directo (es público), así que se genera un código de un solo uso ligado
    // a este usuario y mp-oauth lo consulta para saber de quién es.
    const state = crypto.randomUUID()
    const { error: errState } = await supabase.from("mp_oauth_state").insert({ state, usuario_id: user.id })
    if (errState) { setError("No se pudo iniciar la conexión con Mercado Pago. Intenta de nuevo."); return }
    const clientId = import.meta.env.VITE_MP_CLIENT_ID
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-oauth`
    window.location.href = `https://auth.mercadopago.com.mx/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  const confirmarConfiguracion = async () => {
    setGuardando(true)
    setError("")
    const { error: errUpd } = await supabase
      .from("profiles")
      .update({ mp_config_confirmada_en: new Date().toISOString() })
      .eq("id", user.id)
    if (errUpd) { setError("No se pudo guardar tu confirmación. Intenta de nuevo."); setGuardando(false); return }
    setPerfil(p => ({ ...p, mp_config_confirmada_en: new Date().toISOString() }))
    setGuardando(false)
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cargando...</div>
  }

  const paso1Listo = !!perfil?.mp_user_id
  const paso2Listo = !!perfil?.mp_config_confirmada_en
  const verificado = !!perfil?.mp_liberacion_verificada_en
  // Fuera del modo estricto, el paso 2 no bloquea el cobro: con la cuenta
  // conectada ya se puede vender.
  const todoListo = paso1Listo && (paso2Listo || !modoEstricto)

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: isMobile ? "0 16px" : "0 64px", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/panel" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {isMobile ? "Volver" : "Volver al panel"}
        </Link>
      </nav>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: isMobile ? "32px 18px 64px" : "56px 24px 80px" }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: isMobile ? "1.7rem" : "2.1rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "10px" }}>Conectar Mercado Pago</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14.5px", lineHeight: 1.7, margin: 0 }}>
            Para poder cobrar tus eventos necesitas completar estos dos pasos. El dinero de tus ventas llega directo a tu cuenta de Mercado Pago — VELA nunca lo toca.
          </p>
        </div>

        {todoListo && (
          <div style={{ marginBottom: "24px", padding: "16px 18px", background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.28)", borderRadius: "14px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#34d399", marginBottom: "6px" }}>✓ Todo listo — ya puedes cobrar tus eventos</div>
            <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
              {verificado
                ? "Verificamos tus plazos de liberación en una venta real y están correctos."
                : "Tus plazos se verifican automáticamente en tu primera venta. Si no quedaron en 14 días, esa venta se reembolsará sola y tus ventas se pausarán hasta corregirlo."}
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: "20px", padding: "13px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)", borderRadius: "11px", color: "#f87171", fontSize: "13.5px" }}>{error}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Paso numero="1" titulo="Conecta tu cuenta de Mercado Pago" listo={paso1Listo} isMobile={isMobile}>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13.5px", lineHeight: 1.7, margin: "0 0 16px" }}>
              Te llevaremos a Mercado Pago para que autorices a VELA a generar los cobros de tus eventos a tu nombre. Necesitas una cuenta de Mercado Pago a tu nombre; si no tienes, puedes crearla ahí mismo.
            </p>
            {paso1Listo ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#34d399", fontWeight: 600 }}>Cuenta conectada</span>
                <motion.button onClick={conectarMP} whileTap={{ scale: 0.97 }}
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "rgba(255,255,255,0.45)", padding: "5px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}
                >Reconectar</motion.button>
              </div>
            ) : (
              <motion.button onClick={conectarMP} whileTap={{ scale: 0.97 }}
                style={{ background: "rgba(9,103,210,0.15)", border: "1.5px solid rgba(9,103,210,0.35)", borderRadius: "10px", color: "#60a5fa", padding: "11px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >💳 Conectar mi cuenta</motion.button>
            )}
          </Paso>

          <Paso numero="2" titulo="Configura tus plazos de cobro" listo={paso2Listo} isMobile={isMobile}>
            <div style={{ padding: "14px 16px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.28)", borderRadius: "11px", marginBottom: "18px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#fbbf24", marginBottom: "6px" }}>
                {modoEstricto ? "⚠️ Cuidado: hazlo bien o no podrás cobrar" : "Muy recomendable"}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>
                {modoEstricto
                  ? <>VELA verifica esta configuración de forma automática en cada venta. Si tus plazos no quedan en 14 días, tus ventas se pausarán y el pago se le devolverá al comprador. Además, el plazo de 14 días te cobra <strong style={{ color: "rgba(255,255,255,0.85)" }}>menos comisión</strong> que recibir el dinero al instante.</>
                  : <>El plazo de 14 días te cobra <strong style={{ color: "rgba(255,255,255,0.85)" }}>menos comisión</strong> que recibir el dinero al instante, y asegura que siempre haya fondos si hay que reembolsarle a alguien. No es obligatorio para vender, pero te conviene.</>}
              </div>
            </div>

            <ol style={{ margin: "0 0 18px", paddingLeft: "20px", color: "rgba(255,255,255,0.7)", fontSize: "13.5px", lineHeight: 1.85 }}>
              <li>Abre la página de costos de Mercado Pago con el botón de abajo.</li>
              <li><strong style={{ color: "#fbbf24" }}>Cambia a la pestaña «Checkout».</strong> La página abre en «Point», que es otra cosa y no aplica a VELA.</li>
              <li>Deja cada sección exactamente así (van en este orden):</li>
            </ol>

            <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "11px", overflow: "hidden", marginBottom: "18px" }}>
              {AJUSTES.map((a, i) => (
                <div key={a.seccion} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "11px 14px", background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>{a.seccion}</span>
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: a.fijo ? "rgba(255,255,255,0.4)" : "#34d399", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {a.valor}{a.fijo ? " (fijo)" : ""}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12.5px", lineHeight: 1.7, margin: "0 0 18px" }}>
              Las secciones marcadas como «fijo» no se pueden cambiar: déjalas como están. Al terminar, presiona <strong style={{ color: "rgba(255,255,255,0.75)" }}>Guardar</strong> en Mercado Pago.
            </p>

            {paso2Listo ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "#34d399", fontWeight: 600 }}>Configuración confirmada</span>
                <a href={URL_COSTOS_MP} target="_blank" rel="noopener noreferrer"
                  style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "rgba(255,255,255,0.45)", padding: "5px 12px", fontSize: "12px", textDecoration: "none" }}
                >Volver a abrir en Mercado Pago</a>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a href={URL_COSTOS_MP} target="_blank" rel="noopener noreferrer" onClick={() => setAbrioLink(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(9,103,210,0.15)", border: "1.5px solid rgba(9,103,210,0.35)", borderRadius: "10px", color: "#60a5fa", padding: "11px 18px", fontSize: "13.5px", fontWeight: 600, textDecoration: "none" }}
                >
                  Abrir configuración en Mercado Pago
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                <motion.button onClick={confirmarConfiguracion} whileTap={{ scale: abrioLink ? 0.97 : 1 }} disabled={!abrioLink || guardando}
                  title={abrioLink ? "" : "Primero abre la configuración en Mercado Pago"}
                  style={{ background: abrioLink ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255,255,255,0.05)", border: abrioLink ? "none" : "1.5px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: abrioLink ? "white" : "rgba(255,255,255,0.3)", padding: "11px 18px", fontSize: "13.5px", fontWeight: 600, cursor: abrioLink && !guardando ? "pointer" : "not-allowed", fontFamily: "inherit" }}
                >{guardando ? "Guardando..." : "Ya lo configuré en 14 días"}</motion.button>
              </div>
            )}
          </Paso>
        </div>

        <div style={{ marginTop: "28px", display: "flex", justifyContent: "center" }}>
          <motion.button onClick={() => navigate("/panel")} whileTap={{ scale: 0.97 }}
            style={{ background: todoListo ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "transparent", border: todoListo ? "none" : "1px solid rgba(255,255,255,0.12)", borderRadius: "11px", color: todoListo ? "white" : "rgba(255,255,255,0.5)", padding: "11px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
          >{todoListo ? "Ir a mi panel" : "Volver al panel"}</motion.button>
        </div>
      </div>
    </div>
  )
}
