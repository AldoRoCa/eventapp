import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import jsQR from "jsqr"
import { supabase, getUserSafe } from "../supabase"
import { Link, useNavigate } from "react-router-dom"
import { eventoFinalizado, registroFinalizado, horasRegistro } from "../eventoUtils"

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isMobile
}

export default function PanelAnfitrion() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("eventos")
  const [solicitudes, setSolicitudes] = useState([])
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [checkinEvento, setCheckinEvento] = useState(null)
  const [checkinBusqueda, setCheckinBusqueda] = useState("")
  const [checkinResultados, setCheckinResultados] = useState([])
  const [checkinBuscando, setCheckinBuscando] = useState(false)
  const [checkinMarcando, setCheckinMarcando] = useState(null)
  const [eventoSeleccionado, setEventoSeleccionado] = useState(null)
  const [asistentes, setAsistentes] = useState([])
  const [loadingAsistentes, setLoadingAsistentes] = useState(false)
  const [subiendoAvatar, setSubiendoAvatar] = useState(false)
  const [cancelando, setCancelando] = useState(null)
  const [editando, setEditando] = useState(null)
  const [formEditar, setFormEditar] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [modalAvatar, setModalAvatar] = useState(false)
  const [fotoZoom, setFotoZoom] = useState(null)
  const avatarRef = useRef(null)
  const [escaneando, setEscaneando] = useState(false)
  const [errorEscaneo, setErrorEscaneo] = useState("")
  const [exportando, setExportando] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [cooperadoresEvento, setCooperadoresEvento] = useState(null) // evento cuyo modal de cooperadores está abierto
  const [cooperadoresLista, setCooperadoresLista] = useState([])
  const [invitacionActiva, setInvitacionActiva] = useState(null)
  const [cargandoCooperadores, setCargandoCooperadores] = useState(false)
  const [generandoLink, setGenerandoLink] = useState(false)
  const [linkCopiado, setLinkCopiado] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await getUserSafe()
      if (!user) { navigate("/login"); return }
      setUser(user)
      const { data: perfil } = await supabase.from("profiles").select("id, nombre, avatar_url, tipo, estado_anfitrion, email, mp_user_id").eq("id", user.id).single()
      if (!perfil || perfil.tipo !== "anfitrion" || perfil.estado_anfitrion !== "aprobado") { navigate("/ser-anfitrion"); return }
      setPerfil(perfil)
      const { data: eventos } = await supabase.from("eventos").select("*").eq("anfitrion_id", user.id).order("created_at", { ascending: false })
      setEventos(eventos || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const verAsistentes = async (evento) => {
    setEventoSeleccionado(evento)
    setLoadingAsistentes(true)
    setTab("asistentes")
    const { data } = await supabase.from("boletos").select("*, profiles(nombre, email, avatar_url)").eq("evento_id", evento.id).eq("estado", "activo")
    setAsistentes(data || [])
    setLoadingAsistentes(false)
  }

  const verSolicitudes = async () => {
    setLoadingSolicitudes(true)
    setTab("solicitudes")
    const eventosIds = eventos.map(e => e.id)
    if (eventosIds.length === 0) { setSolicitudes([]); setLoadingSolicitudes(false); return }
    const { data } = await supabase.from("boletos").select("*, eventos(titulo, fecha), profiles(nombre, email, avatar_url)").in("evento_id", eventosIds).eq("estado", "pendiente")
    setSolicitudes(data || [])
    setLoadingSolicitudes(false)
  }

  // Mientras el anfitrión esté viendo la pestaña de solicitudes o de
  // asistentes, se refrescan solas cada 20s (sin mostrar "cargando") para
  // que nuevas solicitudes/check-ins aparezcan sin tener que salir y
  // volver a entrar a la pestaña.
  useEffect(() => {
    if (tab !== "solicitudes") return
    const eventosIds = eventos.map(e => e.id)
    if (eventosIds.length === 0) return
    const intervalo = setInterval(async () => {
      const { data } = await supabase.from("boletos").select("*, eventos(titulo, fecha), profiles(nombre, email, avatar_url)").in("evento_id", eventosIds).eq("estado", "pendiente")
      setSolicitudes(data || [])
    }, 20000)
    return () => clearInterval(intervalo)
  }, [tab, eventos])

  useEffect(() => {
    if (tab !== "asistentes" || !eventoSeleccionado) return
    const intervalo = setInterval(async () => {
      const { data } = await supabase.from("boletos").select("*, profiles(nombre, email, avatar_url)").eq("evento_id", eventoSeleccionado.id).eq("estado", "activo")
      setAsistentes(data || [])
    }, 20000)
    return () => clearInterval(intervalo)
  }, [tab, eventoSeleccionado])

  const aprobarSolicitud = async (boletoId) => {
    setProcesando(boletoId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestionar-solicitud`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ boleto_id: boletoId, accion: "aprobar" })
    })
    setSolicitudes(prev => prev.filter(s => s.id !== boletoId))
    setProcesando(null)
  }

  const rechazarSolicitud = async (boletoId) => {
    setProcesando(boletoId)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestionar-solicitud`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ boleto_id: boletoId, accion: "rechazar" })
    })
    setSolicitudes(prev => prev.filter(s => s.id !== boletoId))
    setProcesando(null)
  }

  const buscarCheckin = async (q) => {
    setCheckinBusqueda(q)
    if (!q.trim() || !checkinEvento) { setCheckinResultados([]); return }
    setCheckinBuscando(true)
    const termino = q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const esCodigo = /^[A-Z2-9]{3,6}$/.test(q.trim().toUpperCase())
    let query = supabase.from("boletos")
      .select("id, nombre_registro, codigo_grupo, estado, checkin_en, created_at")
      .eq("evento_id", checkinEvento.id)
      .eq("estado", "activo")
    if (esCodigo) {
      query = query.eq("codigo_grupo", q.trim().toUpperCase())
    } else {
      query = query.ilike("nombre_registro_normalizado", `%${termino}%`)
    }
    const { data } = await query.order("nombre_registro_normalizado")
    const grupos = {}
    for (const b of data || []) {
      const key = b.codigo_grupo || b.id
      if (!grupos[key]) grupos[key] = { codigo: b.codigo_grupo, nombre: b.nombre_registro, boletos: [] }
      grupos[key].boletos.push(b)
    }
    setCheckinResultados(Object.values(grupos))
    setCheckinBuscando(false)
  }

  const marcarCheckin = async (boletoId) => {
    setCheckinMarcando(boletoId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMensaje("Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.")
      setTimeout(() => setMensaje(""), 4000)
      setCheckinMarcando(null)
      return
    }
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hacer-checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ boleto_id: boletoId })
    })
    const data = await res.json()
    if (res.ok) {
      setCheckinResultados(prev => prev.map(g => ({
        ...g, boletos: g.boletos.map(b => b.id === boletoId ? { ...b, checkin_en: data.checkin_en } : b)
      })))
      setMensaje("✓ Check-in registrado")
      setTimeout(() => setMensaje(""), 2000)
    } else {
      setMensaje(data.error || "No se pudo registrar el check-in")
      setTimeout(() => setMensaje(""), 3000)
    }
    setCheckinMarcando(null)
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

  // El <video> solo existe en el DOM una vez que escaneando=true, así que
  // conectar el stream tiene que pasar en un efecto (que corre después de
  // que React ya montó el elemento) y no justo al pedir la cámara — en
  // celulares más lentos, un setTimeout(0) podía ganarle al render y
  // dejar la cámara prendida pero con el video en negro.
  useEffect(() => {
    if (!escaneando || !videoRef.current || !streamRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play()
    let ultimoIntento = 0
    const tick = (ahora) => {
      const canvas = canvasRef.current
      // Un código QR no cambia entre un frame y el siguiente — decodificar
      // a la velocidad de refresco de la pantalla (hasta 120 veces por
      // segundo en celulares) solo gasta batería sin ganar nada. Con ~8
      // intentos por segundo es más que suficiente para sentirse instantáneo.
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
      const codigo = jsQR(imagenData.data, canvas.width, canvas.height)
      if (codigo?.data) {
        detenerEscaneo()
        buscarCheckin(codigo.data)
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [escaneando])

  // Si se cierra el modal de check-in con la cámara todavía prendida, hay
  // que apagarla — si no, el navegador se queda usando la cámara en segundo
  // plano indefinidamente.
  useEffect(() => {
    if (!checkinEvento) detenerEscaneo()
  }, [checkinEvento])
  useEffect(() => () => detenerEscaneo(), [])

  const exportarCSV = async () => {
    if (!checkinEvento) return
    setExportando(true)
    const { data } = await supabase.from("boletos")
      .select("nombre_registro, codigo_grupo, estado, checkin_en, created_at")
      .eq("evento_id", checkinEvento.id)
      .in("estado", ["activo", "pendiente"])
      .order("nombre_registro_normalizado")

    const grupos = {}
    for (const b of data || []) {
      const key = b.codigo_grupo || `${b.nombre_registro}-${b.created_at}`
      if (!grupos[key]) grupos[key] = { nombre: b.nombre_registro, codigo: b.codigo_grupo || "", estado: b.estado, boletos: 0, checkins: 0, checkinEn: null, creadoEn: b.created_at }
      grupos[key].boletos++
      if (b.checkin_en) { grupos[key].checkins++; if (!grupos[key].checkinEn) grupos[key].checkinEn = b.checkin_en }
    }

    const filas = Object.values(grupos)
    const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const encabezado = ["Nombre", "Código", "Estado", "Boletos", "Check-ins hechos", "Hora de check-in", "Hora de compra/registro"]
    const lineas = [encabezado.map(escapar).join(",")]
    for (const f of filas) {
      lineas.push([
        f.nombre, f.codigo, f.estado === "pendiente" ? "Pendiente de aprobación" : "Activo",
        f.boletos, f.checkins,
        f.checkinEn ? new Date(f.checkinEn).toLocaleString("es-MX") : "Sin check-in",
        f.creadoEn ? new Date(f.creadoEn).toLocaleString("es-MX") : "",
      ].map(escapar).join(","))
    }

    const csv = "﻿" + lineas.join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `checkin-${checkinEvento.titulo.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportando(false)
  }

  const abrirCooperadores = async (evento) => {
    setCooperadoresEvento(evento)
    setCargandoCooperadores(true)
    const [{ data: invitaciones }, { data: cooperadores }] = await Promise.all([
      supabase.from("invitaciones_cooperador").select("id, codigo").eq("evento_id", evento.id).eq("activa", true).order("created_at", { ascending: false }).limit(1),
      supabase.from("cooperadores_evento").select("id, nombre, created_at").eq("evento_id", evento.id).order("created_at", { ascending: false }),
    ])
    setInvitacionActiva(invitaciones?.[0] || null)
    setCooperadoresLista(cooperadores || [])
    setCargandoCooperadores(false)
  }

  const generarLink = async () => {
    if (!cooperadoresEvento) return
    setGenerandoLink(true)
    const codigo = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
    const { data, error } = await supabase.from("invitaciones_cooperador")
      .insert({ evento_id: cooperadoresEvento.id, codigo, created_by: user.id })
      .select("id, codigo")
      .single()
    if (!error && data) setInvitacionActiva(data)
    setGenerandoLink(false)
  }

  const revocarLink = async () => {
    if (!invitacionActiva) return
    await supabase.from("invitaciones_cooperador").update({ activa: false }).eq("id", invitacionActiva.id)
    setInvitacionActiva(null)
  }

  const quitarCooperador = async (cooperadorId) => {
    await supabase.from("cooperadores_evento").delete().eq("id", cooperadorId)
    setCooperadoresLista(prev => prev.filter(c => c.id !== cooperadorId))
  }

  const cancelarEvento = async (eventoId) => {
    if (!window.confirm("¿Estás seguro de cancelar este evento? Se procesarán los reembolsos automáticamente.")) return
    setCancelando(eventoId)
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancelar-evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ evento_id: eventoId, anfitrion_id: user.id })
    })
    const data = await response.json()
    if (data.ok) {
      setEventos(prev => prev.filter(e => e.id !== eventoId))
      setMensaje(`Evento cancelado. ${data.reembolsados > 0 ? `Se procesaron ${data.reembolsados} reembolso${data.reembolsados > 1 ? "s" : ""}.` : ""}`)
      setTimeout(() => setMensaje(""), 5000)
    } else {
      setMensaje("Error al cancelar el evento. Intenta de nuevo.")
      setTimeout(() => setMensaje(""), 3000)
    }
    setCancelando(null)
  }

  const abrirEditar = (evento) => {
    setEditando(evento.id)
    const fechaLocal = evento.fecha ? new Date(evento.fecha) : null
    setFormEditar({
      titulo: evento.titulo,
      descripcion: evento.descripcion || "",
      ubicacion: evento.ubicacion,
      estado_evento: evento.estado_evento || "",
      capacidad: evento.capacidad,
      precio: evento.precio,
      max_boletos_por_persona: evento.max_boletos_por_persona || 5,
      duracion_horas: evento.duracion_horas || 5,
      tiempo_registro_horas: evento.tiempo_registro_horas || "",
      // Extraídas ambas de la MISMA fecha ya convertida a hora local —
      // antes "fecha" se tomaba directo del string UTC sin convertir,
      // mientras "hora" sí se convertía, lo cual desalineaba la fecha un
      // día para eventos guardados después de las 6pm hora de Querétaro.
      fecha: fechaLocal ? `${fechaLocal.getFullYear()}-${String(fechaLocal.getMonth() + 1).padStart(2, "0")}-${String(fechaLocal.getDate()).padStart(2, "0")}` : "",
      hora: fechaLocal ? fechaLocal.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
    })
  }

  const guardarEdicion = async () => {
    const titulo = formEditar.titulo.trim()
    const ubicacion = formEditar.ubicacion.trim()

    const eventoOriginal = eventos.find(e => e.id === editando)
    if (eventoOriginal && eventoFinalizado(eventoOriginal)) {
      setMensaje("Este evento ya finalizó (pasó su duración) y no se puede editar.")
      setTimeout(() => setMensaje(""), 4000)
      setEditando(null)
      return
    }

    if (!titulo || !ubicacion || !formEditar.fecha || !formEditar.hora || !formEditar.capacidad) {
      setMensaje("Por favor llena todos los campos obligatorios")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if (titulo.length > 150) {
      setMensaje("El título no puede tener más de 150 caracteres")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if (ubicacion.length > 200) {
      setMensaje("La ubicación no puede tener más de 200 caracteres")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if ((formEditar.descripcion || "").length > 2000) {
      setMensaje("La descripción no puede tener más de 2000 caracteres")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const capacidad = parseInt(formEditar.capacidad)
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 50000) {
      setMensaje("La capacidad debe ser un número entre 1 y 50,000")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const precio = formEditar.precio === "" ? 0 : parseInt(formEditar.precio)
    if (!Number.isInteger(precio) || precio < 0 || precio > 50000) {
      setMensaje("El precio debe ser un número entre 0 y 50,000")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    if (precio > 0 && !perfil?.mp_user_id) {
      setMensaje("Debes conectar tu cuenta de Mercado Pago antes de poner un precio mayor a $0.")
      setTimeout(() => setMensaje(""), 4000)
      return
    }
    const maxBoletos = formEditar.max_boletos_por_persona === "" ? 5 : parseInt(formEditar.max_boletos_por_persona)
    if (!Number.isInteger(maxBoletos) || maxBoletos < 1 || maxBoletos > 20) {
      setMensaje("El máximo de boletos por persona debe ser un número entre 1 y 20")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const duracionHoras = parseFloat(formEditar.duracion_horas)
    if (!Number.isFinite(duracionHoras) || duracionHoras <= 0 || duracionHoras > 24) {
      setMensaje("La duración del evento debe ser un número entre 0 y 24 horas")
      setTimeout(() => setMensaje(""), 3000)
      return
    }
    const tiempoRegistroHoras = formEditar.tiempo_registro_horas === "" ? null : parseFloat(formEditar.tiempo_registro_horas)
    if (tiempoRegistroHoras !== null && (!Number.isFinite(tiempoRegistroHoras) || tiempoRegistroHoras <= 0 || tiempoRegistroHoras > 24)) {
      setMensaje("El tiempo de registro debe ser un número entre 0 y 24 horas")
      setTimeout(() => setMensaje(""), 3000)
      return
    }

    setGuardando(true)
    const fechaCompleta = new Date(`${formEditar.fecha}T${formEditar.hora}:00`).toISOString()
    const { data, error } = await supabase.from("eventos").update({
      titulo, descripcion: (formEditar.descripcion || "").trim(), ubicacion,
      estado_evento: formEditar.estado_evento || null, capacidad,
      precio, max_boletos_por_persona: maxBoletos,
      duracion_horas: duracionHoras, tiempo_registro_horas: tiempoRegistroHoras,
      fecha: fechaCompleta,
    }).eq("id", editando).select()

    if (!error && data && data.length > 0) {
      setEventos(prev => prev.map(e => e.id === editando ? { ...e, ...formEditar, titulo, ubicacion, capacidad, precio, max_boletos_por_persona: maxBoletos, duracion_horas: duracionHoras, tiempo_registro_horas: tiempoRegistroHoras, fecha: fechaCompleta } : e))
      setEditando(null)
      setMensaje("Evento actualizado correctamente.")
      setTimeout(() => setMensaje(""), 3000)
    } else if (!error && (!data || data.length === 0)) {
      // RLS bloqueó la actualización sin lanzar un error explícito (esto
      // pasa, por ejemplo, si el evento ya finalizó hace más de 5 horas
      // justo mientras el modal estaba abierto).
      setMensaje("No se pudo guardar: este evento ya no se puede editar (probablemente finalizó).")
      setTimeout(() => setMensaje(""), 4000)
      setEditando(null)
    } else {
      setMensaje("Error al actualizar el evento. Intenta de nuevo.")
      setTimeout(() => setMensaje(""), 3000)
    }
    setGuardando(false)
  }

  const subirAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setMensaje("La imagen no puede pesar más de 5MB"); return }
    setSubiendoAvatar(true)
    const ext = file.name.split(".").pop()
    const nombre = `${user.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from("avatars").upload(nombre, file)
    if (uploadError) { setMensaje("Error al subir la imagen."); setSubiendoAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(nombre)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id)
    setPerfil(prev => ({ ...prev, avatar_url: `${publicUrl}?t=${Date.now()}` }))
    setSubiendoAvatar(false)
    setMensaje("Foto de perfil actualizada.")
    setTimeout(() => setMensaje(""), 3000)
  }

  const conectarMP = async () => {
    // El "state" de OAuth no puede ser el user.id directo: es un dato
    // público (se ve en cualquier página de evento), así que cualquiera
    // podría falsificarlo para que su propio token de Mercado Pago quede
    // ligado al perfil de otro anfitrión. En vez de eso, generamos un
    // código de un solo uso y lo guardamos ligado a este usuario; mp-oauth
    // lo consulta para saber a quién pertenece de verdad.
    const state = crypto.randomUUID()
    const { error } = await supabase.from("mp_oauth_state").insert({ state, usuario_id: user.id })
    if (error) { setMensaje("No se pudo iniciar la conexión con Mercado Pago. Intenta de nuevo."); setTimeout(() => setMensaje(""), 3000); return }
    const clientId = import.meta.env.VITE_MP_CLIENT_ID
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-oauth`
    const url = `https://auth.mercadopago.com.mx/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.location.href = url
  }

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "10px 14px", color: "white", fontSize: "14px",
    fontFamily: "inherit", outline: "none", boxSizing: "border-box",
    boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(124,58,237,0.1)",
    transition: "border 0.2s"
  }

  const tabs = [
    { id: "eventos", label: "Mis eventos" },
    { id: "asistentes", label: eventoSeleccionado ? (isMobile ? "Asistentes" : `Asistentes · ${eventoSeleccionado.titulo}`) : "Asistentes" },
    { id: "solicitudes", label: isMobile ? "Solicitudes" : "Solicitudes pendientes" },
  ]

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      Cargando panel...
    </div>
  )

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#080808", color: "white", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(8,8,8,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: `0 ${isMobile ? "18px" : "64px"}`, height: isMobile ? "56px" : "68px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "white" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(124,58,237,0.55)" }}>
            <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "0.5px" }}>VELA</span>
        </Link>
        <Link to="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          {!isMobile && "Inicio"}
        </Link>
      </nav>

      {/* HEADER con degradado */}
      <div style={{ background: "linear-gradient(135deg, #0d0b2e 0%, #120f3a 40%, #080808 100%)", padding: isMobile ? "28px 18px 24px" : "48px 64px 40px", borderBottom: "1px solid rgba(124,58,237,0.12)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-60px", right: "10%", width: "500px", height: "300px", background: "radial-gradient(ellipse, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative" }}>

          {/* Perfil card dentro del header */}
          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? "16px" : "28px", flexDirection: isMobile ? "column" : "row" }}>

            {/* Avatar + info */}
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "16px" : "24px", flex: 1 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: isMobile ? "68px" : "80px", height: isMobile ? "68px" : "80px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? "26px" : "30px", fontWeight: 700, boxShadow: "0 0 28px rgba(124,58,237,0.45), 0 0 0 2px rgba(124,58,237,0.25)" }}>
                  {perfil?.avatar_url ? (
                    <img src={perfil.avatar_url} alt="avatar" onClick={() => setModalAvatar(true)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
                  ) : perfil?.nombre?.charAt(0) || "A"}
                </div>
                <input type="file" ref={avatarRef} accept="image/*" onChange={subirAvatar} style={{ display: "none" }} />
                <motion.button onClick={() => avatarRef.current.click()} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} disabled={subiendoAvatar}
                  style={{ position: "absolute", bottom: 0, right: 0, width: "26px", height: "26px", borderRadius: "999px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "2px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 8px rgba(124,58,237,0.5)" }}
                >
                  {subiendoAvatar ? <div style={{ width: "9px", height: "9px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "999px", animation: "spin 0.8s linear infinite" }} /> : <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>}
                </motion.button>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: isMobile ? "1.2rem" : "1.4rem", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>{perfil?.nombre}</h1>
                  <span style={{ background: "rgba(124,58,237,0.25)", border: "1.5px solid rgba(124,58,237,0.4)", borderRadius: "999px", padding: "2px 10px", fontSize: "11.5px", fontWeight: 600, color: "#a78bfa" }}>⚡ Anfitrión</span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "0 0 10px" }}>{perfil?.email}</p>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "10px", padding: "6px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", color: "#a78bfa" }}>{eventos.length}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>Eventos</div>
                  </div>
                  <div style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.18)", borderRadius: "10px", padding: "6px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: "16px", color: "#a78bfa" }}>{eventos.reduce((acc, e) => acc + (e.capacidad || 0), 0)}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>Cupos totales</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: "10px", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "center" : "flex-end", flexWrap: "wrap" }}>
              <motion.button onClick={() => navigate("/crear-evento")} whileTap={{ scale: 0.97 }}
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: "white", padding: isMobile ? "10px 16px" : "11px 22px", fontWeight: 600, fontSize: isMobile ? "13px" : "14px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 0 18px rgba(124,58,237,0.4)" }}
              >+ Crear evento</motion.button>

              {perfil?.mp_user_id ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "8px", padding: "5px 11px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#34d399" }} />
                    <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>MP conectado ✓</span>
                  </div>
                  <motion.button onClick={conectarMP} whileTap={{ scale: 0.97 }}
                    style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px", color: "rgba(255,255,255,0.35)", padding: "3px 9px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}
                  >Reconectar</motion.button>
                </div>
              ) : (
                <motion.button onClick={conectarMP} whileTap={{ scale: 0.97 }}
                  style={{ background: "rgba(9,103,210,0.15)", border: "1.5px solid rgba(9,103,210,0.3)", borderRadius: "10px", color: "#60a5fa", padding: "9px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >💳 Conectar Mercado Pago</motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: isMobile ? "20px 18px 48px" : "36px 64px 60px" }}>

        <AnimatePresence>
          {mensaje && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "12px", padding: "12px 16px", marginBottom: "24px", color: "#34d399", fontSize: "13.5px" }}
            >✓ {mensaje}</motion.div>
          )}
        </AnimatePresence>

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "4px", width: isMobile ? "100%" : "fit-content" }}>
          {tabs.map(t => (
            <motion.button key={t.id}
              onClick={() => { setTab(t.id); if (t.id === "solicitudes") verSolicitudes() }}
              whileTap={{ scale: 0.97 }}
              style={{ flex: isMobile ? 1 : "none", padding: isMobile ? "9px 8px" : "8px 20px", borderRadius: "10px", cursor: "pointer", border: "none", background: tab === t.id ? "rgba(124,58,237,0.35)" : "transparent", color: tab === t.id ? "white" : "rgba(255,255,255,0.45)", fontSize: isMobile ? "12.5px" : "14px", fontWeight: tab === t.id ? 600 : 500, fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap", boxShadow: tab === t.id ? "0 0 12px rgba(124,58,237,0.25)" : "none" }}
            >{t.label}</motion.button>
          ))}
        </div>

        {/* TAB: EVENTOS */}
        {tab === "eventos" && (
          <div>
            {eventos.length === 0 ? (
              <div style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "16px" }}>📅</div>
                <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>Aún no tienes eventos</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginBottom: "28px" }}>Crea tu primer evento y empieza a vender boletos</div>
                <motion.button onClick={() => navigate("/crear-evento")} whileTap={{ scale: 0.97 }}
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "12px", color: "white", padding: "12px 28px", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 0 18px rgba(124,58,237,0.35)" }}
                >Crear evento</motion.button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {eventos.map(ev => {
                  const fecha = new Date(ev.fecha)
                  const finalizado = eventoFinalizado(ev)
                  return (
                    <motion.div key={ev.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                      style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: isMobile ? "16px" : "20px 24px" }}
                    >
                      {isMobile ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px", gap: "10px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.titulo}</div>
                              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12.5px" }}>
                                {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {ev.ubicacion}
                              </div>
                            </div>
                            <span style={{ background: finalizado ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.2)", border: `1.5px solid ${finalizado ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.35)"}`, borderRadius: "999px", padding: "3px 10px", fontSize: "11px", fontWeight: 600, color: finalizado ? "rgba(255,255,255,0.4)" : "#a78bfa", flexShrink: 0 }}>
                              {finalizado ? "Finalizado" : "Activo"}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <motion.button onClick={() => navigate(`/evento/${ev.id}`)} whileTap={{ scale: 0.95 }}
                              style={{ flex: 1, background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "9px", color: "#a78bfa", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Ir a evento</motion.button>
                            <motion.button onClick={() => { setCheckinEvento(ev); setCheckinBusqueda(""); setCheckinResultados([]) }} whileTap={{ scale: 0.95 }}
                              style={{ flex: 1, background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "9px", color: "#34d399", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Check-in</motion.button>
                            <motion.button onClick={() => abrirCooperadores(ev)} whileTap={{ scale: 0.95 }}
                              style={{ flex: 1, background: "rgba(96,165,250,0.08)", border: "1.5px solid rgba(96,165,250,0.25)", borderRadius: "9px", color: "#60a5fa", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Cooperadores</motion.button>
                            <motion.button onClick={() => verAsistentes(ev)} whileTap={{ scale: 0.95 }}
                              style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: "rgba(255,255,255,0.7)", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Asistentes</motion.button>
                            <motion.button onClick={() => !finalizado && abrirEditar(ev)} whileTap={{ scale: finalizado ? 1 : 0.95 }} disabled={finalizado}
                              title={finalizado ? "No se puede editar un evento finalizado" : ""}
                              style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: finalizado ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: finalizado ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                            >Editar</motion.button>
                            <motion.button onClick={() => cancelarEvento(ev.id)} whileTap={{ scale: 0.95 }} disabled={cancelando === ev.id}
                              style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 10px", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >{cancelando === ev.id ? "..." : "Cancelar"}</motion.button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                              <span style={{ fontWeight: 600, fontSize: "15.5px" }}>{ev.titulo}</span>
                              <span style={{ background: finalizado ? "rgba(255,255,255,0.06)" : "rgba(124,58,237,0.2)", border: `1.5px solid ${finalizado ? "rgba(255,255,255,0.1)" : "rgba(124,58,237,0.35)"}`, borderRadius: "999px", padding: "2px 10px", fontSize: "11px", fontWeight: 600, color: finalizado ? "rgba(255,255,255,0.4)" : "#a78bfa" }}>
                                {finalizado ? "Finalizado" : "Activo"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "20px", color: "rgba(255,255,255,0.4)", fontSize: "13px", flexWrap: "wrap" }}>
                              <span>📅 {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
                              <span>📍 {ev.ubicacion}</span>
                              <span>👥 {ev.capacidad} cupos</span>
                              <span>💰 {ev.precio === 0 ? "Gratis" : `$${ev.precio} MXN`}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <motion.button onClick={() => navigate(`/evento/${ev.id}`)} whileTap={{ scale: 0.97 }}
                              style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: "9px", color: "#a78bfa", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Ir a evento</motion.button>
                            <motion.button onClick={() => { setCheckinEvento(ev); setCheckinBusqueda(""); setCheckinResultados([]) }} whileTap={{ scale: 0.97 }}
                              style={{ background: "rgba(16,185,129,0.08)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "9px", color: "#34d399", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Check-in</motion.button>
                            <motion.button onClick={() => abrirCooperadores(ev)} whileTap={{ scale: 0.97 }}
                              style={{ background: "rgba(96,165,250,0.08)", border: "1.5px solid rgba(96,165,250,0.25)", borderRadius: "9px", color: "#60a5fa", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Cooperadores</motion.button>
                            <motion.button onClick={() => verAsistentes(ev)} whileTap={{ scale: 0.97 }}
                              style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: "rgba(255,255,255,0.7)", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >Ver asistentes</motion.button>
                            <motion.button onClick={() => !finalizado && abrirEditar(ev)} whileTap={{ scale: finalizado ? 1 : 0.97 }} disabled={finalizado}
                              title={finalizado ? "No se puede editar un evento finalizado" : ""}
                              style={{ background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "9px", color: finalizado ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: finalizado ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                            >Editar</motion.button>
                            <motion.button onClick={() => cancelarEvento(ev.id)} whileTap={{ scale: 0.97 }} disabled={cancelando === ev.id}
                              style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 14px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                            >{cancelando === ev.id ? "..." : "Cancelar"}</motion.button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: SOLICITUDES */}
        {tab === "solicitudes" && (
          <div>
            {loadingSolicitudes ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)" }}>Cargando solicitudes...</div>
            ) : solicitudes.length === 0 ? (
              <div style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "16px" }}>✅</div>
                <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>No hay solicitudes pendientes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Cuando alguien solicite un boleto aparecerá aquí</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {solicitudes.map((sol, i) => (
                  <motion.div key={sol.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: isMobile ? "14px" : "16px 20px", display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: "12px", flexDirection: isMobile ? "column" : "row" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                        {sol.profiles?.avatar_url ? <img src={sol.profiles.avatar_url} alt="" onClick={() => setFotoZoom(sol.profiles.avatar_url)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} /> : sol.profiles?.nombre?.charAt(0) || "U"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{sol.profiles?.nombre || "Usuario"}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px" }}>{sol.eventos?.titulo} · {sol.profiles?.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", width: isMobile ? "100%" : "auto" }}>
                      <motion.button onClick={() => aprobarSolicitud(sol.id)} whileTap={{ scale: 0.97 }} disabled={procesando === sol.id}
                        style={{ flex: isMobile ? 1 : "none", background: "rgba(16,185,129,0.15)", border: "1.5px solid rgba(16,185,129,0.3)", borderRadius: "9px", color: "#34d399", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >{procesando === sol.id ? "..." : "✓ Aprobar"}</motion.button>
                      <motion.button onClick={() => rechazarSolicitud(sol.id)} whileTap={{ scale: 0.97 }} disabled={procesando === sol.id}
                        style={{ flex: isMobile ? 1 : "none", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", borderRadius: "9px", color: "#f87171", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                      >✕ Rechazar</motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: ASISTENTES */}
        {tab === "asistentes" && (
          <div>
            {!eventoSeleccionado ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>
                Selecciona un evento desde "Mis eventos" para ver sus asistentes
              </div>
            ) : loadingAsistentes ? (
              <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.35)" }}>Cargando asistentes...</div>
            ) : asistentes.length === 0 ? (
              <div style={{ textAlign: "center", padding: isMobile ? "56px 20px" : "80px 24px", background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "16px" }}>👥</div>
                <div style={{ fontWeight: 600, fontSize: "17px", marginBottom: "8px" }}>Aún no hay asistentes</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Comparte tu evento para que la gente se registre</div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "16px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>{asistentes.length} asistente{asistentes.length !== 1 ? "s" : ""} en <span style={{ color: "#a78bfa" }}>{eventoSeleccionado.titulo}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {asistentes.map((boleto, i) => (
                    <motion.div key={boleto.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ background: "#0f0f11", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: isMobile ? "14px" : "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}
                    >
                      <div style={{ width: "38px", height: "38px", borderRadius: "999px", overflow: "hidden", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                        {boleto.profiles?.avatar_url ? <img src={boleto.profiles.avatar_url} alt="" onClick={() => setFotoZoom(boleto.profiles.avatar_url)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} /> : boleto.profiles?.nombre?.charAt(0) || "U"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{boleto.profiles?.nombre || "Usuario"}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{boleto.profiles?.email}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(16,185,129,0.1)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "999px", padding: "4px 11px", flexShrink: 0 }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#34d399" }} />
                        <span style={{ fontSize: "12px", color: "#34d399", fontWeight: 600 }}>Confirmado</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL EDITAR */}
      <AnimatePresence>
        {editando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
            onClick={e => e.target === e.currentTarget && setEditando(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: "#111113", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: isMobile ? "24px 18px" : "32px", width: "100%", maxWidth: "560px", maxHeight: "92vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>Editar evento</h2>
                <button onClick={() => setEditando(null)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.6)", fontSize: "18px", cursor: "pointer", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Nombre *</label>
                  <input value={formEditar.titulo} onChange={e => setFormEditar(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Descripción</label>
                  <textarea value={formEditar.descripcion} onChange={e => setFormEditar(f => ({ ...f, descripcion: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Fecha</label>
                    <input type="date" value={formEditar.fecha} onChange={e => setFormEditar(f => ({ ...f, fecha: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Hora</label>
                    <input type="time" value={formEditar.hora} onChange={e => setFormEditar(f => ({ ...f, hora: e.target.value }))} style={{ ...inputStyle, colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Ubicación</label>
                  <input value={formEditar.ubicacion} onChange={e => setFormEditar(f => ({ ...f, ubicacion: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Estado</label>
                  <select value={formEditar.estado_evento || ""} onChange={e => setFormEditar(f => ({ ...f, estado_evento: e.target.value }))} style={{ ...inputStyle, cursor: "pointer", colorScheme: "dark" }}>
                    <option value="" style={{ background: "#111" }}>Selecciona un estado</option>
                    {["Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"].map(e => (
                      <option key={e} value={e} style={{ background: "#111" }}>{e}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Capacidad</label>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>¿Cuántas personas pueden asistir?</div>
                    <input type="number" value={formEditar.capacidad} onChange={e => setFormEditar(f => ({ ...f, capacidad: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Precio (MXN)</label>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Lo que recibirás por cada boleto</div>
                    <input type="number" value={formEditar.precio} onChange={e => setFormEditar(f => ({ ...f, precio: e.target.value }))} disabled={!perfil?.mp_user_id}
                      style={{ ...inputStyle, opacity: perfil?.mp_user_id ? 1 : 0.5, cursor: perfil?.mp_user_id ? "text" : "not-allowed" }} />
                    {!perfil?.mp_user_id && (
                      <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginTop: "5px" }}>Conecta Mercado Pago para poder cobrar por tus boletos.</div>
                    )}
                    {formEditar.precio > 0 && (
                      <div style={{ marginTop: "8px", padding: "10px 14px", background: "rgba(124,58,237,0.1)", border: "1.5px solid rgba(124,58,237,0.22)", borderRadius: "10px", fontSize: "13px" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>Precio final al asistente: </span>
                        <span style={{ color: "#a78bfa", fontWeight: 700 }}>${Math.round(parseInt(formEditar.precio) * 1.10)} MXN</span>
                        <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "11px", marginLeft: "5px" }}>(+10% VELA)</span>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Límite de boletos por persona</label>
                  <input type="number" value={formEditar.max_boletos_por_persona} onChange={e => setFormEditar(f => ({ ...f, max_boletos_por_persona: e.target.value }))} min="1" max="20" style={inputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Duración del evento (horas)</label>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Pasado este tiempo, el evento se marca como finalizado</div>
                    <input type="number" value={formEditar.duracion_horas} onChange={e => setFormEditar(f => ({ ...f, duracion_horas: e.target.value }))} min="1" max="24" step="0.5" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", color: "rgba(255,255,255,0.45)", marginBottom: "6px" }}>Tiempo de registro/entrada (horas)</label>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Opcional — si lo dejas vacío, se usa la duración del evento</div>
                    <input type="number" value={formEditar.tiempo_registro_horas} onChange={e => setFormEditar(f => ({ ...f, tiempo_registro_horas: e.target.value }))} placeholder="Igual que la duración" min="1" max="24" step="0.5" style={inputStyle} />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                <motion.button onClick={guardarEdicion} whileTap={{ scale: 0.97 }} disabled={guardando}
                  style={{ flex: 1, background: "linear-gradient(135deg, #7c3aed, #4f46e5)", border: "none", borderRadius: "11px", color: "white", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: guardando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: guardando ? 0.7 : 1, boxShadow: "0 0 16px rgba(124,58,237,0.35)" }}
                >{guardando ? "Guardando..." : "Guardar cambios"}</motion.button>
                <motion.button onClick={() => setEditando(null)} whileTap={{ scale: 0.97 }}
                  style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: "11px", color: "rgba(255,255,255,0.6)", padding: "12px 20px", fontWeight: 500, fontSize: "14px", cursor: "pointer", fontFamily: "inherit" }}
                >Cancelar</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL AVATAR PROPIO */}
      {modalAvatar && perfil?.avatar_url && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setModalAvatar(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", width: "100%" }}>
            <img src={perfil.avatar_url} alt={perfil.nombre} style={{ width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }} />
            <div style={{ textAlign: "center", marginTop: "16px", color: "rgba(255,255,255,0.6)", fontSize: "15px" }}>{perfil.nombre}</div>
          </motion.div>
        </motion.div>
      )}

      {/* MODAL: panel de check-in */}
      {checkinEvento && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px", overflowY: "auto" }}
          onClick={() => setCheckinEvento(null)}
        >
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            style={{ background: "#0e0e11", border: "1.5px solid rgba(16,185,129,0.2)", borderRadius: "20px", padding: "28px 24px", width: "100%", maxWidth: "560px", marginTop: "60px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "18px" }}>Check-in</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{checkinEvento.titulo}</div>
              </div>
              <button onClick={() => setCheckinEvento(null)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "22px", cursor: "pointer", lineHeight: 1, fontFamily: "inherit" }}
              >×</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", padding: "10px 14px", background: registroFinalizado(checkinEvento) ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)", border: `1px solid ${registroFinalizado(checkinEvento) ? "rgba(245,158,11,0.22)" : "rgba(16,185,129,0.22)"}`, borderRadius: "10px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "999px", background: registroFinalizado(checkinEvento) ? "#f59e0b" : "#34d399", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: registroFinalizado(checkinEvento) ? "#fbbf24" : "#34d399" }}>
                {registroFinalizado(checkinEvento)
                  ? `Ventana de registro cerrada (${horasRegistro(checkinEvento)}h desde el inicio) — igual puedes seguir marcando entradas manualmente`
                  : `Ventana de registro abierta — ${horasRegistro(checkinEvento)}h desde el inicio del evento`}
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <motion.button onClick={escaneando ? detenerEscaneo : iniciarEscaneo} whileTap={{ scale: 0.97 }}
                style={{ flex: 1, background: escaneando ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.1)", border: `1.5px solid ${escaneando ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.25)"}`, borderRadius: "10px", color: escaneando ? "#f87171" : "#34d399", padding: "9px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >{escaneando ? "Detener cámara" : "📷 Escanear QR"}</motion.button>
              <motion.button onClick={exportarCSV} whileTap={{ scale: 0.97 }} disabled={exportando}
                style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "rgba(255,255,255,0.7)", padding: "9px 12px", fontSize: "13px", fontWeight: 600, cursor: exportando ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: exportando ? 0.6 : 1 }}
              >{exportando ? "Generando..." : "⬇ Exportar CSV"}</motion.button>
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
              <input value={checkinBusqueda} onChange={e => buscarCheckin(e.target.value)}
                placeholder="Buscar por nombre o código (ej. AB3X7K)"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(16,185,129,0.25)", borderRadius: "12px", padding: "12px 16px", color: "white", fontSize: "14px", fontFamily: "inherit", boxSizing: "border-box" }}
              />
              {checkinBuscando && <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Buscando...</div>}
            </div>

            {checkinResultados.length === 0 && checkinBusqueda.trim().length > 0 && !checkinBuscando && (
              <div style={{ textAlign: "center", padding: "32px", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>No se encontraron boletos con ese nombre o código</div>
            )}
            {checkinResultados.length === 0 && checkinBusqueda.trim().length === 0 && (
              <div style={{ textAlign: "center", padding: "32px", color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>Escribe un nombre o el código de 6 caracteres para buscar</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {checkinResultados.map((grupo, gi) => (
                <div key={gi} style={{ background: "rgba(255,255,255,0.02)", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "15px" }}>{grupo.nombre || "Sin nombre"}</div>
                      {grupo.codigo && <div style={{ fontSize: "12px", color: "#34d399", fontFamily: "monospace", letterSpacing: "2px", marginTop: "2px" }}>{grupo.codigo}</div>}
                    </div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
                      {grupo.boletos.filter(b => b.checkin_en).length}/{grupo.boletos.length} boletos
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {grupo.boletos.map((b, bi) => (
                      <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: b.checkin_en ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${b.checkin_en ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "999px", background: b.checkin_en ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: b.checkin_en ? "#34d399" : "rgba(255,255,255,0.4)" }}>
                            {bi + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: "13px", color: b.checkin_en ? "#34d399" : "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                              {b.checkin_en ? "✓ Check-in hecho" : "Pendiente de entrada"}
                            </div>
                            {b.checkin_en && <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>{new Date(b.checkin_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</div>}
                          </div>
                        </div>
                        {!b.checkin_en && (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => marcarCheckin(b.id)} disabled={checkinMarcando === b.id}
                            style={{ background: "#059669", border: "none", borderRadius: "8px", color: "white", padding: "7px 14px", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: checkinMarcando === b.id ? 0.6 : 1 }}
                          >{checkinMarcando === b.id ? "..." : "Marcar entrada"}</motion.button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px", padding: "12px 14px", background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)", borderRadius: "10px" }}>
              <div style={{ fontSize: "12px", color: "#fbbf24", fontWeight: 600, marginBottom: "3px" }}>💡 Recomendación</div>
              <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                Se recomienda solicitar una identificación oficial que coincida con el nombre del registro, especialmente para eventos de edad restringida.
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: cooperadores de check-in */}
      {cooperadoresEvento && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px", overflowY: "auto" }}
          onClick={() => setCooperadoresEvento(null)}
        >
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            style={{ background: "#0e0e11", border: "1.5px solid rgba(96,165,250,0.2)", borderRadius: "20px", padding: "28px 24px", width: "100%", maxWidth: "560px", marginTop: "60px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "18px" }}>Cooperadores</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{cooperadoresEvento.titulo}</div>
              </div>
              <button onClick={() => setCooperadoresEvento(null)}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "22px", cursor: "pointer", lineHeight: 1, fontFamily: "inherit" }}
              >×</button>
            </div>

            <p style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: "18px" }}>
              Comparte este link con quien quieras que te ayude a hacer check-in en la entrada. No necesita cuenta en VELA — solo escribe su nombre al abrirlo. Puedes quitarlo de la lista en cualquier momento.
            </p>

            {cargandoCooperadores ? (
              <div style={{ textAlign: "center", padding: "24px", color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>Cargando...</div>
            ) : (
              <>
                <div style={{ padding: "14px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.18)", borderRadius: "12px", marginBottom: "20px" }}>
                  {invitacionActiva ? (
                    <>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Link activo</div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <div style={{ flex: 1, fontSize: "12.5px", color: "#60a5fa", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {window.location.origin}/unirse-cooperador/{invitacionActiva.codigo}
                        </div>
                        <motion.button onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/unirse-cooperador/${invitacionActiva.codigo}`)
                            setLinkCopiado(true)
                            setTimeout(() => setLinkCopiado(false), 1500)
                          }}
                          animate={linkCopiado ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 0.3 }}
                          style={{ background: linkCopiado ? "rgba(16,185,129,0.18)" : "rgba(96,165,250,0.15)", border: `1px solid ${linkCopiado ? "rgba(16,185,129,0.4)" : "rgba(96,165,250,0.3)"}`, borderRadius: "7px", color: linkCopiado ? "#34d399" : "#60a5fa", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, transition: "background 0.2s, border-color 0.2s, color 0.2s" }}
                        >{linkCopiado ? "✓ Copiado" : "Copiar"}</motion.button>
                      </div>
                      <button onClick={revocarLink}
                        style={{ marginTop: "10px", background: "none", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "7px", color: "#f87171", padding: "5px 11px", fontSize: "11.5px", cursor: "pointer", fontFamily: "inherit" }}
                      >Revocar link</button>
                    </>
                  ) : (
                    <motion.button onClick={generarLink} whileTap={{ scale: 0.97 }} disabled={generandoLink}
                      style={{ width: "100%", background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: "9px", color: "#60a5fa", padding: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    >{generandoLink ? "Generando..." : "Generar link de invitación"}</motion.button>
                  )}
                </div>

                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginBottom: "10px" }}>
                  {cooperadoresLista.length}/20 cooperadores
                </div>
                {cooperadoresLista.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>Todavía no tienes cooperadores en este evento</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {cooperadoresLista.map(c => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                        <div>
                          <div style={{ fontSize: "13.5px", fontWeight: 500 }}>{c.nombre}</div>
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>desde {new Date(c.created_at).toLocaleDateString("es-MX")}</div>
                        </div>
                        <button onClick={() => quitarCooperador(c.id)}
                          style={{ background: "none", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "7px", color: "#f87171", padding: "5px 11px", fontSize: "11.5px", cursor: "pointer", fontFamily: "inherit" }}
                        >Quitar</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* ZOOM FOTO ASISTENTE */}
      {fotoZoom && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setFotoZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
        >
          <motion.img initial={{ scale: 0.85 }} animate={{ scale: 1 }} src={fotoZoom} alt="foto"
            style={{ maxWidth: "400px", width: "100%", borderRadius: "20px", boxShadow: "0 32px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}
          />
        </motion.div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}