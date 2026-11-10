-- Planes de suscripción (pedido de Eldin, 2026-11-10).
--
-- Tres planes por iglesia:
--   gratis      → 5 miembros, 50 canciones, 1 ministerio, asistente 5/día, sin Modo Músico ni plantillas.
--   ministerio  → $9.99/mes: 15 miembros, canciones ilimitadas, 3 ministerios, asistente 30/día, Modo Músico.
--   iglesia     → $29.99/mes: todo ilimitado, asistente 100/día.
--
-- Reglas:
-- - "Miembro" = persona con cuenta ACTIVA. Pantallas, TV y congregación no cuentan.
-- - Bajar de plan nunca borra nada: solo se bloquea AGREGAR por encima del límite.
-- - Iglesia nueva: 14 días de prueba del plan Iglesia; al vencer, pasa sola al Gratis.
-- - Las iglesias que ya existían quedan en plan Iglesia sin vencimiento (fundadoras).
-- - plan_vence = null → el plan no vence. Vencido → cuenta como Gratis (wf_plan_efectivo).
-- - Por ahora el super administrador cambia el plan a mano desde la consola (pagos por transferencia,
--   fundadoras, regalos). Cuando se conecte la pasarela de pagos, su webhook llamará a lo mismo.

alter table public.iglesias
  add column if not exists plan text not null default 'iglesia'
    check (plan in ('gratis', 'ministerio', 'iglesia')),
  add column if not exists plan_vence timestamptz,
  add column if not exists plan_nota text,
  add column if not exists cliente_pago_id text,
  add column if not exists en_prueba boolean not null default false;

-- Las iglesias nuevas (de aquí en adelante) arrancan con 14 días de prueba del plan Iglesia.
-- Las que ya existían se quedan con plan 'iglesia' y plan_vence null (fundadoras, sin vencimiento).
alter table public.iglesias alter column plan_vence set default (now() + interval '14 days');
alter table public.iglesias alter column en_prueba set default true;

