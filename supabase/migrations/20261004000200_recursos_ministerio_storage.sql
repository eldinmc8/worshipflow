-- Adjuntar un ARCHIVO a un recurso de ministerio (ademas de poder pegar un enlace, que sigue
-- funcionando igual) -- pedido de Eldin, 2026-10-04. Mismo patrón que fondos-en-vivo
-- (20261004000000_fondos_en_vivo_storage.sql): bucket público con RLS por iglesia, cualquier
-- autenticado de la iglesia sube/borra lo suyo, sin restringir a solo admin -- es material de trabajo
-- de cada líder de ministerio.
--
-- Sin tabla ni columna nueva: recursos_ministerio.enlace ya es solo una URL de texto -- la URL pública
-- del archivo subido se guarda ahí mismo, funciona exactamente igual que un enlace pegado a mano para
-- todo lo que ya existe (abrir en pestaña nueva, etc.).
--
-- Sin lista de tipos de archivo permitidos (a propósito): un recurso de ministerio puede ser
-- literalmente cualquier cosa -- un PDF de acordes, una pista de audio para practicar, una imagen, una
-- presentación -- a diferencia de fondos-en-vivo (que sí restringe a imagen/video porque se usa
-- directo como fondo de proyección).
insert into storage.buckets (id, name, public, file_size_limit)
values ('recursos-ministerio', 'recursos-ministerio', true, 20971520);

create policy "cualquiera lee recursos de ministerio" on storage.objects
  for select
  using (bucket_id = 'recursos-ministerio');

create policy "autenticados suben recursos de su iglesia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recursos-ministerio'
    and (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
  );

create policy "autenticados borran recursos de su iglesia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recursos-ministerio'
    and (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
  );
