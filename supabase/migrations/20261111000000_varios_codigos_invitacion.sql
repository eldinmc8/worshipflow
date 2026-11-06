-- Varios códigos de invitación a la vez (pedido de Eldin, 2026-11-06).
--
-- Antes había UN solo código en plataforma_config.codigo_invitacion: al generar uno nuevo para otra
-- iglesia, el anterior dejaba de funcionar aunque esa iglesia todavía no se hubiera dado de alta.
-- Ahora cada invitación es su propia fila: se pueden tener varias pendientes al mismo tiempo, cada una
-- sirve para UNA sola iglesia y se marca como usada (con qué iglesia) cuando se gasta. Eldin puede
-- anotar para quién es cada código y anular los que ya no hagan falta.
-- Cada código vence a los 30 días de creado (si no se usó), para que un enlace olvidado o reenviado
-- no quede abierto para siempre.
--
-- El código lo genera el cliente/función (12 hex, mismo formato de siempre) -- sin default con
-- gen_random_bytes para no depender de pgcrypto.

create table if not exists public.codigos_invitacion (
  codigo text primary key check (length(codigo) >= 8),
  nota text,                                   -- para quién es (ej. "Iglesia Betel, pastor Juan")
  creado_at timestamptz not null default now(),
  vence_at timestamptz not null default now() + interval '30 days',
  usado_at timestamptz,
  iglesia_id uuid references public.iglesias(id) on delete set null
);
create index if not exists codigos_invitacion_pendientes on public.codigos_invitacion (creado_at) where usado_at is null;

alter table public.codigos_invitacion enable row level security;
revoke all on public.codigos_invitacion from anon;
-- Solo el super admin lo ve y lo administra desde la consola; la función crear-iglesia usa la service role.
create policy "super admin administra los códigos de invitación" on public.codigos_invitacion
  for all to authenticated
  using (public.soy_super_admin())
  with check (public.soy_super_admin());

-- El código que estaba vigente sigue funcionando (por si ya se lo enviaste a alguien).
insert into public.codigos_invitacion (codigo, nota)
select codigo_invitacion, 'Código anterior (migrado)'
from public.plataforma_config
where id = 'default' and codigo_invitacion is not null and length(codigo_invitacion) >= 8
on conflict (codigo) do nothing;
