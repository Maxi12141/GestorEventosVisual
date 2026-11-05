import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, ArrowLeft, ClipboardList, Eye } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Confirmar, Spinner, Vacio, Badge, Estado, useCarga, useToast } from '../ui.jsx'
import { Chips, Telefono } from '../components.jsx'
import { ModalCliente, ModalSede, ModalProveedor } from '../formularios.jsx'
import { invalidar } from '../catalogos.js'
import { $, num, fechaCorta, hace } from '../utils.js'

// Lista genérica: buscador + tabla + alta / edición / baja
function Lista({ titulo, subtitulo, ruta, vacio, cols, Form, puedeCrear, filtros, base }) {
  const { esAdmin } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')
  const [edit, setEdit] = useState(null)
  const [borrar, setBorrar] = useState(null)
  const { data, cargando, error, recargar } = useCarga(() => api('/' + ruta), [])
  const lista = (data || []).filter((x) => (!q || JSON.stringify(Object.values(x)).toLowerCase().includes(q.toLowerCase())) && (!filtro || filtros.fn(x, filtro)))
  const eliminar = async () => { try { await api(`/${ruta}/${borrar.id}`, { method: 'DELETE' }); invalidar(ruta); toast('Eliminado'); recargar() } catch (e) { toast(e.message, 'error') } }
  const opcionesFiltro = filtros ? [['', 'Todos'], ...filtros.opciones(data || [])] : null
  return (
    <div>
      <div className="page-head"><div><h1>{titulo}</h1><p>{subtitulo}</p></div><div className="spacer" />{puedeCrear && <Btn icon={Plus} onClick={() => setEdit({})}>Agregar</Btn>}</div>
      <div className="filters"><div className="search"><Search size={16} /><input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      {opcionesFiltro && <div style={{ marginBottom: 14, overflowX: 'auto' }}><Chips value={filtro} onChange={setFiltro} opciones={opcionesFiltro} /></div>}
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : lista.length === 0 ? <Vacio titulo={vacio}>{puedeCrear && <Btn icon={Plus} onClick={() => setEdit({})}>Agregar</Btn>}</Vacio> : (
        <div className="card" style={{ padding: 6 }}><div className="tablewrap"><table>
          <thead><tr>{cols.map((c) => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}<th /></tr></thead>
          <tbody>{lista.map((x) => (
            <tr key={x.id} style={x.activo === false ? { opacity: .5 } : null} className="fila-clic" onClick={() => ir(`${base}/${x.id}`)}>
              {cols.map((c) => <td key={c.h} className={c.num ? 'num' : ''}>{c.r(x)}</td>)}
              <td onClick={(e) => e.stopPropagation()}><div className="acciones">
                {puedeCrear && <button className="icon-btn" onClick={() => setEdit(x)} aria-label="Editar"><Pencil size={16} /></button>}
                {esAdmin && <button className="icon-btn bad" onClick={() => setBorrar(x)} aria-label="Eliminar"><Trash2 size={16} /></button>}</div></td>
            </tr>))}</tbody>
        </table></div></div>
      )}
      {edit && <Form inicial={edit} onClose={() => setEdit(null)} onGuardado={() => { invalidar(ruta); setEdit(null); recargar() }} />}
      {borrar && <Confirmar titulo="Eliminar" texto={`¿Eliminar "${borrar.nombre}"? Si ya se usó en solicitudes o eventos no se va a poder: en ese caso desactivalo desde Editar.`} confirmarLabel="Eliminar" peligro onConfirm={eliminar} onClose={() => setBorrar(null)} />}
    </div>
  )
}

const Inactivo = ({ x }) => (x.activo === false ? <Badge>Inactivo</Badge> : null)
const Volver = ({ a, texto }) => <a href={'#/' + a} className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} />{texto}</a>

