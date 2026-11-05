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
