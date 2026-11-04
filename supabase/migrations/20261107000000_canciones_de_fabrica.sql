-- Canciones de fábrica (pedido de Eldin, 2026-11-04): toda iglesia nueva arranca con 5 canciones ya
-- listas en su biblioteca, en vez de un cancionero vacío.
--
-- - canciones_de_fabrica: la lista de canciones que se copian. Apunta a las canciones reales de la
--   iglesia Jesús El Buen Pastor, así que si Eldin corrige una letra allá, las iglesias nuevas la reciben
--   ya corregida. Si una de esas canciones se borra, simplemente deja de copiarse.
-- - sembrar_canciones_default(iglesia): copia cada canción de la lista (con sus partes, acordes,
--   diapositivas y estructura) a esa iglesia. Si la iglesia ya tiene una canción con el mismo título, no
--   la duplica. La llama la Edge Function crear-iglesia al dar de alta una iglesia.
-- - Al final, se siembran también las iglesias que ya existen.

create table if not exists public.canciones_de_fabrica (
  cancion_id uuid primary key references public.canciones(id) on delete cascade,
  orden integer not null default 0
);
-- Sin políticas: solo la llave de servicio (y las funciones de abajo) la leen.
alter table public.canciones_de_fabrica enable row level security;

insert into public.canciones_de_fabrica (cancion_id, orden)
select c.id, x.orden
from (values
  ('40278ce6-611e-43ac-8200-1d5c59fd16bb'::uuid, 0), -- Tus Cuerdas De Amor
  ('243393cf-9c73-4b85-b4db-e15fcef7ae5a'::uuid, 1), -- Abres caminos
  ('e08015dc-1e34-48ca-a2a0-cd4a6bc70a51'::uuid, 2), -- Alabaré al Señor mi Dios
  ('835f24ae-59dc-4802-aa6c-afe5486e3e3d'::uuid, 3), -- Te alabaré
  ('fe1dcced-e73d-4f1f-8b86-2762cf3c4a9a'::uuid, 4)  -- Gracia sublime es
) as x(id, orden)
join public.canciones c on c.id = x.id
on conflict (cancion_id) do nothing;

-- Copia las canciones de fábrica a una iglesia. Devuelve cuántas copió.
create or replace function public.sembrar_canciones_default(p_iglesia_id uuid)
returns integer language plpgsql security definer
set search_path = public as $$
declare
  f record;
  v_nueva uuid;
  v_copiadas int := 0;
begin
  for f in
    select c.* from public.canciones_de_fabrica cf
    join public.canciones c on c.id = cf.cancion_id
    where c.iglesia_id is distinct from p_iglesia_id
    order by cf.orden
  loop
    if exists (select 1 from public.canciones
               where iglesia_id = p_iglesia_id and lower(trim(titulo)) = lower(trim(f.titulo))) then
      continue;
    end if;
    v_nueva := gen_random_uuid();
    insert into public.canciones (id, titulo, artista, tonalidad, tempo, temas, categoria, compas, favorito, creado_por, iglesia_id)
    values (v_nueva, trim(f.titulo), f.artista, f.tonalidad, f.tempo, f.temas, f.categoria, f.compas, false, null, p_iglesia_id);
    insert into public.secciones_cancion (cancion_id, clave, etiqueta, distintivo, compases, contenido, iglesia_id)
      select v_nueva, clave, etiqueta, distintivo, compases, contenido, p_iglesia_id
      from public.secciones_cancion where cancion_id = f.id;
    insert into public.diapositivas_letra (cancion_id, seccion_clave, orden_en_seccion, texto, orden, iglesia_id)
      select v_nueva, seccion_clave, orden_en_seccion, texto, orden, p_iglesia_id
      from public.diapositivas_letra where cancion_id = f.id;
    insert into public.estructura_cancion (cancion_id, orden, seccion_clave, multiplicador, iglesia_id)
      select v_nueva, orden, seccion_clave, multiplicador, p_iglesia_id
      from public.estructura_cancion where cancion_id = f.id;
    v_copiadas := v_copiadas + 1;
  end loop;
  return v_copiadas;
end $$;

revoke execute on function public.sembrar_canciones_default(uuid) from public, anon, authenticated;
grant execute on function public.sembrar_canciones_default(uuid) to service_role;

-- Las iglesias que ya existen también reciben las canciones (las que ya tengan, no se repiten).
do $$
declare igl uuid;
begin
  for igl in select id from public.iglesias loop
    perform public.sembrar_canciones_default(igl);
  end loop;
end $$;