// ================= CLIENTES =================
function FichaCliente({ id }) {
  const { puedeEditar } = useAuth()
  const [edit, setEdit] = useState(false)
  const { data: d, cargando, error, recargar } = useCarga(() => api(`/clientes/${id}/antecedentes`), [id])
  if (cargando) return <Spinner />
  if (error) return <Vacio titulo="No se pudo abrir el cliente" texto={error.message} />
  const c = d.cliente
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Volver a="clientes" texto="Clientes" />
      <div className="hero">
        <h1>{c.boliche || c.nombre}</h1>
        <div className="muted">{c.boliche ? c.nombre : 'Cliente'} {c.activo === false && <Badge>Inactivo</Badge>}</div>
        {c.telefono !== undefined ? <div className="row"><Telefono tel={c.telefono} />{c.email && <span className="muted small">{c.email}</span>}</div> : <div className="muted small">Los datos de contacto los maneja coordinación.</div>}
        {c.notas && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.notas}</p>}
        {puedeEditar && <div className="row no-print"><Btn variant="ghost" size="sm" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn><Btn size="sm" icon={ClipboardList} onClick={() => ir(`solicitudes?nueva=1&cliente_id=${c.id}`)}>Nueva solicitud para este cliente</Btn></div>}
      </div>
      <div className="grid g2">
        <section className="card">
          <div className="card-head"><h2>Eventos</h2><span className="muted small">{d.eventos.length}</span></div>
          {d.eventos.length === 0 ? <div className="muted">Todavía no hay eventos con este cliente.</div> : <div className="lista-prox">{d.eventos.map((e) => (
            <div key={e.id} className="prox compacta" onClick={() => ir('eventos/' + e.id)}><div className="grow">
              <div className="row" style={{ gap: 8 }}><b>{e.nombre}</b><Estado tipo="evento" valor={e.estado} /></div>
              <div className="muted small">{fechaCorta(e.fecha)} · {e.sede} · {e.servicios.join(', ')}</div>
              {e.motivo_cancelacion && <div className="small neg">Cancelado: {e.motivo_cancelacion}</div>}
              {e.observaciones_cierre && <div className="small muted">“{e.observaciones_cierre}”</div>}
            </div>{e.total != null && <div className="right"><b>{$(e.total)}</b></div>}</div>))}</div>}
        </section>
        <section className="card">
          <div className="card-head"><h2>Solicitudes y propuestas</h2><span className="muted small">{d.solicitudes.length}</span></div>
          {d.solicitudes.length === 0 ? <div className="muted">Sin solicitudes.</div> : <div className="lista-prox">{d.solicitudes.map((s) => (
            <div key={s.id} className="prox compacta" onClick={() => ir('solicitudes/' + s.id)}><div className="grow">
              <div className="row" style={{ gap: 8 }}><b>{s.titulo}</b><Estado tipo="solicitud" valor={s.estado} /></div>
              <div className="muted small">{s.tipo_evento}{s.fecha_prevista ? ` · ${fechaCorta(s.fecha_prevista)}` : ''}</div>
              {s.propuestas.map((p) => <div key={p.id} className="small">Propuesta {p.estado.replace('_', ' ')}{p.total != null ? ` · ${$(p.total)}` : ''}{p.observacion_respuesta ? ` — “${p.observacion_respuesta}”` : ''}</div>)}
              {s.motivo_descarte && <div className="small muted">Descartada: {s.motivo_descarte}</div>}
            </div></div>))}</div>}
        </section>
      </div>
      {d.sedes.length > 0 && <section className="card"><div className="card-head"><h2>Sedes de este cliente</h2></div><div className="row">{d.sedes.map((s) => <a key={s.id} className="chip" href={'#/sedes/' + s.id}>{s.nombre}</a>)}</div></section>}
      {edit && <ModalCliente inicial={{ ...c }} onClose={() => setEdit(false)} onGuardado={() => { invalidar('clientes'); setEdit(false); recargar() }} />}
    </div>
  )
}
export function Clientes({ id }) {
  const { puedeEditar } = useAuth()
  if (id) return <FichaCliente id={id} />
  return <Lista titulo="Clientes" subtitulo="Dueños de boliches que te piden eventos. Tocá uno para ver todos sus antecedentes." ruta="clientes" base="clientes" vacio="Todavía no hay clientes" Form={ModalCliente} puedeCrear={puedeEditar}
    cols={[{ h: 'Cliente', r: (x) => <><b>{x.boliche || x.nombre}</b> <Inactivo x={x} /><div className="muted small">{x.boliche ? x.nombre : ''}</div></> },
      ...(puedeEditar ? [{ h: 'Contacto', r: (x) => <><Telefono tel={x.telefono} />{x.email && <div className="muted small">{x.email}</div>}</> }] : [])]} />
}

