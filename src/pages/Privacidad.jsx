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
    titulo: "1. Responsable del tratamiento de datos",
    contenido: "VELA es responsable del tratamiento de tus datos personales. Para cualquier consulta relacionada con esta política, puedes contactarnos a través del correo electrónico disponible en la aplicación."
  },
  {
    titulo: "2. Datos personales que recopilamos",
    contenido: [
      "Recopilamos los siguientes datos personales cuando te registras o usas VELA:",
      "• Nombre completo y correo electrónico.",
      "• Fotografía de perfil (opcional).",
      "• Número de teléfono (opcional).",
      "• Fecha de nacimiento (para verificación de edad en el registro como anfitrión).",
      "• Identificación oficial (INE/pasaporte) para el proceso de verificación de anfitriones — se almacena en un espacio privado, no accesible públicamente.",
      "• Información de pago procesada por Mercado Pago — VELA no almacena datos de tarjetas.",
      "• Historial de boletos y eventos, incluyendo el registro de check-in (hora de entrada a cada evento).",
      "• Nombre de las personas que un anfitrión invita como cooperadores de check-in — no requieren cuenta en VELA para esto.",
      "• Reseñas y calificaciones que publiques sobre eventos y anfitriones — se muestran públicamente junto con tu nombre y foto de perfil, no son anónimas.",
    ]
  },
  {
    titulo: "3. Finalidad del tratamiento",
    contenido: [
      "Utilizamos tus datos personales para:",
      "• Crear y gestionar tu cuenta en la Plataforma.",
      "• Procesar la compra y emisión de boletos.",
      "• Verificar la identidad de los anfitriones.",
      "• Enviar notificaciones relacionadas con tus eventos y boletos.",
      "• Mejorar la experiencia de usuario y el funcionamiento de la Plataforma.",
      "• Cumplir con obligaciones legales aplicables en México.",
    ]
  },
  {
    titulo: "4. Transferencia de datos",
    contenido: [
      "Tus datos personales pueden ser compartidos con:",
      "• Mercado Pago, para el procesamiento seguro de pagos.",
      "• Supabase Inc., como proveedor de infraestructura de base de datos.",
      "• Autoridades competentes cuando la ley mexicana lo requiera.",
      "No vendemos ni compartimos tus datos con terceros con fines publicitarios.",
    ]
  },
  {
    titulo: "5. Derechos ARCO",
    contenido: "Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus datos personales (derechos ARCO). Para ejercer estos derechos, contáctanos a través del correo disponible en la aplicación. Atenderemos tu solicitud en un plazo máximo de 20 días hábiles."
  },
  {
    titulo: "6. Uso de cookies y tecnologías similares",
    contenido: "VELA utiliza cookies y tecnologías de almacenamiento local únicamente para mantener tu sesión activa y mejorar el funcionamiento de la aplicación. No utilizamos cookies de rastreo publicitario."
  },
  {
    titulo: "7. Seguridad de los datos",
    contenido: "Implementamos medidas técnicas y administrativas para proteger tus datos personales contra acceso no autorizado, pérdida o alteración. Toda la comunicación entre tu dispositivo y nuestros servidores se realiza mediante cifrado SSL/TLS."
  },
  {
    titulo: "8. Retención de datos",
    contenido: "Conservamos tus datos personales mientras mantengas una cuenta activa en VELA. Los boletos y registros de eventos se eliminan automáticamente 30 días después de la fecha del evento."
  },
  {
    titulo: "9. Cambios a esta política",
    contenido: "Podemos actualizar esta Política de Privacidad en cualquier momento. Te notificaremos de cambios significativos a través de la aplicación. El uso continuado de VELA después de dichos cambios implica tu aceptación."
  },
  {
    titulo: "10. Contacto",
    contenido: "Si tienes preguntas sobre esta política o el tratamiento de tus datos, contáctanos a través del correo electrónico disponible en la sección de ayuda dentro de la aplicación VELA."
  },
]

export default function Privacidad() {
  const isMobile = useIsMobile()
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.88)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: isMobile ? "0 16px" : "0 64px", height: "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 18px rgba(124,58,237,0.5)" }}>
            <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "18px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {isMobile ? "Volver" : "Volver al inicio"}
        </Link>
      </nav>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: isMobile ? "40px 18px" : "64px 24px" }}>
        <div style={{ marginBottom: "48px" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px" }}>Política de Privacidad</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Última actualización: 2 de julio de 2026</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {secciones.map((s, i) => (
            <div key={i}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>{s.titulo}</h2>
              {Array.isArray(s.contenido) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {s.contenido.map((p, j) => (
                    <p key={j} style={{ color: p.startsWith("•") ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0, paddingLeft: p.startsWith("•") ? "8px" : "0" }}>{p}</p>
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
