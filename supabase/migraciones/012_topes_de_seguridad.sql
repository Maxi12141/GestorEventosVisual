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
