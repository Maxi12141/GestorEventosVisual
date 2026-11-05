import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from './config.js'
import { supabase, authClient } from './supabase.js'
import { wrap, check, httpError } from './util.js'
import { olvidarNombres } from './comun.js'

export const ROLES = ['super_admin', 'usuario']
const emailOk = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
const cache = new Map() // token → { user, perfil, t }
const TTL = 20_000

// Devuelve el perfil del usuario; lo crea si no existe (por si el trigger no corrió)
async function asegurarPerfil(user) {
  let { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle()
  const esAdminEnv = env.adminEmail && user.email?.toLowerCase() === env.adminEmail
  if (!perfil) {
    const { count } = await supabase.from('perfiles').select('id', { count: 'exact', head: true })
    perfil = check(await supabase.from('perfiles').upsert({
      id: user.id, email: user.email,
      nombre: user.user_metadata?.nombre || user.email?.split('@')[0],
      rol: esAdminEnv || !count ? 'super_admin' : 'usuario',
    }).select().single())
    olvidarNombres()
  } else if (esAdminEnv && perfil.rol !== 'super_admin') {
    perfil = check(await supabase.from('perfiles').update({ rol: 'super_admin', activo: true }).eq('id', user.id).select().single())
  }
  return perfil
}

export const requireAuth = wrap(async (req, _res, next) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) throw httpError(401, 'Necesitás iniciar sesión')
  const hit = cache.get(token)
  if (hit && Date.now() - hit.t < TTL) {
    req.user = hit.user; req.perfil = hit.perfil
    return next()
  }
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) throw httpError(401, 'Sesión vencida, volvé a iniciar sesión')
  const perfil = await asegurarPerfil(data.user)
  if (perfil.activo === false) throw httpError(403, 'Tu usuario está desactivado. Consultá con un administrador.')
  cache.set(token, { user: data.user, perfil, t: Date.now() })
  if (cache.size > 500) cache.clear()
  req.user = data.user; req.perfil = perfil
  next()
})

export const requireRol = (...roles) => (req, _res, next) =>
  roles.includes(req.perfil?.rol) ? next() : next(httpError(403, 'No tenés permisos para esta acción'))

// Solo existen dos roles: Super Admin (lleva todo) y Usuario (pide paquetes). 'coord' queda como alias.
export const coord = requireRol('super_admin')
export const soloAdmin = requireRol('super_admin') // solo Super Admin

const sesionDe = (session, user, perfil) => ({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  usuario: { id: user.id, email: user.email, nombre: perfil?.nombre, rol: perfil?.rol },
})

export const authRouter = Router()
authRouter.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' } }))

async function entrar(email, password) {
  const { data, error } = await authClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error || !data?.session) throw httpError(401, 'Email o contraseña incorrectos')
  const perfil = await asegurarPerfil(data.user)
  if (perfil.activo === false) throw httpError(403, 'Tu usuario está desactivado. Consultá con un administrador.')
  return sesionDe(data.session, data.user, perfil)
}

authRouter.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {}
  if (!emailOk(email) || !password) throw httpError(400, 'Ingresá tu email y contraseña')
  res.json(await entrar(email, password))
}))

