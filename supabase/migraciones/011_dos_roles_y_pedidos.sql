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
