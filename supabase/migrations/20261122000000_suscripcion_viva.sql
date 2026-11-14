-- "Tiene suscripción" solo cuenta si sigue viva (2026-11-13): antes, una suscripción de Paddle cancelada o
-- pausada seguía escondiendo "Pagar con tarjeta" para siempre. Ahora, si se canceló, pausó o ya venció,
-- el administrador puede volver a pagar.
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
