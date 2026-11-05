// ---------- Formato argentino ----------
const TZ = 'America/Argentina/Buenos_Aires'
export const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

export const $ = (n) => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-AR')
}
// Montos grandes abreviados: $12,5 M
export const $c = (n) => {
  const v = Number(n) || 0, a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 1e9) return `${s}$${(a / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 2 })} mil M`
  if (a >= 1e6) return `${s}$${(a / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  return $(v)
}
export const usd = (n, rate) => (rate > 0 ? 'US$ ' + Math.round((Number(n) || 0) / rate).toLocaleString('es-AR') : '')
export const num = (n) => (Number(n) || 0).toLocaleString('es-AR')
export const pct = (n, d = 1) => (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: d }) + '%'

const d12 = (iso) => new Date(iso + 'T12:00:00Z')
const fmt = (iso, o) => d12(iso).toLocaleDateString('es-AR', { timeZone: 'UTC', ...o })
export const fechaLarga = (iso) => (iso ? fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '')
export const fechaCorta = (iso) => (iso ? fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '') : '')
export const fechaMini = (iso) => (iso ? fmt(iso, { day: 'numeric', month: 'short' }).replace('.', '') : '')
export const diaSemana = (iso) => d12(iso).getUTCDay()
export const sumarDias = (iso, n) => { const t = d12(iso); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
export const diasEntre = (a, b) => Math.round((d12(b) - d12(a)) / 86400000) + 1
export const rangoFechas = (a, b) => (!b || a === b ? fechaCorta(a) : `${fechaMini(a)} → ${fechaMini(b)} ${d12(b).getUTCFullYear()}`)
export const mesLabel = (ym) => {
  const s = new Date(ym + '-15T12:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const cap1 = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ---------- Feriados nacionales de Argentina (orientativo) ----------
// Inamovibles: 1/1, Carnaval (lun y mar), 24/3, 2/4, Viernes Santo, 1/5, 25/5, 20/6, 9/7, 8/12, 25/12.
// Trasladables (Ley 27.399): 17/6, 17/8, 12/10, 20/11 → si caen martes/miércoles pasan al lunes anterior; jueves/viernes al lunes siguiente.
// Los "puentes turísticos" los define el Gobierno cada año: acá solo está cargado 2026.
const PUENTES = { 2026: [['03-23', 'Puente turístico'], ['07-10', 'Puente turístico'], ['12-07', 'Puente turístico']] }
const pascua = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}
const cache = new Map()
export function feriados(year) {
  if (cache.has(year)) return cache.get(year)
  const m = new Map()
  const add = (iso, nombre, tipo = 'feriado') => { if (!m.has(iso)) m.set(iso, { nombre, tipo }) }
  const fijo = (md, n) => add(`${year}-${md}`, n)
  fijo('01-01', 'Año Nuevo'); fijo('03-24', 'Día de la Memoria'); fijo('04-02', 'Día de Malvinas')
  fijo('05-01', 'Día del Trabajador'); fijo('05-25', 'Revolución de Mayo'); fijo('06-20', 'Día de la Bandera')
  fijo('07-09', 'Día de la Independencia'); fijo('12-08', 'Inmaculada Concepción'); fijo('12-25', 'Navidad')
  const p = pascua(year)
  add(sumarDias(p, -2), 'Viernes Santo'); add(sumarDias(p, -47), 'Carnaval'); add(sumarDias(p, -48), 'Carnaval')
  const trasl = (md, n) => {
    const iso = `${year}-${md}`, dow = diaSemana(iso)
    if (dow === 2 || dow === 3) add(sumarDias(iso, -(dow - 1)), n)
    else if (dow === 4 || dow === 5) add(sumarDias(iso, 8 - dow), n)
    else add(iso, n)
  }
  trasl('06-17', 'Paso a la Inmortalidad de Güemes'); trasl('08-17', 'Paso a la Inmortalidad de San Martín')
  trasl('10-12', 'Día del Respeto a la Diversidad Cultural'); trasl('11-20', 'Día de la Soberanía Nacional')
  for (const [md, n] of PUENTES[year] || []) add(`${year}-${md}`, n, 'puente')
  cache.set(year, m)
  return m
}
export const feriadoDe = (iso) => (iso ? feriados(Number(iso.slice(0, 4))).get(iso) || null : null)
// ¿La fecha cae en un fin de semana largo? (feriado el viernes o el lunes de ese finde)
export function esFindeLargo(iso) {
  const dow = diaSemana(iso)
  if (![5, 6, 0, 1].includes(dow)) return false
  const off = { 5: [0, 3], 6: [-1, 2], 0: [-2, 1], 1: [-3, 0] }[dow]
  return !!(feriadoDe(sumarDias(iso, off[0])) || feriadoDe(sumarDias(iso, off[1])))
}

// ---------- Constantes de dominio ----------
export const ESTADOS = {
  solicitud: {
    en_evaluacion: ['En evaluación', 'celeste'], pendiente_informacion: ['Falta información', 'warn'],
    lista_para_propuesta: ['Lista para propuesta', 'violeta'], descartada: ['Descartada', 'gris'], convertida: ['Con evento confirmado', 'verde'],
  },
  propuesta: { pendiente_respuesta: ['Esperando respuesta', 'warn'], aceptada: ['Aceptada', 'verde'], rechazada: ['Rechazada', 'rojo'] },
  evento: { confirmado: ['Confirmado', 'celeste'], en_preparacion: ['En preparación', 'sol'], realizado: ['Realizado', 'verde'], cancelado: ['Cancelado', 'rojo'] },
  participacion: { pendiente: ['Sin respuesta', 'gris'], disponibilidad_informada: ['Dijo que está disponible', 'warn'], confirmada: ['Confirmado', 'verde'], rechazada: ['No participa', 'rojo'] },
  tarea: { pendiente: ['Pendiente', 'gris'], en_curso: ['En curso', 'celeste'], completada: ['Completada', 'verde'], cancelada: ['Cancelada', 'rojo'] },
  cambio: { vigente: ['Vigente', 'verde'], pendiente_conformidad: ['Esperando conformidad del cliente', 'warn'], rechazado_cliente: ['No aceptado por el cliente', 'rojo'] },
}
export const TIPOS_EVENTO = ['Fiesta temática', 'Presentación musical', 'Festival', 'Fiesta privada', 'Otro']
export const SERVICIOS_COMUNES = ['DJ', 'Sonido', 'Iluminación', 'Barra', 'Artista en vivo', 'Pantallas y visuales', 'Seguridad', 'Ambientación', 'Fotografía']
export const MEDIOS = ['WhatsApp', 'Teléfono', 'Presencial', 'Otro']
export const CAUSAS_CANCELACION = ['Solicitada por el cliente', 'Problema con la sede o la fecha', 'No se consiguió un servicio esencial', 'Cambio de condiciones sin acuerdo', 'Problema de último momento', 'Otra']
export const CAMPOS_CAMBIO = { fecha: 'Fecha', sede: 'Sede', servicio: 'Servicio', importe: 'Importe', condiciones: 'Condiciones', otro: 'Otro' }
export const ROLES = { super_admin: 'Super Admin', usuario: 'Usuario' }
export const PROVINCIAS = ['CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']
export const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Frases legibles para el historial
export const ACCION_LABEL = {
  solicitud_creada: 'Solicitud registrada', solicitud_modificada: 'Datos de la solicitud modificados', solicitud_estado: 'Cambió el estado de la solicitud',
  solicitud_descartada: 'Solicitud descartada', solicitud_reabierta: 'Solicitud reabierta',
  propuesta_presentada: 'Propuesta presentada', propuesta_modificada: 'Propuesta modificada', propuesta_rechazada: 'El cliente rechazó la propuesta', propuesta_aceptada: 'El cliente aceptó la propuesta',
  preparacion_iniciada: 'Empezó la preparación', evento_modificado: 'Datos del evento modificados',
  responsable_cambiado: 'Cambió quien coordina el evento', responsable_evento_cambiado: 'Cambió el responsable durante el evento',
  cambio_fecha: 'Cambio de fecha', cambio_sede: 'Cambio de sede', cambio_servicio: 'Cambio en los servicios', cambio_importe: 'Cambio de importe',
  cambio_condiciones: 'Cambio de condiciones', cambio_otro: 'Cambio registrado', cambio_pendiente_conformidad: 'Cambio esperando conformidad del cliente',
  cambio_conformidad: 'El cliente dio su conformidad', cambio_rechazado: 'El cliente no aceptó el cambio',
  proveedor_asignado: 'Proveedor asignado', participacion_pendiente: 'Participación pendiente', participacion_disponibilidad_informada: 'Proveedor dijo que está disponible',
  participacion_confirmada: 'Participación confirmada', participacion_rechazada: 'Proveedor no participa', importe_proveedor: 'Importe informado por el proveedor',
  servicio_revisado: 'Servicio revisado', proveedor_avisado: 'Proveedor avisado de la cancelación', proveedor_aviso_pendiente: 'Aviso de cancelación pendiente',
  tarea_creada: 'Tarea creada', tarea_completada: 'Tarea completada', tarea_estado: 'Cambió el estado de una tarea', tarea_reasignada: 'Tarea reasignada', tarea_eliminada: 'Tarea eliminada',
  incidente_registrado: 'Incidente registrado', incidente_resuelto: 'Incidente resuelto', incidente_eliminado: 'Incidente eliminado', observacion_registrada: 'Observación registrada',
  evento_realizado: 'Evento realizado', evento_cancelado: 'Evento cancelado', evento_reabierto: 'Evento reabierto', cierre_corregido: 'Se corrigió el cierre',
}

// Teléfono → link de WhatsApp (mejor esfuerzo para números argentinos)
export function whatsapp(tel) {
  let d = String(tel || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (!d.startsWith('54')) { d = d.replace(/^0/, ''); if (d.length === 10) d = '549' + d; else d = '54' + d }
  return 'https://wa.me/' + d
}
export const copiar = async (texto) => {
  try { await navigator.clipboard.writeText(texto); return true } catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select()
    const ok = document.execCommand('copy'); t.remove(); return ok
  }
}
export const hora = (h) => (h ? String(h).slice(0, 5) : '')
export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-AR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
export const hace = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'recién'; if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24); return d === 1 ? 'ayer' : `hace ${d} días`
}
export const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }; f.cancel = () => clearTimeout(t); return f }

// ---------- Límites y validaciones compartidas (el servidor valida lo mismo) ----------
export const MAX_PERSONAS = 50000
export const MAX_IMPORTE = 500_000_000
export const fechaMaxima = () => { const d = new Date(hoyAR() + 'T12:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 3); return d.toISOString().slice(0, 10) }
export const telefonoValido = (t) => { const n = String(t || '').replace(/\D/g, ''); return n.length >= 8 && n.length <= 15 }
// Devuelve un texto de error o '' si está todo bien
export function validarPedido({ lugar, asistentes, fecha_prevista, telefono }, { min = 1, max = MAX_PERSONAS } = {}) {
  if (!lugar || lugar.trim().length < 2) return 'Escribí el nombre de tu boliche o festival'
  const n = Number(asistentes)
  if (!Number.isInteger(n) || n < min) return `Indicá cuánta gente entra (mínimo ${num(min)})`
  if (n > max) return `La cantidad máxima de personas es ${num(max)}`
  if (fecha_prevista && (fecha_prevista < hoyAR() || fecha_prevista > fechaMaxima())) return 'La fecha tiene que ser de hoy en adelante y dentro de los próximos 3 años'
  if (!telefonoValido(telefono)) return 'Ingresá un teléfono válido (con código de área) para que el equipo pueda llamarte'
  return ''
}
