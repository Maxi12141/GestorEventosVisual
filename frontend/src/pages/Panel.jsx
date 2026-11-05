import { Bell, ListChecks, AlertTriangle, PartyPopper, Handshake, ClipboardList, Send, GitCompare, Siren, PhoneOff, Eye, CheckCircle2, Plus } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Spinner, Vacio, Badge, Estado, useCarga } from '../ui.jsx'
import { EventoFila, Cuando, FeriadoChips } from '../components.jsx'
import { fechaLarga, cap1, fechaMini, $ } from '../utils.js'

function Seccion({ titulo, icon: Icon, n, vacio, link, children, tono }) {
  return (
    <section className={'card seccion ' + (tono === 'alerta' ? 'peligro' : '')}>
      <div className="card-head"><Icon size={18} /><h2>{titulo}</h2>{n > 0 && <Badge color={tono === 'alerta' ? 'rojo' : 'celeste'}>{n}</Badge>}<div className="spacer" />{link && <a href={link} className="small">Ver todos</a>}</div>
      {n > 0 ? children : <div className="ok-vacio"><CheckCircle2 size={18} />{vacio}</div>}
    </section>
  )
}
const Fila = ({ onClick, children, der }) => (
  <div className="prox compacta" role="button" tabIndex={0} onClick={onClick} onKeyDown={(k) => k.key === 'Enter' && onClick()}><div className="grow">{children}</div>{der && <div className="right small nowrap">{der}</div>}</div>
)

