-- Fase 5: falta la política para que un administrador pueda EDITAR los datos de su propia iglesia
-- (nombre, zona horaria, logo, colores) desde Ajustes → Identidad de la iglesia — hasta ahora
-- `iglesias` solo tenía política de lectura (Fase 2a), nadie podía escribir ahí desde el cliente.
create policy "admins editan su iglesia" on public.iglesias
  for update to authenticated
  using (id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'))
  with check (id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
