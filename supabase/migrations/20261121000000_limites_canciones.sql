-- Límite de canciones por plan (pedido de Eldin, 2026-11-13):
--   gratis 20 · ministerio 75 · crecimiento 200 · iglesia ilimitadas (antes: gratis 50, los demás ilimitadas).
-- No se borra nada: una iglesia con más canciones que su límite las conserva y las usa; el trigger
-- tope_canciones_plan solo impide AGREGAR nuevas hasta que mejore el plan.
create or replace function public.wf_limites_plan(p_plan text)
returns jsonb language sql immutable as $$
  select case coalesce(p_plan, 'gratis')
    when 'iglesia' then jsonb_build_object('miembros', null, 'canciones', null, 'ministerios', null,
      'asistente', 100, 'modo_musico', true, 'plantillas', true)
    when 'crecimiento' then jsonb_build_object('miembros', 50, 'canciones', 200, 'ministerios', 6,
      'asistente', 60, 'modo_musico', true, 'plantillas', true)
    when 'ministerio' then jsonb_build_object('miembros', 20, 'canciones', 75, 'ministerios', 3,
      'asistente', 30, 'modo_musico', true, 'plantillas', true)
    else jsonb_build_object('miembros', 5, 'canciones', 20, 'ministerios', 1,
      'asistente', 5, 'modo_musico', false, 'plantillas', false)
  end
$$;
