import { useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { api } from '../api.js'
import { Btn, Field, NumInput, Modal, Alertas, useToast } from '../ui.jsx'
import { Chips, SelectCatalogo } from '../components.jsx'
import { CAMPOS_CAMBIO, CAUSAS_CANCELACION, SERVICIOS_COMUNES, hoyAR } from '../utils.js'

// Estructura común: título, contenido, error y botón con "cargando"
export function Dlg({ titulo, ancho = 560, boton, peligro, onClose, onOk, children, deshabilitado, extraFooter }) {
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const ok = async () => {
    setCargando(true); setError('')
    try { await onOk() } catch (e) { setError(e.message); setCargando(false) }
  }
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={ancho} footer={<>{extraFooter}<Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn variant={peligro ? 'danger' : 'primary'} loading={cargando} disabled={deshabilitado} onClick={ok}>{boton}</Btn></>}>
      <div className="stack">{children}{error && <div className="alerta error">{error}</div>}</div>
    </Modal>
  )
}

export function ReasignarModal({ enc, onClose, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState({ responsable_id: enc.responsable_id, responsable_evento_id: enc.responsable_evento_id || null, motivo: '' })
  return (
    <Dlg titulo="Responsables del evento" boton="Guardar" onClose={onClose} onOk={async () => { await api(`/encargos/${enc.id}/responsables`, { method: 'PATCH', body: f }); toast('Responsables actualizados'); onHecho() }}>
      <p className="muted" style={{ margin: 0 }}>Si quien lleva el evento no está disponible, otra persona lo puede retomar: todo el historial queda a la vista.</p>
      <Field label="Quién coordina el evento"><SelectCatalogo catalogo="equipo" value={f.responsable_id} onChange={(v) => setF({ ...f, responsable_id: v })} puedeCrear={false} vacio="Elegir persona…" /></Field>
      <Field label="Responsable durante el evento (la noche)" hint="Quien atiende lo que pase el día de la fiesta"><SelectCatalogo catalogo="equipo" value={f.responsable_evento_id} onChange={(v) => setF({ ...f, responsable_evento_id: v })} puedeCrear={false} vacio="Sin asignar" /></Field>
      <Field label="Motivo del cambio (opcional)"><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Ej: Gaby está de licencia" /></Field>
    </Dlg>
  )
}

export function ServicioModal({ s, puedeVerImporte, onClose, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState({ proveedor_id: s.proveedor_id, participacion: s.participacion, importe_proveedor: s.importe_proveedor ?? '', participacion_nota: s.participacion_nota || '', revisado: false })
  return (
    <Dlg titulo={`Servicio: ${s.servicio}`} boton="Guardar" onClose={onClose} ancho={600}
      onOk={async () => {
        const body = { proveedor_id: f.proveedor_id, participacion: f.participacion, participacion_nota: f.participacion_nota, importe_proveedor: f.importe_proveedor === '' ? null : Number(f.importe_proveedor) }
        if (f.revisado) body.revisado = true
        await api('/servicios/' + s.id, { method: 'PATCH', body }); toast('Servicio actualizado'); onHecho()
      }}>
      {s.revisar && <div className="alerta aviso"><AlertTriangle size={15} /><div>{s.revisar_motivo}<label className="row" style={{ gap: 8, marginTop: 8 }}><input type="checkbox" checked={f.revisado} onChange={(e) => setF({ ...f, revisado: e.target.checked })} />Ya lo revisé con el proveedor</label></div></div>}
      <Field label="Proveedor"><SelectCatalogo catalogo="proveedores" value={f.proveedor_id} onChange={(v) => setF({ ...f, proveedor_id: v, participacion: v !== s.proveedor_id ? 'pendiente' : f.participacion })} vacio="Sin elegir" /></Field>
      <Field label="¿Qué respondió el proveedor?" hint="“Dijo que está disponible” no es lo mismo que “Confirmado”: marcá Confirmado solo cuando se comprometió.">
        <Chips value={f.participacion} onChange={(v) => setF({ ...f, participacion: v })} opciones={[['pendiente', 'Sin respuesta'], ['disponibilidad_informada', 'Dijo que está disponible'], ['confirmada', 'Confirmado'], ['rechazada', 'No participa']]} />
      </Field>
      <Field label="Importe informado por el proveedor" hint={puedeVerImporte ? `Importe acordado con el cliente: $${Number(s.importe).toLocaleString('es-AR')}` : undefined}><NumInput prefix="$" value={f.importe_proveedor === '' ? 0 : f.importe_proveedor} onChange={(v) => setF({ ...f, importe_proveedor: v || '' })} /></Field>
      <Field label="Nota"><textarea value={f.participacion_nota} onChange={(e) => setF({ ...f, participacion_nota: e.target.value })} placeholder="Qué dijo, qué falta, condiciones del proveedor…" /></Field>
    </Dlg>
  )
}

export function TareaModal({ encId, tarea, servicios, onClose, onHecho, puedeAsignar, yo }) {
  const toast = useToast()
  const [f, setF] = useState({ titulo: '', descripcion: '', responsable_id: puedeAsignar ? null : yo, fecha_prevista: '', servicio_id: null, ...tarea })
  return (
    <Dlg titulo={tarea ? 'Editar tarea' : 'Nueva tarea'} boton="Guardar" onClose={onClose}
      onOk={async () => {
        const body = { titulo: f.titulo, descripcion: f.descripcion, fecha_prevista: f.fecha_prevista || null, servicio_id: f.servicio_id || null, ...(puedeAsignar ? { responsable_id: f.responsable_id || null } : {}) }
        if (tarea) await api('/tareas/' + tarea.id, { method: 'PATCH', body }); else await api(`/encargos/${encId}/tareas`, { method: 'POST', body: { ...body, responsable_id: f.responsable_id || null } })
        toast('Tarea guardada'); onHecho()
      }}>
      <Field label="¿Qué hay que hacer? *"><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej: Confirmar importe del sonido" autoFocus /></Field>
      <div className="form-grid">
        <Field label="Responsable"><SelectCatalogo catalogo="equipo" value={f.responsable_id} onChange={(v) => setF({ ...f, responsable_id: v })} puedeCrear={false} vacio="Sin asignar" disabled={!puedeAsignar && !!tarea} /></Field>
        <Field label="Fecha prevista"><input type="date" value={f.fecha_prevista || ''} onChange={(e) => setF({ ...f, fecha_prevista: e.target.value })} /></Field>
      </div>
      <Field label="Servicio relacionado (opcional)"><select value={f.servicio_id ?? ''} onChange={(e) => setF({ ...f, servicio_id: e.target.value ? Number(e.target.value) : null })}><option value="">Ninguno</option>{servicios.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.servicio}</option>)}</select></Field>
      <Field label="Detalle (opcional)"><textarea value={f.descripcion || ''} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Field>
    </Dlg>
  )
}

