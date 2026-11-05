export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    Object.assign(this, extra)
  }
}
export const httpError = (status, message, extra) => new HttpError(status, message, extra)

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// Desempaqueta { data, error } de supabase-js
export const check = ({ data, error }) => {
  if (error) throw error
  return data
}

// Traduce errores de Postgres/PostgREST a respuestas HTTP entendibles
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    const { status, message, stack, name, ...extra } = err
    return res.status(status).json({ error: message, ...extra })
  }
  const code = err?.code
  if (code === '23503') return res.status(409).json({ error: 'No se puede eliminar: está en uso. Podés desactivarlo en lugar de borrarlo.' })
  if (code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos.' })
  if (code === 'PGRST116') return res.status(404).json({ error: 'No encontrado' })
  if (code === 'P0001') return res.status(400).json({ error: err.message }) // raise exception de nuestras funciones SQL
  if (code === '23514') return res.status(400).json({ error: 'Algún valor no es válido (revisá rangos y estados).' })
  console.error('[error]', err)
  res.status(500).json({ error: err?.message || 'Error interno' })
}

const TZ = 'America/Argentina/Buenos_Aires'
// "hoy" en horario argentino (YYYY-MM-DD), sin depender de la zona del servidor
export const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })

export const esFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T12:00:00Z'))
export const sumarDias = (iso, d) => {
  const t = new Date(iso + 'T12:00:00Z')
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}
export const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)

export const aEntero = (v, def = 0) => {
  const x = Math.round(Number(v))
  return Number.isFinite(x) ? x : def
}
export const aNumero = (v, def = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : def
}
export const txt = (v, max = 300) => {
  const s = String(v ?? '').trim().slice(0, max)
  return s || null
}
export const limpiarBusqueda = (q) => String(q || '').replace(/[%_,()*\\]/g, ' ').trim().slice(0, 80)
export const hhmm = (s) => (typeof s === 'string' && /^([01]?\d|2[0-3]):[0-5]\d(:\d{2})?$/.test(s) ? s.slice(0, 5).padStart(5, '0') : null)
// PostgREST puede devolver un objeto o un array de un elemento en relaciones 1 a 1
export const uno = (x) => (Array.isArray(x) ? x[0] ?? null : x ?? null)

// ---------- Límites con sentido (evitan datos absurdos como 1.000.000.000 de personas) ----------
export const LIMITES = { asistentes: 50000, importe: 500_000_000, capacidadSede: 100000, anosFuturo: 3 }
export const fechaTope = () => sumarDias(hoyAR(), 365 * LIMITES.anosFuturo)
// Valida una cantidad de personas: entero entre min y el tope. Devuelve el número o lanza 400.
export function personas(v, { min = 1, campo = 'La cantidad de personas' } = {}) {
  const n = Number(v)
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw httpError(400, `${campo} tiene que ser un número entero`)
  if (n < min) throw httpError(400, `${campo} tiene que ser al menos ${min}`)
  if (n > LIMITES.asistentes) throw httpError(400, `${campo} no puede superar ${LIMITES.asistentes.toLocaleString('es-AR')} personas`)
  return n
}
// Valida una fecha futura razonable (hoy en adelante y hasta 3 años)
export function fechaFutura(v, campo = 'La fecha') {
  if (!esFecha(v)) throw httpError(400, `${campo} no es válida`)
  if (v < hoyAR()) throw httpError(400, `${campo} tiene que ser de hoy en adelante`)
  if (v > fechaTope()) throw httpError(400, `${campo} no puede ser más de ${LIMITES.anosFuturo} años en el futuro`)
  return v
}
export function dinero(v, campo = 'El importe') {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw httpError(400, `${campo} no es válido`)
  if (n > LIMITES.importe) throw httpError(400, `${campo} es demasiado alto (máximo $${LIMITES.importe.toLocaleString('es-AR')})`)
  return n
}
