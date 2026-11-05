import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag, Plus } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Modal, Spinner, Estado, Badge, useCarga } from '../ui.jsx'
import { feriadoDe, sumarDias, diaSemana, hoyAR, mesLabel, fechaLarga, cap1, hora, DIAS_SEMANA } from '../utils.js'

const LUN_PRIMERO = [1, 2, 3, 4, 5, 6, 0]
const mesDe = (iso) => iso.slice(0, 7)
const mover = (ym, n) => { const d = new Date(ym + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7) }

export default function Calendario() {
  const { puedeEditar } = useAuth()
  const [mes, setMes] = useState(mesDe(hoyAR()))
  const [dia, setDia] = useState(null)
  const [verTareas, setVerTareas] = useState(false)
  const hoy = hoyAR()
  const primero = mes + '-01'
  const inicio = sumarDias(primero, -((diaSemana(primero) + 6) % 7))
  const celdas = useMemo(() => Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i)), [inicio])
  const { data, cargando } = useCarga(() => api('/calendario', { params: { desde: celdas[0], hasta: celdas[41] } }), [celdas[0]])

  const delDia = (f) => ({
    eventos: (data?.eventos || []).filter((e) => e.fecha === f && e.estado !== 'cancelado'),
    solicitudes: (data?.solicitudes || []).filter((s) => s.fecha_prevista === f),
    tareas: (data?.tareas || []).filter((t) => t.fecha_prevista === f),
  })

  return (
    <div>
      <div className="page-head"><div><h1>Calendario</h1><p>Eventos confirmados, solicitudes con fecha prevista y feriados nacionales.</p></div></div>
      <div className="filters">
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn" onClick={() => setMes(mover(mes, -1))} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
          <h2 style={{ minWidth: 190, textAlign: 'center' }}>{mesLabel(mes)}</h2>
          <button className="icon-btn" onClick={() => setMes(mover(mes, 1))} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
          <Btn variant="ghost" size="sm" onClick={() => setMes(mesDe(hoy))}>Hoy</Btn>
        </div>
        <div className="spacer" />
        <label className="row small muted" style={{ gap: 6 }}><input type="checkbox" checked={verTareas} onChange={(e) => setVerTareas(e.target.checked)} />Mostrar fechas de tareas</label>
      </div>
      <div className="cal-legend" style={{ marginBottom: 12 }}>
        <span><Flag size={13} color="var(--celeste)" />Feriado</span>
        <span><i className="cal-ev" style={{ padding: '2px 8px' }}>Evento</i></span>
        <span><i className="cal-ev borrador" style={{ padding: '2px 8px' }}>Solicitud (fecha prevista)</i></span>
        <span><i className="cal-ev festival" style={{ padding: '2px 8px' }}>Realizado</i></span>
      </div>
      {cargando && !data ? <Spinner /> : (
        <div className="cal">
          {LUN_PRIMERO.map((d) => <div key={d} className="cal-dow">{DIAS_SEMANA[d]}</div>)}
          {celdas.map((f) => {
            const fe = feriadoDe(f), it = delDia(f)
            const total = it.eventos.length + it.solicitudes.length + (verTareas ? it.tareas.length : 0)
            return (
              <div key={f} className={'cal-day clic' + (mesDe(f) !== mes ? ' out' : '') + (f === hoy ? ' hoy' : '') + (fe ? ' feriado' : '')} onClick={() => setDia(f)}>
                <div className="dn"><span>{Number(f.slice(8))}</span></div>
                {fe && <div className="fer">{fe.nombre}</div>}
                {it.eventos.slice(0, 3).map((e) => <button key={'e' + e.id} className={'cal-ev' + (e.estado === 'realizado' ? ' festival' : '')} title={`${e.nombre} · ${e.sede}`} onClick={(ev) => { ev.stopPropagation(); ir('eventos/' + e.id) }}>{e.nombre}</button>)}
                {it.solicitudes.slice(0, 2).map((s) => <button key={'s' + s.id} className="cal-ev borrador" title={`Solicitud: ${s.titulo}`} onClick={(ev) => { ev.stopPropagation(); ir('solicitudes/' + s.id) }}>{s.titulo}</button>)}
                {verTareas && it.tareas.slice(0, 2).map((t) => <button key={'t' + t.id} className="cal-ev tarea" title={t.evento} onClick={(ev) => { ev.stopPropagation(); ir(`eventos/${t.encargo_id}?tab=tareas`) }}>✓ {t.titulo}</button>)}
                {total > 3 && <span className="muted small">+{total - 3} más</span>}
              </div>
            )
          })}
        </div>
      )}
      {dia && (() => {
        const it = delDia(dia), fe = feriadoDe(dia), vacio = !it.eventos.length && !it.solicitudes.length && !it.tareas.length
        return (
          <Modal titulo={cap1(fechaLarga(dia))} onClose={() => setDia(null)} ancho={480}>
            <div className="stack">
              {fe && <div><Badge color="celeste" icon={Flag}>{fe.nombre}</Badge></div>}
              {vacio && <div className="muted">No hay nada registrado para este día.</div>}
              {it.eventos.map((e) => <div key={e.id} className="prox compacta" onClick={() => ir('eventos/' + e.id)}><div className="grow"><b>{e.nombre}</b> <Estado tipo="evento" valor={e.estado} /><div className="muted small">{e.cliente} · {e.sede}{e.hora_inicio ? ` · ${hora(e.hora_inicio)} hs` : ''}</div></div></div>)}
              {it.solicitudes.map((s) => <div key={s.id} className="prox compacta" onClick={() => ir('solicitudes/' + s.id)}><div className="grow"><b>{s.titulo}</b> <Estado tipo="solicitud" valor={s.estado} /><div className="muted small">Fecha prevista · {s.cliente}</div></div></div>)}
              {it.tareas.map((t) => <div key={t.id} className="prox compacta" onClick={() => ir(`eventos/${t.encargo_id}?tab=tareas`)}><div className="grow"><b>✓ {t.titulo}</b><div className="muted small">{t.evento}</div></div></div>)}
              {puedeEditar && dia >= hoy && <Btn icon={Plus} onClick={() => ir('solicitudes?nueva=1&fecha=' + dia)}>Nueva solicitud para este día</Btn>}
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
