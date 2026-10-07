-- Las dos tablas de respaldo del 2026-10-05 quedaron en public sin RLS: cualquiera con la llave
-- anónima podía leerlas o modificarlas. Se protegen (sin borrarlas) — ya aplicado en producción.
-- "if exists" porque solo existen en producción (no en PGlite ni en una base nueva).
do $$
declare t text;
begin
  foreach t in array array['_backup_diapositivas_letra_20261005', '_backup_secciones_cancion_20261005'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
