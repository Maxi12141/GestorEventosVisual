import { useState, useEffect } from 'react'
import { AudioLines, Wrench, Bell, LayoutDashboard, CalendarDays, PartyPopper, Building2, Handshake, UserRound, Users, LogOut, Menu, Plus, ClipboardList, ListChecks, FileText, Package } from 'lucide-react'
import { useAuth } from './auth.jsx'
import { useRoute, ir } from './router.js'
import { Spinner, useToast } from './ui.jsx'
import { api } from './api.js'
import { ROLES } from './utils.js'
import Login from './pages/Login.jsx'
import Panel from './pages/Panel.jsx'
import Solicitudes from './pages/Solicitudes.jsx'
import SolicitudDetalle from './pages/SolicitudDetalle.jsx'
import Eventos from './pages/Eventos.jsx'
import EventoDetalle from './pages/EventoDetalle.jsx'
import Tareas from './pages/Tareas.jsx'
import Calendario from './pages/Calendario.jsx'
import { Clientes, Proveedores, Sedes } from './pages/Catalogos.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Ayuda from './pages/Ayuda.jsx'
import Paquetes from './pages/Paquetes.jsx'
import MisPedidos from './pages/MisPedidos.jsx'
import ArmarPaquete from './pages/ArmarPaquete.jsx'

const NAV = [
  { ruta: '', label: 'Panel', icon: LayoutDashboard },
  { ruta: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { ruta: 'eventos', label: 'Eventos', icon: PartyPopper },
  { ruta: 'paquetes', label: 'Paquetes', icon: Package },
  { ruta: 'tareas', label: 'Tareas', icon: ListChecks },
  { ruta: 'calendario', label: 'Calendario', icon: CalendarDays },
  { sec: 'Contactos' },
  { ruta: 'clientes', label: 'Clientes', icon: UserRound },
  { ruta: 'proveedores', label: 'Proveedores', icon: Handshake },
  { ruta: 'sedes', label: 'Sedes', icon: Building2 },
  { sec: 'Administración', admin: true },
  { ruta: 'usuarios', label: 'Usuarios', icon: Users, admin: true },
  { sec: 'Ayuda' },
  { ruta: 'ayuda', label: 'Cómo se usa', icon: FileText },
]

// El Usuario puede elegir un paquete armado o armar el suyo; el Super Admin lleva todo
const NAV_USUARIO = [
  { ruta: 'paquetes', label: 'Paquetes armados', icon: Package },
  { ruta: 'armar', label: 'Armar el mío', icon: Wrench },
  { ruta: 'pedidos', label: 'Mis pedidos', icon: ClipboardList },
]

// Cuenta los pedidos de clientes sin abrir (solo Super Admin) y avisa cuando llega uno nuevo
function usePedidosNuevos(activo) {
  const toast = useToast()
  const [n, setN] = useState(0)
  const [ult, setUlt] = useState(null)
  useEffect(() => {
    if (!activo) return
    let vivo = true, previo = null
    const leer = () => api('/pedidos-nuevos').then((d) => {
      if (!vivo) return
      setN(d.cantidad); setUlt(d.ultimos?.[0] || null)
      if (previo !== null && d.cantidad > previo) toast(`Llegó un pedido nuevo: ${d.ultimos?.[0]?.titulo || ''}`, 'info')
      previo = d.cantidad
    }).catch(() => {})
    leer()
    const t = setInterval(leer, 30000)
    const f = () => leer()
    window.addEventListener('hashchange', f)
    return () => { vivo = false; clearInterval(t); window.removeEventListener('hashchange', f) }
  }, [activo, toast])
  return { n, ult }
}

export default function App() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Spinner texto="Cargando…" full />
  if (!usuario) return <Login />
  return <Shell />
}

