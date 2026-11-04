-- "Este bloque es la predicación" (pedido de Eldin, 2026-11-04).
--
-- Antes, la app y la base reconocían el bloque de Predicación SOLO por su nombre ("Predicación",
-- "Prédica", "Sermón", "Mensaje"). Si una iglesia lo llamaba "La Palabra" o "Enseñanza", el predicador
-- no podía armar su bosquejo. Ahora quien arma el Setlist puede marcarlo a mano: la marca viaja en
-- items_servicio.estructura ({"predicacion": true} o {"predicacion": false}), que los bloques no usaban.
-- Si no hay marca, se sigue reconociendo por el nombre (mismo criterio que esBloquePredicacion en la app).
--
-- Solo cambian funciones: no hay tablas ni columnas nuevas. Requiere 20261103000000_bosquejo_predicador.sql.

create or replace function public.wf_es_bloque_predicacion(titulo text, estructura jsonb) returns boolean
language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(estructura) = 'object' and jsonb_typeof(estructura->'predicacion') = 'boolean'
      then (estructura->>'predicacion')::boolean
    else public.wf_es_titulo_predicacion(titulo)
  end
$$;

-- ¿Estoy asignado a este bloque de Predicación de este evento?
create or replace function public.wf_predico(p_bloque text, p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_bloque is not null and exists (
    select 1 from public.items_servicio b join public.miembros_rol mr on mr.item_servicio_id = b.id
    where b.id::text = p_bloque and b.evento_id = p_evento and b.tipo = 'bloque'
      and public.wf_es_bloque_predicacion(b.titulo, b.estructura) and mr.usuario_id = auth.uid()
  )
$$;
revoke execute on function public.wf_predico(text, uuid) from public, anon, authenticated;

-- ¿Puedo escribir el bosquejo de este bloque? El predicador asignado, o quien edita el Setlist completo.
create or replace function public.wf_puedo_bosquejo(p_item uuid, p_evento uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.items_servicio b
    where b.id = p_item and b.evento_id = p_evento and b.tipo = 'bloque'
      and public.wf_es_bloque_predicacion(b.titulo, b.estructura)
  ) and (public.wf_predico(p_item::text, p_evento) or public.wf_puedo_setlist(p_evento))
$$;
revoke execute on function public.wf_puedo_bosquejo(uuid, uuid) from public, anon;
grant execute on function public.wf_puedo_bosquejo(uuid, uuid) to authenticated;
