import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, Users as UsersIcon } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Field, NumInput, Modal, Confirmar, Spinner, Vacio, Badge, useCarga, useToast } from '../ui.jsx'
import { $, num, hoyAR, SERVICIOS_COMUNES, MAX_PERSONAS, fechaMaxima, validarPedido } from '../utils.js'
import ConfirmarPedido from './ConfirmarPedido.jsx'

function FormPaquete({ inicial, onClose, onGuardado }) {
  const toast = useToast()
  const [f, setF] = useState({ tipo: 'Boliche', capacidad_min: 1, capacidad_max: 300, precio: 0, servicios: [], incluye: [], duracion: '', ideal_para: '', activo: true, ...inicial })
  const [guardando, setGuardando] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const toggle = (s) => set('servicios', f.servicios.includes(s) ? f.servicios.filter((x) => x !== s) : [...f.servicios, s])
  const guardar = async () => {
    if (!(f.nombre || '').trim()) return toast('Poné un nombre para el paquete', 'error')
    if (!(Number(f.capacidad_min) >= 1) || !(Number(f.capacidad_max) >= 1)) return toast('La capacidad tiene que ser de al menos 1 persona', 'error')
    if (Number(f.capacidad_max) < Number(f.capacidad_min)) return toast('La capacidad máxima tiene que ser mayor o igual que la mínima', 'error')
    if (!(Number(f.precio) > 0)) return toast('Poné un precio mayor a 0', 'error')
    setGuardando(true)
    try {
      await api(f.id ? `/paquetes/${f.id}` : '/paquetes', { method: f.id ? 'PATCH' : 'POST', body: { ...f, incluye: (f.incluye || []).map((x) => x.trim()).filter(Boolean) } })
      toast('Paquete guardado'); onGuardado()
    } catch (e) { toast(e.message, 'error') } finally { setGuardando(false) }
  }
  return (
    <Modal titulo={f.id ? 'Editar paquete' : 'Nuevo paquete'} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn loading={guardando} onClick={guardar}>Guardar</Btn></>}>
      <div className="stack">
        <Field label="Nombre"><input value={f.nombre || ''} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Boliche Chico" /></Field>
        <Field label="Descripción"><textarea rows={2} value={f.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} /></Field>
        <Field label="Tipo"><select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}><option>Boliche</option><option>Festival</option><option>Otro</option></select></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Capacidad mínima"><NumInput min={1} value={f.capacidad_min} onChange={(v) => set('capacidad_min', v)} suffix="personas" /></Field>
          <Field label="Capacidad máxima"><NumInput min={1} value={f.capacidad_max} onChange={(v) => set('capacidad_max', v)} suffix="personas" /></Field>
        </div>
        <Field label="Precio"><NumInput value={f.precio} onChange={(v) => set('precio', v)} prefix="$" step={1000} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Duración"><input value={f.duracion || ''} onChange={(e) => set('duracion', e.target.value)} placeholder="Ej: 6 horas" /></Field>
          <Field label="Ideal para"><input value={f.ideal_para || ''} onChange={(e) => set('ideal_para', e.target.value)} placeholder="Ej: Boliches medianos" /></Field>
        </div>
        <Field label="Qué incluye (una cosa por línea)" hint="Es lo que el cliente lee para decidir. Sé concreto: cantidad, horas, personas.">
          <textarea rows={6} value={(f.incluye || []).join('\n')} onChange={(e) => set('incluye', e.target.value.split('\n'))} placeholder={'DJ durante 5 horas\nSonido para 300 personas\n2 personas de seguridad'} />
        </Field>
        <Field label="Servicios (etiquetas cortas)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SERVICIOS_COMUNES.map((s) => <button type="button" key={s} className={'chip' + (f.servicios.includes(s) ? ' on' : '')} onClick={() => toggle(s)}>{s}</button>)}
          </div>
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} />Visible para los clientes</label>
      </div>
    </Modal>
  )
}