function Shell() {
  const { usuario, salir, esAdmin, puedeEditar } = useAuth()
  const { segs, query, raw } = useRoute()
  const [abierto, setAbierto] = useState(false)
  useEffect(() => setAbierto(false), [raw])
  const [s0, s1] = segs

  const esUsuario = usuario.rol === 'usuario'
  const nuevos = usePedidosNuevos(!esUsuario)
  const seccion = esUsuario ? (['pedidos', 'armar'].includes(s0) ? s0 : 'paquetes') : s0
  let pagina
  if (esUsuario) pagina = seccion === 'pedidos' ? <MisPedidos /> : seccion === 'armar' ? <ArmarPaquete /> : <Paquetes />
  else if (s0 === 'paquetes') pagina = <Paquetes />
  else if (!s0) pagina = <Panel nuevos={nuevos} />
  else if (s0 === 'solicitudes' && !s1) pagina = <Solicitudes key={raw} query={query} />
  else if (s0 === 'solicitudes') pagina = <SolicitudDetalle key={s1} id={Number(s1)} />
  else if (s0 === 'eventos' && !s1) pagina = <Eventos key={raw} query={query} />
  else if (s0 === 'eventos') pagina = <EventoDetalle key={s1} id={Number(s1)} tab={query.tab} />
  else if (s0 === 'tareas') pagina = <Tareas key={raw} query={query} />
  else if (s0 === 'calendario') pagina = <Calendario />
  else if (s0 === 'clientes') pagina = <Clientes key={raw} id={s1 ? Number(s1) : null} />
  else if (s0 === 'proveedores') pagina = <Proveedores key={raw} id={s1 ? Number(s1) : null} />
  else if (s0 === 'sedes') pagina = <Sedes key={raw} id={s1 ? Number(s1) : null} />
  else if (s0 === 'usuarios') pagina = esAdmin ? <Usuarios /> : <Sin />
  else if (s0 === 'ayuda') pagina = <Ayuda />
  else pagina = <Sin />

  return (
    <div className="app">
      <aside className={'sidebar' + (abierto ? ' open' : '')}>
        <div className="brand"><div className="logo"><AudioLines size={22} /></div><div>Gestor de Eventos<small>Seguimiento de eventos</small></div></div>
        {puedeEditar && <button className="btn sol nav-cta" onClick={() => ir('solicitudes?nueva=1')}><Plus size={16} />Nueva solicitud</button>}
        <nav className="nav">
          {(esUsuario ? NAV_USUARIO : NAV).filter((n) => !n.admin || esAdmin).map((n, i) => n.sec
            ? <div key={i} className="sec">{n.sec}</div>
            : <a key={n.ruta} href={'#/' + n.ruta} className={(esUsuario ? seccion : (s0 || '')) === n.ruta ? 'on' : ''}><n.icon size={18} />{n.label}{n.ruta === 'solicitudes' && nuevos.n > 0 && <span className="nbadge" title="Pedidos nuevos de clientes">{nuevos.n}</span>}</a>)}
        </nav>
        <div className="userbox">
          <div className="avatar">{(usuario.nombre || usuario.email)[0].toUpperCase()}</div>
          <div className="who"><b>{usuario.nombre || usuario.email}</b><span className="muted small">{ROLES[usuario.rol]}</span></div>
          <button className="icon-btn" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut size={18} /></button>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button className="icon-btn" onClick={() => setAbierto(!abierto)} aria-label="Menú"><Menu size={22} /></button>
          <b className="topbar-brand"><AudioLines size={20} /> Gestor de Eventos</b>
        </div>
        <main className="main page-in" key={`${esUsuario ? seccion : (s0 || '')}/${s1 || ''}`}>{pagina}</main>
      </div>
      {abierto && <div className="scrim" onClick={() => setAbierto(false)} />}
    </div>
  )
}

const Sin = () => (
  <div className="vacio"><strong>Página no encontrada</strong><p>O no tenés permisos para verla.</p><a className="btn primary" href="#/">Ir al panel</a></div>
)
