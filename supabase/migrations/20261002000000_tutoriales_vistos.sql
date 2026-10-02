-- Recorrido guiado (tutorial) de bienvenida y mini recorridos por pantalla. Cada clave de
-- tutoriales_vistos es un recorrido que esta persona ya vio o saltó ("bienvenida", "eventos",
-- "evento", "canciones", "envivo"). Vive en la base (no en localStorage) para que no le vuelva a
-- salir al entrar desde otro celular o la computadora.
alter table public.usuarios add column tutoriales_vistos text[] not null default '{}';

-- Quien ya usaba la app antes de esto ya la conoce: se le marcan todos como vistos para que el
-- recorrido salga solo a la gente NUEVA (invitados o el administrador de una iglesia recién creada).
-- Cualquiera puede volver a verlo desde Ajustes > "Ver tutorial de nuevo".
update public.usuarios set tutoriales_vistos = array['bienvenida', 'eventos', 'evento', 'canciones', 'envivo'];

-- Un miembro normal no puede editar su propia fila de usuarios (solo los admins, ver "admins editan
-- todo"), así que marcar/reiniciar pasa por estas dos funciones SECURITY DEFINER: solo tocan esta
-- columna y solo la fila de quien llama (auth.uid()), nunca otra cosa.
create function public.marcar_tutorial_visto(p_clave text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usuarios
     set tutoriales_vistos = array(select distinct unnest(tutoriales_vistos || array[left(p_clave, 40)]))
   where id = auth.uid();
$$;

create function public.reiniciar_tutoriales()
returns void
language sql
security definer
set search_path = public
as $$
  update public.usuarios set tutoriales_vistos = '{}' where id = auth.uid();
$$;

revoke all on function public.marcar_tutorial_visto(text) from public, anon;
revoke all on function public.reiniciar_tutoriales() from public, anon;
grant execute on function public.marcar_tutorial_visto(text) to authenticated;
grant execute on function public.reiniciar_tutoriales() to authenticated;
