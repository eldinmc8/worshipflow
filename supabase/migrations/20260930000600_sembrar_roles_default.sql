-- Fase 4 (alta de iglesias nuevas): los 5 roles de fábrica (Administrador/Multimedia/Músico/
-- Miembro/Supervisor) solo se crearon una vez, a mano, en la migración 20260930000000 para la
-- iglesia de Eldin — no había forma de repetirlo para una iglesia nueva. Esta función hace
-- exactamente esa misma siembra para cualquier iglesia_id; la llama crear-iglesia (Edge Function)
-- justo después de crear cada iglesia nueva.
create function public.sembrar_roles_default(p_iglesia_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.roles_app (iglesia_id, nombre, protegido, permisos, orden) values
    (p_iglesia_id, 'Administrador', true, '{"gestionar_roles":true,"usar_asistente_ia":true,"ver_todos_eventos":true,"gestionar_usuarios":true,"controlar_estilo_vivo":true,"editar_eventos_setlist":true,"iniciar_finalizar_vivo":true}'::jsonb, 0),
    (p_iglesia_id, 'Multimedia', false, '{"controlar_estilo_vivo":true,"iniciar_finalizar_vivo":true}'::jsonb, 1),
    (p_iglesia_id, 'Músico', false, '{}'::jsonb, 2),
    (p_iglesia_id, 'Miembro', false, '{}'::jsonb, 3),
    (p_iglesia_id, 'Supervisor', false, '{"ver_todos_eventos":true}'::jsonb, 4);
$$;
-- Ejecutable solo por el service role (Edge Functions) — nunca por un usuario normal ni por anon,
-- que no tienen por qué poder sembrarle roles a una iglesia que no es la suya. OJO: en este proyecto
-- Supabase ya tiene configurado un ALTER DEFAULT PRIVILEGES que le da EXECUTE a anon/authenticated/
-- service_role en CUALQUIER función nueva de public, automáticamente, por fuera del rol "public" —
-- por eso "revoke all ... from public" NO alcanza (se comprobó directo en producción: la primera
-- versión de esta migración dejaba la función ejecutable por anon igual). Hay que nombrar los roles.
revoke execute on function public.sembrar_roles_default(uuid) from anon, authenticated;
