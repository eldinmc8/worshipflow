-- Permisos que se cumplen en la BASE, no solo en la pantalla (2026-11-02).
--
-- Hasta ahora la RLS solo separaba iglesias: dentro de una misma iglesia cualquier usuario con sesión
-- podía, llamando a la API directamente, editar o borrar canciones, eventos, el Setlist o los grupos
-- (los permisos de roles y de líder de grupo solo escondían botones). Esto copia en la base las MISMAS
-- reglas que ya usa la app (src/PrototipoWorshipFlow.jsx: tienePermiso, canControlLive, permisos por
-- grupo, canAddBibleReading, EnsayoAlabanzaCard, confirmar los propios cargos).
--
-- Por qué triggers y no políticas RLS: la app guarda el Setlist COMPLETO de un evento con cada cambio
-- (upsert de todas las filas, ver sincronizarServiceOrderInterno en src/lib/eventos.js). El líder de
-- Limpieza que agrega un encargado manda también, sin cambios, las filas de canciones y demás bloques.
-- Una política RLS no puede distinguir "fila reenviada igual" de "fila modificada"; un trigger sí
-- (compara OLD con NEW), así solo se rechaza lo que de verdad cambia y no le toca a esa persona. La RLS
-- existente (aislamiento entre iglesias) se queda tal cual.
--
-- Sin sesión (auth.uid() nulo) = Edge Functions con la llave de servicio (asistente, recordatorios) o el
-- editor SQL: pasan siempre, como hoy.

-- ---------- Ayudantes ----------

-- ¿Tengo este permiso por mi rol? Mismo criterio que tienePermiso() + PERMISOS_APP.incluye en la app.
create or replace function public.wf_tengo(clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u left join public.roles_app r on r.id = u.rol_id
    where u.id = auth.uid() and (
      u.rol = 'admin'
      or coalesce(r.protegido, false)
      or r.permisos->>'editar_eventos_setlist' = 'true'
      or r.permisos->>clave = 'true'
      or (clave = 'editar_setlist' and r.permisos->>'gestionar_eventos' = 'true')
      or (clave = 'ver_canciones' and r.permisos->>'gestionar_canciones' = 'true')
    )
  )
$$;

-- ¿Controlo la transmisión en vivo? (canControlLive en la app: Administrador, Multimedia o un rol con
-- permisos de En vivo). Desde En vivo se agregan/reordenan cosas del Setlist y se corrigen letras.
create or replace function public.wf_controlo_vivo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u left join public.roles_app r on r.id = u.rol_id
    where u.id = auth.uid() and (
      u.rol in ('admin', 'multimedia')
      or coalesce(r.protegido, false)
      or r.permisos->>'iniciar_finalizar_vivo' = 'true'
      or r.permisos->>'controlar_estilo_vivo' = 'true'
    )
  )
$$;

-- ¿Lidero este grupo? Con clave: además el grupo le da ese permiso a su líder (permisos_lider).
create or replace function public.wf_lidero(p_ministerio uuid, clave text default null) returns boolean
language sql stable security definer set search_path = public as $$
  select p_ministerio is not null and exists (
    select 1 from public.ministerios m
    where m.id = p_ministerio and m.lider_id = auth.uid()
      and (clave is null or m.permisos_lider->>clave = 'true')
  )
$$;

-- ¿Lidero algún grupo que dé este permiso? (el cancionero es de toda la iglesia)
create or replace function public.wf_lidero_alguno(clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ministerios m where m.lider_id = auth.uid() and m.permisos_lider->>clave = 'true')
$$;

-- ¿Lidero un grupo vinculado a algún bloque de este evento que me dé este permiso?
create or replace function public.wf_lidero_en_evento(p_evento uuid, clave text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.items_servicio it join public.ministerios m on m.id = it.ministerio_id
    where it.evento_id = p_evento and it.tipo = 'bloque' and m.lider_id = auth.uid()
      and (clave is null or m.permisos_lider->>clave = 'true')
  )
$$;

