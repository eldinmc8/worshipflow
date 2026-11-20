-- Unirse a una iglesia con un enlace + aprobación del líder (pedido de Eldin, 2026-11-20).
--
-- Cada iglesia tiene un código propio (iglesias.codigo_union). El admin comparte el enlace
-- app.worshipflowapp.com/?unirse=CODIGO; quien lo abre crea su cuenta y queda en
-- solicitudes_ingreso como "pendiente". Mientras espera NO tiene fila en "usuarios", así que no ve
-- nada de la iglesia. El admin aprueba (eligiendo el rol: ahí se crea su fila en "usuarios") o rechaza.
-- Todo pasa por funciones de la base: nadie escribe en solicitudes_ingreso directo.

-- ===== 1) Cerrar un hueco: una cuenta SIN fila en "usuarios" quedaba como de la iglesia más antigua =====
-- mi_iglesia_id() caía a "la iglesia más antigua" cuando no encontraba a la persona. Eso tiene sentido
-- para la service role (Edge Functions, sin auth.uid()), pero a una sesión real sin fila en "usuarios"
-- (ej. alguien que entró con Google sin invitación, o ahora alguien esperando aprobación) le dejaba
-- leer canciones y miembros de esa iglesia. Ahora: con sesión y sin fila → ninguna iglesia.
create or replace function public.mi_iglesia_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then (select i.id from public.iglesias i order by i.created_at limit 1)
    else (select u.iglesia_id from public.usuarios u where u.id = auth.uid())
  end;
$$;

-- ===== 2) El código para unirse de cada iglesia =====
alter table public.iglesias add column if not exists codigo_union text unique;

-- ===== 3) Solicitudes =====
create table if not exists public.solicitudes_ingreso (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  usuario_id uuid not null unique references auth.users(id) on delete cascade, -- una por cuenta
  email text not null,
  nombre text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'rechazada')),
  creado_at timestamptz not null default now()
);
create index if not exists solicitudes_ingreso_iglesia on public.solicitudes_ingreso (iglesia_id);

alter table public.solicitudes_ingreso enable row level security;
revoke all on public.solicitudes_ingreso from anon;
revoke insert, update, delete on public.solicitudes_ingreso from authenticated;

create policy "veo mi propia solicitud" on public.solicitudes_ingreso
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "admins ven las solicitudes de su iglesia" on public.solicitudes_ingreso
  for select to authenticated
  using (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

-- ===== 4) Funciones =====

-- Admin de la iglesia que llama (o null si no es admin).
create or replace function public.wf_iglesia_si_soy_admin()
returns uuid language sql stable security definer set search_path = public as $$
  select u.iglesia_id from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'
$$;
revoke execute on function public.wf_iglesia_si_soy_admin() from public, anon;
grant execute on function public.wf_iglesia_si_soy_admin() to authenticated;

create or replace function public.wf_nuevo_codigo_union()
returns text language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
$$;

-- El código de mi iglesia (lo crea la primera vez). Solo admins.
create or replace function public.wf_codigo_union()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_iglesia uuid := public.wf_iglesia_si_soy_admin();
  v_codigo text;
begin
  if v_iglesia is null then raise exception 'Solo un administrador puede ver el enlace para unirse.'; end if;
  select codigo_union into v_codigo from public.iglesias where id = v_iglesia;
  if v_codigo is null then
    v_codigo := public.wf_nuevo_codigo_union();
    update public.iglesias set codigo_union = v_codigo where id = v_iglesia;
  end if;
  return v_codigo;
end $$;

-- Cambiar el código: el enlace anterior deja de funcionar. Solo admins.
create or replace function public.wf_cambiar_codigo_union()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_iglesia uuid := public.wf_iglesia_si_soy_admin();
  v_codigo text := public.wf_nuevo_codigo_union();
begin
  if v_iglesia is null then raise exception 'Solo un administrador puede cambiar el enlace para unirse.'; end if;
  update public.iglesias set codigo_union = v_codigo where id = v_iglesia;
  return v_codigo;
end $$;

-- Lo único que ve quien abre el enlace (aún sin cuenta): el nombre y el logo de la iglesia.
create or replace function public.wf_iglesia_por_codigo(p_codigo text)
returns table (nombre text, logo_url text) language sql stable security definer set search_path = public as $$
  select i.nombre, i.logo_url from public.iglesias i
  where i.codigo_union = nullif(trim(p_codigo), '') and coalesce(i.activa, true)
$$;

