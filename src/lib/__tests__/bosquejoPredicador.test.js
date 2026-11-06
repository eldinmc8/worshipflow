import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261103000000_bosquejo_predicador.sql: el predicador ASIGNADO a un bloque de
// Predicación guarda su bosquejo y maneja SOLO las diapositivas que salen de él (marcadas con
// estructura.bosquejoDe = id de su bloque); nadie más gana permisos por esto.
const IG = "11111111-1111-1111-1111-111111111111";
const U = {
  admin: "a1000000-0000-0000-0000-000000000001",
  pedro: "a1000000-0000-0000-0000-000000000002", // miembro, asignado a la Predicación de E1
  ana: "a1000000-0000-0000-0000-000000000003", // miembro, encargada de la Lectura de E1
  carlos: "a1000000-0000-0000-0000-000000000004", // miembro sin nada
};
const E1 = "d1000000-0000-0000-0000-000000000001";
const E2 = "d1000000-0000-0000-0000-000000000002";
const B = {
  pred: "e1000000-0000-0000-0000-000000000001",
  lect: "e1000000-0000-0000-0000-000000000002",
  predE2: "e1000000-0000-0000-0000-000000000003",
  canc: "e1000000-0000-0000-0000-000000000004",
};
const CAN = "f1100000-0000-0000-0000-000000000001";
const S1 = "e1100000-0000-0000-0000-000000000001";
const S2 = "e1100000-0000-0000-0000-000000000002";

