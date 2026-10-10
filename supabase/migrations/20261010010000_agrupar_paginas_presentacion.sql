-- Presentaciones agrupadas (pedido de Eldin, 2026-10-10): una presentación importada (PDF/imágenes)
-- ahora es UN solo elemento del orden del culto, con sus páginas en estructura.diapositivas (igual que
-- una canción tiene sus diapositivas adentro). Esto junta las páginas que ya se habían importado como
-- elementos sueltos ("Bienvenida (1/5)", "Bienvenida (2/5)"...): las seguidas con el mismo nombre
-- quedan en la primera, y las demás filas se borran.
do $$
declare
  ev record;
  it record;
  base text;
  grupo_base text;
  grupo_id uuid;
  grupo_ids uuid[];
  grupo_diaps jsonb;
  es_pagina boolean;
begin
  if to_regclass('public.items_servicio') is null then return; end if;
  for ev in select distinct evento_id from public.items_servicio where tipo = 'slide' and fondo_color = 'presentacion' loop
    grupo_id := null; grupo_ids := '{}'; grupo_diaps := '[]'::jsonb; grupo_base := null;
    for it in
      select id, titulo, fondo_imagen_url, tipo, fondo_color, estructura
      from public.items_servicio where evento_id = ev.evento_id order by orden, id
    loop
      es_pagina := it.tipo = 'slide' and it.fondo_color = 'presentacion' and coalesce(it.fondo_imagen_url, '') <> ''
        and jsonb_typeof(coalesce(it.estructura, '[]'::jsonb)) = 'array'
        and coalesce(it.titulo, '') ~ '\(\d+/\d+\)\s*$';
      base := case when es_pagina then trim(regexp_replace(it.titulo, '\s*\(\d+/\d+\)\s*$', '')) else null end;
      if es_pagina and grupo_id is not null and base = grupo_base then
        grupo_ids := grupo_ids || it.id;
        grupo_diaps := grupo_diaps || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'fondo', jsonb_build_object('tipo', 'imagen', 'url', it.fondo_imagen_url, 'color', '#000000', 'ajuste', 'contain'), 'capas', '[]'::jsonb));
        continue;
      end if;
      -- Se cierra el grupo anterior (solo si juntó más de una página).
      if grupo_id is not null and array_length(grupo_ids, 1) > 0 then
        update public.items_servicio set titulo = grupo_base, estructura = jsonb_build_object('diapositivas', grupo_diaps) where id = grupo_id;
        delete from public.items_servicio where id = any(grupo_ids);
      end if;
      grupo_id := null; grupo_ids := '{}'; grupo_diaps := '[]'::jsonb; grupo_base := null;
      if es_pagina then
        grupo_id := it.id; grupo_base := base;
        grupo_diaps := jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'fondo', jsonb_build_object('tipo', 'imagen', 'url', it.fondo_imagen_url, 'color', '#000000', 'ajuste', 'contain'), 'capas', '[]'::jsonb));
      end if;
    end loop;
    if grupo_id is not null and array_length(grupo_ids, 1) > 0 then
      update public.items_servicio set titulo = grupo_base, estructura = jsonb_build_object('diapositivas', grupo_diaps) where id = grupo_id;
      delete from public.items_servicio where id = any(grupo_ids);
    end if;
  end loop;
end $$;
