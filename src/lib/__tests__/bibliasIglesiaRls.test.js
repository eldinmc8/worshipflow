import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Migración 20261122000000: Biblias importadas por cada iglesia (Zefania XML).
describe("biblias_iglesia en la base (solo la iglesia dueña; solo el admin importa)", () => {
  let db;
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const ADMIN_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const MIEMBRO_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const ADMIN_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  let bibliaA;

  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`
      insert into public.iglesias (id, nombre, slug) values ('${A}', 'Iglesia A', 'iglesia-a'), ('${B}', 'Iglesia B', 'iglesia-b');
      insert into auth.users (id, email) values ('${ADMIN_A}', 'a@x.com'), ('${MIEMBRO_A}', 'c@x.com'), ('${ADMIN_B}', 'b@x.com');
      insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
        ('${ADMIN_A}', 'a@x.com', 'Admin A', 'admin', '${A}'),
        ('${MIEMBRO_A}', 'c@x.com', 'Miembro A', 'miembro', '${A}'),
        ('${ADMIN_B}', 'b@x.com', 'Admin B', 'admin', '${B}');
    `);
    await actuarComo(db, ADMIN_A);
    bibliaA = (await db.query(`insert into public.biblias_iglesia (iglesia_id, codigo, nombre, libros) values ($1, 'IXIL', 'Ixil', '[]') returning id`, [A])).rows[0].id;
    await db.query(`insert into public.versiculos_iglesia (biblia_id, iglesia_id, libro, capitulo, versiculo, texto) values ($1, $2, 43, 3, 16, 'texto')`, [bibliaA, A]);
    await db.query(`update public.biblias_iglesia set completa = true where id = $1`, [bibliaA]);
  });
  afterAll(async () => { await db?.close(); });

  it("un miembro de la iglesia la lee, pero no puede importar ni borrar", async () => {
    await actuarComo(db, MIEMBRO_A);
    expect((await db.query(`select texto from public.versiculos_iglesia where biblia_id = $1`, [bibliaA])).rows).toEqual([{ texto: "texto" }]);
    await expect(db.query(`insert into public.biblias_iglesia (iglesia_id, codigo, nombre) values ($1, 'OTRA', 'x')`, [A])).rejects.toThrow();
    expect((await db.query(`delete from public.biblias_iglesia where id = $1 returning id`, [bibliaA])).rows.length).toBe(0);
  });

  it("otra iglesia no la ve ni le puede meter versículos", async () => {
    await actuarComo(db, ADMIN_B);
    expect((await db.query(`select id from public.biblias_iglesia`)).rows.length).toBe(0);
    expect((await db.query(`select texto from public.versiculos_iglesia`)).rows.length).toBe(0);
    await expect(db.query(`insert into public.versiculos_iglesia (biblia_id, iglesia_id, libro, capitulo, versiculo, texto) values ($1, $2, 1, 1, 1, 'x')`, [bibliaA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.versiculos_iglesia (biblia_id, iglesia_id, libro, capitulo, versiculo, texto) values ($1, $2, 1, 1, 1, 'x')`, [bibliaA, A])).rejects.toThrow();
  });

  it("no se repite la abreviatura en la misma iglesia, pero otra iglesia puede usarla", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.biblias_iglesia (iglesia_id, codigo, nombre) values ($1, 'IXIL', 'otra')`, [A])).rejects.toThrow();
    await actuarComo(db, ADMIN_B);
    expect((await db.query(`insert into public.biblias_iglesia (iglesia_id, codigo, nombre) values ($1, 'IXIL', 'la de B') returning id`, [B])).rows.length).toBe(1);
  });

  it("el admin la borra y se van sus versículos", async () => {
    await actuarComo(db, ADMIN_A);
    expect((await db.query(`delete from public.biblias_iglesia where id = $1 returning id`, [bibliaA])).rows.length).toBe(1);
    expect((await db.query(`select count(*)::int as n from public.versiculos_iglesia where biblia_id = $1`, [bibliaA])).rows[0].n).toBe(0);
  });
});
