-- Audio en la biblioteca de fondos (pedido de Eldin, 2026-11-22): la "diapositiva de audio" del orden del
-- culto y la música de los botones de un solo toque se pueden subir como archivo (MP3, M4A, WAV, OGG).
-- Van al mismo bucket fondos-en-vivo, en "<iglesia>/audio/...", con las mismas reglas de acceso.
-- Solo agrega los tipos de audio a los que el bucket ya acepta (no quita ninguno).
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct m order by m)
  from unnest(allowed_mime_types || array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm']) as m
)
where id = 'fondos-en-vivo' and allowed_mime_types is not null;
