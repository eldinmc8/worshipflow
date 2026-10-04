-- Resumen mensual por ministerio: un espacio de texto libre donde el líder de cada grupo escribe sus
-- propias notas/resumen de un mes puntual (distinto de la planificación semana a semana, que ya existe
-- en planificacion_ministerio) — un pedido directo de Eldin el 2026-10-03.
--
-- Mismo patrón que el resto de tablas de un ministerio (planificacion_ministerio/recursos_ministerio),
-- pero con el WITH CHECK ya cerrado desde el día uno (ver 20261003000300_cerrar_fuga_fk_entre_iglesias.sql
-- para por qué: no basta con exigir iglesia_id = mi_iglesia_id() en la fila nueva, también hay que
-- exigir que el ministerio referenciado sea de esa misma iglesia).
create table public.resumen_mensual_ministerio (
  id uuid primary key default gen_random_uuid(),
  ministerio_id uuid not null references public.ministerios(id) on delete cascade,
  mes text not null, -- 'YYYY-MM', mismo formato que ya usa recursos_ministerio.mes
  texto text not null default '',
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (ministerio_id, mes)
);

create index resumen_mensual_ministerio_iglesia_id_idx on public.resumen_mensual_ministerio (iglesia_id);

alter table public.resumen_mensual_ministerio enable row level security;

create policy "autenticados: todo en resumen_mensual_ministerio" on public.resumen_mensual_ministerio
  as permissive for all to authenticated
  using (iglesia_id = public.mi_iglesia_id())
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.ministerios m where m.id = ministerio_id and m.iglesia_id = public.mi_iglesia_id())
  );
