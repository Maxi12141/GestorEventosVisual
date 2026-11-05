import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth, coord } from '../auth.js'
import { hhmm, personas, fechaTope, LIMITES, wrap, check, httpError, aEntero, txt, esFecha, hoyAR, diasEntre, limpiarBusqueda, uno } from '../util.js'
import { log, nombres, nombreDe, verCliente, esApoyo, exigirEquipo, exigirCapacidad } from '../comun.js'
import { normalizarServicios, totalProp } from '../reglas.js'

export const solicitudesRouter = Router()
solicitudesRouter.use(requireAuth)

export const ESTADOS_ABIERTOS = ['en_evaluacion', 'pendiente_informacion', 'lista_para_propuesta']
const ESTADOS_EDITABLES = [...ESTADOS_ABIERTOS, 'descartada']
const MEDIOS = ['WhatsApp', 'Teléfono', 'Presencial', 'Otro']

export { totalProp }

// Resumen de la propuesta vigente (o la última rechazada) de una solicitud
function resumenPropuesta(props, perfil, hoy) {
  const lista = [...(props || [])].sort((a, b) => b.id - a.id)
  const p = lista.find((x) => x.estado !== 'rechazada') || lista[0]
  if (!p) return null
  return {
    id: p.id, estado: p.estado, fecha_presentacion: p.fecha_presentacion,
    total: esApoyo(perfil) ? null : totalProp(p),
    dias_esperando: p.estado === 'pendiente_respuesta' ? diasEntre(p.fecha_presentacion, hoy) : null,
  }
}

// ---------- Listado ----------
solicitudesRouter.get('/solicitudes', wrap(async (req, res) => {
  const hoy = hoyAR()
  let q = supabase.from('solicitudes')
    .select('*, clientes(id, nombre, boliche), sedes(id, nombre), propuestas(id, estado, fecha_presentacion, propuesta_servicios(importe)), encargos(id, estado)')
    .order('created_at', { ascending: false })
  if (req.query.estado === 'abiertas') q = q.in('estado', ESTADOS_ABIERTOS)
  else if (req.query.estado) q = q.eq('estado', req.query.estado)
  if (req.query.cliente_id) q = q.eq('cliente_id', aEntero(req.query.cliente_id))
  const s = limpiarBusqueda(req.query.q)
  if (s) q = q.ilike('titulo', `%${s}%`)
  let data = check(await q).map((x) => ({
    id: x.id, titulo: x.titulo, tipo_evento: x.tipo_evento, estado: x.estado, fecha_prevista: x.fecha_prevista,
    asistentes_estimados: x.asistentes_estimados, medio_contacto: x.medio_contacto, origen: x.origen, visto_at: x.visto_at, created_at: x.created_at,
    cliente: x.clientes, sede: x.sedes, sede_detalle: x.sede_detalle,
    propuesta: resumenPropuesta(x.propuestas, req.perfil, hoy), encargo: uno(x.encargos),
  }))
  if (req.query.sin_respuesta === '1') data = data.filter((x) => x.propuesta?.estado === 'pendiente_respuesta')
  if (req.query.sin_propuesta === '1') data = data.filter((x) => !x.propuesta && ESTADOS_ABIERTOS.includes(x.estado))
  res.json(data)
}))

// ---------- Detalle ----------
solicitudesRouter.get('/solicitudes/:id', wrap(async (req, res) => {
  const sol = check(await supabase.from('solicitudes').select('*, clientes(*), sedes(*), encargos(id, nombre, estado, fecha)').eq('id', req.params.id).single())
  const [props, hist] = await Promise.all([
    supabase.from('propuestas').select('*, propuesta_servicios(*, proveedores(id, nombre))').eq('solicitud_id', sol.id).order('id', { ascending: false }),
    supabase.from('historial').select('*').eq('solicitud_id', sol.id).is('encargo_id', null).order('created_at', { ascending: false }),
  ])
  if (sol.origen === 'cliente' && !sol.visto_at) { // el pedido ya fue abierto: deja de figurar como nuevo
    await supabase.from('solicitudes').update({ visto_at: new Date().toISOString() }).eq('id', sol.id)
    sol.visto_at = new Date().toISOString()
  }
  const nm = await nombres()
  const apoyo = esApoyo(req.perfil)
  const hoy = hoyAR()
  const { clientes, sedes, encargos, ...solicitud } = sol
  res.json({
    solicitud: { ...solicitud, creada_por: nombreDe(nm, sol.created_by) },
    cliente: verCliente(clientes, req.perfil), sede: sedes, encargo: uno(encargos),
    propuestas: check(props).map((p) => ({
      ...p, condiciones: apoyo ? null : p.condiciones, respondida_por_nombre: nombreDe(nm, p.respondida_por), creada_por: nombreDe(nm, p.created_by),
      propuesta_servicios: (p.propuesta_servicios || []).sort((a, b) => a.orden - b.orden).map((s) => ({ ...s, importe: apoyo ? null : s.importe })),
      total: apoyo ? null : totalProp(p),
      dias_esperando: p.estado === 'pendiente_respuesta' ? diasEntre(p.fecha_presentacion, hoy) : null,
    })),
    historial: check(hist),
  })
}))

