-- Fase 5 (identidad visual por iglesia): deja explícitos en Jesús El Buen Pastor el logo y los
-- colores que hoy ya tiene (antes vivían solo como valores por defecto en el código/CSS). Así
-- "ninguna iglesia tiene nada personalizado todavía" (logo_url/color_primario/color_acento NULL)
-- pasa a significar de verdad "usa el genérico de WorshipFlow" para cualquier iglesia nueva, sin
-- que eso cambie nada de lo que Buen Pastor ve hoy.
update public.iglesias
set logo_url = '/pwa-192x192.png', color_primario = '#16324F', color_acento = '#E8821E'
where slug = 'buen-pastor';