-- Editar el Setlist completo de este evento.
create or replace function public.wf_puedo_setlist(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wf_tengo('editar_setlist') or public.wf_controlo_vivo() or public.wf_lidero_en_evento(p_evento, 'editar_setlist')
$$;

-- Armar el equipo de alabanza de este evento.
create or replace function public.wf_puedo_equipo(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wf_puedo_setlist(p_evento) or public.wf_lidero_en_evento(p_evento, 'equipo')
$$;

-- ¿Tengo ALGUNA mano en este evento? (líder de un bloque, encargado de un bloque de lectura...) Solo se
-- usa para tolerar que la app reenvíe el orden de las filas renumerado.
create or replace function public.wf_participo_en_evento(p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.wf_puedo_setlist(p_evento) or public.wf_lidero_en_evento(p_evento, null) or exists (
    select 1 from public.items_servicio b join public.miembros_rol mr on mr.item_servicio_id = b.id
    where b.evento_id = p_evento and mr.usuario_id = auth.uid()
  )
$$;

create or replace function public.wf_puedo_canciones() returns boolean
language sql stable security definer set search_path = public as $$
  select public.wf_tengo('gestionar_canciones') or public.wf_lidero_alguno('gestionar_canciones')
$$;

-- Fila "normalizada" para comparar: sin marcas de tiempo, y "" igual a vacío (la app manda "" donde la
-- base a veces tiene null).
create or replace function public.wf_normalizar(j jsonb, ignorar text[] default '{}') returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from jsonb_each(j - ignorar - 'created_at' - 'updated_at') as e(k, v)
  where v <> 'null'::jsonb and v <> '""'::jsonb
$$;

-- ¿Solo cambiaron (como mucho) estas columnas?
create or replace function public.wf_solo_cambian(viejo jsonb, nuevo jsonb, columnas text[] default '{}') returns boolean
language sql immutable set search_path = public as $$
  select public.wf_normalizar(viejo, columnas) = public.wf_normalizar(nuevo, columnas)
$$;

create or replace function public.wf_sin_permiso(que text) returns void
language plpgsql set search_path = public as $$
begin
  raise exception 'No tienes permiso para %', que using errcode = '42501';
end $$;

-- ---------- Setlist: items_servicio ----------
create or replace function public.wf_permiso_items() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    -- Upsert de una fila que ya existe: lo decide el trigger de UPDATE (compara con la fila real).
    if exists (select 1 from public.items_servicio where id = new.id) then return new; end if;
    if public.wf_puedo_setlist(new.evento_id) then return new; end if;
    -- El encargado de un bloque de Lectura/Oración puede agregar su versículo (canAddBibleReading).
    if new.tipo = 'biblia' and exists (
      select 1 from public.items_servicio b join public.miembros_rol mr on mr.item_servicio_id = b.id
      where b.evento_id = new.evento_id and b.tipo = 'bloque' and b.titulo ~* '(lectura|oraci[oó]n)' and mr.usuario_id = auth.uid()
    ) then return new; end if;
    perform public.wf_sin_permiso('agregar cosas al Setlist de este evento');
  elsif tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    if public.wf_puedo_setlist(old.evento_id) and public.wf_puedo_setlist(new.evento_id) then return new; end if;
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
    perform public.wf_sin_permiso('quitar cosas del Setlist de este evento');
  end if;
  return null;
end $$;
drop trigger if exists wf_permiso_items on public.items_servicio;
create trigger wf_permiso_items before insert or update or delete on public.items_servicio
  for each row execute function public.wf_permiso_items();

-- ---------- Encargados y equipo de alabanza: miembros_rol ----------
create or replace function public.wf_puedo_miembro(p_item uuid, p_rol uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare it record; ev uuid;
begin
  if p_item is not null then
    select evento_id, ministerio_id, tipo into it from public.items_servicio where id = p_item;
    if not found then return true; end if; -- la fila padre ya no existe (borrado en cascada)
    return public.wf_puedo_setlist(it.evento_id) or (it.tipo = 'bloque' and public.wf_lidero(it.ministerio_id));
  end if;
  if p_rol is not null then
    select evento_id into ev from public.roles_evento where id = p_rol;
    if not found then return true; end if;
    return public.wf_puedo_equipo(ev);
  end if;
  return false;
end $$;

create or replace function public.wf_permiso_miembros() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.miembros_rol where id = new.id) then return new; end if;
    if public.wf_puedo_miembro(new.item_servicio_id, new.rol_id) then return new; end if;
    perform public.wf_sin_permiso('asignar personas en este evento');
  elsif tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    -- Cada quien confirma o rechaza SUS propios cargos.
    if old.usuario_id = auth.uid() and new.usuario_id = auth.uid() and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['estado']) then return new; end if;
    if public.wf_puedo_miembro(old.item_servicio_id, old.rol_id) and public.wf_puedo_miembro(new.item_servicio_id, new.rol_id) then return new; end if;
    perform public.wf_sin_permiso('cambiar las personas asignadas en este evento');
  else
    if public.wf_puedo_miembro(old.item_servicio_id, old.rol_id) then return old; end if;
    perform public.wf_sin_permiso('quitar personas asignadas en este evento');
  end if;
  return null;
end $$;
drop trigger if exists wf_permiso_miembros on public.miembros_rol;
create trigger wf_permiso_miembros before insert or update or delete on public.miembros_rol
  for each row execute function public.wf_permiso_miembros();

-- ---------- Roles del equipo de alabanza: roles_evento ----------
create or replace function public.wf_permiso_roles_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from public.roles_evento where id = new.id) then return new; end if;
    if public.wf_puedo_equipo(new.evento_id) then return new; end if;
  elsif tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['orden']) and public.wf_participo_en_evento(old.evento_id) then return new; end if;
    if public.wf_puedo_equipo(old.evento_id) and public.wf_puedo_equipo(new.evento_id) then return new; end if;
  else
    if not exists (select 1 from public.eventos where id = old.evento_id) then return old; end if;
    if public.wf_puedo_equipo(old.evento_id) then return old; end if;
  end if;
  perform public.wf_sin_permiso('cambiar el equipo de alabanza de este evento');
  return null;
