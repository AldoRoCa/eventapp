import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import jsQR from "jsqr"
import { useParams, Link } from "react-router-dom"
import { supabaseKey } from "../supabase"

export default function UnirseCooperador() {
  const { codigo } = useParams()
  const [sesion, setSesion] = useState(null) // { cooperador_id, evento_id, evento_titulo }
  const [nombre, setNombre] = useState("")
  const [uniendo, setUniendo] = useState(false)
  const [error, setError] = useState("")

  const [busqueda, setBusqueda] = useState("")
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [marcando, setMarcando] = useState(null)
  const [mensaje, setMensaje] = useState("")

  const [escaneando, setEscaneando] = useState(false)
  const [errorEscaneo, setErrorEscaneo] = useState("")
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const guardado = localStorage.getItem(`vela_cooperador_${codigo}`)
    if (guardado) {
      try { setSesion(JSON.parse(guardado)) } catch { /* ignora sesión corrupta */ }
    }
  }, [codigo])

  const unirse = async () => {
    if (!nombre.trim()) { setError("Escribe tu nombre para continuar"); return }
    setUniendo(true)
    setError("")
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unirse-cooperador`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({ codigo, nombre: nombre.trim() })
    })
    const data = await res.json()
    if (res.ok) {
      const nuevaSesion = { cooperador_id: data.cooperador_id, evento_id: data.evento_id, evento_titulo: data.evento_titulo }
      localStorage.setItem(`vela_cooperador_${codigo}`, JSON.stringify(nuevaSesion))
      setSesion(nuevaSesion)
    } else {
      setError(data.error || "No se pudo procesar la invitación")
    }
    setUniendo(false)
  }

  const buscar = async (q) => {
    setBusqueda(q)
    if (!q.trim() || !sesion) { setResultados([]); return }
    setBuscando(true)
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buscar-checkin-cooperador`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({ cooperador_id: sesion.cooperador_id, query: q })
    })
    const data = await res.json()
    setResultados(res.ok ? (data.resultados || []) : [])
    setBuscando(false)
  }

  const marcar = async (boletoId) => {
    setMarcando(boletoId)
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hacer-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({ boleto_id: boletoId, cooperador_id: sesion.cooperador_id })
    })
    const data = await res.json()
    if (res.ok) {
      setResultados(prev => prev.map(g => ({
        ...g, boletos: g.boletos.map(b => b.id === boletoId ? { ...b, checkin_en: data.checkin_en } : b)
      })))
      setMensaje("✓ Check-in registrado")
      setTimeout(() => setMensaje(""), 2000)
    } else {
      setMensaje(data.error || "No se pudo registrar el check-in")
      setTimeout(() => setMensaje(""), 3000)
    }
    setMarcando(null)
  }

  const detenerEscaneo = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setEscaneando(false)
  }

  const iniciarEscaneo = async () => {
    setErrorEscaneo("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      setEscaneando(true)
    } catch {
      setErrorEscaneo("No se pudo acceder a la cámara. Revisa los permisos del navegador.")
      setEscaneando(false)
    }
  }

  useEffect(() => {
    if (!escaneando || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play()
    let ultimoIntento = 0
    const tick = (ahora) => {
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA || ahora - ultimoIntento < 120) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      ultimoIntento = ahora
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imagenData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const codigoQr = jsQR(imagenData.data, canvas.width, canvas.height)
      if (codigoQr?.data) {
        detenerEscaneo()
        buscar(codigoQr.data)
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [escaneando])

  useEffect(() => () => detenerEscaneo(), [])

  const inputStyle = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "12px", padding: "12px 16px", color: "white", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", padding: "24px 18px" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "white", marginBottom: "32px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "16px" }}>VELA</span>
        </Link>

        {!sesion ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#0e0e11", border: "1.5px solid rgba(16,185,129,0.2)", borderRadius: "20px", padding: "28px 24px" }}
          >
            <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px" }}>Unirte como cooperador de check-in</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13.5px", marginBottom: "20px", lineHeight: 1.5 }}>
              Vas a poder buscar y marcar la entrada de los asistentes de este evento. No necesitas cuenta — solo escribe tu nombre.
            </p>
            {error && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", color: "#f87171", fontSize: "13px" }}>{error}</div>
            )}
            <label style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "7px" }}>Tu nombre</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Como quieres que te vea el anfitrión" maxLength={100}
              onKeyDown={e => e.key === "Enter" && unirse()} style={{ ...inputStyle, marginBottom: "16px" }} />
            <motion.button onClick={unirse} whileTap={{ scale: 0.97 }} disabled={uniendo}
              style={{ width: "100%", background: "#059669", border: "none", borderRadius: "12px", color: "white", padding: "13px", fontWeight: 700, fontSize: "15px", cursor: uniendo ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: uniendo ? 0.7 : 1 }}
            >{uniendo ? "Uniendo..." : "Unirme"}</motion.button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: "#0e0e11", border: "1.5px solid rgba(16,185,129,0.2)", borderRadius: "20px", padding: "24px" }}
          >
            <div style={{ marginBottom: "18px" }}>
              <div style={{ fontWeight: 700, fontSize: "18px" }}>Check-in</div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{sesion.evento_titulo} · cooperador: {nombre || "tú"}</div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <motion.button onClick={escaneando ? detenerEscaneo : iniciarEscaneo} whileTap={{ scale: 0.97 }}
                style={{ flex: 1, background: escaneando ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.1)", border: `1.5px solid ${escaneando ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.25)"}`, borderRadius: "10px", color: escaneando ? "#f87171" : "#34d399", padding: "9px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >{escaneando ? "Detener cámara" : "📷 Escanear QR"}</motion.button>
            </div>

            {errorEscaneo && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px", color: "#f87171", fontSize: "12.5px" }}>{errorEscaneo}</div>
            )}

            {escaneando && (
              <div style={{ position: "relative", marginBottom: "16px", borderRadius: "12px", overflow: "hidden", background: "black" }}>
                <video ref={videoRef} playsInline muted style={{ width: "100%", display: "block", maxHeight: "320px", objectFit: "cover" }} />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 3px rgba(16,185,129,0.6)", pointerEvents: "none" }} />
              </div>
            )}

            <div style={{ position: "relative", marginBottom: "20px" }}>
              <input value={busqueda} onChange={e => buscar(e.target.value)}
                placeholder="Buscar por nombre o código (ej. AB3X7K)"
                style={inputStyle}
              />
              {buscando && <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Buscando...</div>}
            </div>

            {mensaje && (
              <div style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "10px", color: "#34d399", fontSize: "13px", textAlign: "center" }}>{mensaje}</div>
            )}

            {resultados.length === 0 && busqueda.trim().length > 0 && !buscando && (
              <div style={{ textAlign: "center", padding: "32px", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>No se encontraron boletos con ese nombre o código</div>
            )}
            {resultados.length === 0 && busqueda.trim().length === 0 && (
              <div style={{ textAlign: "center", padding: "32px", color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>Escribe un nombre o el código para buscar</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {resultados.map((grupo, gi) => (
                <div key={gi} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{grupo.nombre}</div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{grupo.codigo}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {grupo.boletos.map(b => (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: b.checkin_en ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${b.checkin_en ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: "10px" }}>
                        <div style={{ fontSize: "13px", color: b.checkin_en ? "#34d399" : "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                          {b.checkin_en ? "✓ Check-in hecho" : "Pendiente de entrada"}
                        </div>
                        {!b.checkin_en && (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => marcar(b.id)} disabled={marcando === b.id}
                            style={{ background: "#059669", border: "none", borderRadius: "8px", color: "white", padding: "7px 14px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: marcando === b.id ? 0.6 : 1 }}
                          >{marcando === b.id ? "..." : "Marcar entrada"}</motion.button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
