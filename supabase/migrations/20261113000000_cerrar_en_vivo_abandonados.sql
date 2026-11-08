-- Cerrar en la base los en vivo abandonados (2026-11-08).
--
-- El cierre tras 2 horas sin actividad (commit 00c5a1a) vive en la app: solo corre si ALGÚN dispositivo
-- de esa iglesia tiene WorshipFlow abierto. Si al terminar el culto todos cierran el navegador (o la
-- compu de Multimedia se apaga) sin "Finalizar", la fila de sesiones_en_vivo se queda "en vivo" para
-- siempre: el 2026-11-08 había 3 iglesias así, con 4-6 horas sin cambios.
--
-- Ahora la base lo hace sola cada 10 minutos, con el mismo umbral de la app (LIVE_SESSION_STALE_MS =
-- 2 horas sin cambios en updated_at). Quien transmite renueva updated_at al cambiar de diapositiva/estilo
-- o al tocar la consola (cada 10 min), así que una transmisión real nunca se corta por esto.
-- Deja la fila igual que clearLiveSession() en lib/liveSession.js: estilo_en_vivo se conserva a
-- propósito, y los triggers de siempre renuevan el código de las pantallas.

create or replace function public.wf_cerrar_en_vivo_abandonados() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update public.sesiones_en_vivo
     set evento_id = null, liderado_por = null, slide_actual = null, blanked = false,
         ad_hoc_label = null, libre = false, updated_at = now()
   where (evento_id is not null or coalesce(libre, false))
     and updated_at < now() - interval '2 hours';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.wf_cerrar_en_vivo_abandonados() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('cerrar-en-vivo-abandonados') where exists (select 1 from cron.job where jobname = 'cerrar-en-vivo-abandonados');
    perform cron.schedule('cerrar-en-vivo-abandonados', '*/10 * * * *', 'select public.wf_cerrar_en_vivo_abandonados()');
  end if;
end $$;