-- Plan que de verdad aplica hoy (si venció, Gratis).
create or replace function public.wf_plan_efectivo(p_iglesia uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when i.plan_vence is not null and i.plan_vence < now() then 'gratis'
    else i.plan end
  from public.iglesias i where i.id = p_iglesia
$$;

-- Límites de cada plan (null = ilimitado).
create or replace function public.wf_limites_plan(p_plan text)
returns jsonb language sql immutable as $$
  select case coalesce(p_plan, 'gratis')
    when 'iglesia' then jsonb_build_object('miembros', null, 'canciones', null, 'ministerios', null,
      'asistente', 100, 'modo_musico', true, 'plantillas', true)
    when 'ministerio' then jsonb_build_object('miembros', 15, 'canciones', null, 'ministerios', 3,
      'asistente', 30, 'modo_musico', true, 'plantillas', true)
    else jsonb_build_object('miembros', 5, 'canciones', 50, 'ministerios', 1,
      'asistente', 5, 'modo_musico', false, 'plantillas', false)
  end
$$;

create or replace function public.wf_limite(p_iglesia uuid, p_clave text)
returns int language sql stable security definer set search_path = public as $$
  select (public.wf_limites_plan(public.wf_plan_efectivo(p_iglesia)) ->> p_clave)::int
$$;

-- ---------- Bloqueos al agregar por encima del límite ----------

create or replace function public.wf_tope_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limite int; v_usados int;
begin
  if new.iglesia_id is null or new.estado <> 'activo' then return new; end if;
  -- Al editar a alguien que ya estaba activo no se vuelve a contar.
  if tg_op = 'UPDATE' and old.estado = 'activo' and old.iglesia_id is not distinct from new.iglesia_id then
    return new;
  end if;
  v_limite := public.wf_limite(new.iglesia_id, 'miembros');
  if v_limite is null then return new; end if;
  select count(*) into v_usados from public.usuarios
    where iglesia_id = new.iglesia_id and estado = 'activo' and id <> new.id;
  if v_usados >= v_limite then
    raise exception 'Tu plan permite hasta % miembros. Mejora tu plan en Ajustes → Plan para agregar más.', v_limite
      using errcode = 'P0001', hint = 'limite_plan_miembros';
  end if;
  return new;
end $$;
drop trigger if exists tope_miembros_plan on public.usuarios;
create trigger tope_miembros_plan before insert or update of estado, iglesia_id on public.usuarios
  for each row execute function public.wf_tope_miembros();

create or replace function public.wf_tope_canciones() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limite int; v_usados int;
begin
  if new.iglesia_id is null then return new; end if;
  v_limite := public.wf_limite(new.iglesia_id, 'canciones');
  if v_limite is null then return new; end if;
  select count(*) into v_usados from public.canciones where iglesia_id = new.iglesia_id;
  if v_usados >= v_limite then
    raise exception 'Tu plan permite hasta % canciones. Mejora tu plan en Ajustes → Plan para agregar más.', v_limite
      using errcode = 'P0001', hint = 'limite_plan_canciones';
  end if;
  return new;
end $$;
drop trigger if exists tope_canciones_plan on public.canciones;
create trigger tope_canciones_plan before insert on public.canciones
  for each row execute function public.wf_tope_canciones();

create or replace function public.wf_tope_ministerios() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_limite int; v_usados int;
begin
  if new.iglesia_id is null then return new; end if;
  v_limite := public.wf_limite(new.iglesia_id, 'ministerios');
  if v_limite is null then return new; end if;
  select count(*) into v_usados from public.ministerios where iglesia_id = new.iglesia_id;
  if v_usados >= v_limite then
    raise exception 'Tu plan permite hasta % ministerio(s). Mejora tu plan en Ajustes → Plan para agregar más.', v_limite
      using errcode = 'P0001', hint = 'limite_plan_ministerios';
  end if;
  return new;
end $$;
drop trigger if exists tope_ministerios_plan on public.ministerios;
create trigger tope_ministerios_plan before insert on public.ministerios
  for each row execute function public.wf_tope_ministerios();

-- Plantillas de eventos: solo planes de pago (crear una nueva o convertir un evento en plantilla).
create or replace function public.wf_tope_plantillas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.iglesia_id is null or not coalesce(new.es_plantilla, false) then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.es_plantilla, false) then return new; end if;
  if not coalesce((public.wf_limites_plan(public.wf_plan_efectivo(new.iglesia_id)) ->> 'plantillas')::boolean, false) then
    raise exception 'Las plantillas de eventos son parte de los planes Ministerio e Iglesia. Mejora tu plan en Ajustes → Plan.'
      using errcode = 'P0001', hint = 'limite_plan_plantillas';
  end if;
  return new;
end $$;
drop trigger if exists tope_plantillas_plan on public.eventos;
create trigger tope_plantillas_plan before insert or update of es_plantilla on public.eventos
  for each row execute function public.wf_tope_plantillas();

-- ---------- Asistente: el tope diario sale del plan ----------
-- El tope de cada día es el MENOR entre el del plan y limite_asistente_diario (el de la consola), que
-- sigue sirviendo como freno de gasto por iglesia. Las iglesias nuevas arrancan con 100 en la consola
-- (así manda el plan); las que ya existían conservan lo que tenían (30 si nadie lo cambió).
alter table public.iglesias alter column limite_asistente_diario set default 100;

create or replace function public.wf_limite_asistente(p_iglesia uuid)
returns int language sql stable security definer set search_path = public as $$
  select least(public.wf_limite(i.id, 'asistente'), i.limite_asistente_diario)
  from public.iglesias i where i.id = p_iglesia
$$;

create or replace function public.reservar_mensaje_asistente(p_iglesia uuid)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_limite int := public.wf_limite_asistente(p_iglesia);
  v_fecha date := public.wf_hoy_iglesia(p_iglesia);
  v_usados int;
