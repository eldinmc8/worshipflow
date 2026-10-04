-- Sube el límite de archivo del bucket fondos-en-vivo de 40MB a 100MB -- pedido de Eldin, 2026-10-04,
-- mismo día que se creó el bucket (ver 20261004000000_fondos_en_vivo_storage.sql). Migración aparte en
-- vez de editar esa, porque esa ya se había corrido contra producción con el límite viejo.
update storage.buckets set file_size_limit = 104857600 where id = 'fondos-en-vivo';