let db;
const como = (u) => actuarComo(db, U[u]);
const sql = (q, p) => db.query(q, p);
const marca = (bloque) => JSON.stringify({ bosquejoDe: bloque });
const insertarSlide = (id, evento, estructura, titulo = "Punto 1") =>
  sql(`insert into public.items_servicio (id, evento_id, orden, tipo, titulo, estructura, es_punto_bosquejo, iglesia_id) values ($1, $2, 9, 'slide', $3, $4::jsonb, true, $5)`, [id, evento, titulo, estructura, IG]);

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  const usuarios = [[U.admin, "admin"], [U.pedro, "miembro"], [U.ana, "miembro"], [U.carlos, "miembro"]];
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG}', 'Iglesia', 'iglesia');
    insert into auth.users (id, email) values ${usuarios.map(([id]) => `('${id}', '${id}@x.com')`).join(",")};
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values ${usuarios.map(([id, rol]) => `('${id}', '${id}@x.com', '${id}', '${rol}', '${IG}')`).join(",")};
    insert into public.canciones (id, titulo, tonalidad, iglesia_id) values ('${CAN}', 'Way Maker', 'G', '${IG}');
    insert into public.eventos (id, titulo, fecha, iglesia_id) values ('${E1}', 'Domingo', '2026-11-08', '${IG}'), ('${E2}', 'Miércoles', '2026-11-11', '${IG}');
    insert into public.items_servicio (id, evento_id, orden, tipo, titulo, iglesia_id) values
      ('${B.lect}', '${E1}', 0, 'bloque', 'Lectura y oración', '${IG}'),
      ('${B.pred}', '${E1}', 2, 'bloque', 'Predicación', '${IG}'),
      ('${B.predE2}', '${E2}', 0, 'bloque', 'Predicación', '${IG}');
    insert into public.items_servicio (id, evento_id, orden, tipo, cancion_id, iglesia_id) values ('${B.canc}', '${E1}', 1, 'cancion', '${CAN}', '${IG}');
    insert into public.miembros_rol (item_servicio_id, nombre, usuario_id, estado, iglesia_id) values
      ('${B.pred}', 'Pedro', '${U.pedro}', 'confirmado', '${IG}'),
      ('${B.lect}', 'Ana', '${U.ana}', 'confirmado', '${IG}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("diapositivas del bosquejo en el Setlist", () => {
  it("el predicador agrega diapositivas marcadas con SU bloque", async () => {
    await como("pedro");
    await expect(insertarSlide(S1, E1, marca(B.pred))).resolves.toBeTruthy();
    await expect(sql(`insert into public.items_servicio (id, evento_id, orden, tipo, referencia, version_biblia, texto_biblia, estructura, iglesia_id) values ($1, $2, 10, 'biblia', 'Juan 3:16', 'RVR1960', 'Porque de tal manera...', $3::jsonb, $4)`, [S2, E1, marca(B.pred), IG])).resolves.toBeTruthy();
  });
  it("pero no diapositivas sueltas, ni de otro bloque, ni de la Predicación de otro evento", async () => {
    await como("pedro");
    await expect(insertarSlide(null, E1, "[]")).rejects.toThrow(/permiso/);
    await expect(insertarSlide(null, E1, marca(B.lect))).rejects.toThrow(/permiso/);
    await expect(insertarSlide(null, E2, marca(B.predE2))).rejects.toThrow(/permiso/);
    await expect(insertarSlide(null, E1, marca(B.predE2))).rejects.toThrow(/permiso/);
    await expect(insertarSlide(null, E1, JSON.stringify({ bosquejoDe: "no-es-un-id" }))).rejects.toThrow(/permiso/);
  });
  it("puede cambiar y quitar SUS diapositivas, pero no quitarles la marca ni tocar lo demás", async () => {
    await como("pedro");
    await expect(sql(`update public.items_servicio set titulo = 'Punto 1: La gracia', orden = 3 where id = $1`, [S1])).resolves.toBeTruthy();
    await expect(sql(`update public.items_servicio set estructura = '[]'::jsonb where id = $1`, [S1])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.items_servicio set tonalidad_override = 'A' where id = $1`, [B.canc])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.items_servicio set titulo = 'Otra cosa' where id = $1`, [B.pred])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.items_servicio where id = $1`, [B.canc])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.items_servicio where id = $1`, [S2])).resolves.toBeTruthy();
  });
  it("quien no predica no puede usar la marca", async () => {
    await como("ana");
    await expect(insertarSlide(null, E1, marca(B.pred))).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.items_servicio where id = $1`, [S1])).rejects.toThrow(/permiso/);
    await como("carlos");
    await expect(insertarSlide(null, E1, marca(B.pred))).rejects.toThrow(/permiso/);
    await expect(sql(`update public.items_servicio set titulo = 'X' where id = $1`, [S1])).rejects.toThrow(/permiso/);
  });
  it("el predicador puede renumerar el orden del Setlist (la app lo reenvía al insertar)", async () => {
    await como("pedro");
    await expect(sql(`update public.items_servicio set orden = 5 where id = $1`, [B.canc])).resolves.toBeTruthy();
  });
});

describe("tabla bosquejos", () => {
  const guardar = (item, evento, titulo) => sql(
    `insert into public.bosquejos (item_servicio_id, evento_id, titulo, iglesia_id) values ($1, $2, $3, $4)
     on conflict (item_servicio_id) do update set titulo = excluded.titulo`, [item, evento, titulo, IG]);

  it("el predicador asignado guarda y actualiza su bosquejo", async () => {
    await como("pedro");
    await expect(guardar(B.pred, E1, "La gracia que transforma")).resolves.toBeTruthy();
    await expect(guardar(B.pred, E1, "La gracia que restaura")).resolves.toBeTruthy();
    const r = await sql(`select titulo from public.bosquejos where item_servicio_id = $1`, [B.pred]);
    expect(r.rows[0].titulo).toBe("La gracia que restaura");
  });
  it("no puede guardar bosquejo en otro bloque, en otra Predicación ni con el evento cambiado", async () => {
    await como("pedro");
    await expect(guardar(B.lect, E1, "X")).rejects.toThrow();
    await expect(guardar(B.predE2, E2, "X")).rejects.toThrow();
    await expect(guardar(B.pred, E2, "X")).rejects.toThrow();
  });
  it("los demás lo leen pero no lo cambian; el admin sí", async () => {
    await como("carlos");
    const r = await sql(`select titulo from public.bosquejos where item_servicio_id = $1`, [B.pred]);
    expect(r.rows).toHaveLength(1);
    await sql(`update public.bosquejos set titulo = 'X' where item_servicio_id = $1`, [B.pred]);
    await expect(guardar(B.predE2, E2, "X")).rejects.toThrow();
    await como("admin");
    await expect(guardar(B.predE2, E2, "Bosquejo del miércoles")).resolves.toBeTruthy();
    await como("pedro");
    const r2 = await sql(`select titulo from public.bosquejos where item_servicio_id = $1`, [B.pred]);
    expect(r2.rows[0].titulo).toBe("La gracia que restaura");
  });
  it("el botón Eliminar: alguien que no predica no lo borra; el predicador sí", async () => {
    await como("carlos");
    await sql(`delete from public.bosquejos where item_servicio_id = $1`, [B.pred]);
    expect((await sql(`select count(*)::int as n from public.bosquejos where item_servicio_id = $1`, [B.pred])).rows[0].n).toBe(1);
    await como("pedro");
    await sql(`delete from public.bosquejos where item_servicio_id = $1`, [B.pred]);
    expect((await sql(`select count(*)::int as n from public.bosquejos where item_servicio_id = $1`, [B.pred])).rows[0].n).toBe(0);
  });
  it("se borra solo si se borra el bloque", async () => {
    await como("admin");
    await sql(`delete from public.items_servicio where id = $1`, [B.predE2]);
    const r = await sql(`select count(*)::int as n from public.bosquejos where item_servicio_id = $1`, [B.predE2]);
    expect(r.rows[0].n).toBe(0);
  });
});
