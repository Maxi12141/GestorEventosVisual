import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth, coord, soloAdmin, requireRol } from '../auth.js'
import { LIMITES, wrap, check, httpError, aEntero, txt, limpiarBusqueda } from '../util.js'
import { verCliente, esCoord, esApoyo, nombres, nombreDe, totalServicios } from '../comun.js'

export const catalogosRouter = Router()
catalogosRouter.use(requireAuth)

// Cada catálogo define cómo limpiar/validar sus campos
const ENT = {
  clientes: {
    orden: 'nombre', escribe: coord,
    limpiar(b, parcial) {
      const o = {}
      const set = (k, v) => { if (!parcial || b[k] !== undefined) o[k] = v }
      set('nombre', txt(b.nombre, 100)); set('boliche', txt(b.boliche, 100)); set('telefono', txt(b.telefono, 40))
      set('email', txt(b.email, 120)); set('notas', txt(b.notas, 1000)); set('activo', b.activo === undefined ? true : !!b.activo)
      if (!parcial && !o.nombre) throw httpError(400, 'Falta el nombre del cliente')
      if (parcial && o.nombre === null) throw httpError(400, 'El nombre no puede quedar vacío')
      if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw httpError(400, 'El email no es válido')
      return o
    },
  },
  sedes: {
    orden: 'nombre', escribe: coord,
    limpiar(b, parcial) {
      const o = {}
      const set = (k, v) => { if (!parcial || b[k] !== undefined) o[k] = v }
      set('nombre', txt(b.nombre, 100)); set('ciudad', txt(b.ciudad, 80)); set('provincia', txt(b.provincia, 60))
      set('direccion', txt(b.direccion, 160)); set('notas', txt(b.notas, 500)); set('activo', b.activo === undefined ? true : !!b.activo)
      set('capacidad', b.capacidad === '' || b.capacidad == null ? null : aEntero(b.capacidad))
      set('cliente_id', b.cliente_id ? aEntero(b.cliente_id) : null)
      if (!parcial && !o.nombre) throw httpError(400, 'Falta el nombre de la sede')
      if (parcial && o.nombre === null) throw httpError(400, 'El nombre no puede quedar vacío')
      if (o.capacidad != null && (o.capacidad <= 0 || o.capacidad > LIMITES.capacidadSede)) throw httpError(400, `La capacidad tiene que estar entre 1 y ${LIMITES.capacidadSede.toLocaleString('es-AR')}`)
      return o
    },
  },
  proveedores: {
    orden: 'nombre', escribe: requireRol('super_admin', 'admin', 'usuario'), // apoyo busca y contacta proveedores
    limpiar(b, parcial) {
      const o = {}
      const set = (k, v) => { if (!parcial || b[k] !== undefined) o[k] = v }
      set('nombre', txt(b.nombre, 100)); set('servicio', txt(b.servicio, 60)); set('contacto', txt(b.contacto, 100))
      set('telefono', txt(b.telefono, 40)); set('email', txt(b.email, 120)); set('notas', txt(b.notas, 1000)); set('activo', b.activo === undefined ? true : !!b.activo)
      if (!parcial && (!o.nombre || !o.servicio)) throw httpError(400, 'Faltan el nombre y el servicio que presta (DJ, sonido, etc.)')
      if (parcial && (o.nombre === null || o.servicio === null)) throw httpError(400, 'Nombre y servicio no pueden quedar vacíos')
      return o
    },
  },
}

for (const [ruta, ent] of Object.entries(ENT)) {
  catalogosRouter.get(`/${ruta}`, wrap(async (req, res) => {
    let q = supabase.from(ruta).select('*').order(ent.orden)
    if (req.query.activo === 'true') q = q.eq('activo', true)
    if (req.query.servicio && ruta === 'proveedores') q = q.ilike('servicio', `%${limpiarBusqueda(req.query.servicio)}%`)
    const s = limpiarBusqueda(req.query.q)
    if (s) q = q.or(ruta === 'clientes' ? `nombre.ilike.%${s}%,boliche.ilike.%${s}%` : ruta === 'sedes' ? `nombre.ilike.%${s}%,ciudad.ilike.%${s}%` : `nombre.ilike.%${s}%,servicio.ilike.%${s}%`)
    const data = check(await q)
    res.json(ruta === 'clientes' ? data.map((c) => verCliente(c, req.perfil)) : data)
  }))
  catalogosRouter.post(`/${ruta}`, ent.escribe, wrap(async (req, res) => {
    const fila = ent.limpiar(req.body || {}, false)
    if (ruta === 'clientes') fila.created_by = req.perfil.id
    res.status(201).json(check(await supabase.from(ruta).insert(fila).select().single()))
  }))
  catalogosRouter.put(`/${ruta}/:id`, ent.escribe, wrap(async (req, res) => {
    const fila = ent.limpiar(req.body || {}, true)
    if (!Object.keys(fila).length) throw httpError(400, 'Nada para actualizar')
    res.json(check(await supabase.from(ruta).update(fila).eq('id', req.params.id).select().single()))
  }))
  catalogosRouter.delete(`/${ruta}/:id`, soloAdmin, wrap(async (req, res) => {
    check(await supabase.from(ruta).delete().eq('id', req.params.id))
    res.json({ ok: true })
  }))
}

