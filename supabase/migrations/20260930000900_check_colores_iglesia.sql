-- Defensa extra además de la validación del formulario (Ajustes → Identidad de la iglesia): un
-- color_primario/color_acento que no sea un hex válido deja ese color SIN EFECTO en toda la app
-- (var() con un valor inválido se resuelve transparente) — no es un problema de seguridad entre
-- iglesias, pero sí puede dejar la app de esa iglesia ilegible por accidente. NULL sigue permitido
-- (significa "usa el genérico de WorshipFlow").
alter table public.iglesias add constraint iglesias_color_primario_check
  check (color_primario is null or color_primario ~ '^#[0-9A-Fa-f]{6}$');
alter table public.iglesias add constraint iglesias_color_acento_check
  check (color_acento is null or color_acento ~ '^#[0-9A-Fa-f]{6}$');
