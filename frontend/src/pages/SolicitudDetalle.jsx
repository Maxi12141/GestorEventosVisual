import { useState } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2, Send, Check, X, RotateCcw, Ban, ExternalLink, AlertTriangle, Phone } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Field, NumInput, Modal, Spinner, Vacio, Estado, Badge, useCarga, useToast } from '../ui.jsx'
import { Chips, SelectCatalogo, ProximoPaso, Timeline, Telefono, FeriadoChips } from '../components.jsx'
import { FormSolicitud } from './Solicitudes.jsx'
import { $, fechaLarga, fechaCorta, cap1, hoyAR, MEDIOS, SERVICIOS_COMUNES } from '../utils.js'

// ---------- Armado / edición de la propuesta ----------
function EditorPropuesta({ solicitud, sede, propuesta, onClose, onGuardado }) {
  const toast = useToast()
  const [cond, setCond] = useState(propuesta?.condiciones || '')
  const [filas, setFilas] = useState(propuesta ? propuesta.propuesta_servicios.map((s) => ({ servicio: s.servicio, descripcion: s.descripcion || '', importe: Number(s.importe), importe_confirmado: s.importe_confirmado, proveedor_id: s.proveedor_id })) : [{ servicio: '', descripcion: '', importe: 0, importe_confirmado: false, proveedor_id: null }])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const set = (i, patch) => setFilas(filas.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const total = filas.reduce((t, f) => t + (Number(f.importe) || 0), 0)
  const inciertos = filas.filter((f) => !f.importe_confirmado && f.servicio).length
  const faltan = [!solicitud.fecha_prevista && 'la fecha prevista', !sede && 'la sede prevista', !solicitud.necesidades && 'las necesidades del cliente'].filter(Boolean)

  const guardar = async () => {
    setCargando(true); setError('')
    try {
      const body = { condiciones: cond, servicios: filas.filter((f) => f.servicio.trim()) }
      if (propuesta) await api('/propuestas/' + propuesta.id, { method: 'PUT', body })
      else await api(`/solicitudes/${solicitud.id}/propuesta`, { method: 'POST', body })
      toast(propuesta ? 'Propuesta actualizada' : 'Propuesta registrada como presentada'); onGuardado()
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  return (
    <Modal titulo={propuesta ? 'Modificar propuesta' : 'Armar propuesta'} onClose={onClose} ancho={900}
      footer={<><div className="grow"><span className="muted small">Total ofrecido </span><b style={{ fontSize: 20 }}>{$(total)}</b></div><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Send} loading={cargando} onClick={guardar}>{propuesta ? 'Guardar cambios' : 'Registrar propuesta presentada'}</Btn></>}>
      <div className="stack">
        {faltan.length > 0 && <div className="alerta aviso"><AlertTriangle size={15} />Todavía falta definir {faltan.join(', ')}. Podés presentar la propuesta igual, pero conviene tenerlo claro.</div>}
        <div className="tablewrap"><table>
          <thead><tr><th>Servicio</th><th>Detalle</th><th>Importe</th><th title="Marcalo si el importe ya está confirmado con el proveedor">¿Importe confirmado?</th><th>Proveedor previsto</th><th /></tr></thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <td style={{ minWidth: 150 }}><input list="svc" value={f.servicio} onChange={(e) => set(i, { servicio: e.target.value })} placeholder="DJ, Sonido…" /></td>
                <td style={{ minWidth: 160 }}><input value={f.descripcion} onChange={(e) => set(i, { descripcion: e.target.value })} placeholder="Opcional" /></td>
                <td style={{ minWidth: 150 }}><NumInput prefix="$" value={f.importe} onChange={(v) => set(i, { importe: v })} /></td>
                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={f.importe_confirmado} onChange={(e) => set(i, { importe_confirmado: e.target.checked })} /></td>
                <td style={{ minWidth: 190 }}><SelectCatalogo catalogo="proveedores" value={f.proveedor_id} onChange={(v) => set(i, { proveedor_id: v })} vacio="Sin definir" /></td>
                <td><button className="icon-btn bad" onClick={() => setFilas(filas.filter((_, j) => j !== i))} disabled={filas.length === 1} aria-label="Quitar"><Trash2 size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <datalist id="svc">{SERVICIOS_COMUNES.map((s) => <option key={s} value={s} />)}</datalist>
        <div className="row"><Btn variant="ghost" size="sm" icon={Plus} onClick={() => setFilas([...filas, { servicio: '', descripcion: '', importe: 0, importe_confirmado: false, proveedor_id: null }])}>Agregar servicio</Btn>
          {inciertos > 0 && <span className="small sol">{inciertos} importe(s) sin confirmar: se van a mostrar como “estimados”, no como compromiso.</span>}</div>
        <Field label="Condiciones" hint="Anticipo, plazos, qué incluye y qué no, lo que quede pendiente de definir…"><textarea value={cond} onChange={(e) => setCond(e.target.value)} /></Field>
        {error && <div className="alerta error">{error}</div>}
      </div>
    </Modal>
  )
}

// ---------- El cliente aceptó ----------
function AceptarModal({ solicitud, cliente, propuesta, onClose, onHecho }) {
  const toast = useToast()
  const { usuario } = useAuth()
  const [f, setF] = useState({ fecha: solicitud.fecha_prevista || '', sede_id: solicitud.sede_id || null, hora_inicio: '', hora_fin: '', medio_aceptacion: 'WhatsApp', condiciones: propuesta.condiciones || '', responsable_id: usuario.id, asistentes_estimados: solicitud.asistentes_estimados })
  const [error, setError] = useState('')
  const [conf, setConf] = useState(null)
  const [cargando, setCargando] = useState(false)
  const inciertos = propuesta.propuesta_servicios.filter((s) => !s.importe_confirmado).length
  const enviar = async (forzar) => {
    setCargando(true); setError('')
    try {
      const r = await api(`/propuestas/${propuesta.id}/aceptar`, { method: 'POST', body: { ...f, forzar } })
      toast('Aceptación registrada. El evento quedó confirmado 🎉'); onHecho(r.encargo_id)
    } catch (e) {
      if (e.datos?.codigo === 'CONFLICTO_SEDE') setConf(e.datos.conflictos); else setError(e.message)
    } finally { setCargando(false) }
  }
  return (
    <Modal titulo="Registrar que el cliente aceptó" onClose={onClose} ancho={680}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Check} loading={cargando} onClick={() => enviar(false)}>Confirmar aceptación</Btn></>}>
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>Para confirmar el evento tienen que quedar claras la <b>fecha</b> y la <b>sede</b>. Se crea el evento con los servicios de la propuesta.</p>
        <div className="form-grid">
          <Field label="Fecha acordada *"><input type="date" min={hoyAR()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Field>
          <Field label="Sede acordada *"><SelectCatalogo catalogo="sedes" value={f.sede_id} onChange={(v) => setF({ ...f, sede_id: v })} vacio="Elegir sede…" /></Field>
          <Field label="Hora de inicio"><input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></Field>
          <Field label="Hora de cierre"><input type="time" value={f.hora_fin} onChange={(e) => setF({ ...f, hora_fin: e.target.value })} /></Field>
          <Field label="¿Cómo aceptó?" className="full"><Chips value={f.medio_aceptacion} onChange={(v) => setF({ ...f, medio_aceptacion: v })} opciones={MEDIOS.map((m) => [m, m])} /></Field>
          <Field label="Condiciones acordadas" className="full"><textarea value={f.condiciones} onChange={(e) => setF({ ...f, condiciones: e.target.value })} /></Field>
          <Field label="Quién coordina el evento"><SelectCatalogo catalogo="equipo" value={f.responsable_id} onChange={(v) => setF({ ...f, responsable_id: v })} puedeCrear={false} /></Field>
          <Field label="Asistentes estimados"><NumInput value={f.asistentes_estimados ?? 0} onChange={(v) => setF({ ...f, asistentes_estimados: v || null })} /></Field>
        </div>
        {inciertos > 0 && <div className="alerta aviso"><AlertTriangle size={15} />{inciertos} servicio(s) tienen el importe sin confirmar. Quedan marcados como “estimados” en el evento.</div>}
        {conf && (
          <div className="alerta aviso" style={{ display: 'grid', gap: 8 }}>
            <b>Ya hay otro evento en esa sede ese día:</b>
            {conf.map((c) => <a key={c.id} href={'#/eventos/' + c.id} target="_blank" rel="noreferrer">{c.nombre} · {c.cliente} <ExternalLink size={12} /></a>)}
            <div className="row"><Btn size="sm" variant="ghost" onClick={() => setConf(null)}>Cambiar fecha o sede</Btn><Btn size="sm" onClick={() => enviar(true)}>Continuar igual</Btn></div>
          </div>
        )}
        {error && <div className="alerta error">{error}</div>}
      </div>
    </Modal>
  )
}

function Motivo({ titulo, label, medios, boton, peligro, onClose, onOk, requerido }) {
  const [t, setT] = useState('')
  const [medio, setMedio] = useState('WhatsApp')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={520} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
      <Btn variant={peligro ? 'danger' : 'primary'} loading={cargando} onClick={async () => { if (requerido && !t.trim()) return setError('Completá este dato'); setCargando(true); try { await onOk({ texto: t, medio }) } catch (e) { setError(e.message); setCargando(false) } }}>{boton}</Btn></>}>
      <div className="stack">
        {medios && <Field label="¿Cómo respondió?"><Chips value={medio} onChange={setMedio} opciones={MEDIOS.map((m) => [m, m])} /></Field>}
        <Field label={label}><textarea value={t} onChange={(e) => setT(e.target.value)} autoFocus /></Field>
        {error && <div className="alerta error">{error}</div>}
      </div>
    </Modal>
  )
}

