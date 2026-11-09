import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba } from "./pgliteHarness.js";

// Migración 20261114000000_zona_horaria_cualquiera.sql: la base acepta cualquier zona válida del mundo
// y rechaza nombres inventados.
let db;
beforeAll(async () => { db = await levantarBaseDePrueba(); });
afterAll(async () => { await db?.close(); });

describe("zona horaria de la iglesia en la base", () => {
  it("acepta Venezuela, España y la UTC-6 de siempre", async () => {
    await db.exec(`insert into public.iglesias (id, nombre, slug, zona_horaria) values ('11111111-1111-1111-1111-1111111111e1', 'Caracas', 'caracas', 'America/Caracas')`);
    await db.exec(`update public.iglesias set zona_horaria = 'Europe/Madrid' where slug = 'caracas'`);
    await db.exec(`update public.iglesias set zona_horaria = 'Etc/GMT+6' where slug = 'caracas'`);
    const r = await db.query(`select zona_horaria from public.iglesias where slug = 'caracas'`);
    expect(r.rows[0].zona_horaria).toBe("Etc/GMT+6");
  });
  it("rechaza una zona que no existe", async () => {
    await expect(db.exec(`update public.iglesias set zona_horaria = 'America/Atlantida' where slug = 'caracas'`)).rejects.toThrow(/Zona horaria no válida/);
  });
});
