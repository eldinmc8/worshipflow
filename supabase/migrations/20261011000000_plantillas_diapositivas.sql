-- Plantillas propias de cada iglesia para el editor de diapositivas (pedido de Eldin, 2026-10-11):
-- "Guardar como mi plantilla" — una diapositiva diseñada (mismo formato que
-- items_servicio.estructura.diapositivas[n]) que luego aparece en Plantillas junto a las de fábrica.
create table if not exists public.plantillas_diapositivas (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  nombre text not null,
  diapositiva jsonb not null,
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists plantillas_diapositivas_iglesia_idx on public.plantillas_diapositivas (iglesia_id, created_at desc);
alter table public.plantillas_diapositivas enable row level security;
drop policy if exists "autenticados: todo en plantillas_diapositivas" on public.plantillas_diapositivas;
create policy "autenticados: todo en plantillas_diapositivas" on public.plantillas_diapositivas
  for all to authenticated
  using (iglesia_id = public.mi_iglesia_id())
  with check (iglesia_id = public.mi_iglesia_id());
grant select, insert, update, delete on public.plantillas_diapositivas to authenticated;
