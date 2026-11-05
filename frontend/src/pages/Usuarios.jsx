import { useState } from 'react'
import { Table, Select, Switch, Tag, Popconfirm } from 'antd'
import { Trash2, ShieldCheck, User } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { Spinner, Vacio, useCarga, useToast } from '../ui.jsx'
import { limpiarCatalogos } from '../catalogos.js'
import { fechaMini } from '../utils.js'

export default function Usuarios() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { data, cargando, error, recargar } = useCarga(() => api('/usuarios'), [])
  const [busy, setBusy] = useState(null)
  const cambiar = async (u, body, ok) => {
    setBusy(u.id)
    try { await api('/usuarios/' + u.id, { method: 'PATCH', body }); limpiarCatalogos(); toast(ok); recargar() } catch (e) { toast(e.message, 'error') } finally { setBusy(null) }
  }
  const borrar = async (u) => { try { await api('/usuarios/' + u.id, { method: 'DELETE' }); limpiarCatalogos(); toast('Usuario eliminado'); recargar() } catch (e) { toast(e.message, 'error') } }
  const columnas = [
    { title: 'Persona', render: (_, u) => <div><b>{u.nombre}</b> {u.id === usuario.id && <Tag color="cyan">Vos</Tag>}<div className="muted small">{u.email}</div></div> },
    { title: 'Alta', responsive: ['md'], render: (_, u) => <span className="muted">{fechaMini(u.created_at.slice(0, 10))}</span> },
    { title: 'Rol', render: (_, u) => (
      <Select value={u.rol} disabled={u.id === usuario.id || busy === u.id} style={{ width: 150 }} onChange={(rol) => cambiar(u, { rol }, 'Rol actualizado')}
        options={[{ value: 'super_admin', label: 'Super Admin' }, { value: 'usuario', label: 'Usuario' }]} />) },
    { title: 'Acceso', render: (_, u) => u.id === usuario.id ? <Tag color="green">Activo</Tag> :
      <Switch checked={u.activo !== false} loading={busy === u.id} checkedChildren="Activo" unCheckedChildren="Off" onChange={(v) => cambiar(u, { activo: v }, v ? 'Usuario activado' : 'Usuario desactivado')} /> },
    { title: '', align: 'right', render: (_, u) => u.id !== usuario.id && (
      <Popconfirm title="Eliminar usuario" description={`${u.email} no va a poder volver a ingresar.`} okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }} onConfirm={() => borrar(u)}>
        <button className="icon-btn bad" aria-label="Eliminar"><Trash2 size={16} /></button>
      </Popconfirm>) },
  ]
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head"><div><h1>Usuarios</h1><p>Quién puede entrar y qué puede hacer. Hay solo dos roles.</p></div></div>
      <div className="grid g2">
        <div className="card flat row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><ShieldCheck color="#ff4fd8" style={{ flex: 'none' }} /><span><b>Super Admin:</b> lleva todo: recibe los pedidos, arma propuestas, gestiona eventos, proveedores, paquetes y usuarios.</span></div>
        <div className="card flat row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><User color="#3ee0ff" style={{ flex: 'none' }} /><span><b>Usuario:</b> elige un paquete armado o arma el suyo, lo confirma y sigue el estado en “Mis pedidos”.</span></div>
      </div>
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : (
        <div className="card" style={{ padding: 6 }}><Table rowKey="id" dataSource={data} columns={columnas} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} rowClassName={(u) => (u.activo === false ? 'fila-off' : '')} /></div>
      )}
      <p className="muted small">Si alguien deja el equipo, conviene <b>desactivarlo</b> en lugar de eliminarlo: así su nombre sigue en el historial.</p>
    </div>
  )
}
