-- =====================================================================
-- 005 · DATOS DE DEMO (OPCIONAL)
-- Carga clientes, sedes, proveedores y eventos de ejemplo en todos los estados, para ver
-- el panel con datos reales de trabajo: solicitudes, propuestas sin respuesta, servicios sin
-- confirmar, tareas vencidas, un evento para cerrar, uno realizado y uno cancelado.
-- Los clientes demo llevan la nota "[DEMO]". Para borrar todo lo de demo, corré el bloque
-- de limpieza que está al final de este archivo.
-- =====================================================================
do $$
declare
  u   uuid := (select id from public.perfiles order by created_at limit 1);
  hoy date := public.hoy_ar();
  c1 bigint; c2 bigint; c3 bigint; c4 bigint;
  s1 bigint; s2 bigint; s3 bigint; s4 bigint;
  p_dj1 bigint; p_dj2 bigint; p_son bigint; p_luz bigint; p_bar bigint; p_ban bigint; p_seg bigint; p_vis bigint;
  v_sol bigint; v_pro bigint; v_enc bigint;
begin
  if exists (select 1 from public.clientes where notas = '[DEMO]') then
    raise notice 'Los datos de demo ya estaban cargados';
    return;
  end if;

  -- clientes (dueños de boliches)
  insert into public.clientes (nombre, boliche, telefono, email, notas) values ('Roberto Sosa', 'La Cueva', '351 555-0101', 'roberto@lacueva.example', '[DEMO]') returning id into c1;
  insert into public.clientes (nombre, boliche, telefono, email, notas) values ('Mariana Quiroga', 'Club Fénix', '351 555-0144', 'mariana@clubfenix.example', '[DEMO]') returning id into c2;
  insert into public.clientes (nombre, boliche, telefono, email, notas) values ('Gustavo Ledesma', 'Madera Club', '11 5555-0177', null, '[DEMO]') returning id into c3;
  insert into public.clientes (nombre, boliche, telefono, email, notas) values ('Lucía Benítez', 'Costa Disco', '223 555-0190', 'lucia@costadisco.example', '[DEMO]') returning id into c4;

  -- sedes (si ya existen por nombre se reutilizan)
  insert into public.sedes (nombre, ciudad, provincia, direccion, capacidad, cliente_id)
  select * from (values
    ('La Cueva',    'Córdoba',       'Córdoba',      'Obispo Trejo 450',          500, c1),
    ('Club Fénix',  'Córdoba',       'Córdoba',      'Av. Colón 1200',            900, c2),
    ('Madera Club', 'Buenos Aires',  'CABA',         'Av. Cabildo 3300',         1000, c3),
    ('Costa Disco', 'Mar del Plata', 'Buenos Aires', 'Av. Martínez de Hoz 1200', 1200, c4)
  ) v(nombre, ciudad, provincia, direccion, capacidad, cliente_id)
  where not exists (select 1 from public.sedes s where lower(s.nombre) = lower(v.nombre));
  select id into s1 from public.sedes where lower(nombre) = 'la cueva' limit 1;
  select id into s2 from public.sedes where lower(nombre) = 'club fénix' limit 1;
  select id into s3 from public.sedes where lower(nombre) = 'madera club' limit 1;
  select id into s4 from public.sedes where lower(nombre) = 'costa disco' limit 1;

  -- proveedores
  insert into public.proveedores (nombre, servicio, contacto, telefono) select * from (values
    ('DJ Nico Ferreyra',        'DJ',                 'Nico',  '351 555-0201'),
    ('DJ Maca Torres',          'DJ',                 'Maca',  '351 555-0202'),
    ('Sonido Pro Córdoba',      'Sonido',             'Hernán','351 555-0203'),
    ('LuzNoche Iluminación',    'Iluminación',        'Sergio','351 555-0204'),
    ('Barra Móvil Don Pepe',    'Barra',              'Pepe',  '351 555-0205'),
    ('Los del Sur (banda)',     'Artista en vivo',    'Fede',  '351 555-0206'),
    ('Seguridad Escudo',        'Seguridad',          'Marcos','351 555-0207'),
    ('Visuales 360',            'Pantallas y visuales','Cami', '351 555-0208')
  ) v(nombre, servicio, contacto, telefono)
  where not exists (select 1 from public.proveedores p where lower(p.nombre) = lower(v.nombre));
  select id into p_dj1 from public.proveedores where nombre = 'DJ Nico Ferreyra' limit 1;
  select id into p_dj2 from public.proveedores where nombre = 'DJ Maca Torres' limit 1;
  select id into p_son from public.proveedores where nombre = 'Sonido Pro Córdoba' limit 1;
  select id into p_luz from public.proveedores where nombre = 'LuzNoche Iluminación' limit 1;
  select id into p_bar from public.proveedores where nombre = 'Barra Móvil Don Pepe' limit 1;
  select id into p_ban from public.proveedores where nombre = 'Los del Sur (banda)' limit 1;
  select id into p_seg from public.proveedores where nombre = 'Seguridad Escudo' limit 1;
  select id into p_vis from public.proveedores where nombre = 'Visuales 360' limit 1;

  -- S1: propuesta presentada hace 6 días, sin respuesta
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, asistentes_estimados, necesidades, medio_contacto, estado, created_by)
  values (c1, 'Fiesta de Halloween', 'Fiesta temática', hoy + 25, s1, 450, 'DJ, sonido, iluminación y barra. Ambientación de terror.', 'WhatsApp', 'lista_para_propuesta', u) returning id into v_sol;
  v_pro := public.guardar_propuesta(v_sol, null, format('{"condiciones":"50%% de anticipo al aceptar. Importes de iluminación a confirmar.","servicios":[
     {"servicio":"DJ","importe":450000,"importe_confirmado":true,"proveedor_id":%s},
     {"servicio":"Sonido","importe":700000,"importe_confirmado":true,"proveedor_id":%s},
     {"servicio":"Iluminación","importe":380000,"importe_confirmado":false,"proveedor_id":%s},
     {"servicio":"Barra","importe":260000,"importe_confirmado":false,"proveedor_id":%s}]}', p_dj1, p_son, p_luz, p_bar)::jsonb, u, 'Demo');
  update public.propuestas set fecha_presentacion = hoy - 6 where id = v_pro;

  -- S2: falta información
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, necesidades, medio_contacto, estado, created_by)
  values (c2, 'Presentación de banda local', 'Presentación musical', hoy + 40, 'Quiere banda en vivo. Falta confirmar cantidad de asistentes y sede.', 'Teléfono', 'pendiente_informacion', u);

  -- S3: recién llegada, en evaluación
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, necesidades, medio_contacto, estado, created_by)
  values (c3, 'Fiesta de egresados', 'Fiesta privada', 'Todavía no definió fecha. Pregunta por DJ y pantallas.', 'WhatsApp', 'en_evaluacion', u);

  -- S4: lista para armar propuesta
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, asistentes_estimados, necesidades, medio_contacto, estado, created_by)
  values (c4, 'Noche retro años 90', 'Fiesta temática', hoy + 50, s4, 800, 'DJ de música de los 90, visuales y barra.', 'Presencial', 'lista_para_propuesta', u);

  -- S5: propuesta rechazada → solicitud que ya no avanza
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, medio_contacto, estado, created_by)
  values (c2, 'Aniversario del boliche', 'Fiesta temática', hoy + 20, s2, 'WhatsApp', 'lista_para_propuesta', u) returning id into v_sol;
  v_pro := public.guardar_propuesta(v_sol, null, format('{"servicios":[{"servicio":"DJ","importe":500000,"importe_confirmado":true,"proveedor_id":%s},{"servicio":"Sonido","importe":900000,"importe_confirmado":true}]}', p_dj2)::jsonb, u, 'Demo');
  update public.propuestas set estado = 'rechazada', fecha_respuesta = hoy - 4, medio_respuesta = 'WhatsApp', observacion_respuesta = 'Dijo que el total era más de lo que esperaba', respondida_por = u where id = v_pro;
  update public.solicitudes set estado = 'descartada', motivo_descarte = 'El cliente consideró alto el importe y decidió hacerlo con su propio equipo' where id = v_sol;

  -- S6: evento aceptado, en preparación (con pendientes reales)
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, asistentes_estimados, necesidades, medio_contacto, estado, created_by)
  values (c1, 'Fiesta de primavera', 'Fiesta temática', hoy + 18, s1, 400, 'DJ, sonido, iluminación y barra', 'WhatsApp', 'lista_para_propuesta', u) returning id into v_sol;
  v_pro := public.guardar_propuesta(v_sol, null, format('{"condiciones":"50%% de anticipo. Saldo el día del evento.","servicios":[
     {"servicio":"DJ","importe":420000,"importe_confirmado":true,"proveedor_id":%s},
     {"servicio":"Sonido","importe":650000,"importe_confirmado":true,"proveedor_id":%s},
     {"servicio":"Iluminación","importe":350000,"importe_confirmado":true,"proveedor_id":%s},
     {"servicio":"Barra","importe":240000,"importe_confirmado":true,"proveedor_id":%s}]}', p_dj1, p_son, p_luz, p_bar)::jsonb, u, 'Demo');
  v_enc := public.aceptar_propuesta(v_pro, format('{"fecha":"%s","sede_id":%s,"medio_aceptacion":"WhatsApp","hora_inicio":"23:30","hora_fin":"05:30"}', hoy + 18, s1)::jsonb, u, 'Demo');
  update public.encargos set estado = 'en_preparacion', responsable_evento_id = u where id = v_enc;
  update public.encargo_servicios set participacion = 'confirmada', importe_proveedor = 330000, participacion_actualizada_por = u, participacion_actualizada_en = now()
   where encargo_id = v_enc and servicio = 'DJ';
  update public.encargo_servicios set participacion = 'disponibilidad_informada', participacion_nota = 'Dijo que está libre, falta que confirme el importe', importe_proveedor = 500000
   where encargo_id = v_enc and servicio = 'Sonido';
  update public.encargo_servicios set participacion = 'confirmada', importe_proveedor = 180000 where encargo_id = v_enc and servicio = 'Barra';
  insert into public.tareas (encargo_id, titulo, descripcion, responsable_id, fecha_prevista, estado, created_by) values
    (v_enc, 'Confirmar importe de sonido', 'Hernán dijo que estaba libre pero no confirmó el importe', u, hoy - 2, 'pendiente', u),
    (v_enc, 'Conseguir y confirmar iluminación', null, u, hoy + 5, 'en_curso', u),
    (v_enc, 'Pedir ploteo de la barra', null, u, hoy + 8, 'pendiente', u),
    (v_enc, 'Enviar propuesta aceptada a los proveedores', null, u, hoy - 10, 'completada', u);
  perform public.registrar_cambio(v_enc, format('{"campo":"fecha","descripcion":"Roberto pide pasar la fiesta una semana más tarde","requiere_conformidad":true,"conformidad":"pendiente","payload":{"fecha":"%s"}}', hoy + 25)::jsonb, u, 'Demo');

  -- S7: "festival" de una fecha, recién confirmado
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, asistentes_estimados, necesidades, medio_contacto, estado, created_by)
  values (c4, 'Festival Rock en el Lago', 'Festival', hoy + 60, s4, 1100, 'Dos bandas en vivo, sonido de escenario, iluminación, pantallas y seguridad', 'Presencial', 'lista_para_propuesta', u) returning id into v_sol;
  v_pro := public.guardar_propuesta(v_sol, null, format('{"condiciones":"Anticipo del 40%%.","servicios":[
     {"servicio":"Artista en vivo","importe":1200000,"importe_confirmado":true,"proveedor_id":%s},
     {"servicio":"Sonido","importe":1500000,"importe_confirmado":false,"proveedor_id":%s},
     {"servicio":"Pantallas y visuales","importe":600000,"importe_confirmado":false,"proveedor_id":%s},
     {"servicio":"Seguridad","importe":450000,"importe_confirmado":true,"proveedor_id":%s}]}', p_ban, p_son, p_vis, p_seg)::jsonb, u, 'Demo');
  v_enc := public.aceptar_propuesta(v_pro, format('{"fecha":"%s","sede_id":%s,"medio_aceptacion":"Presencial","hora_inicio":"18:00","hora_fin":"01:00"}', hoy + 60, s4)::jsonb, u, 'Demo');

  -- S8: evento que ya pasó y todavía no se cerró (aparece en "para cerrar")
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, medio_contacto, estado, created_by)
  values (c3, 'Noche de disfraces', 'Fiesta temática', hoy - 3, s3, 'WhatsApp', 'convertida', u) returning id into v_sol;
  insert into public.propuestas (solicitud_id, estado, fecha_presentacion, fecha_respuesta, medio_respuesta, respondida_por, created_by)
  values (v_sol, 'aceptada', hoy - 30, hoy - 25, 'WhatsApp', u, u) returning id into v_pro;
  insert into public.propuesta_servicios (propuesta_id, servicio, importe, importe_confirmado, proveedor_id, orden) values (v_pro, 'DJ', 400000, true, p_dj2, 1), (v_pro, 'Sonido', 600000, true, p_son, 2);
  insert into public.encargos (solicitud_id, propuesta_id, cliente_id, nombre, tipo_evento, fecha, sede_id, estado, fecha_aceptacion, medio_aceptacion, responsable_id, aceptacion_registrada_por)
  values (v_sol, v_pro, c3, 'Noche de disfraces', 'Fiesta temática', hoy - 3, s3, 'en_preparacion', hoy - 25, 'WhatsApp', u, u) returning id into v_enc;
  insert into public.encargo_servicios (encargo_id, servicio, importe, importe_confirmado, proveedor_id, participacion, orden) values (v_enc, 'DJ', 400000, true, p_dj2, 'confirmada', 1), (v_enc, 'Sonido', 600000, true, p_son, 'confirmada', 2);
  insert into public.incidentes (encargo_id, ocurrido_en, descripcion, consecuencias, medida_tomada, pendiente, registrado_por)
  values (v_enc, (hoy - 3)::timestamp + time '01:15', 'El DJ llegó 40 minutos tarde', 'La pista arrancó más tarde de lo previsto', 'Se puso música de playlist hasta que llegó', 'Hablar con el DJ por el retraso', u);
  perform public.log_hist(v_sol, v_enc, 'propuesta_aceptada', 'El cliente aceptó la propuesta (WhatsApp)', null, (hoy - 3)::text, u, 'Demo');

  -- S9: evento realizado y cerrado, con observaciones
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, medio_contacto, estado, created_by)
  values (c1, 'Noche de reggae', 'Presentación musical', hoy - 20, s1, 'Teléfono', 'convertida', u) returning id into v_sol;
  insert into public.propuestas (solicitud_id, estado, fecha_presentacion, fecha_respuesta, respondida_por, created_by)
  values (v_sol, 'aceptada', hoy - 50, hoy - 45, u, u) returning id into v_pro;
  insert into public.propuesta_servicios (propuesta_id, servicio, importe, importe_confirmado, proveedor_id, orden) values (v_pro, 'Artista en vivo', 900000, true, p_ban, 1), (v_pro, 'Sonido', 600000, true, p_son, 2);
  insert into public.encargos (solicitud_id, propuesta_id, cliente_id, nombre, tipo_evento, fecha, sede_id, estado, fecha_aceptacion, responsable_id, aceptacion_registrada_por, cierre_registrado_en, cierre_registrado_por, observaciones_cierre)
  values (v_sol, v_pro, c1, 'Noche de reggae', 'Presentación musical', hoy - 20, s1, 'realizado', hoy - 45, u, u, now() - interval '19 days', u, 'Se realizó sin problemas. Buena convocatoria.') returning id into v_enc;
  insert into public.encargo_servicios (encargo_id, servicio, importe, importe_confirmado, proveedor_id, participacion, orden) values (v_enc, 'Artista en vivo', 900000, true, p_ban, 'confirmada', 1), (v_enc, 'Sonido', 600000, true, p_son, 'confirmada', 2);
  insert into public.observaciones (encargo_id, proveedor_id, texto, registrado_por)
  values (v_enc, p_son, 'Sonido Pro necesitó más tiempo de armado del previsto: pedirles llegar 2 horas antes la próxima vez', u);

  -- S10: evento confirmado que después se canceló
  insert into public.solicitudes (cliente_id, titulo, tipo_evento, fecha_prevista, sede_id, medio_contacto, estado, created_by)
  values (c2, 'Fiesta de fin de año anticipada', 'Fiesta privada', hoy + 12, s2, 'WhatsApp', 'convertida', u) returning id into v_sol;
  insert into public.propuestas (solicitud_id, estado, fecha_presentacion, fecha_respuesta, respondida_por, created_by)
  values (v_sol, 'aceptada', hoy - 15, hoy - 10, u, u) returning id into v_pro;
  insert into public.propuesta_servicios (propuesta_id, servicio, importe, importe_confirmado, proveedor_id, orden) values (v_pro, 'DJ', 450000, true, p_dj1, 1), (v_pro, 'Iluminación', 350000, true, p_luz, 2);
  insert into public.encargos (solicitud_id, propuesta_id, cliente_id, nombre, tipo_evento, fecha, sede_id, estado, fecha_aceptacion, responsable_id, aceptacion_registrada_por,
                               cierre_registrado_en, cierre_registrado_por, causa_cancelacion, motivo_cancelacion, cancelacion_comunicada)
  values (v_sol, v_pro, c2, 'Fiesta de fin de año anticipada', 'Fiesta privada', hoy + 12, s2, 'cancelado', hoy - 10, u, u,
          now() - interval '2 days', u, 'Solicitada por el cliente', 'El cliente decidió postergar la fiesta para el año próximo', true) returning id into v_enc;
  insert into public.encargo_servicios (encargo_id, servicio, importe, importe_confirmado, proveedor_id, participacion, aviso_cancelacion, orden)
  values (v_enc, 'DJ', 450000, true, p_dj1, 'confirmada', 'pendiente', 1), (v_enc, 'Iluminación', 350000, true, p_luz, 'confirmada', 'avisado', 2);
  perform public.log_hist(v_sol, v_enc, 'evento_cancelado', 'El cliente decidió postergar la fiesta para el año próximo', 'en_preparacion', 'cancelado', u, 'Demo');
end $$;

-- ---------------------------------------------------------------------
-- LIMPIEZA: para borrar los datos de demo, seleccioná y corré SOLO estas 3 líneas
-- (sin los guiones del principio):
--
-- delete from public.encargos    where cliente_id in (select id from public.clientes where notas = '[DEMO]');
-- delete from public.solicitudes where cliente_id in (select id from public.clientes where notas = '[DEMO]');
-- delete from public.clientes    where notas = '[DEMO]';
-- ---------------------------------------------------------------------
