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
