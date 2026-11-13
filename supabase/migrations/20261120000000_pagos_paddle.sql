-- Cobros con Paddle (pedido de Eldin, 2026-11-13).
--
-- Cómo funciona:
-- - La iglesia paga en worshipflowapp.com/web/pagar (Paddle Checkout). El pago lleva iglesia_id en custom_data.
-- - Paddle avisa a la Edge Function `paddle-webhook`, que con la service role actualiza la iglesia:
--   plan, plan_vence (fin del periodo pagado + 3 días de gracia), en_prueba = false y los ids de Paddle.
-- - Si la suscripción se cancela o deja de pagarse, plan_vence ya no se mueve: al pasar esa fecha
--   wf_plan_efectivo() la cuenta como Gratis (igual que hoy con las pruebas vencidas). Nada se borra.

alter table public.iglesias
  add column if not exists paddle_suscripcion_id text,
  add column if not exists plan_periodo text,
  add column if not exists pago_estado text,
  add column if not exists pago_evento_en timestamptz; -- hora del último aviso aplicado (ignora avisos viejos que lleguen tarde)

-- Registro de avisos de Paddle: evita procesar dos veces el mismo aviso y sirve para revisar qué pasó.
create table if not exists public.pagos_eventos (
  id text primary key,                 -- event_id de Paddle
  tipo text not null,
  iglesia_id uuid references public.iglesias(id) on delete set null,
  ocurrido timestamptz,
  datos jsonb not null,
  recibido timestamptz not null default now()
);
alter table public.pagos_eventos enable row level security;
revoke all on public.pagos_eventos from anon, authenticated;
-- Sin políticas: solo la Edge Function (service role) lee y escribe. El super admin lo ve desde Supabase.

-- mi_plan() ahora también dice el id de la iglesia, si quien pregunta es administrador (solo ellos
-- pueden pagar) y si la iglesia ya tiene una suscripción en Paddle.
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
    'tiene_suscripcion', r.paddle_suscripcion_id is not null,
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
