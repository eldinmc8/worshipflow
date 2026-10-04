-- Biblioteca de fondos (imágenes y videos) para Proyección en vivo — pedido de Eldin, 2026-10-04:
-- que una imagen/video subida una vez quede guardada para volver a usarla sin tener que subirla de
-- nuevo, en vez del patrón anterior (FileReader.readAsDataURL guardando el archivo entero como texto
-- base64 dentro de items_servicio.fondo_imagen_url/fondo_video_url) -- aparte de obligar a resubir
-- cada vez, esa base64 viajaba completa en CADA carga de listEventosCompletos para TODA la iglesia
-- (ver el arreglo de velocidad del mismo día), así que mover esto a Storage real es doblemente mejor.
--
-- Mismo patrón que logos-iglesias (20261001000100_logos_storage.sql), pero acá es una BIBLIOTECA
-- (muchos archivos por iglesia, no uno fijo) y cualquier autenticado de la iglesia puede subir/borrar
-- -- no solo el admin -- porque es material de trabajo para quien esté en el rol Multimedia operando
-- la transmisión, igual que el resto del contenido de un evento (canciones, setlist, etc.).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fondos-en-vivo', 'fondos-en-vivo', true, 41943040, array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm']);

create policy "cualquiera lee fondos en vivo" on storage.objects
  for select
  using (bucket_id = 'fondos-en-vivo');

-- El primer segmento de la ruta ("<iglesia_id>/imagen/..." o ".../video/...") tiene que ser la propia
-- iglesia de quien sube/borra -- mismo candado que logos-iglesias, sin el filtro extra de "solo admin".
create policy "autenticados suben fondos de su iglesia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fondos-en-vivo'
    and (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
  );

create policy "autenticados borran fondos de su iglesia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fondos-en-vivo'
    and (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
  );
