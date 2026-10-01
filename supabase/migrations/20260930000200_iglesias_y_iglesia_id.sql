-- Fase 2a (multi-iglesia): tabla `iglesias` + columna `iglesia_id` en todos los datos de una iglesia.
--
-- Invisible para la app actual: todo lo existente queda asignado a la iglesia #1 (Jesús El Buen
-- Pastor) y cada inserción nueva toma su iglesia_id SOLA vía el default mi_iglesia_id(), así que
-- ningún insert del frontend ni de las Edge Functions necesita cambiar todavía. Las políticas RLS NO
-- cambian aquí (eso es la Fase 2c) — hoy todavía nada filtra por iglesia_id.
--
-- Orden importante: las columnas van ANTES que mi_iglesia_id() (una función SQL se valida al crearla
-- y lee usuarios.iglesia_id), y los defaults DESPUÉS (apuntan a esa función).

create table public.iglesias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  -- Zona horaria IANA. "Etc/GMT+6" = UTC-6 fijo sin horario de verano (el signo de Etc/ va invertido).
  zona_horaria text not null default 'Etc/GMT+6',
  created_at timestamptz not null default now()
);

insert into public.iglesias (nombre, slug, zona_horaria)
values ('Iglesia Jesús El Buen Pastor', 'buen-pastor', 'Etc/GMT+6');

-- 1) iglesia_id en cada tabla con datos de una iglesia, con todo lo existente asignado a la #1.
-- Quedan fuera push_subscriptions y recordatorio_notificados: pertenecen a un usuario / a un
-- recordatorio, no a una iglesia directamente.
do $$
declare
  t text;
  iglesia1 uuid := (select id from public.iglesias where slug = 'buen-pastor');
begin
  foreach t in array array[
    'usuarios', 'roles_app', 'asistente_config',
    'canciones', 'secciones_cancion', 'diapositivas_letra', 'estructura_cancion',
    'eventos', 'items_servicio', 'roles_evento', 'miembros_rol',
    'asignaciones_vistas', 'avisos_confirmacion_enviados', 'recordatorios_evento', 'notificaciones',
    'ministerios', 'planificacion_ministerio', 'recursos_ministerio',
    'sesiones_en_vivo', 'musico_en_vivo'
  ] loop
    execute format('alter table public.%I add column iglesia_id uuid', t);
    execute format('update public.%I set iglesia_id = %L', t, iglesia1);
    execute format('alter table public.%I alter column iglesia_id set not null', t);
    execute format('alter table public.%I add constraint %I foreign key (iglesia_id) references public.iglesias(id) on delete cascade', t, t || '_iglesia_id_fkey');
    execute format('create index %I on public.%I (iglesia_id)', t || '_iglesia_id_idx', t);
  end loop;
end $$;

-- 2) La iglesia del usuario que hace la consulta. SECURITY DEFINER para poder leer usuarios sin
-- depender de sus políticas (y sin recursión cuando se use dentro de ellas en la Fase 2c).
-- TEMPORAL: si no hay usuario (Edge Functions con service role, que no traen auth.uid()) cae a la
-- iglesia #1. Mientras haya una sola iglesia es exacto; en la Fase 2b las Edge Functions pasan
-- iglesia_id explícito y este respaldo se quita.
create function public.mi_iglesia_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.iglesia_id from public.usuarios u where u.id = auth.uid()),
    (select i.id from public.iglesias i order by i.created_at limit 1)
  );
$$;

-- 3) Cada inserción nueva toma la iglesia de quien inserta.
do $$
declare
  t text;
begin
  foreach t in array array[
    'usuarios', 'roles_app', 'asistente_config',
    'canciones', 'secciones_cancion', 'diapositivas_letra', 'estructura_cancion',
    'eventos', 'items_servicio', 'roles_evento', 'miembros_rol',
    'asignaciones_vistas', 'avisos_confirmacion_enviados', 'recordatorios_evento', 'notificaciones',
    'ministerios', 'planificacion_ministerio', 'recursos_ministerio',
    'sesiones_en_vivo', 'musico_en_vivo'
  ] loop
    execute format('alter table public.%I alter column iglesia_id set default public.mi_iglesia_id()', t);
  end loop;
end $$;

alter table public.iglesias enable row level security;
create policy "ver mi iglesia" on public.iglesias
  for select to authenticated
  using (id = public.mi_iglesia_id());
