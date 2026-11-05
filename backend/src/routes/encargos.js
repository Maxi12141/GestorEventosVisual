import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth, coord } from '../auth.js'
import { personas, dinero, fechaTope, LIMITES, wrap, check, httpError, aEntero, aNumero, txt, esFecha, hoyAR, diasEntre, limpiarBusqueda, hhmm, uno } from '../util.js'
import { log, nombres, nombreDe, esCoord, esApoyo, esResponsable, verCliente, verServicio, verCambio, exigirEquipo, exigirCapacidad } from '../comun.js'
import { conflictosSede } from './solicitudes.js'
import { resumenEncargo } from '../reglas.js'

export const encargosRouter = Router()
encargosRouter.use(requireAuth)

const ABIERTOS = ['confirmado', 'en_preparacion']
const CERRADOS = ['realizado', 'cancelado']
const PARTICIPACIONES = ['pendiente', 'disponibilidad_informada', 'confirmada', 'rechazada']
const TAREA_ABIERTA = ['pendiente', 'en_curso']
const EMBED_LISTA = `*, clientes(id, nombre, boliche), sedes(id, nombre, ciudad),
  encargo_servicios(id, servicio, activo, participacion, proveedor_id, importe, revisar, aviso_cancelacion),
  tareas(id, estado, fecha_prevista, revisar), incidentes(id, pendiente), cambios(id, estado)`

export { resumenEncargo }

const filaLista = (e, hoy, perfil, nm) => ({
  id: e.id, nombre: e.nombre, tipo_evento: e.tipo_evento, estado: e.estado, fecha: e.fecha, hora_inicio: e.hora_inicio,
  cliente: e.clientes, sede: e.sedes, responsable_id: e.responsable_id, responsable: nombreDe(nm, e.responsable_id),
  asistentes_estimados: e.asistentes_estimados, resumen: resumenEncargo(e, hoy, perfil),
})

// ---------- Listado con filtros ----------
encargosRouter.get('/encargos', wrap(async (req, res) => {
  const hoy = hoyAR()
  const nm = await nombres()
  let q = supabase.from('encargos').select(EMBED_LISTA).order('fecha', { ascending: req.query.orden !== 'desc' })
  if (req.query.estado === 'abiertos') q = q.in('estado', ABIERTOS)
  else if (req.query.estado === 'cerrados') q = q.in('estado', CERRADOS)
  else if (req.query.estado) q = q.eq('estado', req.query.estado)
  if (esFecha(req.query.desde)) q = q.gte('fecha', req.query.desde)
  if (esFecha(req.query.hasta)) q = q.lte('fecha', req.query.hasta)
  if (req.query.cliente_id) q = q.eq('cliente_id', aEntero(req.query.cliente_id))
  if (req.query.sede_id) q = q.eq('sede_id', aEntero(req.query.sede_id))
  if (req.query.responsable_id) q = q.eq('responsable_id', req.query.responsable_id === 'yo' ? req.perfil.id : req.query.responsable_id)
  const s = limpiarBusqueda(req.query.q)
  if (s) q = q.ilike('nombre', `%${s}%`)
  if (req.query.proveedor_id) {
    const ids = check(await supabase.from('encargo_servicios').select('encargo_id').eq('proveedor_id', aEntero(req.query.proveedor_id)).eq('activo', true)).map((x) => x.encargo_id)
    q = q.in('id', ids.length ? ids : [-1])
  }
  let data = check(await q).map((e) => filaLista(e, hoy, req.perfil, nm))
  if (req.query.sin_confirmar === '1') data = data.filter((e) => ABIERTOS.includes(e.estado) && e.resumen.servicios_sin_confirmar > 0)
  if (req.query.por_cerrar === '1') data = data.filter((e) => e.resumen.por_cerrar)
  if (req.query.con_pendientes === '1') data = data.filter((e) => ABIERTOS.includes(e.estado) && (e.resumen.tareas_vencidas || e.resumen.cambios_pendientes || e.resumen.para_revisar || e.resumen.servicios_sin_confirmar))
  res.json(data)
}))

