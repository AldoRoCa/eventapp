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

const secciones = [
  {
    titulo: "1. Protección de tu cuenta",
    contenido: [
      "Usa una contraseña segura y única para tu cuenta de VELA.",
      "No compartas tu contraseña con nadie.",
      "Si sospechas que tu cuenta fue comprometida, cambia tu contraseña inmediatamente y contáctanos.",
    ]
  },
  {
    titulo: "2. Seguridad en los pagos",
    contenido: "Todos los pagos en VELA se procesan a través de Mercado Pago, una plataforma certificada con los más altos estándares de seguridad financiera. VELA nunca almacena datos de tarjetas de crédito o débito. Toda la comunicación financiera está cifrada con SSL/TLS."
  },
  {
    titulo: "3. Verificación de anfitriones",
    contenido: "Todos los anfitriones en VELA pasan por un proceso de verificación de identidad que incluye la presentación de una identificación oficial vigente (INE o pasaporte). Esto garantiza que los organizadores de eventos son personas reales y responsables."
  },
  {
    titulo: "4. Protección contra fraudes",
    contenido: [
      "VELA monitorea activamente las transacciones para detectar actividad fraudulenta.",
      "Los boletos son únicos e intransferibles fuera de la plataforma. Cada boleto se registra a nombre de la persona que asistirá al evento (que puede ser distinta de quien realizó la compra) y queda ligado a la cuenta de quien lo compró para fines de soporte y reembolsos.",
      "No revendas boletos fuera de la plataforma — VELA no se hace responsable de transacciones externas.",
      "Si detectas actividad sospechosa, repórtala a panel.admin2026eventapp@gmail.com",
    ]
  },
  {
    titulo: "5. Cooperadores de check-in",
    contenido: "Los anfitriones pueden invitar a colaboradores de confianza para ayudar con el registro de entrada (check-in) de sus eventos, mediante un enlace de invitación. Estas personas no requieren cuenta en VELA y su acceso se limita únicamente a buscar y marcar boletos como usados — no ven información de pagos ni pueden editar el evento. El anfitrión es responsable de decidir con quién comparte este enlace."
  },
  {
    titulo: "6. Privacidad y datos personales",
    contenido: "El tratamiento de tus datos personales está regulado por nuestra Política de Privacidad, en cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México."
  },
  {
    titulo: "7. Responsabilidad en eventos",
    contenido: "VELA actúa como intermediario entre anfitriones y asistentes. Aunque verificamos la identidad de los anfitriones, VELA no se hace responsable por incidentes que ocurran durante los eventos. Te recomendamos tomar precauciones básicas de seguridad personal al asistir a cualquier evento."
  },
  {
    titulo: "8. Reporte de incidentes",
    contenido: "Si experimentas o presencias algún incidente de seguridad relacionado con VELA o con un evento organizado a través de nuestra plataforma, contáctanos de inmediato a panel.admin2026eventapp@gmail.com. Tomamos todos los reportes con seriedad."
  },
]

export default function PoliticasSeguridad() {
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
          <h1 style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px" }}>Políticas de Seguridad</h1>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Última actualización: 2 de julio de 2026</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {secciones.map((s, i) => (
            <div key={i}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>{s.titulo}</h2>
              {Array.isArray(s.contenido) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {s.contenido.map((p, j) => (
                    <p key={j} style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>{p}</p>
                  ))}
                </div>
              ) : (
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>{s.contenido}</p>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: "64px", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>© 2025 VELA. Todos los derechos reservados.</span>
          <Link to="/privacidad" style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none" }}>Política de Privacidad →</Link>
        </div>
      </div>
    </div>
  )
}
