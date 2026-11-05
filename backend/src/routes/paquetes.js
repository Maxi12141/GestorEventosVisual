import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { supabase } from '../supabase.js'
import { requireAuth, coord, soloAdmin } from '../auth.js'
import { wrap, check, httpError, aEntero, txt, personas, fechaFutura, dinero, LIMITES } from '../util.js'
import { esCoord } from '../comun.js'

export const paquetesRouter = Router()

// Teléfono obligatorio: el equipo lo usa para llamar al cliente por cualquier consulta
function telefonoObligatorio(v) {
  const t = txt(v, 40)
  if (!t || t.replace(/\D/g, '').length < 6) throw httpError(400, 'El teléfono es obligatorio: así el equipo puede llamarte por cualquier consulta')
  return t
}
const TIPOS = ['Boliche', 'Festival', 'Otro']

// Los pedidos los hacen los Usuarios (clientes). El Super Admin no pide paquetes: los recibe.
const soloUsuario = (req, _res, next) => (req.perfil.rol === 'usuario' ? next() : next(httpError(403, 'Los pedidos los hacen los usuarios. Vos los recibís en Solicitudes.')))
// Freno anti-spam: máximo 10 pedidos cada 10 minutos por persona
const limitePedidos = rateLimit({ windowMs: 10 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip, message: { error: 'Hiciste muchos pedidos seguidos. Esperá unos minutos y probá de nuevo.' } })

// Evita pedidos duplicados por doble clic: mismo usuario, mismo título y misma cantidad en los últimos 2 minutos
async function evitarDuplicado(req, titulo, asistentes) {
  const desde = new Date(Date.now() - 120_000).toISOString()
  const { data } = await supabase.from('solicitudes').select('id').eq('created_by', req.user.id).eq('titulo', titulo)
    .eq('asistentes_estimados', asistentes).gte('created_at', desde).limit(1)
  if (data?.length) throw httpError(409, 'Ya enviaste este mismo pedido hace un momento. Lo ves en "Mis pedidos".')
}

function leer(b) {
  const nombre = txt(b.nombre, 80)
  if (!nombre) throw httpError(400, 'Poné un nombre para el paquete')
  const min = personas(b.capacidad_min, { min: 1, campo: 'La capacidad mínima' })
  const max = personas(b.capacidad_max, { min: 1, campo: 'La capacidad máxima' })
  if (max < min) throw httpError(400, 'La capacidad máxima tiene que ser mayor o igual que la mínima')
  const precio = dinero(b.precio, 'El precio')
  const servicios = (Array.isArray(b.servicios) ? b.servicios : []).map((s) => txt(s, 60)).filter(Boolean).slice(0, 20)
  const incluye = (Array.isArray(b.incluye) ? b.incluye : []).map((s) => txt(s, 140)).filter(Boolean).slice(0, 20)
  return {
    nombre, descripcion: txt(b.descripcion, 600) || null, tipo: TIPOS.includes(b.tipo) ? b.tipo : 'Otro',
    capacidad_min: min, capacidad_max: max, precio, servicios, activo: b.activo !== false,
    incluye, duracion: txt(b.duracion, 40) || null, ideal_para: txt(b.ideal_para, 120) || null,
  }
}

// Catálogo: el Usuario ve solo los activos; ?capacidad=N filtra los que le sirven
paquetesRouter.get('/paquetes', requireAuth, wrap(async (req, res) => {
  let q = supabase.from('paquetes').select('*').order('capacidad_min')
  if (!esCoord(req.perfil)) q = q.eq('activo', true)
  const cap = aEntero(req.query.capacidad)
  if (cap) q = q.lte('capacidad_min', cap).gte('capacidad_max', cap)
  res.json(check(await q))
}))

paquetesRouter.post('/paquetes', requireAuth, coord, wrap(async (req, res) => {
  res.status(201).json(check(await supabase.from('paquetes').insert({ ...leer(req.body), created_by: req.perfil.id }).select().single()))
}))
paquetesRouter.patch('/paquetes/:id', requireAuth, coord, wrap(async (req, res) => {
  res.json(check(await supabase.from('paquetes').update(leer(req.body)).eq('id', req.params.id).select().single()))
}))
paquetesRouter.delete('/paquetes/:id', requireAuth, soloAdmin, wrap(async (req, res) => {
  check(await supabase.from('paquetes').delete().eq('id', req.params.id))
  res.json({ ok: true })
}))

