-- Control remoto: proyectar un versículo de la Biblia desde el celular (pedido de Eldin, 2026-11-13).
--
-- Orden nueva "biblia": el celular busca el versículo y lo manda en `datos` (referencia, versión, texto y
-- de dónde es, para que la computadora pueda seguir con "siguiente versículo"). La computadora que
-- transmite lo pone al aire igual que "Proyectar ahora" de su buscador. Solo quien controla el en vivo:
-- wf_puedo_mandar_comando ya limita al predicador a "siguiente" y "anterior".

alter table public.comandos_en_vivo add column if not exists datos jsonb;

alter table public.comandos_en_vivo drop constraint if exists comandos_en_vivo_accion_check;
alter table public.comandos_en_vivo add constraint comandos_en_vivo_accion_check
  check (accion in ('siguiente', 'anterior', 'negro', 'ir_item', 'biblia'));

-- `datos` solo viaja con "biblia", y con tope de tamaño (un pasaje largo cabe de sobra).
alter table public.comandos_en_vivo drop constraint if exists comandos_en_vivo_datos_check;
alter table public.comandos_en_vivo add constraint comandos_en_vivo_datos_check
  check (case when accion = 'biblia' then datos is not null and jsonb_typeof(datos) = 'object' and length(datos::text) <= 16000 else datos is null end);
