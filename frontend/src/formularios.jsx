import { useState } from 'react'
import { api } from './api.js'
import { Btn, Field, NumInput, Modal, useToast } from './ui.jsx'
import { PROVINCIAS, SERVICIOS_COMUNES } from './utils.js'

function Base({ titulo, ruta, inicial, onClose, onGuardado, validar, children, ancho = 560 }) {
  const toast = useToast()
  const [f, setF] = useState({ activo: true, ...inicial })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const guardar = async () => {
    const msg = validar?.(f)
    if (msg) return setError(msg)
    setCargando(true); setError('')
    try {
      const r = f.id ? await api(`/${ruta}/${f.id}`, { method: 'PUT', body: f }) : await api('/' + ruta, { method: 'POST', body: f })
      toast('Guardado'); onGuardado(r)
    } catch (e) { setError(e.message) } finally { setCargando(false) }
  }
  return (
    <Modal titulo={titulo} onClose={onClose} ancho={ancho} footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn loading={cargando} onClick={guardar}>Guardar</Btn></>}>
      <div className="form-grid">{children(f, (k) => (e) => setF({ ...f, [k]: e.target.value }), setF)}</div>
      {error && <div className="alerta error" style={{ marginTop: 14 }}>{error}</div>}
    </Modal>
  )
}

export const ModalCliente = ({ inicial, ...p }) => (
  <Base titulo={inicial?.id ? 'Editar cliente' : 'Nuevo cliente'} ruta="clientes" inicial={inicial} {...p} validar={(f) => (!f.nombre?.trim() ? 'Poné el nombre del dueño o de la persona de contacto' : '')}>
    {(f, s, setF) => (<>
      <Field label="Nombre del contacto / propietario *"><input value={f.nombre ?? ''} onChange={s('nombre')} autoFocus /></Field>
      <Field label="Nombre del boliche"><input value={f.boliche ?? ''} onChange={s('boliche')} /></Field>
      <Field label="Teléfono"><input value={f.telefono ?? ''} onChange={s('telefono')} placeholder="351 555-0000" /></Field>
      <Field label="Email"><input type="email" value={f.email ?? ''} onChange={s('email')} /></Field>
      <Field label="Notas" className="full"><textarea value={f.notas ?? ''} onChange={s('notas')} placeholder="Preferencias, cómo prefiere que lo contacten…" /></Field>
      {f.id && <label className="row full" style={{ gap: 8 }}><input type="checkbox" checked={f.activo !== false} onChange={(e) => setF({ ...f, activo: e.target.checked })} />Cliente activo</label>}
    </>)}
  </Base>
)

export const ModalSede = ({ inicial, ...p }) => (
  <Base titulo={inicial?.id ? 'Editar sede' : 'Nueva sede'} ruta="sedes" inicial={inicial} {...p} validar={(f) => (!f.nombre?.trim() ? 'Poné el nombre de la sede' : '')}>
    {(f, s, setF) => (<>
      <Field label="Nombre de la sede *" className="full"><input value={f.nombre ?? ''} onChange={s('nombre')} placeholder="Ej: Club Fénix" autoFocus /></Field>
      <Field label="Ciudad"><input value={f.ciudad ?? ''} onChange={s('ciudad')} /></Field>
      <Field label="Provincia"><select value={f.provincia ?? ''} onChange={s('provincia')}><option value="">—</option>{PROVINCIAS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Dirección" className="full"><input value={f.direccion ?? ''} onChange={s('direccion')} /></Field>
      <Field label="Capacidad (personas)"><NumInput value={f.capacidad ?? 0} min={0} onChange={(v) => setF({ ...f, capacidad: v || null })} /></Field>
      <Field label="Notas"><input value={f.notas ?? ''} onChange={s('notas')} placeholder="Accesos, horarios de carga…" /></Field>
      {f.id && <label className="row full" style={{ gap: 8 }}><input type="checkbox" checked={f.activo !== false} onChange={(e) => setF({ ...f, activo: e.target.checked })} />Sede activa</label>}
    </>)}
  </Base>
)

export const ModalProveedor = ({ inicial, ...p }) => (
  <Base titulo={inicial?.id ? 'Editar proveedor' : 'Nuevo proveedor'} ruta="proveedores" inicial={inicial} {...p} validar={(f) => (!f.nombre?.trim() ? 'Poné el nombre' : !f.servicio?.trim() ? 'Indicá qué servicio presta (DJ, sonido, barra…)' : '')}>
    {(f, s, setF) => (<>
      <Field label="Nombre *"><input value={f.nombre ?? ''} onChange={s('nombre')} autoFocus /></Field>
      <Field label="Servicio que presta *"><input list="servicios-comunes" value={f.servicio ?? ''} onChange={s('servicio')} placeholder="DJ, Sonido, Barra…" />
        <datalist id="servicios-comunes">{SERVICIOS_COMUNES.map((x) => <option key={x} value={x} />)}</datalist></Field>
      <Field label="Persona de contacto"><input value={f.contacto ?? ''} onChange={s('contacto')} /></Field>
      <Field label="Teléfono"><input value={f.telefono ?? ''} onChange={s('telefono')} /></Field>
      <Field label="Email" className="full"><input type="email" value={f.email ?? ''} onChange={s('email')} /></Field>
      <Field label="Notas" className="full"><textarea value={f.notas ?? ''} onChange={s('notas')} placeholder="Zona, equipamiento, horarios de armado…" /></Field>
      {f.id && <label className="row full" style={{ gap: 8 }}><input type="checkbox" checked={f.activo !== false} onChange={(e) => setF({ ...f, activo: e.target.checked })} />Proveedor activo</label>}
    </>)}
  </Base>
)
