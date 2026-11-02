import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261105000000_conectar_tv.sql: el TV muestra un número, Multimedia lo escribe en
// la app y el TV recibe la dirección de la pantalla con el código vigente de esa iglesia.
const IG = "11111111-1111-1111-1111-1111111111c1";
const U = { admin: "a3000000-0000-0000-0000-000000000001", miembro: "a3000000-0000-0000-0000-000000000002" };
const TOKEN_A = "tv-token-aaaaaaaaaaaaaaaaaaaaaaaa";
const TOKEN_B = "tv-token-bbbbbbbbbbbbbbbbbbbbbbbb";

let db;
const como = (u) => actuarComo(db, u ? U[u] : null);
const sql = (q, p) => db.query(q, p);
const pedir = async (token) => { await como(null); return (await sql(`select public.tv_pedir_codigo($1) as c`, [token])).rows[0].c; };
const estado = async (token) => { await como(null); return (await sql(`select public.tv_estado($1) as e`, [token])).rows[0].e; };

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG}', 'Iglesia TV', 'iglesia-tv');
    insert into auth.users (id, email) values ('${U.admin}', 'a@x.com'), ('${U.miembro}', 'm@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${U.admin}', 'a@x.com', 'Admin', 'admin', '${IG}'), ('${U.miembro}', 'm@x.com', 'Miembro', 'miembro', '${IG}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("conectar TV", () => {
  it("el TV recibe un número de 6 dígitos y lo conserva mientras espera", async () => {
    const c = await pedir(TOKEN_A);
    expect(c).toMatch(/^\d{6}$/);
    expect(await pedir(TOKEN_A)).toBe(c);
    expect(await estado(TOKEN_A)).toEqual({ estado: "pendiente", codigo: c });
    const otro = await pedir(TOKEN_B);
    expect(otro).not.toBe(c);
  });
  it("no acepta un token corto", async () => {
    await como(null);
    await expect(sql(`select public.tv_pedir_codigo('corto')`)).rejects.toThrow(/Token/);
  });
  it("un miembro sin permisos ni alguien sin sesión pueden conectar", async () => {
    const c = await pedir(TOKEN_A);
    await como("miembro");
    await expect(sql(`select public.tv_vincular($1, 'proyeccion')`, [c])).rejects.toThrow(/permiso/);
    await como(null);
    await expect(sql(`select public.tv_vincular($1, 'proyeccion')`, [c])).rejects.toThrow();
  });
  it("Multimedia conecta el TV y el TV recibe la dirección con el código vigente (una sola vez)", async () => {
    const c = await pedir(TOKEN_A);
    await como("admin");
    await expect(sql(`select public.tv_vincular($1, 'escenario')`, [c])).resolves.toBeTruthy();
    await como("admin");
    const codigoIglesia = (await sql(`select public.codigo_pantalla_actual() as c`)).rows[0].c;
    const e = await estado(TOKEN_A);
    expect(e).toMatchObject({ estado: "vinculado", tipo: "escenario", slug: "iglesia-tv", iglesia_id: IG, codigo: codigoIglesia });
    expect((await estado(TOKEN_A)).estado).toBe("nuevo");
  });
  it("un número equivocado o ya usado no conecta nada", async () => {
    await como("admin");
    await expect(sql(`select public.tv_vincular('000000', 'proyeccion')`)).rejects.toThrow(/no existe|venció/);
    await expect(sql(`select public.tv_vincular('123456', 'otra')`)).rejects.toThrow(/inválido/);
  });
  it("un número viejo (más de 15 minutos) ya no sirve y el TV pide otro", async () => {
    const c = await pedir(TOKEN_B);
    await como(null);
    await db.query(`reset role`);
    await sql(`update public.tvs_por_vincular set creado_at = now() - interval '20 minutes' where token = $1`, [TOKEN_B]);
    await como("admin");
    await expect(sql(`select public.tv_vincular($1, 'proyeccion')`, [c])).rejects.toThrow(/no existe|venció/);
    expect((await estado(TOKEN_B)).estado).toBe("nuevo");
  });
  it("sin sesión no se puede leer la tabla directamente", async () => {
    await pedir(TOKEN_A);
    await como(null);
    const r = await sql(`select * from public.tvs_por_vincular`).catch(() => ({ rows: [] }));
    expect(r.rows).toHaveLength(0);
  });
});
