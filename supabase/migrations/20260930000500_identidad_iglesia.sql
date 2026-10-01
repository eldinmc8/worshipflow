-- Fase 3 (multi-iglesia, identidad): prepara en la base de datos lo que cada iglesia podrá
-- personalizar. Por ahora solo se usan nombre (ya existía desde la Fase 2a) y zona_horaria (ídem,
-- recién conectada de verdad en esta fase a los recordatorios). logo_url/color_primario/color_acento
-- quedan creadas y vacías a propósito: la app sigue usando el logo y los colores de Jesús El Buen
-- Pastor escritos directo en el código (están sueltos en ~109 lugares del archivo principal) hasta
-- una fase aparte que los reemplace por estas columnas.
alter table public.iglesias add column logo_url text;
alter table public.iglesias add column color_primario text;
alter table public.iglesias add column color_acento text;
