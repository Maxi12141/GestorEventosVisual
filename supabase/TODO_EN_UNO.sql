-- ===== 001 =====
-- =====================================================================
-- 001 · USUARIOS Y ROLES
-- Pegalo completo en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Roles:
--   super_admin → todo, incluido administrar usuarios y borrar
--   admin       → lleva los eventos: solicitudes, propuestas, aceptación, cambios, cierre
--   usuario     → colabora: contacta proveedores, hace tareas, anota incidentes (no ve importes)
-- El PRIMER usuario que se registra queda como super_admin.
-- =====================================================================

create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nombre     text,
  rol        text not null default 'usuario',
  created_at timestamptz not null default now()
);

-- Roles: super_admin / admin / usuario  (se convierte una sola vez, es seguro correrlo de nuevo)
do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def from pg_constraint where conname = 'perfiles_rol_check' and conrelid = 'public.perfiles'::regclass;
  if def is null or def not like '%super_admin%' then
    alter table public.perfiles drop constraint if exists perfiles_rol_check;
    update public.perfiles set rol = 'super_admin' where rol = 'admin';
    update public.perfiles set rol = 'admin'       where rol in ('coordinacion', 'productor');
    update public.perfiles set rol = 'usuario'     where rol not in ('super_admin', 'admin');
    alter table public.perfiles add constraint perfiles_rol_check check (rol in ('super_admin', 'admin', 'usuario'));
  end if;
end $$;
alter table public.perfiles alter column rol set default 'usuario';
alter table public.perfiles add column if not exists activo boolean not null default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.perfiles) then 'super_admin' else 'usuario' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían y todavía no tienen perfil (el más viejo, admin si no hay ninguno)
insert into public.perfiles (id, email, nombre, rol)
select u.id, u.email,
       coalesce(nullif(u.raw_user_meta_data->>'nombre', ''), split_part(u.email, '@', 1)),
       case when row_number() over (order by u.created_at) = 1
                 and not exists (select 1 from public.perfiles) then 'super_admin' else 'usuario' end
from auth.users u
where not exists (select 1 from public.perfiles p where p.id = u.id);

alter table public.perfiles enable row level security;

-- Fecha de hoy en Argentina (para validar fechas sin depender de la zona del servidor)
create or replace function public.hoy_ar() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- ===== 002 =====
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

-- ===== 003 =====
-- =====================================================================
-- 003 · FUNCIONES (operaciones que tocan varias tablas: o se hacen completas o no se hacen)
-- Solo las puede ejecutar el backend (service_role).
-- =====================================================================

-- Registra una línea en el historial
create or replace function public.log_hist(
  p_sol bigint, p_enc bigint, p_accion text, p_detalle text,
  p_ant text, p_nuevo text, p_user uuid, p_nombre text
) returns void language sql as $$
  insert into public.historial (solicitud_id, encargo_id, accion, detalle, valor_anterior, valor_nuevo, usuario_id, usuario_nombre)
  values (p_sol, p_enc, p_accion, p_detalle, p_ant, p_nuevo, p_user, p_nombre);
$$;