begin
  if v_limite is null then
    return jsonb_build_object('permitido', false, 'usados', 0, 'limite', 0);
  end if;
  insert into public.uso_asistente (iglesia_id, fecha, mensajes)
  values (p_iglesia, v_fecha, 0)
  on conflict (iglesia_id, fecha) do nothing;
  update public.uso_asistente
  set mensajes = mensajes + 1, actualizado_at = now()
  where iglesia_id = p_iglesia and fecha = v_fecha and mensajes < v_limite
  returning mensajes into v_usados;
  if v_usados is null then
    select mensajes into v_usados from public.uso_asistente where iglesia_id = p_iglesia and fecha = v_fecha;
    return jsonb_build_object('permitido', false, 'usados', v_usados, 'limite', v_limite);
  end if;
  return jsonb_build_object('permitido', true, 'usados', v_usados, 'limite', v_limite);
end $$;
revoke execute on function public.reservar_mensaje_asistente(uuid) from public, anon, authenticated;
grant execute on function public.reservar_mensaje_asistente(uuid) to service_role;

-- ---------- Lo que ve la app ----------

-- Plan de MI iglesia, con límites y uso (para Ajustes → Plan y los candados).
create or replace function public.mi_plan()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ig uuid := public.mi_iglesia_id(); v_plan text; r public.iglesias;
begin
  if v_ig is null then return null; end if;
  select * into r from public.iglesias where id = v_ig;
  v_plan := public.wf_plan_efectivo(v_ig);
  return jsonb_build_object(
    'plan', v_plan,
    'plan_contratado', r.plan,
    'vence', r.plan_vence,
    'en_prueba', r.en_prueba and r.plan_vence is not null and r.plan_vence >= now(),
    'vencido', r.plan_vence is not null and r.plan_vence < now(),
    'limites', public.wf_limites_plan(v_plan) || jsonb_build_object('asistente', public.wf_limite_asistente(v_ig)),
    'uso', jsonb_build_object(
      'miembros', (select count(*) from public.usuarios where iglesia_id = v_ig and estado = 'activo'),
      'canciones', (select count(*) from public.canciones where iglesia_id = v_ig),
      'ministerios', (select count(*) from public.ministerios where iglesia_id = v_ig)
    )
  );
end $$;
revoke execute on function public.mi_plan() from public, anon;
grant execute on function public.mi_plan() to authenticated;

-- Planes de todas las iglesias (consola del super administrador).
create or replace function public.planes_plataforma()
returns table (iglesia_id uuid, plan text, plan_efectivo text, plan_vence timestamptz, plan_nota text, en_prueba boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.soy_super_admin() then
    raise exception 'Solo el super administrador puede ver la consola.' using errcode = '42501';
  end if;
  return query select i.id, i.plan, public.wf_plan_efectivo(i.id), i.plan_vence, i.plan_nota, i.en_prueba from public.iglesias i;
end $$;
revoke execute on function public.planes_plataforma() from public, anon;
grant execute on function public.planes_plataforma() to authenticated;

-- Cambiar el plan de una iglesia a mano (transferencias, fundadoras, regalos). p_vence null = no vence.
create or replace function public.cambiar_plan_iglesia(p_iglesia uuid, p_plan text, p_vence timestamptz, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_super_admin() then
    raise exception 'Solo el super administrador puede cambiar el plan.' using errcode = '42501';
  end if;
  if p_plan not in ('gratis', 'ministerio', 'iglesia') then
    raise exception 'Plan desconocido: %', p_plan;
  end if;
  update public.iglesias set plan = p_plan, plan_vence = p_vence, en_prueba = false, plan_nota = nullif(trim(coalesce(p_nota, '')), '')
    where id = p_iglesia;
end $$;
revoke execute on function public.cambiar_plan_iglesia(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.cambiar_plan_iglesia(uuid, text, timestamptz, text) to authenticated;

-- Internas: nadie con sesión las llama directo.
revoke execute on function public.wf_plan_efectivo(uuid) from public, anon, authenticated;
revoke execute on function public.wf_limite(uuid, text) from public, anon, authenticated;
revoke execute on function public.wf_limite_asistente(uuid) from public, anon, authenticated;
grant execute on function public.wf_plan_efectivo(uuid) to service_role;
grant execute on function public.wf_limite(uuid, text) to service_role;
grant execute on function public.wf_limite_asistente(uuid) to service_role;
