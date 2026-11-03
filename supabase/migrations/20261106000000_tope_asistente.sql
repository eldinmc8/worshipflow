-- Tope diario del asistente con IA por iglesia (pedido de Eldin, 2026-11-03, lista para vender #1).
--
-- Cada mensaje al asistente es una llamada a Claude que se paga. Sin tope, una iglesia (o un error en
-- un bucle) podía disparar la factura. Ahora:
-- - iglesias.limite_asistente_diario: cuántos mensajes al día puede mandar cada iglesia (30 de entrada;
--   se cambia por iglesia).
-- - uso_asistente: un renglón por iglesia y por día (el día de la zona horaria de la iglesia), con los
--   mensajes y los tokens usados — para ver cuánto gasta cada iglesia.
-- - reservar_mensaje_asistente: la Edge Function la llama ANTES de hablar con Claude; suma 1 solo si no
--   se pasa del tope (atómico: dos mensajes al mismo tiempo no se saltan el límite).
-- - devolver_mensaje_asistente: si Claude falla, el mensaje no cuenta.
-- - sumar_tokens_asistente: anota los tokens que de verdad se usaron.
-- Aplicar un plan ya aprobado no cuenta (no usa IA).

alter table public.iglesias
  add column if not exists limite_asistente_diario integer not null default 30
  check (limite_asistente_diario >= 0);

create table if not exists public.uso_asistente (
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  fecha date not null,
  mensajes integer not null default 0,
  tokens_entrada bigint not null default 0,
  tokens_salida bigint not null default 0,
  actualizado_at timestamptz not null default now(),
  primary key (iglesia_id, fecha)
);
alter table public.uso_asistente enable row level security;
-- Los administradores de la iglesia ven su propio uso (para "te quedan N mensajes hoy").
drop policy if exists "admins ven el uso del asistente" on public.uso_asistente;
create policy "admins ven el uso del asistente" on public.uso_asistente for select to authenticated
  using (public.soy_super_admin() or (iglesia_id = public.mi_iglesia_id() and exists (
    select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')));
grant select on public.uso_asistente to authenticated;

-- "Hoy" según la zona horaria de la iglesia.
create or replace function public.wf_hoy_iglesia(p_iglesia uuid)
returns date language sql stable security definer
set search_path = public as $$
  select (now() at time zone coalesce(
    (select zona_horaria from public.iglesias where id = p_iglesia), 'Etc/GMT+6'))::date
$$;

-- Suma 1 si no se pasó del tope. Devuelve { permitido, usados, limite }.
create or replace function public.reservar_mensaje_asistente(p_iglesia uuid)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  v_limite int;
  v_fecha date := public.wf_hoy_iglesia(p_iglesia);
  v_usados int;
begin
  select limite_asistente_diario into v_limite from public.iglesias where id = p_iglesia;
  if v_limite is null then
    return jsonb_build_object('permitido', false, 'usados', 0, 'limite', 0);
  end if;
  insert into public.uso_asistente (iglesia_id, fecha, mensajes)
  values (p_iglesia, v_fecha, 0)
  on conflict (iglesia_id, fecha) do nothing;
  update public.uso_asistente
  set mensajes = mensajes + 1, actualizado_at = now()
  where iglesia_id = p_iglesia and fecha = v_fecha and mensajes < v_limite
  returning mensajes into v_usados;
  if v_usados is null then
    select mensajes into v_usados from public.uso_asistente where iglesia_id = p_iglesia and fecha = v_fecha;
    return jsonb_build_object('permitido', false, 'usados', v_usados, 'limite', v_limite);
  end if;
  return jsonb_build_object('permitido', true, 'usados', v_usados, 'limite', v_limite);
end $$;

-- Si Claude falló, el mensaje no cuenta.
create or replace function public.devolver_mensaje_asistente(p_iglesia uuid)
returns void language sql security definer
set search_path = public as $$
  update public.uso_asistente
  set mensajes = greatest(mensajes - 1, 0), actualizado_at = now()
  where iglesia_id = p_iglesia and fecha = public.wf_hoy_iglesia(p_iglesia)
$$;

create or replace function public.sumar_tokens_asistente(p_iglesia uuid, p_entrada bigint, p_salida bigint)
returns void language sql security definer
set search_path = public as $$
  update public.uso_asistente
  set tokens_entrada = tokens_entrada + greatest(coalesce(p_entrada, 0), 0),
      tokens_salida = tokens_salida + greatest(coalesce(p_salida, 0), 0),
      actualizado_at = now()
  where iglesia_id = p_iglesia and fecha = public.wf_hoy_iglesia(p_iglesia)
$$;

-- Solo la Edge Function (llave de servicio) las usa: nadie con sesión puede sumarse o restarse mensajes.
revoke execute on function public.wf_hoy_iglesia(uuid) from public, anon, authenticated;
revoke execute on function public.reservar_mensaje_asistente(uuid) from public, anon, authenticated;
revoke execute on function public.devolver_mensaje_asistente(uuid) from public, anon, authenticated;
revoke execute on function public.sumar_tokens_asistente(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.wf_hoy_iglesia(uuid) to service_role;
grant execute on function public.reservar_mensaje_asistente(uuid) to service_role;
grant execute on function public.devolver_mensaje_asistente(uuid) to service_role;
grant execute on function public.sumar_tokens_asistente(uuid, bigint, bigint) to service_role;
