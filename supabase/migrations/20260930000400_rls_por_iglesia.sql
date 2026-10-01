-- Fase 2c (multi-iglesia, seguridad): hasta ahora, CUALQUIER usuario autenticado podía leer y editar
-- los datos de TODAS las iglesias (las políticas solo chequeaban "¿tiene sesión iniciada?", nunca "¿es
-- SU iglesia?"). Sin riesgo real mientras existió una sola iglesia — a partir de esta migración, cada
-- política exige además iglesia_id = mi_iglesia_id() (ver función, creada en la Fase 2a).
--
-- OJO al leer esto — una trampa real que evitar: mi_iglesia_id() cae a "la iglesia más antigua" si
-- auth.uid() es null (pensado para que los defaults de columna sigan funcionando llamados desde una
-- Edge Function con la service role, que no trae auth.uid()). Un visitante SIN sesión (rol "anon")
-- TAMBIÉN tiene auth.uid() null — así que una política que use mi_iglesia_id() y acepte el rol "anon"
-- le abriría sin querer los datos de esa iglesia más antigua a cualquiera en internet. Por eso TODA
-- política de acá que usa mi_iglesia_id() se restringe explícitamente a "to authenticated", nunca a
-- "to public"/anon — incluida la conversión de varias políticas que hoy dicen "to public" pero en la
-- práctica ya exigían auth.role()='authenticated' adentro (incluir anon ahí nunca tuvo sentido, pero
-- antes era inofensivo porque la condición vieja no dependía de si existía o no el usuario).
--
-- Excepción a propósito: la lectura de sesiones_en_vivo sigue abierta a cualquiera, sin iglesia_id en
-- la condición — la pantalla de Proyección (PublicScreen.jsx) no tiene sesión iniciada y pide la fila
-- de SU iglesia explícitamente (resuelta por slug, ver Fase 2b); no hay nada sensible en esa fila.

-- ============== Tablas simples: una fila le pertenece a una iglesia, punto ==============
do $$
declare
  t text;
begin
  foreach t in array array[
    'canciones', 'secciones_cancion', 'diapositivas_letra', 'estructura_cancion',
    'eventos', 'items_servicio', 'roles_evento', 'miembros_rol',
    'ministerios', 'planificacion_ministerio', 'recursos_ministerio', 'recordatorios_evento'
  ] loop
    execute format(
      'alter policy %I on public.%I to authenticated using (iglesia_id = public.mi_iglesia_id()) with check (iglesia_id = public.mi_iglesia_id())',
      'autenticados: todo en ' || t, t
    );
  end loop;
end $$;

-- ============== usuarios ==============
-- "ver propio usuario" no usa mi_iglesia_id() (compara auth.uid() contra la propia fila) — sigue
-- igual, no hace falta tocarla.
alter policy "autenticados ven todos los usuarios" on public.usuarios
  to authenticated
  using (iglesia_id = public.mi_iglesia_id());

-- Antes dejaba a un admin editar CUALQUIER usuario de CUALQUIER iglesia. iglesia_id = mi_iglesia_id()
-- en el USING limita qué filas puede tocar; en el WITH CHECK impide además que el resultado de la
-- edición cambie la fila a otra iglesia (no puede "robarse" a alguien de otra iglesia reasignándolo).
alter policy "admins editan todo" on public.usuarios
  to authenticated
  using (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'))
  with check (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

-- ============== roles_app ==============
alter policy "autenticados leen roles" on public.roles_app
  using (iglesia_id = public.mi_iglesia_id());

alter policy "admins crean roles" on public.roles_app
  with check (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

alter policy "admins editan roles" on public.roles_app
  using (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'))
  with check (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

alter policy "admins borran roles" on public.roles_app
  using (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'));

-- ============== sesiones_en_vivo ==============
-- La SELECT ("cualquiera lee la sesión en vivo") NO se toca — ver nota arriba, es la pantalla de
-- Proyección sin sesión iniciada. Solo se cierran INSERT/UPDATE a "mi propia iglesia".
alter policy "autenticados escriben la sesión en vivo" on public.sesiones_en_vivo
  to authenticated
  with check (iglesia_id = public.mi_iglesia_id());

alter policy "autenticados actualizan la sesión en vivo" on public.sesiones_en_vivo
  to authenticated
  using (iglesia_id = public.mi_iglesia_id())
  with check (iglesia_id = public.mi_iglesia_id());

-- ============== musico_en_vivo ==============
alter policy musico_en_vivo_select on public.musico_en_vivo
  using (iglesia_id = public.mi_iglesia_id());

alter policy musico_en_vivo_update on public.musico_en_vivo
  using (iglesia_id = public.mi_iglesia_id())
  with check (iglesia_id = public.mi_iglesia_id());

-- Agujero real que esta migración también tapa: musico_en_vivo nunca tuvo política de INSERT. Para
-- la iglesia de hoy no se notaba (su fila ya existía desde antes de que RLS exigiera esto) — pero
-- updateMusicoLive() hace upsert, y la primera vez que una iglesia NUEVA use Modo Músico, ese upsert
-- necesita poder insertar su fila inicial.
create policy musico_en_vivo_insert on public.musico_en_vivo
  for insert to authenticated
  with check (iglesia_id = public.mi_iglesia_id());

-- ============== Lectura "quién vio/confirmó qué" (antes abierta a cualquier autenticado, de
-- cualquier iglesia) ==============
alter policy asignaciones_vistas_select on public.asignaciones_vistas
  using (iglesia_id = public.mi_iglesia_id());

alter policy avisos_confirmacion_select on public.avisos_confirmacion_enviados
  using (iglesia_id = public.mi_iglesia_id());
