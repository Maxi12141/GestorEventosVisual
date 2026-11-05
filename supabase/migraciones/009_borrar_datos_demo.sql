-- =====================================================================
-- 009 · BORRAR LOS DATOS DE DEMO (los que cargó 005)
-- Borra los clientes marcados "[DEMO]" y todo lo que cuelga de ellos:
-- solicitudes, propuestas, eventos, servicios, tareas, cambios, incidentes e historial.
-- NO toca nada de lo que crearon ustedes (clientes sin la marca "[DEMO]"), ni los paquetes,
-- ni los usuarios. Se puede correr más de una vez.
-- Pegalo completo en Supabase → SQL Editor → Run.
-- =====================================================================
do $$
declare n_eventos int; n_solic int; n_clientes int;
begin
  select count(*) into n_eventos  from public.encargos    where cliente_id in (select id from public.clientes where notas = '[DEMO]');
  select count(*) into n_solic    from public.solicitudes where cliente_id in (select id from public.clientes where notas = '[DEMO]');
  select count(*) into n_clientes from public.clientes    where notas = '[DEMO]';

  -- primero los eventos (las tareas, servicios, cambios, incidentes e historial se borran en cascada)
  delete from public.encargos    where cliente_id in (select id from public.clientes where notas = '[DEMO]');
  delete from public.solicitudes where cliente_id in (select id from public.clientes where notas = '[DEMO]');
  -- las sedes de ejemplo quedaban asociadas a esos clientes y ya no las usa nadie
  delete from public.sedes s where s.cliente_id in (select id from public.clientes where notas = '[DEMO]')
    and not exists (select 1 from public.encargos e where e.sede_id = s.id)
    and not exists (select 1 from public.solicitudes so where so.sede_id = s.id);
  delete from public.clientes    where notas = '[DEMO]';

  raise notice 'Borrado: % clientes demo, % solicitudes, % eventos', n_clientes, n_solic, n_eventos;
end $$;

notify pgrst, 'reload schema';
