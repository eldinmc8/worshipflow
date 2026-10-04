import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba las políticas RLS REALES del repo (supabase/migrations), no una copia a mano -- levanta
// Postgres en memoria con PGlite y repasa las migraciones en orden (ver pgliteHarness.js). Dos
// iglesias, un administrador de cada una, confirmando que ninguno puede leer ni modificar los datos
// de la otra por la base de datos directa (REST/RPC en producción pasa por la misma RLS).
describe("aislamiento entre iglesias (RLS real)", () => {
  let db;
  const IGLESIA_A = "11111111-1111-1111-1111-111111111111";
  const IGLESIA_B = "22222222-2222-2222-2222-222222222222";
  const ADMIN_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ADMIN_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const EVENTO_A = "e1111111-1111-1111-1111-111111111111";
  const CANCION_A = "c1111111-1111-1111-1111-111111111111";

  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`
      insert into public.iglesias (id, nombre, slug) values ('${IGLESIA_A}', 'Iglesia A', 'iglesia-a'), ('${IGLESIA_B}', 'Iglesia B', 'iglesia-b');
      insert into auth.users (id, email) values ('${ADMIN_A}', 'admin-a@x.com'), ('${ADMIN_B}', 'admin-b@x.com');
      insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
        ('${ADMIN_A}', 'admin-a@x.com', 'Admin A', 'admin', '${IGLESIA_A}'),
        ('${ADMIN_B}', 'admin-b@x.com', 'Admin B', 'admin', '${IGLESIA_B}');
    `);
    await actuarComo(db, ADMIN_A);
    await db.query(`insert into public.eventos (id, titulo, iglesia_id) values ($1, 'Evento de A', $2)`, [EVENTO_A, IGLESIA_A]);
    await db.query(`insert into public.canciones (id, titulo, iglesia_id) values ($1, 'Canción de A', $2)`, [CANCION_A, IGLESIA_A]);
  });

  afterAll(async () => {
    await db.close();
  });

  it("el admin de B no puede LEER los eventos de la iglesia A", async () => {
    await actuarComo(db, ADMIN_B);
    const r = await db.query(`select id from public.eventos`);
    expect(r.rows.map((x) => x.id)).not.toContain(EVENTO_A);
  });

  it("el admin de B no puede LEER las canciones de la iglesia A", async () => {
    await actuarComo(db, ADMIN_B);
    const r = await db.query(`select id from public.canciones`);
    expect(r.rows.map((x) => x.id)).not.toContain(CANCION_A);
  });

  it("el admin de B no puede LEER a los usuarios de la iglesia A", async () => {
    await actuarComo(db, ADMIN_B);
    const r = await db.query(`select id from public.usuarios`);
    expect(r.rows.map((x) => x.id)).not.toContain(ADMIN_A);
  });

  it("el admin de B no puede MODIFICAR un evento de la iglesia A (0 filas afectadas, no un error)", async () => {
    await actuarComo(db, ADMIN_B);
    const r = await db.query(`update public.eventos set titulo = 'hackeado' where id = $1 returning id`, [EVENTO_A]);
    expect(r.rows).toHaveLength(0);
    // El título de A sigue intacto -- confirmado directo por el propio A.
    await actuarComo(db, ADMIN_A);
    const propio = await db.query(`select titulo from public.eventos where id = $1`, [EVENTO_A]);
    expect(propio.rows[0].titulo).toBe("Evento de A");
  });

  it("el admin de B no puede BORRAR un evento de la iglesia A", async () => {
    await actuarComo(db, ADMIN_B);
    const r = await db.query(`delete from public.eventos where id = $1 returning id`, [EVENTO_A]);
    expect(r.rows).toHaveLength(0);
    await actuarComo(db, ADMIN_A);
    const sigueAhi = await db.query(`select id from public.eventos where id = $1`, [EVENTO_A]);
    expect(sigueAhi.rows).toHaveLength(1);
  });

  // Hallazgo del 2026-10-03, cerrado el mismo día (ver migración 20261003000300 y
  // aislamientoFk.test.js para la cobertura completa, tabla por tabla): la política de
  // items_servicio exigía iglesia_id = mi_iglesia_id() en la fila nueva, pero no verificaba que
  // evento_id apuntara a un evento de ESA MISMA iglesia -- un admin de B podía insertar una fila con
  // su propio iglesia_id pero evento_id de otra iglesia. Ahora el WITH CHECK también exige que el
  // evento referenciado sea de la misma iglesia.
  it("el admin de B ya NO puede plantar una fila con evento_id de A", async () => {
    await actuarComo(db, ADMIN_B);
    await expect(
      db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, iglesia_id) values ($1, 'bloque', 'intruso', 0, $2)`, [EVENTO_A, IGLESIA_B])
    ).rejects.toThrow();
  });

  it("el admin de A sigue viendo con normalidad lo suyo (el aislamiento no le afecta a él)", async () => {
    await actuarComo(db, ADMIN_A);
    const eventos = await db.query(`select id from public.eventos`);
    const canciones = await db.query(`select id from public.canciones`);
    expect(eventos.rows.map((x) => x.id)).toContain(EVENTO_A);
    expect(canciones.rows.map((x) => x.id)).toContain(CANCION_A);
  });

  it("un usuario sin sesión (anon) no lee eventos ni canciones de ninguna iglesia", async () => {
    await actuarComo(db, null);
    const eventos = await db.query(`select id from public.eventos`);
    const canciones = await db.query(`select id from public.canciones`);
    expect(eventos.rows).toHaveLength(0);
    expect(canciones.rows).toHaveLength(0);
  });
});
