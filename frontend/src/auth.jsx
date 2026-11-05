import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, getSession, setSession } from './api.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(getSession()?.usuario || null)
  const [cargando, setCargando] = useState(!!getSession())

  // al abrir la app, validamos la sesión guardada
  useEffect(() => {
    if (!getSession()) return
    api('/auth/me').then((u) => setUsuario(u)).catch(() => { setSession(null); setUsuario(null) }).finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const out = () => setUsuario(null)
    window.addEventListener('ge5:logout', out)
    return () => window.removeEventListener('ge5:logout', out)
  }, [])

  const entrar = useCallback(async (modo, datos) => {
    const s = await api(modo === 'registro' ? '/auth/register' : '/auth/login', { method: 'POST', body: datos })
    setSession(s)
    setUsuario(s.usuario)
  }, [])
  const salir = useCallback(() => { setSession(null); setUsuario(null); window.location.hash = '#/' }, [])

  const rol = usuario?.rol
  return (
    <Ctx.Provider value={{ usuario, cargando, entrar, salir, esAdmin: rol === 'super_admin', puedeEditar: rol === 'super_admin' }}>
      {children}
    </Ctx.Provider>
  )
}