function ModalContratar({ p, capacidad, onClose }) {
  const toast = useToast()
  const [f, setF] = useState({ lugar: '', asistentes: capacidad || p.capacidad_min, fecha_prevista: '', telefono: '', notas: '' })
  const [confirmar, setConfirmar] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const revisar = () => {
    const err = validarPedido(f, { min: p.capacidad_min, max: Math.min(p.capacidad_max, MAX_PERSONAS) })
    if (err) return toast(err, 'error')
    setConfirmar(true)
  }
  const enviar = async () => {
    try { await api(`/paquetes/${p.id}/contratar`, { method: 'POST', body: f }); toast('¡Pedido enviado! El equipo ya lo recibió.'); ir('pedidos') }
    catch (e) { toast(e.message, 'error'); setConfirmar(false) }
  }
  if (confirmar) return <ConfirmarPedido onClose={() => setConfirmar(false)} onConfirm={enviar} total={$(p.precio)}
    filas={[['Paquete', p.nombre], ['Lugar', f.lugar], ['Personas', num(f.asistentes)], ['Fecha deseada', f.fecha_prevista], ['Teléfono', f.telefono], ['Comentarios', f.notas]]} />
  return (
    <Modal titulo={`Pedir: ${p.nombre}`} onClose={onClose}
      footer={<><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn onClick={revisar}>Revisar pedido</Btn></>}>
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}><b style={{ color: 'var(--text)' }}>{$(p.precio)}</b>{p.duracion ? ` · ${p.duracion}` : ''}</p>
        {!!(p.incluye || []).length && <ul style={{ margin: 0, paddingLeft: 18 }} className="small muted">{p.incluye.map((x) => <li key={x}>{x}</li>)}</ul>}
        <Field label="Nombre de tu boliche o festival"><input maxLength={100} value={f.lugar} onChange={(e) => set('lugar', e.target.value)} /></Field>
        <Field label="¿Cuánta gente entra?" hint={`Este paquete es para ${num(p.capacidad_min)} a ${num(p.capacidad_max)} personas`}><NumInput min={p.capacidad_min} max={Math.min(p.capacidad_max, MAX_PERSONAS)} value={f.asistentes} onChange={(v) => set('asistentes', v)} suffix="personas" /></Field>
        <Field label="Fecha deseada (opcional)"><input type="date" min={hoyAR()} max={fechaMaxima()} value={f.fecha_prevista} onChange={(e) => set('fecha_prevista', e.target.value)} /></Field>
        <Field label="Teléfono" hint="Obligatorio, con código de área: el equipo te llama para cualquier consulta"><input type="tel" maxLength={20} value={f.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^\d+\-\s()]/g, ''))} placeholder="Ej: 353 555-0100" /></Field>
        <Field label="Comentarios (opcional)"><textarea rows={2} maxLength={1000} value={f.notas} onChange={(e) => set('notas', e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

export default function Paquetes() {
  const { puedeEditar, esAdmin } = useAuth()
  const toast = useToast()
  const [capTxt, setCapTxt] = useState('')
  const [cap, setCap] = useState('')
  useEffect(() => { const t = setTimeout(() => setCap(capTxt), 350); return () => clearTimeout(t) }, [capTxt]) // espera a que termine de escribir
  const [tipo, setTipo] = useState('')
  const [edit, setEdit] = useState(null)
  const [borrar, setBorrar] = useState(null)
  const [contratar, setContratar] = useState(null)
  const { data, cargando, error, recargar } = useCarga(() => api('/paquetes', { params: { capacidad: cap } }), [cap])
  const lista = (data || []).filter((p) => !tipo || p.tipo === tipo)
  const eliminar = async () => { try { await api(`/paquetes/${borrar.id}`, { method: 'DELETE' }); toast('Paquete eliminado'); recargar() } catch (e) { toast(e.message, 'error') } }
  return (
    <div>
      <div className="page-head">
        <div><h1>Paquetes</h1><p>{puedeEditar ? 'Armá los paquetes que ven los clientes.' : 'Elegí un paquete ya armado, o armá el tuyo en “Armar el mío”.'}</p></div>
        <div className="spacer" />
        {puedeEditar && <Btn icon={Plus} onClick={() => setEdit({})}>Nuevo paquete</Btn>}
      </div>
      <div className="filters">
        <div className="search"><UsersIcon size={16} /><input type="number" min="1" max={MAX_PERSONAS} placeholder="¿Cuánta gente entra? (filtra los paquetes)" value={capTxt} onChange={(e) => setCapTxt(e.target.value === '' ? '' : String(Math.min(MAX_PERSONAS, Math.max(1, Math.floor(Number(e.target.value))))))} /></div>
        <div className="row" style={{ gap: 8 }}>
          {['', 'Boliche', 'Festival', 'Otro'].map((t) => <button type="button" key={t} className={'chip' + (tipo === t ? ' on' : '')} onClick={() => setTipo(t)}>{t || 'Todos'}</button>)}
        </div>
      </div>
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : !lista.length ? <Vacio titulo="No hay paquetes para esa búsqueda" texto="Probá con otra cantidad." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {lista.map((p) => (
            <div key={p.id} className="card stack pkg" style={{ padding: 18, opacity: p.activo ? 1 : .55 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><b style={{ fontSize: 18 }}>{p.nombre}</b><Badge color="celeste">{p.tipo}</Badge>{!p.activo && <Badge>Oculto</Badge>}</div>
              <p className="muted" style={{ margin: 0 }}>{p.descripcion}</p>
              <div className="small muted" style={{ display: 'grid', gap: 2 }}>
                <span>👥 Para {num(p.capacidad_min)} a {num(p.capacidad_max)} personas</span>
                {p.duracion && <span>⏱ Duración: {p.duracion}</span>}
                {p.ideal_para && <span>🎯 Ideal para: {p.ideal_para}</span>}
              </div>
              <div className="precio">{$(p.precio)}</div>
              <div><b className="small">Qué incluye</b>
                <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>{((p.incluye || []).length ? p.incluye : p.servicios || []).map((s) => <li key={s} className="small" style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><Check size={14} style={{ flex: 'none', marginTop: 2 }} />{s}</li>)}</ul>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                {!puedeEditar && <Btn onClick={() => setContratar(p)}>Pedir este paquete</Btn>}
                {puedeEditar && <button className="icon-btn" onClick={() => setEdit(p)} aria-label="Editar"><Pencil size={16} /></button>}
                {esAdmin && <button className="icon-btn bad" onClick={() => setBorrar(p)} aria-label="Eliminar"><Trash2 size={16} /></button>}
              </div>
            </div>))}
        </div>
      )}
      {edit && <FormPaquete inicial={edit} onClose={() => setEdit(null)} onGuardado={() => { setEdit(null); recargar() }} />}
      {contratar && <ModalContratar p={contratar} capacidad={Number(cap) || 0} onClose={() => setContratar(null)} />}
      {borrar && <Confirmar titulo="Eliminar paquete" texto={`¿Eliminar "${borrar.nombre}"?`} confirmarLabel="Eliminar" peligro onConfirm={eliminar} onClose={() => setBorrar(null)} />}
    </div>
  )
}
