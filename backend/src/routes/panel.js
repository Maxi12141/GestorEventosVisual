import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth } from '../auth.js'
import { wrap, check, esFecha, hoyAR, sumarDias, diasEntre, uno } from '../util.js'
import { nombres, nombreDe, esApoyo } from '../comun.js'
import { resumenEncargo } from './encargos.js'
import { ESTADOS_ABIERTOS, totalProp } from './solicitudes.js'

export const panelRouter = Router()
panelRouter.use(requireAuth)

const EMBED = `*, clientes(id, nombre, boliche), sedes(id, nombre),
  encargo_servicios(id, servicio, activo, participacion, proveedor_id, importe, revisar, aviso_cancelacion, proveedores(nombre)),
  tareas(id, estado, fecha_prevista, revisar), incidentes(id, pendiente, descripcion), cambios(id, estado, descripcion, campo)`

// Panel de trabajo: lo que hay que atender hoy
panelRouter.get('/panel', wrap(async (req, res) => {
  const hoy = hoyAR()
  const nm = await nombres()
  const [encsR, solsR, tarsR] = await Promise.all([
    supabase.from('encargos').select(EMBED).order('fecha'),
    supabase.from('solicitudes').select('id, titulo, tipo_evento, estado, fecha_prevista, created_at, clientes(id, nombre, boliche), propuestas(id, estado, fecha_presentacion, propuesta_servicios(importe))').in('estado', ESTADOS_ABIERTOS).order('created_at'),
    supabase.from('tareas').select('*, encargos(id, nombre, fecha, estado)').in('estado', ['pendiente', 'en_curso']).order('fecha_prevista', { nullsFirst: false }),
  ])
  const encs = check(encsR)
  const abiertos = encs.filter((e) => ['confirmado', 'en_preparacion'].includes(e.estado))
  const conRes = abiertos.map((e) => ({ e, r: resumenEncargo(e, hoy, req.perfil) }))
  const fila = ({ e, r }) => ({ id: e.id, nombre: e.nombre, fecha: e.fecha, estado: e.estado, tipo_evento: e.tipo_evento, cliente: e.clientes, sede: e.sedes, responsable: nombreDe(nm, e.responsable_id), resumen: r })

  const proximos = conRes.filter((x) => x.e.fecha >= hoy)
  const limite = sumarDias(hoy, 30)
  const tareas = check(tarsR).filter((t) => t.encargos && ['confirmado', 'en_preparacion'].includes(t.encargos.estado))
    .map((t) => ({ id: t.id, titulo: t.titulo, estado: t.estado, fecha_prevista: t.fecha_prevista, responsable_id: t.responsable_id, responsable: nombreDe(nm, t.responsable_id),
      vencida: !!t.fecha_prevista && t.fecha_prevista < hoy, evento: { id: t.encargos.id, nombre: t.encargos.nombre, fecha: t.encargos.fecha } }))

  const sols = check(solsR).map((s) => {
    const props = [...(s.propuestas || [])].sort((a, b) => b.id - a.id)
    const vig = props.find((p) => p.estado !== 'rechazada')
    return { id: s.id, titulo: s.titulo, estado: s.estado, fecha_prevista: s.fecha_prevista, cliente: s.clientes, dias: diasEntre(s.created_at.slice(0, 10), hoy),
      propuesta: vig ? { id: vig.id, estado: vig.estado, dias_esperando: diasEntre(vig.fecha_presentacion, hoy), total: esApoyo(req.perfil) ? null : totalProp(vig) } : null }
  })
  const sinRespuesta = sols.filter((s) => s.propuesta?.estado === 'pendiente_respuesta')

  const serviciosSinConfirmar = []
  for (const { e } of proximos.filter((x) => x.e.fecha <= limite)) {
    for (const s of e.encargo_servicios.filter((s) => s.activo && ['pendiente', 'disponibilidad_informada'].includes(s.participacion))) {
      serviciosSinConfirmar.push({ id: s.id, servicio: s.servicio, participacion: s.participacion, proveedor: s.proveedores?.nombre || null,
        evento: { id: e.id, nombre: e.nombre, fecha: e.fecha }, dias: diasEntre(hoy, e.fecha) })
    }
  }
  serviciosSinConfirmar.sort((a, b) => a.dias - b.dias)

  const cambiosPend = []
  for (const { e } of conRes) for (const c of e.cambios.filter((c) => c.estado === 'pendiente_conformidad')) cambiosPend.push({ id: c.id, descripcion: c.descripcion, campo: c.campo, evento: { id: e.id, nombre: e.nombre } })
  const incPend = []
  for (const e of encs.filter((x) => x.estado !== 'cancelado')) for (const i of e.incidentes.filter((i) => i.pendiente && i.pendiente.trim())) incPend.push({ id: i.id, descripcion: i.descripcion, pendiente: i.pendiente, evento: { id: e.id, nombre: e.nombre } })
  const avisos = encs.filter((e) => e.estado === 'cancelado' && e.encargo_servicios.some((s) => s.aviso_cancelacion === 'pendiente'))
    .map((e) => ({ id: e.id, nombre: e.nombre, pendientes: e.encargo_servicios.filter((s) => s.aviso_cancelacion === 'pendiente').map((s) => `${s.servicio}${s.proveedores?.nombre ? ' · ' + s.proveedores.nombre : ''}`) }))

  const vencidas = tareas.filter((t) => t.vencida)
  res.json({
    hoy,
    kpis: {
      proximos_30d: proximos.filter((x) => x.e.fecha <= limite).length,
      solicitudes_abiertas: sols.length,
      propuestas_sin_respuesta: sinRespuesta.length,
      servicios_sin_confirmar: serviciosSinConfirmar.length,
      tareas_vencidas: vencidas.length,
      por_cerrar: conRes.filter((x) => x.r.por_cerrar).length,
      cambios_pendientes: cambiosPend.length,
    },
    mis_tareas: tareas.filter((t) => t.responsable_id === req.perfil.id).slice(0, 12),
    tareas_vencidas: vencidas.slice(0, 8),
    proximos: proximos.slice(0, 6).map(fila),
    por_cerrar: conRes.filter((x) => x.r.por_cerrar).map(fila),
    para_revisar: conRes.filter((x) => x.r.para_revisar > 0).map(fila),
    servicios_sin_confirmar: serviciosSinConfirmar.slice(0, 10),
    solicitudes: sols.filter((s) => !s.propuesta).slice(0, 8),
    propuestas_sin_respuesta: sinRespuesta.sort((a, b) => b.propuesta.dias_esperando - a.propuesta.dias_esperando).slice(0, 8),
    cambios_pendientes: cambiosPend.slice(0, 6),
    incidentes_pendientes: incPend.slice(0, 5),
    avisos_cancelacion: avisos,
  })
}))

