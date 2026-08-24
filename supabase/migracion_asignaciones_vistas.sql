-- WorshipFlow — "Quién ya vio sus asignaciones"
-- Pega esto completo en Supabase → SQL Editor → Run.

create table if not exists asignaciones_vistas (
  evento_id uuid not null references eventos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

alter table asignaciones_vistas enable row level security;

create policy "asignaciones_vistas_select" on asignaciones_vistas
  for select to authenticated using (true);

create policy "asignaciones_vistas_insert" on asignaciones_vistas
  for insert to authenticated with check (usuario_id = auth.uid());

create policy "asignaciones_vistas_update" on asignaciones_vistas
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

alter publication supabase_realtime add table asignaciones_vistas;
