-- Repertorios (pedido de un cliente vía Eldin, 2026-11-26): listas fijas de canciones con nombre propio
-- ("Lista 1 Alabanza", "Lista 1 Adoración"…), sin evento ni fecha, para que los músicos ensayen cuando
-- quieran (como un álbum) y para meter todas sus canciones a un culto de un solo toque.
--   · canciones: arreglo JSON con los ids de las canciones, en el orden del repertorio. Si una canción se
--     borra de la biblioteca, la app simplemente la deja de mostrar (no hace falta limpiar aquí).
-- Los ve cualquiera de la iglesia; crean, cambian y borran quienes administran canciones
-- (wf_puedo_canciones por trigger, igual que la biblioteca — ver 20261102000000_permisos_en_la_base.sql).
create table if not exists public.repertorios (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  descripcion text not null default '',
  canciones jsonb not null default '[]'::jsonb check (jsonb_typeof(canciones) = 'array'),
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists repertorios_iglesia_idx on public.repertorios (iglesia_id);

alter table public.repertorios enable row level security;
drop policy if exists "ver repertorios" on public.repertorios;
create policy "ver repertorios" on public.repertorios for select to authenticated
  using (iglesia_id = public.mi_iglesia_id());
drop policy if exists "escribir repertorios" on public.repertorios;
create policy "escribir repertorios" on public.repertorios for all to authenticated
  using (iglesia_id = public.mi_iglesia_id())
  with check (iglesia_id = public.mi_iglesia_id());
grant select, insert, update, delete on public.repertorios to authenticated;

create or replace function public.wf_permiso_repertorios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if public.wf_puedo_canciones() then return coalesce(new, old); end if;
  perform public.wf_sin_permiso('cambiar los repertorios');
  return null;
end $$;
drop trigger if exists wf_permiso_repertorios on public.repertorios;
create trigger wf_permiso_repertorios before insert or update or delete on public.repertorios
  for each row execute function public.wf_permiso_repertorios();
