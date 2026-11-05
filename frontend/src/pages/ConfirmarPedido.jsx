import { useState } from 'react'
import { Send, ShieldCheck } from 'lucide-react'
import { Modal, Btn } from '../ui.jsx'

// Paso de confirmación: el usuario revisa su pedido antes de que le llegue al equipo (Super Admin).
export default function ConfirmarPedido({ titulo = 'Revisá tu pedido', filas, total, onConfirm, onClose }) {
  const [enviando, setEnviando] = useState(false)
  const enviar = async () => {
    if (enviando) return // evita el doble clic
    setEnviando(true)
    try { await onConfirm() } finally { setEnviando(false) }
  }
  return (
    <Modal titulo={titulo} onClose={enviando ? () => {} : onClose} ancho={500}
      footer={<><Btn variant="ghost" onClick={onClose} disabled={enviando}>Volver y editar</Btn><Btn icon={Send} loading={enviando} onClick={enviar}>Confirmar y enviar</Btn></>}>
      <div className="resumen-conf">
        {filas.filter((f) => f[1] !== '' && f[1] != null).map(([k, v]) => <div className="fila" key={k}><span>{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>)}
        {total != null && <div className="fila"><span>Total estimado</span><b style={{ fontSize: 20 }}>{total}</b></div>}
      </div>
      <div className="row muted small" style={{ marginTop: 14, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <ShieldCheck size={16} style={{ flex: 'none', marginTop: 2 }} />
        <span>Al confirmar, tu propuesta le llega al equipo (Super Admin). No pagás nada ahora: ellos te responden con la propuesta final.</span>
      </div>
    </Modal>
  )
}
