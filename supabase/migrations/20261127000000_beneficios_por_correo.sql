-- Beneficio de lanzamiento por correo (pedido de Eldin, 2026-11-26).
--
-- Lista de correos con su grupo de beneficio (fase_1 | fase_2 | lista_espera) y, si se quiere, hasta cuándo pueden
-- activarlo. Cuando alguien crea su iglesia con uno de estos correos (con contraseña o con Google), la función
-- crear-iglesia le pone a la iglesia ese grupo y ese plazo (ver supabase/functions/_shared/beneficioPorCorreo.js).
-- Para iglesias que YA existen, aplicar_beneficios_por_correo() lo pone a las que tengan un administrador con ese
-- correo y todavía no tengan grupo.
--
-- Nadie desde la app la puede leer ni cambiar: solo el super admin, el editor SQL y las funciones del servidor.

create table if not exists public.beneficios_por_correo (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  grupo text not null check (grupo in ('fase_1', 'fase_2', 'lista_espera')),
  plazo_hasta timestamptz,          -- null = sin fecha límite para activarlo
  nota text,
  iglesia_id uuid references public.iglesias(id) on delete set null, -- la iglesia que lo recibió
  usado_en timestamptz,             -- cuándo se le puso a una iglesia (una sola vez por correo)
  creado_en timestamptz not null default now()
);

alter table public.beneficios_por_correo enable row level security;
revoke all on public.beneficios_por_correo from anon, authenticated;
grant select, insert, update, delete on public.beneficios_por_correo to authenticated;

drop policy if exists beneficios_por_correo_super_admin on public.beneficios_por_correo;
create policy beneficios_por_correo_super_admin on public.beneficios_por_correo
  for all to authenticated
  using (public.soy_super_admin())
  with check (public.soy_super_admin());

-- Pone el beneficio a las iglesias que ya existen: la que tenga un administrador con un correo de la lista, sin grupo
-- todavía y sin haberlo activado. Devuelve cuántas iglesias cambió. Se puede correr las veces que haga falta.
create or replace function public.aplicar_beneficios_por_correo()
returns integer language plpgsql security definer set search_path = public as $$
declare v_total integer := 0; r record;
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not public.soy_super_admin() then
    raise exception 'Solo WorshipFlow puede aplicar los beneficios.';
  end if;
  for r in
    select distinct on (i.id) b.email, b.grupo, b.plazo_hasta, i.id as iglesia_id
    from public.beneficios_por_correo b
    join public.usuarios u on lower(u.email) = b.email and u.rol = 'admin'
    join public.iglesias i on i.id = u.iglesia_id
    where b.usado_en is null
      and i.grupo_beneficio is null
      and i.beneficio_activado_en is null
    order by i.id, b.creado_en
  loop
    update public.iglesias
      set grupo_beneficio = r.grupo, beneficio_plazo_hasta = r.plazo_hasta
      where id = r.iglesia_id;
    update public.beneficios_por_correo
      set usado_en = now(), iglesia_id = r.iglesia_id
      where email = r.email;
    v_total := v_total + 1;
  end loop;
  return v_total;
end $$;
revoke execute on function public.aplicar_beneficios_por_correo() from public, anon;
grant execute on function public.aplicar_beneficios_por_correo() to authenticated;

-- Cómo se carga la lista (ejemplo, en el editor SQL):
--   insert into public.beneficios_por_correo (email, grupo, plazo_hasta) values
--     ('pastor@ejemplo.com', 'lista_espera', '2026-12-31 23:59:00-06'),
--     ('otra@ejemplo.com',   'fase_1',       null)
--   on conflict (email) do update set grupo = excluded.grupo, plazo_hasta = excluded.plazo_hasta;
--   select public.aplicar_beneficios_por_correo();
