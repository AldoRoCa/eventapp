import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { precioConComision, comisionVela, cargoMercadoPago, gananciaNetaBoleto } from "../comisionUtils"

const fmt = n => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtEntero = n => "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 0 })

function Fila({ etiqueta, valor, color, destacada, isMobile }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", padding: destacada ? "9px 0 2px" : "5px 0" }}>
      <span style={{ fontSize: destacada ? (isMobile ? "13px" : "13.5px") : (isMobile ? "12.5px" : "13px"), color: destacada ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)", fontWeight: destacada ? 600 : 400, lineHeight: 1.4 }}>{etiqueta}</span>
      <span style={{ fontSize: destacada ? (isMobile ? "15px" : "16px") : (isMobile ? "12.5px" : "13px"), fontWeight: destacada ? 700 : 600, color: color || "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>{valor}</span>
    </div>
  )
}

// Desglose de ganancias del anfitrión: cuánto le queda de cada boleto después
// de la comisión de VELA (la paga el asistente, no él) y de la tarifa propia
// de Mercado Pago (esa sí sale de su lado), más una proyección interactiva
// según cuántos boletos venda. Se muestra junto al campo de precio en
// CrearEvento y en el modal de edición de PanelAnfitrion.
export default function DesgloseGanancias({ precio, capacidad, isMobile, style }) {
  const [abierto, setAbierto] = useState(false)
  const [vendidos, setVendidos] = useState(null) // null = todos los boletos (capacidad completa)

  const p = parseInt(precio)
  if (isNaN(p) || p < 5) return null

  const precioAsistente = precioConComision(p)
  const comision = comisionVela(p)
  const cargoMP = cargoMercadoPago(p)
  const netaBoleto = gananciaNetaBoleto(p)

  const cap = parseInt(capacidad)
  const hayCapacidad = !isNaN(cap) && cap > 0
  const nVendidos = hayCapacidad ? (vendidos === null ? cap : Math.max(1, Math.min(vendidos, cap))) : 0

  const divisoria = { borderTop: "1px solid rgba(255,255,255,0.09)", margin: "6px 0 2px" }

  return (
    <div style={{ background: "rgba(124,58,237,0.07)", border: "1.5px solid rgba(124,58,237,0.22)", borderRadius: "14px", overflow: "hidden", ...style }}>

      {/* Encabezado siempre visible: la ganancia neta por boleto + botón para desplegar */}
      <div onClick={() => setAbierto(a => !a)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: isMobile ? "12px 14px" : "12px 16px", cursor: "pointer", userSelect: "none" }}
      >
        <div>
          <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", marginBottom: "3px" }}>💰 Ganancia neta aprox. por boleto</div>
          <div style={{ fontSize: isMobile ? "15px" : "16px", fontWeight: 700, color: "#34d399" }}>
            ≈ {fmt(netaBoleto)} <span style={{ fontSize: "11.5px", fontWeight: 400, color: "rgba(255,255,255,0.35)" }}>MXN, ya con comisiones</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#a78bfa", whiteSpace: "nowrap", flexShrink: 0 }}>
          {abierto ? "Ocultar" : "Ver desglose"}
          <motion.span animate={{ rotate: abierto ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: "inline-block", fontSize: "10px" }}>▼</motion.span>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div key="desglose" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: isMobile ? "0 14px 14px" : "0 16px 16px" }}>

              {/* Desglose por boleto */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.09)", paddingTop: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "4px" }}>Por cada boleto</div>
                <Fila etiqueta="El asistente paga" valor={fmtEntero(precioAsistente) + " MXN"} color="rgba(255,255,255,0.9)" isMobile={isMobile} />
                <Fila etiqueta="Comisión VELA (la paga el asistente)" valor={"− " + fmtEntero(comision)} color="#a78bfa" isMobile={isMobile} />
                <Fila etiqueta="Recibes en Mercado Pago (tu precio)" valor={fmtEntero(p)} isMobile={isMobile} />
                <Fila etiqueta="Tarifa de Mercado Pago*" valor={"− " + fmt(cargoMP)} color="#fbbf24" isMobile={isMobile} />
                <div style={divisoria} />
                <Fila etiqueta="Tu ganancia neta" valor={"≈ " + fmt(netaBoleto)} color="#34d399" destacada isMobile={isMobile} />
              </div>

              {/* Proyección con la capacidad del evento */}
              {hayCapacidad && (
                <div style={{ marginTop: "14px", padding: isMobile ? "12px" : "12px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)", borderRadius: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(52,211,153,0.75)", marginBottom: "6px" }}>
                    🎟 Proyección: {nVendidos.toLocaleString("es-MX")} de {cap.toLocaleString("es-MX")} {cap === 1 ? "boleto vendido" : "boletos vendidos"}
                  </div>
                  {cap > 1 && (
                    <input type="range" min="1" max={cap} value={nVendidos} onChange={e => setVendidos(parseInt(e.target.value))}
                      style={{ width: "100%", accentColor: "#34d399", cursor: "pointer", margin: "2px 0 8px" }}
                    />
                  )}
                  <Fila etiqueta="Los asistentes pagan en total" valor={fmtEntero(nVendidos * precioAsistente)} color="rgba(255,255,255,0.9)" isMobile={isMobile} />
                  <Fila etiqueta="Comisión VELA total" valor={"− " + fmtEntero(nVendidos * comision)} color="#a78bfa" isMobile={isMobile} />
                  <Fila etiqueta="Tarifa Mercado Pago total*" valor={"− " + fmt(nVendidos * cargoMP)} color="#fbbf24" isMobile={isMobile} />
                  <div style={divisoria} />
                  <Fila etiqueta="Tu ganancia neta total" valor={"≈ " + fmt(nVendidos * netaBoleto)} color="#34d399" destacada isMobile={isMobile} />
                </div>
              )}

              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5, margin: "12px 0 0" }}>
                *Estimación con la tarifa estándar de Mercado Pago México (3.49% + $4.00 fijos por compra + IVA), calculada como si cada boleto se comprara por separado. Si un asistente compra varios boletos en un solo pago, el cargo fijo de $4 se cobra una sola vez y tu ganancia real mejora. El porcentaje puede variar según tu configuración de costos en Mercado Pago.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
