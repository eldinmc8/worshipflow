-- Consola de iglesias con actividad (pedido de Eldin, 2026-11-05, etapa de iglesias fundadoras).
--
-- La consola general (solo super admin) muestra un perfil por iglesia con su ACTIVIDAD — cuándo entraron
-- por última vez, si están agregando canciones, usuarios o eventos próximos, cuándo transmitieron — para
-- que ninguna iglesia fundadora se quede sin usar la app sin que Eldin se entere. Solo números y fechas:
-- nunca el contenido (letras, setlists, mensajes).
--
-- 1. transmisiones: un renglón cada vez que una iglesia empieza a transmitir (lo anota un trigger en
--    sesiones_en_vivo). Antes no quedaba registro de cuándo se usó la consola en vivo.
-- 2. resumen_plataforma(): todos los números de todas las iglesias, de una sola vez.
-- 3. usuarios_iglesia_plataforma(iglesia): su equipo con el último ingreso de cada quien.
-- 4. cambiar_limite_asistente(iglesia, limite): el tope diario del asistente, desde la consola.
-- Todo exige soy_super_admin().
--
-- Y aparte (mismo SQL para correr uno solo): secciones_cancion.orden, el orden de las partes de una
-- canción que el líder elige en la pestaña Contenido del editor (antes no se guardaba).

create table if not exists public.transmisiones (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  evento_id uuid references public.eventos(id) on delete set null,
  libre boolean not null default false,
  inicio timestamptz not null default now()
);
create index if not exists transmisiones_iglesia_idx on public.transmisiones (iglesia_id, inicio desc);
alter table public.transmisiones enable row level security; -- sin políticas: solo las funciones de abajo

create or replace function public.wf_anotar_transmision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.evento_id is not null or coalesce(new.libre, false))
     and (tg_op = 'INSERT' or old.evento_id is distinct from new.evento_id or coalesce(old.libre, false) is distinct from coalesce(new.libre, false)) then
    insert into public.transmisiones (iglesia_id, evento_id, libre) values (new.iglesia_id, new.evento_id, coalesce(new.libre, false));
  end if;
  return new;
end $$;
drop trigger if exists wf_anotar_transmision on public.sesiones_en_vivo;
create trigger wf_anotar_transmision after insert or update on public.sesiones_en_vivo
  for each row execute function public.wf_anotar_transmision();

-- Números de todas las iglesias.
create or replace function public.resumen_plataforma() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v jsonb;
  v_fab text[]; -- títulos de las canciones de fábrica: esas no cuentan como "canciones nuevas" de la iglesia