// ---------- Detalle completo ("ficha" del evento: sirve para que otra persona retome el seguimiento) ----------
async function detalle(id, req) {
  const hoy = hoyAR()
  const enc = check(await supabase.from('encargos').select('*, clientes(*), sedes(*), solicitudes(id, titulo, necesidades, medio_contacto, fecha_prevista, asistentes_estimados, created_at), propuestas(id, fecha_presentacion, condiciones)').eq('id', id).single())
  const [serv, tar, cam, inc, obs, his] = await Promise.all([
    supabase.from('encargo_servicios').select('*, proveedores(id, nombre, servicio, contacto, telefono)').eq('encargo_id', id).order('orden').order('id'),
    supabase.from('tareas').select('*').eq('encargo_id', id).order('fecha_prevista', { nullsFirst: false }).order('id'),
    supabase.from('cambios').select('*').eq('encargo_id', id).order('registrado_en', { ascending: false }),
    supabase.from('incidentes').select('*, encargo_servicios(servicio)').eq('encargo_id', id).order('ocurrido_en', { ascending: false }),
    supabase.from('observaciones').select('*, proveedores(id, nombre)').eq('encargo_id', id).order('created_at', { ascending: false }),
    supabase.from('historial').select('*').or(`encargo_id.eq.${id},and(solicitud_id.eq.${enc.solicitud_id},encargo_id.is.null)`).order('created_at', { ascending: false }),
  ])
  const nm = await nombres()
  const n = (x) => nombreDe(nm, x)
  const servicios = check(serv).map((s) => ({
    ...verServicio(s, req.perfil), proveedor: s.proveedores, proveedores: undefined,
    actualizado_por: n(s.participacion_actualizada_por), aviso_por: n(s.aviso_cancelacion_por),
  }))
  const tareas = check(tar).map((t) => ({ ...t, responsable: n(t.responsable_id), creada_por: n(t.created_by), vencida: TAREA_ABIERTA.includes(t.estado) && !!t.fecha_prevista && t.fecha_prevista < hoy }))
  const { clientes, sedes, solicitudes, propuestas, ...encargo } = enc
  const completo = { ...enc, encargo_servicios: servicios, tareas, cambios: check(cam), incidentes: check(inc) }
  const coordina = esCoord(req.perfil)
  return {
    encargo: { ...encargo, responsable: n(enc.responsable_id), responsable_evento: n(enc.responsable_evento_id),
      aceptacion_registrada_por_nombre: n(enc.aceptacion_registrada_por), cierre_registrado_por_nombre: n(enc.cierre_registrado_por) },
    cliente: verCliente(clientes, req.perfil), sede: sedes, solicitud: solicitudes, propuesta: propuestas && { ...propuestas, condiciones: esApoyo(req.perfil) ? null : propuestas.condiciones },
    servicios, tareas,
    cambios: check(cam).map((c) => verCambio({ ...c, registrado_por_nombre: n(c.registrado_por), resuelto_por_nombre: n(c.resuelto_por) }, req.perfil)),
    incidentes: check(inc).map((i) => ({ ...i, servicio: i.encargo_servicios?.servicio, encargo_servicios: undefined, registrado_por_nombre: n(i.registrado_por) })),
    observaciones: check(obs).map((o) => ({ ...o, proveedor: o.proveedores, proveedores: undefined, registrado_por_nombre: n(o.registrado_por) })),
    historial: check(his),
    resumen: resumenEncargo(completo, hoy, req.perfil),
    permisos: {
      coordinar: coordina,
      cerrar: coordina || esResponsable(req.perfil, enc),
      cancelar: coordina || enc.responsable_id === req.perfil.id,
      corregir: coordina || esResponsable(req.perfil, enc),
      ver_importes: !esApoyo(req.perfil),
      ver_contacto_cliente: !esApoyo(req.perfil),
    },
  }
}

encargosRouter.get('/encargos/:id', wrap(async (req, res) => res.json(await detalle(req.params.id, req))))

const getEnc = async (id) => check(await supabase.from('encargos').select('*').eq('id', id).single())
const exigirAbierto = (enc) => {
  if (CERRADOS.includes(enc.estado)) throw httpError(409, `El evento está ${enc.estado}: reabrilo si necesitás modificarlo`)
}
// Primer movimiento de preparación: el evento pasa de "confirmado" a "en preparación"
async function iniciarPreparacion(req, enc) {
  if (enc.estado !== 'confirmado') return
  check(await supabase.from('encargos').update({ estado: 'en_preparacion' }).eq('id', enc.id).eq('estado', 'confirmado'))
  await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'preparacion_iniciada', detalle: 'Empezó la preparación del evento', anterior: 'confirmado', nuevo: 'en_preparacion' })
}

