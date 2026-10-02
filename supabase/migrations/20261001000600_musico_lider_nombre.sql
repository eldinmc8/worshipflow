-- Modo Músico con unión voluntaria: los demás músicos ven QUIÉN está dirigiendo antes de decidir si
-- se unen. lider_id es el id del dispositivo (no de la persona), así que se guarda el nombre aparte.
alter table public.musico_en_vivo add column lider_nombre text;
