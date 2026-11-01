-- Bosquejo del predicador (pedido de Eldin, 2026-11-01).
--
-- Quien está ASIGNADO (encargado) a un bloque de Predicación de un evento arma su bosquejo desde la app:
-- título del sermón, cita base, introducción/idea central y puntos con versículos. Dos partes:
--
-- 1. La tabla bosquejos guarda el borrador (uno por bloque de Predicación). Se guarda sola en cada paso y
--    vive aparte del Setlist, así que el guardado del Setlist completo nunca la pisa.
-- 2. Al tocar "Enviar a Multimedia", la app convierte el bosquejo en diapositivas reales del Setlist
--    (título, cita, puntos, versículos), justo después del bloque de Predicación, marcadas en estructura
--    con {"bosquejoDe": <id del bloque>}. Así En vivo las proyecta como cualquier otra diapositiva.
--    Para eso se amplía wf_permiso_items (de 20261102000000_permisos_en_la_base.sql): el predicador
--    puede agregar, cambiar y quitar SOLO las diapositivas marcadas con SU bloque.
--
-- Requiere haber corrido antes 20261102000000_permisos_en_la_base.sql.

-- ¿Este bloque es de Predicación? Mismo criterio (por título) que isPreachingBlock en la app.
create or replace function public.wf_es_titulo_predicacion(titulo text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(titulo, '') ~* '(pr[eé]dic|serm[oó]n|mensaje)'
$$;

-- Id del bloque al que pertenece una diapositiva del bosquejo (estructura.bosquejoDe), como texto.
create or replace function public.wf_bosquejo_de(estructura jsonb) returns text
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(estructura) = 'object' then nullif(estructura->>'bosquejoDe', '') end
$$;

-- ¿Estoy asignado a este bloque de Predicación de este evento? (se compara como texto para que un
-- valor raro en bosquejoDe simplemente no coincida, en vez de dar error)
create or replace function public.wf_predico(p_bloque text, p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_bloque is not null and exists (
    select 1 from public.items_servicio b join public.miembros_rol mr on mr.item_servicio_id = b.id
    where b.id::text = p_bloque and b.evento_id = p_evento and b.tipo = 'bloque'
      and public.wf_es_titulo_predicacion(b.titulo) and mr.usuario_id = auth.uid()
  )
$$;

-- ---------- Setlist: el predicador maneja las diapositivas de SU bosquejo ----------
create or replace function public.wf_permiso_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    -- Upsert de una fila que ya existe: lo decide el trigger de UPDATE (compara con la fila real).
    if exists (select 1 from public.items_servicio where id = new.id) then return new; end if;
    if public.wf_puedo_setlist(new.evento_id) then return new; end if;
    -- El predicador agrega las diapositivas que salen de SU bosquejo (marcadas con bosquejoDe).
    if new.tipo in ('slide', 'biblia') and public.wf_predico(public.wf_bosquejo_de(new.estructura), new.evento_id) then return new; end if;
    -- El encargado de un bloque de Lectura/Oración puede agregar su versículo (canAddBibleReading).
    if new.tipo = 'biblia' and exists (
      select 1 from public.items_servicio b join public.miembros_rol mr on mr.item_servicio_id = b.id
      where b.evento_id = new.evento_id and b.tipo = 'bloque' and b.titulo ~* '(lectura|oraci[oó]n)' and mr.usuario_id = auth.uid()
    ) then return new; end if;
    perform public.wf_sin_permiso('agregar cosas al Setlist de este evento');
  elsif tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    if public.wf_puedo_setlist(old.evento_id) and public.wf_puedo_setlist(new.evento_id) then return new; end if;
    -- El predicador actualiza las diapositivas de SU bosquejo (siguen siendo de su bosquejo y del mismo evento).
    if new.tipo in ('slide', 'biblia') and new.evento_id = old.evento_id
       and public.wf_bosquejo_de(old.estructura) = public.wf_bosquejo_de(new.estructura)
       and public.wf_predico(public.wf_bosquejo_de(old.estructura), old.evento_id) then return new; end if;
    -- Desvincular porque se BORRÓ la canción o el grupo (ON DELETE SET NULL): la fila padre ya no existe.
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['cancion_id', 'ministerio_id'])
       and (new.cancion_id is not distinct from old.cancion_id or (new.cancion_id is null and not exists (select 1 from public.canciones where id = old.cancion_id)))
       and (new.ministerio_id is not distinct from old.ministerio_id or (new.ministerio_id is null and not exists (select 1 from public.ministerios where id = old.ministerio_id)))
    then return new; end if;
    -- La app reenvía el Setlist renumerado: tolerar solo el orden a quien participa en el evento.
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['orden']) and public.wf_participo_en_evento(old.evento_id) then return new; end if;
    -- Líder del grupo vinculado: título y descripción de SU bloque (lo básico de todo líder).
    if old.tipo = 'bloque' and public.wf_lidero(old.ministerio_id)
       and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['titulo', 'descripcion', 'orden']) then return new; end if;
    perform public.wf_sin_permiso('cambiar el Setlist de este evento');
  else
    if not exists (select 1 from public.eventos where id = old.evento_id) then return old; end if; -- se borró el evento
    if public.wf_puedo_setlist(old.evento_id) then return old; end if;
    -- El predicador quita diapositivas de SU bosquejo (al volver a enviarlo).
    if public.wf_predico(public.wf_bosquejo_de(old.estructura), old.evento_id) then return old; end if;
    perform public.wf_sin_permiso('quitar cosas del Setlist de este evento');
  end if;
  return null;
