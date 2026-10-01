-- Consola general de WorshipFlow (super administrador de la PLATAFORMA, no de una iglesia) — panorama
-- de todas las iglesias + 4 acciones de soporte puntuales, nada de ver canciones/eventos/mensajes de
-- nadie. Ver src/PlataformaAdmin.jsx para la pantalla.
--
-- OJO al leer esto — algo que probé en una base local antes de tocar producción y que cambió el
-- diseño: dos políticas PERMISIVAS separadas para el mismo UPDATE, una verdadera para el que escribe
-- y la otra falsa, NO se combinaron con OR como debían (una fila que sí debía poder actualizarse por
-- la primera política terminaba con 0 filas afectadas). Por eso acá, en vez de una política nueva
-- aparte para "UPDATE de super admin", se AMPLÍA la política existente con "OR soy_super_admin()" en
-- la MISMA política — así nunca depende de que dos políticas se combinen bien entre sí.

-- ============== Quién es super administrador ==============
-- Tabla aparte (no una columna en usuarios) a propósito: usuarios ya tiene políticas que dejan a un
-- admin de iglesia editar su propia fila y las de su equipo — si esto fuera una columna ahí, habría
-- que blindar con cuidado que nadie se la pueda poner a sí mismo. Así, en cambio, NINGUNA política le
-- da a ningún cliente (ni siquiera a un super admin) permiso de leer o escribir esta tabla — solo se
-- toca a mano por SQL (como ahora) o desde una Edge Function con la service role.
create table public.super_admins (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade
);
alter table public.super_admins enable row level security;
revoke all on public.super_admins from anon, authenticated;

-- Única forma de preguntar "¿el usuario actual es super admin?" desde una política RLS — igual que
-- mi_iglesia_id(), SECURITY DEFINER para poder leer la tabla de arriba sin que el que pregunta
-- necesite permiso directo sobre ella.
create function public.soy_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.super_admins where usuario_id = auth.uid());
$$;
grant execute on function public.soy_super_admin() to authenticated;

-- Eldin, el único super admin por ahora.
insert into public.super_admins (usuario_id) values ('e07d2506-d13d-4f3d-a723-9a71f776570b');

-- ============== Acción 1: ver el panorama de todas las iglesias ==============
-- Estas SÍ quedan como políticas nuevas separadas (no ampliando una existente): son de SELECT, no de
-- UPDATE, y para SELECT la combinación con OR entre políticas permisivas sí se comprobó que funciona
-- bien (Beto, que no es super admin, solo ve su propia iglesia/equipo; Ana si es super admin ve todo).
create policy "super admin ve todas las iglesias" on public.iglesias
  for select to authenticated
  using (public.soy_super_admin());
-- Para mostrar cuántos usuarios tiene cada una y encontrar a su administrador (para poder
-- restablecerle la contraseña, acción 3) — sin esto, usuarios sigue viéndose solo dentro de la
-- propia iglesia para cualquiera que no sea super admin (Fase 2c no se toca).
create policy "super admin ve todos los usuarios" on public.usuarios
  for select to authenticated
  using (public.soy_super_admin());

-- ============== Acción 2: activar/desactivar una iglesia ==============
-- Amplía la política de Fase 5 en vez de agregar una nueva (ver nota de arriba). Un super admin
-- puede ahora entrar por acá a CUALQUIER fila de iglesias, no solo la suya — el trigger de más abajo
-- es lo que de verdad impide que toque algo más que "activa" en una iglesia que no es la suya; esta
-- política por sí sola sería demasiado amplia sin él. "activa" hoy no bloquea nada todavía (no hay
-- cobro), queda lista para cuando la Fase 5b de cobro exista — desactivar ≈ lo que le pasó a Eldin
-- con OnStage al dejar de pagar, sin perder ningún dato.
alter table public.iglesias add column activa boolean not null default true;
alter policy "admins editan su iglesia" on public.iglesias
  using (public.soy_super_admin() or (id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')))
  with check (public.soy_super_admin() or (id = public.mi_iglesia_id() and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')));

-- Un super admin que NO es admin de la iglesia que está tocando (o sea, cualquier iglesia que no sea
-- la suya propia) solo puede cambiar "activa" — nada de nombre, logo, colores o zona horaria. Si es
-- admin normal de SU PROPIA iglesia (el caso de todos los días, incluido Eldin en la suya), este
-- trigger no hace nada y sigue aplicando la Fase 5 normal sin restricción.
create function public.restringir_super_admin_a_solo_activa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.soy_super_admin() and new.id is distinct from public.mi_iglesia_id() then
    if new.nombre is distinct from old.nombre or new.slug is distinct from old.slug
       or new.zona_horaria is distinct from old.zona_horaria or new.logo_url is distinct from old.logo_url
       or new.color_primario is distinct from old.color_primario or new.color_acento is distinct from old.color_acento
    then
      raise exception 'Un super administrador solo puede activar o desactivar una iglesia que no es la suya, no editar su contenido.';
    end if;
  end if;
  return new;
end;
$$;
create trigger limitar_super_admin_en_iglesias
  before update on public.iglesias
  for each row execute function public.restringir_super_admin_a_solo_activa();

-- ============== Acción 4 bis: código de invitación para ?crear-iglesia ==============
-- Antes, cualquiera con el enlace (sin importar de quién lo recibiera) podía crear una iglesia —
-- ahora además hace falta este código, que el super admin ve/cambia desde la consola. Fila única,
-- mismo patrón que asistente_config. Sin política para anon/authenticated en general: crear-iglesia
-- lo valida con la service role (bypassa RLS); el único acceso de cliente es el del super admin,
-- para poder verlo/regenerarlo desde la consola. (ALL en vez de SELECT+UPDATE separados: es una
-- tabla propia nueva de una sola fila, sin el riesgo de "admins editan su iglesia" de arriba.)
create table public.plataforma_config (
  id text primary key default 'default',
  codigo_invitacion text
);
alter table public.plataforma_config enable row level security;
revoke all on public.plataforma_config from anon;
create policy "super admin ve y cambia la config de plataforma" on public.plataforma_config
  for all to authenticated
  using (public.soy_super_admin())
  with check (public.soy_super_admin());
-- Código inicial generado ahora mismo (no queda la puerta abierta ni un segundo entre esta migración
-- y que Eldin entre a ponerle uno desde la consola) — lo ve en la consola la primera vez que entra.
insert into public.plataforma_config (id, codigo_invitacion) values ('default', encode(gen_random_bytes(6), 'hex'));

-- ============== Acción 3 bis: forzar el cierre de una sesión en vivo atascada ==============
-- Mismo criterio que arriba: amplía la política existente de Fase 2c en vez de agregar una nueva.
-- Acá SÍ se permite tocar la fila completa (no solo un campo, como en iglesias) -- "forzar el cierre"
-- de verdad necesita poder limpiar slide/estilo/líder/etc., no solo un interruptor.
alter policy "autenticados actualizan la sesión en vivo" on public.sesiones_en_vivo
  using (public.soy_super_admin() or iglesia_id = public.mi_iglesia_id())
  with check (public.soy_super_admin() or iglesia_id = public.mi_iglesia_id());