// ---------- Alta y edición ----------
function limpiarSolicitud(b, parcial) {
  const o = {}
  const set = (k, v) => { if (!parcial || b[k] !== undefined) o[k] = v }
  set('titulo', txt(b.titulo, 120)); set('tipo_evento', txt(b.tipo_evento, 60) || 'Otro'); set('necesidades', txt(b.necesidades, 2000))
  set('sede_detalle', txt(b.sede_detalle, 200)); set('medio_contacto', MEDIOS.includes(b.medio_contacto) ? b.medio_contacto : txt(b.medio_contacto, 40))
  set('fecha_prevista', b.fecha_prevista ? b.fecha_prevista : null)
  set('sede_id', b.sede_id ? aEntero(b.sede_id) : null)
  set('asistentes_estimados', b.asistentes_estimados === '' || b.asistentes_estimados == null ? null : personas(b.asistentes_estimados, { min: 0, campo: 'Los asistentes' }))
  if (!parcial) { set('cliente_id', aEntero(b.cliente_id)); if (!o.cliente_id) throw httpError(400, 'Elegí el cliente') }
  if (!parcial && !o.titulo) throw httpError(400, 'Ponele un título a la solicitud (por ejemplo: "Fiesta de Halloween")')
  if (parcial && o.titulo === null) throw httpError(400, 'El título no puede quedar vacío')
  if (o.fecha_prevista && !esFecha(o.fecha_prevista)) throw httpError(400, 'La fecha no es válida')
  if (o.fecha_prevista && o.fecha_prevista < hoyAR()) throw httpError(400, 'La fecha prevista ya pasó')
  if (o.fecha_prevista && o.fecha_prevista > fechaTope()) throw httpError(400, `La fecha prevista no puede ser más de ${LIMITES.anosFuturo} años en el futuro`)
  if (o.asistentes_estimados != null && o.asistentes_estimados < 0) throw httpError(400, 'Los asistentes no pueden ser negativos')
  return o
}

solicitudesRouter.post('/solicitudes', coord, wrap(async (req, res) => {
  const fila = limpiarSolicitud(req.body || {}, false)
  const estado = ESTADOS_ABIERTOS.includes(req.body.estado) ? req.body.estado : 'en_evaluacion'
  check(await supabase.from('clientes').select('id').eq('id', fila.cliente_id).single())

  // Control contra solicitudes duplicadas (mismo cliente, misma fecha o mismo título)
  if (!req.body.forzar) {
    const previas = check(await supabase.from('solicitudes').select('id, titulo, fecha_prevista, estado').eq('cliente_id', fila.cliente_id).neq('estado', 'descartada'))
    const dup = previas.filter((p) => p.titulo.toLowerCase() === fila.titulo.toLowerCase() || (fila.fecha_prevista && p.fecha_prevista === fila.fecha_prevista))
    if (dup.length) throw httpError(409, 'Este cliente ya tiene una solicitud parecida. ¿Es la misma?', { codigo: 'DUPLICADO', duplicados: dup })
  }
  const nueva = check(await supabase.from('solicitudes').insert({ ...fila, estado, created_by: req.perfil.id }).select().single())
  await log(req, { solicitud_id: nueva.id, accion: 'solicitud_creada', detalle: `${fila.titulo}${fila.medio_contacto ? ` (llegó por ${fila.medio_contacto})` : ''}` })
  res.status(201).json(nueva)
}))

