import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261117000000_eventos_por_ministerio.sql: el líder de un ministerio crea, edita
// y borra los eventos de SU ministerio (y arma su Setlist), aunque su rol no tenga "Organizar eventos".
const IG = "11111111-1111-1111-1111-1111111111f1";
const U = {
  admin: "a6000000-0000-0000-0000-000000000001",
  lucia: "a6000000-0000-0000-0000-000000000002", // miembro, líder de Jóvenes
  pedro: "a6000000-0000-0000-0000-000000000003", // miembro, sin ministerio
};
const M_JOV = "c6000000-0000-0000-0000-000000000001";
const M_DAM = "c6000000-0000-0000-0000-000000000002";
const E_JOV = "d6000000-0000-0000-0000-000000000001";

let db;
const sql = (q, p) => db.query(q, p);

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG}', 'Iglesia', 'eventos-ministerio');
    insert into auth.users (id, email) values ('${U.admin}', 'a@x.com'), ('${U.lucia}', 'l@x.com'), ('${U.pedro}', 'p@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${U.admin}', 'a@x.com', 'Admin', 'admin', '${IG}'), ('${U.lucia}', 'l@x.com', 'Lucía', 'miembro', '${IG}'), ('${U.pedro}', 'p@x.com', 'Pedro', 'miembro', '${IG}');
    insert into public.ministerios (id, nombre, lider_id, iglesia_id) values
      ('${M_JOV}', 'Jóvenes', '${U.lucia}', '${IG}'), ('${M_DAM}', 'Damas', '${U.admin}', '${IG}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("eventos por ministerio", () => {
  it("la líder de Jóvenes crea un evento de Jóvenes", async () => {
    await actuarComo(db, U.lucia);
    await sql("insert into public.eventos (id, titulo, fecha, ministerio_id, iglesia_id) values ($1, 'Retiro de jóvenes', '2027-03-20', $2, $3)", [E_JOV, M_JOV, IG]);
    const r = await sql("select ministerio_id from public.eventos where id = $1", [E_JOV]);
    expect(r.rows[0].ministerio_id).toBe(M_JOV);
  });
  it("…y arma su Setlist y lo edita", async () => {
    await actuarComo(db, U.lucia);
    await sql("insert into public.items_servicio (evento_id, tipo, titulo, orden, iglesia_id) values ($1, 'bloque', 'Bienvenida', 0, $2)", [E_JOV, IG]);
    await sql("update public.eventos set titulo = 'Retiro de jóvenes 2027' where id = $1", [E_JOV]);
  });
  it("pero no puede crear un evento general ni uno de otro ministerio, ni pasar el suyo a otro", async () => {
    await actuarComo(db, U.lucia);
    await expect(sql("insert into public.eventos (titulo, fecha, iglesia_id) values ('Culto', '2027-03-21', $1)", [IG])).rejects.toThrow();
    await expect(sql("insert into public.eventos (titulo, fecha, ministerio_id, iglesia_id) values ('Té', '2027-03-21', $1, $2)", [M_DAM, IG])).rejects.toThrow();
    await expect(sql("update public.eventos set ministerio_id = $1 where id = $2", [M_DAM, E_JOV])).rejects.toThrow();
  });
  it("alguien sin ministerio no puede tocar el evento de Jóvenes", async () => {
    await actuarComo(db, U.pedro);
    await expect(sql("update public.eventos set titulo = 'x' where id = $1", [E_JOV])).rejects.toThrow();
    await expect(sql("delete from public.eventos where id = $1", [E_JOV])).rejects.toThrow();
  });
  it("la líder borra su evento; si se borra el ministerio, sus eventos quedan como generales", async () => {
    await actuarComo(db, U.admin);
    const E2 = "d6000000-0000-0000-0000-000000000002";
    await sql("insert into public.eventos (id, titulo, fecha, ministerio_id, iglesia_id) values ($1, 'Té de damas', '2027-05-10', $2, $3)", [E2, M_DAM, IG]);
    await sql("delete from public.ministerios where id = $1", [M_DAM]);
    expect((await sql("select ministerio_id from public.eventos where id = $1", [E2])).rows[0].ministerio_id).toBeNull();
    await actuarComo(db, U.lucia);
    await sql("delete from public.eventos where id = $1", [E_JOV]);
    expect((await sql("select count(*)::int as n from public.eventos where id = $1", [E_JOV])).rows[0].n).toBe(0);
  });
});
