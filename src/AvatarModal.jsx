import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function AvatarModal({ src, nombre, size = 40 }) {
  const [modalAbierto, setModalAbierto] = useState(false)

  const inicial = nombre?.charAt(0)?.toUpperCase() || "U"

  return (
    <>
      <div
        onClick={() => src && setModalAbierto(true)}
        style={{
          width: `${size}px`, height: `${size}px`, borderRadius: "999px",
          overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: `${size * 0.38}px`, fontWeight: 700, flexShrink: 0,
          cursor: src ? "pointer" : "default",
          boxShadow: size > 60 ? "0 0 24px rgba(124,58,237,0.4)" : "none",
          transition: "opacity 0.2s",
          position: "relative",
        }}
        onMouseEnter={e => src && (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        {src ? (
          <img src={src} alt={nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : inicial}
      </div>

      <AnimatePresence>
        {modalAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalAbierto(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(12px)", zIndex: 1000,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "24px"
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ position: "relative", maxWidth: "480px", width: "100%" }}
            >
              <img src={src} alt={nombre} style={{ width: "100%", borderRadius: "20px", display: "block", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }} />
              <div style={{ textAlign: "center", marginTop: "16px", color: "rgba(255,255,255,0.6)", fontSize: "15px", fontWeight: 500 }}>{nombre}</div>
              <button
                onClick={() => setModalAbierto(false)}
                style={{ position: "absolute", top: "-12px", right: "-12px", width: "32px", height: "32px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >×</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