export default function Panel({ nuevos }) {
  const { usuario, puedeEditar } = useAuth()
  const { data: d, cargando, error } = useCarga(() => api('/panel'), [])
  if (cargando) return <Spinner texto="Armando tu panel…" />
  if (error) return <Vacio icon={AlertTriangle} titulo="No se pudo cargar el panel" texto={error.message} />
  const k = d.kpis
  const tile = (n, label, href, tono) => (
    <a className={'tile ' + (n > 0 && tono ? tono : '')} href={href}><b>{n}</b><span>{label}</span></a>
  )
  const todoAlDia = !k.por_cerrar && !k.tareas_vencidas && !k.servicios_sin_confirmar && !k.cambios_pendientes && !k.propuestas_sin_respuesta

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Hola, {(usuario.nombre || '').split(' ')[0] || 'bienvenido'} 👋</h1>
          <p>{cap1(fechaLarga(d.hoy))} <span style={{ marginLeft: 8 }}><FeriadoChips fecha={d.hoy} /></span></p>
        </div>
        <div className="spacer" />
        {puedeEditar && <Btn variant="sol" icon={Plus} onClick={() => ir('solicitudes?nueva=1')}>Nueva solicitud</Btn>}
      </div>

      {puedeEditar && nuevos?.n > 0 && (
        <div className="alerta-nuevos">
          <Bell size={22} />
          <div className="grow"><b>{nuevos.n === 1 ? 'Tenés 1 pedido nuevo de un cliente' : `Tenés ${nuevos.n} pedidos nuevos de clientes`}</b>
            <div className="muted small">{nuevos.ult ? `El último: ${nuevos.ult.titulo}` : ''}</div></div>
          <a className="btn primary" href="#/solicitudes">Ver pedidos</a>
        </div>
      )}

      <div className="tiles">
        {tile(k.proximos_30d, 'eventos en los próximos 30 días', '#/eventos?estado=abiertos')}
        {tile(k.servicios_sin_confirmar, 'servicios sin confirmar', '#/eventos?sin_confirmar=1', 'warn')}
        {tile(k.tareas_vencidas, 'tareas vencidas', '#/tareas?vencidas=1', 'rojo')}
        {tile(k.por_cerrar, 'eventos para cerrar', '#/eventos?por_cerrar=1', 'rojo')}
        {puedeEditar && tile(k.solicitudes_abiertas, 'solicitudes abiertas', '#/solicitudes?estado=abiertas')}
        {puedeEditar && tile(k.propuestas_sin_respuesta, 'propuestas sin respuesta', '#/solicitudes?sin_respuesta=1', 'warn')}
      </div>

      {todoAlDia && <div className="alerta" style={{ background: 'rgba(62,207,142,.1)', border: '1px solid rgba(62,207,142,.3)', color: '#a8efce' }}><CheckCircle2 size={16} />Estás al día: no hay nada vencido ni sin responder.</div>}

      {d.por_cerrar.length > 0 && (
        <Seccion titulo="Eventos que ya pasaron y siguen abiertos" icon={AlertTriangle} n={d.por_cerrar.length} tono="alerta">
          <div className="lista-prox">{d.por_cerrar.map((e) => <EventoFila key={e.id} e={e} hoy={d.hoy} />)}</div>
          <p className="muted small" style={{ marginBottom: 0 }}>Entrá a cada uno y registrá si se realizó o se canceló, así no queda como pendiente.</p>
        </Seccion>
      )}

      <div className="grid g2">
        <Seccion titulo="Mis tareas" icon={ListChecks} n={d.mis_tareas.length} vacio="No tenés tareas pendientes" link="#/tareas?responsable_id=yo&estado=abiertas">
          {d.mis_tareas.map((t) => (
            <Fila key={t.id} onClick={() => ir('eventos/' + t.evento.id + '?tab=tareas')} der={t.fecha_prevista ? <span className={t.vencida ? 'neg' : 'muted'}>{t.vencida ? 'Venció ' : ''}{fechaMini(t.fecha_prevista)}</span> : null}>
              <b>{t.titulo}</b><div className="muted small">{t.evento.nombre}</div>
            </Fila>
          ))}
        </Seccion>
        <Seccion titulo="Tareas vencidas del equipo" icon={AlertTriangle} n={d.tareas_vencidas.length} vacio="No hay tareas vencidas" link="#/tareas?vencidas=1">
          {d.tareas_vencidas.map((t) => (
            <Fila key={t.id} onClick={() => ir('eventos/' + t.evento.id + '?tab=tareas')} der={<span className="neg">{fechaMini(t.fecha_prevista)}</span>}>
              <b>{t.titulo}</b><div className="muted small">{t.evento.nombre} · {t.responsable || 'sin responsable'}</div>
            </Fila>
          ))}
        </Seccion>
      </div>

      <div className="grid g2">
        <Seccion titulo="Servicios sin confirmar" icon={Handshake} n={d.servicios_sin_confirmar.length} vacio="Todos los servicios próximos están confirmados" link="#/eventos?sin_confirmar=1">
          {d.servicios_sin_confirmar.map((s) => (
            <Fila key={s.id} onClick={() => ir('eventos/' + s.evento.id + '?tab=servicios')} der={<Cuando fecha={s.evento.fecha} hoy={d.hoy} />}>
              <div className="row" style={{ gap: 8 }}><b>{s.servicio}</b><Estado tipo="participacion" valor={s.participacion} /></div>
              <div className="muted small">{s.evento.nombre} · {s.proveedor || 'falta elegir proveedor'}</div>
            </Fila>
          ))}
        </Seccion>
        <Seccion titulo="Próximos eventos" icon={PartyPopper} n={d.proximos.length} vacio="No hay eventos próximos" link="#/eventos?estado=abiertos">
          <div className="lista-prox">{d.proximos.map((e) => <EventoFila key={e.id} e={e} hoy={d.hoy} />)}</div>
        </Seccion>
      </div>

      {puedeEditar && (
        <div className="grid g2">
          <Seccion titulo="Solicitudes por atender" icon={ClipboardList} n={d.solicitudes.length} vacio="No hay solicitudes esperando propuesta" link="#/solicitudes?estado=abiertas">
            {d.solicitudes.map((s) => (
              <Fila key={s.id} onClick={() => ir('solicitudes/' + s.id)} der={<span className="muted">hace {s.dias} día{s.dias === 1 ? '' : 's'}</span>}>
                <div className="row" style={{ gap: 8 }}><b>{s.titulo}</b><Estado tipo="solicitud" valor={s.estado} /></div>
                <div className="muted small">{s.cliente?.boliche || s.cliente?.nombre}{s.fecha_prevista ? ` · ${fechaMini(s.fecha_prevista)}` : ' · sin fecha'}</div>
              </Fila>
            ))}
          </Seccion>
          <Seccion titulo="Propuestas esperando respuesta" icon={Send} n={d.propuestas_sin_respuesta.length} vacio="Todas las propuestas tienen respuesta" link="#/solicitudes?sin_respuesta=1">
            {d.propuestas_sin_respuesta.map((s) => (
              <Fila key={s.id} onClick={() => ir('solicitudes/' + s.id)} der={<span className={s.propuesta.dias_esperando >= 5 ? 'sol' : 'muted'}>{s.propuesta.dias_esperando === 0 ? 'hoy' : `hace ${s.propuesta.dias_esperando} días`}</span>}>
                <b>{s.titulo}</b><div className="muted small">{s.cliente?.boliche || s.cliente?.nombre}{s.propuesta.total != null ? ` · ${$(s.propuesta.total)}` : ''}</div>
              </Fila>
            ))}
          </Seccion>
        </div>
      )}

      {(d.cambios_pendientes.length > 0 || d.para_revisar.length > 0 || d.incidentes_pendientes.length > 0 || d.avisos_cancelacion.length > 0) && (
        <div className="grid g2">
          {d.cambios_pendientes.length > 0 && (
            <Seccion titulo="Cambios esperando al cliente" icon={GitCompare} n={d.cambios_pendientes.length}>
              {d.cambios_pendientes.map((c) => <Fila key={c.id} onClick={() => ir('eventos/' + c.evento.id + '?tab=cambios')}><b>{c.evento.nombre}</b><div className="muted small">{c.descripcion}</div></Fila>)}
              <p className="muted small" style={{ marginBottom: 0 }}>Hasta que el cliente confirme, sigue vigente lo acordado antes.</p>
            </Seccion>
          )}
          {d.para_revisar.length > 0 && (
            <Seccion titulo="Compromisos para revisar" icon={Eye} n={d.para_revisar.length}>
              {d.para_revisar.map((e) => <Fila key={e.id} onClick={() => ir('eventos/' + e.id)}><b>{e.nombre}</b><div className="muted small">{e.resumen.para_revisar} elemento(s) afectados por un cambio</div></Fila>)}
            </Seccion>
          )}
          {d.incidentes_pendientes.length > 0 && (
            <Seccion titulo="Incidentes con algo pendiente" icon={Siren} n={d.incidentes_pendientes.length}>
              {d.incidentes_pendientes.map((i) => <Fila key={i.id} onClick={() => ir('eventos/' + i.evento.id + '?tab=durante')}><b>{i.evento.nombre}</b><div className="muted small">{i.descripcion} → <span className="sol">{i.pendiente}</span></div></Fila>)}
            </Seccion>
          )}
          {d.avisos_cancelacion.length > 0 && (
            <Seccion titulo="Proveedores a avisar por cancelación" icon={PhoneOff} n={d.avisos_cancelacion.length} tono="alerta">
              {d.avisos_cancelacion.map((e) => <Fila key={e.id} onClick={() => ir('eventos/' + e.id + '?tab=servicios')}><b>{e.nombre}</b><div className="muted small">{e.pendientes.join(' · ')}</div></Fila>)}
            </Seccion>
          )}
        </div>
      )}
    </div>
  )
}