// Contratar un paquete → crea (o reutiliza) el cliente y deja una solicitud para que el Admin la siga
paquetesRouter.post('/paquetes/:id/contratar', requireAuth, soloUsuario, limitePedidos, wrap(async (req, res) => {
  const p = check(await supabase.from('paquetes').select('*').eq('id', req.params.id).single())
  if (!p.activo) throw httpError(400, 'Ese paquete ya no está disponible')
  const b = req.body || {}
  const lugar = txt(b.lugar, 100)
  if (lugar && lugar.length < 2) throw httpError(400, 'El nombre del lugar es muy corto')
  if (!lugar) throw httpError(400, 'Indicá el nombre de tu boliche o festival')
  const asistentes = personas(b.asistentes, { campo: 'La cantidad de personas' })
  if (asistentes < p.capacidad_min || asistentes > p.capacidad_max)
    throw httpError(400, `Este paquete es para ${p.capacidad_min} a ${p.capacidad_max} personas`)
  if (b.fecha_prevista) fechaFutura(b.fecha_prevista, 'La fecha deseada')
  await evitarDuplicado(req, `${p.nombre} · ${lugar}`, asistentes)

  const telefono = telefonoObligatorio(b.telefono)
  const email = req.user.email
  let { data: cli } = await supabase.from('clientes').select('id').eq('email', email).limit(1).maybeSingle()
  if (cli) check(await supabase.from('clientes').update({ telefono, boliche: lugar }).eq('id', cli.id))
  else cli = check(await supabase.from('clientes').insert({
    nombre: req.perfil.nombre || email, boliche: lugar, email, telefono, created_by: req.perfil.id,
  }).select('id').single())

  const sol = check(await supabase.from('solicitudes').insert({
    cliente_id: cli.id, titulo: `${p.nombre} · ${lugar}`, tipo_evento: p.tipo === 'Festival' ? 'Festival' : 'Fiesta privada',
    fecha_prevista: b.fecha_prevista || null, asistentes_estimados: asistentes, paquete_id: p.id,
    necesidades: [`Teléfono de contacto: ${telefono}`, `Paquete: ${p.nombre} (${(p.servicios || []).join(', ')})`, txt(b.notas, 1000)].filter(Boolean).join('\n'),
    medio_contacto: 'Otro', origen: 'cliente', created_by: req.perfil.id,
  }).select().single())
  res.status(201).json({ id: sol.id })
}))

// ---------- Armar el paquete propio ----------
// Servicios que el cliente puede elegir. porPersona: el precio se multiplica por la cantidad de gente.
// Los precios son de referencia: el equipo confirma el importe final en la propuesta.
export const SERVICIOS_ARMAR = [
  { nombre: 'DJ', detalle: 'DJ durante 5 horas con equipo propio', precio: 250000 },
  { nombre: 'Sonido profesional', detalle: 'Parlantes, consola y técnico de sonido', precio: 300000 },
  { nombre: 'Iluminación y láser', detalle: 'Luces de pista, cabezales y láser', precio: 220000 },
  { nombre: 'Pantallas y visuales', detalle: 'Pantallas LED con visuales para la pista', precio: 380000 },
  { nombre: 'Artista local en vivo', detalle: 'Banda o artista argentino de la zona, show de 60 minutos', precio: 1200000 },
  { nombre: 'Artista nacional en vivo', detalle: 'Artista argentino reconocido, show de 90 minutos', precio: 4500000 },
  { nombre: 'Barra de tragos', detalle: 'Carta de tragos y bebidas sin alcohol, por persona', precio: 2500, porPersona: true },
  { nombre: 'Seguridad', detalle: 'Personal de seguridad y control de acceso, por persona que entra', precio: 700, porPersona: true },
  { nombre: 'Ambientación y decoración', detalle: 'Decoración del lugar según la temática', precio: 280000 },
  { nombre: 'Fotografía y video', detalle: 'Fotógrafo y video resumen del evento', precio: 200000 },
  { nombre: 'Animación / MC', detalle: 'Presentador que anima la noche', precio: 150000 },
  { nombre: 'Efectos especiales', detalle: 'Humo, chispas frías y confeti', precio: 180000 },
]
const totalDe = (elegidos, asistentes) => elegidos.reduce((t, s) => t + (s.porPersona ? s.precio * asistentes : s.precio), 0)

