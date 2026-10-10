-- Ajustes → Pantalla de proyección (2026-10-09): dividir o no los versículos largos en 2 o 3
-- diapositivas. Sirve para pantallas chicas; en pantallas grandes conviene el versículo completo,
-- por eso es por iglesia y viene apagado. La edita el admin con "admins editan su iglesia".
alter table public.iglesias add column if not exists dividir_versiculos boolean not null default false;
