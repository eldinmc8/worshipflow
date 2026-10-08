-- Cómo se reparte la letra de canciones en pantalla, por iglesia (Ajustes → Identidad de la iglesia):
--   dos_lineas               → 2 líneas por diapositiva (como siempre; pantallas grandes/proyectores)
--   una_linea_dos_renglones  → 1 línea por diapositiva, partida en 2 renglones (pantallas chicas/TVs)
--   una_linea                → 1 línea por diapositiva, en un solo renglón
-- Se aplica al proyectar (ver reorganizarLetra en src/lib/dividirTexto.js): las canciones guardadas no
-- cambian. La edita el admin de la iglesia con la política "admins editan su iglesia" que ya existe.
alter table public.iglesias
  add column if not exists formato_letra text not null default 'dos_lineas';

alter table public.iglesias
  drop constraint if exists iglesias_formato_letra_valido;
alter table public.iglesias
  add constraint iglesias_formato_letra_valido
  check (formato_letra in ('dos_lineas', 'una_linea_dos_renglones', 'una_linea'));

-- Jesús El Buen Pastor tiene una pantalla chica: pidió 1 línea en 2 renglones (2026-10-07).
update public.iglesias set formato_letra = 'una_linea_dos_renglones' where slug = 'buen-pastor';
