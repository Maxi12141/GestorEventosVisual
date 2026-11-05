import { useState } from 'react'
import { Mail, Lock, User, Eye, EyeOff, ClipboardList, Handshake, ListChecks, History, ArrowLeft, AudioLines } from 'lucide-react'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { Btn, Field, useToast } from '../ui.jsx'

// El link del mail de "olvidé mi contraseña" vuelve con #access_token=...&type=recovery
function leerRecovery() {
  const h = window.location.hash
  if (h.includes('type=recovery') && h.includes('access_token=')) {
    const p = new URLSearchParams(h.replace(/^#\/?/, ''))
    window.history.replaceState(null, '', window.location.pathname)
    return p.get('access_token')
  }
  return null
}

export default function Login() {
  const { entrar } = useAuth()
  const toast = useToast()
  const [tokenReset] = useState(leerRecovery)
  const [modo, setModo] = useState(tokenReset ? 'reset' : 'login')
  const [f, setF] = useState({ nombre: '', email: '', password: '', password2: '' })
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  const cambiar = (m) => { setModo(m); setError('') }

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (modo !== 'login' && modo !== 'olvide' && f.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    if ((modo === 'registro' || modo === 'reset') && f.password !== f.password2) return setError('Las contraseñas no coinciden')
    setCargando(true)
    try {
      if (modo === 'login') await entrar('login', { email: f.email, password: f.password })
      else if (modo === 'registro') {
        await entrar('registro', { email: f.email, password: f.password, nombre: f.nombre })
      }
      else if (modo === 'olvide') {
        await api('/auth/forgot', { method: 'POST', body: { email: f.email } })
        toast('Si el mail existe, te mandamos un link para crear una clave nueva', 'info')
        cambiar('login')
      } else if (modo === 'reset') {
        await api('/auth/reset', { method: 'POST', body: { access_token: tokenReset, password: f.password } })
        toast('Contraseña actualizada. Ya podés ingresar')
        setF((s) => ({ ...s, password: '', password2: '' }))
        cambiar('login')
      }
    } catch (err) { setError(err.message) } finally { setCargando(false) }
  }

  const titulo = { login: 'Bienvenido', registro: 'Creá tu cuenta', olvide: 'Recuperar contraseña', reset: 'Elegí una clave nueva' }[modo]
  return (
    <div className="login">
      <aside className="login-art">
        <span className="laser l1" /><span className="laser l2" /><span className="laser l3" />
        <div className="brand"><div className="logo"><AudioLines size={22} /></div><div>Gestor de Eventos<small>Para organizadoras de eventos de boliches</small></div></div>
        <div>
          <div className="eq" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ animationDelay: `${-i * 0.13}s` }} />)}</div>
          <h1 style={{ marginTop: 18 }}>Que ningún <em>detalle</em> de la noche se pierda.</h1>
          <p>Elegí un paquete o armá el tuyo, confirmalo y el equipo te responde con la propuesta. Todo el seguimiento de tu evento en un solo lugar.</p>
        </div>
        <div className="login-feats">
          <div><ClipboardList size={18} />Elegí un paquete ya armado o creá el tuyo a medida</div>
          <div><Handshake size={18} />Tu pedido le llega al equipo apenas lo confirmás</div>
          <div><ListChecks size={18} />Seguí el estado de cada pedido paso a paso</div>
          <div><History size={18} />Propuesta clara, precios a la vista y sin sorpresas</div>
        </div>
      </aside>
      <main className="login-form">
        <form className="login-box" onSubmit={enviar} noValidate>
          {(modo === 'olvide') && <button type="button" className="link" onClick={() => cambiar('login')} style={{ justifySelf: 'start', display: 'flex', gap: 6, alignItems: 'center' }}><ArrowLeft size={14} />Volver</button>}
          <div>
            <h2>{titulo}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {modo === 'login' && 'Ya estás registrado: ingresá con tu email y contraseña.'}
              {modo === 'registro' && 'Completá tus datos y pedí tu paquete en minutos.'}
              {modo === 'olvide' && 'Te mandamos un link por mail para crear una clave nueva.'}
              {modo === 'reset' && 'Mínimo 8 caracteres.'}
            </p>
          </div>

          {modo === 'registro' && (
            <Field label="Nombre"><div className="search"><User size={16} /><input maxLength={60} value={f.nombre} onChange={set('nombre')} placeholder="Cómo te llamamos" autoComplete="name" /></div></Field>
          )}
          {modo !== 'reset' && (
            <Field label="Email"><div className="search"><Mail size={16} /><input type="email" maxLength={120} value={f.email} onChange={set('email')} placeholder="vos@tuorganizadora.com" autoComplete="email" autoFocus /></div></Field>
          )}
          {modo !== 'olvide' && (
            <Field label="Contraseña">
              <div className="search passwrap">
                <Lock size={16} />
                <input type={ver ? 'text' : 'password'} value={f.password} onChange={set('password')} placeholder="••••••••" autoComplete={modo === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="icon-btn" onClick={() => setVer(!ver)} aria-label="Mostrar u ocultar contraseña">{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </Field>
          )}
          {(modo === 'registro' || modo === 'reset') && (
            <Field label="Repetí la contraseña"><div className="search"><Lock size={16} /><input type={ver ? 'text' : 'password'} value={f.password2} onChange={set('password2')} placeholder="••••••••" autoComplete="new-password" /></div></Field>
          )}

          {error && <div className="alerta error">{error}</div>}
          <Btn type="submit" loading={cargando}>
            {{ login: 'Ingresar', registro: 'Crear cuenta', olvide: 'Enviar link', reset: 'Guardar contraseña' }[modo]}
          </Btn>

          {modo === 'login' && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="link" onClick={() => cambiar('olvide')}>Olvidé mi contraseña</button>
              <button type="button" className="link" onClick={() => cambiar('registro')}>Crear cuenta</button>
            </div>
          )}
          {modo === 'registro' && <div className="muted small" style={{ textAlign: 'center' }}>¿Ya tenés cuenta? <button type="button" className="link" onClick={() => cambiar('login')}>Ingresá</button></div>}
        </form>
      </main>
    </div>
  )
}