-- Pedir entrar (ya con sesión). Devuelve el estado de la solicitud y el nombre de la iglesia.
create or replace function public.wf_solicitar_ingreso(p_codigo text, p_nombre text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_iglesia public.iglesias%rowtype;
  v_nombre text := left(nullif(trim(coalesce(p_nombre, '')), ''), 80);
  v_estado text;
begin
  if v_uid is null then raise exception 'Necesitas iniciar sesión.'; end if;
  if exists (select 1 from public.usuarios where id = v_uid) then
    return jsonb_build_object('estado', 'miembro');
  end if;
  select * into v_iglesia from public.iglesias
    where codigo_union = nullif(trim(p_codigo), '') and coalesce(activa, true);
  if not found then return jsonb_build_object('estado', 'codigo_invalido'); end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then raise exception 'Tu cuenta no tiene correo.'; end if;
  v_nombre := coalesce(v_nombre, split_part(v_email, '@', 1));

  insert into public.solicitudes_ingreso as s (iglesia_id, usuario_id, email, nombre)
  values (v_iglesia.id, v_uid, v_email, v_nombre)
  on conflict (usuario_id) do update
    set iglesia_id = excluded.iglesia_id, nombre = excluded.nombre, estado = 'pendiente', creado_at = now()
    -- Rechazada en ESA iglesia: volver a abrir el mismo enlace no la revive.
    where s.estado = 'pendiente' or s.iglesia_id <> excluded.iglesia_id;

  select estado into v_estado from public.solicitudes_ingreso where usuario_id = v_uid;
  return jsonb_build_object('estado', v_estado, 'iglesia', v_iglesia.nombre);
end $$;

-- Mi solicitud (para la pantalla de espera).
create or replace function public.wf_mi_solicitud()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('estado', s.estado, 'iglesia', i.nombre)
  from public.solicitudes_ingreso s join public.iglesias i on i.id = s.iglesia_id
  where s.usuario_id = auth.uid()
$$;

-- Aprobar: crea su fila en "usuarios" con el rol elegido (el tope de miembros del plan lo revisa
-- la propia tabla al insertar) y borra la solicitud. p_rol_id: un rol personalizado (Roles y
-- permisos) de esta misma iglesia; con él, usuarios.rol queda en "miembro" como en el resto de la app.
create or replace function public.wf_aprobar_solicitud(p_id uuid, p_rol text, p_rol_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_iglesia uuid := public.wf_iglesia_si_soy_admin();
  v_sol public.solicitudes_ingreso%rowtype;
begin
  if v_iglesia is null then raise exception 'Solo un administrador puede aprobar solicitudes.'; end if;
  if p_rol is null or p_rol not in ('admin', 'multimedia', 'musico', 'miembro', 'supervisor') then
    raise exception 'Rol no válido.';
  end if;
  if p_rol_id is not null and not exists (select 1 from public.roles_app r where r.id = p_rol_id and r.iglesia_id = v_iglesia) then
    raise exception 'Rol no válido.';
  end if;
  select * into v_sol from public.solicitudes_ingreso where id = p_id and iglesia_id = v_iglesia;
  if not found then raise exception 'Esa solicitud ya no existe.'; end if;
  if exists (select 1 from public.usuarios where email = v_sol.email) then
    raise exception 'Ya existe un miembro con el correo %.', v_sol.email;
  end if;
  insert into public.usuarios (id, email, nombre, rol, rol_id, estado, perfil_completo, iglesia_id)
  values (v_sol.usuario_id, v_sol.email, v_sol.nombre, case when p_rol_id is null then p_rol else 'miembro' end, p_rol_id, 'activo', true, v_iglesia);
  delete from public.solicitudes_ingreso where id = p_id;
end $$;

create or replace function public.wf_rechazar_solicitud(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_iglesia uuid := public.wf_iglesia_si_soy_admin();
begin
  if v_iglesia is null then raise exception 'Solo un administrador puede rechazar solicitudes.'; end if;
  update public.solicitudes_ingreso set estado = 'rechazada' where id = p_id and iglesia_id = v_iglesia;
end $$;

revoke execute on function public.wf_nuevo_codigo_union() from public, anon, authenticated;
revoke execute on function public.wf_codigo_union() from public, anon;
revoke execute on function public.wf_cambiar_codigo_union() from public, anon;
revoke execute on function public.wf_solicitar_ingreso(text, text) from public, anon;
revoke execute on function public.wf_mi_solicitud() from public, anon;
revoke execute on function public.wf_aprobar_solicitud(uuid, text, uuid) from public, anon;
revoke execute on function public.wf_rechazar_solicitud(uuid) from public, anon;
grant execute on function public.wf_codigo_union() to authenticated;
grant execute on function public.wf_cambiar_codigo_union() to authenticated;
grant execute on function public.wf_solicitar_ingreso(text, text) to authenticated;
grant execute on function public.wf_mi_solicitud() to authenticated;
grant execute on function public.wf_aprobar_solicitud(uuid, text, uuid) to authenticated;
grant execute on function public.wf_rechazar_solicitud(uuid) to authenticated;
grant execute on function public.wf_iglesia_por_codigo(text) to anon, authenticated;
