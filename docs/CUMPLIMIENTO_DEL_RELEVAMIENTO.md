# Cómo cumple el sistema lo que pidió el cliente

Este documento relaciona lo que pidió el cliente en el relevamiento con lo que hace el sistema, qué quedó **fuera a propósito** y qué decisiones se tomaron que **conviene validar con él**.

## 1. Qué pidió y dónde está

| Necesidad del cliente | Dónde se resuelve |
|---|---|
| Registrar solicitudes de clientes (dueños de boliches) con lo mínimo: quién la pide y qué tipo de evento es | **Solicitudes → Nueva solicitud**. Fecha, sede y asistentes son opcionales |
| Distinguir solicitudes en evaluación, con falta de información, listas para propuesta y las que ya no avanzan | Estados *En evaluación · Falta información · Lista para propuesta · Descartada* (con motivo) |
| Evitar registrar dos veces la misma solicitud / confundir eventos del mismo cliente | Aviso de **posible duplicado** (mismo cliente con igual título o fecha) y ficha del cliente con todos sus antecedentes |
| Preparar la propuesta con servicios, importes y calcular el total | **Armar propuesta** dentro de la solicitud: el total se calcula solo |
| Importes inciertos no presentarse como confirmados | Cada importe se marca *confirmado* o queda *“Estimado”* |
| Una sola propuesta vigente; si el cliente pide cambios antes de aceptar, se actualiza | **Modificar** la propuesta pendiente (no hay versiones) |
| Registrar aceptación o rechazo; conservar lo rechazado | **Aceptó / Rechazó**. La rechazada queda con servicios, importes y observación; se puede presentar otra |
| La aceptación necesita fecha y sede claras; registrar cómo y quién | El diálogo de aceptación exige fecha y sede, el medio (WhatsApp, teléfono…) y guarda quién lo registró y cuándo |
| Evento con estados confirmado / en preparación / realizado / cancelado | Estados del evento (pasa a *en preparación* solo con el primer movimiento) |
| Organizar proveedores por servicio: confirmado, rechazado, **disponibilidad ≠ confirmación** | Estados *Sin respuesta · Dijo que está disponible · Confirmado · No participa*. “Disponible” **no** cuenta como confirmado |
| Importe informado por el proveedor | Campo propio, separado del importe acordado con el cliente |
| Asignar y seguir tareas con responsable y fecha; ver vencidas | Pestaña **Tareas** + pantalla Tareas (mías / vencidas / completadas) |
| Registrar cambios relevantes, con antecedente, quién y cuándo | Pestaña **Cambios** (fecha, sede, servicios, importes, condiciones) |
| No dar por aceptado un cambio que altera el acuerdo sin conformidad del cliente | El cambio queda **“esperando al cliente”** y **sigue vigente lo anterior** hasta que dé su conformidad |
| Revisar qué compromisos afecta un cambio (sin comprobación automática) | Al aplicarse un cambio de fecha/sede, los servicios y tareas afectados quedan marcados **“Para revisar”** hasta que alguien los revise |
| Registrar lo ocurrido durante el evento (qué, cuándo, servicio, consecuencias, medida, pendiente) | Pestaña **Durante el evento** (incidentes) |
| Cierre: realizado con observaciones, cancelado con motivo | Pestaña **Cierre**. Se conserva todo; al cancelar, las tareas abiertas se cancelan y queda la **lista de proveedores a avisar** |
| Corregir o reabrir un cierre equivocado | **Corregir** (exige motivo) y **Reabrir** (exige motivo); quedan en el historial |
| Aprendizajes sobre proveedores para próximos eventos | **Observaciones**, que aparecen también en la ficha del proveedor |
| Trazabilidad y continuidad cuando otra persona retoma un evento | **Historial** con quién/cuándo/antes→ahora, resumen de lo acordado y lo pendiente, y **Copiar resumen** para WhatsApp. Coordinación puede **reasignar** responsables |
| Responsable durante el evento | Campo propio en cada evento; puede registrar el resultado |
| Consultas: por fecha, estado, cliente, sede, proveedor, responsable; pendientes | **Eventos** (filtros), **Solicitudes**, **Tareas**, **Calendario** (con feriados), **Panel** y fichas de **Cliente / Proveedor / Sede** |
| Roles y confidencialidad | Admin · Coordinación · Apoyo (ver abajo) |

## 2. Roles y permisos

| | Admin | Coordinación | Apoyo |
|---|:-:|:-:|:-:|
| Registrar solicitudes y armar propuestas | ✔ | ✔ | — |
| Registrar aceptación / rechazo del cliente | ✔ | ✔ | — |
| Registrar y resolver cambios | ✔ | ✔ | — |
| Asignar tareas a otros / reasignar responsables | ✔ | ✔ | — |
| Contactar proveedores y registrar su respuesta | ✔ | ✔ | ✔ |
| Crear y completar tareas propias | ✔ | ✔ | ✔ |
| Registrar incidentes y observaciones | ✔ | ✔ | ✔ |
| Registrar “realizado” | ✔ | ✔ | solo si es responsable del evento |
| Cancelar un evento | ✔ | ✔ | — |
| Ver importes acordados con el cliente y su contacto | ✔ | ✔ | **no** |
| Administrar usuarios y borrar registros | ✔ | — | — |

## 3. Lo que quedó fuera a propósito (el cliente lo descartó)

Entradas, invitados y accesos · cobros, pagos y facturación · impuestos y contabilidad · rentabilidad · inventario de equipos · disponibilidad automática de proveedores · resolver conflictos entre eventos · portales para clientes o proveedores · integraciones (WhatsApp, calendario, etc.) · estadísticas · motor de precios · historial de versiones de propuestas · **eventos de varios días o con varias sedes**.

> La versión 5 tenía cálculo de entradas, impuestos y ganancias, y festivales de varios días. Se **eliminó** porque el cliente lo dejó explícitamente fuera. *Festival* sigue existiendo como un **tipo de evento** (una fecha, una sede).

## 4. Decisiones tomadas que conviene validar con el cliente

El relevamiento dejaba algunos puntos abiertos. Esto es lo que se asumió:

1. **Permisos del rol “Apoyo”**: no ve los importes acordados con el cliente ni sus datos de contacto (sí ve los importes que informan los proveedores y los datos de los proveedores).
2. **Quién registra el cierre**: “realizado” lo registra coordinación o quien sea responsable del evento; “cancelado”, coordinación o quien lo coordina.
3. **Paso a “en preparación”**: automático con el primer movimiento (asignar proveedor, registrar respuesta o crear tarea).
4. **Solicitud “con evento confirmado”**: al aceptarse la propuesta, la solicitud pasa a este estado y el seguimiento sigue en el evento.
5. **Validaciones de fecha**: no se acepta ni se cambia a una fecha pasada, y no se puede registrar “realizado” antes de la fecha del evento.
6. **Cambios internos**: un ajuste que no altera lo que el cliente aceptó se puede marcar como “interno” y se aplica al instante.
7. **Al cancelar**: las tareas abiertas pasan a “canceladas” y los proveedores involucrados quedan con aviso pendiente.
8. **Duplicados y choque de sede/fecha**: son **avisos** (se puede continuar), no bloqueos, porque el cliente no quiere que el sistema resuelva conflictos.
9. **Cierre con pendientes**: se avisa (servicios sin confirmar, tareas abiertas, incidentes) pero no se bloquea.
