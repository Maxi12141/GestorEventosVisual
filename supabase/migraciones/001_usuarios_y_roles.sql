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
