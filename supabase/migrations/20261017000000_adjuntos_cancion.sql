-- Adjuntos por canción (pedido de Eldin, 2026-10-17): PDFs (partituras, cifrados), imágenes y
-- enlaces (YouTube, Drive, Spotify...). Se abren desde el clip de la canción.
--   · tipo 'pdf' / 'imagen': archivo subido al bucket "adjuntos-canciones"; ruta = su lugar ahí.
--   · tipo 'enlace': solo url, ruta en null.
-- Los ve cualquiera de la iglesia; agregan y quitan admins/líderes/quien gestiona canciones
-- (misma regla que las notas "para todos" — ver puedo_nota_equipo en 20261015000000_notas_seccion.sql).
create table if not exists public.adjuntos_cancion (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  cancion_id uuid not null references public.canciones(id) on delete cascade,
  tipo text not null check (tipo in ('pdf', 'imagen', 'enlace')),
  titulo text not null default '',
  url text not null,
  ruta text,
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists adjuntos_cancion_cancion_idx on public.adjuntos_cancion (cancion_id);

alter table public.adjuntos_cancion enable row level security;
drop policy if exists "ver adjuntos" on public.adjuntos_cancion;
create policy "ver adjuntos" on public.adjuntos_cancion for select to authenticated
  using (iglesia_id = public.mi_iglesia_id());
drop policy if exists "escribir adjuntos" on public.adjuntos_cancion;
create policy "escribir adjuntos" on public.adjuntos_cancion for all to authenticated
  using (iglesia_id = public.mi_iglesia_id() and public.puedo_nota_equipo())
  with check (iglesia_id = public.mi_iglesia_id() and public.puedo_nota_equipo());
grant select, insert, update, delete on public.adjuntos_cancion to authenticated;