end $$;
drop trigger if exists wf_permiso_roles_evento on public.roles_evento;
create trigger wf_permiso_roles_evento before insert or update or delete on public.roles_evento
  for each row execute function public.wf_permiso_roles_evento();

-- ---------- Eventos ----------
create or replace function public.wf_permiso_eventos() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    if public.wf_tengo('gestionar_eventos') then return new; end if;
    -- Ensayo y nota para Alabanza: quien dirige la alabanza de ese evento o quien edita su Setlist.
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['ensayo_fecha', 'ensayo_hora', 'nota_alabanza'])
       and (public.wf_puedo_setlist(old.id) or exists (
         select 1 from public.roles_evento r join public.miembros_rol mr on mr.rol_id = r.id
         where r.evento_id = old.id and mr.usuario_id = auth.uid() and mr.lead
       )) then return new; end if;
    perform public.wf_sin_permiso('cambiar este evento');
  elsif public.wf_tengo('gestionar_eventos') then
    return coalesce(new, old);
  else
    perform public.wf_sin_permiso(case when tg_op = 'INSERT' then 'crear eventos' else 'eliminar eventos' end);
  end if;
  return null;
end $$;
drop trigger if exists wf_permiso_eventos on public.eventos;
create trigger wf_permiso_eventos before insert or update or delete on public.eventos
  for each row execute function public.wf_permiso_eventos();

create or replace function public.wf_permiso_recordatorios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.eventos where id = old.evento_id) then return old; end if;
  if public.wf_tengo('gestionar_eventos') then return coalesce(new, old); end if;
  perform public.wf_sin_permiso('cambiar los recordatorios de este evento');
  return null;
end $$;
drop trigger if exists wf_permiso_recordatorios on public.recordatorios_evento;
create trigger wf_permiso_recordatorios before insert or update or delete on public.recordatorios_evento
  for each row execute function public.wf_permiso_recordatorios();

-- ---------- Cancionero ----------
create or replace function public.wf_permiso_canciones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' then
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
    -- Marcar o desmarcar como favorita: cualquiera.
    if public.wf_solo_cambian(to_jsonb(old), to_jsonb(new), array['favorito']) then return new; end if;
  end if;
  if public.wf_puedo_canciones() then return coalesce(new, old); end if;
  perform public.wf_sin_permiso('cambiar el cancionero');
  return null;
