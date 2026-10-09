-- Las diapositivas del Setlist pueden tener fondo de IMAGEN (Agregar slide personalizada → Imagen, y la
-- biblioteca de fondos en vivo), pero la restricción original de items_servicio.fondo_tipo solo aceptaba
-- 'color' o 'video' — guardar una diapositiva con fondo de imagen fallaba al sincronizar el Setlist.
-- Encontrado el 2026-10-08 al preparar "Importar presentación" (que NO depende de esto: marca sus
-- páginas en fondo_color, ver src/lib/importarPresentacion.js).
alter table public.items_servicio drop constraint if exists items_servicio_fondo_tipo_check;
alter table public.items_servicio
  add constraint items_servicio_fondo_tipo_check
  check (fondo_tipo = any (array['color'::text, 'video'::text, 'imagen'::text]));