export default function SolicitudDetalle({ id }) {
  const { puedeEditar } = useAuth()
  const toast = useToast()
  const [dlg, setDlg] = useState(null)
  const { data: d, cargando, error, recargar } = useCarga(() => api('/solicitudes/' + id), [id])
  if (cargando) return <Spinner />
  if (error) return <Vacio icon={AlertTriangle} titulo="No se pudo abrir la solicitud" texto={error.message}><Btn variant="ghost" onClick={() => ir('solicitudes')}>Volver</Btn></Vacio>

  const { solicitud: s, cliente, sede, encargo, propuestas, historial } = d
  const vigente = propuestas.find((p) => p.estado !== 'rechazada')
  const rechazadas = propuestas.filter((p) => p.estado === 'rechazada')
  const abierta = ['en_evaluacion', 'pendiente_informacion', 'lista_para_propuesta'].includes(s.estado)
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); recargar() } catch (e) { toast(e.message, 'error') } }
  const estado = (e, motivo) => run(() => api(`/solicitudes/${s.id}/estado`, { method: 'PATCH', body: { estado: e, motivo } }), 'Estado actualizado')

  let paso
  if (s.estado === 'descartada') paso = <ProximoPaso tono="info" acciones={puedeEditar && <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => estado('en_evaluacion')}>Reabrir</Btn>}>Esta solicitud ya no avanza{s.motivo_descarte ? `: ${s.motivo_descarte}` : ''}.</ProximoPaso>
  else if (s.estado === 'convertida') paso = <ProximoPaso tono="ok" acciones={encargo && <Btn size="sm" icon={ExternalLink} onClick={() => ir('eventos/' + encargo.id)}>Ir al evento</Btn>}>El cliente aceptó y el evento está confirmado. El seguimiento sigue en el evento.</ProximoPaso>
  else if (vigente?.estado === 'pendiente_respuesta') paso = <ProximoPaso tono={vigente.dias_esperando >= 5 ? 'alerta' : 'info'}>Esperando la respuesta del cliente{vigente.dias_esperando ? ` desde hace ${vigente.dias_esperando} días` : ' (presentada hoy)'}. Cuando conteste, registrá si aceptó o rechazó.</ProximoPaso>
  else if (s.estado === 'pendiente_informacion') paso = <ProximoPaso tono="alerta">Falta información del cliente. Cuando la tengas, completá los datos y pasá la solicitud a “Lista para propuesta”.</ProximoPaso>
  else if (s.estado === 'lista_para_propuesta') paso = <ProximoPaso acciones={puedeEditar && <Btn size="sm" icon={Plus} onClick={() => setDlg('propuesta')}>Armar propuesta</Btn>}>{rechazadas.length ? 'La propuesta anterior fue rechazada. Podés presentar una nueva o descartar la solicitud.' : 'Está lista: armá la propuesta con los servicios y sus importes.'}</ProximoPaso>
  else paso = <ProximoPaso>Evaluá el pedido y completá los datos que falten. Cuando esté claro, pasala a “Lista para propuesta”.</ProximoPaso>

  return (
    <div className="stack" style={{ gap: 18 }}>
      <a href="#/solicitudes" className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} />Solicitudes</a>
      <div className="hero">
        <div className="row" style={{ gap: 8 }}><Estado tipo="solicitud" valor={s.estado} /><Badge color="celeste">{s.tipo_evento}</Badge>{s.fecha_prevista && <FeriadoChips fecha={s.fecha_prevista} />}</div>
        <h1>{s.titulo}</h1>
        <div className="ev-meta" style={{ fontSize: 15 }}>
          <span>👤 <a href={'#/clientes/' + cliente.id}>{cliente.boliche ? `${cliente.boliche} · ` : ''}{cliente.nombre}</a></span>
          <span>📅 {s.fecha_prevista ? cap1(fechaLarga(s.fecha_prevista)) : 'Fecha sin definir'}</span>
          <span>📍 {sede ? sede.nombre : s.sede_detalle || 'Sede sin definir'}</span>
          {s.asistentes_estimados != null && <span>👥 ~{s.asistentes_estimados} personas</span>}
        </div>
        {cliente.telefono !== undefined && <div className="row small"><Phone size={14} /><Telefono tel={cliente.telefono} /></div>}
        <div className="muted small">Registrada por {s.creada_por || '—'}{s.medio_contacto ? ` · llegó por ${s.medio_contacto}` : ''}</div>
        {puedeEditar && abierta && (
          <div className="row no-print">
            <Btn variant="ghost" size="sm" icon={Pencil} onClick={() => setDlg('editar')}>Editar datos</Btn>
            {s.estado !== 'en_evaluacion' && <Btn variant="ghost" size="sm" onClick={() => estado('en_evaluacion')}>Marcar “en evaluación”</Btn>}
            {s.estado !== 'pendiente_informacion' && <Btn variant="ghost" size="sm" onClick={() => estado('pendiente_informacion')}>Marcar “falta información”</Btn>}
            {s.estado !== 'lista_para_propuesta' && <Btn variant="ghost" size="sm" onClick={() => estado('lista_para_propuesta')}>Marcar “lista para propuesta”</Btn>}
            <div className="spacer" /><Btn variant="danger" size="sm" icon={Ban} onClick={() => setDlg('descartar')}>Descartar</Btn>
          </div>
        )}
      </div>

      {paso}

      {s.necesidades && <section className="card"><div className="card-head"><h2>Qué necesita el cliente</h2></div><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.necesidades}</p></section>}

      <section className="card">
        <div className="card-head"><h2>Propuesta</h2>
          {vigente && <Estado tipo="propuesta" valor={vigente.estado} />}<div className="spacer" />
          {puedeEditar && !vigente && abierta && <Btn size="sm" icon={Plus} onClick={() => setDlg('propuesta')}>Armar propuesta</Btn>}
          {puedeEditar && vigente?.estado === 'pendiente_respuesta' && <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setDlg('propuesta')}>Modificar</Btn>}</div>
        {!vigente ? <Vacio titulo="Todavía no hay propuesta" texto={abierta ? 'Cuando tengas claro qué servicios ofrecer y a qué importe, armala acá.' : ''} /> : (
          <div className="stack">
            <div className="muted small">Presentada el {fechaCorta(vigente.fecha_presentacion)} por {vigente.creada_por || '—'}{vigente.fecha_respuesta ? ` · respondida el ${fechaCorta(vigente.fecha_respuesta)}${vigente.respondida_por_nombre ? ' (registró ' + vigente.respondida_por_nombre + ')' : ''}` : ''}</div>
            <div className="tablewrap"><table>
              <thead><tr><th>Servicio</th><th>Proveedor previsto</th>{vigente.total != null && <th className="num">Importe</th>}</tr></thead>
              <tbody>
                {vigente.propuesta_servicios.map((x) => (
                  <tr key={x.id}><td><b>{x.servicio}</b>{x.descripcion && <div className="muted small">{x.descripcion}</div>}</td><td>{x.proveedores?.nombre || <span className="muted">Sin definir</span>}</td>
                    {vigente.total != null && <td className="num">{$(x.importe)} {!x.importe_confirmado && <Badge color="warn">Estimado</Badge>}</td>}</tr>
                ))}
                {vigente.total != null && <tr className="total"><td colSpan={2}>Total de la propuesta</td><td className="num">{$(vigente.total)}</td></tr>}
              </tbody>
            </table></div>
            {vigente.condiciones && <div><span className="field-label">Condiciones</span><p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{vigente.condiciones}</p></div>}
            {vigente.observacion_respuesta && <div className="alerta aviso">{vigente.observacion_respuesta}</div>}
            {puedeEditar && vigente.estado === 'pendiente_respuesta' && (
              <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <b>¿Qué respondió el cliente?</b><div className="spacer" />
                <Btn variant="danger" icon={X} onClick={() => setDlg('rechazar')}>Rechazó</Btn>
                <Btn icon={Check} onClick={() => setDlg('aceptar')}>Aceptó</Btn>
              </div>
            )}
          </div>
        )}
        {rechazadas.length > 0 && (
          <details style={{ marginTop: 14 }}><summary className="muted small" style={{ cursor: 'pointer' }}>Propuestas rechazadas ({rechazadas.length})</summary>
            {rechazadas.map((p) => (
              <div key={p.id} className="card flat" style={{ marginTop: 10 }}>
                <div className="muted small">Presentada el {fechaCorta(p.fecha_presentacion)} · rechazada el {fechaCorta(p.fecha_respuesta)}{p.medio_respuesta ? ` por ${p.medio_respuesta}` : ''}</div>
                <div style={{ margin: '6px 0' }}>{p.propuesta_servicios.map((x) => x.servicio + (x.importe != null ? ` ${$(x.importe)}` : '')).join(' · ')}{p.total != null && <b> — Total {$(p.total)}</b>}</div>
                {p.observacion_respuesta && <div className="small">“{p.observacion_respuesta}”</div>}
              </div>
            ))}
          </details>
        )}
      </section>

      <section className="card"><div className="card-head"><h2>Historial</h2></div><Timeline items={historial} /></section>

      {dlg === 'editar' && <FormSolicitud inicial={{ ...s, sede_id: sede?.id ?? s.sede_id }} onClose={() => setDlg(null)} onGuardado={() => { setDlg(null); recargar() }} />}
      {dlg === 'propuesta' && <EditorPropuesta solicitud={s} sede={sede} propuesta={vigente?.estado === 'pendiente_respuesta' ? vigente : null} onClose={() => setDlg(null)} onGuardado={() => { setDlg(null); recargar() }} />}
      {dlg === 'aceptar' && <AceptarModal solicitud={s} cliente={cliente} propuesta={vigente} onClose={() => setDlg(null)} onHecho={(eid) => ir('eventos/' + eid)} />}
      {dlg === 'rechazar' && <Motivo titulo="El cliente rechazó la propuesta" label="¿Qué dijo? (opcional, pero ayuda a tener antecedentes)" medios boton="Registrar rechazo" peligro onClose={() => setDlg(null)} onOk={async ({ texto, medio }) => { await api(`/propuestas/${vigente.id}/rechazar`, { method: 'POST', body: { observacion: texto, medio } }); toast('Rechazo registrado'); setDlg(null); recargar() }} />}
      {dlg === 'descartar' && <Motivo titulo="Descartar la solicitud" label="¿Por qué ya no avanza?" boton="Descartar" peligro onClose={() => setDlg(null)} onOk={async ({ texto }) => { await api(`/solicitudes/${s.id}/estado`, { method: 'PATCH', body: { estado: 'descartada', motivo: texto } }); toast('Solicitud descartada'); setDlg(null); recargar() }} />}
    </div>
  )
}
