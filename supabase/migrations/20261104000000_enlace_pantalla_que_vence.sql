-- Enlace de las pantallas que vence solo después de cada culto (pedido de Eldin, 2026-11-02).
--
-- Antes, la proyección (/p/<iglesia>) y la pantalla de escenario (/e/<iglesia>) se podían ver con solo
-- saber el nombre corto de la iglesia, y la base dejaba leer lo que está al aire a cualquiera sin sesión
-- (política "cualquiera lee la sesión en vivo"). Ahora:
--
-- 1. Cada iglesia tiene un código secreto (codigos_pantalla) que va dentro del enlace y del QR:
--    /p/<iglesia>/<código> y /e/<iglesia>/<código>.
-- 2. Las pantallas sin sesión leen lo que está al aire SOLO con el código vigente
--    (sesion_en_vivo_publica). Se cierra la lectura directa de sesiones_en_vivo sin sesión.
-- 3. Cuando Multimedia FINALIZA la transmisión, el código cambia solo (trigger). El enlace que se
--    compartió en ese culto deja de servir; el próximo culto tiene enlace y QR nuevos.
--    También se puede renovar a mano (renovar_codigo_pantalla) quien controla En vivo.
--
-- Las pantallas en vivo reciben los cambios por un canal de Realtime cuyo nombre lleva el código
-- (lo manda la consola): sin el código vigente no se sabe a qué canal escuchar.
-- La pantalla abierta por la consola en la MISMA computadora (canal local del navegador) no depende de esto.

create table if not exists public.codigos_pantalla (
  iglesia_id uuid primary key references public.iglesias(id) on delete cascade,
  codigo text not null,
  actualizado_at timestamptz not null default now()
);
-- Solo se usa por las funciones de abajo: RLS encendido y sin políticas.
alter table public.codigos_pantalla enable row level security;

-- 12 caracteres al azar (gen_random_uuid usa el generador seguro de Postgres).
create or replace function public.wf_codigo_nuevo() returns text
language sql volatile set search_path = public as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
$$;

-- Código vigente de MI iglesia (lo crea la primera vez). Para mostrar el enlace y el QR en la app.
create or replace function public.codigo_pantalla_actual() returns text
language plpgsql security definer set search_path = public as $$
declare ig uuid := public.mi_iglesia_id(); v text;
begin
  if ig is null then return null; end if;
  select codigo into v from public.codigos_pantalla where iglesia_id = ig;
  if v is null then
    insert into public.codigos_pantalla (iglesia_id, codigo) values (ig, public.wf_codigo_nuevo())
    on conflict (iglesia_id) do nothing;
    select codigo into v from public.codigos_pantalla where iglesia_id = ig;
  end if;
  return v;
end $$;

-- Renovar a mano (quien controla En vivo: Administrador, Multimedia o rol con permisos de En vivo).
create or replace function public.renovar_codigo_pantalla() returns text
language plpgsql security definer set search_path = public as $$
declare ig uuid := public.mi_iglesia_id(); v text := public.wf_codigo_nuevo();
begin
  if ig is null or not public.wf_controlo_vivo() then
    raise exception 'No tienes permiso para renovar el enlace de las pantallas' using errcode = '42501';
  end if;
  insert into public.codigos_pantalla (iglesia_id, codigo, actualizado_at) values (ig, v, now())
  on conflict (iglesia_id) do update set codigo = excluded.codigo, actualizado_at = now();
  return v;
end $$;

-- Lo que está al aire para una pantalla sin sesión: solo con el código vigente. null = código vencido.
create or replace function public.sesion_en_vivo_publica(p_iglesia uuid, p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when p_codigo is not null and exists (select 1 from public.codigos_pantalla c where c.iglesia_id = p_iglesia and c.codigo = p_codigo)
      then coalesce((select to_jsonb(s) from public.sesiones_en_vivo s where s.iglesia_id = p_iglesia), jsonb_build_object('iglesia_id', p_iglesia))
    else null
  end
$$;

revoke execute on function public.wf_codigo_nuevo() from public, anon, authenticated;
revoke execute on function public.codigo_pantalla_actual() from public, anon;
grant execute on function public.codigo_pantalla_actual() to authenticated;
revoke execute on function public.renovar_codigo_pantalla() from public, anon;
grant execute on function public.renovar_codigo_pantalla() to authenticated;
grant execute on function public.sesion_en_vivo_publica(uuid, text) to anon, authenticated;

-- Al finalizar la transmisión (había algo en vivo y ya no), el código cambia solo.
create or replace function public.wf_renovar_codigo_al_terminar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.evento_id is not null or coalesce(old.libre, false))
     and new.evento_id is null and not coalesce(new.libre, false) then
    update public.codigos_pantalla set codigo = public.wf_codigo_nuevo(), actualizado_at = now()
    where iglesia_id = new.iglesia_id;
  end if;
  return new;
end $$;
drop trigger if exists wf_renovar_codigo_al_terminar on public.sesiones_en_vivo;
create trigger wf_renovar_codigo_al_terminar after update on public.sesiones_en_vivo
  for each row execute function public.wf_renovar_codigo_al_terminar();

-- Se cierra la lectura directa sin sesión: cada iglesia lee solo la suya (y la Consola general, todas).
drop policy if exists "cualquiera lee la sesión en vivo" on public.sesiones_en_vivo;
drop policy if exists "la iglesia lee su sesión en vivo" on public.sesiones_en_vivo;
create policy "la iglesia lee su sesión en vivo" on public.sesiones_en_vivo for select to authenticated
  using (public.soy_super_admin() or iglesia_id = public.mi_iglesia_id());
