// Reglas de negocio PURAS (sin base de datos): fáciles de probar con "npm test".
import { httpError, aEntero, txt, diasEntre, dinero } from './util.js'

export const ABIERTOS = ['confirmado', 'en_preparacion']
export const TAREA_ABIERTA = ['pendiente', 'en_curso']

// Valida y limpia los servicios de una propuesta
export function normalizarServicios(arr) {
  if (!Array.isArray(arr) || !arr.length) throw httpError(400, 'La propuesta necesita al menos un servicio')
  if (arr.length > 40) throw httpError(400, 'Demasiados servicios')
  return arr.map((s, i) => {
    const servicio = txt(s.servicio, 80)
    if (!servicio) throw httpError(400, `El servicio #${i + 1} no tiene nombre`)
    const importe = dinero(s.importe ?? 0, `El importe de "${servicio}"`)
    return { servicio, descripcion: txt(s.descripcion, 300), importe, importe_confirmado: !!s.importe_confirmado, proveedor_id: s.proveedor_id ? aEntero(s.proveedor_id) : null }
  })
}

// Total de una propuesta = suma de los importes de sus servicios
export const totalProp = (p) => (p?.propuesta_servicios || []).reduce((t, s) => t + Number(s.importe), 0)

// Total acordado de un evento (solo servicios vigentes). El rol "usuario" no ve importes del cliente.
export function totalServicios(servicios, perfil) {
  if (perfil?.rol === 'usuario') return null
  return servicios.filter((s) => s.activo !== false).reduce((t, s) => t + Number(s.importe || 0), 0)
}

// Pendientes de un evento (sirve para listas, panel y detalle)
export function resumenEncargo(e, hoy, perfil) {
  const servs = (e.encargo_servicios || []).filter((s) => s.activo)
  const tareas = e.tareas || []
  const abiertas = tareas.filter((t) => TAREA_ABIERTA.includes(t.estado))
  const abierto = ABIERTOS.includes(e.estado)
  return {
    servicios_total: servs.length,
    servicios_confirmados: servs.filter((s) => s.participacion === 'confirmada').length,
    // "dijo que está disponible" NO cuenta como confirmado
    servicios_sin_confirmar: servs.filter((s) => s.participacion === 'pendiente' || s.participacion === 'disponibilidad_informada').length,
    servicios_rechazados: servs.filter((s) => s.participacion === 'rechazada').length,
    servicios_sin_proveedor: servs.filter((s) => !s.proveedor_id && s.participacion !== 'rechazada').length,
    tareas_abiertas: abiertas.length,
    tareas_vencidas: abiertas.filter((t) => t.fecha_prevista && t.fecha_prevista < hoy).length,
    cambios_pendientes: (e.cambios || []).filter((c) => c.estado === 'pendiente_conformidad').length,
    para_revisar: servs.filter((s) => s.revisar).length + tareas.filter((t) => t.revisar).length,
    incidentes_pendientes: (e.incidentes || []).filter((i) => i.pendiente && i.pendiente.trim()).length,
    avisos_pendientes: (e.encargo_servicios || []).filter((s) => s.aviso_cancelacion === 'pendiente').length,
    por_cerrar: abierto && e.fecha < hoy,
    dias_para_evento: diasEntre(hoy, e.fecha),
    total: totalServicios(e.encargo_servicios || [], perfil),
  }
}
