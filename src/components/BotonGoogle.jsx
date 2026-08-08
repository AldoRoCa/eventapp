import { useState } from "react"
import { supabase } from "../supabase"

/**
 * Botón "Continuar con Google" compartido entre Login y Registro.
 *
 * signInWithOAuth NO abre una ventana emergente: manda al navegador a Google
 * y de ahí a Supabase, que regresa a `redirectTo` con la sesión en la URL. El
 * cliente de supabase-js la detecta solo al cargar la página, y el
 * onAuthStateChange de App.jsx la recoge — por eso aquí no hay que hacer nada
 * después del clic.
 *
 * `prompt: "select_account"` fuerza a Google a preguntar CON CUÁL cuenta
 * entrar en vez de usar la última usada en silencio. Importante para el
 * público universitario: mucha gente trae la sesión de su cuenta personal
 * abierta y queremos que pueda elegir la escolar.
 */
export default function BotonGoogle({ texto = "Continuar con Google", onError }) {
  const [cargando, setCargando] = useState(false)
  const [hover, setHover] = useState(false)

  const entrarConGoogle = async () => {
    setCargando(true)
    onError?.("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: "select_account" },
      },
    })
    // Si no hubo error, el navegador ya se está yendo a Google: dejamos el
    // botón en "cargando" a propósito para que no parpadee de vuelta a su
    // estado normal durante el instante previo a la redirección.
    if (error) {
      onError?.("No se pudo conectar con Google. Intenta de nuevo.")
      setCargando(false)
    }
  }

  return (
    <button
      onClick={entrarConGoogle}
      disabled={cargando}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        background: hover && !cargando ? "#f2f2f2" : "white",
        border: "none",
        borderRadius: "12px",
        padding: "13px",
        color: "#1f1f1f",
        fontWeight: 600,
        fontSize: "14.5px",
        fontFamily: "inherit",
        cursor: cargando ? "not-allowed" : "pointer",
        opacity: cargando ? 0.7 : 1,
        boxSizing: "border-box",
        transition: "background 0.15s",
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {cargando ? "Conectando..." : texto}
    </button>
  )
}

/**
 * Separador "o" entre el botón de Google y el formulario de correo.
 * Vive aquí para que Login y Registro no lo dupliquen.
 */
export function SeparadorO({ texto = "o" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12.5px", fontWeight: 500 }}>{texto}</span>
      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
    </div>
  )
}
