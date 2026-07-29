-- WorshipFlow — Fase 1: usuarios reales
-- Pega esto completo en Supabase → SQL Editor → Run.

create table if not exists usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nombre text not null,
  es_admin boolean not null default false,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz default now()
);

alter table usuarios enable row level security;

-- Cualquier usuario autenticado puede leer su propia fila (para saber su rol al entrar).
create policy "ver propio usuario" on usuarios
  for select using (auth.uid() = id);

-- Los administradores pueden leer todas las filas.
create policy "admins ven todo" on usuarios
  for select using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.es_admin)
  );

-- Los administradores pueden editar cualquier fila (ej. cambiar estado activo/inactivo).
create policy "admins editan todo" on usuarios
  for update using (
    exists (select 1 from usuarios u where u.id = auth.uid() and u.es_admin)
  );

-- No se agrega policy de "insert"/"delete" para usuarios normales a propósito:
-- crear y borrar cuentas solo pasa por las Edge Functions (usan la llave service_role).
