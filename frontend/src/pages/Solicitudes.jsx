import { useState } from 'react'
import { Plus, Search, ClipboardList, AlertTriangle } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Field, NumInput, Modal, Spinner, Vacio, Estado, Badge, useCarga, useToast } from '../ui.jsx'
import { Chips, SelectCatalogo, FeriadoChips } from '../components.jsx'
import { TIPOS_EVENTO, MEDIOS, $, fechaCorta, hoyAR } from '../utils.js'

export const pasoSolicitud = (s) => {
  const p = s.propuesta
  if (s.estado === 'descartada') return 'Descartada: ya no avanza'
  if (s.estado === 'convertida') return 'Evento confirmado'
  if (p?.estado === 'pendiente_respuesta') return `Esperando respuesta del cliente${p.dias_esperando ? ` (hace ${p.dias_esperando} días)` : ''}`
  if (p?.estado === 'rechazada') return 'Propuesta rechazada: podés presentar otra'
  if (s.estado === 'pendiente_informacion') return 'Esperando información del cliente'
  if (s.estado === 'lista_para_propuesta') return 'Armar la propuesta'
  return 'Evaluar el pedido y pedir lo que falte'
}

// Alta / edición de una solicitud (el control de duplicados viene del servidor)
export function FormSolicitud({ inicial = {}, onClose, onGuardado }) {
  const toast = useToast()
  const editar = !!inicial.id
  const [f, setF] = useState({ tipo_evento: 'Fiesta temática', medio_contacto: 'WhatsApp', estado: 'en_evaluacion', ...inicial })
  const [error, setError] = useState('')
  const [dup, setDup] = useState(null)
  const [cargando, setCargando] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const guardar = async (forzar = false) => {
    setCargando(true); setError('')
    try {
      const body = { ...f, forzar }
      const r = editar ? await api('/solicitudes/' + f.id, { method: 'PUT', body }) : await api('/solicitudes', { method: 'POST', body })
      toast(editar ? 'Solicitud actualizada' : 'Solicitud registrada'); onGuardado(r)
    } catch (e) {
      if (e.datos?.codigo === 'DUPLICADO') setDup(e.datos.duplicados)
      else setError(e.message)
    } finally { setCargando(false) }
  }

  return (
    <Modal titulo={editar ? 'Editar solicitud' : 'Nueva solicitud'} onClose={onClose} ancho={680}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn loading={cargando} onClick={() => guardar(false)}>{editar ? 'Guardar cambios' : 'Registrar solicitud'}</Btn></>}>
      <div className="helper" style={{ marginBottom: 14 }}><span>Alcanza con saber <b>quién la pide</b> y <b>qué tipo de evento</b> es. El resto lo podés completar después.</span></div>
      <div className="form-grid">
        <Field label="Cliente *" className="full"><SelectCatalogo catalogo="clientes" value={f.cliente_id} onChange={(v) => setF({ ...f, cliente_id: v })} vacio="Elegir cliente…" disabled={editar} /></Field>
        <Field label="¿Cómo se llama el evento? *" className="full"><input value={f.titulo ?? ''} onChange={set('titulo')} placeholder="Ej: Fiesta de Halloween" /></Field>
        <Field label="Tipo de evento"><select value={f.tipo_evento} onChange={set('tipo_evento')}>{TIPOS_EVENTO.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Fecha prevista" hint="Si todavía no la saben, dejala vacía"><input type="date" min={hoyAR()} value={f.fecha_prevista ?? ''} onChange={set('fecha_prevista')} /></Field>
        <Field label="Sede prevista"><SelectCatalogo catalogo="sedes" value={f.sede_id} onChange={(v) => setF({ ...f, sede_id: v })} vacio="Sin definir" /></Field>
        <Field label="Asistentes estimados"><NumInput value={f.asistentes_estimados ?? 0} onChange={(v) => setF({ ...f, asistentes_estimados: v || null })} /></Field>
        <Field label="¿Cómo llegó el pedido?" className="full"><Chips value={f.medio_contacto} onChange={(v) => setF({ ...f, medio_contacto: v })} opciones={MEDIOS.map((m) => [m, m])} /></Field>
        <Field label="¿Qué necesita?" className="full"><textarea value={f.necesidades ?? ''} onChange={set('necesidades')} placeholder="DJ, sonido, iluminación, barra, temática…" /></Field>
        {!editar && <Field label="Estado inicial" className="full"><Chips value={f.estado} onChange={(v) => setF({ ...f, estado: v })} opciones={[['en_evaluacion', 'En evaluación'], ['pendiente_informacion', 'Falta información'], ['lista_para_propuesta', 'Lista para propuesta']]} /></Field>}
      </div>
      {error && <div className="alerta error" style={{ marginTop: 14 }}>{error}</div>}
      {dup && (
        <div className="alerta aviso" style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}><AlertTriangle size={16} /><b>Este cliente ya tiene una solicitud parecida</b></div>
          {dup.map((p) => <a key={p.id} href={'#/solicitudes/' + p.id} onClick={onClose}>{p.titulo}{p.fecha_prevista ? ` · ${fechaCorta(p.fecha_prevista)}` : ''} <Estado tipo="solicitud" valor={p.estado} /></a>)}
          <div className="row"><Btn size="sm" variant="ghost" onClick={() => { setDup(null) }}>Revisar los datos</Btn><Btn size="sm" onClick={() => guardar(true)}>Es otra distinta: registrar igual</Btn></div>
        </div>
      )}
    </Modal>
  )
}

