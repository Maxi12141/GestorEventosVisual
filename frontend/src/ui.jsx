import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, AudioLines, Info, Loader2 } from 'lucide-react'
import { Modal as AModal, message } from 'antd'
import { ESTADOS, MAX_PERSONAS, MAX_IMPORTE } from './utils.js'

// ---------- Avisos (antd message) ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [api, holder] = message.useMessage({ maxCount: 3, top: 18 })
  const push = useCallback((texto, tipo = 'ok') => {
    const t = tipo === 'error' ? 'error' : tipo === 'info' ? 'info' : 'success'
    api.open({ type: t, content: texto, duration: t === 'error' ? 6 : 3.2 })
  }, [api])
  return <ToastCtx.Provider value={push}>{holder}{children}</ToastCtx.Provider>
}

// ---------- Botón ----------
export function Btn({ variant = 'primary', size, icon: Icon, loading, children, className = '', ...p }) {
  return (
    <button className={`btn ${variant} ${size || ''} ${className}`} disabled={p.disabled || loading} {...p}>
      {loading ? <Loader2 size={16} className="spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  )
}

// ---------- Campos ----------
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={'field ' + className}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}
// Input numérico que deja escribir libremente (acepta vacío mientras se tipea)
export function NumInput({ value, onChange, min = 0, max, step = 1, prefix, suffix, ...p }) {
  // Tope por defecto con sentido: personas hasta 50.000, importes hasta $500.000.000
  const tope = max ?? (suffix === 'personas' ? MAX_PERSONAS : MAX_IMPORTE)
  const entero = suffix === 'personas' || step === 1
  const [txt, setTxt] = useState(value === '' || value == null ? '' : String(value))
  const [pasado, setPasado] = useState(false)
  useEffect(() => {
    if (Number(txt) !== Number(value) || (value === '' && txt !== '')) setTxt(value === '' || value == null ? '' : String(value))
    // eslint-disable-next-line
  }, [value])
  const cambio = (raw) => {
    if (raw === '') { setTxt(''); setPasado(false); return onChange(0) }
    let v = Number(raw)
    if (!Number.isFinite(v)) return
    if (entero) v = Math.floor(v)
    if (v > tope) { v = tope; setPasado(true) } else setPasado(false)
    if (v < 0) v = 0
    setTxt(String(v)); onChange(v)
  }
  // Al salir del campo recién se aplica el mínimo (si no, no se podría escribir 200 con mínimo 100)
  const alSalir = () => {
    if (txt === '' || Number(txt) >= min) return
    setTxt(String(min)); onChange(min); setPasado(false)
  }
  return (
    <div>
      <div className={'numwrap' + (pasado ? ' bad' : '')}>
        {prefix && <span className="pre">{prefix}</span>}
        <input type="number" inputMode={entero ? 'numeric' : 'decimal'} min={min} max={tope} step={step} value={txt}
          onKeyDown={(e) => (['e', 'E', '+', '-'].includes(e.key) || (entero && ['.', ','].includes(e.key))) && e.preventDefault()}
          onChange={(e) => cambio(e.target.value)} onBlur={alSalir}
          {...p} />
        {suffix && <span className="suf">{suffix}</span>}
      </div>
      {pasado && <span className="field-error">El máximo es {tope.toLocaleString('es-AR')}</span>}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({ titulo, onClose, children, footer, ancho = 560 }) {
  return (
    <AModal open title={titulo} onCancel={onClose} footer={footer || null} width={ancho} centered destroyOnClose maskClosable={false}
      styles={{ body: { maxHeight: '72vh', overflowY: 'auto', paddingTop: 6 } }}>
      {children}
    </AModal>
  )
}

export function Confirmar({ titulo, texto, confirmarLabel = 'Confirmar', peligro, onConfirm, onClose }) {
  const [cargando, setCargando] = useState(false)
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={440}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant={peligro ? 'danger' : 'primary'} loading={cargando}
          onClick={async () => { setCargando(true); try { await onConfirm() } finally { setCargando(false); onClose() } }}>{confirmarLabel}</Btn>
      </>}>
      <p className="muted" style={{ margin: 0 }}>{texto}</p>
    </Modal>
  )
}

// ---------- Varios ----------
export const Badge = ({ color = 'gris', children, icon: Icon }) => (
  <span className={'badge ' + color}>{Icon && <Icon size={12} />}{children}</span>
)
// Etiqueta de estado: <Estado tipo="evento" valor="confirmado" />
export const Estado = ({ tipo, valor }) => {
  const [label, color] = ESTADOS[tipo]?.[valor] || [valor, 'gris']
  return <Badge color={color}>{label}</Badge>
}
export const Spinner = ({ texto, full }) => (
  <div className={'boot' + (full ? ' full' : '')} role="status" aria-live="polite">
    <div className="boot-orb" aria-hidden="true">
      <span className="boot-ring" />
      <span className="boot-ring delay" />
      <span className="boot-core"><AudioLines size={22} /></span>
    </div>
    <div className="boot-copy">
      <strong>{texto || 'Cargando'}</strong>
      <span className="boot-track"><i /></span>
    </div>
  </div>
)
export const Vacio = ({ icon: Icon, titulo, texto, children }) => (
  <div className="vacio">{Icon && <Icon size={34} />}<strong>{titulo}</strong>{texto && <p>{texto}</p>}{children}</div>
)
export const Seg = ({ value, onChange, opciones }) => (
  <div className="seg" role="tablist">
    {opciones.map((o) => (
      <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.icon && <o.icon size={15} />}{o.label}
      </button>
    ))}
  </div>
)
export function Stat({ label, value, sub, tono, icon: Icon }) {
  return (
    <div className={'stat ' + (tono || '')}>
      <div className="stat-top">{Icon && <Icon size={16} />}<span>{label}</span></div>
      <div className="stat-val">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
export function Alertas({ errores = [], avisos = [] }) {
  if (!errores.length && !avisos.length) return null
  return (
    <div className="alertas">
      {errores.map((e, i) => <div key={'e' + i} className="alerta error"><AlertTriangle size={15} />{e}</div>)}
      {avisos.map((e, i) => <div key={'a' + i} className="alerta aviso"><Info size={15} />{e}</div>)}
    </div>
  )
}

// Hook para cargar datos con loading/error
export function useCarga(fn, deps = []) {
  const [estado, setEstado] = useState({ data: null, cargando: true, error: null })
  const [n, setN] = useState(0)
  useEffect(() => {
    let vivo = true
    setEstado((s) => ({ ...s, cargando: true, error: null }))
    Promise.resolve().then(fn).then((data) => vivo && setEstado({ data, cargando: false, error: null }))
      .catch((error) => vivo && setEstado({ data: null, cargando: false, error }))
    return () => { vivo = false }
    // eslint-disable-next-line
  }, [...deps, n])
  return { ...estado, recargar: () => setN((x) => x + 1) }
}