// ---------- Fichas con antecedentes ----------
const resumenEnc = (e) => ({ id: e.id, nombre: e.nombre, fecha: e.fecha, estado: e.estado, tipo_evento: e.tipo_evento })

// Todo lo que pasó con un cliente: solicitudes, propuestas y eventos
catalogosRouter.get('/clientes/:id/antecedentes', wrap(async (req, res) => {
  const cliente = check(await supabase.from('clientes').select('*').eq('id', req.params.id).single())
  const [sols, encs, sedes] = await Promise.all([
    supabase.from('solicitudes').select('id, titulo, tipo_evento, fecha_prevista, estado, motivo_descarte, created_at, propuestas(id, estado, fecha_presentacion, observacion_respuesta, propuesta_servicios(importe))').eq('cliente_id', cliente.id).order('created_at', { ascending: false }),
    supabase.from('encargos').select('id, nombre, fecha, estado, tipo_evento, condiciones, motivo_cancelacion, observaciones_cierre, sedes(nombre), encargo_servicios(servicio, importe, activo)').eq('cliente_id', cliente.id).order('fecha', { ascending: false }),
    supabase.from('sedes').select('id, nombre, ciudad').eq('cliente_id', cliente.id),
  ])
  const apoyo = esApoyo(req.perfil)
  res.json({
    cliente: verCliente(cliente, req.perfil),
    sedes: check(sedes),
    solicitudes: check(sols).map((s) => ({
      ...s, propuestas: (s.propuestas || []).map((p) => ({
        id: p.id, estado: p.estado, fecha_presentacion: p.fecha_presentacion, observacion_respuesta: p.observacion_respuesta,
        total: apoyo ? null : (p.propuesta_servicios || []).reduce((t, x) => t + Number(x.importe), 0),
      })),
    })),
    eventos: check(encs).map((e) => ({ ...resumenEnc(e), sede: e.sedes?.nombre, condiciones: e.condiciones, motivo_cancelacion: e.motivo_cancelacion, observaciones_cierre: e.observaciones_cierre,
      servicios: (e.encargo_servicios || []).filter((s) => s.activo).map((s) => s.servicio), total: totalServicios(e.encargo_servicios || [], req.perfil) })),
  })
}))

// En qué eventos participa un proveedor y qué observaciones tiene
catalogosRouter.get('/proveedores/:id/antecedentes', wrap(async (req, res) => {
  const proveedor = check(await supabase.from('proveedores').select('*').eq('id', req.params.id).single())
  const [serv, obs] = await Promise.all([
    supabase.from('encargo_servicios').select('id, servicio, participacion, importe_proveedor, activo, encargos(id, nombre, fecha, estado, sedes(nombre))').eq('proveedor_id', proveedor.id),
    supabase.from('observaciones').select('id, texto, created_at, registrado_por, encargos(id, nombre, fecha)').eq('proveedor_id', proveedor.id).order('created_at', { ascending: false }),
  ])
  const nm = await nombres()
  res.json({
    proveedor,
    eventos: check(serv).filter((s) => s.activo && s.encargos).map((s) => ({
      servicio_id: s.id, servicio: s.servicio, participacion: s.participacion, importe_proveedor: s.importe_proveedor,
      evento: { id: s.encargos.id, nombre: s.encargos.nombre, fecha: s.encargos.fecha, estado: s.encargos.estado, sede: s.encargos.sedes?.nombre },
    })).sort((a, b) => b.evento.fecha.localeCompare(a.evento.fecha)),
    observaciones: check(obs).map((o) => ({ ...o, registrado_por_nombre: nombreDe(nm, o.registrado_por) })),
  })
}))

// Eventos de una sede
catalogosRouter.get('/sedes/:id/antecedentes', wrap(async (req, res) => {
  const sede = check(await supabase.from('sedes').select('*, clientes(id, nombre, boliche)').eq('id', req.params.id).single())
  const encs = check(await supabase.from('encargos').select('id, nombre, fecha, estado, tipo_evento').eq('sede_id', sede.id).order('fecha', { ascending: false }))
  res.json({ sede: { ...sede, clientes: verCliente(sede.clientes, req.perfil) }, eventos: encs })
}))

// Conveniencia: ¿quién puede ver contacto de clientes?
export const puedeVerContacto = (perfil) => esCoord(perfil)
