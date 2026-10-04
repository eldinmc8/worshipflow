-- Blindaje multi-iglesia, parte 2: cada política de "autenticados: todo en X" (ver
-- 20260930000400_rls_por_iglesia.sql) exige que la fila NUEVA declare iglesia_id = mi_iglesia_id(),
-- pero ninguna revisaba que las referencias (evento_id, cancion_id, ministerio_id, rol_id,
-- item_servicio_id, usuario_id, lider_id...) apunten a una fila que TAMBIÉN sea de esa misma
-- iglesia. Un administrador podía insertar una fila que dice "soy de mi iglesia" pero cuelga de un
-- evento/canción/ministerio de OTRA iglesia -- nadie de la otra iglesia la ve nunca (su propia RLS
-- de lectura la sigue bloqueando), pero queda una fila huérfana que puede desaparecer sola si la otra
-- iglesia borra lo suyo (ON DELETE CASCADE), con el riesgo creciendo según crezca la plataforma a
-- varias iglesias. Encontrado 2026-10-03 escribiendo las pruebas de aislamiento, cerrado el mismo día
-- a pedido de Eldin (está por ofrecer el servicio a otras iglesias).
--
-- Mismo criterio en todas: el WITH CHECK ahora exige, además de "la fila es mía", "lo que esta fila
-- señala también es mío". El USING (qué filas se pueden VER/tocar) no cambia -- ya filtraba bien por
-- la iglesia de la propia fila; el hueco estaba solo en qué CONTENIDO se aceptaba al escribir.

-- ===== Canciones: letra/acordes/estructura cuelgan de una canción =====
alter policy "autenticados: todo en secciones_cancion" on public.secciones_cancion
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.canciones c where c.id = cancion_id and c.iglesia_id = public.mi_iglesia_id())
  );

alter policy "autenticados: todo en diapositivas_letra" on public.diapositivas_letra
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.canciones c where c.id = cancion_id and c.iglesia_id = public.mi_iglesia_id())
  );

alter policy "autenticados: todo en estructura_cancion" on public.estructura_cancion
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.canciones c where c.id = cancion_id and c.iglesia_id = public.mi_iglesia_id())
  );

-- ===== Setlist: items/roles/encargados/recordatorios cuelgan de un evento =====
alter policy "autenticados: todo en items_servicio" on public.items_servicio
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.eventos e where e.id = evento_id and e.iglesia_id = public.mi_iglesia_id())
    and (ministerio_id is null or exists (select 1 from public.ministerios m where m.id = ministerio_id and m.iglesia_id = public.mi_iglesia_id()))
  );

alter policy "autenticados: todo en roles_evento" on public.roles_evento
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.eventos e where e.id = evento_id and e.iglesia_id = public.mi_iglesia_id())
  );

-- miembros_rol: encargado de un ítem del Setlist (item_servicio_id) O de un rol del equipo de
-- alabanza (rol_id) -- nunca los dos a la vez, pero ambos son opcionales en la columna. usuario_id
-- también opcional (un encargado puede ser solo un nombre suelto, sin cuenta en la app) -- cuando SÍ
-- apunta a alguien, esa persona también debe ser de la misma iglesia.
alter policy "autenticados: todo en miembros_rol" on public.miembros_rol
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and (rol_id is null or exists (select 1 from public.roles_evento r where r.id = rol_id and r.iglesia_id = public.mi_iglesia_id()))
    and (item_servicio_id is null or exists (select 1 from public.items_servicio i where i.id = item_servicio_id and i.iglesia_id = public.mi_iglesia_id()))
    and (usuario_id is null or exists (select 1 from public.usuarios u where u.id = usuario_id and u.iglesia_id = public.mi_iglesia_id()))
  );

alter policy "autenticados: todo en recordatorios_evento" on public.recordatorios_evento
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.eventos e where e.id = evento_id and e.iglesia_id = public.mi_iglesia_id())
  );

-- ===== Ministerios: planificación/recursos cuelgan de un ministerio; el ministerio de un líder =====
alter policy "autenticados: todo en planificacion_ministerio" on public.planificacion_ministerio
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.ministerios m where m.id = ministerio_id and m.iglesia_id = public.mi_iglesia_id())
  );

alter policy "autenticados: todo en recursos_ministerio" on public.recursos_ministerio
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.ministerios m where m.id = ministerio_id and m.iglesia_id = public.mi_iglesia_id())
  );

alter policy "autenticados: todo en ministerios" on public.ministerios
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and (lider_id is null or exists (select 1 from public.usuarios u where u.id = lider_id and u.iglesia_id = public.mi_iglesia_id()))
  );

-- ===== asignaciones_vistas: "ya vi mi asignación" en un evento =====
-- Antes el WITH CHECK solo exigía usuario_id = auth.uid() -- ni siquiera revisaba iglesia_id de la
-- propia fila (confiaba en el default de la columna, que un insert normal de PostgREST sí puede
-- pisar mandando iglesia_id explícito), mucho menos que el evento fuera de esa iglesia.
alter policy "asignaciones_vistas_insert" on public.asignaciones_vistas
  to authenticated
  with check (
    usuario_id = auth.uid()
    and iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.eventos e where e.id = evento_id and e.iglesia_id = public.mi_iglesia_id())
  );

-- ===== sesiones_en_vivo: evento_id es opcional (null = "transmisión libre", sin evento) =====
alter policy "autenticados escriben la sesión en vivo" on public.sesiones_en_vivo
  to authenticated
  with check (
    iglesia_id = public.mi_iglesia_id()
    and (evento_id is null or exists (select 1 from public.eventos e where e.id = evento_id and e.iglesia_id = public.mi_iglesia_id()))
  );

alter policy "autenticados actualizan la sesión en vivo" on public.sesiones_en_vivo
  to authenticated
  with check (
    public.soy_super_admin() or (
      iglesia_id = public.mi_iglesia_id()
      and (evento_id is null or exists (select 1 from public.eventos e where e.id = evento_id and e.iglesia_id = public.mi_iglesia_id()))
    )
  );

-- ===== usuarios: un admin no debe poder asignarle a alguien de su iglesia el rol_id (roles_app) de
-- otra iglesia =====
alter policy "admins editan todo" on public.usuarios
  to authenticated
  using (iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin'))
  with check (
    iglesia_id = public.mi_iglesia_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
    and (rol_id is null or exists (select 1 from public.roles_app r where r.id = rol_id and r.iglesia_id = public.mi_iglesia_id()))
  );