solicitudesRouter.put('/solicitudes/:id', coord, wrap(async (req, res) => {
  const previa = check(await supabase.from('solicitudes').select('*').eq('id', req.params.id).single())
  if (previa.estado === 'convertida') throw httpError(409, 'Esta solicitud ya tiene un evento confirmado: los datos del evento se modifican desde el evento (registrando el cambio).')
  if (previa.estado === 'descartada') throw httpError(409, 'La solicitud está descartada: reabrila para modificarla')
  const fila = limpiarSolicitud(req.body || {}, true)
  delete fila.cliente_id
  if (!Object.keys(fila).length) throw httpError(400, 'Nada para actualizar')
  const nueva = check(await supabase.from('solicitudes').update(fila).eq('id', previa.id).select().single())
  for (const k of ['fecha_prevista', 'sede_id', 'asistentes_estimados']) {
    if (k in fila && String(fila[k] ?? '') !== String(previa[k] ?? '')) {
      await log(req, { solicitud_id: previa.id, accion: 'solicitud_modificada', detalle: `Cambió ${k.replace('_', ' ')}`, anterior: previa[k] == null ? null : String(previa[k]), nuevo: fila[k] == null ? null : String(fila[k]) })
    }
  }
  res.json(nueva)
}))

solicitudesRouter.patch('/solicitudes/:id/estado', coord, wrap(async (req, res) => {
  const { estado, motivo } = req.body || {}
  const sol = check(await supabase.from('solicitudes').select('*').eq('id', req.params.id).single())
  if (!ESTADOS_EDITABLES.includes(estado)) throw httpError(400, 'Estado inválido')
  if (sol.estado === 'convertida') throw httpError(409, 'La solicitud ya tiene un evento confirmado')
  if (sol.estado === 'descartada' && estado !== 'en_evaluacion') throw httpError(409, 'Una solicitud descartada solo se puede reabrir (volver a "en evaluación")')
  if (estado === 'descartada') {
    const { data: pend } = await supabase.from('propuestas').select('id').eq('solicitud_id', sol.id).eq('estado', 'pendiente_respuesta')
    if (pend?.length) throw httpError(409, 'Hay una propuesta pendiente de respuesta: registrá primero si el cliente la aceptó o la rechazó')
  }
  const cambios = { estado, motivo_descarte: estado === 'descartada' ? txt(motivo, 500) : null }
  const nueva = check(await supabase.from('solicitudes').update(cambios).eq('id', sol.id).select().single())
  await log(req, { solicitud_id: sol.id, accion: estado === 'descartada' ? 'solicitud_descartada' : sol.estado === 'descartada' ? 'solicitud_reabierta' : 'solicitud_estado',
    detalle: txt(motivo, 500), anterior: sol.estado, nuevo: estado })
  res.json(nueva)
}))

solicitudesRouter.delete('/solicitudes/:id', requireAuth, wrap(async (req, res) => {
  if (req.perfil.rol !== 'super_admin') throw httpError(403, 'Solo un Super Admin puede borrar solicitudes. Si ya no avanza, descartala.')
  const sol = check(await supabase.from('solicitudes').select('estado').eq('id', req.params.id).single())
  if (sol.estado === 'convertida') throw httpError(409, 'Tiene un evento confirmado: no se puede borrar')
  check(await supabase.from('solicitudes').delete().eq('id', req.params.id))
  res.json({ ok: true })
}))

// ---------- Propuestas ----------
solicitudesRouter.post('/solicitudes/:id/propuesta', coord, wrap(async (req, res) => {
  const servicios = normalizarServicios(req.body?.servicios)
  const id = check(await supabase.rpc('guardar_propuesta', {
    p_solicitud_id: Number(req.params.id), p_propuesta_id: null,
    p: { condiciones: txt(req.body?.condiciones, 2000), servicios }, p_user: req.perfil.id, p_nombre: req.perfil.nombre,
  }))
  res.status(201).json({ id })
}))

solicitudesRouter.put('/propuestas/:id', coord, wrap(async (req, res) => {
  const pr = check(await supabase.from('propuestas').select('id, solicitud_id').eq('id', req.params.id).single())
  const servicios = normalizarServicios(req.body?.servicios)
  check(await supabase.rpc('guardar_propuesta', {
    p_solicitud_id: pr.solicitud_id, p_propuesta_id: pr.id,
    p: { condiciones: txt(req.body?.condiciones, 2000), servicios }, p_user: req.perfil.id, p_nombre: req.perfil.nombre,
  }))
  res.json({ id: pr.id })
}))

