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
    titulo: "1. Aceptación de los términos",
    contenido: "Al registrarte o usar VELA, aceptas estos Términos de Uso en su totalidad. Si no estás de acuerdo con alguno de estos términos, no debes usar la Plataforma."
  },
  {
    titulo: "2. Descripción del servicio",
    contenido: "VELA es una plataforma digital que conecta a organizadores de eventos (anfitriones) con personas interesadas en asistir a dichos eventos (asistentes). VELA facilita el descubrimiento de eventos, la compra de boletos y la gestión de asistentes."
  },
  {
    titulo: "3. Registro y cuentas",
    contenido: [
      "Para usar VELA debes registrarte con información verídica y mantener la confidencialidad de tu contraseña.",
      "Para convertirte en anfitrión debes ser mayor de 18 años y completar el proceso de verificación de identidad, que incluye la presentación de una identificación oficial vigente.",
      "VELA se reserva el derecho de suspender o eliminar cuentas que violen estos términos.",
    ]
  },
  {
    titulo: "4. Cooperadores de check-in",
    contenido: [
      "Un anfitrión puede invitar a otras personas ('cooperadores') a ayudarle con el registro de entrada (check-in) de un evento, mediante un enlace de invitación. Los cooperadores no necesitan tener cuenta en VELA.",
      "El acceso de un cooperador se limita exclusivamente a buscar y marcar la entrada de boletos del evento para el que fue invitado — no tiene acceso a información de pagos, ingresos, datos de contacto de los asistentes, ni puede editar el evento.",
      "El anfitrión es el único responsable de elegir a quién comparte el enlace de invitación y de revocar el acceso cuando lo considere necesario. VELA no verifica la identidad de los cooperadores.",
    ]
  },
  {
    titulo: "5. Uso de la plataforma",
    contenido: [
      "Está prohibido usar VELA para:",
      "• Publicar eventos con contenido ilegal, fraudulento o engañoso.",
      "• Revender boletos por encima del precio original sin autorización.",
      "• Usar la plataforma para actividades que violen la legislación mexicana vigente.",
      "• Intentar acceder de manera no autorizada a sistemas o cuentas de otros usuarios.",
    ]
  },
  {
    titulo: "6. Compra de boletos",
    contenido: [
      "Las compras realizadas en VELA son procesadas de forma segura a través de Mercado Pago. Al comprar un boleto aceptas el precio y condiciones del evento publicadas por el anfitrión.",
      "VELA aplica una comisión de servicio del 10% sobre el precio del boleto, que se refleja en el total al momento del pago.",
      "Los boletos no son reembolsables salvo en caso de cancelación del evento por parte del anfitrión, o de que un reporte del evento sea resuelto a favor del asistente conforme a la sección 10 de estos Términos.",
    ]
  },
  {
    titulo: "7. Responsabilidades del anfitrión",
    contenido: [
      "Los anfitriones son responsables de la organización, ejecución y cumplimiento legal de sus eventos.",
      "El anfitrión se compromete a no cancelar eventos de forma injustificada. En caso de cancelación, deberá reembolsar el valor íntegro de los boletos a los asistentes.",
      "VELA no es responsable por daños, lesiones o perjuicios derivados de la asistencia a eventos organizados por anfitriones.",
    ]
  },
  {
    titulo: "8. Pagos y comisiones",
    contenido: [
      "VELA retiene el 10% del precio de cada boleto vendido como comisión de plataforma. El 90% restante es transferido al anfitrión a través de Mercado Pago.",
      "Los eventos gratuitos no generan comisión.",
    ]
  },
  {
    titulo: "9. Propiedad intelectual",
    contenido: [
      "El nombre VELA, su logotipo, diseño y código fuente son propiedad exclusiva de sus creadores. Queda prohibida su reproducción o uso sin autorización expresa.",
      "Los usuarios conservan los derechos sobre el contenido que publican (imágenes de eventos, descripciones), pero otorgan a VELA una licencia para mostrarlo en la plataforma.",
    ]
  },
  {
    titulo: "10. Reportes y resolución de disputas",
    contenido: [
      "Si un asistente considera que un evento no se realizó como se anunció, o que el anfitrión no respondió a sus solicitudes, puede reportarlo a través de la Plataforma una vez que el evento haya finalizado.",
      "VELA revisará el reporte y, de considerarlo procedente, podrá cancelar el evento, reembolsar a los asistentes afectados, y suspender la cuenta del anfitrión involucrado.",
      "La decisión de VELA sobre un reporte es definitiva dentro de la Plataforma, sin perjuicio de los derechos que la ley otorgue a las partes ante las autoridades competentes.",
    ]
  },
  {
    titulo: "11. Limitación de responsabilidad",
    contenido: [
      "VELA actúa como intermediario entre anfitriones y asistentes. No garantiza la calidad, seguridad ni realización de ningún evento.",
      "En ningún caso la responsabilidad de VELA excederá el monto pagado por el usuario en la transacción relacionada con el reclamo.",
    ]
  },
  {
    titulo: "12. Modificaciones",
    contenido: "VELA puede modificar estos Términos de Uso en cualquier momento. Los cambios entrarán en vigor al ser publicados en la Plataforma. El uso continuado de VELA implica la aceptación de los términos vigentes."
  },
  {
    titulo: "13. Ley aplicable",
    contenido: "Estos Términos de Uso se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia derivada de su interpretación o cumplimiento, las partes se someten a la jurisdicción de los tribunales competentes de la ciudad de Querétaro, Qro."
  },
]

export default function Terminos() {
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
          <h1 style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.5px", marginBottom: "12px" }}>Términos de Uso</h1>
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
          <Link to="/privacidad" style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none" }}>Política de Privacidad →</Link>
        </div>
      </div>
    </div>
  )
}
