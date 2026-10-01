-- Fase 5+ (libertad de configuración por iglesia): a qué bloque del Setlist se manda cada
-- clasificación de canción (Himno/Corito/Canto especial/Adoración) al agregarla estaba escrito fijo
-- en el código ("Alabanza" para las 4) — una iglesia que organiza su culto distinto (otros nombres
-- de "momentos") no tenía forma de cambiarlo. Default exacto al comportamiento de siempre, así que
-- ninguna iglesia existente ve un cambio hasta que entre a configurarlo.
alter table public.iglesias add column bloques_categoria jsonb not null default
  '{"himno": "Alabanza", "corito": "Alabanza", "especial": "Alabanza", "adoracion": "Alabanza"}'::jsonb;

-- El trigger de la Fase "consola general" (restringir_super_admin_a_solo_activa) lista a mano qué
-- columnas puede tocar un super admin en una iglesia que NO es la suya (solo "activa") — hay que
-- agregar esta columna nueva a esa lista para que la restricción la siga cubriendo también.
create or replace function public.restringir_super_admin_a_solo_activa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.soy_super_admin() and new.id is distinct from public.mi_iglesia_id() then
    if new.nombre is distinct from old.nombre or new.slug is distinct from old.slug
       or new.zona_horaria is distinct from old.zona_horaria or new.logo_url is distinct from old.logo_url
       or new.color_primario is distinct from old.color_primario or new.color_acento is distinct from old.color_acento
       or new.bloques_categoria is distinct from old.bloques_categoria
    then
      raise exception 'Un super administrador solo puede activar o desactivar una iglesia que no es la suya, no editar su contenido.';
    end if;
  end if;
  return new;
end;
$$;
