import { useState } from "react"

// La frase que gira alrededor del holograma (y el h1 de la página).
// Cambiarla aquí actualiza el anillo y el texto estático de celular a la vez.
const FRASE = "vive lo que pasa cerca de ti"

// El recorte con la silueta del cono de luz está HORNEADO en los archivos
// de video/poster (ffmpeg: máscara de cono con borde difuso multiplicada
// sobre cada cuadro — fuera del cono el pixel es negro absoluto). Con
// mix-blend-mode "screen" el negro no aporta nada, así que solo se pega a
// la página el área donde de verdad hay luz, con orillas suaves. Un
// clip-path de CSS (intento anterior) dejaba orillas duras visibles.

// Texto colocado letra por letra sobre la circunferencia, con espaciado
// uniforme — un círculo real, no un polígono de letreros planos.
function letrasDelAnillo(frase, repeticiones, radio) {
  const letras = `${frase}  •  `.repeat(repeticiones).split("")
  const paso = 360 / letras.length
  return letras.map((ch, i) => (
    <span
      key={i}
      style={{
        position: "absolute", width: "16px", marginLeft: "-8px", marginTop: "-9px",
        textAlign: "center", whiteSpace: "pre",
        font: "500 13.5px 'Plus Jakarta Sans', sans-serif",
        color: "#cfe0ff",
        textShadow: "0 0 8px rgba(96,130,255,0.9), 0 0 2px rgba(206,224,255,0.8)",
        transform: `rotateY(${(i * paso).toFixed(2)}deg) translateZ(${radio}px)`,
      }}
    >{ch}</span>
  ))
}

export default function HeroHolograma({ isMobile }) {
  // Leído una vez al montar (mismo patrón que useScrollAnimation) — si el
  // usuario prefiere menos movimiento, se muestra la imagen fija.
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  // En celular no se descarga el video (peso y batería): imagen fija + la
  // frase como texto normal. El <video> ni siquiera se monta en el DOM.
  const estatico = isMobile || reducedMotion

  if (estatico) {
    return (
      <div style={{ position: "relative", textAlign: "center", paddingTop: "8px" }}>
        <img
          src="/hero-bolt-poster.jpg" alt="" aria-hidden="true"
          style={{ height: "300px", width: "auto", maxWidth: "100%", objectFit: "contain", mixBlendMode: "screen" }}
        />
        <h1 style={{ fontSize: "1.9rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.5px", margin: "-6px 0 0", background: "linear-gradient(135deg, #c3b2ff 0%, #8fb4ff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {FRASE}
        </h1>
      </div>
    )
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "920px", height: "500px", margin: "0 auto" }}>
      {/* La frase real para lectores de pantalla y buscadores — el anillo
          giratorio es visual, letra por letra, y no se puede leer como texto */}
      <h1 style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0 }}>
        {FRASE}
      </h1>

      <video
        autoPlay muted loop playsInline aria-hidden="true"
        poster="/hero-bolt-poster.jpg"
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -52%)", height: "540px", width: "auto", mixBlendMode: "screen", pointerEvents: "none" }}
      >
        <source src="/hero-bolt.mp4" type="video/mp4" />
        <source src="/hero-bolt.webm" type="video/webm" />
      </video>

      <div style={{ position: "absolute", left: "50%", top: "64%", transform: "translate(-50%, -50%)", perspective: "1100px", pointerEvents: "none", zIndex: 3 }} aria-hidden="true">
        <div style={{ transform: "rotateX(8deg)", transformStyle: "preserve-3d" }}>
          <div className="vela-ring-spin" style={{ position: "relative", width: 0, height: 0, transformStyle: "preserve-3d" }}>
            {letrasDelAnillo(FRASE, 3, 212)}
          </div>
        </div>
      </div>
    </div>
  )
}
