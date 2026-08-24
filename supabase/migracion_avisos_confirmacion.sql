-- WorshipFlow — "Empujón automático si no confirma su asignación"
-- Pega esto completo en Supabase → SQL Editor → Run.

create table if not exists avisos_confirmacion_enviados (
  evento_id uuid not null references eventos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  enviado_at timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

alter table avisos_confirmacion_enviados enable row level security;

-- Solo la Edge Function (llave service_role, salta RLS) escribe aquí -- nadie necesita policy de
-- insert/update. Sí conviene poder leerla desde la app para depurar si hace falta.
create policy "avisos_confirmacion_select" on avisos_confirmacion_enviados
  for select to authenticated using (true);
