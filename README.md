# 🎧 Gestor de Eventos 14 — para organizadoras de eventos de boliches

Sistema para llevar el **seguimiento de cada evento**, desde que un cliente (el dueño de un boliche) hace el pedido hasta que se cierra la noche:

> **Solicitud → Propuesta → Aceptación del cliente → Preparación (proveedores y tareas) → Realizado o Cancelado**

Hecho a partir del relevamiento del cliente. En `docs/CUMPLIMIENTO_DEL_RELEVAMIENTO.md` está, punto por punto, qué pidió, dónde está resuelto, qué quedó fuera a propósito y qué decisiones conviene validar con él.

**Stack:** React + Vite (pantallas) · Node/Express (servidor) · Supabase (base de datos y login).

---

## ✨ Qué hace

- **Panel de trabajo:** lo que hay que atender hoy — eventos que ya pasaron y siguen abiertos, tareas vencidas, servicios sin confirmar, propuestas sin respuesta, cambios esperando al cliente, proveedores a avisar por una cancelación.
- **Solicitudes:** registro mínimo (quién y qué tipo de evento), estados, aviso de duplicados y descarte con motivo.
- **Propuestas:** servicios con importe y total automático; los importes no confirmados quedan como *“Estimado”*; el rechazo se conserva.
- **Aceptación:** exige fecha y sede claras, guarda cómo aceptó y quién lo registró, y crea el evento.
- **Evento (la “ficha”):** resumen de lo acordado y lo pendiente, servicios y proveedores, tareas, cambios, incidentes, cierre, observaciones e historial completo.
- **Proveedores:** *“Dijo que está disponible” no es “Confirmado”*; importe informado aparte; contacto con un toque (llamar / WhatsApp).
- **Cambios con conformidad:** si un cambio altera lo que el cliente aceptó, queda *esperando al cliente* y **sigue vigente lo anterior**; al aplicarse marca qué servicios y tareas hay que **revisar**.
- **Cierre:** realizado (con observaciones) o cancelado (con motivo, tareas canceladas y lista de proveedores a avisar). Se puede **corregir** o **reabrir** dejando constancia.
- **Continuidad:** historial de *quién hizo qué y cuándo*, reasignación de responsables y **Copiar resumen** listo para pegar en WhatsApp.
- **Consultas:** eventos por fecha, estado, cliente, sede, proveedor o responsable; calendario con **feriados nacionales y fines de semana largos**; fichas de cliente, proveedor y sede con sus antecedentes; exportar a Excel.
- **2 roles:** **Super Admin** (lleva todo: pedidos, eventos, paquetes, usuarios) y **Usuario** (elige un paquete armado *o* arma el suyo, lo confirma y sigue el estado en “Mis pedidos”). Cuando el usuario confirma, el pedido le llega a los Super Admin con aviso en el panel y un contador en “Solicitudes”.
- **Validaciones:** máx. 50.000 personas, fechas hasta 3 años, importes hasta $500.000.000, teléfono válido y anti doble envío (en pantalla y en el servidor).
- **Diseño:** Ant Design en modo oscuro futurista (neón cian/violeta).
- **Seguridad:** login con Supabase, RLS activado, claves secretas solo en el servidor, operaciones críticas atómicas (o se hace todo o no se hace nada).

---

## 🚀 Puesta en marcha

### 1) Base de datos (Supabase)
En **SQL Editor** corré, **en orden**, los archivos de `supabase/migraciones/` (hay una guía en `LEEME.md` ahí):
**001 → 002 → 003 → 007 → 008 → 010 → 011 → 012** (la 011 pasa los “admin” a Super Admin y agrega el aviso de pedidos nuevos), y si querés: **004** (traer tus lugares y artistas de la versión anterior). Si ya habías cargado los datos de ejemplo (005), corré **009** para borrarlos.
No tocan las tablas de la versión anterior.

### 2) Servidor
```bash
cd backend
cp .env.example .env     # completá SUPABASE_URL y SUPABASE_SERVICE_KEY
npm install
npm run dev              # http://localhost:3001
```
> ⚠️ La clave secreta (`sb_secret_…` o `service_role`) va **solo** en `backend/.env`. Nunca en el frontend ni en GitHub.