// ---------- Cambios relevantes ----------
export function CambioModal({ enc, servicios, onClose, onHecho }) {
  const toast = useToast()
  const activos = servicios.filter((s) => s.activo)
  const [campo, setCampo] = useState('fecha')
  const [desc, setDesc] = useState('')
  const [conf, setConf] = useState('pendiente')
  const [p, setP] = useState({ accion: 'agregar', importe_confirmado: false })
  const [conflicto, setConflicto] = useState(null)
  const set = (patch) => setP({ ...p, ...patch })
  const afectaAcuerdo = campo !== 'otro'

  const enviar = async (forzar) => {
    const payload = { ...p }
    if (campo === 'fecha') payload.fecha = p.fecha
    const body = { campo, descripcion: desc, payload, forzar,
      requiere_conformidad: afectaAcuerdo && conf !== 'interno', conformidad: afectaAcuerdo && conf !== 'interno' ? conf : 'no_requiere' }
    try {
      await api(`/encargos/${enc.id}/cambios`, { method: 'POST', body })
      toast(conf === 'pendiente' && afectaAcuerdo ? 'Cambio registrado: queda esperando al cliente' : 'Cambio registrado'); onHecho()
    } catch (e) { if (e.datos?.codigo === 'CONFLICTO_SEDE') { setConflicto(e.datos.conflictos); throw new Error('Hay otro evento en esa sede ese día: confirmá si querés continuar igual.') } throw e }
  }
  const cambiarCampo = (c) => { setCampo(c); setP({ accion: 'agregar', importe_confirmado: false }); setConf(c === 'otro' ? 'interno' : 'pendiente') }

  return (
    <Dlg titulo="Registrar un cambio" boton={conf === 'pendiente' && afectaAcuerdo ? 'Registrar (queda esperando al cliente)' : 'Registrar cambio'} onClose={onClose} ancho={680} onOk={() => enviar(!!conflicto)}>
      <Field label="¿Qué cambia?"><Chips value={campo} onChange={cambiarCampo} opciones={Object.entries(CAMPOS_CAMBIO)} /></Field>

      {campo === 'fecha' && <Field label="Nueva fecha" hint={`Fecha actual: ${enc.fecha}`}><input type="date" min={hoyAR()} value={p.fecha || ''} onChange={(e) => set({ fecha: e.target.value })} /></Field>}
      {campo === 'sede' && <Field label="Nueva sede"><SelectCatalogo catalogo="sedes" value={p.sede_id} onChange={(v) => set({ sede_id: v })} vacio="Elegir sede…" /></Field>}
      {campo === 'importe' && (<div className="form-grid">
        <Field label="Servicio"><select value={p.servicio_id ?? ''} onChange={(e) => set({ servicio_id: Number(e.target.value) })}><option value="">Elegir…</option>{activos.map((s) => <option key={s.id} value={s.id}>{s.servicio} (hoy ${Number(s.importe).toLocaleString('es-AR')})</option>)}</select></Field>
        <Field label="Nuevo importe"><NumInput prefix="$" value={p.importe ?? 0} onChange={(v) => set({ importe: v })} /></Field>
      </div>)}
      {campo === 'servicio' && (<>
        <Field label="¿Qué se hace con los servicios?"><Chips value={p.accion} onChange={(v) => set({ accion: v })} opciones={[['agregar', 'Agregar uno'], ['quitar', 'Quitar uno'], ['modificar', 'Cambiar uno']]} /></Field>
        {p.accion === 'agregar' ? (<div className="form-grid">
          <Field label="Servicio"><input list="svc2" value={p.servicio || ''} onChange={(e) => set({ servicio: e.target.value })} placeholder="Ej: Pantallas" /><datalist id="svc2">{SERVICIOS_COMUNES.map((x) => <option key={x} value={x} />)}</datalist></Field>
          <Field label="Importe acordado"><NumInput prefix="$" value={p.importe ?? 0} onChange={(v) => set({ importe: v })} /></Field>
          <Field label="Proveedor previsto" className="full"><SelectCatalogo catalogo="proveedores" value={p.proveedor_id} onChange={(v) => set({ proveedor_id: v })} vacio="Sin definir" /></Field>
        </div>) : (<div className="form-grid">
          <Field label="Servicio" className="full"><select value={p.servicio_id ?? ''} onChange={(e) => set({ servicio_id: Number(e.target.value) })}><option value="">Elegir…</option>{activos.map((s) => <option key={s.id} value={s.id}>{s.servicio}{s.proveedor ? ` · ${s.proveedor.nombre}` : ''}</option>)}</select></Field>
          {p.accion === 'modificar' && <><Field label="Nuevo nombre (opcional)"><input value={p.servicio || ''} onChange={(e) => set({ servicio: e.target.value })} /></Field>
            <Field label="Reemplazar proveedor (opcional)"><SelectCatalogo catalogo="proveedores" value={p.proveedor_id} onChange={(v) => set({ proveedor_id: v })} vacio="No cambiar" /></Field></>}
        </div>)}
      </>)}
      {campo === 'condiciones' && <Field label="Nuevas condiciones" hint="Antes: " ><textarea value={p.condiciones ?? ''} onChange={(e) => set({ condiciones: e.target.value })} placeholder={enc.condiciones || 'Escribí las condiciones que quedan vigentes'} /></Field>}

      <Field label="Describí el cambio *"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={{ fecha: 'Ej: El cliente pide pasar la fiesta al sábado siguiente', sede: 'Ej: Se muda a la otra sede por refacciones', servicio: 'Ej: El DJ no puede y lo reemplazamos', importe: 'Ej: El proveedor informó un nuevo importe', condiciones: 'Ej: Se acordó cobrar el anticipo en dos cuotas', otro: 'Qué pasó' }[campo]} /></Field>

      {afectaAcuerdo && (
        <Field label="¿Esto cambia lo que el cliente aceptó?">
          <div className="opciones">
            {[['pendiente', 'Sí, y el cliente todavía no dio su conformidad', 'Queda “esperando al cliente”. Mientras tanto sigue vigente lo acordado antes.'],
              ['conforme', 'Sí, pero el cliente ya dio su conformidad', 'Se aplica ahora y se marcan los compromisos a revisar.'],
              ['interno', 'No, es un ajuste interno que no altera el acuerdo', 'Se aplica ahora.']].map(([v, t, h]) => (
              <label key={v} className={'opcion' + (conf === v ? ' on' : '')}><input type="radio" name="conf" checked={conf === v} onChange={() => setConf(v)} /><div><b>{t}</b><div className="muted small">{h}</div></div></label>
            ))}
          </div>
        </Field>
      )}
      {(campo === 'fecha' || campo === 'sede') && conf !== 'pendiente' && <div className="helper"><Info size={16} /><span>Al aplicarse, los servicios y tareas pendientes quedan marcados “para revisar”: hay que confirmar de nuevo la disponibilidad de los proveedores y los plazos.</span></div>}
      {conflicto && <div className="alerta aviso"><AlertTriangle size={15} /><div><b>Ya hay otro evento ese día en esa sede:</b> {conflicto.map((c) => `${c.nombre} (${c.cliente})`).join(', ')}.</div></div>}
    </Dlg>
  )
}

