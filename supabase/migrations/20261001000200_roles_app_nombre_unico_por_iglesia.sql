-- Bug real encontrado 2026-10-01: roles_app.nombre tenía una restricción ÚNICA EN TODA LA BASE
-- (de antes de la Fase 2, cuando solo existía una iglesia) — al dar de alta una segunda iglesia,
-- sembrar_roles_default() intentaba crear "Administrador"/"Multimedia"/etc. para ella, chocaba con
-- los que ya existían de Jesús El Buen Pastor, y como los 5 inserts van en una sola función (una
-- sola transacción implícita), si uno falla fallan los 5 — esa iglesia se quedó sin ROL NINGUNO,
-- ni Administrador. Correcto: el nombre de un rol debe ser único DENTRO de cada iglesia, no entre
-- iglesias distintas.
alter table public.roles_app drop constraint roles_app_nombre_key;
alter table public.roles_app add constraint roles_app_iglesia_nombre_key unique (iglesia_id, nombre);

-- Repara la iglesia que ya se quedó sin roles por este bug, sembrándoselos ahora que sí puede.
do $$
declare
  igl uuid;
begin
  for igl in select id from public.iglesias where id not in (select distinct iglesia_id from public.roles_app) loop
    perform public.sembrar_roles_default(igl);
  end loop;
end $$;
