-- Beneficios de lanzamiento por grupo (pedido de Eldin, 2026-11-23).
--
-- Las columnas ya existen en public.iglesias: grupo_beneficio (fase_1 | fase_2 | lista_espera),
-- beneficio_plazo_hasta, beneficio_activado_en, beneficio_gratis_hasta y beneficio_precio_hasta.
-- Esta migración NO cambia datos. Solo:
-- 1) mi_plan() devuelve también el beneficio de la iglesia (para "Tu plan" y el aviso de plazo vencido).
-- 2) beneficio_para_pago(iglesia): la página pública de pago (worshipflowapp.com/web/pagar, sin sesión) pregunta si
--    esa iglesia puede activar su beneficio y de qué grupo es. Solo responde el grupo (o null), nada más.
-- 3) Nadie desde la app (ni el admin de la iglesia) puede cambiar las columnas del beneficio: solo el aviso de Paddle
--    (service role), el super admin o el editor SQL. Así el beneficio es de una sola vez por iglesia.

-- Las columnas ya están en producción; esto solo las crea donde falten (pruebas locales). No cambia nada si existen.
alter table public.iglesias
  add column if not exists grupo_beneficio text,
  add column if not exists beneficio_plazo_hasta timestamptz,
  add column if not exists beneficio_activado_en timestamptz,
  add column if not exists beneficio_gratis_hasta timestamptz,
  add column if not exists beneficio_precio_hasta timestamptz;

-- 1) mi_plan() con el beneficio -------------------------------------------------------------------------------------
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
    'prueba_disponible', not r.prueba_usada and r.paddle_suscripcion_id is null
      and not (r.plan = 'iglesia' and r.plan_vence is null),
    'creada', r.created_at,
    -- Beneficio de lanzamiento (null si la iglesia no tiene grupo).
    'beneficio', case when r.grupo_beneficio is null then null else jsonb_build_object(
      'grupo', r.grupo_beneficio,
      'plazo_hasta', r.beneficio_plazo_hasta,
      'activado_en', r.beneficio_activado_en,
      'gratis_hasta', r.beneficio_gratis_hasta,
      'precio_hasta', r.beneficio_precio_hasta,
      'disponible', r.beneficio_activado_en is null and (r.beneficio_plazo_hasta is null or r.beneficio_plazo_hasta >= now()),
      'plazo_vencido', r.beneficio_activado_en is null and r.beneficio_plazo_hasta is not null and r.beneficio_plazo_hasta < now()
    ) end,
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

-- 2) ¿Esta iglesia puede activar su beneficio? (para la página pública de pago) -------------------------------------
create or replace function public.beneficio_para_pago(p_iglesia uuid)
returns text language sql stable security definer set search_path = public as $$
  select i.grupo_beneficio
  from public.iglesias i
  where i.id = p_iglesia
    and i.grupo_beneficio in ('fase_1', 'fase_2', 'lista_espera')
    and i.beneficio_activado_en is null
    and (i.beneficio_plazo_hasta is null or i.beneficio_plazo_hasta >= now());
$$;
revoke execute on function public.beneficio_para_pago(uuid) from public;
grant execute on function public.beneficio_para_pago(uuid) to anon, authenticated;

-- 3) Las columnas del beneficio no se tocan desde la app ------------------------------------------------------------
create or replace function public.wf_proteger_beneficio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.soy_super_admin() then
    if new.grupo_beneficio is distinct from old.grupo_beneficio
       or new.beneficio_plazo_hasta is distinct from old.beneficio_plazo_hasta
       or new.beneficio_activado_en is distinct from old.beneficio_activado_en
       or new.beneficio_gratis_hasta is distinct from old.beneficio_gratis_hasta
       or new.beneficio_precio_hasta is distinct from old.beneficio_precio_hasta
    then
      raise exception 'El beneficio de lanzamiento solo lo cambia WorshipFlow.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists wf_proteger_beneficio on public.iglesias;
create trigger wf_proteger_beneficio before update on public.iglesias
  for each row execute function public.wf_proteger_beneficio();