// ---------- Incidentes ----------
const ahoraLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
export function IncidenteModal({ encId, incidente, servicios, onClose, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState({ descripcion: '', consecuencias: '', medida_tomada: '', pendiente: '', servicio_id: null, ocurrido_en: ahoraLocal(), ...incidente, ...(incidente ? { ocurrido_en: new Date(new Date(incidente.ocurrido_en).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) } : {}) })
  return (
    <Dlg titulo={incidente ? 'Editar incidente' : 'Registrar un incidente'} boton="Guardar" onClose={onClose} ancho={620}
      onOk={async () => {
        const body = { descripcion: f.descripcion, consecuencias: f.consecuencias, medida_tomada: f.medida_tomada, pendiente: f.pendiente, servicio_id: f.servicio_id || null, ocurrido_en: new Date(f.ocurrido_en).toISOString() }
        if (incidente) await api('/incidentes/' + incidente.id, { method: 'PUT', body }); else await api(`/encargos/${encId}/incidentes`, { method: 'POST', body })
        toast('Incidente registrado'); onHecho()
      }}>
      <Field label="¿Qué ocurrió? *"><textarea value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Ej: El DJ llegó 40 minutos tarde" autoFocus /></Field>
      <div className="form-grid">
        <Field label="¿Cuándo?"><input type="datetime-local" value={f.ocurrido_en} onChange={(e) => setF({ ...f, ocurrido_en: e.target.value })} /></Field>
        <Field label="Servicio involucrado"><select value={f.servicio_id ?? ''} onChange={(e) => setF({ ...f, servicio_id: e.target.value ? Number(e.target.value) : null })}><option value="">Ninguno / general</option>{servicios.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.servicio}</option>)}</select></Field>
      </div>
      <Field label="¿Qué consecuencias tuvo?"><input value={f.consecuencias || ''} onChange={(e) => setF({ ...f, consecuencias: e.target.value })} /></Field>
      <Field label="¿Qué se hizo para resolverlo?"><input value={f.medida_tomada || ''} onChange={(e) => setF({ ...f, medida_tomada: e.target.value })} /></Field>
      <Field label="¿Quedó algo pendiente?" hint="Si no queda nada pendiente, dejalo vacío"><input value={f.pendiente || ''} onChange={(e) => setF({ ...f, pendiente: e.target.value })} placeholder="Ej: Hablar con el DJ por el retraso" /></Field>
    </Dlg>
  )
}

