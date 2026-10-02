-- Compás de la canción (4/4, 3/4, 6/8...). Opcional: vacío = no se especificó (el auto-avance de
-- Modo Músico asume 4 tiempos por compás, como siempre).
alter table public.canciones add column compas text;
