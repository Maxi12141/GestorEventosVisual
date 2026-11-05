import { useState } from 'react'
import { MessageCircle, Info, AlertTriangle, CheckCircle2, ChevronRight, Flag } from 'lucide-react'
import { Badge } from './ui.jsx'
import { useCatalogo, invalidar } from './catalogos.js'
import { useAuth } from './auth.jsx'
import { ModalCliente, ModalSede, ModalProveedor } from './formularios.jsx'
import { whatsapp, ACCION_LABEL, ESTADOS, $, fechaHora, hace, fechaCorta, feriadoDe, esFindeLargo, sumarDias, diasEntre } from './utils.js'

// Teléfono con link para llamar y botón de WhatsApp
export function Telefono({ tel }) {
  if (!tel) return <span className="muted small">Sin teléfono</span>
  return (
    <span className="tel">
      <a href={`tel:${tel}`}>{tel}</a>
      <a className="wa" href={whatsapp(tel)} target="_blank" rel="noreferrer" title="Abrir WhatsApp" aria-label="Abrir WhatsApp"><MessageCircle size={13} />WhatsApp</a>
    </span>
  )
}

// Grupo de filtros tipo "chips"
export const Chips = ({ value, onChange, opciones }) => (
  <div className="row" style={{ gap: 6 }}>
    {opciones.map(([v, l, n]) => (
      <button key={v} className={'chip sm' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>{l}{n != null ? <b style={{ marginLeft: 4, opacity: .7 }}>{n}</b> : null}</button>
    ))}
  </div>
)

// Cartel "¿qué sigue?": guía al usuario sobre el próximo paso
export function ProximoPaso({ tono = 'info', children, acciones }) {
  const Icon = tono === 'ok' ? CheckCircle2 : tono === 'alerta' ? AlertTriangle : Info
  return (
    <div className={'paso ' + tono}>
      <Icon size={20} />
      <div className="grow"><span className="paso-t">Qué sigue</span><div>{children}</div></div>
      {acciones && <div className="row no-print" style={{ gap: 8 }}>{acciones}</div>}
    </div>
  )
}

// Convierte valores técnicos del historial en algo legible (estados, importes, fechas)
function valorLegible(h, v) {
  if (v == null || v === '') return null
  const grupo = h.accion.includes('participacion') ? 'participacion' : h.accion.includes('tarea') ? 'tarea' : h.accion.includes('solicitud') ? 'solicitud' : h.accion.startsWith('evento') || h.accion.startsWith('preparacion') ? 'evento' : null
  if (grupo && ESTADOS[grupo][v]) return ESTADOS[grupo][v][0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fechaCorta(v)
  if ((h.accion.startsWith('propuesta_') || h.accion.includes('importe')) && /^-?\d+(\.\d+)?$/.test(v)) return $(Number(v))
  if (/^-?\d+(\.\d+)?$/.test(v) && h.accion.includes('cambio_importe')) return $(Number(v))
  return v
}

// Línea de tiempo del historial
export function Timeline({ items, vacio = 'Todavía no hay movimientos' }) {
  if (!items?.length) return <div className="muted small">{vacio}</div>
  return (
    <ol className="timeline">
      {items.map((h) => (
        <li key={h.id}>
          <i className={'tl-dot ' + (h.accion.includes('cancel') || h.accion.includes('rechaz') ? 'rojo' : h.accion.includes('acept') || h.accion.includes('confirm') || h.accion.includes('realizado') || h.accion.includes('complet') ? 'verde' : '')} />
          <div>
            <b>{ACCION_LABEL[h.accion] || h.accion.replaceAll('_', ' ')}</b>
            {h.detalle && <div className="small">{h.detalle}</div>}
            {(h.valor_anterior || h.valor_nuevo) && (
              <div className="small muted">{h.valor_anterior ? <s>{valorLegible(h, h.valor_anterior)}</s> : null}{h.valor_anterior && h.valor_nuevo ? ' → ' : ''}{h.valor_nuevo ? <b style={{ color: 'var(--text)' }}>{valorLegible(h, h.valor_nuevo)}</b> : null}</div>
            )}
            <div className="muted small">{h.usuario_nombre || 'Sistema'} · {fechaHora(h.created_at)} ({hace(h.created_at)})</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

// Feriados / finde largo que toca una fecha
export function FeriadoChips({ fecha }) {
  if (!fecha) return null
  const fe = feriadoDe(fecha)
  if (fe) return <Badge color="celeste" icon={Flag}>{fe.nombre}</Badge>
  if (esFindeLargo(fecha)) return <Badge color="sol" icon={Flag}>Fin de semana largo</Badge>
  return null
}

// "En 5 días" / "Hace 2 días" / "Hoy"
export function Cuando({ fecha, hoy }) {
  const d = diasEntre(hoy, fecha)
  const t = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d > 1 ? `En ${d} días` : d === -1 ? 'Ayer' : `Hace ${-d} días`
  return <span className={d < 0 ? 'neg' : d <= 3 ? 'sol' : 'muted'}>{t}</span>
}
export { sumarDias }

// Selector de catálogo con "＋ Agregar nuevo…" (crea sin salir de la pantalla)
const ETQ = {
  clientes: (x) => `${x.boliche ? x.boliche + ' — ' : ''}${x.nombre}`,
  sedes: (x) => `${x.nombre}${x.ciudad ? ' · ' + x.ciudad : ''}`,
  proveedores: (x) => `${x.nombre} (${x.servicio})`,
  equipo: (x) => x.nombre,
}
const FORM = { clientes: ModalCliente, sedes: ModalSede, proveedores: ModalProveedor }
export function SelectCatalogo({ catalogo, value, onChange, vacio = 'Elegir…', puedeCrear = true, disabled }) {
  const lista = useCatalogo(catalogo)
  const { puedeEditar } = useAuth()
  const [nuevo, setNuevo] = useState(false)
  const Form = FORM[catalogo]
  const crear = puedeCrear && Form && (catalogo === 'proveedores' || puedeEditar)
  return (
    <>
      <select value={value ?? ''} disabled={disabled} onChange={(e) => (e.target.value === '__nuevo__' ? setNuevo(true) : onChange(e.target.value ? (catalogo === 'equipo' ? e.target.value : Number(e.target.value)) : null))}>
        <option value="">{vacio}</option>
        {lista.filter((x) => x.activo !== false || x.id === value).map((x) => <option key={x.id} value={x.id}>{ETQ[catalogo](x)}</option>)}
        {crear && <option value="__nuevo__">＋ Agregar nuevo…</option>}
      </select>
      {nuevo && <Form inicial={{}} onClose={() => setNuevo(false)} onGuardado={(x) => { invalidar(catalogo); onChange(x.id); setNuevo(false) }} />}
    </>
  )
}

// Cajita de "Pendientes" con ícono
export const Pendiente = ({ n, texto, tono = 'warn', onClick }) =>
  n > 0 ? <button className={'pend ' + tono} onClick={onClick}><b>{n}</b> {texto}<ChevronRight size={14} /></button> : null

// ---------- Fila de evento (lista y panel) ----------
import { ir } from './router.js'
import { Estado } from './ui.jsx'
import { diaSemana, fechaMini, DIAS_SEMANA, hora } from './utils.js'

export function BadgesPendientes({ e }) {
  const r = e.resumen
  const abierto = e.estado === 'confirmado' || e.estado === 'en_preparacion'
  return (
    <>
      {r.por_cerrar && <Badge color="rojo">Ya pasó: hay que cerrarlo</Badge>}
      {abierto && r.servicios_sin_confirmar > 0 && <Badge color="warn">{r.servicios_sin_confirmar} servicio(s) sin confirmar</Badge>}
      {abierto && r.tareas_vencidas > 0 && <Badge color="rojo">{r.tareas_vencidas} tarea(s) vencida(s)</Badge>}
      {abierto && r.cambios_pendientes > 0 && <Badge color="warn">Cambio esperando al cliente</Badge>}
      {abierto && r.para_revisar > 0 && <Badge color="violeta">{r.para_revisar} para revisar</Badge>}
      {r.incidentes_pendientes > 0 && e.estado !== 'cancelado' && <Badge color="warn">Incidente pendiente</Badge>}
      {e.estado === 'cancelado' && r.avisos_pendientes > 0 && <Badge color="rojo">Avisar a {r.avisos_pendientes} proveedor(es)</Badge>}
    </>
  )
}

export function EventoFila({ e, hoy }) {
  return (
    <div className="prox" role="button" tabIndex={0} onClick={() => ir('eventos/' + e.id)} onKeyDown={(k) => k.key === 'Enter' && ir('eventos/' + e.id)}>
      <div className="fecha-box"><small>{DIAS_SEMANA[diaSemana(e.fecha)]}</small><b>{Number(e.fecha.slice(8))}</b><small>{fechaMini(e.fecha).split(' ')[1]}</small></div>
      <div className="grow">
        <div className="row" style={{ gap: 8 }}><b>{e.nombre}</b><Estado tipo="evento" valor={e.estado} /></div>
        <div className="muted small">{e.cliente?.boliche || e.cliente?.nombre} · {e.sede?.nombre}{e.hora_inicio ? ` · ${hora(e.hora_inicio)} hs` : ''}</div>
        <div className="row" style={{ gap: 6, marginTop: 5 }}><BadgesPendientes e={e} /></div>
      </div>
      <div className="right small nowrap"><Cuando fecha={e.fecha} hoy={hoy} /></div>
    </div>
  )
}
