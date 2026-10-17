-- Archivos de los adjuntos por canción (ver 20261017000000_adjuntos_cancion.sql).
-- Bucket público (como recursos-ministerio), 20 MB por archivo, solo PDF e imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos-canciones', 'adjuntos-canciones', true, 20971520,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

drop policy if exists "cualquiera lee adjuntos de canciones" on storage.objects;
create policy "cualquiera lee adjuntos de canciones" on storage.objects
  for select using (bucket_id = 'adjuntos-canciones');

drop policy if exists "equipo sube adjuntos de canciones" on storage.objects;
create policy "equipo sube adjuntos de canciones" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adjuntos-canciones'
    and (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
    and public.puedo_nota_equipo()
  );

drop policy if exists "equipo borra adjuntos de canciones" on storage.objects;
create policy "equipo borra adjuntos de canciones" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'adjuntos-canciones'
    and (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
    and public.puedo_nota_equipo()
  );