// ---------- Cierre ----------
export function CerrarModal({ enc, resumen, onClose, onHecho }) {
  const toast = useToast()
  const [obs, setObs] = useState('')
  const hoy = hoyAR()
  const futuro = enc.fecha > hoy
  return (
    <Dlg titulo="Registrar que el evento se realizó" boton="Registrar como realizado" onClose={onClose} deshabilitado={futuro}
      onOk={async () => { await api(`/encargos/${enc.id}/cerrar`, { method: 'POST', body: { resultado: 'realizado', observaciones: obs } }); toast('Evento registrado como realizado ✔'); onHecho() }}>
      {futuro && <div className="alerta error"><AlertTriangle size={15} />Todavía no llegó la fecha del evento ({enc.fecha}): no se puede registrar como realizado.</div>}
      {(resumen.servicios_sin_confirmar > 0 || resumen.tareas_abiertas > 0 || resumen.incidentes_pendientes > 0 || resumen.cambios_pendientes > 0) && (
        <div className="alerta aviso" style={{ display: 'grid' }}>
          <b>Antes de cerrar, fijate que quedan:</b>
          {resumen.servicios_sin_confirmar > 0 && <span>• {resumen.servicios_sin_confirmar} servicio(s) sin confirmar</span>}
          {resumen.tareas_abiertas > 0 && <span>• {resumen.tareas_abiertas} tarea(s) abiertas</span>}
          {resumen.incidentes_pendientes > 0 && <span>• {resumen.incidentes_pendientes} incidente(s) con algo pendiente</span>}
          {resumen.cambios_pendientes > 0 && <span>• {resumen.cambios_pendientes} cambio(s) esperando al cliente</span>}
          <span className="muted small">No bloquea el cierre, pero conviene dejarlo resuelto o anotado.</span>
        </div>
      )}
      <Field label="Observaciones del cierre (opcional)" hint="Cómo salió, qué hay que recordar para la próxima…"><textarea value={obs} onChange={(e) => setObs(e.target.value)} autoFocus /></Field>
    </Dlg>
  )
}

