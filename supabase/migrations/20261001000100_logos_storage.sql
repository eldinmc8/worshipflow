-- Logo de iglesia como ARCHIVO subido (Supabase Storage), no solo un enlace pegado a mano — pedido
-- de Eldin, 2026-10-01. El enlace sigue funcionando igual (iglesias.logo_url es solo texto, no le
-- importa si viene de acá o de otro lado); esto solo agrega una forma más fácil de ponerlo.

-- Bucket público (igual de "sensible" que el logo de Buen Pastor en /logo-iglesia.png, que ya es
-- público hoy) — límite de 2MB, solo imágenes. Una imagen por iglesia, en la ruta
-- "<iglesia_id>/logo.<ext>"; volver a subir SOBRESCRIBE la anterior (mismo nombre de archivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos-iglesias', 'logos-iglesias', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

-- Cualquiera puede LEER (el bucket ya es público, esto es solo explícito para herramientas que sí
-- pasan por RLS en vez del endpoint público directo).
create policy "cualquiera lee logos de iglesias" on storage.objects
  for select
  using (bucket_id = 'logos-iglesias');

-- Solo el administrador de ESA iglesia (o el super admin de la plataforma) puede subir/reemplazar/
-- borrar el logo de ESA iglesia — el primer segmento de la ruta tiene que ser su propio iglesia_id.
create policy "admins suben el logo de su iglesia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos-iglesias'
    and (public.soy_super_admin() or (
      (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
      and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
    ))
  );
create policy "admins reemplazan el logo de su iglesia" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos-iglesias'
    and (public.soy_super_admin() or (
      (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
      and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
    ))
  );
create policy "admins borran el logo de su iglesia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos-iglesias'
    and (public.soy_super_admin() or (
      (storage.foldername(name))[1]::uuid = public.mi_iglesia_id()
      and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
    ))
  );