paquetesRouter.get('/paquetes-servicios', requireAuth, (_req, res) => res.json(SERVICIOS_ARMAR))

// El cliente arma su paquete y se lo manda al equipo como solicitud
paquetesRouter.post('/paquetes-armar', requireAuth, soloUsuario, limitePedidos, wrap(async (req, res) => {
  const b = req.body || {}
  const lugar = txt(b.lugar, 100)
  if (lugar && lugar.length < 2) throw httpError(400, 'El nombre del lugar es muy corto')
  if (!lugar) throw httpError(400, 'Indicá el nombre de tu boliche o festival')
  const asistentes = personas(b.asistentes, { campo: 'La cantidad de personas' })
  if (b.fecha_prevista) fechaFutura(b.fecha_prevista, 'La fecha deseada')
  await evitarDuplicado(req, `Paquete a medida · ${lugar}`, asistentes)
  const nombres = Array.isArray(b.servicios) ? b.servicios : []
  const elegidos = SERVICIOS_ARMAR.filter((s) => nombres.includes(s.nombre))
  if (!elegidos.length) throw httpError(400, 'Elegí al menos un servicio para tu paquete')
  const total = totalDe(elegidos, asistentes)

  const telefono = telefonoObligatorio(b.telefono)
  const email = req.user.email
  let { data: cli } = await supabase.from('clientes').select('id').eq('email', email).limit(1).maybeSingle()
  if (cli) check(await supabase.from('clientes').update({ telefono, boliche: lugar }).eq('id', cli.id))
  else cli = check(await supabase.from('clientes').insert({
    nombre: req.perfil.nombre || email, boliche: lugar, email, telefono, created_by: req.perfil.id,
  }).select('id').single())

  const lineas = elegidos.map((s) => `• ${s.nombre}${s.porPersona ? ` (${asistentes} personas)` : ''}`)
  const sol = check(await supabase.from('solicitudes').insert({
    cliente_id: cli.id, titulo: `Paquete a medida · ${lugar}`, tipo_evento: b.tipo === 'Festival' ? 'Festival' : 'Fiesta privada',
    fecha_prevista: b.fecha_prevista || null, asistentes_estimados: asistentes, total_estimado: total,
    necesidades: [`Teléfono de contacto: ${telefono}`, 'El cliente armó su propio paquete con estos servicios:', ...lineas, `Total estimado por el cliente: $${total.toLocaleString('es-AR')}`, txt(b.notas, 1000)].filter(Boolean).join('\n'),
    medio_contacto: 'Otro', origen: 'cliente', created_by: req.perfil.id,
  }).select().single())
  res.status(201).json({ id: sol.id })
}))

// Pedidos del usuario logueado
paquetesRouter.get('/mis-pedidos', requireAuth, wrap(async (req, res) => {
  const data = check(await supabase.from('solicitudes').select('id, titulo, estado, motivo_descarte, fecha_prevista, asistentes_estimados, created_at, necesidades, total_estimado, paquete_id, paquetes(nombre, precio), propuestas(estado)')
    .eq('created_by', req.user.id).order('created_at', { ascending: false }).limit(100))
  res.json(data)
}))

// ---------- Aviso a los Super Admin: pedidos de clientes sin abrir ----------
paquetesRouter.get('/pedidos-nuevos', requireAuth, coord, wrap(async (_req, res) => {
  const { data, count } = await supabase.from('solicitudes')
    .select('id, titulo, asistentes_estimados, fecha_prevista, created_at', { count: 'exact' })
    .eq('origen', 'cliente').is('visto_at', null).order('created_at', { ascending: false }).limit(5)
  res.json({ cantidad: count || 0, ultimos: data || [] })
}))
