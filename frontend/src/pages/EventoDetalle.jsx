import { useState } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2, Copy, Printer, Users, GitCompare, Check, Ban, RotateCcw, Siren, AlertTriangle, MapPin, CalendarDays, Clock, UserRound, Eye, Phone, Send, MessageSquarePlus } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { ir } from '../router.js'
import { Btn, Field, Spinner, Vacio, Estado, Badge, Modal, NumInput, Confirmar, useCarga, useToast } from '../ui.jsx'
import { SelectCatalogo, ProximoPaso, Timeline, Telefono, FeriadoChips, Cuando } from '../components.jsx'
import { ReasignarModal, ServicioModal, TareaModal, CambioModal, IncidenteModal, CerrarModal, CancelarModal, MotivoModal, CorregirCierreModal, Dlg } from './EventoModales.jsx'
import { $, cap1, fechaLarga, fechaCorta, fechaMini, fechaHora, hace, hora, hoyAR, copiar, TIPOS_EVENTO, CAMPOS_CAMBIO, ESTADOS } from '../utils.js'

const TABS = [['resumen', 'Resumen'], ['servicios', 'Servicios y proveedores'], ['tareas', 'Tareas'], ['cambios', 'Cambios'], ['durante', 'Durante el evento'], ['cierre', 'Cierre y observaciones'], ['historial', 'Historial']]

const fmtVal = (c, v) => (!v ? '—' : c.campo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? cap1(fechaLarga(v)) : v)

function textoWhatsApp(D, hoy) {
  const { encargo: e, sede, cliente, servicios, resumen: r } = D
  const L = [`*${e.nombre}* (${e.tipo_evento})`, `📅 ${cap1(fechaLarga(e.fecha))}${e.hora_inicio ? ` · ${hora(e.hora_inicio)} hs` : ''}`, `📍 ${sede.nombre}${sede.ciudad ? ` (${sede.ciudad})` : ''}`,
    `👤 ${cliente.boliche ? cliente.boliche + ' — ' : ''}${cliente.nombre}`, `Estado: ${ESTADOS.evento[e.estado][0]}`, `Coordina: ${e.responsable || '—'}${e.responsable_evento ? ` · Durante el evento: ${e.responsable_evento}` : ''}`, '', '*Servicios*']
  for (const s of servicios.filter((x) => x.activo)) L.push(`• ${s.servicio}${s.proveedor ? ` — ${s.proveedor.nombre}` : ''}: ${{ confirmada: '✅ confirmado', pendiente: '⏳ sin respuesta', disponibilidad_informada: '🟡 dijo que está disponible (falta confirmar)', rechazada: '❌ no participa' }[s.participacion]}`)
  if (e.condiciones) L.push('', `*Condiciones:* ${e.condiciones}`)
  const pend = []
  if (r.servicios_sin_confirmar) pend.push(`${r.servicios_sin_confirmar} servicio(s) sin confirmar`)
  if (r.tareas_abiertas) pend.push(`${r.tareas_abiertas} tarea(s) abiertas${r.tareas_vencidas ? ` (${r.tareas_vencidas} vencidas)` : ''}`)
  if (r.cambios_pendientes) pend.push('un cambio esperando al cliente')
  if (pend.length) L.push('', `⚠️ Pendiente: ${pend.join(', ')}`)
  return L.join('\n')
}

