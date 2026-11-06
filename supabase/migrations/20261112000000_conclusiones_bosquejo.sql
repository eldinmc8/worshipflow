-- Conclusiones del bosquejo (pedido de Eldin, 2026-11-06). Junto con los subpuntos de cada punto (que
-- viven dentro de bosquejos.puntos, sin columna nueva), permite ingresar un sermón completo con su
-- estructura: puntos → subpuntos A, B… → conclusiones. Cada conclusión se proyecta como diapositiva.
-- Solo una columna nueva con valor por defecto: la versión anterior de la app sigue funcionando igual.
alter table public.bosquejos add column if not exists conclusiones jsonb not null default '[]'::jsonb;
