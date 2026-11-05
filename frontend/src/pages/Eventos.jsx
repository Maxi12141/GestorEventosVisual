import { useState } from 'react'
import { Search, PartyPopper, Download, SlidersHorizontal } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Btn, Spinner, Vacio, useCarga } from '../ui.jsx'
import { Chips, EventoFila, SelectCatalogo } from '../components.jsx'
import { ESTADOS, hoyAR, hora } from '../utils.js'

const FILTROS = [['abiertos', 'Abiertos'], ['confirmado', 'Confirmados'], ['en_preparacion', 'En preparación'], ['realizado', 'Realizados'], ['cancelado', 'Cancelados'], ['todos', 'Todos']]

export default function Eventos({ query }) {
  const { usuario } = useAuth()
  const hoy = hoyAR()
  const [estado, setEstado] = useState(query.por_cerrar || query.sin_confirmar ? 'abiertos' : query.estado || 'abiertos')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ cliente_id: query.cliente_id ? Number(query.cliente_id) : null, sede_id: query.sede_id ? Number(query.sede_id) : null, proveedor_id: query.proveedor_id ? Number(query.proveedor_id) : null, desde: '', hasta: '', yo: false, sin_confirmar: !!query.sin_confirmar, por_cerrar: !!query.por_cerrar })
  const [mas, setMas] = useState(!!(query.cliente_id || query.sede_id || query.proveedor_id))
  const params = { q, estado: estado === 'todos' ? '' : estado, cliente_id: f.cliente_id, sede_id: f.sede_id, proveedor_id: f.proveedor_id, desde: f.desde, hasta: f.hasta, responsable_id: f.yo ? 'yo' : '', sin_confirmar: f.sin_confirmar ? 1 : '', por_cerrar: f.por_cerrar ? 1 : '', orden: ['realizado', 'cancelado', 'todos'].includes(estado) ? 'desc' : '' }
  const { data, cargando, error } = useCarga(() => api('/encargos', { params }), [JSON.stringify(params)])
  const set = (patch) => setF({ ...f, ...patch })

  const csv = () => {
    const filas = [['Evento', 'Cliente', 'Boliche', 'Sede', 'Fecha', 'Hora', 'Estado', 'Responsable', 'Servicios confirmados', 'Servicios total', 'Tareas abiertas']].concat(
      data.map((e) => [e.nombre, e.cliente?.nombre, e.cliente?.boliche, e.sede?.nombre, e.fecha, hora(e.hora_inicio), ESTADOS.evento[e.estado][0], e.responsable, e.resumen.servicios_confirmados, e.resumen.servicios_total, e.resumen.tareas_abiertas]))
    const txt = '\ufeff' + filas.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); a.download = `eventos-${hoy}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }
  const hayFiltros = f.cliente_id || f.sede_id || f.proveedor_id || f.desde || f.hasta || f.yo || f.sin_confirmar || f.por_cerrar

  return (
    <div>
      <div className="page-head">
        <div><h1>Eventos</h1><p>Los eventos que el cliente ya aceptó, con su preparación y su cierre.</p></div><div className="spacer" />
        <Btn variant="ghost" icon={Download} onClick={csv} disabled={!data?.length}>Exportar a Excel</Btn>
      </div>
      <div className="filters">
        <div className="search"><Search size={16} /><input placeholder="Buscar por nombre del evento…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Btn variant="ghost" icon={SlidersHorizontal} onClick={() => setMas(!mas)}>Más filtros{hayFiltros ? ' •' : ''}</Btn>
      </div>
      <div style={{ marginBottom: 14, overflowX: 'auto' }}><Chips value={estado} onChange={setEstado} opciones={FILTROS} /></div>
      {mas && (
        <div className="card flat" style={{ marginBottom: 16 }}>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
            <label className="field"><span className="field-label">Cliente</span><SelectCatalogo catalogo="clientes" value={f.cliente_id} onChange={(v) => set({ cliente_id: v })} vacio="Todos" puedeCrear={false} /></label>
            <label className="field"><span className="field-label">Sede</span><SelectCatalogo catalogo="sedes" value={f.sede_id} onChange={(v) => set({ sede_id: v })} vacio="Todas" puedeCrear={false} /></label>
            <label className="field"><span className="field-label">Proveedor</span><SelectCatalogo catalogo="proveedores" value={f.proveedor_id} onChange={(v) => set({ proveedor_id: v })} vacio="Todos" puedeCrear={false} /></label>
            <label className="field"><span className="field-label">Desde</span><input type="date" value={f.desde} onChange={(e) => set({ desde: e.target.value })} /></label>
            <label className="field"><span className="field-label">Hasta</span><input type="date" value={f.hasta} onChange={(e) => set({ hasta: e.target.value })} /></label>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 18 }}>
            <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={f.yo} onChange={(e) => set({ yo: e.target.checked })} />Solo los que coordino yo</label>
            <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={f.sin_confirmar} onChange={(e) => set({ sin_confirmar: e.target.checked })} />Con servicios sin confirmar</label>
            <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={f.por_cerrar} onChange={(e) => set({ por_cerrar: e.target.checked })} />Ya pasaron y no se cerraron</label>
            <div className="spacer" />{hayFiltros && <button className="link" onClick={() => setF({ cliente_id: null, sede_id: null, proveedor_id: null, desde: '', hasta: '', yo: false, sin_confirmar: false, por_cerrar: false })}>Limpiar filtros</button>}
          </div>
        </div>
      )}
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : data.length === 0 ? (
        <Vacio icon={PartyPopper} titulo="No hay eventos con este filtro" texto="Un evento se crea cuando el cliente acepta una propuesta (desde Solicitudes)."><a className="btn ghost" href="#/solicitudes">Ir a Solicitudes</a></Vacio>
      ) : (
        <>
          <div className="muted small" style={{ marginBottom: 10 }}>{data.length} evento(s)</div>
          <div className="lista-prox">{data.map((e) => <EventoFila key={e.id} e={e} hoy={hoy} />)}</div>
        </>
      )}
    </div>
  )
}
