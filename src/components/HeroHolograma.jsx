import { useState, useEffect } from "react"

// La frase que gira alrededor del holograma (y el h1 de la página).
// Cambiarla aquí actualiza el anillo y el texto estático a la vez.
const FRASE = "vive lo que pasa cerca de ti"

// El recorte con la silueta del cono de luz está HORNEADO en los archivos
// de video/poster (ffmpeg: máscara de cono con borde difuso multiplicada
// sobre cada cuadro — fuera del cono el pixel es negro absoluto). Con
// mix-blend-mode "screen" el negro no aporta nada, así que solo se pega a
// la página el área donde de verdad hay luz, con orillas suaves. Un
// clip-path de CSS (intento anterior) dejaba orillas duras visibles.
//
// El horneado deja un remanente tenue (no negro puro) justo en la franja
// superior del cuadro — los rayos de luz llegan hasta la orilla del video
// sin alcanzar a desvanecerse del todo, y se ve como un corte recto justo
// debajo de la barra de navegación. Este degradado de máscara CSS
// (visible solo en el ~15% superior) lo desvanece sin tocar el resto.
const fadeSuperior = {
  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 100%)",
  maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 100%)",
  WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
  WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
}

function lerp(min, max, t) { return min + (max - min) * t }

// Interpola entre el tamaño pensado para el celular más angosto común
// (320px, ej. iPhone SE) y el tamaño de escritorio, para que el holograma
// y el anillo de texto quepan sin recortarse en cualquier ancho — no solo
// un interruptor móvil/escritorio, sino una escala continua.
function useEscalaHero() {
  const [ancho, setAncho] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024))
  useEffect(() => {
    const handler = () => setAncho(window.innerWidth)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  const t = Math.min(1, Math.max(0, (ancho - 320) / (768 - 320)))
  return {
    contenedorAlto: lerp(300, 500, t),
    videoAlto: lerp(320, 540, t),
    radio: lerp(92, 212, t),
    fontSize: lerp(9.5, 13.5, t),
    letraAncho: lerp(10, 16, t),
    perspectiva: lerp(720, 1100, t),
    // La franja superior del video está desvanecida por fadeSuperior —
    // invisible, pero sigue ocupando alto. En pantallas angostas eso se ve
    // como un hueco entre la barra de navegación y el holograma; este
    // margen negativo lo compensa (en escritorio no hace falta). Calibrado
    // para que la luz visible arranque unos px debajo de la barra fija —
    // subirlo más la mete DEBAJO de la barra y reaparece el corte duro.
    margenSuperior: lerp(-28, 0, t),
    // El anillo va más arriba en pantallas angostas: con el radio chico,
    // a la altura de escritorio (64%) las letras pasan encima de la base
    // del holograma en vez de rodear el rayo.
    anilloTop: lerp(54, 64, t),
  }
}

// Texto colocado letra por letra sobre la circunferencia, con espaciado
// uniforme — un círculo real, no un polígono de letreros planos.
function letrasDelAnillo(frase, repeticiones, radio, fontSize, letraAncho) {
  const letras = `${frase}  •  `.repeat(repeticiones).split("")
  const paso = 360 / letras.length
  return letras.map((ch, i) => (
    <span
      key={i}
      style={{
        position: "absolute", width: `${letraAncho}px`, marginLeft: `${-letraAncho / 2}px`, marginTop: `${-fontSize * 0.667}px`,
        textAlign: "center", whiteSpace: "pre",
        font: `500 ${fontSize}px 'Plus Jakarta Sans', sans-serif`,
        color: "#cfe0ff",
        textShadow: "0 0 8px rgba(96,130,255,0.9), 0 0 2px rgba(206,224,255,0.8)",
        transform: `rotateY(${(i * paso).toFixed(2)}deg) translateZ(${radio}px)`,
      }}
    >{ch}</span>
  ))
}

export default function HeroHolograma() {
  // Leído una vez al montar (mismo patrón que useScrollAnimation) — si el
  // usuario prefiere menos movimiento, se muestra la imagen fija.
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
  const { contenedorAlto, videoAlto, radio, fontSize, letraAncho, perspectiva, margenSuperior, anilloTop } = useEscalaHero()

  if (reducedMotion) {
    return (
      <div style={{ position: "relative", textAlign: "center", paddingTop: "8px" }}>
        <img
          src="/hero-bolt-poster.jpg" alt="" aria-hidden="true"
          style={{ height: "300px", width: "auto", maxWidth: "100%", objectFit: "contain", mixBlendMode: "screen", ...fadeSuperior }}
        />
        <h1 style={{ fontSize: "1.9rem", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.5px", margin: "-6px 0 0", background: "linear-gradient(135deg, #c3b2ff 0%, #8fb4ff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {FRASE}
        </h1>
      </div>
    )
  }

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "920px", height: `${contenedorAlto}px`, margin: `${margenSuperior}px auto 0` }}>
      {/* La frase real para lectores de pantalla y buscadores — el anillo
          giratorio es visual, letra por letra, y no se puede leer como texto */}
      <h1 style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0 }}>
        {FRASE}
      </h1>

      <video
        autoPlay muted loop playsInline aria-hidden="true"
        poster="/hero-bolt-poster.jpg"
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -52%)", height: `${videoAlto}px`, width: "auto", mixBlendMode: "screen", pointerEvents: "none", ...fadeSuperior }}
      >
        <source src="/hero-bolt.mp4" type="video/mp4" />
        <source src="/hero-bolt.webm" type="video/webm" />
      </video>

      <div style={{ position: "absolute", left: "50%", top: `${anilloTop}%`, transform: "translate(-50%, -50%)", perspective: `${perspectiva}px`, pointerEvents: "none", zIndex: 3 }} aria-hidden="true">
        <div style={{ transform: "rotateX(8deg)", transformStyle: "preserve-3d" }}>
          <div className="vela-ring-spin" style={{ position: "relative", width: 0, height: 0, transformStyle: "preserve-3d" }}>
            {letrasDelAnillo(FRASE, 3, radio, fontSize, letraAncho)}
          </div>
        </div>
      </div>
    </div>
  )
}
