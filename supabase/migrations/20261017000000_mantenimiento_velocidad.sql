-- Mantenimiento: velocidad, limpieza y permisos (17 oct 2026)

-- 1) Índices para las relaciones que no tenían
create index if not exists adjuntos_cancion_iglesia_id_fk_idx on public.adjuntos_cancion (iglesia_id);
create index if not exists asignaciones_vistas_usuario_id_idx on public.asignaciones_vistas (usuario_id);
create index if not exists asistente_config_actualizado_por_idx on public.asistente_config (actualizado_por);
create index if not exists avisos_confirmacion_enviados_usuario_id_idx on public.avisos_confirmacion_enviados (usuario_id);
create index if not exists canciones_creado_por_idx on public.canciones (creado_por);
create index if not exists diapositivas_letra_cancion_id_idx on public.diapositivas_letra (cancion_id);
create index if not exists estructura_cancion_cancion_id_idx on public.estructura_cancion (cancion_id);
create index if not exists eventos_creado_por_idx on public.eventos (creado_por);
create index if not exists items_servicio_cancion_id_idx on public.items_servicio (cancion_id);
create index if not exists items_servicio_evento_id_idx on public.items_servicio (evento_id);
create index if not exists items_servicio_ministerio_id_idx on public.items_servicio (ministerio_id);
create index if not exists miembros_rol_item_servicio_id_idx on public.miembros_rol (item_servicio_id);
create index if not exists miembros_rol_rol_id_idx on public.miembros_rol (rol_id);
create index if not exists miembros_rol_usuario_id_idx on public.miembros_rol (usuario_id);
create index if not exists ministerios_creado_por_idx on public.ministerios (creado_por);
create index if not exists ministerios_lider_id_idx on public.ministerios (lider_id);
create index if not exists notas_seccion_iglesia_id_idx on public.notas_seccion (iglesia_id);
create index if not exists notificaciones_evento_id_idx on public.notificaciones (evento_id);
create index if not exists planificacion_ministerio_ministerio_id_idx on public.planificacion_ministerio (ministerio_id);
create index if not exists recursos_ministerio_ministerio_id_idx on public.recursos_ministerio (ministerio_id);
create index if not exists roles_evento_evento_id_idx on public.roles_evento (evento_id);
create index if not exists sesiones_en_vivo_evento_id_idx on public.sesiones_en_vivo (evento_id);
create index if not exists sesiones_en_vivo_liderado_por_idx on public.sesiones_en_vivo (liderado_por);
create index if not exists usuarios_rol_id_idx on public.usuarios (rol_id);

-- 2) Reglas de acceso: calcular el usuario una sola vez por consulta (mismo resultado, más rápido)
alter policy "asignaciones_vistas_insert" on public.asignaciones_vistas
  with check ((usuario_id = (select auth.uid())) and (iglesia_id = mi_iglesia_id()) and exists (
    select 1 from eventos e where e.id = asignaciones_vistas.evento_id and e.iglesia_id = mi_iglesia_id()));
alter policy "asignaciones_vistas_update" on public.asignaciones_vistas
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

alter policy "admins editan su iglesia" on public.iglesias
  using (soy_super_admin() or ((id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin')))
  with check (soy_super_admin() or ((id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin')));

alter policy "propias: leer" on public.notificaciones using (usuario_id = (select auth.uid()));
alter policy "propias: marcar leida" on public.notificaciones
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

alter policy "propias: borrar" on public.push_subscriptions using (usuario_id = (select auth.uid()));
alter policy "propias: insertar" on public.push_subscriptions with check (usuario_id = (select auth.uid()));
alter policy "propias: leer" on public.push_subscriptions using (usuario_id = (select auth.uid()));

alter policy "admins borran roles" on public.roles_app
  using ((iglesia_id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin'));
alter policy "admins crean roles" on public.roles_app
  with check ((iglesia_id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin'));
alter policy "admins editan roles" on public.roles_app
  using ((iglesia_id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin'))
  with check ((iglesia_id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin'));

alter policy "admins editan todo" on public.usuarios
  using ((iglesia_id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin'))
  with check ((iglesia_id = mi_iglesia_id()) and exists (
    select 1 from usuarios u where u.id = (select auth.uid()) and u.rol = 'admin')
    and ((rol_id is null) or exists (
      select 1 from roles_app r where r.id = usuarios.rol_id and r.iglesia_id = mi_iglesia_id())));
-- "ver propio usuario" se queda con auth.uid() directo A PROPÓSITO: con (select auth.uid()) Postgres
-- detecta "infinite recursion" en las políticas de usuarios al editar un usuario (pasó en producción el
-- 2026-10-18 y se corrigió de inmediato; lo cubre src/lib/__tests__/aislamientoFk.test.js).

-- Notas: la regla de "escribir" ya no se mezcla con la de "ver" (mismos permisos, más rápido)
alter policy "ver notas" on public.notas_seccion
  using ((iglesia_id = mi_iglesia_id()) and ((dueno_id = '00000000-0000-0000-0000-000000000000'::uuid)
    or (dueno_id = (select auth.uid()))));
drop policy if exists "escribir notas" on public.notas_seccion;
drop policy if exists "crear notas" on public.notas_seccion;
drop policy if exists "editar notas" on public.notas_seccion;
drop policy if exists "borrar notas" on public.notas_seccion;
create policy "crear notas" on public.notas_seccion for insert to authenticated
  with check ((iglesia_id = mi_iglesia_id()) and ((dueno_id = (select auth.uid()))
    or ((dueno_id = '00000000-0000-0000-0000-000000000000'::uuid) and puedo_nota_equipo())));
create policy "editar notas" on public.notas_seccion for update to authenticated
  using ((iglesia_id = mi_iglesia_id()) and ((dueno_id = (select auth.uid()))
    or ((dueno_id = '00000000-0000-0000-0000-000000000000'::uuid) and puedo_nota_equipo())))
  with check ((iglesia_id = mi_iglesia_id()) and ((dueno_id = (select auth.uid()))
    or ((dueno_id = '00000000-0000-0000-0000-000000000000'::uuid) and puedo_nota_equipo())));
create policy "borrar notas" on public.notas_seccion for delete to authenticated
  using ((iglesia_id = mi_iglesia_id()) and ((dueno_id = (select auth.uid()))
    or ((dueno_id = '00000000-0000-0000-0000-000000000000'::uuid) and puedo_nota_equipo())));

-- 3) Limpieza: respaldos del 5 de octubre que ya no se usan
drop table if exists public._backup_diapositivas_letra_20261005;
drop table if exists public._backup_secciones_cancion_20261005;

-- 4) Permisos: la función del disparador de iglesias no necesita llamarse desde afuera
revoke execute on function public.restringir_super_admin_a_solo_activa() from anon, authenticated, public;
