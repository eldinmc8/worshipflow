-- Animación por canción (pedido de Eldin, 2026-11-06, etapa 3 de la letra animada).
--
-- Desde el editor de cada canción (pestaña "Animación") se elige su estilo de letra animada, un estilo
-- distinto por parte (verso, coro, puente...), "momentos especiales" (ej. palabra gigante en "Santo") y
-- si late al compás de su tempo. En vivo cambia solo al pasar de una parte a otra; Multimedia lo puede
-- apagar. Se puede cambiar solo para un evento desde el Setlist.
--
-- - canciones.animacion: { general, porParte: { <clave de la parte>: <estilo> }, momentos: [{ palabra, efecto }], compas }
-- - items_servicio.animacion: lo mismo, solo para esa canción en ese evento (sin valor = como la canción).
-- Solo columnas nuevas: los permisos de siempre (quien edita el cancionero / el Setlist) siguen aplicando.

alter table public.canciones add column if not exists animacion jsonb;
alter table public.items_servicio add column if not exists animacion jsonb;
