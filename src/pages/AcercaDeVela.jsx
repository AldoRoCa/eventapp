import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

export default function AcercaDeVela() {
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
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

          <div style={{ marginBottom: "48px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(124,58,237,0.5)" }}>
                <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <h1 style={{ fontSize: "2.2rem", fontWeight: 700, letterSpacing: "-0.5px" }}>Acerca de VELA</h1>
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>Conectando a la comunidad a través de experiencias únicas</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>¿Qué es VELA?</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>
                VELA es una plataforma mexicana de venta de boletos para eventos que conecta a organizadores con su comunidad. Nacimos en Querétaro con la misión de hacer que descubrir y asistir a eventos locales sea tan sencillo como sea posible.
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>Nuestra misión</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>
                Creemos que las experiencias compartidas son lo que construye comunidad. VELA existe para eliminar las barreras entre los organizadores de eventos y las personas que quieren vivirlos — sin complicaciones, sin intermediarios innecesarios.
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>Para quién es VELA</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>
                VELA está diseñada para estudiantes universitarios, creadores independientes y organizadores de eventos que quieren llegar a su comunidad de manera directa y eficiente. También para cualquier persona que quiera descubrir eventos interesantes cerca de ellos.
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>Cómo funciona</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { num: "01", titulo: "Los anfitriones crean eventos", desc: "Cualquier persona verificada puede crear un evento en minutos — con imagen, descripción, precio y capacidad." },
                  { num: "02", titulo: "Los asistentes descubren y compran", desc: "Explora eventos cerca de ti, filtra por categoría y compra tus boletos de forma segura con Mercado Pago." },
                  { num: "03", titulo: "VELA facilita la conexión", desc: "Nos encargamos de los pagos, la gestión de asistentes y la comunicación entre anfitriones y asistentes." },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "16px", padding: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#7c3aed", flexShrink: 0, lineHeight: 1 }}>{item.num}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "6px" }}>{item.titulo}</div>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13.5px", lineHeight: 1.6 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa", marginBottom: "12px" }}>Contacto</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14.5px", lineHeight: 1.75, margin: 0 }}>
                ¿Tienes preguntas, sugerencias o necesitas ayuda? Escríbenos a{" "}
                <a href="mailto:panel.admin2026eventapp@gmail.com" style={{ color: "#a78bfa", textDecoration: "none" }}>panel.admin2026eventapp@gmail.com</a>
              </p>
            </div>
          </div>

          <div style={{ marginTop: "64px", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>© 2025 VELA. Todos los derechos reservados.</span>
            <Link to="/terminos" style={{ fontSize: "13px", color: "#a78bfa", textDecoration: "none" }}>Términos de Uso →</Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
