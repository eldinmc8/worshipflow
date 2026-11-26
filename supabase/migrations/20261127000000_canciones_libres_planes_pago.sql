-- Canciones libres en los planes de pago (Eldin, 2026-11-26).
--   gratis 20 canciones · ministerio, crecimiento e iglesia: ilimitadas (antes 75 / 200 / ilimitadas).
-- Miembros, ministerios y lo demás no cambian. No se borra nada.
create or replace function public.wf_limites_plan(p_plan text)
returns jsonb language sql immutable as $$
  select case coalesce(p_plan, 'gratis')
    when 'iglesia' then jsonb_build_object('miembros', null, 'canciones', null, 'ministerios', null,
      'asistente', 100, 'modo_musico', true, 'plantillas', true)
    when 'crecimiento' then jsonb_build_object('miembros', 50, 'canciones', null, 'ministerios', 6,
      'asistente', 60, 'modo_musico', true, 'plantillas', true)
    when 'ministerio' then jsonb_build_object('miembros', 20, 'canciones', null, 'ministerios', 3,
      'asistente', 30, 'modo_musico', true, 'plantillas', true)
    else jsonb_build_object('miembros', 5, 'canciones', 20, 'ministerios', 1,
      'asistente', 5, 'modo_musico', false, 'plantillas', false)
  end
$$;

-- La pantalla de escenario (/e/…) y la salida para OBS (/t/…) se abren SIN sesión y desde el plan
-- Ministerio. Esta función solo dice si esa iglesia está en el plan Gratis (nada más se revela).
create or replace function public.pantallas_extra_permitidas(p_iglesia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.wf_plan_efectivo(p_iglesia), 'gratis') <> 'gratis'
$$;
revoke execute on function public.pantallas_extra_permitidas(uuid) from public;
grant execute on function public.pantallas_extra_permitidas(uuid) to anon, authenticated;
