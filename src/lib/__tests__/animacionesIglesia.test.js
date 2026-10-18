import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Migración 20261018000000: cada iglesia ve las suyas + las compartidas en la galería, y solo puede
// crear, editar y borrar las suyas.
describe("animaciones de cada iglesia y galería", () => {
  let db;
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const UA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const UB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  let privadaA, compartidaA;

  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`
      insert into public.iglesias (id, nombre, slug) values ('${A}', 'Iglesia A', 'iglesia-a'), ('${B}', 'Iglesia B', 'iglesia-b');
      insert into auth.users (id, email) values ('${UA}', 'a@x.com'), ('${UB}', 'b@x.com');
      insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
        ('${UA}', 'a@x.com', 'Multimedia A', 'miembro', '${A}'),
        ('${UB}', 'b@x.com', 'Multimedia B', 'miembro', '${B}');
    `);
    await actuarComo(db, UA);
    privadaA = (await db.query(`insert into public.animaciones_iglesia (iglesia_id, nombre, receta) values ($1, 'Privada', '{}') returning id`, [A])).rows[0].id;
    compartidaA = (await db.query(`insert into public.animaciones_iglesia (iglesia_id, nombre, receta, compartida, autor_iglesia) values ($1, 'Para todos', '{}', true, 'Iglesia A') returning id`, [A])).rows[0].id;
  });
  afterAll(async () => { await db.close(); });

  it("la otra iglesia solo ve las compartidas", async () => {
    await actuarComo(db, UB);
    const r = await db.query(`select id from public.animaciones_iglesia`);
    expect(r.rows.map((x) => x.id)).toEqual([compartidaA]);
  });

  it("nadie puede editar, borrar ni crear animaciones a nombre de otra iglesia", async () => {
    await actuarComo(db, UB);
    const upd = await db.query(`update public.animaciones_iglesia set nombre = 'robada' where id = $1 returning id`, [compartidaA]);
    expect(upd.rows.length).toBe(0);
    const del = await db.query(`delete from public.animaciones_iglesia where id = $1 returning id`, [compartidaA]);
    expect(del.rows.length).toBe(0);
    await expect(db.query(`insert into public.animaciones_iglesia (iglesia_id, nombre, receta) values ($1, 'x', '{}')`, [A])).rejects.toThrow();
  });

  it("copiar de la galería a la propia iglesia funciona", async () => {
    await actuarComo(db, UB);
    const copia = await db.query(`insert into public.animaciones_iglesia (iglesia_id, nombre, receta) select $1, nombre, receta from public.animaciones_iglesia where id = $2 returning id`, [B, compartidaA]);
    expect(copia.rows.length).toBe(1);
  });

  it("la iglesia dueña edita y borra las suyas", async () => {
    await actuarComo(db, UA);
    expect((await db.query(`update public.animaciones_iglesia set compartida = true where id = $1 returning id`, [privadaA])).rows.length).toBe(1);
    expect((await db.query(`delete from public.animaciones_iglesia where id = $1 returning id`, [privadaA])).rows.length).toBe(1);
  });
});
