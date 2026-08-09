import { useState, useEffect } from "react"
import { Link } from "react-router-dom"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

// Redactada para prometer exactamente lo que el sistema garantiza (2026-08-08):
// los reembolsos se disparan solos y se verifican contra Mercado Pago; si uno
// no puede procesarse, NADA se borra ni se marca como resuelto y el caso queda
// registrado para seguimiento del admin (fallos_reembolso + alerta por correo).
// El plazo "5 a 10 días hábiles" que prometía la versión anterior era un número
// inventado — el tiempo real de acreditación depende del banco, no de VELA.
const secciones = [
  {
    titulo: "1. Reembolso por cancelación del evento",
    contenido: "Si el anfitrión cancela un evento, el reembolso completo de todos los boletos pagados — incluyendo la comisión de servicio de VELA — se dispara automáticamente, sin que tengas que solicitarlo. La cancelación solo se completa cuando Mercado Pago confirma los reembolsos: si alguno no puede procesarse, el evento no se elimina y el caso queda registrado para que VELA le dé seguimiento directo hasta resolverlo."
  },
  {
    titulo: "2. Reembolso por solicitud rechazada",
    contenido: "En eventos con sistema de solicitud de boletos, si el anfitrión rechaza tu solicitud pagada, el reembolso se dispara automáticamente en el momento del rechazo, sin ninguna gestión de tu parte. Un boleto solo puede quedar marcado como rechazado si Mercado Pago confirmó su reembolso — nunca te quedarás con un boleto rechazado y un pago sin devolver."
  },
  {
    titulo: "3. Reembolsos automáticos por seguridad",
    contenido: "VELA verifica cada pago directamente con Mercado Pago. Si al procesar tu pago se detecta un riesgo en la configuración de cobro del organizador, VELA puede reembolsarlo automáticamente como medida de protección: verás el aviso al terminar la compra y el boleto aparecerá como rechazado en Mis Boletos. El dinero vuelve solo a tu método de pago original."
  },
  {
    titulo: "4. Política de no reembolso por decisión del asistente",
    contenido: "Una vez confirmada la compra de un boleto, VELA no procesa reembolsos por decisión unilateral del asistente (cambio de planes, imposibilidad de asistir, etc.). Te recomendamos verificar la fecha, hora y ubicación del evento antes de realizar tu compra."
  },
  {
    titulo: "5. Eventos reprogramados",
    contenido: "Si el anfitrión reprograma un evento a una nueva fecha, los boletos adquiridos seguirán siendo válidos para la nueva fecha. Si el cambio de fecha te imposibilita asistir, puedes contactar al anfitrión directamente. VELA no gestiona reembolsos por reprogramaciones."
  },
  {
    titulo: "6. Cómo y cuándo se procesa el reembolso",
    contenido: [
      "Los reembolsos se procesan a través de Mercado Pago al método de pago original utilizado en la compra.",
      "La orden de reembolso queda registrada en Mercado Pago de inmediato. Verla reflejada en tu estado de cuenta depende de tu banco: puede tomar desde unas horas hasta varios días hábiles, y VELA no tiene control sobre esos tiempos internos.",
      "Si pagaste con tarjeta y el reembolso ocurre poco después del cargo, es posible que ninguno de los dos llegue a aparecer en tu estado de cuenta: el banco los cancela entre sí antes de facturarlos. El recibo de Mercado Pago es el comprobante de que la devolución existe.",
      "Si un reembolso no puede procesarse por causas ajenas a VELA (por ejemplo, un problema con la cuenta de cobro del organizador), el caso queda registrado automáticamente y VELA le da seguimiento directo hasta resolverlo. El organizador sigue obligado a cubrir ese monto conforme a la sección 11 de los Términos de Uso.",
      "En caso de dudas sobre tu reembolso, puedes contactarnos en panel.admin2026eventapp@gmail.com",
    ]
  },
  {
    titulo: "7. Disputas y contracargos",
    contenido: "Si consideras que se realizó un cargo incorrecto, contáctanos antes de iniciar un contracargo con tu banco. Resolveremos cualquier disputa de manera directa y rápida. Los contracargos no autorizados pueden resultar en la suspensión de tu cuenta."
  },
]

export default function Reembolsos() {
  const isMobile = useIsMobile()
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: isMobile ? "0 16px" : "0 64px", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {isMobile ? "Volver" : "Volver al inicio"}
        </Link>
      </nav>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: isMobile ? "40px 18px" : "64px 24px" }}>
        <div style={{ marginBottom: "48px" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px" }}>Política de Reembolsos</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Última actualización: 8 de agosto de 2026</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {secciones.map((s, i) => (
            <div key={i}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>{s.titulo}</h2>
              {Array.isArray(s.contenido) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {s.contenido.map((p, j) => (
                    <p key={j} style={{ color: p.startsWith("•") ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0, paddingLeft: p.startsWith("•") ? "8px" : "0" }}>{p}</p>
                  ))}
                </div>
              ) : (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>{s.contenido}</p>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "64px", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>© 2025 VELA. Todos los derechos reservados.</span>
          <Link to="/terminos" style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none" }}>Términos de Uso →</Link>
        </div>
      </div>
    </div>
  )
}