const FILTROS = [['abiertas', 'Abiertas'], ['en_evaluacion', 'En evaluación'], ['pendiente_informacion', 'Falta información'], ['lista_para_propuesta', 'Listas para propuesta'], ['sin_respuesta', 'Propuesta sin respuesta'], ['convertida', 'Con evento'], ['descartada', 'Descartadas'], ['todas', 'Todas']]

export default function Solicitudes({ query }) {
  const { puedeEditar } = useAuth()
  const [filtro, setFiltro] = useState(query.sin_respuesta ? 'sin_respuesta' : query.estado || 'abiertas')
  const [q, setQ] = useState('')
  const [nueva, setNueva] = useState(!!query.nueva && puedeEditar)
  const params = filtro === 'sin_respuesta' ? { sin_respuesta: 1 } : filtro === 'todas' ? {} : { estado: filtro }
  const { data, cargando, error, recargar } = useCarga(() => api('/solicitudes', { params: { ...params, q, cliente_id: query.cliente_id } }), [filtro, q, query.cliente_id])

  return (
    <div>
      <div className="page-head">
        <div><h1>Solicitudes</h1><p>Pedidos de los clientes, desde que llegan hasta que tienen propuesta y respuesta.</p></div><div className="spacer" />
        {puedeEditar && <Btn icon={Plus} onClick={() => setNueva(true)}>Nueva solicitud</Btn>}
      </div>
      <div className="filters">
        <div className="search"><Search size={16} /><input placeholder="Buscar por nombre del evento…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div style={{ marginBottom: 16, overflowX: 'auto' }}><Chips value={filtro} onChange={setFiltro} opciones={FILTROS} /></div>

      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : data.length === 0 ? (
        <Vacio icon={ClipboardList} titulo="No hay solicitudes con este filtro" texto="Cuando un cliente te pida un evento, registralo acá.">{puedeEditar && <Btn icon={Plus} onClick={() => setNueva(true)}>Nueva solicitud</Btn>}</Vacio>
      ) : (
        <div className="lista-prox">
          {data.map((s) => (
            <div key={s.id} className="prox" role="button" tabIndex={0} onClick={() => ir('solicitudes/' + s.id)} onKeyDown={(k) => k.key === 'Enter' && ir('solicitudes/' + s.id)}>
              <div className="grow">
                <div className="row" style={{ gap: 8 }}><b>{s.titulo}</b>{s.origen === 'cliente' && !s.visto_at && <span className="badge badge-nuevo">● Pedido nuevo</span>}{s.origen === 'cliente' && <span className="badge celeste">Del cliente</span>}<Estado tipo="solicitud" valor={s.estado} />
                  {s.propuesta && <Estado tipo="propuesta" valor={s.propuesta.estado} />}</div>
                <div className="muted small">{s.cliente?.boliche ? `${s.cliente.boliche} · ` : ''}{s.cliente?.nombre} · {s.tipo_evento}{s.fecha_prevista ? ` · ${fechaCorta(s.fecha_prevista)}` : ' · sin fecha'}{s.sede ? ` · ${s.sede.nombre}` : ''}</div>
                <div className="small" style={{ marginTop: 4, color: 'var(--celeste)' }}>➜ {pasoSolicitud(s)}</div>
              </div>
              <div className="right">{s.propuesta?.total != null ? <><b>{$(s.propuesta.total)}</b><div className="muted small">propuesta</div></> : null}{s.encargo && <Badge color="verde">Ver evento</Badge>}</div>
            </div>
          ))}
        </div>
      )}
      {nueva && <FormSolicitud inicial={{ ...(query.fecha ? { fecha_prevista: query.fecha } : {}), ...(query.cliente_id ? { cliente_id: Number(query.cliente_id) } : {}) }} onClose={() => setNueva(false)} onGuardado={(r) => { setNueva(false); ir('solicitudes/' + r.id) }} />}
    </div>
  )
}
