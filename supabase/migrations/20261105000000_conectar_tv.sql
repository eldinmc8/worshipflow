-- "Conectar TV" con un número de 6 dígitos (pedido de Eldin, 2026-11-02), como YouTube en los televisores.
--
-- En un Smart TV o caja (Claro, Android TV) escribir con el control un enlace largo con código es muy
-- tedioso, y como el enlace vence en cada culto habría que hacerlo cada semana. Ahora:
-- 1. El TV abre una dirección corta y fija: /tv (se guarda en favoritos una sola vez).
-- 2. El TV pide un número de 6 dígitos (tv_pedir_codigo) con un token secreto propio y lo muestra grande.
-- 3. Multimedia escribe ese número en la app (Ajustes → Pantallas y TV): tv_vincular lo une a su iglesia
--    y elige si será la proyección o la pantalla de escenario.
-- 4. El TV, que pregunta cada pocos segundos (tv_estado), recibe la dirección con el código vigente de
--    la iglesia y la abre. Cuando ese código vence (al finalizar la transmisión), el TV vuelve solo a /tv
--    con un número nuevo para el próximo culto.
-- Requiere 20261104000000_enlace_pantalla_que_vence.sql (codigos_pantalla) y la de permisos (wf_controlo_vivo).

create table if not exists public.tvs_por_vincular (
  token text primary key,                     -- secreto que solo conoce el TV
  codigo text not null,                       -- el número de 6 dígitos que se muestra en pantalla
  creado_at timestamptz not null default now(),
  iglesia_id uuid references public.iglesias(id) on delete cascade,
  tipo text check (tipo in ('proyeccion', 'escenario')),
  vinculado_at timestamptz
);
create unique index if not exists tvs_por_vincular_codigo_idx on public.tvs_por_vincular (codigo);
-- Solo se usa por las funciones de abajo: RLS encendido y sin políticas.
alter table public.tvs_por_vincular enable row level security;

-- El TV pide su número (sin sesión). Si ya tiene uno vigente, lo devuelve igual.
create or replace function public.tv_pedir_codigo(p_token text)
returns text language plpgsql security definer
set search_path = public as $$
declare
  v text;
  intentos int := 0;
begin
  if p_token is null or length(p_token) < 24 then
    raise exception 'Token inválido' using errcode = '22023';
  end if;
  -- Limpieza: números sin usar de más de 15 minutos.
  delete from public.tvs_por_vincular
  where vinculado_at is null and creado_at < now() - interval '15 minutes';
  select codigo into v from public.tvs_por_vincular
  where token = p_token and vinculado_at is null;
  if v is not null then return v; end if;
  loop
    intentos := intentos + 1;
    v := lpad(floor(random() * 1000000)::int::text, 6, '0');
    begin
      insert into public.tvs_por_vincular (token, codigo) values (p_token, v)
      on conflict (token) do update
        set codigo = excluded.codigo, creado_at = now(),
            iglesia_id = null, tipo = null, vinculado_at = null;
      return v;
    exception when unique_violation then
      if intentos > 20 then raise; end if;
    end;
  end loop;
end $$;

-- El TV pregunta (sin sesión): pendiente (sigue mostrando el número), nuevo (pedir otro número) o
-- vinculado (abrir la pantalla). Al entregar "vinculado", la fila se borra: es de un solo uso.
create or replace function public.tv_estado(p_token text)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  r public.tvs_por_vincular%rowtype;
  v_slug text;
  v_codigo text;
begin
  select * into r from public.tvs_por_vincular where token = p_token;
  if not found then return jsonb_build_object('estado', 'nuevo'); end if;
  if r.vinculado_at is null then
    if r.creado_at < now() - interval '15 minutes' then
      delete from public.tvs_por_vincular where token = p_token;
      return jsonb_build_object('estado', 'nuevo');
    end if;
    return jsonb_build_object('estado', 'pendiente', 'codigo', r.codigo);
  end if;
  select slug into v_slug from public.iglesias where id = r.iglesia_id;
  insert into public.codigos_pantalla (iglesia_id, codigo)
  values (r.iglesia_id, public.wf_codigo_nuevo())
  on conflict (iglesia_id) do nothing;
  select codigo into v_codigo from public.codigos_pantalla where iglesia_id = r.iglesia_id;
  delete from public.tvs_por_vincular where token = p_token;
  return jsonb_build_object('estado', 'vinculado', 'tipo', r.tipo, 'slug', v_slug,
    'iglesia_id', r.iglesia_id, 'codigo', v_codigo);
end $$;

-- Multimedia (o quien controla En vivo) escribe el número en la app.
create or replace function public.tv_vincular(p_codigo text, p_tipo text)
returns boolean language plpgsql security definer
set search_path = public as $$
declare ig uuid := public.mi_iglesia_id();
begin
  if ig is null or not public.wf_controlo_vivo() then
    raise exception 'No tienes permiso para conectar pantallas' using errcode = '42501';
  end if;
  if p_tipo not in ('proyeccion', 'escenario') then
    raise exception 'Tipo de pantalla inválido' using errcode = '22023';
  end if;
  update public.tvs_por_vincular
  set iglesia_id = ig, tipo = p_tipo, vinculado_at = now()
  where codigo = trim(p_codigo) and vinculado_at is null
    and creado_at > now() - interval '15 minutes';
  if not found then
    raise exception 'Ese número no existe o ya venció' using errcode = 'P0002';
  end if;
  return true;
end $$;

revoke execute on function public.tv_pedir_codigo(text) from public;
grant execute on function public.tv_pedir_codigo(text) to anon, authenticated;
revoke execute on function public.tv_estado(text) from public;
grant execute on function public.tv_estado(text) to anon, authenticated;
revoke execute on function public.tv_vincular(text, text) from public, anon;
grant execute on function public.tv_vincular(text, text) to authenticated;