export default function EventoDetalle({ id, tab: tabInicial }) {
  const { puedeEditar, usuario } = useAuth()
  const toast = useToast()
  const hoy = hoyAR()
  const [tab, setTab] = useState(TABS.some((t) => t[0] === tabInicial) ? tabInicial : 'resumen')
  const [dlg, setDlg] = useState(null)
  const { data: D, cargando, error, recargar } = useCarga(() => api('/encargos/' + id), [id])
  if (cargando) return <Spinner />
  if (error) return <Vacio icon={AlertTriangle} titulo="No se pudo abrir el evento" texto={error.message}><Btn variant="ghost" onClick={() => ir('eventos')}>Volver</Btn></Vacio>

  const { encargo: e, cliente, sede, solicitud, servicios, tareas, cambios, incidentes, observaciones, historial, resumen: r, permisos: P } = D
  const abierto = e.estado === 'confirmado' || e.estado === 'en_preparacion'
  const hecho = () => { setDlg(null); recargar() }
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); recargar() } catch (err) { toast(err.message, 'error') } }
  const activos = servicios.filter((s) => s.activo)
  const abiertas = tareas.filter((t) => ['pendiente', 'en_curso'].includes(t.estado))

  // ---- Qué sigue ----
  let paso
  if (e.estado === 'cancelado') paso = r.avisos_pendientes > 0
    ? <ProximoPaso tono="alerta" acciones={<Btn size="sm" onClick={() => setTab('servicios')}>Ver proveedores a avisar</Btn>}>El evento está cancelado. Falta avisar a {r.avisos_pendientes} proveedor(es).</ProximoPaso>
    : <ProximoPaso tono="ok">El evento está cancelado y no quedan avisos pendientes. Todo lo cargado se conserva como antecedente.</ProximoPaso>
  else if (e.estado === 'realizado') paso = r.incidentes_pendientes > 0
    ? <ProximoPaso tono="alerta" acciones={<Btn size="sm" onClick={() => setTab('durante')}>Ver incidentes</Btn>}>El evento se realizó, pero hay {r.incidentes_pendientes} incidente(s) con algo pendiente.</ProximoPaso>
    : <ProximoPaso tono="ok" acciones={<Btn size="sm" variant="ghost" onClick={() => setTab('cierre')}>Cargar observaciones</Btn>}>El evento se realizó. Dejá anotado qué funcionó y qué mejorar con cada proveedor.</ProximoPaso>
  else if (r.por_cerrar) paso = <ProximoPaso tono="alerta" acciones={P.cerrar && <><Btn size="sm" icon={Check} onClick={() => setDlg('cerrar')}>Se realizó</Btn>{P.cancelar && <Btn size="sm" variant="danger" onClick={() => setDlg('cancelar')}>Se canceló</Btn>}</>}>La fecha ya pasó y el evento figura abierto. Registrá si se realizó o se canceló.</ProximoPaso>
  else if (r.cambios_pendientes > 0) paso = <ProximoPaso tono="alerta" acciones={<Btn size="sm" onClick={() => setTab('cambios')}>Ver cambio</Btn>}>Hay un cambio esperando la conformidad del cliente. Hasta que confirme, sigue vigente lo acordado antes.</ProximoPaso>
  else if (r.para_revisar > 0) paso = <ProximoPaso tono="alerta" acciones={<Btn size="sm" onClick={() => setTab('servicios')}>Revisar</Btn>}>Un cambio afectó {r.para_revisar} compromiso(s): hay que revisar con los proveedores que siguen disponibles y que los plazos de las tareas sigan siendo posibles.</ProximoPaso>
  else if (r.servicios_sin_proveedor > 0) paso = <ProximoPaso acciones={<Btn size="sm" onClick={() => setTab('servicios')}>Elegir proveedores</Btn>}>Falta elegir proveedor para {r.servicios_sin_proveedor} servicio(s).</ProximoPaso>
  else if (r.servicios_sin_confirmar > 0) paso = <ProximoPaso acciones={<Btn size="sm" onClick={() => setTab('servicios')}>Ver servicios</Btn>}>Faltan confirmar {r.servicios_sin_confirmar} servicio(s) con sus proveedores.{r.dias_para_evento >= 0 ? ` El evento es ${r.dias_para_evento === 0 ? 'hoy' : r.dias_para_evento === 1 ? 'mañana' : `en ${r.dias_para_evento} días`}.` : ''}</ProximoPaso>
  else if (r.tareas_vencidas > 0) paso = <ProximoPaso tono="alerta" acciones={<Btn size="sm" onClick={() => setTab('tareas')}>Ver tareas</Btn>}>Hay {r.tareas_vencidas} tarea(s) vencida(s).</ProximoPaso>
  else paso = <ProximoPaso tono="ok">Todo en orden: los servicios están confirmados y no hay tareas vencidas. {abiertas.length ? `Quedan ${abiertas.length} tarea(s) abiertas.` : ''}</ProximoPaso>

  const badge = (n) => (n > 0 ? <b className="tab-n">{n}</b> : null)
  const conteo = { servicios: r.servicios_sin_confirmar + r.para_revisar, tareas: abiertas.length, cambios: r.cambios_pendientes, durante: incidentes.length }

  // ---------- Panel: resumen ----------
  const Resumen = (
    <div className="grid g-main">
      <div className="stack">
        <section className="card">
          <div className="card-head"><h2>Lo que se acordó</h2><div className="spacer" />{P.coordinar && abierto && <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setDlg('datos')}>Editar datos</Btn>}</div>
          <table className="resumen-tabla"><tbody>
            <tr><td>Aceptación</td><td>El cliente aceptó el {fechaCorta(e.fecha_aceptacion)}{e.medio_aceptacion ? ` por ${e.medio_aceptacion}` : ''}<div className="muted small">Lo registró {e.aceptacion_registrada_por_nombre || '—'}</div></td></tr>
            <tr><td>Fecha</td><td>{cap1(fechaLarga(e.fecha))} <FeriadoChips fecha={e.fecha} /></td></tr>
            <tr><td>Horario</td><td>{e.hora_inicio ? `${hora(e.hora_inicio)}${e.hora_fin ? ' a ' + hora(e.hora_fin) : ''} hs` : <span className="muted">Sin definir</span>}</td></tr>
            <tr><td>Sede</td><td><a href={'#/sedes/' + sede.id}>{sede.nombre}</a>{sede.direccion ? ` · ${sede.direccion}` : ''}{sede.ciudad ? `, ${sede.ciudad}` : ''}</td></tr>
            <tr><td>Asistentes estimados</td><td>{e.asistentes_estimados ?? <span className="muted">Sin definir</span>}</td></tr>
            <tr><td>Condiciones</td><td style={{ whiteSpace: 'pre-wrap' }}>{e.condiciones || <span className="muted">Sin condiciones cargadas</span>}</td></tr>
            {r.total != null && <tr><td>Total acordado</td><td><b>{$(r.total)}</b> <span className="muted small">(suma de los servicios vigentes)</span></td></tr>}
            {solicitud?.necesidades && <tr><td>Pedido original</td><td style={{ whiteSpace: 'pre-wrap' }}>{solicitud.necesidades}</td></tr>}
          </tbody></table>
          <div className="row small" style={{ marginTop: 10 }}><a href={'#/solicitudes/' + e.solicitud_id}>Ver la solicitud y la propuesta original →</a></div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Servicios</h2><div className="spacer" /><Btn size="sm" variant="ghost" onClick={() => setTab('servicios')}>Ver detalle</Btn></div>
          <div className="tablewrap"><table><tbody>
            {activos.map((s) => <tr key={s.id}><td><b>{s.servicio}</b></td><td>{s.proveedor?.nombre || <span className="muted">Sin proveedor</span>}</td><td><Estado tipo="participacion" valor={s.participacion} />{s.revisar && <> <Badge color="violeta">Revisar</Badge></>}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>
      <div className="stack">
        <section className="card flat">
          <div className="card-head"><h2>Pendientes</h2></div>
          <ul className="pendientes">
            {r.servicios_sin_confirmar > 0 && <li><button onClick={() => setTab('servicios')}><b>{r.servicios_sin_confirmar}</b> servicio(s) sin confirmar: {activos.filter((s) => ['pendiente', 'disponibilidad_informada'].includes(s.participacion)).map((s) => s.servicio).join(', ')}</button></li>}
            {r.servicios_sin_proveedor > 0 && <li><button onClick={() => setTab('servicios')}><b>{r.servicios_sin_proveedor}</b> servicio(s) sin proveedor elegido</button></li>}
            {abiertas.length > 0 && <li><button onClick={() => setTab('tareas')}><b>{abiertas.length}</b> tarea(s) abiertas{r.tareas_vencidas ? ` (${r.tareas_vencidas} vencidas)` : ''}</button></li>}
            {r.cambios_pendientes > 0 && <li><button onClick={() => setTab('cambios')}><b>{r.cambios_pendientes}</b> cambio(s) esperando al cliente</button></li>}
            {r.para_revisar > 0 && <li><button onClick={() => setTab('servicios')}><b>{r.para_revisar}</b> compromiso(s) para revisar</button></li>}
            {r.incidentes_pendientes > 0 && <li><button onClick={() => setTab('durante')}><b>{r.incidentes_pendientes}</b> incidente(s) con algo pendiente</button></li>}
            {r.avisos_pendientes > 0 && <li><button onClick={() => setTab('servicios')}><b>{r.avisos_pendientes}</b> proveedor(es) a avisar de la cancelación</button></li>}
            {!r.servicios_sin_confirmar && !r.servicios_sin_proveedor && !abiertas.length && !r.cambios_pendientes && !r.para_revisar && !r.incidentes_pendientes && !r.avisos_pendientes && <li className="muted">Nada pendiente 🎉</li>}
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2>Cliente</h2></div>
          <b><a href={'#/clientes/' + cliente.id}>{cliente.nombre}</a></b>{cliente.boliche && <div className="muted">{cliente.boliche}</div>}
          {P.ver_contacto_cliente ? <div style={{ marginTop: 8 }}><Telefono tel={cliente.telefono} />{cliente.email && <div className="small muted">{cliente.email}</div>}</div> : <div className="muted small" style={{ marginTop: 8 }}>Los datos de contacto del cliente los maneja coordinación.</div>}
        </section>
        <section className="card">
          <div className="card-head"><h2>Responsables</h2><div className="spacer" />{P.coordinar && abierto && <Btn size="sm" variant="ghost" onClick={() => setDlg('reasignar')}>Cambiar</Btn>}</div>
          <div className="small muted">Coordina el evento</div><b>{e.responsable || 'Sin asignar'}</b>
          <div className="small muted" style={{ marginTop: 8 }}>Durante el evento</div><b>{e.responsable_evento || 'Sin asignar'}</b>
        </section>
      </div>
    </div>
  )

  // ---------- Panel: servicios ----------
  const Servicios = (
    <div className="stack">
      <section className="card">
        <div className="tablewrap"><table>
          <thead><tr><th>Servicio</th><th>Proveedor</th><th>Respuesta</th>{P.ver_importes && <th className="num">Importe acordado con el cliente</th>}<th className="num">Importe del proveedor</th><th /></tr></thead>
          <tbody>
            {activos.map((s) => (
              <tr key={s.id}>
                <td><b>{s.servicio}</b>{s.descripcion && <div className="muted small">{s.descripcion}</div>}
                  {s.revisar && <div className="small" style={{ marginTop: 4 }}><Badge color="violeta" icon={Eye}>Para revisar</Badge> <span className="muted">{s.revisar_motivo}</span></div>}</td>
                <td>{s.proveedor ? <><a href={'#/proveedores/' + s.proveedor.id}>{s.proveedor.nombre}</a><div><Telefono tel={s.proveedor.telefono} /></div></> : <span className="muted">Sin elegir</span>}</td>
                <td><Estado tipo="participacion" valor={s.participacion} />{s.participacion_nota && <div className="muted small" style={{ maxWidth: 240 }}>{s.participacion_nota}</div>}
                  {s.actualizado_por && <div className="muted small">{s.actualizado_por} · {hace(s.participacion_actualizada_en)}</div>}</td>
                {P.ver_importes && <td className="num">{$(s.importe)}{!s.importe_confirmado && <div><Badge color="warn">Estimado</Badge></div>}</td>}
                <td className="num">{s.importe_proveedor != null ? $(s.importe_proveedor) : <span className="muted">—</span>}</td>
                <td>{e.estado === 'cancelado' ? (s.aviso_cancelacion === 'pendiente' ? <Btn size="sm" icon={Phone} onClick={() => run(() => api('/servicios/' + s.id, { method: 'PATCH', body: { aviso_cancelacion: 'avisado' } }), 'Registrado: proveedor avisado')}>Ya le avisé</Btn> : s.aviso_cancelacion === 'avisado' ? <Badge color="verde">Avisado por {s.aviso_por}</Badge> : null)
                  : abierto && <Btn size="sm" variant="ghost" onClick={() => setDlg({ servicio: s })}>Actualizar</Btn>}</td>
              </tr>
            ))}
            {P.ver_importes && activos.length > 0 && <tr className="total"><td colSpan={3}>Total acordado con el cliente</td><td className="num">{$(r.total)}</td><td colSpan={2} /></tr>}
          </tbody>
        </table></div>
        {e.estado === 'cancelado' && r.avisos_pendientes > 0 && <div className="alerta aviso" style={{ marginTop: 12 }}><AlertTriangle size={15} />Avisá a los proveedores que figuran con aviso pendiente y marcalo con “Ya le avisé”.</div>}
      </section>
      {servicios.some((s) => !s.activo) && (
        <details className="card flat"><summary className="muted small" style={{ cursor: 'pointer' }}>Servicios quitados por un cambio ({servicios.filter((s) => !s.activo).length})</summary>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>{servicios.filter((s) => !s.activo).map((s) => <li key={s.id}><s>{s.servicio}</s>{s.proveedor ? ` · ${s.proveedor.nombre}` : ''}</li>)}</ul></details>
      )}
      <div className="helper"><span>Para agregar, quitar o cambiar un servicio, o modificar un importe, usá <b>Registrar un cambio</b>: así queda constancia de qué se acordó antes y qué cambió.</span></div>
    </div>
  )

  // ---------- Panel: tareas ----------
  const Tareas = <TareasPanel tareas={tareas} abierto={abierto} P={P} onNueva={() => setDlg('tarea')} onEditar={(t) => setDlg({ tarea: t })} run={run} yo={usuario.id} puedeEditar={puedeEditar} />

  // ---------- Panel: cambios ----------
  const Cambios = (
    <div className="stack">
      <div className="row">
        <p className="muted" style={{ margin: 0, maxWidth: 640 }}>Acá queda cada cambio relevante: qué se acordó antes, qué cambió, quién lo registró y qué hay que revisar. Un cambio que altera lo aceptado <b>no se aplica hasta que el cliente dé su conformidad</b>.</p>
        <div className="spacer" />
        {P.coordinar && abierto && <Btn icon={GitCompare} onClick={() => setDlg('cambio')}>Registrar un cambio</Btn>}
      </div>
      {cambios.length === 0 ? <Vacio icon={GitCompare} titulo="Todavía no hubo cambios" texto="Si el cliente pide mover la fecha, cambiar de sede o modificar servicios, registralo acá." /> :
        cambios.map((c) => (
          <section key={c.id} className={'card cambio ' + c.estado}>
            <div className="row" style={{ gap: 8 }}><Badge color="celeste">{CAMPOS_CAMBIO[c.campo]}</Badge><Estado tipo="cambio" valor={c.estado} /><div className="spacer" />
              <button className="icon-btn" title="Copiar aviso para WhatsApp" onClick={async () => { await copiar(`Cambio en *${e.nombre}*: ${c.descripcion}${c.valor_anterior ? `\nAntes: ${fmtVal(c, c.valor_anterior)}` : ''}${c.valor_nuevo ? `\nAhora: ${fmtVal(c, c.valor_nuevo)}` : ''}${c.estado === 'pendiente_conformidad' ? '\n(Todavía no confirmado por el cliente: sigue vigente lo anterior)' : ''}`); toast('Aviso copiado: pegalo en WhatsApp') }}><Copy size={16} /></button></div>
            <p style={{ margin: '8px 0' }}>{c.descripcion}</p>
            {(c.valor_anterior || c.valor_nuevo) && <div className="antes-ahora"><div><span>Antes</span>{fmtVal(c, c.valor_anterior)}</div><div><span>{c.estado === 'vigente' ? 'Ahora' : 'Propuesto'}</span>{fmtVal(c, c.valor_nuevo)}</div></div>}
            <div className="muted small">Registrado por {c.registrado_por_nombre || '—'} · {fechaHora(c.registrado_en)}{c.resuelto_en ? ` · resuelto por ${c.resuelto_por_nombre || '—'} el ${fechaHora(c.resuelto_en)}` : ''}</div>
            {c.compromisos_a_revisar && <div className="small sol" style={{ marginTop: 4 }}>A revisar: {c.compromisos_a_revisar}</div>}
            {c.estado === 'pendiente_conformidad' && P.coordinar && abierto && (
              <div className="row" style={{ marginTop: 10 }}>
                <Btn size="sm" icon={Check} onClick={() => run(() => api(`/cambios/${c.id}/resolver`, { method: 'POST', body: { resultado: 'conforme' } }), 'Cambio aplicado')}>El cliente dio su conformidad</Btn>
                <Btn size="sm" variant="danger" onClick={() => run(() => api(`/cambios/${c.id}/resolver`, { method: 'POST', body: { resultado: 'rechazado' } }), 'Registrado: el cliente no aceptó el cambio')}>El cliente no lo aceptó</Btn>
              </div>)}
          </section>))}
    </div>
  )

  // ---------- Panel: durante el evento ----------
  const Durante = (
    <div className="stack">
      <div className="row"><p className="muted" style={{ margin: 0, maxWidth: 620 }}>Anotá lo que pase durante la noche: qué ocurrió, cuándo, qué se hizo y si quedó algo pendiente. Se puede cargar también después del evento.</p><div className="spacer" />
        <Btn icon={Siren} onClick={() => setDlg('incidente')}>Registrar incidente</Btn></div>
      {incidentes.length === 0 ? <Vacio icon={Siren} titulo="Sin incidentes registrados" texto="Si todo sale bien, este espacio queda vacío." /> : incidentes.map((i) => (
        <section key={i.id} className="card">
          <div className="row" style={{ gap: 8 }}><b>{i.descripcion}</b>{i.servicio && <Badge color="celeste">{i.servicio}</Badge>}{i.pendiente ? <Badge color="warn">Pendiente</Badge> : <Badge color="verde">Resuelto</Badge>}<div className="spacer" />
            <button className="icon-btn" onClick={() => setDlg({ incidente: i })} aria-label="Editar"><Pencil size={16} /></button>
            {P.coordinar && <button className="icon-btn bad" onClick={() => setDlg({ borrarInc: i })} aria-label="Eliminar"><Trash2 size={16} /></button>}</div>
          <div className="muted small">{fechaHora(i.ocurrido_en)} · registrado por {i.registrado_por_nombre || '—'}</div>
          <table className="resumen-tabla" style={{ marginTop: 6 }}><tbody>
            {i.consecuencias && <tr><td>Consecuencias</td><td>{i.consecuencias}</td></tr>}{i.medida_tomada && <tr><td>Qué se hizo</td><td>{i.medida_tomada}</td></tr>}{i.pendiente && <tr><td>Pendiente</td><td className="sol">{i.pendiente}</td></tr>}
          </tbody></table>
          {i.pendiente && <div style={{ marginTop: 8 }}><Btn size="sm" variant="ghost" icon={Check} onClick={() => run(() => api('/incidentes/' + i.id, { method: 'PUT', body: { pendiente: '' } }), 'Marcado como resuelto')}>Marcar como resuelto</Btn></div>}
        </section>))}
    </div>
  )

  // ---------- Panel: cierre y observaciones ----------
  const Cierre = (
    <div className="stack">
      {abierto ? (
        <section className="card">
          <div className="card-head"><h2>Cerrar el evento</h2></div>
          <p className="muted" style={{ marginTop: 0 }}>Cuando termine la noche, registrá cómo salió. Si se cae, registrá la cancelación con su motivo.</p>
          {(P.cerrar || P.cancelar) ? <div className="row">
            {P.cerrar && <Btn icon={Check} disabled={e.fecha > hoy} title={e.fecha > hoy ? 'Todavía no llegó la fecha' : ''} onClick={() => setDlg('cerrar')}>Se realizó</Btn>}
            {P.cancelar && <Btn variant="danger" icon={Ban} onClick={() => setDlg('cancelar')}>Se canceló</Btn>}
            {e.fecha > hoy && <span className="muted small">“Se realizó” se habilita desde la fecha del evento.</span>}
          </div> : <div className="muted small">Solo coordinación o los responsables del evento pueden registrar el cierre.</div>}
        </section>
      ) : (
        <section className={'card ' + (e.estado === 'cancelado' ? 'cierre-cancelado' : 'cierre-ok')}>
          <div className="card-head"><h2>Resultado</h2><Estado tipo="evento" valor={e.estado} /><div className="spacer" />
            {P.corregir && <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setDlg('corregir')}>Corregir</Btn>}{P.coordinar && <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => setDlg('reabrir')}>Reabrir</Btn>}</div>
          <table className="resumen-tabla"><tbody>
            <tr><td>Registrado</td><td>{fechaHora(e.cierre_registrado_en)} por {e.cierre_registrado_por_nombre || '—'}</td></tr>
            {e.estado === 'cancelado' && <><tr><td>Causa</td><td>{e.causa_cancelacion || '—'}</td></tr><tr><td>Motivo</td><td>{e.motivo_cancelacion}</td></tr><tr><td>Confirmada con el cliente</td><td>{e.cancelacion_comunicada == null ? '—' : e.cancelacion_comunicada ? 'Sí' : 'No'}</td></tr></>}
            <tr><td>Observaciones</td><td style={{ whiteSpace: 'pre-wrap' }}>{e.observaciones_cierre || <span className="muted">Sin observaciones</span>}</td></tr>
          </tbody></table>
        </section>
      )}
      <ObservacionesPanel encId={e.id} observaciones={observaciones} servicios={activos} yo={usuario.id} coord={P.coordinar} onHecho={recargar} />
    </div>
  )

  return (
    <div className="stack" style={{ gap: 18 }}>
      <a href="#/eventos" className="small no-print" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} />Eventos</a>
      <div className="hero">
        <div className="row" style={{ gap: 8 }}><Estado tipo="evento" valor={e.estado} /><Badge color="celeste">{e.tipo_evento}</Badge><FeriadoChips fecha={e.fecha} />{abierto && <Badge color={e.fecha <= hoy ? 'rojo' : 'gris'}><Cuando fecha={e.fecha} hoy={hoy} /></Badge>}</div>
        <h1>{e.nombre}</h1>
        <div className="ev-meta" style={{ fontSize: 15 }}>
          <span><UserRound size={15} /><a href={'#/clientes/' + cliente.id}>{cliente.boliche ? `${cliente.boliche} · ` : ''}{cliente.nombre}</a></span>
          <span><MapPin size={15} /><a href={'#/sedes/' + sede.id}>{sede.nombre}</a>{sede.ciudad ? ` · ${sede.ciudad}` : ''}</span>
          <span><CalendarDays size={15} />{cap1(fechaLarga(e.fecha))}</span>
          {e.hora_inicio && <span><Clock size={15} />{hora(e.hora_inicio)}{e.hora_fin ? ` a ${hora(e.hora_fin)}` : ''} hs</span>}
        </div>
        <div className="row small muted" style={{ gap: 16 }}><span>Coordina: <b style={{ color: 'var(--text)' }}>{e.responsable || 'sin asignar'}</b></span><span>Durante el evento: <b style={{ color: 'var(--text)' }}>{e.responsable_evento || 'sin asignar'}</b></span></div>
        <div className="row no-print">
          {P.coordinar && abierto && <Btn icon={GitCompare} onClick={() => setDlg('cambio')}>Registrar cambio</Btn>}
          {P.cerrar && abierto && <Btn variant="ghost" icon={Check} disabled={e.fecha > hoy} onClick={() => setDlg('cerrar')}>Se realizó</Btn>}
          {P.cancelar && abierto && <Btn variant="danger" icon={Ban} onClick={() => setDlg('cancelar')}>Cancelar</Btn>}
          <div className="spacer" />
          <Btn variant="ghost" icon={Copy} onClick={async () => { await copiar(textoWhatsApp(D, hoy)); toast('Resumen copiado: pegalo en WhatsApp') }}>Copiar resumen</Btn>
          <Btn variant="ghost" icon={Printer} onClick={() => window.print()}>Imprimir ficha</Btn>
        </div>
      </div>

      {paso}

      <div className="tabs no-print" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{badge(conteo[k])}</button>)}
      </div>
      {tab === 'resumen' && Resumen}{tab === 'servicios' && Servicios}{tab === 'tareas' && Tareas}{tab === 'cambios' && Cambios}{tab === 'durante' && Durante}{tab === 'cierre' && Cierre}
      {tab === 'historial' && <section className="card"><div className="card-head"><h2>Historial del evento</h2><span className="muted small">incluye lo ocurrido desde la solicitud</span></div><Timeline items={historial} /></section>}

      {dlg === 'reasignar' && <ReasignarModal enc={e} onClose={() => setDlg(null)} onHecho={hecho} />}
      {dlg?.servicio && <ServicioModal s={dlg.servicio} puedeVerImporte={P.ver_importes} onClose={() => setDlg(null)} onHecho={hecho} />}
      {(dlg === 'tarea' || dlg?.tarea) && <TareaModal encId={e.id} tarea={dlg.tarea} servicios={servicios} puedeAsignar={P.coordinar} yo={usuario.id} onClose={() => setDlg(null)} onHecho={hecho} />}
      {dlg === 'cambio' && <CambioModal enc={e} servicios={servicios} onClose={() => setDlg(null)} onHecho={hecho} />}
      {(dlg === 'incidente' || dlg?.incidente) && <IncidenteModal encId={e.id} incidente={dlg.incidente} servicios={servicios} onClose={() => setDlg(null)} onHecho={hecho} />}
      {dlg === 'cerrar' && <CerrarModal enc={e} resumen={r} onClose={() => setDlg(null)} onHecho={hecho} />}
      {dlg === 'cancelar' && <CancelarModal enc={e} onClose={() => setDlg(null)} onHecho={hecho} />}
      {dlg === 'corregir' && <CorregirCierreModal enc={e} onClose={() => setDlg(null)} onHecho={hecho} />}
      {dlg === 'reabrir' && <MotivoModal titulo="Reabrir el evento" label="¿Por qué se reabre? *" boton="Reabrir" ayuda="El evento vuelve a “en preparación”. Queda registrado quién lo reabrió y por qué." onClose={() => setDlg(null)} onOk={async (t) => { await api(`/encargos/${e.id}/reabrir`, { method: 'POST', body: { motivo: t } }); toast('Evento reabierto'); hecho() }} />}
      {dlg?.borrarInc && <Confirmar titulo="Eliminar incidente" texto="Se borra el registro del incidente. Queda constancia en el historial." confirmarLabel="Eliminar" peligro onConfirm={() => run(() => api('/incidentes/' + dlg.borrarInc.id, { method: 'DELETE' }), 'Incidente eliminado')} onClose={() => setDlg(null)} />}
      {dlg === 'datos' && <DatosModal enc={e} onClose={() => setDlg(null)} onHecho={hecho} />}
    </div>
  )
}

