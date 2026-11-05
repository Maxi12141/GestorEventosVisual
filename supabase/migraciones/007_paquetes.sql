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
