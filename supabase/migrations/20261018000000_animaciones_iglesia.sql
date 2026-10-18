-- Animaciones propias de cada iglesia (pedido de Eldin, 2026-10-18): estilos de letra animada creados en la
-- app (una "receta" de datos, ver src/lib/animaciones.js). compartida = aparece en la galería para que otras
-- iglesias la vean y la copien. Cada iglesia solo puede crear, editar y borrar las suyas.
create table if not exists public.animaciones_iglesia (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null references public.iglesias(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  receta jsonb not null,
  compartida boolean not null default false,
  autor_iglesia text,
  creado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists animaciones_iglesia_iglesia_id_idx on public.animaciones_iglesia (iglesia_id);
create index if not exists animaciones_iglesia_creado_por_idx on public.animaciones_iglesia (creado_por);
create index if not exists animaciones_iglesia_compartida_idx on public.animaciones_iglesia (created_at desc) where compartida;

alter table public.animaciones_iglesia enable row level security;

drop policy if exists "ver animaciones" on public.animaciones_iglesia;
create policy "ver animaciones" on public.animaciones_iglesia for select to authenticated
  using (iglesia_id = public.mi_iglesia_id() or compartida);
drop policy if exists "crear animaciones" on public.animaciones_iglesia;
create policy "crear animaciones" on public.animaciones_iglesia for insert to authenticated
  with check (iglesia_id = public.mi_iglesia_id());
drop policy if exists "editar animaciones" on public.animaciones_iglesia;
create policy "editar animaciones" on public.animaciones_iglesia for update to authenticated
  using (iglesia_id = public.mi_iglesia_id()) with check (iglesia_id = public.mi_iglesia_id());
drop policy if exists "borrar animaciones" on public.animaciones_iglesia;
create policy "borrar animaciones" on public.animaciones_iglesia for delete to authenticated
  using (iglesia_id = public.mi_iglesia_id());
