import { ClipboardList, Send, CheckCircle2, ListChecks, GitCompare, Siren, Flag } from 'lucide-react'

const Paso = ({ n, icon: Icon, titulo, children }) => (
  <section className="card" style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14 }}>
    <div className="avatar" style={{ width: 40, height: 40 }}>{n}</div>
    <div><div className="row" style={{ gap: 8 }}><Icon size={18} /><h3>{titulo}</h3></div><div className="muted" style={{ marginTop: 6 }}>{children}</div></div>
  </section>
)

export default function Ayuda() {
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 860 }}>
      <div className="page-head"><div><h1>Cómo se usa</h1><p>El recorrido de un evento, de principio a fin.</p></div></div>
      <Paso n={1} icon={ClipboardList} titulo="Llega una solicitud">Un cliente (el dueño de un boliche) te pide un evento. Si contrata un paquete o arma el suyo desde su cuenta, la solicitud aparece sola en <b>Solicitudes</b> con el detalle de lo que eligió. Si te escribe por otro medio, cargala en <b>Solicitudes → Nueva solicitud</b>. Con saber quién la pide y qué tipo de evento es alcanza; el resto lo completás después. Si todavía falta información, marcala “Falta información”; cuando esté clara, “Lista para propuesta”. Si ya no avanza, descartala dejando el motivo.</Paso>
      <Paso n={2} icon={Send} titulo="Armás y presentás la propuesta">Dentro de la solicitud, <b>Armar propuesta</b>: servicios con su importe y el total. Marcá como “estimado” lo que todavía no está confirmado con el proveedor. Si el cliente pide ajustes antes de contestar, modificás la misma propuesta. Si la rechaza, queda registrada con lo que dijo y podés presentar otra.</Paso>
      <Paso n={3} icon={CheckCircle2} titulo="El cliente acepta">Registrá <b>“Aceptó”</b>: elegís la fecha y la sede acordadas (tienen que quedar claras), cómo aceptó y quién coordina. Se crea el <b>evento confirmado</b> con los servicios de la propuesta.</Paso>
      <Paso n={4} icon={ListChecks} titulo="Preparás el evento">En el evento: elegí el proveedor de cada servicio y registrá qué respondió. <b>“Dijo que está disponible” no es “Confirmado”</b>: confirmá recién cuando se comprometa. Creá tareas con responsable y fecha. Apenas hay movimiento, el evento pasa solo a “en preparación”.</Paso>
      <Paso n={5} icon={GitCompare} titulo="Si algo cambia">Usá <b>Registrar cambio</b> (fecha, sede, servicios, importes, condiciones). Si el cambio altera lo que el cliente aceptó, queda <b>esperando su conformidad</b> y sigue vigente lo anterior; cuando el cliente confirme, se aplica y el sistema te marca qué servicios y tareas hay que revisar.</Paso>
      <Paso n={6} icon={Siren} titulo="Durante la noche">En <b>Durante el evento</b> anotá incidentes: qué ocurrió, cuándo, qué se hizo y si quedó algo pendiente. Se puede hacer desde el celular.</Paso>
      <Paso n={7} icon={Flag} titulo="Cerrás el evento">Después de la fecha: <b>“Se realizó”</b> (con observaciones) o <b>“Se canceló”</b> (con motivo). Al cancelar, las tareas abiertas se cancelan y te queda la lista de proveedores a avisar. Las observaciones sobre proveedores quedan en su ficha para la próxima vez. Si te equivocás, podés corregir o reabrir: todo queda registrado.</Paso>
      <section className="card flat"><h3>¿Para qué sirve el panel?</h3><p className="muted" style={{ marginBottom: 0 }}>Te muestra lo que hay que atender hoy: eventos que ya pasaron y siguen abiertos, tareas vencidas, servicios sin confirmar, propuestas sin respuesta y cambios esperando al cliente. Todos los números llevan a la lista correspondiente.</p></section>
      <section className="card flat"><h3>Si otra persona tiene que retomar un evento</h3><p className="muted" style={{ marginBottom: 0 }}>Entrá al evento: el <b>Resumen</b> muestra lo acordado y lo pendiente, y el <b>Historial</b> cuenta quién hizo qué y cuándo. Coordinación puede cambiar quién lo coordina desde “Responsables”. Con <b>Copiar resumen</b> armás un mensaje listo para pegar en WhatsApp.</p></section>
    </div>
  )
}
