-- Clasificaciones de canciones libres por iglesia. Antes eran 4 fijas en el código (Himno, Corito,
-- Canto especial, Adoración) con un CHECK en la base que no dejaba usar otra; la migración anterior
-- (20261001000300) solo dejaba elegir a qué bloque del Setlist iba cada una de esas 4. Ahora cada
-- iglesia define su propia lista (nombre + bloque al que se manda sola la canción), y puede agregar
-- o quitar clasificaciones.
--
-- Formato: [{"clave": "himno", "nombre": "Himno", "bloque": "Alabanza"}, ...]
-- "clave" es lo que se guarda en canciones.categoria — nunca cambia aunque se renombre, así renombrar
-- una clasificación no deja huérfanas a sus canciones.

alter table public.iglesias add column categorias_canciones jsonb;

-- Arrastra lo que cada iglesia ya hubiera configurado en bloques_categoria (si alguien lo tocó).
update public.iglesias set categorias_canciones = jsonb_build_array(
  jsonb_build_object('clave', 'himno', 'nombre', 'Himno', 'bloque', coalesce(bloques_categoria->>'himno', 'Alabanza')),
  jsonb_build_object('clave', 'corito', 'nombre', 'Corito', 'bloque', coalesce(bloques_categoria->>'corito', 'Alabanza')),
  jsonb_build_object('clave', 'especial', 'nombre', 'Canto especial', 'bloque', coalesce(bloques_categoria->>'especial', 'Alabanza')),
  jsonb_build_object('clave', 'adoracion', 'nombre', 'Adoración', 'bloque', coalesce(bloques_categoria->>'adoracion', 'Alabanza'))
);

alter table public.iglesias alter column categorias_canciones set default
  '[{"clave": "himno", "nombre": "Himno", "bloque": "Alabanza"},
    {"clave": "corito", "nombre": "Corito", "bloque": "Alabanza"},
    {"clave": "especial", "nombre": "Canto especial", "bloque": "Alabanza"},
    {"clave": "adoracion", "nombre": "Adoración", "bloque": "Alabanza"}]'::jsonb;
alter table public.iglesias alter column categorias_canciones set not null;
alter table public.iglesias add constraint iglesias_categorias_canciones_es_lista
  check (jsonb_typeof(categorias_canciones) = 'array');

-- bloques_categoria queda absorbida por categorias_canciones y ya no se usa. NO se borra todavía:
-- la versión de la app ya publicada la pide en su select de perfil, y borrarla antes de que Vercel
-- publique la nueva dejaría a todos sin poder entrar. Se puede borrar en una migración posterior.

-- Ya no hay una lista fija de clasificaciones válidas.
alter table public.canciones drop constraint canciones_categoria_check;

-- El trigger de la consola general lista a mano qué columnas NO puede tocar un super admin en una
-- iglesia ajena — se agrega la columna nueva.
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
       or new.categorias_canciones is distinct from old.categorias_canciones
    then
      raise exception 'Un super administrador solo puede activar o desactivar una iglesia que no es la suya, no editar su contenido.';
    end if;
  end if;
  return new;
end;
$$;
