-- Cierra las 3 tablas que tenían RLS apagado y permisos completos para anon/authenticated — o sea,
-- cualquiera con la clave pública (que viaja dentro de la app) podía leerlas, cambiarlas o borrarlas
-- sin iniciar sesión.

-- asistente_config y recordatorio_notificados: solo las usan Edge Functions con la service role
-- (asistente-chat, procesar-recordatorios), que ignora RLS. RLS encendido sin ninguna política =
-- nadie más puede tocarlas. Además se retiran los permisos de tabla, por si alguien apaga RLS luego.
alter table public.asistente_config enable row level security;
revoke all on public.asistente_config from anon, authenticated;

alter table public.recordatorio_notificados enable row level security;
revoke all on public.recordatorio_notificados from anon, authenticated;

-- roles_app: la app la lee (Ajustes → Roles, Usuarios, cálculo de permisos) y solo un administrador
-- la edita desde Ajustes → Roles.
alter table public.roles_app enable row level security;
revoke all on public.roles_app from anon;

create policy "autenticados leen roles" on public.roles_app
  for select to authenticated
  using (true);

create policy "admins crean roles" on public.roles_app
  for insert to authenticated
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "admins editan roles" on public.roles_app
  for update to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'))
  with check (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

create policy "admins borran roles" on public.roles_app
  for delete to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));
