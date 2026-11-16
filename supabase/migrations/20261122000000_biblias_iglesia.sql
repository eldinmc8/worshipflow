-- Biblias importadas por cada iglesia (pedido de Eldin, 2026-11-16): el admin sube un archivo Zefania XML
-- (por ejemplo una versión en Ixil que usa su congregación) y queda disponible SOLO para su iglesia en el
-- selector de versión, la búsqueda, el Setlist, la consola y el control remoto. La app no reparte estas
-- versiones a otras iglesias: cada una sube las que tiene derecho a usar.
--
-- El archivo se lee en el navegador (src/lib/bibliasIglesia.js) y se guarda versículo por versículo:
-- así leer un capítulo es una consulta y la búsqueda por palabras funciona igual que con las demás.
-- completa = false mientras se suben los versículos; la app solo muestra las completas (si la subida se
-- corta, esa fila se borra y no queda una Biblia a medias).

create table if not exists public.biblias_iglesia (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  codigo text not null check (codigo ~ '^[A-Z0-9]{2,10}$'),
  nombre text not null check (char_length(nombre) between 1 and 80),
  idioma text check (idioma is null or char_length(idioma) <= 40),
  libros jsonb not null default '[]'::jsonb,
  total_versiculos integer not null default 0,
  completa boolean not null default false,
  creado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (iglesia_id, codigo)
);
create index if not exists biblias_iglesia_creado_por_idx on public.biblias_iglesia (creado_por);

create table if not exists public.versiculos_iglesia (
  biblia_id uuid not null references public.biblias_iglesia(id) on delete cascade,
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  libro smallint not null check (libro between 1 and 66),
  capitulo smallint not null check (capitulo between 1 and 200),
  versiculo smallint not null check (versiculo between 1 and 250),
  texto text not null check (char_length(texto) <= 4000),
  primary key (biblia_id, libro, capitulo, versiculo)
);
create index if not exists versiculos_iglesia_iglesia_id_idx on public.versiculos_iglesia (iglesia_id);

-- El versículo siempre es de la misma iglesia que su Biblia (que nadie cuele versículos en la Biblia de
-- otra iglesia aunque adivine su id).
create or replace function public.wf_versiculo_misma_iglesia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.biblias_iglesia b where b.id = new.biblia_id and b.iglesia_id = new.iglesia_id) then
    raise exception 'El versículo no corresponde a una Biblia de esta iglesia.';
  end if;
  return new;
end $$;
drop trigger if exists versiculo_misma_iglesia on public.versiculos_iglesia;
create trigger versiculo_misma_iglesia before insert or update on public.versiculos_iglesia
  for each row execute function public.wf_versiculo_misma_iglesia();

-- ¿Soy administrador de mi iglesia? (rol 'admin', igual que realIsAdmin en la app).
create or replace function public.wf_soy_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
$$;

alter table public.biblias_iglesia enable row level security;
alter table public.versiculos_iglesia enable row level security;

drop policy if exists "ver biblias" on public.biblias_iglesia;
create policy "ver biblias" on public.biblias_iglesia for select to authenticated
  using (iglesia_id = public.mi_iglesia_id());
drop policy if exists "importar biblias" on public.biblias_iglesia;
create policy "importar biblias" on public.biblias_iglesia for insert to authenticated
  with check (iglesia_id = public.mi_iglesia_id() and public.wf_soy_admin());
drop policy if exists "editar biblias" on public.biblias_iglesia;
create policy "editar biblias" on public.biblias_iglesia for update to authenticated
  using (iglesia_id = public.mi_iglesia_id() and public.wf_soy_admin())
  with check (iglesia_id = public.mi_iglesia_id() and public.wf_soy_admin());
drop policy if exists "borrar biblias" on public.biblias_iglesia;
create policy "borrar biblias" on public.biblias_iglesia for delete to authenticated
  using (iglesia_id = public.mi_iglesia_id() and public.wf_soy_admin());

drop policy if exists "ver versiculos" on public.versiculos_iglesia;
create policy "ver versiculos" on public.versiculos_iglesia for select to authenticated
  using (iglesia_id = public.mi_iglesia_id());
drop policy if exists "importar versiculos" on public.versiculos_iglesia;
create policy "importar versiculos" on public.versiculos_iglesia for insert to authenticated
  with check (iglesia_id = public.mi_iglesia_id() and public.wf_soy_admin());
drop policy if exists "borrar versiculos" on public.versiculos_iglesia;
create policy "borrar versiculos" on public.versiculos_iglesia for delete to authenticated
  using (iglesia_id = public.mi_iglesia_id() and public.wf_soy_admin());
