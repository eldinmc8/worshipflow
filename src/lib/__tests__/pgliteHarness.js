import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "..", "supabase", "migrations");

// Migraciones que no se repasan aquí porque dependen de extensiones que PGlite no trae (Storage,
// pg_cron, pg_net, Vault) y no son parte de lo que esta prueba necesita (aislamiento de datos entre
// iglesias en eventos/canciones/usuarios) -- las de seguridad de hoy (push manual, cron, vault) tocan
// justamente esas piezas y se prueban aparte, en vivo contra el proyecto real (ver resumen de la
// tarea), no acá.
const EXCLUIR = new Set(["20261001000100_logos_storage.sql", "20261003000000_verificar_secreto_push_manual.sql", "20261003000100_verificar_secreto_cron.sql", "20261003000200_usuarios_con_push.sql", "20261004000000_fondos_en_vivo_storage.sql", "20261004000100_fondos_en_vivo_limite_100mb.sql", "20261004000200_recursos_ministerio_storage.sql"]);

function limpiarSql(sql) {
  return sql
    .split("\n")
    .filter((linea) => !/^\s*create extension/i.test(linea))
    .filter((linea) => !/^\s*alter publication supabase_realtime/i.test(linea))
    // Siembra a Eldin como super admin con su uuid real de producción -- en esta base de prueba, vacía,
    // viola la llave foránea (no existe ese usuario). Las pruebas que necesiten un super admin crean el
    // suyo propio.
    .filter((linea) => !/^\s*insert into public\.super_admins/i.test(linea))
    // gen_random_bytes() es de pgcrypto, que no está cargada (se saltó "create extension" arriba) --
    // es solo el código de invitación de la Consola general, no hace falta para estas pruebas.
    .filter((linea) => !/^\s*insert into public\.plataforma_config/i.test(linea))
    .join("\n");
}

// Levanta una base de datos Postgres en memoria y repasa, EN ORDEN, las migraciones reales del repo
// (supabase/migrations) -- así la prueba corre contra el esquema y las políticas RLS de verdad, no
// contra una copia a mano que podría quedar desactualizada en silencio. Stub mínimo de lo que Supabase
// provee y las migraciones dan por hecho: esquema auth con una tabla users y auth.uid()/auth.role()
// leyendo variables de sesión, los roles anon/authenticated, y la publicación supabase_realtime vacía.
export async function levantarBaseDePrueba() {
  const db = new PGlite();

  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('test.role', true), ''), 'authenticated')
    $$;
    create publication supabase_realtime;
  `);

  const archivos = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !EXCLUIR.has(f))
    .sort();
  for (const archivo of archivos) {
    const sql = limpiarSql(fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), "utf8"));
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Migración ${archivo} falló al repasarse en PGlite: ${e.message}`);
    }
  }

  // Supabase otorga estos GRANT a nivel de plataforma (no viven en las migraciones de la app) -- sin
  // esto, cualquier consulta falla con "permission denied" ANTES de que la RLS (que sí está en las
  // migraciones) llegue a decidir nada. El filtrado real de filas sigue siendo cosa de las políticas.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
    grant usage, select on all sequences in schema public to anon, authenticated;
  `);
  return db;
}

// Cambia de "identidad" para la siguiente consulta -- SET normal (no "SET LOCAL"), porque PGlite trata
// cada .query()/.exec() como su propia transacción implícita y un SET LOCAL pierde efecto entre
// llamadas separadas (ver worshipflow_esquema_en_migraciones.md: esto ya causó un falso-positivo real
// en una prueba anterior). null = anon (sin sesión).
export async function actuarComo(db, usuarioId) {
  // Cada .query() es su propia llamada -- PGlite no acepta varias sentencias separadas por ";" en una
  // sola llamada parametrizada (protocolo extendido), así que van una por una en vez de un solo exec().
  if (usuarioId == null) {
    await db.query(`set role anon`);
    await db.query(`select set_config('test.uid', '', false)`);
    await db.query(`select set_config('test.role', 'anon', false)`);
  } else {
    await db.query(`set role authenticated`);
    await db.query(`select set_config('test.uid', $1, false)`, [usuarioId]);
    await db.query(`select set_config('test.role', 'authenticated', false)`);
  }
}