// Hora opcional: vacío = sin hora; si viene algo, tiene que ser HH:MM válida (los eventos de noche pueden terminar al día siguiente)
const horaOpc = (v, campo) => {
  if (v === '' || v == null) return null
  const h = hhmm(v)
  if (!h) throw httpError(400, `${campo} no es válida (formato HH:MM)`)
  return h
}

// ---------- Datos que no alteran lo acordado ----------
encargosRouter.patch('/encargos/:id', coord, wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  exigirAbierto(enc)
  const b = req.body || {}
  const o = {}
  if (b.nombre !== undefined) { o.nombre = txt(b.nombre, 120); if (!o.nombre) throw httpError(400, 'El nombre no puede quedar vacío') }
  if (b.tipo_evento !== undefined) o.tipo_evento = txt(b.tipo_evento, 60) || 'Otro'
  if (b.hora_inicio !== undefined) o.hora_inicio = horaOpc(b.hora_inicio, 'La hora de inicio')
  if (b.hora_fin !== undefined) o.hora_fin = horaOpc(b.hora_fin, 'La hora de fin')
  if (b.asistentes_estimados !== undefined) o.asistentes_estimados = b.asistentes_estimados === '' || b.asistentes_estimados == null ? null : personas(b.asistentes_estimados, { min: 0, campo: 'Los asistentes' })
  if (!Object.keys(o).length) throw httpError(400, 'Nada para actualizar')
  if (o.asistentes_estimados != null) await exigirCapacidad(enc.sede_id, o.asistentes_estimados)
  check(await supabase.from('encargos').update(o).eq('id', enc.id))
  for (const k of Object.keys(o)) {
    if (String(o[k] ?? '') !== String(enc[k] ?? '')) await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'evento_modificado', detalle: `Cambió ${k.replace('_', ' ')}`, anterior: enc[k] == null ? null : String(enc[k]), nuevo: o[k] == null ? null : String(o[k]) })
  }
  res.json({ ok: true })
}))

// Reasignar responsables (continuidad cuando alguien no está disponible)
encargosRouter.patch('/encargos/:id/responsables', coord, wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  exigirAbierto(enc)
  const nm = await nombres()
  const o = {}
  for (const k of ['responsable_id', 'responsable_evento_id']) {
    if (req.body?.[k] === undefined) continue
    const v = req.body[k] || null
    await exigirEquipo(v, 'Esa persona no existe, está desactivada o no es parte del equipo')
    if (k === 'responsable_id' && !v) throw httpError(400, 'El evento tiene que tener alguien que lo coordine')
    o[k] = v
  }
  if (!Object.keys(o).length) throw httpError(400, 'Nada para actualizar')
  if (o.asistentes_estimados != null) await exigirCapacidad(enc.sede_id, o.asistentes_estimados)
  check(await supabase.from('encargos').update(o).eq('id', enc.id))
  if ('responsable_id' in o && o.responsable_id !== enc.responsable_id)
    await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'responsable_cambiado', detalle: txt(req.body.motivo, 300), anterior: nombreDe(nm, enc.responsable_id), nuevo: nombreDe(nm, o.responsable_id) })
  if ('responsable_evento_id' in o && o.responsable_evento_id !== enc.responsable_evento_id)
    await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'responsable_evento_cambiado', detalle: 'Responsable durante el evento', anterior: nombreDe(nm, enc.responsable_evento_id), nuevo: nombreDe(nm, o.responsable_evento_id) })
  res.json({ ok: true })
}))