// Calendario: eventos, solicitudes con fecha prevista y tareas con fecha
panelRouter.get('/calendario', wrap(async (req, res) => {
  const desde = esFecha(req.query.desde) ? req.query.desde : hoyAR()
  const hasta = esFecha(req.query.hasta) ? req.query.hasta : sumarDias(desde, 42)
  const [e, s, t] = await Promise.all([
    supabase.from('encargos').select('id, nombre, fecha, estado, tipo_evento, hora_inicio, sedes(nombre), clientes(nombre, boliche)').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
    supabase.from('solicitudes').select('id, titulo, fecha_prevista, estado, clientes(nombre, boliche)').in('estado', ESTADOS_ABIERTOS).gte('fecha_prevista', desde).lte('fecha_prevista', hasta),
    supabase.from('tareas').select('id, titulo, fecha_prevista, estado, encargo_id, encargos(nombre, estado)').in('estado', ['pendiente', 'en_curso']).gte('fecha_prevista', desde).lte('fecha_prevista', hasta),
  ])
  res.json({
    eventos: check(e).map((x) => ({ id: x.id, nombre: x.nombre, fecha: x.fecha, estado: x.estado, tipo_evento: x.tipo_evento, hora_inicio: x.hora_inicio, sede: x.sedes?.nombre, cliente: x.clientes?.boliche || x.clientes?.nombre })),
    solicitudes: check(s).map((x) => ({ id: x.id, titulo: x.titulo, fecha_prevista: x.fecha_prevista, estado: x.estado, cliente: x.clientes?.boliche || x.clientes?.nombre })),
    tareas: check(t).filter((x) => x.encargos && ['confirmado', 'en_preparacion'].includes(x.encargos.estado)).map((x) => ({ id: x.id, titulo: x.titulo, fecha_prevista: x.fecha_prevista, encargo_id: x.encargo_id, evento: x.encargos.nombre })),
  })
}))

// Personas del equipo (para elegir responsables). Solo Super Admin activos (los Usuarios son clientes).
panelRouter.get('/equipo', wrap(async (_req, res) => {
  const nm = await nombres()
  res.json([...nm.values()].filter((u) => u.activo !== false && u.rol === 'super_admin').map((u) => ({ id: u.id, nombre: u.nombre || u.email, rol: u.rol })).sort((a, b) => a.nombre.localeCompare(b.nombre)))
}))
