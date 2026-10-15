-- Notas de los músicos por parte de la canción (pedido de Eldin, 2026-10-14).
-- Dos tipos en la misma tabla:
--   · Nota del líder (para todos): dueno_id = '00000000-0000-0000-0000-000000000000'. Una por parte.
--     La ven todos; la escriben admins y líderes (ver puedo_nota_equipo).
--   · Mi nota (personal): dueno_id = el usuario. Solo la ve y la escribe esa persona.
create table if not exists public.notas_seccion (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  cancion_id uuid not null references public.canciones(id) on delete cascade,
  seccion_clave text not null,
  dueno_id uuid not null,
  texto text not null default '',
  editado_por uuid default auth.uid(),
  editado_nombre text,
  updated_at timestamptz not null default now(),
  unique (cancion_id, seccion_clave, dueno_id)
);
create index if not exists notas_seccion_cancion_idx on public.notas_seccion (cancion_id);

create or replace function public.puedo_nota_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
    left join public.roles_app r on r.id = u.rol_id
    where u.id = auth.uid()
      and (u.rol = 'admin'
        or coalesce((r.permisos->>'editar_setlist')::boolean, false)
        or coalesce((r.permisos->>'editar_eventos_setlist')::boolean, false)
        or coalesce((r.permisos->>'gestionar_eventos')::boolean, false)
        or coalesce((r.permisos->>'gestionar_canciones')::boolean, false))
  );
$$;
grant execute on function public.puedo_nota_equipo() to authenticated;

alter table public.notas_seccion enable row level security;
drop policy if exists "ver notas" on public.notas_seccion;
create policy "ver notas" on public.notas_seccion for select to authenticated
  using (iglesia_id = public.mi_iglesia_id()
    and (dueno_id = '00000000-0000-0000-0000-000000000000'::uuid or dueno_id = auth.uid()));
drop policy if exists "escribir notas" on public.notas_seccion;
create policy "escribir notas" on public.notas_seccion for all to authenticated
  using (iglesia_id = public.mi_iglesia_id()
    and (dueno_id = auth.uid() or (dueno_id = '00000000-0000-0000-0000-000000000000'::uuid and public.puedo_nota_equipo())))
  with check (iglesia_id = public.mi_iglesia_id()
    and (dueno_id = auth.uid() or (dueno_id = '00000000-0000-0000-0000-000000000000'::uuid and public.puedo_nota_equipo())));
grant select, insert, update, delete on public.notas_seccion to authenticated;
