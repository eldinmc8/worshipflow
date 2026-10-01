-- Fase 2b (multi-iglesia, código): sesiones_en_vivo y musico_en_vivo dejan de ser una fila fija
-- "id = 1" (una sola transmisión/Modo Músico para TODA la base) y pasan a ser una fila por iglesia,
-- usando iglesia_id (agregado en la Fase 2a) como llave. Sigue habiendo como mucho UNA transmisión en
-- vivo a la vez — pero por iglesia, que es lo que CLAUDE.md siempre dijo que debía ser.
--
-- RLS no cambia aquí (sigue siendo la Fase 2c): estas políticas ya eran "cualquiera puede leer/
-- escribir" (sesiones_en_vivo) o "cualquiera autenticado" (musico_en_vivo) y lo siguen siendo; lo que
-- cambia es que el cliente ahora pide/filtra explícitamente por SU iglesia_id en vez de por "id=1".

alter table public.sesiones_en_vivo drop constraint sesiones_en_vivo_pkey;
alter table public.sesiones_en_vivo drop constraint sesiones_en_vivo_id_check;
alter table public.sesiones_en_vivo drop column id;
alter table public.sesiones_en_vivo add constraint sesiones_en_vivo_pkey primary key (iglesia_id);

alter table public.musico_en_vivo drop constraint musico_en_vivo_pkey;
alter table public.musico_en_vivo drop constraint musico_en_vivo_single_row;
alter table public.musico_en_vivo drop column id;
alter table public.musico_en_vivo add constraint musico_en_vivo_pkey primary key (iglesia_id);

-- Resuelve el slug de la URL de Proyección (?screen=publico&igl=<slug>) a un iglesia_id. Esa pantalla
-- no tiene sesión iniciada (es la que ve la congregación, anclada a una URL fija), así que no puede
-- apoyarse en auth.uid()/mi_iglesia_id() — necesita este camino aparte, ejecutable por "anon". No
-- filtra nada sensible: un slug es público por diseño (va en la URL que cualquiera con el proyector
-- puede ver) y lo único que devuelve es un id.
create function public.iglesia_id_por_slug(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.iglesias where slug = p_slug;
$$;
grant execute on function public.iglesia_id_por_slug(text) to anon, authenticated;

-- Respaldo para una pantalla de Proyección instalada ANTES de este cambio (URL vieja sin ?igl=) o
-- cualquier otro caso sin slug: usa la iglesia más antigua. Correcto mientras exista una sola iglesia;
-- cuando haya una segunda, esas pantallas viejas necesitan reinstalarse con la URL nueva (que ya trae
-- su slug) para apuntar a la iglesia correcta.
create function public.iglesia_id_por_defecto()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.iglesias order by created_at limit 1;
$$;
grant execute on function public.iglesia_id_por_defecto() to anon, authenticated;
