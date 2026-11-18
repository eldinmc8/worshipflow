-- Prueba gratis con tarjeta (pedido de Eldin, 2026-11-17):
-- - Las iglesias NUEVAS (Edge Function crear-iglesia) ya no reciben 14 días del plan Iglesia sin tarjeta: arrancan en
--   Gratis y se les ofrece
--   1 mes gratis del plan Iglesia poniendo su tarjeta en Paddle (precio con trial). Al terminar, Paddle cobra el
--   plan Iglesia mensual salvo que cancelen o cambien de plan antes. Sin tarjeta, se quedan en Gratis.
-- - Una sola prueba por iglesia (prueba_usada la marca el aviso de Paddle al crear cualquier suscripción).
-- - Fundadoras: sin cambios (el trigger fundadora_por_codigo las deja en Iglesia sin vencimiento).
-- - Las iglesias que hoy están en la prueba vieja de 14 días la terminan igual.

alter table public.iglesias add column if not exists prueba_usada boolean not null default false;
update public.iglesias set prueba_usada = true where paddle_suscripcion_id is not null;

create or replace function public.mi_plan()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ig uuid := public.mi_iglesia_id(); v_plan text; r public.iglesias;
begin
  if v_ig is null then return null; end if;
  select * into r from public.iglesias where id = v_ig;
  v_plan := public.wf_plan_efectivo(v_ig);
  return jsonb_build_object(
    'iglesia_id', v_ig,
    'plan', v_plan,
    'plan_contratado', r.plan,
    'vence', r.plan_vence,
    'en_prueba', r.en_prueba and r.plan_vence is not null and r.plan_vence >= now(),
    'vencido', r.plan_vence is not null and r.plan_vence < now(),
    'periodo', r.plan_periodo,
    'pago_estado', r.pago_estado,
    'tiene_suscripcion', r.paddle_suscripcion_id is not null
      and coalesce(r.pago_estado, '') in ('active', 'trialing', 'past_due', 'cancela_al_final')
      and (r.plan_vence is null or r.plan_vence >= now()),
    -- Prueba de 1 mes con tarjeta (Paddle): una sola vez por iglesia; no para Fundadoras (Iglesia sin vencimiento)
    -- ni para quien ya tiene o tuvo una suscripción.
    'prueba_disponible', not r.prueba_usada and r.paddle_suscripcion_id is null
      and not (r.plan = 'iglesia' and r.plan_vence is null),
    'creada', r.created_at,
    'soy_admin', exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'),
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