// Control: ¿hay otro evento activo en esa sede ese día? (aviso, no bloquea: el cliente no pidió resolver conflictos)
export async function conflictosSede(sede_id, fecha, excluirEncargo = null) {
  let q = supabase.from('encargos').select('id, nombre, estado, clientes(nombre)').eq('sede_id', sede_id).eq('fecha', fecha).neq('estado', 'cancelado')
  if (excluirEncargo) q = q.neq('id', excluirEncargo)
  return check(await q).map((e) => ({ id: e.id, nombre: e.nombre, estado: e.estado, cliente: e.clientes?.nombre }))
}

solicitudesRouter.post('/propuestas/:id/aceptar', coord, wrap(async (req, res) => {
  const b = req.body || {}
  if (!esFecha(b.fecha)) throw httpError(400, 'Indicá la fecha acordada del evento')
  if (b.fecha < hoyAR()) throw httpError(400, 'La fecha acordada ya pasó')
  if (b.fecha > fechaTope()) throw httpError(400, `La fecha acordada no puede ser más de ${LIMITES.anosFuturo} años en el futuro`)
  for (const [k, n] of [['hora_inicio', 'La hora de inicio'], ['hora_fin', 'La hora de fin']]) if (b[k] && !hhmm(b[k])) throw httpError(400, `${n} no es válida (formato HH:MM)`)
  if (!b.sede_id) throw httpError(400, 'Indicá la sede acordada')
  const prop = check(await supabase.from('propuestas').select('estado, solicitud_id').eq('id', req.params.id).single())
  const solic = check(await supabase.from('solicitudes').select('estado, asistentes_estimados').eq('id', prop.solicitud_id).single())
  if (solic.estado === 'descartada') throw httpError(409, 'La solicitud está descartada: reabrila antes de registrar la aceptación')
  if (prop.estado !== 'pendiente_respuesta') throw httpError(400, `La propuesta ya está ${prop.estado}: no se puede registrar la aceptación de nuevo`)
  const asist = b.asistentes_estimados === '' || b.asistentes_estimados == null ? solic.asistentes_estimados : personas(b.asistentes_estimados, { min: 0, campo: 'Los asistentes' })
  await exigirCapacidad(aEntero(b.sede_id), asist)
  await exigirEquipo(b.responsable_id || req.perfil.id, 'El responsable tiene que ser alguien del equipo (Super Admin activo)')
  if (!b.forzar) {
    const conf = await conflictosSede(aEntero(b.sede_id), b.fecha)
    if (conf.length) throw httpError(409, 'Ya hay otro evento en esa sede ese día. ¿Querés continuar igual?', { codigo: 'CONFLICTO_SEDE', conflictos: conf })
  }
  const encargo_id = check(await supabase.rpc('aceptar_propuesta', {
    p_propuesta_id: Number(req.params.id),
    p: { fecha: b.fecha, sede_id: aEntero(b.sede_id), condiciones: txt(b.condiciones, 2000), medio_aceptacion: txt(b.medio_aceptacion, 40),
         hora_inicio: b.hora_inicio || null, hora_fin: b.hora_fin || null, nombre: txt(b.nombre, 120),
         asistentes_estimados: b.asistentes_estimados === '' || b.asistentes_estimados == null ? null : personas(b.asistentes_estimados, { min: 0, campo: 'Los asistentes' }),
         responsable_id: b.responsable_id || req.perfil.id },
    p_user: req.perfil.id, p_nombre: req.perfil.nombre,
  }))
  res.status(201).json({ encargo_id })
}))

solicitudesRouter.post('/propuestas/:id/rechazar', coord, wrap(async (req, res) => {
  const pr = check(await supabase.from('propuestas').select('*').eq('id', req.params.id).single())
  if (pr.estado !== 'pendiente_respuesta') throw httpError(409, `La propuesta ya está ${pr.estado}`)
  check(await supabase.from('propuestas').update({
    estado: 'rechazada', fecha_respuesta: hoyAR(), respondida_por: req.perfil.id,
    medio_respuesta: txt(req.body?.medio, 40), observacion_respuesta: txt(req.body?.observacion, 1000),
  }).eq('id', pr.id))
  await log(req, { solicitud_id: pr.solicitud_id, accion: 'propuesta_rechazada', detalle: txt(req.body?.observacion, 1000) || 'El cliente rechazó la propuesta' })
  res.json({ ok: true })
}))