// ================= PROVEEDORES =================
function FichaProveedor({ id }) {
  const [edit, setEdit] = useState(false)
  const { data: d, cargando, error, recargar } = useCarga(() => api(`/proveedores/${id}/antecedentes`), [id])
  if (cargando) return <Spinner />
  if (error) return <Vacio titulo="No se pudo abrir el proveedor" texto={error.message} />
  const p = d.proveedor
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Volver a="proveedores" texto="Proveedores" />
      <div className="hero">
        <div className="row" style={{ gap: 8 }}><Badge color="celeste">{p.servicio}</Badge>{p.activo === false && <Badge>Inactivo</Badge>}</div>
        <h1>{p.nombre}</h1>
        <div className="row"><span className="muted">{p.contacto || 'Sin persona de contacto'}</span><Telefono tel={p.telefono} />{p.email && <span className="muted small">{p.email}</span>}</div>
        {p.notas && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{p.notas}</p>}
        <div className="row no-print"><Btn variant="ghost" size="sm" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn><Btn variant="ghost" size="sm" icon={Eye} onClick={() => ir('eventos?proveedor_id=' + p.id + '&estado=todos')}>Ver sus eventos</Btn></div>
      </div>
      <div className="grid g2">
        <section className="card"><div className="card-head"><h2>Eventos en los que participa</h2><span className="muted small">{d.eventos.length}</span></div>
          {d.eventos.length === 0 ? <div className="muted">Todavía no participó en eventos.</div> : <div className="lista-prox">{d.eventos.map((x) => (
            <div key={x.servicio_id} className="prox compacta" onClick={() => ir('eventos/' + x.evento.id)}><div className="grow"><b>{x.evento.nombre}</b> <Estado tipo="evento" valor={x.evento.estado} />
              <div className="muted small">{x.servicio} · {fechaCorta(x.evento.fecha)} · {x.evento.sede}</div></div><div className="right"><Estado tipo="participacion" valor={x.participacion} />{x.importe_proveedor != null && <div className="small muted">{$(x.importe_proveedor)}</div>}</div></div>))}</div>}
        </section>
        <section className="card"><div className="card-head"><h2>Observaciones de eventos anteriores</h2></div>
          {d.observaciones.length === 0 ? <div className="muted">Sin observaciones. Se cargan desde cada evento, en “Cierre y observaciones”.</div> : <div className="lista-prox">{d.observaciones.map((o) => (
            <div key={o.id} className="prox compacta"><div className="grow"><div style={{ whiteSpace: 'pre-wrap' }}>{o.texto}</div><div className="muted small">{o.encargos?.nombre} · {o.registrado_por_nombre} · {hace(o.created_at)}</div></div></div>))}</div>}
        </section>
      </div>
      {edit && <ModalProveedor inicial={{ ...p }} onClose={() => setEdit(false)} onGuardado={() => { invalidar('proveedores'); setEdit(false); recargar() }} />}
    </div>
  )
}
export function Proveedores({ id }) {
  if (id) return <FichaProveedor id={id} />
  return <Lista titulo="Proveedores" subtitulo="DJs, sonido, iluminación, barras y todo el que presta un servicio." ruta="proveedores" base="proveedores" vacio="Todavía no hay proveedores" Form={ModalProveedor} puedeCrear
    filtros={{ opciones: (d) => [...new Set(d.map((x) => x.servicio))].sort().map((s) => [s, s]), fn: (x, f) => x.servicio === f }}
    cols={[{ h: 'Proveedor', r: (x) => <><b>{x.nombre}</b> <Inactivo x={x} /><div className="muted small">{x.contacto}</div></> }, { h: 'Servicio', r: (x) => <Badge color="celeste">{x.servicio}</Badge> }, { h: 'Teléfono', r: (x) => <Telefono tel={x.telefono} /> }]} />
}

// ================= SEDES =================
function FichaSede({ id }) {
  const { puedeEditar } = useAuth()
  const [edit, setEdit] = useState(false)
  const { data: d, cargando, error, recargar } = useCarga(() => api(`/sedes/${id}/antecedentes`), [id])
  if (cargando) return <Spinner />
  if (error) return <Vacio titulo="No se pudo abrir la sede" texto={error.message} />
  const s = d.sede
  return (
    <div className="stack" style={{ gap: 18 }}>
      <Volver a="sedes" texto="Sedes" />
      <div className="hero">
        <h1>{s.nombre} {s.activo === false && <Badge>Inactiva</Badge>}</h1>
        <div className="muted">{[s.direccion, s.ciudad, s.provincia].filter(Boolean).join(', ') || 'Sin dirección cargada'}{s.capacidad ? ` · capacidad ${num(s.capacidad)} personas` : ''}</div>
        {s.clientes && <div className="small">Cliente: <a href={'#/clientes/' + s.clientes.id}>{s.clientes.boliche || s.clientes.nombre}</a></div>}
        {s.notas && <p className="muted" style={{ margin: 0 }}>{s.notas}</p>}
        {puedeEditar && <div className="row no-print"><Btn variant="ghost" size="sm" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn></div>}
      </div>
      <section className="card"><div className="card-head"><h2>Eventos en esta sede</h2><span className="muted small">{d.eventos.length}</span></div>
        {d.eventos.length === 0 ? <div className="muted">Todavía no hay eventos acá.</div> : <div className="lista-prox">{d.eventos.map((e) => <div key={e.id} className="prox compacta" onClick={() => ir('eventos/' + e.id)}><div className="grow"><b>{e.nombre}</b> <Estado tipo="evento" valor={e.estado} /><div className="muted small">{fechaCorta(e.fecha)} · {e.tipo_evento}</div></div></div>)}</div>}
      </section>
      {edit && <ModalSede inicial={{ ...s, clientes: undefined }} onClose={() => setEdit(false)} onGuardado={() => { invalidar('sedes'); setEdit(false); recargar() }} />}
    </div>
  )
}
export function Sedes({ id }) {
  const { puedeEditar } = useAuth()
  if (id) return <FichaSede id={id} />
  return <Lista titulo="Sedes" subtitulo="Los boliches y lugares donde se hacen los eventos." ruta="sedes" base="sedes" vacio="Todavía no hay sedes" Form={ModalSede} puedeCrear={puedeEditar}
    cols={[{ h: 'Sede', r: (x) => <><b>{x.nombre}</b> <Inactivo x={x} /><div className="muted small">{x.direccion}</div></> }, { h: 'Ciudad', r: (x) => <>{x.ciudad}<div className="muted small">{x.provincia}</div></> }, { h: 'Capacidad', num: true, r: (x) => (x.capacidad ? num(x.capacidad) : '—') }]} />
}