end $$;

-- ---------- Tabla del bosquejo ----------
create table if not exists public.bosquejos (
  item_servicio_id uuid primary key references public.items_servicio(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  titulo text not null default '',
  cita_base jsonb,                                 -- { ref, version, text, bookId, bookName, chapter, verseStart, verseEnd }
  idea_central text not null default '',
  mostrar_idea boolean not null default false,     -- la introducción normalmente NO se proyecta
  puntos jsonb not null default '[]'::jsonb,       -- [{ id, titulo, nota, versiculos: [{ ref, version, text, ... }] }]
  enviado_at timestamptz,                          -- última vez que se mandó a Multimedia
  editado_por uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index if not exists bosquejos_evento_idx on public.bosquejos (evento_id);

-- ¿Puedo escribir el bosquejo de este bloque? El predicador asignado, o quien edita el Setlist completo.
create or replace function public.wf_puedo_bosquejo(p_item uuid, p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.items_servicio b
    where b.id = p_item and b.evento_id = p_evento and b.tipo = 'bloque'
      and public.wf_es_titulo_predicacion(b.titulo)
  ) and (public.wf_predico(p_item::text, p_evento) or public.wf_puedo_setlist(p_evento))
$$;
revoke execute on function public.wf_puedo_bosquejo(uuid, uuid) from public, anon;
grant execute on function public.wf_puedo_bosquejo(uuid, uuid) to authenticated;
revoke execute on function public.wf_predico(text, uuid) from public, anon, authenticated;

alter table public.bosquejos enable row level security;
drop policy if exists "ver bosquejos" on public.bosquejos;
create policy "ver bosquejos" on public.bosquejos for select to authenticated
  using (iglesia_id = public.mi_iglesia_id());
drop policy if exists "escribir bosquejos" on public.bosquejos;
create policy "escribir bosquejos" on public.bosquejos for all to authenticated
  using (iglesia_id = public.mi_iglesia_id() and public.wf_puedo_bosquejo(item_servicio_id, evento_id))
  with check (iglesia_id = public.mi_iglesia_id() and public.wf_puedo_bosquejo(item_servicio_id, evento_id));
grant select, insert, update, delete on public.bosquejos to authenticated;