begin
  if not public.soy_super_admin() then
    raise exception 'Solo el super administrador puede ver la consola.' using errcode = '42501';
  end if;
  select coalesce(array_agg(lower(trim(c.titulo))), '{}') into v_fab
    from public.canciones_de_fabrica cf join public.canciones c on c.id = cf.cancion_id;
  select coalesce(jsonb_agg(fila order by fila->>'nombre'), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', i.id, 'nombre', i.nombre, 'slug', i.slug, 'activa', i.activa, 'creada', i.created_at,
      'zona_horaria', i.zona_horaria, 'logo_url', i.logo_url, 'limite_asistente', i.limite_asistente_diario,
      'usuarios', (select count(*) from public.usuarios u where u.iglesia_id = i.id),
      'usuarios_activos', (select count(*) from public.usuarios u where u.iglesia_id = i.id and u.estado = 'activo'),
      'usuarios_nuevos_30d', (select count(*) from public.usuarios u where u.iglesia_id = i.id and u.created_at > now() - interval '30 days'),
      'ultimo_ingreso', (select max(au.last_sign_in_at) from public.usuarios u join auth.users au on au.id = u.id where u.iglesia_id = i.id),
      'nunca_entraron', (select count(*) from public.usuarios u left join auth.users au on au.id = u.id where u.iglesia_id = i.id and au.last_sign_in_at is null),
      'ingresaron_7d', (select count(*) from public.usuarios u join auth.users au on au.id = u.id where u.iglesia_id = i.id and au.last_sign_in_at > now() - interval '7 days'),
      'canciones', (select count(*) from public.canciones c where c.iglesia_id = i.id),
      'canciones_propias', (select count(*) from public.canciones c where c.iglesia_id = i.id and not lower(trim(c.titulo)) = any(v_fab)),
      'canciones_nuevas_7d', (select count(*) from public.canciones c where c.iglesia_id = i.id and not lower(trim(c.titulo)) = any(v_fab) and c.created_at > now() - interval '7 days'),
      'canciones_nuevas_30d', (select count(*) from public.canciones c where c.iglesia_id = i.id and not lower(trim(c.titulo)) = any(v_fab) and c.created_at > now() - interval '30 days'),
      'ultima_cancion', (select max(c.created_at) from public.canciones c where c.iglesia_id = i.id and not lower(trim(c.titulo)) = any(v_fab)),
      'eventos', (select count(*) from public.eventos e where e.iglesia_id = i.id and not e.es_plantilla),
      'eventos_proximos', (select count(*) from public.eventos e where e.iglesia_id = i.id and not e.es_plantilla and e.fecha >= (now() at time zone coalesce(i.zona_horaria, 'Etc/GMT+6'))::date),
      'eventos_creados_30d', (select count(*) from public.eventos e where e.iglesia_id = i.id and not e.es_plantilla and e.created_at > now() - interval '30 days'),
      'plantillas', (select count(*) from public.eventos e where e.iglesia_id = i.id and e.es_plantilla),
      'proximo_evento', (select jsonb_build_object('titulo', e.titulo, 'fecha', e.fecha, 'hora', e.hora) from public.eventos e
                         where e.iglesia_id = i.id and not e.es_plantilla and e.fecha >= (now() at time zone coalesce(i.zona_horaria, 'Etc/GMT+6'))::date
                         order by e.fecha, e.hora nulls last limit 1),
      'ultimo_evento', (select max(e.fecha) from public.eventos e where e.iglesia_id = i.id and not e.es_plantilla and e.fecha < (now() at time zone coalesce(i.zona_horaria, 'Etc/GMT+6'))::date),
      'ultimo_evento_creado', (select max(e.created_at) from public.eventos e where e.iglesia_id = i.id and not e.es_plantilla),
      'ministerios', (select count(*) from public.ministerios m where m.iglesia_id = i.id),
      'ultima_transmision', greatest(
        (select max(t.inicio) from public.transmisiones t where t.iglesia_id = i.id),
        (select s.updated_at from public.sesiones_en_vivo s where s.iglesia_id = i.id and (s.evento_id is not null or s.libre))),
      'transmisiones_30d', (select count(*) from public.transmisiones t where t.iglesia_id = i.id and t.inicio > now() - interval '30 days'),
      'en_vivo_ahora', exists (select 1 from public.sesiones_en_vivo s where s.iglesia_id = i.id and (s.evento_id is not null or s.libre)),
      'bosquejos_30d', (select count(*) from public.bosquejos b where b.iglesia_id = i.id and b.enviado_at > now() - interval '30 days'),
      'asistente_30d', (select coalesce(sum(ua.mensajes), 0) from public.uso_asistente ua where ua.iglesia_id = i.id and ua.fecha > current_date - 30)
    ) as fila
    from public.iglesias i
  ) x;
  return v;
end $$;
revoke execute on function public.resumen_plataforma() from public, anon;
grant execute on function public.resumen_plataforma() to authenticated;

-- El equipo de una iglesia con su último ingreso (para soporte: reiniciar contraseñas, ver quién no ha entrado).
create or replace function public.usuarios_iglesia_plataforma(p_iglesia uuid)
returns table (id uuid, nombre text, email text, rol text, estado text, creado timestamptz, ultimo_ingreso timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.soy_super_admin() then
    raise exception 'Solo el super administrador puede ver la consola.' using errcode = '42501';
  end if;
  return query
    select u.id, u.nombre, u.email, u.rol, u.estado, u.created_at, au.last_sign_in_at
    from public.usuarios u left join auth.users au on au.id = u.id
    where u.iglesia_id = p_iglesia
    order by au.last_sign_in_at desc nulls last, u.nombre;
end $$;
revoke execute on function public.usuarios_iglesia_plataforma(uuid) from public, anon;
grant execute on function public.usuarios_iglesia_plataforma(uuid) to authenticated;

-- Tope diario del asistente de una iglesia (ver 20261106000000_tope_asistente.sql).
create or replace function public.cambiar_limite_asistente(p_iglesia uuid, p_limite integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_super_admin() then
    raise exception 'Solo el super administrador puede cambiar el tope.' using errcode = '42501';
  end if;
  if p_limite is null or p_limite < 0 or p_limite > 1000 then
    raise exception 'El tope debe estar entre 0 y 1000 mensajes por día.';
  end if;
  update public.iglesias set limite_asistente_diario = p_limite where id = p_iglesia;
end $$;
revoke execute on function public.cambiar_limite_asistente(uuid, integer) from public, anon;
grant execute on function public.cambiar_limite_asistente(uuid, integer) to authenticated;

-- Orden de las partes de la canción en Contenido (sin valor = como antes: el orden de la Estructura).
alter table public.secciones_cancion add column if not exists orden integer;
