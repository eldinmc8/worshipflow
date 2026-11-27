-- Varios grupos en un evento (pedido de Eldin, 2026-11-26, de una iglesia que quería marcar un evento
-- como general de la iglesia y además a dos ministerios). El dueño sigue siendo ministerio_id
-- (null = general). ministerios_invitados = los otros grupos que participan: el evento sale en el
-- filtro y en la pantalla de cada uno, y sus líderes lo ven. Ser invitado NO da permiso de cambiar el
-- evento completo (fecha, nombre, borrarlo): eso sigue siendo de quien organiza eventos y del líder
-- del grupo dueño (wf_permiso_eventos no cambia). Cada líder maneja su parte con los bloques
-- vinculados a su grupo, como siempre.
alter table public.eventos add column if not exists ministerios_invitados uuid[] not null default '{}';