function DatosModal({ enc, onClose, onHecho }) {
  const toast = useToast()
  const [f, setF] = useState({ nombre: enc.nombre, tipo_evento: enc.tipo_evento, hora_inicio: (enc.hora_inicio || '').slice(0, 5), hora_fin: (enc.hora_fin || '').slice(0, 5), asistentes_estimados: enc.asistentes_estimados })
  return (
    <Dlg titulo="Editar datos del evento" boton="Guardar" onClose={onClose} onOk={async () => { await api('/encargos/' + enc.id, { method: 'PATCH', body: f }); toast('Datos actualizados'); onHecho() }}>
      <div className="helper"><span>La <b>fecha</b>, la <b>sede</b>, los <b>servicios</b>, los <b>importes</b> y las <b>condiciones</b> se cambian con “Registrar cambio”, para que quede constancia y el cliente pueda dar su conformidad.</span></div>
      <Field label="Nombre del evento"><input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
      <div className="form-grid">
        <Field label="Tipo de evento"><select value={f.tipo_evento} onChange={(e) => setF({ ...f, tipo_evento: e.target.value })}>{[...new Set([...TIPOS_EVENTO, enc.tipo_evento])].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Asistentes estimados"><NumInput value={f.asistentes_estimados ?? 0} onChange={(v) => setF({ ...f, asistentes_estimados: v || null })} /></Field>
        <Field label="Hora de inicio"><input type="time" value={f.hora_inicio} onChange={(e) => setF({ ...f, hora_inicio: e.target.value })} /></Field>
        <Field label="Hora de cierre"><input type="time" value={f.hora_fin} onChange={(e) => setF({ ...f, hora_fin: e.target.value })} /></Field>
      </div>
    </Dlg>
  )
}

function TareasPanel({ tareas, abierto, P, onNueva, onEditar, run, yo, puedeEditar }) {
  const [ver, setVer] = useState(false)
  const lista = tareas.filter((t) => ver || ['pendiente', 'en_curso'].includes(t.estado))
  const puedeTocar = (t) => P.coordinar || t.responsable_id === yo || t.created_by === yo
  return (
    <div className="stack">
      <div className="row"><label className="row small muted" style={{ gap: 6 }}><input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />Mostrar completadas y canceladas</label><div className="spacer" />
        {abierto && <Btn icon={Plus} onClick={onNueva}>Nueva tarea</Btn>}</div>
      {lista.length === 0 ? <Vacio titulo={tareas.length ? 'No hay tareas abiertas' : 'Todavía no hay tareas'} texto="Anotá lo que hay que hacer, quién lo hace y para cuándo." /> : (
        <div className="lista-prox">{lista.map((t) => (
          <div key={t.id} className={'prox compacta' + (t.estado === 'completada' || t.estado === 'cancelada' ? ' hecha' : '')}>
            <input type="checkbox" checked={t.estado === 'completada'} disabled={!abierto || !puedeTocar(t) || t.estado === 'cancelada'} aria-label="Completada" onChange={(ev) => run(() => api('/tareas/' + t.id, { method: 'PATCH', body: { estado: ev.target.checked ? 'completada' : 'pendiente' } }))} />
            <div className="grow">
              <div className="row" style={{ gap: 8 }}><b>{t.titulo}</b><Estado tipo="tarea" valor={t.estado} />{t.vencida && <Badge color="rojo">Vencida</Badge>}{t.revisar && <Badge color="violeta" icon={Eye}>Revisar</Badge>}</div>
              <div className="muted small">{t.responsable ? `👤 ${t.responsable}` : 'Sin responsable'}{t.fecha_prevista ? ` · para el ${fechaCorta(t.fecha_prevista)}` : ''}{t.descripcion ? ` · ${t.descripcion}` : ''}</div>
              {t.revisar && <div className="small sol">{t.revisar_motivo} <button className="link" onClick={() => run(() => api('/tareas/' + t.id, { method: 'PATCH', body: { revisado: true } }))}>Ya la revisé</button></div>}
            </div>
            {abierto && puedeTocar(t) && t.estado !== 'completada' && <select style={{ width: 120 }} value={t.estado} onChange={(ev) => run(() => api('/tareas/' + t.id, { method: 'PATCH', body: { estado: ev.target.value } }))}><option value="pendiente">Pendiente</option><option value="en_curso">En curso</option><option value="completada">Completada</option></select>}
            {abierto && puedeTocar(t) && <button className="icon-btn" onClick={() => onEditar(t)} aria-label="Editar"><Pencil size={16} /></button>}
            {abierto && puedeTocar(t) && <button className="icon-btn bad" onClick={() => run(() => api('/tareas/' + t.id, { method: 'DELETE' }), 'Tarea eliminada')} aria-label="Eliminar"><Trash2 size={16} /></button>}
          </div>))}</div>
      )}
    </div>
  )
}

function ObservacionesPanel({ encId, observaciones, servicios, yo, coord, onHecho }) {
  const toast = useToast()
  const [texto, setTexto] = useState('')
  const [prov, setProv] = useState(null)
  const proveedoresDelEvento = servicios.filter((s) => s.proveedor)
  const guardar = async () => {
    try { await api(`/encargos/${encId}/observaciones`, { method: 'POST', body: { texto, proveedor_id: prov } }); setTexto(''); setProv(null); toast('Observación guardada'); onHecho() } catch (e) { toast(e.message, 'error') }
  }
  return (
    <section className="card">
      <div className="card-head"><h2>Observaciones y aprendizajes</h2></div>
      <p className="muted small" style={{ marginTop: -6 }}>Anotá lo que convenga recordar para próximos eventos. Si es sobre un proveedor, elegilo: va a aparecer en su ficha.</p>
      <div className="stack" style={{ gap: 10 }}>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: Sonido Pro necesitó más tiempo de armado: pedirles llegar 2 horas antes" />
        <div className="row">
          <select style={{ width: 'auto', minWidth: 220 }} value={prov ?? ''} onChange={(e) => setProv(e.target.value ? Number(e.target.value) : null)}><option value="">Sobre el evento en general</option>{proveedoresDelEvento.map((s) => <option key={s.proveedor.id} value={s.proveedor.id}>Sobre {s.proveedor.nombre} ({s.servicio})</option>)}</select>
          <div className="spacer" /><Btn icon={MessageSquarePlus} disabled={!texto.trim()} onClick={guardar}>Guardar observación</Btn>
        </div>
      </div>
      {observaciones.length > 0 && <div className="lista-prox" style={{ marginTop: 16 }}>{observaciones.map((o) => (
        <div key={o.id} className="prox compacta"><div className="grow"><div style={{ whiteSpace: 'pre-wrap' }}>{o.texto}</div>
          <div className="muted small">{o.proveedor ? <>Sobre <a href={'#/proveedores/' + o.proveedor.id}>{o.proveedor.nombre}</a> · </> : ''}{o.registrado_por_nombre} · {fechaHora(o.created_at)}</div></div>
          {(coord || o.registrado_por === yo) && <button className="icon-btn bad" aria-label="Eliminar" onClick={async () => { try { await api('/observaciones/' + o.id, { method: 'DELETE' }); onHecho() } catch (e) { toast(e.message, 'error') } }}><Trash2 size={16} /></button>}
        </div>))}</div>}
    </section>
  )
}
