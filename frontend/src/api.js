// Cliente de la API: agrega el token, renueva la sesión sola y traduce errores.
const KEY = 'ge5_session'
let session = null
try { session = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { session = null }

export const getSession = () => session
export const setSession = (s) => {
  session = s
  if (s) localStorage.setItem(KEY, JSON.stringify(s))
  else localStorage.removeItem(KEY)
}

export class ApiError extends Error {
  constructor(message, status, detalles, datos) { super(message); this.status = status; this.detalles = detalles; this.datos = datos || {} }
}

let refrescando = null
async function refrescar() {
  if (!session?.refresh_token) throw new ApiError('Sesión vencida', 401)
  if (!refrescando) {
    refrescando = fetch('/api/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new ApiError(d.error || 'Sesión vencida', 401)
      setSession(d)
      return d
    }).finally(() => { refrescando = null })
  }
  return refrescando
}

export async function api(path, { method = 'GET', body, params, signal } = {}) {
  let url = '/api' + path
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    if ([...qs].length) url += (url.includes('?') ? '&' : '?') + qs
  }
  const hacer = () => fetch(url, {
    method, signal,
    headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let r = await hacer()
  if (r.status === 401 && session?.refresh_token && !path.startsWith('/auth/')) {
    try { await refrescar(); r = await hacer() }
    catch { setSession(null); window.dispatchEvent(new Event('ge5:logout')); throw new ApiError('Tu sesión venció, volvé a ingresar', 401) }
  }
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new ApiError(d?.error || `Error ${r.status}`, r.status, d?.detalles, d)
  return d
}
