-- =====================================================================
-- 004 · IMPORTAR LO QUE YA TENÍAS (OPCIONAL, solo si venís de la versión 4 o 5)
-- Copia tus boliches/lugares → "sedes" y tus artistas → "proveedores" (servicio "Artista / DJ").
-- No copia los eventos viejos (eran de otro modelo: entradas, ganancia, etc.).
-- No borra ni modifica nada de las tablas viejas. Si no tenés esas tablas, no hace nada.
-- Se puede correr más de una vez: no duplica.
-- =====================================================================
do $$
begin
  if to_regclass('public.boliches') is not null then
    insert into public.sedes (nombre, ciudad, provincia, direccion, capacidad)
    select b.nombre, b.ciudad, to_jsonb(b)->>'provincia', b.direccion, b.capacidad
      from public.boliches b
     where not exists (select 1 from public.sedes s where lower(s.nombre) = lower(b.nombre));
    raise notice 'Sedes importadas desde boliches';
  end if;

  if to_regclass('public.artistas') is not null then
    insert into public.proveedores (nombre, servicio, notas)
    select a.nombre, 'Artista / DJ',
           nullif(concat_ws(' · ', a.genero, a.ciudad_origen), '')
      from public.artistas a
     where not exists (select 1 from public.proveedores p where lower(p.nombre) = lower(a.nombre));
    raise notice 'Proveedores importados desde artistas';
  end if;
end $$;
