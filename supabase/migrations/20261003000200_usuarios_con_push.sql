-- Para que un administrador pueda ver en Usuarios quién todavía no activó las notificaciones push,
-- sin exponerle el endpoint/llaves de la suscripción de nadie (eso sí es sensible: con eso alguien
-- podría intentar mandarle push falsos a otro dispositivo). push_subscriptions solo deja leer la
-- propia fila ("propias: leer", usuario_id = auth.uid()) -- correcto, no se toca -- así que esto es
-- una función aparte que SOLO devuelve QUÉ usuario_id de la iglesia tienen al menos una suscripción,
-- nunca el contenido de esa suscripción.
--
-- El filtro de autorización va DENTRO del where (no un "if ... raise exception") a propósito: si
-- quien llama no es admin de esa iglesia ni super admin, el resultado es simplemente una tabla
-- vacía, igual que cualquier RLS normal -- no revela con un error si la iglesia existe o no.
create function public.usuarios_con_push(p_iglesia_id uuid)
returns table(usuario_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct ps.usuario_id
  from public.push_subscriptions ps
  join public.usuarios u on u.id = ps.usuario_id
  where u.iglesia_id = p_iglesia_id
    and (
      (p_iglesia_id = public.mi_iglesia_id() and exists (select 1 from public.usuarios yo where yo.id = auth.uid() and yo.rol = 'admin'))
      or public.soy_super_admin()
    );
$$;

revoke all on function public.usuarios_con_push(uuid) from public, anon;
grant execute on function public.usuarios_con_push(uuid) to authenticated;
