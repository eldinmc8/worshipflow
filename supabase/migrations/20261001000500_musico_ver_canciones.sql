-- El rol de fábrica "Músico" siempre vio el cancionero, pero por una regla aparte del código
-- (myRole === "Músico"), no por un permiso guardado — en la pantalla de Roles aparecía como si no
-- tuviera ninguno. Se le guarda el permiso explícito para que la pantalla diga la verdad.
update public.roles_app set permisos = permisos || '{"ver_canciones": true}'::jsonb
  where nombre = 'Músico' and not coalesce((permisos->>'ver_canciones')::boolean, false);

-- Y lo mismo para las iglesias nuevas. CREATE OR REPLACE conserva los permisos de ejecución que ya
-- tenía la función (solo el service role, ver 20260930000600).
create or replace function public.sembrar_roles_default(p_iglesia_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.roles_app (iglesia_id, nombre, protegido, permisos, orden) values
    (p_iglesia_id, 'Administrador', true, '{"gestionar_roles":true,"usar_asistente_ia":true,"ver_todos_eventos":true,"gestionar_usuarios":true,"controlar_estilo_vivo":true,"editar_eventos_setlist":true,"iniciar_finalizar_vivo":true}'::jsonb, 0),
    (p_iglesia_id, 'Multimedia', false, '{"controlar_estilo_vivo":true,"iniciar_finalizar_vivo":true}'::jsonb, 1),
    (p_iglesia_id, 'Músico', false, '{"ver_canciones":true}'::jsonb, 2),
    (p_iglesia_id, 'Miembro', false, '{}'::jsonb, 3),
    (p_iglesia_id, 'Supervisor', false, '{"ver_todos_eventos":true}'::jsonb, 4);
$$;
