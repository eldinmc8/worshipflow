import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261104000000_enlace_pantalla_que_vence.sql: las pantallas sin sesión solo ven lo
// que está al aire con el código vigente, y el código cambia solo al finalizar la transmisión.
const IG_A = "11111111-1111-1111-1111-11111111111a";
const IG_B = "11111111-1111-1111-1111-11111111111b";
const U = {
  adminA: "a2000000-0000-0000-0000-000000000001",
  miembroA: "a2000000-0000-0000-0000-000000000002",
  adminB: "a2000000-0000-0000-0000-000000000003",
};
const EV_A = "d2000000-0000-0000-0000-000000000001";

let db;
const como = (u) => actuarComo(db, u ? U[u] : null);
const sql = (q, p) => db.query(q, p);
const codigoDe = async (u) => { await como(u); return (await sql(`select public.codigo_pantalla_actual() as c`)).rows[0].c; };
const publica = async (iglesia, codigo) => { await como(null); return (await sql(`select public.sesion_en_vivo_publica($1, $2) as s`, [iglesia, codigo])).rows[0].s; };

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  const usuarios = [[U.adminA, "admin", IG_A], [U.miembroA, "miembro", IG_A], [U.adminB, "admin", IG_B]];
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG_A}', 'A', 'iglesia-a'), ('${IG_B}', 'B', 'iglesia-b');
    insert into auth.users (id, email) values ${usuarios.map(([id]) => `('${id}', '${id}@x.com')`).join(",")};
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values ${usuarios.map(([id, rol, ig]) => `('${id}', '${id}@x.com', '${id}', '${rol}', '${ig}')`).join(",")};
    insert into public.eventos (id, titulo, fecha, iglesia_id) values ('${EV_A}', 'Domingo', '2026-11-08', '${IG_A}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("código de las pantallas", () => {
  it("cada iglesia tiene su propio código, que se mantiene mientras no se renueve", async () => {
    const a1 = await codigoDe("adminA");
    const a2 = await codigoDe("miembroA");
    const b = await codigoDe("adminB");
    expect(a1).toMatch(/^[0-9a-f]{12}$/);
    expect(a2).toBe(a1);
    expect(b).not.toBe(a1);
  });
  it("sin sesión no se puede pedir el código", async () => {
    await como(null);
    await expect(sql(`select public.codigo_pantalla_actual()`)).rejects.toThrow();
  });
});

describe("pantalla sin sesión", () => {
  it("con el código vigente ve lo que está al aire; sin código o con otro, no", async () => {
    await como("adminA");
    await sql(`insert into public.sesiones_en_vivo (iglesia_id, evento_id, slide_actual) values ($1, $2, '{"type":"slide","title":"Bienvenidos"}') on conflict (iglesia_id) do update set evento_id = excluded.evento_id, slide_actual = excluded.slide_actual`, [IG_A, EV_A]);
    const codigo = await codigoDe("adminA");
    const ok = await publica(IG_A, codigo);
    expect(ok.slide_actual.title).toBe("Bienvenidos");
    expect(await publica(IG_A, "000000000000")).toBeNull();
    expect(await publica(IG_A, null)).toBeNull();
    expect(await publica(IG_B, codigo)).toBeNull();
  });
  it("ya no puede leer la tabla directamente", async () => {
    await como(null);
    const r = await sql(`select * from public.sesiones_en_vivo`).catch(() => ({ rows: [] }));
    expect(r.rows).toHaveLength(0);
  });
  it("cada iglesia lee solo su propia sesión en vivo", async () => {
    await como("adminB");
    expect((await sql(`select * from public.sesiones_en_vivo where iglesia_id = $1`, [IG_A])).rows).toHaveLength(0);
    await como("miembroA");
    expect((await sql(`select * from public.sesiones_en_vivo where iglesia_id = $1`, [IG_A])).rows).toHaveLength(1);
  });
});

describe("vence solo al finalizar la transmisión", () => {
  it("cambiar de diapositiva no cambia el código; finalizar sí", async () => {
    const antes = await codigoDe("adminA");
    await como("adminA");
    await sql(`update public.sesiones_en_vivo set slide_actual = '{"type":"slide","title":"Otra"}' where iglesia_id = $1`, [IG_A]);
    expect(await codigoDe("adminA")).toBe(antes);
    await como("adminA");
    await sql(`update public.sesiones_en_vivo set evento_id = null, slide_actual = null, libre = false where iglesia_id = $1`, [IG_A]);
    const despues = await codigoDe("adminA");
    expect(despues).not.toBe(antes);
    expect(await publica(IG_A, antes)).toBeNull();
    expect(await publica(IG_A, despues)).not.toBeNull();
  });
  it("la transmisión libre también renueva el código al terminar", async () => {
    const antes = await codigoDe("adminA");
    await como("adminA");
    await sql(`update public.sesiones_en_vivo set libre = true where iglesia_id = $1`, [IG_A]);
    await sql(`update public.sesiones_en_vivo set libre = false where iglesia_id = $1`, [IG_A]);
    expect(await codigoDe("adminA")).not.toBe(antes);
  });
});

describe("renovar a mano", () => {
  it("quien controla En vivo puede; un miembro no", async () => {
    const antes = await codigoDe("adminA");
    await como("miembroA");
    await expect(sql(`select public.renovar_codigo_pantalla()`)).rejects.toThrow(/permiso/);
    await como("adminA");
    const nuevo = (await sql(`select public.renovar_codigo_pantalla() as c`)).rows[0].c;
    expect(nuevo).not.toBe(antes);
    expect(await codigoDe("miembroA")).toBe(nuevo);
  });
});
