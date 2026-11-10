-- Cuarto plan: Crecimiento (pedido de Eldin, 2026-11-10), entre Ministerio e Iglesia.
--   crecimiento → $19.99/mes: 50 miembros, canciones ilimitadas, 6 ministerios, asistente 60/día,
--                 Modo Músico y plantillas.
-- No toca a ninguna iglesia: solo agrega el plan como opción.

alter table public.iglesias drop constraint if exists iglesias_plan_check;
alter table public.iglesias add constraint iglesias_plan_check
  check (plan in ('gratis', 'ministerio', 'crecimiento', 'iglesia'));

create or replace function public.wf_limites_plan(p_plan text)
returns jsonb language sql immutable as $$
  select case coalesce(p_plan, 'gratis')
    when 'iglesia' then jsonb_build_object('miembros', null, 'canciones', null, 'ministerios', null,
      'asistente', 100, 'modo_musico', true, 'plantillas', true)
    when 'crecimiento' then jsonb_build_object('miembros', 50, 'canciones', null, 'ministerios', 6,
      'asistente', 60, 'modo_musico', true, 'plantillas', true)
    when 'ministerio' then jsonb_build_object('miembros', 20, 'canciones', null, 'ministerios', 3,
      'asistente', 30, 'modo_musico', true, 'plantillas', true)
    else jsonb_build_object('miembros', 5, 'canciones', 50, 'ministerios', 1,
      'asistente', 5, 'modo_musico', false, 'plantillas', false)
  end
$$;

create or replace function public.cambiar_plan_iglesia(p_iglesia uuid, p_plan text, p_vence timestamptz, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.soy_super_admin() then
    raise exception 'Solo el super administrador puede cambiar el plan.' using errcode = '42501';
  end if;
  if p_plan not in ('gratis', 'ministerio', 'crecimiento', 'iglesia') then
    raise exception 'Plan desconocido: %', p_plan;
  end if;
  update public.iglesias set plan = p_plan, plan_vence = p_vence, en_prueba = false, plan_nota = nullif(trim(coalesce(p_nota, '')), '')
    where id = p_iglesia;
end $$;
revoke execute on function public.cambiar_plan_iglesia(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.cambiar_plan_iglesia(uuid, text, timestamptz, text) to authenticated;
