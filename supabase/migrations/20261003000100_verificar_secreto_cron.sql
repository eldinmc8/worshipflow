-- Seguridad: procesar-recordatorios verificaba el header x-cron-secret contra la variable de
-- entorno CRON_SECRET, cuyo valor quedó escrito literal (y expuesto en un chat) dentro del propio
-- comando del job de pg_cron que la llama cada 15 minutos. Se rotó un secreto nuevo, guardado en
-- Supabase Vault como 'cron_secret' (igual que push_manual_secret: generado con gen_random_bytes
-- directo en Postgres, nunca escrito en un archivo ni impreso en un chat).
--
-- Mismo patrón que verificar_secreto_push (ver 20261003000000) -- se separan en dos funciones (no
-- una genérica con el nombre del secreto como parámetro) para que cada Edge Function solo pueda
-- autorizarse a sí misma, nunca con el secreto de la otra.
create function public.verificar_secreto_cron(p_secreto text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_secreto
  );
$$;

revoke all on function public.verificar_secreto_cron(text) from public, anon, authenticated;
grant execute on function public.verificar_secreto_cron(text) to service_role;

-- El job ya existía (creado en una migración anterior fuera de este repo, ver programa_cron_recordatorios
-- / corrige_cron_recordatorios_apikey en el historial de Supabase) -- se actualiza en vez de recrearse,
-- para no perder su jobid ni su historial en cron.job_run_details. El 'apikey'/'Authorization' siguen
-- siendo la clave anon pública del proyecto (no es secreta, Supabase la expone a propósito en el
-- cliente) -- lo único que cambia es x-cron-secret, que ahora se lee del Vault EN CADA EJECUCIÓN en vez
-- de llevar el valor fijo escrito en el comando, así nunca vuelve a quedar expuesto si alguien pega
-- este comando en un chat o un issue.
select cron.alter_job(
  job_id := 2,
  command := $cron$
  select net.http_post(
    url := 'https://oczqykwfdyfslsebinrl.supabase.co/functions/v1/procesar-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jenF5a3dmZHlmc2xzZWJpbnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDkwMjYsImV4cCI6MjEwMDQyNTAyNn0.hSBgh1_thFMT3nLwuZUBtNj4hPWErdhljTxeeYDTY_o',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jenF5a3dmZHlmc2xzZWJpbnJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDkwMjYsImV4cCI6MjEwMDQyNTAyNn0.hSBgh1_thFMT3nLwuZUBtNj4hPWErdhljTxeeYDTY_o',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);
