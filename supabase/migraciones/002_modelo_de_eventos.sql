-- =====================================================================
-- 002 · MODELO DE LA ORGANIZADORA DE EVENTOS
-- Cliente (dueño del boliche) → Solicitud → Propuesta → Aceptación → Evento (encargo)
--   → servicios con proveedores, tareas, cambios, incidentes, observaciones → cierre.
-- Más un historial que registra quién hizo qué y cuándo.
-- No toca las tablas de la versión anterior (boliches, artistas, eventos viejos…).
-- =====================================================================

create table if not exists public.clientes (
  id         bigint generated always as identity primary key,
  nombre     text not null,                 -- propietario / persona de contacto
  boliche    text,                          -- nombre del boliche
  telefono   text,
  email      text,
  notas      text,
  activo     boolean not null default true,
  created_by uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sedes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  ciudad     text,
  provincia  text,
  direccion  text,
  capacidad  int check (capacidad is null or capacidad > 0),
  cliente_id bigint references public.clientes(id) on delete set null,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.proveedores (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  servicio   text not null,                 -- DJ, Sonido, Iluminación, Barra…
  contacto   text,
  telefono   text,
  email      text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.solicitudes (
  id                   bigint generated always as identity primary key,
  cliente_id           bigint not null references public.clientes(id) on delete restrict,
  titulo               text not null,
  tipo_evento          text not null default 'Otro',
  fecha_prevista       date,
  sede_id              bigint references public.sedes(id) on delete set null,
  sede_detalle         text,
  asistentes_estimados int check (asistentes_estimados is null or asistentes_estimados >= 0),
  necesidades          text,
  medio_contacto       text,
  estado               text not null default 'en_evaluacion'
    check (estado in ('en_evaluacion', 'pendiente_informacion', 'lista_para_propuesta', 'descartada', 'convertida')),
  motivo_descarte      text,
  created_by           uuid references public.perfiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists solicitudes_cliente_idx on public.solicitudes (cliente_id);
create index if not exists solicitudes_estado_idx  on public.solicitudes (estado);

create table if not exists public.propuestas (
  id                    bigint generated always as identity primary key,
  solicitud_id          bigint not null references public.solicitudes(id) on delete cascade,
  estado                text not null default 'pendiente_respuesta'
    check (estado in ('pendiente_respuesta', 'aceptada', 'rechazada')),
  condiciones           text,
  fecha_presentacion    date not null default public.hoy_ar(),
  fecha_respuesta       date,
  medio_respuesta       text,
  observacion_respuesta text,
  respondida_por        uuid references public.perfiles(id) on delete set null,
  created_by            uuid references public.perfiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- Una sola propuesta vigente por solicitud (las rechazadas quedan como antecedente)
create unique index if not exists propuestas_vigente_uk on public.propuestas (solicitud_id) where estado <> 'rechazada';

create table if not exists public.propuesta_servicios (
  id                  bigint generated always as identity primary key,
  propuesta_id        bigint not null references public.propuestas(id) on delete cascade,
  servicio            text not null,
  descripcion         text,
  importe             numeric(14,2) not null default 0 check (importe >= 0),
  importe_confirmado  boolean not null default false,   -- false = importe estimado / a confirmar
  proveedor_id        bigint references public.proveedores(id) on delete set null,
  orden               int not null default 0
);
create index if not exists propuesta_servicios_idx on public.propuesta_servicios (propuesta_id);

create table if not exists public.encargos (
  id                          bigint generated always as identity primary key,
  solicitud_id                bigint not null unique references public.solicitudes(id) on delete restrict,
  propuesta_id                bigint references public.propuestas(id) on delete set null,
  cliente_id                  bigint not null references public.clientes(id) on delete restrict,
  nombre                      text not null,
  tipo_evento                 text not null default 'Otro',
  fecha                       date not null,
  sede_id                     bigint not null references public.sedes(id) on delete restrict,
  hora_inicio                 time,
  hora_fin                    time,
  asistentes_estimados        int check (asistentes_estimados is null or asistentes_estimados >= 0),
  condiciones                 text,
  estado                      text not null default 'confirmado'
    check (estado in ('confirmado', 'en_preparacion', 'realizado', 'cancelado')),
  fecha_aceptacion            date not null,
  medio_aceptacion            text,
  aceptacion_registrada_por   uuid references public.perfiles(id) on delete set null,
  aceptacion_registrada_en    timestamptz not null default now(),
  responsable_id              uuid references public.perfiles(id) on delete set null,   -- coordina el evento
  responsable_evento_id       uuid references public.perfiles(id) on delete set null,   -- atiende durante la realización
  cierre_registrado_en        timestamptz,
  cierre_registrado_por       uuid references public.perfiles(id) on delete set null,
  observaciones_cierre        text,
  causa_cancelacion           text,
  motivo_cancelacion          text,
  cancelacion_comunicada      boolean,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists encargos_fecha_idx   on public.encargos (fecha);
create index if not exists encargos_estado_idx  on public.encargos (estado);
create index if not exists encargos_cliente_idx on public.encargos (cliente_id);
create index if not exists encargos_sede_idx    on public.encargos (sede_id);

create table if not exists public.encargo_servicios (
  id                           bigint generated always as identity primary key,
  encargo_id                   bigint not null references public.encargos(id) on delete cascade,
  servicio                     text not null,
  descripcion                  text,
  importe                      numeric(14,2) not null default 0 check (importe >= 0),   -- acordado con el cliente
  importe_confirmado           boolean not null default false,
  proveedor_id                 bigint references public.proveedores(id) on delete set null,
  importe_proveedor            numeric(14,2) check (importe_proveedor is null or importe_proveedor >= 0), -- informado por el proveedor
  participacion                text not null default 'pendiente'
    check (participacion in ('pendiente', 'disponibilidad_informada', 'confirmada', 'rechazada')),
  participacion_nota           text,
  participacion_actualizada_por uuid references public.perfiles(id) on delete set null,
  participacion_actualizada_en  timestamptz,
  activo                       boolean not null default true,    -- false = quitado por un cambio (se conserva la referencia)
  revisar                      boolean not null default false,   -- hay que revisarlo por un cambio
  revisar_motivo               text,
  aviso_cancelacion            text not null default 'no_corresponde'
    check (aviso_cancelacion in ('no_corresponde', 'pendiente', 'avisado')),
  aviso_cancelacion_por        uuid references public.perfiles(id) on delete set null,
  aviso_cancelacion_en         timestamptz,
  orden                        int not null default 0,
  created_at                   timestamptz not null default now()
);
create index if not exists encargo_servicios_idx on public.encargo_servicios (encargo_id);
create index if not exists encargo_servicios_prov_idx on public.encargo_servicios (proveedor_id);

create table if not exists public.tareas (
  id             bigint generated always as identity primary key,
  encargo_id     bigint not null references public.encargos(id) on delete cascade,
  servicio_id    bigint references public.encargo_servicios(id) on delete set null,
  titulo         text not null,
  descripcion    text,
  responsable_id uuid references public.perfiles(id) on delete set null,
  fecha_prevista date,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'completada', 'cancelada')),
  completada_en  timestamptz,
  revisar        boolean not null default false,
  revisar_motivo text,
  created_by     uuid references public.perfiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tareas_encargo_idx on public.tareas (encargo_id);
create index if not exists tareas_resp_idx    on public.tareas (responsable_id);

create table if not exists public.cambios (
  id                   bigint generated always as identity primary key,
  encargo_id           bigint not null references public.encargos(id) on delete cascade,
  campo                text not null check (campo in ('fecha', 'sede', 'servicio', 'importe', 'condiciones', 'otro')),
  descripcion          text not null,
  valor_anterior       text,
  valor_nuevo          text,
  payload              jsonb not null default '{}'::jsonb,
  estado               text not null check (estado in ('vigente', 'pendiente_conformidad', 'rechazado_cliente')),
  requiere_conformidad boolean not null default false,
  compromisos_a_revisar text,
  registrado_por       uuid references public.perfiles(id) on delete set null,
  registrado_en        timestamptz not null default now(),
  resuelto_por         uuid references public.perfiles(id) on delete set null,
  resuelto_en          timestamptz
);
create index if not exists cambios_encargo_idx on public.cambios (encargo_id);

create table if not exists public.incidentes (
  id             bigint generated always as identity primary key,
  encargo_id     bigint not null references public.encargos(id) on delete cascade,
  servicio_id    bigint references public.encargo_servicios(id) on delete set null,
  ocurrido_en    timestamptz not null default now(),
  descripcion    text not null,
  consecuencias  text,
  medida_tomada  text,
  pendiente      text,                       -- cuestión que quedó sin resolver (vacío = nada pendiente)
  registrado_por uuid references public.perfiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists incidentes_encargo_idx on public.incidentes (encargo_id);

create table if not exists public.observaciones (
  id             bigint generated always as identity primary key,
  encargo_id     bigint not null references public.encargos(id) on delete cascade,
  proveedor_id   bigint references public.proveedores(id) on delete set null,
  texto          text not null,
  registrado_por uuid references public.perfiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists observaciones_encargo_idx on public.observaciones (encargo_id);
create index if not exists observaciones_prov_idx    on public.observaciones (proveedor_id);

create table if not exists public.historial (
  id             bigint generated always as identity primary key,
  solicitud_id   bigint references public.solicitudes(id) on delete cascade,
  encargo_id     bigint references public.encargos(id) on delete cascade,
  accion         text not null,
  detalle        text,
  valor_anterior text,
  valor_nuevo    text,
  usuario_id     uuid references public.perfiles(id) on delete set null,
  usuario_nombre text,
  created_at     timestamptz not null default now()
);
create index if not exists historial_encargo_idx   on public.historial (encargo_id, created_at);
create index if not exists historial_solicitud_idx on public.historial (solicitud_id, created_at);

-- updated_at automático
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
do $$
declare t text;
begin
  foreach t in array array['clientes', 'solicitudes', 'propuestas', 'encargos', 'tareas'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Seguridad: RLS activado en todo. El backend usa la service_role (se saltea el RLS);
-- con la anon key pública nadie puede leer ni escribir nada.
alter table public.clientes            enable row level security;
alter table public.sedes               enable row level security;
alter table public.proveedores         enable row level security;
alter table public.solicitudes         enable row level security;
alter table public.propuestas          enable row level security;
alter table public.propuesta_servicios enable row level security;
alter table public.encargos            enable row level security;
alter table public.encargo_servicios   enable row level security;
alter table public.tareas              enable row level security;
alter table public.cambios             enable row level security;
alter table public.incidentes          enable row level security;
alter table public.observaciones       enable row level security;
alter table public.historial           enable row level security;

notify pgrst, 'reload schema';