authRouter.post('/register', wrap(async (req, res) => {
  if (!env.permitirRegistro) throw httpError(403, 'El registro está cerrado. Pedile una cuenta al administrador.')
  const { email, password, nombre } = req.body || {}
  if (typeof password === 'string' && password.length > 72) throw httpError(400, 'La contraseña es demasiado larga')
  if (!emailOk(email)) throw httpError(400, 'Ingresá un email válido')
  if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres')
  const mail = email.trim().toLowerCase()
  const { data: creado, error } = await supabase.auth.admin.createUser({
    email: mail, password, email_confirm: true,
    user_metadata: { nombre: String(nombre || '').trim().slice(0, 60) || mail.split('@')[0], },
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw httpError(409, 'Ya existe una cuenta con ese email')
    throw httpError(400, error.message)
  }
  olvidarNombres()
  res.status(201).json(await entrar(mail, password))
}))

authRouter.post('/refresh', wrap(async (req, res) => {
  const { refresh_token } = req.body || {}
  if (!refresh_token) throw httpError(400, 'Falta refresh_token')
  const { data, error } = await authClient().auth.refreshSession({ refresh_token })
  if (error || !data?.session) throw httpError(401, 'Sesión vencida, volvé a iniciar sesión')
  const perfil = await asegurarPerfil(data.user)
  if (perfil.activo === false) throw httpError(403, 'Tu usuario está desactivado.')
  res.json(sesionDe(data.session, data.user, perfil))
}))

authRouter.post('/forgot', wrap(async (req, res) => {
  const { email } = req.body || {}
  if (emailOk(email)) await authClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: env.frontendUrl })
  res.json({ ok: true }) // siempre la misma respuesta: no revelamos si el mail existe
}))

authRouter.post('/reset', wrap(async (req, res) => {
  const { access_token, password } = req.body || {}
  if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres')
  const { data, error } = await supabase.auth.getUser(access_token || '')
  if (error || !data?.user) throw httpError(401, 'El link venció. Pedí uno nuevo.')
  const { error: e2 } = await supabase.auth.admin.updateUserById(data.user.id, { password })
  if (e2) throw httpError(400, e2.message)
  res.json({ ok: true })
}))

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, nombre: req.perfil.nombre, rol: req.perfil.rol })
})

// ---------- Usuarios (solo admin) ----------
export const usuariosRouter = Router()
usuariosRouter.use(requireAuth, soloAdmin)

usuariosRouter.get('/', wrap(async (_req, res) => {
  res.json(check(await supabase.from('perfiles').select('*').order('created_at')))
}))

// Cuenta los Super Admin activos, para no dejar el sistema sin nadie que lo administre
async function otrosSuperAdmin(excluirId) {
  const { count } = await supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'super_admin').neq('activo', false).neq('id', excluirId)
  return count || 0
}

usuariosRouter.patch('/:id', wrap(async (req, res) => {
  const destino = check(await supabase.from('perfiles').select('id, rol, activo').eq('id', req.params.id).single())
  const cambios = {}
  if (req.body.rol !== undefined) {
    if (!ROLES.includes(req.body.rol)) throw httpError(400, 'Rol inválido')
    cambios.rol = req.body.rol
  }
  if (req.body.nombre !== undefined) cambios.nombre = String(req.body.nombre).trim().slice(0, 60)
  if (req.body.activo !== undefined) cambios.activo = !!req.body.activo
  if (!Object.keys(cambios).length) throw httpError(400, 'Nada para actualizar')
  if (req.params.id === req.user.id && ((cambios.rol && cambios.rol !== 'super_admin') || cambios.activo === false)) {
    throw httpError(400, 'No podés sacarte el rol de Super Admin ni desactivarte a vos mismo')
  }
  const dejaDeSerAdmin = destino.rol === 'super_admin' && ((cambios.rol && cambios.rol !== 'super_admin') || cambios.activo === false)
  if (dejaDeSerAdmin && !(await otrosSuperAdmin(destino.id))) throw httpError(400, 'Tiene que quedar al menos un Super Admin activo')
  const data = check(await supabase.from('perfiles').update(cambios).eq('id', req.params.id).select().single())
  cache.clear(); olvidarNombres()
  res.json(data)
}))

usuariosRouter.delete('/:id', wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw httpError(400, 'No podés eliminar tu propio usuario')
  const destino = check(await supabase.from('perfiles').select('id, rol').eq('id', req.params.id).single())
  if (destino.rol === 'super_admin' && !(await otrosSuperAdmin(destino.id))) throw httpError(400, 'Tiene que quedar al menos un Super Admin activo')
  const { error } = await supabase.auth.admin.deleteUser(req.params.id)
  if (error) throw httpError(400, error.message)
  cache.clear(); olvidarNombres()
  res.json({ ok: true })
}))