### 3) Pantallas
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

### 4) Primer ingreso
Abrí **http://localhost:5173** → **Crear cuenta**. La primera cuenta es **Super Admin**. Las siguientes arrancan como **Usuario**; el Super Admin les cambia el rol en **Usuarios**.
- Cerrar el registro público: `PERMITIR_REGISTRO=false` en `backend/.env`.
- ¿Te quedaste sin admin? Poné tu mail en `ADMIN_EMAIL` (queda como Super Admin) y reiniciá el servidor.
- Quien deja el equipo: conviene **desactivarlo** (no eliminarlo) para que su nombre siga en el historial.

### Producción (un solo servicio)
```bash
cd frontend && npm run build     # genera frontend/dist
cd ../backend && npm start       # el servidor sirve la API y las pantallas
```

---

## 🧪 Pruebas
```bash
cd backend && npm test
```
Prueba las reglas de negocio puras (propuestas, pendientes, “por cerrar”, confidencialidad).

---

## 🗂️ Estructura
```
gestor-eventos14/
├── docs/CUMPLIMIENTO_DEL_RELEVAMIENTO.md   qué pidió el cliente y cómo se resolvió
├── supabase/migraciones/                   SQL en orden (001–006)
├── backend/
│   ├── index.js
│   ├── src/reglas.js                       reglas puras (con tests)
│   ├── src/comun.js                        historial, permisos y confidencialidad
│   ├── src/auth.js                         login, roles y usuarios
│   └── src/routes/                         catalogos · solicitudes · encargos · panel
└── frontend/src/pages/                     Panel, Solicitudes, Evento, Tareas, Calendario, Catálogos…
```

## 🩺 Problemas comunes
- **“Faltan SUPABASE_URL…”** → no creaste `backend/.env`.
- **“Email o contraseña incorrectos”** → primero **Crear cuenta**: el login usa Supabase Auth.
- **“Could not find the table … schema cache”** → corré `notify pgrst, 'reload schema';` en el SQL Editor.
- **No me deja borrar un cliente/proveedor/sede** → ya se usó en solicitudes o eventos: desactivalo desde *Editar*.
- **El Usuario no ve importes** → es a propósito (ver `docs/CUMPLIMIENTO_DEL_RELEVAMIENTO.md`, punto 4).

## 🔄 Qué cambió respecto a la versión 5
La v5 estaba pensada para el *dueño del boliche* (entradas, impuestos, ganancia, festivales de varios días). El relevamiento mostró que el cliente es una **organizadora** que necesita seguimiento y trazabilidad, y dejó fuera de alcance entradas, cobros, impuestos, rentabilidad y eventos de varios días: por eso esas partes se eliminaron. Se conservaron el login, los roles, el calendario con feriados, los catálogos y el diseño.


## Roles y qué ve cada uno
Al crear la cuenta se elige el **tipo de cuenta** (no se puede cambiar después):
- **Cliente** → ve solo los **Paquetes armados** (12 de ejemplo), filtra por cantidad de gente o tipo y toca **Contratar este paquete**. No puede crear uno.
- **Admin** (cuenta que arma el suyo) → solo puede **armar el suyo** eligiendo servicios (el total se calcula solo). No puede elegir un paquete ya armado.
En los dos casos el **teléfono es obligatorio** y le llega al equipo en la solicitud, para poder llamar. Ambos son rol **Usuario**; todo lo que piden aparece en **Mis pedidos** y llega al equipo como una **solicitud**.

- **Admin** (el equipo): ve las solicitudes que entran, crea y edita paquetes, y lleva solicitudes, eventos, tareas, clientes, proveedores y sedes. Entra con su email y va directo al panel.
- **Super Admin**: todo lo anterior + **borrar** (empresas/clientes, proveedores, sedes, paquetes, solicitudes), y gestionar usuarios y roles.

> El rol Admin no se puede elegir al ingresar: lo da el Super Admin desde **Usuarios**. Así un cliente nunca puede entrar a ver los datos de otros clientes.
