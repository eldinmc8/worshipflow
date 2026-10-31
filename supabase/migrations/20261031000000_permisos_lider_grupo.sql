-- Permisos por grupo (2026-10-31): cada ministerio decide qué puede hacer SU líder, además de lo
-- básico (editar el grupo y los encargados de los bloques vinculados). Claves: editar_setlist,
-- equipo, gestionar_canciones (ver PERMISOS_LIDER en src/lib/roles.js).
alter table public.ministerios
  add column if not exists permisos_lider jsonb not null default '{}'::jsonb;

-- Alabanza de Iglesia Jesús El Buen Pastor arranca con todo encendido (su líder: Daniel Salazar).
update public.ministerios
  set permisos_lider = '{"editar_setlist": true, "equipo": true, "gestionar_canciones": true}'::jsonb
  where id = '51fe51f9-37e1-4a77-a9e7-0fd0ff2fcd9b';
