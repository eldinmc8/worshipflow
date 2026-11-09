-- Zona horaria: cualquiera del mundo (pedido de Eldin, 2026-11-09: "no hay para todos los países, como
-- Venezuela").
--
-- La app ahora ofrece todas las zonas (src/lib/zonasHorarias.js) y la función crear-iglesia acepta
-- cualquiera válida. Para que nunca se guarde un nombre que Postgres no entienda (rompería
-- "now() at time zone ..." en el tope del asistente, la consola general, etc.), la base lo comprueba
-- contra su propia lista de zonas (pg_timezone_names) al crear o cambiar una iglesia.

create or replace function public.wf_validar_zona_horaria() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.zona_horaria is null or not exists (select 1 from pg_timezone_names where name = new.zona_horaria) then
    raise exception 'Zona horaria no válida: %', coalesce(new.zona_horaria, '(vacía)') using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists wf_validar_zona_horaria on public.iglesias;
create trigger wf_validar_zona_horaria before insert or update of zona_horaria on public.iglesias
  for each row execute function public.wf_validar_zona_horaria();
