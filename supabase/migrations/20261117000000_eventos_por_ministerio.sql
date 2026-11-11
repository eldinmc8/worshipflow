-- Eventos por ministerio (pedido de Eldin, 2026-11-11, de una iglesia que quiere que cada grupo arme
-- su plan anual): un evento puede pertenecer a un ministerio (Jóvenes, Damas, Infantil...). Sin
-- ministerio = evento general de la iglesia, como siempre.
--
-- El LÍDER de ese ministerio puede crear, editar y borrar los eventos de su ministerio (y armar su
-- Setlist, equipo y recordatorios), aunque su rol no tenga "Organizar eventos". Quien sí lo tiene
-- (administradores, coordinadores) sigue pudiendo con todos.

alter table public.eventos add column if not exists ministerio_id uuid references public.ministerios(id) on delete set null;
create index if not exists eventos_ministerio_idx on public.eventos (ministerio_id) where ministerio_id is not null;

-- ¿Lidero el ministerio dueño de este evento?
create or replace function public.wf_lidero_ministerio_del_evento(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eventos e where e.id = p_evento and public.wf_lidero(e.ministerio_id))
$$;

-- Setlist (y por extensión equipo de alabanza y encargados): también el líder del ministerio del evento.
create or replace function public.wf_puedo_setlist(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wf_tengo('editar_setlist') or public.wf_controlo_vivo() or public.wf_lidero_en_evento(p_evento, 'editar_setlist')
    or public.wf_lidero_ministerio_del_evento(p_evento)
$$;

create or replace function public.wf_permiso_eventos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    if public.wf_tengo('gestionar_eventos') then return new; end if;
    -- Líder del ministerio: sus eventos (sin pasarlos a un ministerio que no lidera ni volverlos generales).
    if public.wf_lidero(old.ministerio_id) and public.wf_lidero(new.ministerio_id) then return new; end if;
    -- Ensayo y nota para Alabanza: quien dirige la alabanza de ese evento o quien edita su Setlist.
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['ensayo_fecha', 'ensayo_hora', 'nota_alabanza'])
       and (public.wf_puedo_setlist(old.id) or exists (
         select 1 from public.roles_evento r join public.miembros_rol mr on mr.rol_id = r.id
         where r.evento_id = old.id and mr.usuario_id = auth.uid() and mr.lead
       )) then return new; end if;
    perform public.wf_sin_permiso('cambiar este evento');
  elsif public.wf_tengo('gestionar_eventos') or public.wf_lidero(case when tg_op = 'DELETE' then old.ministerio_id else new.ministerio_id end) then
    return coalesce(new, old);
  else
    perform public.wf_sin_permiso(case when tg_op = 'INSERT' then 'crear eventos' else 'eliminar eventos' end);
  end if;
  return null;
end $$;

create or replace function public.wf_permiso_recordatorios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.eventos where id = old.evento_id) then return old; end if;
  if public.wf_tengo('gestionar_eventos') or public.wf_lidero_ministerio_del_evento(case when tg_op = 'DELETE' then old.evento_id else new.evento_id end) then return coalesce(new, old); end if;
  perform public.wf_sin_permiso('cambiar los recordatorios de este evento');
  return null;
end $$;

revoke execute on function public.wf_lidero_ministerio_del_evento(uuid) from public, anon;
grant execute on function public.wf_lidero_ministerio_del_evento(uuid) to authenticated;