// ---------- Cambios relevantes ----------
encargosRouter.post('/encargos/:id/cambios', coord, wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  exigirAbierto(enc)
  const b = req.body || {}
  const payload = { ...(b.payload || {}) }
  if (b.campo === 'servicio' || b.campo === 'importe') {
    if (payload.importe !== undefined && payload.importe !== '') payload.importe = dinero(payload.importe)
    if (payload.servicio_id) payload.servicio_id = aEntero(payload.servicio_id)
    if (payload.proveedor_id === '') payload.proveedor_id = null
  }
  if (b.campo === 'sede' && payload.sede_id) { payload.sede_id = aEntero(payload.sede_id); await exigirCapacidad(payload.sede_id, enc.asistentes_estimados) }
  if (b.campo === 'fecha') {
    if (!esFecha(payload.fecha)) throw httpError(400, 'Indicá la nueva fecha')
    if (payload.fecha < hoyAR()) throw httpError(400, 'La nueva fecha ya pasó')
    if (payload.fecha > fechaTope()) throw httpError(400, `La nueva fecha no puede ser más de ${LIMITES.anosFuturo} años en el futuro`)
  }
  // aviso (no bloquea) si hay otro evento en esa sede ese día
  if ((b.campo === 'fecha' || b.campo === 'sede') && !b.forzar) {
    const sede = b.campo === 'sede' ? payload.sede_id : enc.sede_id
    const fecha = b.campo === 'fecha' ? payload.fecha : enc.fecha
    if (sede && esFecha(fecha)) {
      const conf = await conflictosSede(sede, fecha, enc.id)
      if (conf.length) throw httpError(409, 'Ya hay otro evento en esa sede ese día. ¿Querés continuar igual?', { codigo: 'CONFLICTO_SEDE', conflictos: conf })
    }
  }
  const id = check(await supabase.rpc('registrar_cambio', {
    p_encargo_id: enc.id,
    p: { campo: b.campo, descripcion: txt(b.descripcion, 500), payload, requiere_conformidad: !!b.requiere_conformidad, conformidad: b.conformidad || 'no_requiere' },
    p_user: req.perfil.id, p_nombre: req.perfil.nombre,
  }))
  res.status(201).json({ id })
}))

encargosRouter.post('/cambios/:id/resolver', coord, wrap(async (req, res) => {
  const r = req.body?.resultado
  if (!['conforme', 'rechazado'].includes(r)) throw httpError(400, 'Resultado inválido')
  check(await supabase.rpc('resolver_cambio', { p_cambio_id: Number(req.params.id), p_resultado: r, p_user: req.perfil.id, p_nombre: req.perfil.nombre }))
  res.json({ ok: true })
}))

// ---------- Cierre operativo ----------
encargosRouter.post('/encargos/:id/cerrar', wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  const b = req.body || {}
  if (b.resultado === 'cancelado' ? !(esCoord(req.perfil) || enc.responsable_id === req.perfil.id) : !(esCoord(req.perfil) || esResponsable(req.perfil, enc))) {
    throw httpError(403, 'Solo coordinación o los responsables del evento pueden registrar este cierre')
  }
  const r = check(await supabase.rpc('cerrar_encargo', {
    p_id: enc.id,
    p: { resultado: b.resultado, observaciones: txt(b.observaciones, 2000), causa: txt(b.causa, 80), motivo: txt(b.motivo, 1000), comunicada_cliente: b.comunicada_cliente == null ? null : !!b.comunicada_cliente },
    p_user: req.perfil.id, p_nombre: req.perfil.nombre,
  }))
  res.json(r)
}))

encargosRouter.post('/encargos/:id/reabrir', coord, wrap(async (req, res) => {
  check(await supabase.rpc('reabrir_encargo', { p_id: Number(req.params.id), p_motivo: txt(req.body?.motivo, 500) || '', p_user: req.perfil.id, p_nombre: req.perfil.nombre }))
  res.json({ ok: true })
}))

encargosRouter.post('/encargos/:id/corregir-cierre', wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  if (!(esCoord(req.perfil) || esResponsable(req.perfil, enc))) throw httpError(403, 'Solo coordinación o los responsables del evento pueden corregir el cierre')
  const b = req.body || {}
  const p = { motivo_correccion: txt(b.motivo_correccion, 500) || '' }
  for (const k of ['observaciones_cierre', 'motivo_cancelacion', 'causa_cancelacion']) if (b[k] !== undefined) p[k] = txt(b[k], 2000) || ''
  check(await supabase.rpc('corregir_cierre', { p_id: enc.id, p, p_user: req.perfil.id, p_nombre: req.perfil.nombre }))
  res.json({ ok: true })
}))