end $$;
drop trigger if exists wf_permiso_canciones on public.canciones;
create trigger wf_permiso_canciones before insert or update or delete on public.canciones
  for each row execute function public.wf_permiso_canciones();

-- Letra, partes y estructura: quien gestiona el cancionero, o quien controla En vivo (corrige letras
-- desde la consola — ver guardarLetraCancion).
create or replace function public.wf_permiso_partes_cancion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.canciones where id = old.cancion_id) then return old; end if;
  if tg_op = 'UPDATE' and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
  if public.wf_puedo_canciones() or public.wf_controlo_vivo() then return coalesce(new, old); end if;
  perform public.wf_sin_permiso('cambiar la letra de esta canción');
  return null;
end $$;
drop trigger if exists wf_permiso_partes_cancion on public.secciones_cancion;
create trigger wf_permiso_partes_cancion before insert or update or delete on public.secciones_cancion
  for each row execute function public.wf_permiso_partes_cancion();
drop trigger if exists wf_permiso_partes_cancion on public.estructura_cancion;
create trigger wf_permiso_partes_cancion before insert or update or delete on public.estructura_cancion
  for each row execute function public.wf_permiso_partes_cancion();
drop trigger if exists wf_permiso_partes_cancion on public.diapositivas_letra;
create trigger wf_permiso_partes_cancion before insert or update or delete on public.diapositivas_letra
  for each row execute function public.wf_permiso_partes_cancion();

-- ---------- Grupos (ministerios) ----------
create or replace function public.wf_permiso_ministerios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
  -- Crear, borrar, renombrar, cambiar líder o lo que puede hacer el líder: solo "Gestionar ministerios".
  if public.wf_tengo('gestionar_ministerios') then return coalesce(new, old); end if;
  perform public.wf_sin_permiso('cambiar los grupos');
  return null;
end $$;
drop trigger if exists wf_permiso_ministerios on public.ministerios;
create trigger wf_permiso_ministerios before insert or update or delete on public.ministerios
  for each row execute function public.wf_permiso_ministerios();

-- Planificación, recursos y resumen del mes: quien gestiona grupos o el líder de ESE grupo.
create or replace function public.wf_permiso_contenido_grupo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.ministerios where id = old.ministerio_id) then return old; end if;
  if tg_op = 'UPDATE' and public.wf_solo_cambian(to_jsonb(old), to_jsonb(new)) then return new; end if;
  if public.wf_tengo('gestionar_ministerios') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if public.wf_lidero(old.ministerio_id) then return old; end if;
  elsif public.wf_lidero(new.ministerio_id) and (tg_op = 'INSERT' or public.wf_lidero(old.ministerio_id)) then
    return new;
  end if;
  perform public.wf_sin_permiso('cambiar la planificación de este grupo');
  return null;
end $$;
drop trigger if exists wf_permiso_contenido_grupo on public.planificacion_ministerio;
create trigger wf_permiso_contenido_grupo before insert or update or delete on public.planificacion_ministerio
  for each row execute function public.wf_permiso_contenido_grupo();
drop trigger if exists wf_permiso_contenido_grupo on public.recursos_ministerio;
create trigger wf_permiso_contenido_grupo before insert or update or delete on public.recursos_ministerio
  for each row execute function public.wf_permiso_contenido_grupo();
drop trigger if exists wf_permiso_contenido_grupo on public.resumen_mensual_ministerio;
create trigger wf_permiso_contenido_grupo before insert or update or delete on public.resumen_mensual_ministerio
  for each row execute function public.wf_permiso_contenido_grupo();

-- Los ayudantes no se llaman desde la API (solo desde estos triggers).
revoke execute on function public.wf_tengo(text), public.wf_controlo_vivo(), public.wf_lidero(uuid, text),
  public.wf_lidero_alguno(text), public.wf_lidero_en_evento(uuid, text), public.wf_puedo_setlist(uuid),
  public.wf_puedo_equipo(uuid), public.wf_participo_en_evento(uuid), public.wf_puedo_canciones(),
  public.wf_puedo_miembro(uuid, uuid) from public, anon, authenticated;