-- ---------------------------------------------------------------------
-- PROPUESTA: crear o modificar (una sola vigente por solicitud)
-- ---------------------------------------------------------------------
create or replace function public.guardar_propuesta(
  p_solicitud_id bigint, p_propuesta_id bigint, p jsonb, p_user uuid, p_nombre text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  s     solicitudes%rowtype;
  v_id  bigint := p_propuesta_id;
  v_n   int;
  v_tot numeric;
begin
  select * into s from solicitudes where id = p_solicitud_id for update;
  if not found then raise exception 'La solicitud no existe'; end if;
  if s.estado in ('descartada', 'convertida') then
    raise exception 'La solicitud está %: ya no se puede preparar una propuesta', replace(s.estado, '_', ' ');
  end if;

  select count(*) into v_n from jsonb_array_elements(coalesce(p->'servicios', '[]'::jsonb));
  if v_n = 0 then raise exception 'La propuesta necesita al menos un servicio'; end if;
  if exists (select 1 from jsonb_to_recordset(p->'servicios') as x(servicio text) where coalesce(trim(x.servicio), '') = '') then
    raise exception 'Todos los servicios necesitan un nombre';
  end if;

  if v_id is null then
    if exists (select 1 from propuestas where solicitud_id = p_solicitud_id and estado <> 'rechazada') then
      raise exception 'Esta solicitud ya tiene una propuesta vigente: modificala en lugar de crear otra';
    end if;
    insert into propuestas (solicitud_id, condiciones, created_by)
    values (p_solicitud_id, nullif(trim(p->>'condiciones'), ''), p_user)
    returning id into v_id;
  else
    perform 1 from propuestas where id = v_id and solicitud_id = p_solicitud_id and estado = 'pendiente_respuesta' for update;
    if not found then raise exception 'Solo se puede modificar una propuesta que esté pendiente de respuesta'; end if;
    update propuestas set condiciones = nullif(trim(p->>'condiciones'), '') where id = v_id;
    delete from propuesta_servicios where propuesta_id = v_id;
  end if;

  insert into propuesta_servicios (propuesta_id, servicio, descripcion, importe, importe_confirmado, proveedor_id, orden)
  select v_id, trim(x.servicio), nullif(trim(x.descripcion), ''), coalesce(x.importe, 0),
         coalesce(x.importe_confirmado, false), x.proveedor_id, (row_number() over ())::int
    from jsonb_to_recordset(p->'servicios')
         as x(servicio text, descripcion text, importe numeric, importe_confirmado boolean, proveedor_id bigint);

  select coalesce(sum(importe), 0) into v_tot from propuesta_servicios where propuesta_id = v_id;
  perform log_hist(p_solicitud_id, null,
    case when p_propuesta_id is null then 'propuesta_presentada' else 'propuesta_modificada' end,
    v_n || ' servicio(s)', null, v_tot::text, p_user, p_nombre);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- ACEPTACIÓN: la propuesta pasa a "aceptada" y nace el evento confirmado con sus servicios
-- ---------------------------------------------------------------------
create or replace function public.aceptar_propuesta(
  p_propuesta_id bigint, p jsonb, p_user uuid, p_nombre text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  pr     propuestas%rowtype;
  s      solicitudes%rowtype;
  v_enc  bigint;
  v_fecha date := nullif(p->>'fecha', '')::date;
  v_sede  bigint := nullif(p->>'sede_id', '')::bigint;
begin
  select * into pr from propuestas where id = p_propuesta_id for update;
  if not found then raise exception 'La propuesta no existe'; end if;
  if pr.estado <> 'pendiente_respuesta' then
    raise exception 'La propuesta ya está % y no se puede aceptar', pr.estado;
  end if;
  select * into s from solicitudes where id = pr.solicitud_id for update;
  if exists (select 1 from encargos where solicitud_id = s.id) then
    raise exception 'Esta solicitud ya tiene un evento confirmado';
  end if;
  if v_fecha is null then raise exception 'Para registrar la aceptación la fecha tiene que estar definida'; end if;
  if v_fecha < hoy_ar() then raise exception 'La fecha acordada ya pasó'; end if;
  if v_sede is null or not exists (select 1 from sedes where id = v_sede) then
    raise exception 'Para registrar la aceptación la sede tiene que estar definida';
  end if;

  insert into encargos (solicitud_id, propuesta_id, cliente_id, nombre, tipo_evento, fecha, sede_id, hora_inicio, hora_fin,
                        asistentes_estimados, condiciones, fecha_aceptacion, medio_aceptacion,
                        aceptacion_registrada_por, responsable_id)
  values (s.id, pr.id, s.cliente_id, coalesce(nullif(trim(p->>'nombre'), ''), s.titulo), s.tipo_evento, v_fecha, v_sede,
          nullif(p->>'hora_inicio', '')::time, nullif(p->>'hora_fin', '')::time,
          coalesce(nullif(p->>'asistentes_estimados', '')::int, s.asistentes_estimados),
          coalesce(nullif(trim(p->>'condiciones'), ''), pr.condiciones),
          coalesce(nullif(p->>'fecha_aceptacion', '')::date, hoy_ar()), nullif(trim(p->>'medio_aceptacion'), ''),
          p_user, coalesce(nullif(p->>'responsable_id', '')::uuid, p_user))
  returning id into v_enc;

  insert into encargo_servicios (encargo_id, servicio, descripcion, importe, importe_confirmado, proveedor_id, orden)
  select v_enc, servicio, descripcion, importe, importe_confirmado, proveedor_id, orden
    from propuesta_servicios where propuesta_id = pr.id order by orden, id;

  update propuestas set estado = 'aceptada', fecha_respuesta = hoy_ar(), respondida_por = p_user,
         medio_respuesta = nullif(trim(p->>'medio_aceptacion'), '') where id = pr.id;
  update solicitudes set estado = 'convertida' where id = s.id;

  perform log_hist(s.id, v_enc, 'propuesta_aceptada',
    'El cliente aceptó la propuesta' || coalesce(' (' || nullif(trim(p->>'medio_aceptacion'), '') || ')', ''),
    null, v_fecha::text, p_user, p_nombre);
  return v_enc;
end;
$$;

-- ---------------------------------------------------------------------
-- CAMBIOS RELEVANTES
--  · Si el cambio altera lo que el cliente aceptó, queda PENDIENTE hasta que el cliente dé su
--    conformidad: mientras tanto sigue vigente lo anterior.
--  · Al hacerse vigente, marca para REVISAR los servicios y tareas afectados.
-- ---------------------------------------------------------------------
create or replace function public.aplicar_cambio(p_cambio_id bigint, p_user uuid, p_nombre text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c      cambios%rowtype;
  e      encargos%rowtype;
  v_pay  jsonb;
  v_ns   int;
  v_nt   int;
  v_mot  text;
begin
  select * into c from cambios where id = p_cambio_id for update;
  select * into e from encargos where id = c.encargo_id for update;
  v_pay := c.payload;

  if c.campo in ('fecha', 'sede') then
    if c.campo = 'fecha' then
      if (v_pay->>'fecha')::date < hoy_ar() then raise exception 'La nueva fecha ya pasó'; end if;
      update encargos set fecha = (v_pay->>'fecha')::date where id = e.id;
      v_mot := 'Cambió la fecha: ' || e.fecha::text || ' → ' || (v_pay->>'fecha');
    else
      update encargos set sede_id = (v_pay->>'sede_id')::bigint where id = e.id;
      v_mot := 'Cambió la sede: ' || coalesce(c.valor_anterior, '?') || ' → ' || coalesce(c.valor_nuevo, '?');
    end if;
    update encargo_servicios set revisar = true, revisar_motivo = v_mot
     where encargo_id = e.id and activo and participacion <> 'rechazada';
    update tareas set revisar = true, revisar_motivo = v_mot
     where encargo_id = e.id and estado in ('pendiente', 'en_curso');

  elsif c.campo = 'importe' then
    update encargo_servicios
       set importe = (v_pay->>'importe')::numeric,
           importe_confirmado = coalesce((v_pay->>'importe_confirmado')::boolean, importe_confirmado),
           revisar = true, revisar_motivo = 'Cambió el importe: ' || coalesce(c.valor_anterior, '?') || ' → ' || coalesce(c.valor_nuevo, '?')
     where id = (v_pay->>'servicio_id')::bigint and encargo_id = e.id;

  elsif c.campo = 'servicio' then
    if v_pay->>'accion' = 'agregar' then
      insert into encargo_servicios (encargo_id, servicio, descripcion, importe, importe_confirmado, proveedor_id, revisar, revisar_motivo, orden)
      values (e.id, trim(v_pay->>'servicio'), nullif(trim(v_pay->>'descripcion'), ''), coalesce((v_pay->>'importe')::numeric, 0),
              coalesce((v_pay->>'importe_confirmado')::boolean, false), nullif(v_pay->>'proveedor_id', '')::bigint,
              true, 'Servicio agregado: hay que conseguir y confirmar al proveedor', 99);
    elsif v_pay->>'accion' = 'quitar' then
      update encargo_servicios set activo = false, revisar = true,
             revisar_motivo = 'Servicio quitado: avisar al proveedor si estaba contactado'
       where id = (v_pay->>'servicio_id')::bigint and encargo_id = e.id;
    else
      update encargo_servicios
         set servicio = coalesce(nullif(trim(v_pay->>'servicio'), ''), servicio),
             descripcion = case when v_pay ? 'descripcion' then nullif(trim(v_pay->>'descripcion'), '') else descripcion end,
             proveedor_id = case when v_pay ? 'proveedor_id' then nullif(v_pay->>'proveedor_id', '')::bigint else proveedor_id end,
             participacion = case when v_pay ? 'proveedor_id' then 'pendiente' else participacion end,
             revisar = true, revisar_motivo = 'Servicio modificado: ' || coalesce(c.descripcion, '')
       where id = (v_pay->>'servicio_id')::bigint and encargo_id = e.id;
    end if;

  elsif c.campo = 'condiciones' then
    update encargos set condiciones = nullif(trim(v_pay->>'condiciones'), '') where id = e.id;
  end if;

  select count(*) into v_ns from encargo_servicios where encargo_id = e.id and revisar;
  select count(*) into v_nt from tareas where encargo_id = e.id and revisar;
  update cambios set estado = 'vigente',
         compromisos_a_revisar = case when v_ns + v_nt = 0 then null
           else v_ns || ' servicio(s) y ' || v_nt || ' tarea(s) para revisar' end
   where id = c.id;
  perform log_hist(e.solicitud_id, e.id, 'cambio_' || c.campo, c.descripcion, c.valor_anterior, c.valor_nuevo, p_user, p_nombre);
end;
$$;

create or replace function public.registrar_cambio(p_encargo_id bigint, p jsonb, p_user uuid, p_nombre text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  e       encargos%rowtype;
  v_campo text := p->>'campo';
  v_pay   jsonb := coalesce(p->'payload', '{}'::jsonb);
  v_req   boolean := coalesce((p->>'requiere_conformidad')::boolean, false);
  v_conf  text := coalesce(p->>'conformidad', 'no_requiere');
  v_ant   text;
  v_nue   text;
  v_id    bigint;
  v_est   text;
  sv      encargo_servicios%rowtype;
begin
  select * into e from encargos where id = p_encargo_id for update;
  if not found then raise exception 'El evento no existe'; end if;
  if e.estado in ('realizado', 'cancelado') then
    raise exception 'El evento está %: reabrilo para registrar cambios', e.estado;
  end if;
  if v_campo is null or v_campo not in ('fecha', 'sede', 'servicio', 'importe', 'condiciones', 'otro') then
    raise exception 'Tipo de cambio inválido';
  end if;
  if coalesce(trim(p->>'descripcion'), '') = '' then raise exception 'Describí el cambio'; end if;

  if v_campo = 'fecha' then
    if nullif(v_pay->>'fecha', '') is null then raise exception 'Falta la nueva fecha'; end if;
    if (v_pay->>'fecha')::date < hoy_ar() then raise exception 'La nueva fecha ya pasó'; end if;
    if (v_pay->>'fecha')::date = e.fecha then raise exception 'La nueva fecha es igual a la actual'; end if;
    v_ant := e.fecha::text; v_nue := v_pay->>'fecha';
  elsif v_campo = 'sede' then
    if not exists (select 1 from sedes where id = nullif(v_pay->>'sede_id', '')::bigint) then raise exception 'La nueva sede no existe'; end if;
    if (v_pay->>'sede_id')::bigint = e.sede_id then raise exception 'La nueva sede es la misma que la actual'; end if;
    select nombre into v_ant from sedes where id = e.sede_id;
    select nombre into v_nue from sedes where id = (v_pay->>'sede_id')::bigint;
  elsif v_campo = 'importe' then
    select * into sv from encargo_servicios where id = nullif(v_pay->>'servicio_id', '')::bigint and encargo_id = e.id and activo;
    if not found then raise exception 'El servicio no pertenece a este evento'; end if;
    if coalesce((v_pay->>'importe')::numeric, -1) < 0 then raise exception 'El importe nuevo no es válido'; end if;
    v_ant := sv.servicio || ': ' || sv.importe::text; v_nue := sv.servicio || ': ' || (v_pay->>'importe');
  elsif v_campo = 'servicio' then
    if coalesce(v_pay->>'accion', '') not in ('agregar', 'quitar', 'modificar') then raise exception 'Acción de servicio inválida'; end if;
    if v_pay->>'accion' = 'agregar' then
      if coalesce(trim(v_pay->>'servicio'), '') = '' then raise exception 'Falta el nombre del servicio'; end if;
      v_nue := trim(v_pay->>'servicio');
    else
      select * into sv from encargo_servicios where id = nullif(v_pay->>'servicio_id', '')::bigint and encargo_id = e.id and activo;
      if not found then raise exception 'El servicio no pertenece a este evento'; end if;
      v_ant := sv.servicio;
      if v_pay->>'accion' = 'modificar' then v_nue := coalesce(nullif(trim(v_pay->>'servicio'), ''), sv.servicio); end if;
    end if;
  elsif v_campo = 'condiciones' then
    v_ant := e.condiciones; v_nue := nullif(trim(v_pay->>'condiciones'), '');
  end if;

  v_est := case when v_req and v_conf = 'pendiente' then 'pendiente_conformidad' else 'vigente' end;
  insert into cambios (encargo_id, campo, descripcion, valor_anterior, valor_nuevo, payload, estado, requiere_conformidad, registrado_por)
  values (e.id, v_campo, trim(p->>'descripcion'), v_ant, v_nue, v_pay, v_est, v_req, p_user)
  returning id into v_id;

  if v_est = 'vigente' then
    perform aplicar_cambio(v_id, p_user, p_nombre);
    if v_req then update cambios set resuelto_por = p_user, resuelto_en = now() where id = v_id; end if;
  else
    perform log_hist(e.solicitud_id, e.id, 'cambio_pendiente_conformidad',
      trim(p->>'descripcion') || ' (esperando conformidad del cliente: sigue vigente lo anterior)', v_ant, v_nue, p_user, p_nombre);
  end if;
  return v_id;
end;
$$;

create or replace function public.resolver_cambio(p_cambio_id bigint, p_resultado text, p_user uuid, p_nombre text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c cambios%rowtype;
  e encargos%rowtype;
begin
  select * into c from cambios where id = p_cambio_id for update;
  if not found then raise exception 'El cambio no existe'; end if;
  if c.estado <> 'pendiente_conformidad' then raise exception 'Este cambio ya fue resuelto'; end if;
  select * into e from encargos where id = c.encargo_id for update;
  if e.estado in ('realizado', 'cancelado') then raise exception 'El evento está %: reabrilo para resolver este cambio', e.estado; end if;

  if p_resultado = 'conforme' then
    perform aplicar_cambio(c.id, p_user, p_nombre);
    update cambios set resuelto_por = p_user, resuelto_en = now() where id = c.id;
    perform log_hist(e.solicitud_id, e.id, 'cambio_conformidad', 'El cliente dio su conformidad: ' || c.descripcion, c.valor_anterior, c.valor_nuevo, p_user, p_nombre);
  elsif p_resultado = 'rechazado' then
    update cambios set estado = 'rechazado_cliente', resuelto_por = p_user, resuelto_en = now() where id = c.id;
    perform log_hist(e.solicitud_id, e.id, 'cambio_rechazado', 'El cliente no aceptó el cambio: ' || c.descripcion || ' (sigue vigente lo anterior)', c.valor_anterior, c.valor_nuevo, p_user, p_nombre);
  else
    raise exception 'Resultado inválido';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- CIERRE OPERATIVO: realizado o cancelado
-- ---------------------------------------------------------------------
create or replace function public.cerrar_encargo(p_id bigint, p jsonb, p_user uuid, p_nombre text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e   encargos%rowtype;
  v_res text := p->>'resultado';
  v_nt int := 0;
  v_ns int := 0;
begin
  select * into e from encargos where id = p_id for update;
  if not found then raise exception 'El evento no existe'; end if;
  if e.estado in ('realizado', 'cancelado') then raise exception 'El evento ya está cerrado como %', e.estado; end if;

  if v_res = 'realizado' then
    if e.fecha > hoy_ar() then raise exception 'Todavía no llegó la fecha del evento: no se puede registrar como realizado'; end if;
    update encargos set estado = 'realizado', cierre_registrado_en = now(), cierre_registrado_por = p_user,
           observaciones_cierre = nullif(trim(p->>'observaciones'), '') where id = e.id;
    perform log_hist(e.solicitud_id, e.id, 'evento_realizado', coalesce(nullif(trim(p->>'observaciones'), ''), 'Sin observaciones'), e.estado, 'realizado', p_user, p_nombre);
  elsif v_res = 'cancelado' then
    if coalesce(trim(p->>'motivo'), '') = '' then raise exception 'Para cancelar tenés que registrar el motivo'; end if;
    update encargos set estado = 'cancelado', cierre_registrado_en = now(), cierre_registrado_por = p_user,
           observaciones_cierre = nullif(trim(p->>'observaciones'), ''),
           causa_cancelacion = nullif(trim(p->>'causa'), ''), motivo_cancelacion = trim(p->>'motivo'),
           cancelacion_comunicada = (p->>'comunicada_cliente')::boolean
     where id = e.id;
    -- las tareas que quedaban abiertas ya no corresponden (se conservan, marcadas como canceladas)
    update tareas set estado = 'cancelada', revisar = false where encargo_id = e.id and estado in ('pendiente', 'en_curso');
    get diagnostics v_nt = row_count;
    -- hay que avisar a los proveedores que estaban involucrados
    update encargo_servicios set aviso_cancelacion = 'pendiente', revisar = false
     where encargo_id = e.id and activo and proveedor_id is not null and participacion <> 'rechazada';
    get diagnostics v_ns = row_count;
    perform log_hist(e.solicitud_id, e.id, 'evento_cancelado', trim(p->>'motivo'), e.estado, 'cancelado', p_user, p_nombre);
  else
    raise exception 'Resultado inválido: tiene que ser realizado o cancelado';
  end if;
  return jsonb_build_object('tareas_canceladas', v_nt, 'proveedores_a_avisar', v_ns);
end;
$$;

create or replace function public.reabrir_encargo(p_id bigint, p_motivo text, p_user uuid, p_nombre text)
returns void
language plpgsql security definer set search_path = public as $$
declare e encargos%rowtype;
begin
  select * into e from encargos where id = p_id for update;
  if not found then raise exception 'El evento no existe'; end if;
  if e.estado not in ('realizado', 'cancelado') then raise exception 'El evento no está cerrado'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Indicá por qué se reabre el evento'; end if;
  update encargos set estado = 'en_preparacion', cierre_registrado_en = null, cierre_registrado_por = null where id = e.id;
  perform log_hist(e.solicitud_id, e.id, 'evento_reabierto', trim(p_motivo), e.estado, 'en_preparacion', p_user, p_nombre);
end;
$$;

-- Corrección de datos del cierre (sin reabrir el evento)
create or replace function public.corregir_cierre(p_id bigint, p jsonb, p_user uuid, p_nombre text)
returns void
language plpgsql security definer set search_path = public as $$
declare e encargos%rowtype;
begin
  select * into e from encargos where id = p_id for update;
  if not found then raise exception 'El evento no existe'; end if;
  if e.estado not in ('realizado', 'cancelado') then raise exception 'El evento no está cerrado'; end if;
  if coalesce(trim(p->>'motivo_correccion'), '') = '' then raise exception 'Indicá qué se corrigió y por qué'; end if;
  if e.estado = 'cancelado' and p ? 'motivo_cancelacion' and coalesce(trim(p->>'motivo_cancelacion'), '') = '' then
    raise exception 'El motivo de la cancelación no puede quedar vacío';
  end if;
  update encargos set
    observaciones_cierre = case when p ? 'observaciones_cierre' then nullif(trim(p->>'observaciones_cierre'), '') else observaciones_cierre end,
    motivo_cancelacion   = case when e.estado = 'cancelado' and p ? 'motivo_cancelacion' then trim(p->>'motivo_cancelacion') else motivo_cancelacion end,
    causa_cancelacion    = case when e.estado = 'cancelado' and p ? 'causa_cancelacion' then nullif(trim(p->>'causa_cancelacion'), '') else causa_cancelacion end
  where id = e.id;
  perform log_hist(e.solicitud_id, e.id, 'cierre_corregido', trim(p->>'motivo_correccion'), null, null, p_user, p_nombre);
end;
$$;

-- Solo el backend (service_role) puede ejecutarlas
do $$
declare f text;
begin
  foreach f in array array[
    'log_hist(bigint,bigint,text,text,text,text,uuid,text)',
    'guardar_propuesta(bigint,bigint,jsonb,uuid,text)',
    'aceptar_propuesta(bigint,jsonb,uuid,text)',
    'aplicar_cambio(bigint,uuid,text)',
    'registrar_cambio(bigint,jsonb,uuid,text)',
    'resolver_cambio(bigint,text,uuid,text)',
    'cerrar_encargo(bigint,jsonb,uuid,text)',
    'reabrir_encargo(bigint,text,uuid,text)',
    'corregir_cierre(bigint,jsonb,uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ===== 007 =====
-- =====================================================================
-- 007 · PAQUETES DE EVENTO
-- El Admin arma paquetes (según capacidad del boliche/festival).
-- El Usuario (cliente) elige uno y lo contrata → se crea una solicitud.
-- =====================================================================
create table if not exists public.paquetes (
  id            bigint generated always as identity primary key,
  nombre        text not null,
  descripcion   text,
  tipo          text not null default 'Boliche' check (tipo in ('Boliche', 'Festival', 'Otro')),
  capacidad_min int not null default 1 check (capacidad_min >= 0),
  capacidad_max int not null default 100 check (capacidad_max >= capacidad_min),
  precio        numeric(14,2) not null default 0 check (precio >= 0),
  servicios     text[] not null default '{}',
  activo        boolean not null default true,
  created_by    uuid references public.perfiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.paquetes enable row level security;

alter table public.solicitudes add column if not exists paquete_id bigint references public.paquetes(id) on delete set null;

insert into public.paquetes (nombre, descripcion, tipo, capacidad_min, capacidad_max, precio, servicios)
select * from (values
  ('Boliche Chico',   'Noche completa para boliches de hasta 300 personas.', 'Boliche',  1,   300,  900000,  array['DJ','Sonido','Iluminación']),
  ('Boliche Mediano', 'Para boliches de 301 a 800 personas.',               'Boliche',  301, 800,  2200000, array['DJ','Sonido','Iluminación','Barra','Seguridad']),
  ('Festival Grande', 'Festival de más de 800 personas, todo incluido.',    'Festival', 801, 5000, 9500000, array['Artista en vivo','Sonido','Iluminación','Pantallas y visuales','Barra','Seguridad','Fotografía'])
) v(n, d, t, a, b, p, s)
where not exists (select 1 from public.paquetes);

notify pgrst, 'reload schema';

notify pgrst, 'reload schema';

-- =====================================================================
-- (archivo 008 incluido a continuación)
-- =====================================================================
-- 008 · PAQUETES CON DETALLE + PAQUETE ARMADO POR EL CLIENTE
-- Agrega al paquete: qué incluye (una línea por ítem), duración e "ideal para".
-- Agrega a la solicitud el total estimado (cuando el cliente arma su propio paquete).
-- Carga más paquetes de ejemplo (los precios son de ejemplo: editalos desde Paquetes).
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================
alter table public.paquetes add column if not exists incluye   text[] not null default '{}';
alter table public.paquetes add column if not exists duracion  text;
alter table public.paquetes add column if not exists ideal_para text;
alter table public.solicitudes add column if not exists total_estimado numeric(14,2);

-- Detalle de los 3 paquetes que ya existían
update public.paquetes set
  duracion = '5 horas', ideal_para = 'Boliches chicos y noches de semana',
  incluye = array['DJ residente durante 5 horas','Sonido profesional para hasta 300 personas','Iluminación básica (cabezales y luces de pista)','Armado y desarmado del equipo','Un responsable del equipo presente toda la noche']
where nombre = 'Boliche Chico' and cardinality(incluye) = 0;

update public.paquetes set
  duracion = '6 horas', ideal_para = 'Boliches medianos los fines de semana',
  incluye = array['DJ residente + DJ invitado durante 6 horas','Sonido profesional para hasta 800 personas','Iluminación de pista con láser','Barra con 3 tragos de la casa y bebidas sin alcohol','4 personas de seguridad','Armado y desarmado del equipo','Un responsable del equipo presente toda la noche']
where nombre = 'Boliche Mediano' and cardinality(incluye) = 0;

update public.paquetes set
  duracion = '8 horas', ideal_para = 'Festivales y shows grandes',
  incluye = array['Artista argentino en vivo (show de 90 minutos)','Sonido de escenario y de campo para miles de personas','Iluminación de escenario y pantallas LED','Barra en 2 puntos con carta de tragos','12 personas de seguridad','Fotografía y video del evento','Camarines y producción técnica','Un responsable del equipo presente toda la noche']
where nombre = 'Festival Grande' and cardinality(incluye) = 0;

-- Paquetes nuevos (solo se cargan si no existe uno con el mismo nombre)
insert into public.paquetes (nombre, descripcion, tipo, capacidad_min, capacidad_max, precio, servicios, duracion, ideal_para, incluye)
select v.* from (values
  ('Cumpleaños y Fiesta Privada', 'Una fiesta privada con DJ, sonido y luces, lista para disfrutar.', 'Otro', 1, 150, 450000,
     array['DJ','Sonido','Iluminación','Ambientación'], '4 horas', 'Cumpleaños, despedidas y festejos íntimos',
     array['DJ durante 4 horas con la música que elijas','Sonido para hasta 150 personas','Luces de ambiente','Ambientación básica del salón','Armado y desarmado incluidos']),
  ('Boliche Chico Plus', 'El paquete chico con barra y seguridad para que no te preocupes por nada.', 'Boliche', 1, 300, 1350000,
     array['DJ','Sonido','Iluminación','Barra','Seguridad'], '6 horas', 'Boliches chicos que quieren una noche completa',
     array['DJ residente durante 6 horas','Sonido profesional para hasta 300 personas','Iluminación de pista con láser','Barra con 2 tragos de la casa y bebidas sin alcohol','2 personas de seguridad','Armado y desarmado del equipo']),
  ('Noche de Cuarteto y Cumbia', 'Noche temática con banda en vivo y DJ para bailar toda la noche.', 'Boliche', 1, 500, 2600000,
     array['Artista en vivo','DJ','Sonido','Iluminación','Seguridad'], '6 horas', 'Boliches con público de cuarteto, cumbia o música tropical',
     array['Banda o artista argentino en vivo (show de 60 minutos)','DJ antes y después del show','Sonido profesional para hasta 500 personas','Iluminación de pista','3 personas de seguridad','Camarín para el artista']),
  ('Fiesta de Egresados', 'Pensado para fiestas de fin de curso con mucha gente joven.', 'Otro', 100, 600, 1700000,
     array['DJ','Sonido','Iluminación','Pantallas y visuales','Seguridad','Fotografía'], '6 horas', 'Egresados, fiestas de fin de curso y festejos grandes',
     array['DJ durante 6 horas','Sonido para hasta 600 personas','Iluminación con láser y pantallas','Bebidas sin alcohol incluidas','4 personas de seguridad','Fotografía del evento']),
  ('Evento Corporativo', 'Para fiestas de empresa, lanzamientos y after office.', 'Otro', 1, 250, 780000,
     array['DJ','Sonido','Iluminación','Ambientación','Fotografía'], '5 horas', 'Empresas, lanzamientos y after office',
     array['DJ o música ambiente durante 5 horas','Sonido para presentaciones y música','Iluminación y ambientación con la marca de la empresa','Fotografía del evento','Un responsable del equipo presente toda la noche']),
  ('Boliche Mediano Premium', 'El mediano con artista en vivo, pantallas y barra completa.', 'Boliche', 301, 800, 3400000,
     array['Artista en vivo','DJ','Sonido','Iluminación','Pantallas y visuales','Barra','Seguridad'], '7 horas', 'Boliches medianos que quieren una noche de show',
     array['Artista argentino en vivo (show de 60 minutos)','DJ residente durante 7 horas','Sonido profesional para hasta 800 personas','Iluminación con láser y pantallas LED','Barra completa con carta de tragos','6 personas de seguridad','Camarín para el artista']),
  ('Boliche Grande', 'Para boliches de 801 a 1500 personas, con todo lo necesario.', 'Boliche', 801, 1500, 4800000,
     array['DJ','Sonido','Iluminación','Pantallas y visuales','Barra','Seguridad'], '7 horas', 'Boliches grandes y noches de fin de semana largo',
     array['2 DJs durante 7 horas','Sonido profesional para hasta 1500 personas','Iluminación con láser y pantallas LED','Barra en 2 puntos','10 personas de seguridad','Armado y desarmado del equipo','Un responsable del equipo presente toda la noche']),
  ('Festival Chico', 'Festival de un escenario para 400 a 1500 personas.', 'Festival', 400, 1500, 4200000,
     array['Artista en vivo','Sonido','Iluminación','Barra','Seguridad'], '6 horas', 'Festivales de barrio, fiestas populares y eventos al aire libre',
     array['Un artista argentino en vivo (show de 75 minutos)','Banda soporte o DJ de apertura','Sonido de escenario y de campo','Iluminación de escenario','Barra en 1 punto','6 personas de seguridad']),
  ('Festival Premium', 'Festival de varios artistas para más de 2000 personas, con producción completa.', 'Festival', 2000, 10000, 18000000,
     array['Artista en vivo','Sonido','Iluminación','Pantallas y visuales','Barra','Seguridad','Fotografía','Ambientación'], '10 horas', 'Grandes festivales con varios artistas',
     array['3 artistas argentinos en vivo','Sonido de escenario y de campo para miles de personas','Iluminación de escenario y 2 pantallas LED','Barra en 4 puntos con carta de tragos','25 personas de seguridad','Fotografía y video del evento','Ambientación y sectores VIP','Camarines y producción técnica'])
) as v(nombre, descripcion, tipo, capacidad_min, capacidad_max, precio, servicios, duracion, ideal_para, incluye)
where not exists (select 1 from public.paquetes p where p.nombre = v.nombre);

notify pgrst, 'reload schema';

-- ===== 010 =====
-- =====================================================================
-- 010 · TIPO DE CUENTA (Cliente / Admin) — solo afecta a los usuarios
-- Al crear la cuenta se elige una de dos:
--   contratar → "Cliente": solo puede elegir uno de los paquetes ya armados
--   armar     → "Admin":   solo puede armar (crear) el suyo, no elige uno hecho
-- Las cuentas que ya existían quedan como "contratar".
-- Se puede correr más de una vez.
-- =====================================================================
alter table public.perfiles add column if not exists modo text not null default 'contratar';
alter table public.perfiles drop constraint if exists perfiles_modo_check;
alter table public.perfiles add constraint perfiles_modo_check check (modo in ('contratar', 'armar'));

notify pgrst, 'reload schema';
-- =====================================================================
-- 011 · DOS ROLES (usuario / super_admin) + PEDIDOS DE CLIENTES
--   · Los "admin" viejos pasan a super_admin (llevan los eventos).
--   · Se agrega solicitudes.origen ('interno' | 'cliente') y solicitudes.visto_at:
--     los pedidos que confirma un usuario llegan marcados como "cliente" y sin ver,
--     así los Super Admin reciben el aviso hasta que los abren.
--   · Topes de seguridad: no se aceptan cantidades absurdas de personas.
-- Se puede correr más de una vez.
-- =====================================================================
alter table public.perfiles drop constraint if exists perfiles_rol_check;
update public.perfiles set rol = 'super_admin' where rol = 'admin';
update public.perfiles set rol = 'usuario' where rol not in ('super_admin', 'usuario');
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('super_admin', 'usuario'));

alter table public.solicitudes add column if not exists origen text not null default 'interno';
alter table public.solicitudes drop constraint if exists solicitudes_origen_check;
alter table public.solicitudes add constraint solicitudes_origen_check check (origen in ('interno', 'cliente'));
alter table public.solicitudes add column if not exists visto_at timestamptz;
create index if not exists solicitudes_nuevas_idx on public.solicitudes (origen, visto_at);

alter table public.solicitudes drop constraint if exists solicitudes_asistentes_tope;
alter table public.solicitudes add constraint solicitudes_asistentes_tope check (asistentes_estimados is null or asistentes_estimados <= 50000) not valid;

notify pgrst, 'reload schema';
-- =====================================================================
-- 012 · TOPES DE SEGURIDAD EN LA BASE
-- Última barrera por si algo se saltea las validaciones del servidor:
-- nada de 1.000.000.000 de personas ni capacidades/precios sin sentido.
-- Se aplican a los datos NUEVOS (los viejos no se tocan). Se puede correr más de una vez.
-- =====================================================================
alter table public.paquetes drop constraint if exists paquetes_capacidad_sana;
alter table public.paquetes add constraint paquetes_capacidad_sana
  check (capacidad_min >= 1 and capacidad_max >= capacidad_min and capacidad_max <= 50000) not valid;

alter table public.paquetes drop constraint if exists paquetes_precio_sano;
alter table public.paquetes add constraint paquetes_precio_sano check (precio >= 0 and precio <= 500000000) not valid;

alter table public.encargos drop constraint if exists encargos_asistentes_tope;
alter table public.encargos add constraint encargos_asistentes_tope
  check (asistentes_estimados is null or (asistentes_estimados >= 0 and asistentes_estimados <= 50000)) not valid;

alter table public.sedes drop constraint if exists sedes_capacidad_tope;
alter table public.sedes add constraint sedes_capacidad_tope
  check (capacidad is null or (capacidad > 0 and capacidad <= 100000)) not valid;

alter table public.solicitudes drop constraint if exists solicitudes_total_estimado_tope;
alter table public.solicitudes add constraint solicitudes_total_estimado_tope
  check (total_estimado is null or (total_estimado >= 0 and total_estimado <= 100000000000)) not valid;

notify pgrst, 'reload schema';