export function CancelarModal({ enc, onClose, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState({ causa: CAUSAS_CANCELACION[0], motivo: '', comunicada_cliente: true, observaciones: '' })
  return (
    <Dlg titulo="Cancelar el evento" boton="Cancelar el evento" peligro onClose={onClose}
      onOk={async () => { const r = await api(`/encargos/${enc.id}/cerrar`, { method: 'POST', body: { resultado: 'cancelado', ...f } }); toast(`Evento cancelado. ${r.proveedores_a_avisar ? `Falta avisar a ${r.proveedores_a_avisar} proveedor(es).` : ''}`, 'info'); onHecho() }}>
      <div className="helper"><Info size={16} /><span>Las tareas abiertas pasan a “canceladas” y te queda la lista de proveedores a los que hay que avisar. Todo lo cargado se conserva.</span></div>
      <Field label="Causa principal"><select value={f.causa} onChange={(e) => setF({ ...f, causa: e.target.value })}>{CAUSAS_CANCELACION.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Motivo detallado *"><textarea value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Qué pasó y quién lo decidió" autoFocus /></Field>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={f.comunicada_cliente} onChange={(e) => setF({ ...f, comunicada_cliente: e.target.checked })} />La cancelación está confirmada con el cliente</label>
    </Dlg>
  )
}

export function MotivoModal({ titulo, label, boton, campo = 'motivo', texto, peligro, onClose, onOk, ayuda }) {
  const [t, setT] = useState(texto || '')
  return (
    <Dlg titulo={titulo} boton={boton} peligro={peligro} onClose={onClose} onOk={() => onOk(t)}>
      {ayuda && <div className="helper"><Info size={16} /><span>{ayuda}</span></div>}
      <Field label={label}><textarea value={t} onChange={(e) => setT(e.target.value)} autoFocus /></Field>
    </Dlg>
  )
}

export function CorregirCierreModal({ enc, onClose, onHecho }) {
  const toast = useToast()
  const cancelado = enc.estado === 'cancelado'
  const [f, setF] = useState({ observaciones_cierre: enc.observaciones_cierre || '', motivo_cancelacion: enc.motivo_cancelacion || '', motivo_correccion: '' })
  return (
    <Dlg titulo="Corregir el registro del cierre" boton="Guardar corrección" onClose={onClose}
      onOk={async () => { const b = { observaciones_cierre: f.observaciones_cierre, motivo_correccion: f.motivo_correccion }; if (cancelado) b.motivo_cancelacion = f.motivo_cancelacion; await api(`/encargos/${enc.id}/corregir-cierre`, { method: 'POST', body: b }); toast('Corrección registrada'); onHecho() }}>
      <div className="helper"><Info size={16} /><span>La corrección queda en el historial con quién la hizo y por qué. Si el resultado en sí estaba mal (por ejemplo, figura cancelado y en realidad se hizo), usá “Reabrir”.</span></div>
      {cancelado && <Field label="Motivo de la cancelación"><textarea value={f.motivo_cancelacion} onChange={(e) => setF({ ...f, motivo_cancelacion: e.target.value })} /></Field>}
      <Field label="Observaciones del cierre"><textarea value={f.observaciones_cierre} onChange={(e) => setF({ ...f, observaciones_cierre: e.target.value })} /></Field>
      <Field label="¿Qué corregiste y por qué? *"><input value={f.motivo_correccion} onChange={(e) => setF({ ...f, motivo_correccion: e.target.value })} /></Field>
    </Dlg>
  )
}
