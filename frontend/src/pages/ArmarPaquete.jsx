import { useState } from 'react'
import { Send } from 'lucide-react'
import { api } from '../api.js'
import { ir } from '../router.js'
import { Btn, Field, NumInput, Spinner, Vacio, useCarga, useToast } from '../ui.jsx'
import { $, num, hoyAR, MAX_PERSONAS, fechaMaxima, validarPedido } from '../utils.js'
import ConfirmarPedido from './ConfirmarPedido.jsx'

// El cliente arma su propio paquete en 3 pasos y se lo manda al equipo.
export default function ArmarPaquete() {
  const toast = useToast()
  const { data: catalogo, cargando, error } = useCarga(() => api('/paquetes-servicios'), [])
  const [f, setF] = useState({ lugar: '', tipo: 'Boliche', asistentes: 200, fecha_prevista: '', telefono: '', notas: '' })
  const [elegidos, setElegidos] = useState([])
  const [confirmar, setConfirmar] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const toggle = (n) => setElegidos((e) => (e.includes(n) ? e.filter((x) => x !== n) : [...e, n]))

  const items = (catalogo || []).filter((s) => elegidos.includes(s.nombre))
  const importe = (s) => (s.porPersona ? s.precio * (Number(f.asistentes) || 0) : s.precio)
  const total = items.reduce((t, s) => t + importe(s), 0)

  const revisar = () => {
    const err = validarPedido(f)
    if (err) return toast(err, 'error')
    if (!elegidos.length) return toast('Elegí al menos un servicio (paso 2)', 'error')
    setConfirmar(true)
  }
  const enviar = async () => {
    try {
      await api('/paquetes-armar', { method: 'POST', body: { ...f, servicios: elegidos } })
      toast('¡Pedido enviado! El equipo ya lo recibió y te va a responder con una propuesta.')
      ir('pedidos')
    } catch (e) { toast(e.message, 'error'); setConfirmar(false) }
  }

  if (cargando) return <Spinner />
  if (error) return <Vacio titulo="Error" texto={error.message} />
  return (
    <div>
      {confirmar && <ConfirmarPedido onClose={() => setConfirmar(false)} onConfirm={enviar} total={$(total)}
        filas={[['Lugar', f.lugar], ['Tipo', f.tipo], ['Personas', num(f.asistentes)], ['Fecha deseada', f.fecha_prevista], ['Teléfono', f.telefono], ['Servicios', items.map((s) => s.nombre).join(', ')], ['Comentarios', f.notas]]} />}
      <div className="page-head"><div><h1>Armar mi paquete</h1><p>Contanos de tu evento, elegí los servicios y le mandamos el pedido al equipo. El precio es estimado: ellos te confirman el final.</p></div></div>
      <div className="armar-grid">
        <div className="stack" style={{ gap: 18 }}>
          <section className="card stack">
            <h3><span className="paso-num">1</span>Tu evento</h3>
            <Field label="Nombre de tu boliche o festival"><input maxLength={100} value={f.lugar} onChange={(e) => set('lugar', e.target.value)} placeholder="Ej: Boliche Eclipse" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="¿Cuánta gente entra?"><NumInput min={1} max={MAX_PERSONAS} value={f.asistentes} onChange={(v) => set('asistentes', v)} suffix="personas" /></Field>
              <Field label="Tipo"><select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}><option>Boliche</option><option>Festival</option></select></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Fecha deseada (opcional)"><input type="date" min={hoyAR()} max={fechaMaxima()} value={f.fecha_prevista} onChange={(e) => set('fecha_prevista', e.target.value)} /></Field>
              <Field label="Teléfono" hint="Obligatorio: el equipo te llama para cualquier consulta"><input type="tel" maxLength={20} value={f.telefono} onChange={(e) => set('telefono', e.target.value.replace(/[^\d+\-\s()]/g, ''))} placeholder="Ej: 353 555-0100" /></Field>
            </div>
          </section>

          <section className="card stack">
            <h3><span className="paso-num">2</span>Elegí tus servicios</h3>
            <p className="muted small" style={{ margin: 0 }}>Tocá los que quieras. El total se calcula solo.</p>
            <div className="stack" style={{ gap: 10 }}>
              {(catalogo || []).map((s) => (
                <label key={s.nombre} className={'srv' + (elegidos.includes(s.nombre) ? ' on' : '')}>
                  <input type="checkbox" checked={elegidos.includes(s.nombre)} onChange={() => toggle(s.nombre)} />
                  <div className="grow"><b>{s.nombre}</b><div className="muted small">{s.detalle}</div></div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{$(importe(s))}</b>{s.porPersona && <div className="muted small">{$(s.precio)} x persona</div>}</div>
                </label>
              ))}
            </div>
          </section>

          <section className="card stack">
            <h3><span className="paso-num">3</span>Algo más que quieras contarnos</h3>
            <Field label="Comentarios (opcional)"><textarea rows={3} maxLength={1000} value={f.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Ej: queremos cumbia y luces rojas" /></Field>
          </section>
        </div>

        <aside className="card stack armar-resumen">
          <h3>Tu paquete</h3>
          {!items.length ? <p className="muted" style={{ margin: 0 }}>Todavía no elegiste servicios.</p> : (
            <div className="stack" style={{ gap: 6 }}>
              {items.map((s) => <div key={s.nombre} className="row small" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><span>{s.nombre}</span><b>{$(importe(s))}</b></div>)}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 12, flexWrap: 'nowrap' }}>
            <span>Total estimado</span><b style={{ fontSize: 24 }}>{$(total)}</b>
          </div>
          <div className="muted small">{f.lugar || 'Tu evento'} · {num(f.asistentes)} personas</div>
          <Btn icon={Send} onClick={revisar}>Revisar y confirmar</Btn>
          <span className="muted small">No pagás nada ahora: el equipo te responde con una propuesta.</span>
        </aside>
      </div>
    </div>
  )
}