// ---------- Servicios y proveedores ----------
encargosRouter.patch('/servicios/:id', wrap(async (req, res) => {
  const s = check(await supabase.from('encargo_servicios').select('*, proveedores(nombre)').eq('id', req.params.id).single())
  const enc = await getEnc(s.encargo_id)
  const b = req.body || {}
  const o = {}
  const antes = []
  const nm = await nombres()
  const hist = []

  // Avisar la cancelación a un proveedor: se puede hacer con el evento cancelado
  if (b.aviso_cancelacion !== undefined) {
    if (enc.estado !== 'cancelado') throw httpError(409, 'Esto solo aplica a eventos cancelados')
    if (!['pendiente', 'avisado'].includes(b.aviso_cancelacion)) throw httpError(400, 'Valor inválido')
    o.aviso_cancelacion = b.aviso_cancelacion
    o.aviso_cancelacion_por = b.aviso_cancelacion === 'avisado' ? req.perfil.id : null
    o.aviso_cancelacion_en = b.aviso_cancelacion === 'avisado' ? new Date().toISOString() : null
    hist.push({ accion: b.aviso_cancelacion === 'avisado' ? 'proveedor_avisado' : 'proveedor_aviso_pendiente', detalle: `${s.servicio}: ${s.proveedores?.nombre || 'proveedor'}` })
  } else {
    exigirAbierto(enc)
    if (b.proveedor_id !== undefined) {
      const pid = b.proveedor_id ? aEntero(b.proveedor_id) : null
      if (pid !== s.proveedor_id) {
        if (pid) check(await supabase.from('proveedores').select('id').eq('id', pid).single())
        o.proveedor_id = pid
        if (pid) { o.participacion = 'pendiente'; o.participacion_nota = null }
        const nuevo = pid ? check(await supabase.from('proveedores').select('nombre').eq('id', pid).single()).nombre : null
        hist.push({ accion: 'proveedor_asignado', detalle: s.servicio, anterior: s.proveedores?.nombre || null, nuevo })
      }
    }
    if (b.participacion !== undefined) {
      if (!PARTICIPACIONES.includes(b.participacion)) throw httpError(400, 'Estado de participación inválido')
      if (!(o.proveedor_id ?? s.proveedor_id) && b.participacion !== 'pendiente') throw httpError(400, 'Primero elegí qué proveedor presta este servicio')
      if (b.participacion !== (o.participacion ?? s.participacion)) {
        o.participacion = b.participacion
        hist.push({ accion: 'participacion_' + b.participacion, detalle: `${s.servicio}: ${s.proveedores?.nombre || ''}`.trim(), anterior: s.participacion, nuevo: b.participacion })
      }
    }
    if (b.participacion_nota !== undefined) o.participacion_nota = txt(b.participacion_nota, 500)
    if (b.importe_proveedor !== undefined) {
      const v = b.importe_proveedor === '' || b.importe_proveedor == null ? null : aNumero(b.importe_proveedor, -1)
      if (v != null) dinero(v)
      if (v !== (s.importe_proveedor == null ? null : Number(s.importe_proveedor))) {
        o.importe_proveedor = v
        hist.push({ accion: 'importe_proveedor', detalle: `${s.servicio}: importe informado por el proveedor`, anterior: s.importe_proveedor == null ? null : String(s.importe_proveedor), nuevo: v == null ? null : String(v) })
      }
    }
    if (b.revisado === true) { o.revisar = false; o.revisar_motivo = null; hist.push({ accion: 'servicio_revisado', detalle: s.servicio }) }
    if ('participacion' in o || 'proveedor_id' in o) { o.participacion_actualizada_por = req.perfil.id; o.participacion_actualizada_en = new Date().toISOString() }
  }
  if (!Object.keys(o).length) throw httpError(400, 'No hay cambios para guardar')
  const nuevo = check(await supabase.from('encargo_servicios').update(o).eq('id', s.id).select('*, proveedores(id, nombre, servicio, contacto, telefono)').single())
  for (const h of hist) await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: h.accion, detalle: h.detalle, anterior: h.anterior, nuevo: h.nuevo })
  if (b.aviso_cancelacion === undefined && ('participacion' in o || 'proveedor_id' in o)) await iniciarPreparacion(req, enc)
  res.json({ ...verServicio(nuevo, req.perfil), proveedor: nuevo.proveedores })
}))

