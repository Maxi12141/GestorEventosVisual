import { useState } from 'react'
import { Search, ListChecks } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Spinner, Vacio, Estado, Badge, useCarga, useToast } from '../ui.jsx'
import { Chips } from '../components.jsx'
import { fechaCorta } from '../utils.js'

export default function Tareas({ query }) {
  const { usuario, puedeEditar } = useAuth()
  const toast = useToast()
  const [quien, setQuien] = useState(query.responsable_id === 'yo' ? 'yo' : 'todas')
  const [est, setEst] = useState(query.vencidas ? 'vencidas' : query.estado || 'abiertas')
  const [q, setQ] = useState('')
  const params = { responsable_id: quien === 'yo' ? 'yo' : '', q, ...(est === 'vencidas' ? { estado: 'abiertas', vencidas: 1 } : est === 'todas' ? {} : { estado: est }) }
  const { data, cargando, error, recargar } = useCarga(() => api('/tareas', { params }), [JSON.stringify(params)])
  const completar = async (t, valor) => { try { await api('/tareas/' + t.id, { method: 'PATCH', body: { estado: valor ? 'completada' : 'pendiente' } }); recargar() } catch (e) { toast(e.message, 'error') } }
  const puede = (t) => puedeEditar || t.responsable_id === usuario.id || t.created_by === usuario.id

  return (
    <div>
      <div className="page-head"><div><h1>Tareas</h1><p>Todo lo que hay que hacer para preparar los eventos, con su responsable y fecha.</p></div></div>
      <div className="filters">
        <div className="search"><Search size={16} /><input placeholder="Buscar tarea…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Chips value={quien} onChange={setQuien} opciones={[['todas', 'De todo el equipo'], ['yo', 'Solo las mías']]} />
      </div>
      <div style={{ marginBottom: 16, overflowX: 'auto' }}><Chips value={est} onChange={setEst} opciones={[['abiertas', 'Abiertas'], ['vencidas', 'Vencidas'], ['completada', 'Completadas'], ['cancelada', 'Canceladas'], ['todas', 'Todas']]} /></div>
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : data.length === 0 ? (
        <Vacio icon={ListChecks} titulo="No hay tareas con este filtro" texto="Las tareas se crean dentro de cada evento, en la pestaña “Tareas”." />
      ) : (
        <div className="lista-prox">{data.map((t) => (
          <div key={t.id} className={'prox compacta' + (['completada', 'cancelada'].includes(t.estado) ? ' hecha' : '')}>
            <input type="checkbox" checked={t.estado === 'completada'} disabled={!puede(t) || t.estado === 'cancelada' || ['realizado', 'cancelado'].includes(t.evento?.estado)} aria-label="Completada" onChange={(e) => completar(t, e.target.checked)} />
            <div className="grow" role="button" tabIndex={0} onClick={() => ir(`eventos/${t.encargo_id}?tab=tareas`)} style={{ cursor: 'pointer' }}>
              <div className="row" style={{ gap: 8 }}><b>{t.titulo}</b><Estado tipo="tarea" valor={t.estado} />{t.vencida && <Badge color="rojo">Vencida</Badge>}{t.revisar && <Badge color="violeta">Revisar</Badge>}</div>
              <div className="muted small">{t.evento?.nombre}{t.evento?.sede ? ` · ${t.evento.sede}` : ''} · {t.responsable ? `👤 ${t.responsable}` : 'sin responsable'}{t.fecha_prevista ? ` · para el ${fechaCorta(t.fecha_prevista)}` : ''}</div>
            </div>
          </div>))}</div>
      )}
    </div>
  )
}
