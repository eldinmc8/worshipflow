import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261107000000_canciones_de_fabrica.sql: toda iglesia nueva recibe una copia de
// las canciones de fábrica (con partes, diapositivas y estructura), sin duplicar las que ya tenga.
const IG_ORIGEN = "11111111-1111-1111-1111-1111111111e1";
const IG_NUEVA = "11111111-1111-1111-1111-1111111111e2";
const IG_CON_UNA = "11111111-1111-1111-1111-1111111111e3";
const S1 = "c5000000-0000-0000-0000-000000000001";
const S2 = "c5000000-0000-0000-0000-000000000002";
const ADMIN = "a5000000-0000-0000-0000-000000000001";

let db;
const sql = (q, p) => db.query(q, p);
const comoServidor = async () => { await db.query("reset role"); await db.query("select set_config('test.uid', '', false)"); };
const sembrar = async (ig) => { await comoServidor(); return (await sql("select public.sembrar_canciones_default($1) as n", [ig])).rows[0].n; };

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values
      ('${IG_ORIGEN}', 'Origen', 'fab-origen'), ('${IG_NUEVA}', 'Nueva', 'fab-nueva'), ('${IG_CON_UNA}', 'Con una', 'fab-con-una');
    insert into public.canciones (id, titulo, artista, tonalidad, tempo, favorito, iglesia_id) values
      ('${S1}', 'Abres caminos ', 'Osinachi', 'G', 70, true, '${IG_ORIGEN}'),
      ('${S2}', 'Gracia sublime es', 'Desconocido', 'D', 68, false, '${IG_ORIGEN}');
    insert into public.secciones_cancion (cancion_id, clave, etiqueta, contenido, iglesia_id) values
      ('${S1}', 'V1', 'Verso 1', '[G]Abres caminos', '${IG_ORIGEN}'), ('${S1}', 'C', 'Coro', '[C]Obras milagros', '${IG_ORIGEN}'),
      ('${S2}', 'V1', 'Verso 1', '[D]Gracia sublime', '${IG_ORIGEN}');
    insert into public.diapositivas_letra (cancion_id, seccion_clave, texto, orden, iglesia_id) values
      ('${S1}', 'V1', 'Abres caminos', 0, '${IG_ORIGEN}'), ('${S1}', 'C', 'Obras milagros', 0, '${IG_ORIGEN}'),
      ('${S2}', 'V1', 'Gracia sublime', 0, '${IG_ORIGEN}');
    insert into public.estructura_cancion (cancion_id, orden, seccion_clave, multiplicador, iglesia_id) values
      ('${S1}', 0, 'V1', 1, '${IG_ORIGEN}'), ('${S1}', 1, 'C', 2, '${IG_ORIGEN}'), ('${S2}', 0, 'V1', 1, '${IG_ORIGEN}');
    insert into public.canciones_de_fabrica (cancion_id, orden) values ('${S1}', 0), ('${S2}', 1);
    insert into public.canciones (titulo, iglesia_id) values ('GRACIA SUBLIME ES', '${IG_CON_UNA}');
    insert into auth.users (id, email) values ('${ADMIN}', 'fab@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values ('${ADMIN}', 'fab@x.com', 'Admin', 'admin', '${IG_NUEVA}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("canciones de fábrica", () => {
  it("copia las canciones completas a una iglesia nueva", async () => {
    expect(await sembrar(IG_NUEVA)).toBe(2);
    const c = await sql("select id, titulo, tonalidad, favorito from public.canciones where iglesia_id = $1 order by titulo", [IG_NUEVA]);
    expect(c.rows.map((r) => [r.titulo, r.tonalidad, r.favorito])).toEqual([["Abres caminos", "G", false], ["Gracia sublime es", "D", false]]);
    const id = c.rows[0].id;
    expect(id).not.toBe(S1);
    const partes = await sql("select clave, contenido, iglesia_id from public.secciones_cancion where cancion_id = $1 order by clave desc", [id]);
    expect(partes.rows).toEqual([
      { clave: "V1", contenido: "[G]Abres caminos", iglesia_id: IG_NUEVA },
      { clave: "C", contenido: "[C]Obras milagros", iglesia_id: IG_NUEVA },
    ]);
    const diap = await sql("select count(*)::int as n from public.diapositivas_letra where cancion_id = $1 and iglesia_id = $2", [id, IG_NUEVA]);
    expect(diap.rows[0].n).toBe(2);
    const est = await sql("select seccion_clave, multiplicador from public.estructura_cancion where cancion_id = $1 order by orden", [id]);
    expect(est.rows).toEqual([{ seccion_clave: "V1", multiplicador: 1 }, { seccion_clave: "C", multiplicador: 2 }]);
  });

  it("no duplica si se vuelve a correr", async () => {
    expect(await sembrar(IG_NUEVA)).toBe(0);
  });

  it("no repite una canción que la iglesia ya tiene con el mismo título", async () => {
    expect(await sembrar(IG_CON_UNA)).toBe(1);
    const r = await sql("select count(*)::int as n from public.canciones where iglesia_id = $1", [IG_CON_UNA]);
    expect(r.rows[0].n).toBe(2);
  });

  it("la iglesia de origen no se copia a sí misma", async () => {
    expect(await sembrar(IG_ORIGEN)).toBe(0);
  });

  it("la iglesia nueva puede editar su copia sin tocar el original", async () => {
    await actuarComo(db, ADMIN);
    await sql("update public.secciones_cancion set contenido = 'cambiado' where iglesia_id = $1", [IG_NUEVA]);
    await comoServidor();
    const r = await sql("select contenido from public.secciones_cancion where cancion_id = $1 and clave = 'V1'", [S1]);
    expect(r.rows[0].contenido).toBe("[G]Abres caminos");
  });

  it("nadie con sesión puede llamar la función", async () => {
    await actuarComo(db, ADMIN);
    await expect(sql("select public.sembrar_canciones_default($1)", [IG_NUEVA])).rejects.toThrow();
  });
});
