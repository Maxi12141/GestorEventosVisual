import { Steps, Empty, Tag } from 'antd'
import { api } from '../api.js'
import { ir } from '../router.js'
import { Btn, Spinner, Vacio, useCarga } from '../ui.jsx'
import { $, fechaCorta, num } from '../utils.js'

// estado de la solicitud → paso del seguimiento
const ESTADO = {
  en_evaluacion: { paso: 0, label: 'Recibido: lo estamos evaluando', color: 'cyan' },
  pendiente_informacion: { paso: 0, label: 'Te vamos a pedir más información', color: 'orange', alerta: true },
  lista_para_propuesta: { paso: 1, label: 'Armando tu propuesta', color: 'geekblue' },
  convertida: { paso: 3, label: '¡Evento confirmado!', color: 'green' },
  descartada: { paso: 0, label: 'Descartado', color: 'default', error: true },
}

export default function MisPedidos() {
  const { data, cargando, error } = useCarga(() => api('/mis-pedidos'), [])
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head"><div><h1>Mis pedidos</h1><p>Seguí el estado de lo que le pediste al equipo.</p></div></div>
      {cargando ? <Spinner /> : error ? <Vacio titulo="Error" texto={error.message} /> : !data.length ? (
        <div className="card"><Empty description="Todavía no hiciste ningún pedido">
          <div className="row" style={{ justifyContent: 'center' }}><Btn onClick={() => ir('paquetes')}>Ver paquetes</Btn><Btn variant="ghost" onClick={() => ir('armar')}>Armar el mío</Btn></div>
        </Empty></div>
      ) : (
        <div className="stack">
          {data.map((x) => {
            let e = ESTADO[x.estado] || { paso: 0, label: x.estado, color: 'default' }
            // si ya hay una propuesta presentada, el pedido está esperando la aceptación
            const props = x.propuestas || []
            if (x.estado === 'lista_para_propuesta' && props.some((p) => p.estado === 'pendiente_respuesta')) e = { paso: 2, label: 'Propuesta presentada: esperando tu respuesta', color: 'purple' }
            else if (x.estado === 'lista_para_propuesta' && props.length && props.every((p) => p.estado === 'rechazada')) e = { paso: 1, label: 'Propuesta rechazada: te preparamos otra', color: 'orange' }
            const precio = x.paquetes ? x.paquetes.precio : x.total_estimado
            return (
              <div key={x.id} className="card stack" style={{ gap: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b style={{ fontSize: 17 }}>{x.titulo}</b>
                  <Tag color={e.color} style={{ margin: 0 }}>{e.label}</Tag>
                </div>
                <Steps size="small" current={e.paso} status={e.error ? 'error' : e.alerta ? 'process' : undefined}
                  items={[{ title: 'Enviado' }, { title: 'Propuesta' }, { title: 'Aceptación' }, { title: 'Confirmado' }]} />
                <div className="muted small">
                  {x.paquete_id ? 'Paquete armado' : 'Paquete armado por vos'} · Fecha deseada: {x.fecha_prevista ? fechaCorta(x.fecha_prevista) : 'sin definir'} · {num(x.asistentes_estimados)} personas
                  {precio != null && <> · {x.paquetes ? 'Precio' : 'Total estimado'}: <b style={{ color: 'var(--text)' }}>{$(precio)}</b></>}
                </div>
                {x.estado === 'descartada' && x.motivo_descarte && <div className="alerta aviso">Motivo: {x.motivo_descarte}</div>}
                {x.necesidades && <details><summary className="small" style={{ cursor: 'pointer', color: 'var(--celeste)' }}>Ver lo que pediste</summary><p className="small" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{x.necesidades}</p></details>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