// ---------- Tareas ----------
function limpiarTarea(b, parcial) {
  const o = {}
  if (!parcial || b.titulo !== undefined) { o.titulo = txt(b.titulo, 200); if (!o.titulo) throw httpError(400, 'Poné qué hay que hacer') }
  if (b.descripcion !== undefined) o.descripcion = txt(b.descripcion, 1000)
  if (b.fecha_prevista !== undefined) { o.fecha_prevista = b.fecha_prevista || null; if (o.fecha_prevista && !esFecha(o.fecha_prevista)) throw httpError(400, 'La fecha no es válida') }
  if (b.responsable_id !== undefined) o.responsable_id = b.responsable_id || null
  if (b.servicio_id !== undefined) o.servicio_id = b.servicio_id ? aEntero(b.servicio_id) : null
  if (b.estado !== undefined) {
    if (!['pendiente', 'en_curso', 'completada'].includes(b.estado)) throw httpError(400, 'Estado de tarea inválido')
    o.estado = b.estado
    o.completada_en = b.estado === 'completada' ? new Date().toISOString() : null
  }
  return o
}
async function validarResponsable(id) {
  if (!id) return
  await exigirEquipo(id, 'La persona responsable no existe, está desactivada o no es parte del equipo')
}

encargosRouter.get('/tareas', wrap(async (req, res) => {
  const hoy = hoyAR()
  const nm = await nombres()
  let q = supabase.from('tareas').select('*, encargos(id, nombre, fecha, estado, sedes(nombre))').order('fecha_prevista', { nullsFirst: false }).order('id')
  if (req.query.encargo_id) q = q.eq('encargo_id', aEntero(req.query.encargo_id))
  if (req.query.responsable_id) q = q.eq('responsable_id', req.query.responsable_id === 'yo' ? req.perfil.id : req.query.responsable_id)
  if (req.query.estado === 'abiertas') q = q.in('estado', TAREA_ABIERTA)
  else if (req.query.estado) q = q.eq('estado', req.query.estado)
  const s = limpiarBusqueda(req.query.q)
  if (s) q = q.ilike('titulo', `%${s}%`)
  let data = check(await q).map((t) => ({
    ...t, responsable: nombreDe(nm, t.responsable_id), evento: t.encargos && { id: t.encargos.id, nombre: t.encargos.nombre, fecha: t.encargos.fecha, estado: t.encargos.estado, sede: t.encargos.sedes?.nombre },
    encargos: undefined, vencida: TAREA_ABIERTA.includes(t.estado) && !!t.fecha_prevista && t.fecha_prevista < hoy,
  }))
  if (req.query.vencidas === '1') data = data.filter((t) => t.vencida)
  if (req.query.estado === undefined) data = data.filter((t) => t.estado !== 'cancelada')
  res.json(data)
}))

encargosRouter.post('/encargos/:id/tareas', wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  exigirAbierto(enc)
  const o = limpiarTarea(req.body || {}, false)
  await validarResponsable(o.responsable_id)
  const t = check(await supabase.from('tareas').insert({ ...o, encargo_id: enc.id, created_by: req.perfil.id }).select().single())
  await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'tarea_creada', detalle: o.titulo })
  await iniciarPreparacion(req, enc)
  res.status(201).json(t)
}))

encargosRouter.patch('/tareas/:id', wrap(async (req, res) => {
  const t = check(await supabase.from('tareas').select('*').eq('id', req.params.id).single())
  const enc = await getEnc(t.encargo_id)
  exigirAbierto(enc)
  if (!esCoord(req.perfil) && t.responsable_id !== req.perfil.id && t.created_by !== req.perfil.id) {
    throw httpError(403, 'Solo podés modificar las tareas que tenés asignadas o que creaste vos')
  }
  const o = limpiarTarea(req.body || {}, true)
  if (req.body?.revisado === true) { o.revisar = false; o.revisar_motivo = null }
  if (!esCoord(req.perfil) && 'responsable_id' in o && o.responsable_id !== t.responsable_id) throw httpError(403, 'Reasignar tareas lo hace coordinación')
  await validarResponsable(o.responsable_id)
  if (!Object.keys(o).length) throw httpError(400, 'Nada para actualizar')
  const nueva = check(await supabase.from('tareas').update(o).eq('id', t.id).select().single())
  if (o.estado && o.estado !== t.estado) await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: o.estado === 'completada' ? 'tarea_completada' : 'tarea_estado', detalle: t.titulo, anterior: t.estado, nuevo: o.estado })
  if ('responsable_id' in o && o.responsable_id !== t.responsable_id) {
    const nm = await nombres()
    await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'tarea_reasignada', detalle: t.titulo, anterior: nombreDe(nm, t.responsable_id), nuevo: nombreDe(nm, o.responsable_id) })
  }
  res.json(nueva)
}))

