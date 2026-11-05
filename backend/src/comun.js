// Piezas compartidas: nombres de usuarios, historial y reglas de permisos / confidencialidad.
import { supabase } from './supabase.js'
import { check, httpError } from './util.js'

// ---------- Nombres de usuarios (equipo chico: se cachea 30 s) ----------
let cache = { t: 0, map: new Map() }
export async function nombres() {
  if (Date.now() - cache.t < 30_000) return cache.map
  const filas = check(await supabase.from('perfiles').select('id, nombre, email, rol, activo'))
  cache = { t: Date.now(), map: new Map(filas.map((f) => [f.id, f])) }
  return cache.map
}
export const olvidarNombres = () => { cache = { t: 0, map: new Map() } }
export const nombreDe = (map, id) => (id ? map.get(id)?.nombre || map.get(id)?.email || 'Usuario eliminado' : null)

// ---------- Roles ----------
export const esCoord = (perfil) => perfil?.rol === 'super_admin'
export const esApoyo = (perfil) => perfil?.rol === 'usuario'
// Quien coordina el evento o lo atiende durante la realización
export const esResponsable = (perfil, enc) => !!perfil && (enc.responsable_id === perfil.id || enc.responsable_evento_id === perfil.id)

// ---------- Historial ----------
export async function log(req, { solicitud_id = null, encargo_id = null, accion, detalle = null, anterior = null, nuevo = null }) {
  check(await supabase.from('historial').insert({
    solicitud_id, encargo_id, accion, detalle, valor_anterior: anterior, valor_nuevo: nuevo,
    usuario_id: req.perfil.id, usuario_nombre: req.perfil.nombre || req.perfil.email,
  }))
}

// ---------- Confidencialidad ----------
// Criterio inicial (a validar con el cliente): "apoyo" no ve datos de contacto de clientes ni los
// importes acordados con el cliente. Sí ve los importes que informan los proveedores.
export function verCliente(c, perfil) {
  if (!c || !esApoyo(perfil)) return c
  return { id: c.id, nombre: c.nombre, boliche: c.boliche, activo: c.activo }
}
export function verServicio(s, perfil) {
  return esApoyo(perfil) ? { ...s, importe: null } : s
}
export function verCambio(c, perfil) {
  if (!esApoyo(perfil) || c.campo !== 'importe') return c
  return { ...c, valor_anterior: null, valor_nuevo: null, payload: {} }
}
export { totalServicios } from './reglas.js'

// ---------- Equipo ----------
// El equipo son SOLO los Super Admin activos. Los Usuarios (clientes) nunca pueden ser responsables de nada.
export const esEquipoActivo = (map, id) => { const u = map.get(id); return !!u && u.rol === 'super_admin' && u.activo !== false }
export async function exigirEquipo(id, msg = 'Esa persona no existe, está desactivada o no es parte del equipo') {
  if (!id) return
  if (!esEquipoActivo(await nombres(), id)) throw httpError(400, msg)
}

// ---------- Capacidad de la sede ----------
// Si la sede tiene capacidad cargada, el evento no puede superarla.
export async function exigirCapacidad(sede_id, asistentes) {
  if (!sede_id || asistentes == null) return
  const { data: sede } = await supabase.from('sedes').select('nombre, capacidad').eq('id', sede_id).maybeSingle()
  if (sede?.capacidad && asistentes > sede.capacidad)
    throw httpError(400, `La sede "${sede.nombre}" tiene capacidad para ${sede.capacidad.toLocaleString('es-AR')} personas y el evento es para ${asistentes.toLocaleString('es-AR')}. Elegí otra sede o corregí la cantidad.`)
}
