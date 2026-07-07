import { useState, useEffect, useRef } from "react"

// La frase que gira alrededor del holograma (y el h1 de la página).
// Cambiarla aquí actualiza el anillo y el texto estático a la vez.
const FRASE = "vive lo que pasa cerca de ti"

// El recorte con la silueta del cono de luz está HORNEADO en los archivos
// de video/poster (ffmpeg: máscara de cono con borde difuso multiplicada
// sobre cada cuadro — fuera del cono el pixel es negro absoluto). Con
// mix-blend-mode "screen" el negro no aporta nada, así que solo se pega a
// la página el área donde de verdad hay luz, con orillas suaves.
//
// El horneado deja un remanente tenue (no negro puro) en el ~15% superior
// del cuadro — los rayos llegan hasta la orilla sin desvanecerse del todo
// ahí, y se veía como un corte/hueco junto a la barra de navegación.
//
// Dos intentos fallidos que NO repetir:
// 1) Separar la máscara (en un DIV contenedor) del mix-blend-mode (en el
//    <video> hijo): metió un rectángulo visible incluso en Chrome —
//    mask-image, igual que overflow:hidden, aísla el mix-blend-mode de
//    sus descendientes a su propio grupo de mezcla en vez de dejarlo
//    mezclarse con el fondo real de la página (no es un tema de un solo
//    navegador, pasa en cualquiera).
// 2) Recortar con un contenedor "overflow:hidden" alrededor del video:
//    mismo problema que (1), por la misma razón.
//
// La combinación que sí funciona sin rectángulo: mask-image Y
// mix-blend-mode en el MISMO elemento (el <video>/<img>).
const fadeSuperior = {
  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 22%, black 100%)",
  maskImage: "linear-gradient(to bottom, transparent 0%, black 22%, black 100%)",
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
    // margen negativo lo compensa (en escritorio no hace falta).
    margenSuperior: lerp(-72, 0, t),
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
  const videoRef = useRef(null)
  // false hasta que el video esté REPRODUCIÉNDOSE de verdad (evento
  // "playing"). Mientras tanto el <video> queda con opacity 0 y en su
  // lugar se ve un <img> con el poster: una imagen no puede mostrar
  // botón de play jamás, en ningún navegador. Intentos anteriores de
  // ocultar el botón nativo de iOS con CSS de -webkit-media-controls NO
  // funcionaron (iOS moderno cierra el shadow DOM del video y esas
  // reglas ya no le llegan) — NO volver a intentar por esa vía.
  const [reproduciendo, setReproduciendo] = useState(false)

  // El modo de ahorro de datos/batería de muchos celulares bloquea el
  // autoplay aunque el <video> tenga muted+playsInline — iOS en ahorro
  // de energía rechaza incluso el play() forzado hasta que haya un
  // gesto real del usuario. Reintentos PERSISTENTES: en cada toque/clic
  // en cualquier parte de la página y al volver de segundo plano, hasta
  // que el video de verdad arranque.
  useEffect(() => {
    if (reducedMotion) return
    const video = videoRef.current
    if (!video) return
    video.muted = true
    let arrancado = false
    const limpiar = () => {
      document.removeEventListener("touchstart", reintentar)
      document.removeEventListener("click", reintentar)
      document.removeEventListener("visibilitychange", alVolver)
    }
    const intentar = () => video.play().then(() => { arrancado = true; limpiar() }).catch(() => {})
    const reintentar = () => { if (!arrancado) intentar() }
    const alVolver = () => { if (!document.hidden && !arrancado) intentar() }
    intentar()
    document.addEventListener("touchstart", reintentar, { passive: true })
    document.addEventListener("click", reintentar)
    document.addEventListener("visibilitychange", alVolver)
    return limpiar
  }, [reducedMotion])

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

      {/* Mientras el video no esté reproduciéndose (autoplay bloqueado por
          ahorro de energía, etc.), lo que se ve es esta imagen — idéntica
          al primer cuadro del video y sin ninguna interfaz de reproducción
          posible. El video vive debajo con opacity 0 y toma su lugar en
          cuanto dispara "playing". SIN atributo poster en el <video>: es
          sobre el poster donde iOS pinta su botón de play nativo. */}
      {!reproduciendo && (
        <img
          src="/hero-bolt-poster.jpg" alt="" aria-hidden="true"
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -52%)", height: `${videoAlto}px`, width: "auto", mixBlendMode: "screen", pointerEvents: "none", ...fadeSuperior }}
        />
      )}
      <video
        ref={videoRef}
        autoPlay muted loop playsInline aria-hidden="true"
        disablePictureInPicture disableRemotePlayback controls={false} tabIndex={-1}
        onPlaying={() => setReproduciendo(true)}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -52%)", height: `${videoAlto}px`, width: "auto", mixBlendMode: "screen", pointerEvents: "none", opacity: reproduciendo ? 1 : 0, ...fadeSuperior }}
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
