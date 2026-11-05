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