encargosRouter.delete('/tareas/:id', wrap(async (req, res) => {
  const t = check(await supabase.from('tareas').select('*').eq('id', req.params.id).single())
  const enc = await getEnc(t.encargo_id)
  exigirAbierto(enc)
  if (!esCoord(req.perfil) && t.created_by !== req.perfil.id) throw httpError(403, 'Solo coordinación o quien creó la tarea puede borrarla')
  check(await supabase.from('tareas').delete().eq('id', t.id))
  await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'tarea_eliminada', detalle: t.titulo })
  res.json({ ok: true })
}))

// ---------- Incidentes (durante o después del evento: se pueden cargar aunque esté cerrado) ----------
function limpiarIncidente(b, parcial) {
  const o = {}
  if (!parcial || b.descripcion !== undefined) { o.descripcion = txt(b.descripcion, 1000); if (!o.descripcion) throw httpError(400, 'Contá qué ocurrió') }
  for (const k of ['consecuencias', 'medida_tomada', 'pendiente']) if (b[k] !== undefined) o[k] = txt(b[k], 1000)
  if (b.servicio_id !== undefined) o.servicio_id = b.servicio_id ? aEntero(b.servicio_id) : null
  if (b.ocurrido_en !== undefined && b.ocurrido_en) { const d = new Date(b.ocurrido_en); if (Number.isNaN(d.getTime())) throw httpError(400, 'La fecha y hora del incidente no son válidas'); o.ocurrido_en = d.toISOString() }
  return o
}
encargosRouter.post('/encargos/:id/incidentes', wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  const o = limpiarIncidente(req.body || {}, false)
  if (o.servicio_id) check(await supabase.from('encargo_servicios').select('id').eq('id', o.servicio_id).eq('encargo_id', enc.id).single())
  const i = check(await supabase.from('incidentes').insert({ ...o, encargo_id: enc.id, registrado_por: req.perfil.id }).select().single())
  await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'incidente_registrado', detalle: o.descripcion })
  res.status(201).json(i)
}))
encargosRouter.put('/incidentes/:id', wrap(async (req, res) => {
  const i = check(await supabase.from('incidentes').select('*').eq('id', req.params.id).single())
  const enc = await getEnc(i.encargo_id)
  if (!esCoord(req.perfil) && i.registrado_por !== req.perfil.id && !esResponsable(req.perfil, enc)) throw httpError(403, 'Solo coordinación, los responsables o quien lo registró pueden modificarlo')
  const o = limpiarIncidente(req.body || {}, true)
  if (!Object.keys(o).length) throw httpError(400, 'Nada para actualizar')
  const nuevo = check(await supabase.from('incidentes').update(o).eq('id', i.id).select().single())
  if (i.pendiente && !(o.pendiente ?? i.pendiente)) await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'incidente_resuelto', detalle: i.descripcion })
  res.json(nuevo)
}))
encargosRouter.delete('/incidentes/:id', coord, wrap(async (req, res) => {
  const i = check(await supabase.from('incidentes').select('*').eq('id', req.params.id).single())
  const enc = await getEnc(i.encargo_id)
  check(await supabase.from('incidentes').delete().eq('id', i.id))
  await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'incidente_eliminado', detalle: i.descripcion })
  res.json({ ok: true })
}))

// ---------- Observaciones y aprendizajes ----------
encargosRouter.post('/encargos/:id/observaciones', wrap(async (req, res) => {
  const enc = await getEnc(req.params.id)
  const texto = txt(req.body?.texto, 1500)
  if (!texto) throw httpError(400, 'Escribí la observación')
  const proveedor_id = req.body?.proveedor_id ? aEntero(req.body.proveedor_id) : null
  if (proveedor_id) check(await supabase.from('proveedores').select('id').eq('id', proveedor_id).single())
  const o = check(await supabase.from('observaciones').insert({ encargo_id: enc.id, proveedor_id, texto, registrado_por: req.perfil.id }).select().single())
  await log(req, { solicitud_id: enc.solicitud_id, encargo_id: enc.id, accion: 'observacion_registrada', detalle: texto })
  res.status(201).json(o)
}))
encargosRouter.delete('/observaciones/:id', wrap(async (req, res) => {
  const o = check(await supabase.from('observaciones').select('*').eq('id', req.params.id).single())
  if (!esCoord(req.perfil) && o.registrado_por !== req.perfil.id) throw httpError(403, 'Solo coordinación o quien la escribió puede borrarla')
  check(await supabase.from('observaciones').delete().eq('id', o.id))
  res.json({ ok: true })
}))
