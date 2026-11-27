import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Migración 20261128000000_repertorios.sql: cada iglesia ve solo sus repertorios; los ve cualquier
// miembro, pero solo quien administra canciones los crea, cambia o borra.
describe("repertorios (RLS real)", () => {
  let db;
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const ADMIN_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const MUSICO_A = "abababab-abab-abab-abab-abababababab";
  const ADMIN_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  let repA;

  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`
      insert into public.iglesias (id, nombre, slug) values ('${A}', 'Iglesia A', 'iglesia-a'), ('${B}', 'Iglesia B', 'iglesia-b');
      insert into auth.users (id, email) values ('${ADMIN_A}', 'a@x.com'), ('${MUSICO_A}', 'm@x.com'), ('${ADMIN_B}', 'b@x.com');
      insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
        ('${ADMIN_A}', 'a@x.com', 'Admin A', 'admin', '${A}'),
        ('${MUSICO_A}', 'm@x.com', 'Músico A', 'miembro', '${A}'),
        ('${ADMIN_B}', 'b@x.com', 'Admin B', 'admin', '${B}');
    `);
    await actuarComo(db, ADMIN_A);
    const r = await db.query(`insert into public.repertorios (nombre, canciones) values ('Lista 1 Alabanza', '["x"]') returning id, iglesia_id`);
    repA = r.rows[0].id;
    expect(r.rows[0].iglesia_id).toBe(A);
  });

  afterAll(async () => { await db.close(); });

  it("un miembro de la misma iglesia lo ve pero no lo puede cambiar ni crear", async () => {
    await actuarComo(db, MUSICO_A);
    const ver = await db.query(`select id from public.repertorios`);
    expect(ver.rows.map((x) => x.id)).toContain(repA);
    await expect(db.query(`update public.repertorios set nombre = 'otro' where id = $1`, [repA])).rejects.toThrow(/permiso/);
    await expect(db.query(`insert into public.repertorios (nombre) values ('Mío')`)).rejects.toThrow(/permiso/);
  });

  it("otra iglesia no lo ve ni lo puede borrar", async () => {
    await actuarComo(db, ADMIN_B);
    const ver = await db.query(`select id from public.repertorios`);
    expect(ver.rows.map((x) => x.id)).not.toContain(repA);
    const del = await db.query(`delete from public.repertorios where id = $1 returning id`, [repA]);
    expect(del.rows).toHaveLength(0);
    await expect(db.query(`insert into public.repertorios (nombre, iglesia_id) values ('Intruso', $1)`, [A])).rejects.toThrow();
  });

  it("no acepta nombre vacío", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.repertorios (nombre) values ('   ')`)).rejects.toThrow();
  });
});
