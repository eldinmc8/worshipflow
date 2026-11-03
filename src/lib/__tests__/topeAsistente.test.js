import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261106000000_tope_asistente.sql: cada iglesia tiene un tope de mensajes al día
// para el asistente con IA; la Edge Function reserva antes de llamar a Claude y devuelve si falla.
const IG_A = "11111111-1111-1111-1111-1111111111d1";
const IG_B = "11111111-1111-1111-1111-1111111111d2";
const U = { adminA: "a4000000-0000-0000-0000-000000000001", miembroA: "a4000000-0000-0000-0000-000000000002" };

let db;
const sql = (q, p) => db.query(q, p);
const comoServidor = async () => { await db.query("reset role"); await db.query("select set_config('test.uid', '', false)"); };
const reservar = async (ig) => { await comoServidor(); return (await sql("select public.reservar_mensaje_asistente($1) as r", [ig])).rows[0].r; };

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug, limite_asistente_diario) values ('${IG_A}', 'A', 'tope-a', 3), ('${IG_B}', 'B', 'tope-b', 30);
    insert into auth.users (id, email) values ('${U.adminA}', 'a@x.com'), ('${U.miembroA}', 'm@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${U.adminA}', 'a@x.com', 'Admin', 'admin', '${IG_A}'), ('${U.miembroA}', 'm@x.com', 'Miembro', 'miembro', '${IG_A}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("tope diario del asistente", () => {
  it("las iglesias empiezan con 30 mensajes al día", async () => {
    await comoServidor();
    await sql("insert into public.iglesias (id, nombre, slug) values ('11111111-1111-1111-1111-1111111111d3', 'C', 'tope-c')");
    const r = await sql("select limite_asistente_diario as l from public.iglesias where slug = 'tope-c'");
    expect(r.rows[0].l).toBe(30);
  });
  it("deja pasar hasta el tope y luego no", async () => {
    expect(await reservar(IG_A)).toEqual({ permitido: true, usados: 1, limite: 3 });
    expect(await reservar(IG_A)).toEqual({ permitido: true, usados: 2, limite: 3 });
    expect(await reservar(IG_A)).toEqual({ permitido: true, usados: 3, limite: 3 });
    expect(await reservar(IG_A)).toEqual({ permitido: false, usados: 3, limite: 3 });
    // Otra iglesia no se ve afectada.
    expect(await reservar(IG_B)).toEqual({ permitido: true, usados: 1, limite: 30 });
  });
  it("si Claude falla, el mensaje se devuelve", async () => {
    await comoServidor();
    await sql("select public.devolver_mensaje_asistente($1)", [IG_A]);
    expect(await reservar(IG_A)).toEqual({ permitido: true, usados: 3, limite: 3 });
  });
  it("anota los tokens usados", async () => {
    await comoServidor();
    await sql("select public.sumar_tokens_asistente($1, 12000, 800)", [IG_A]);
    await sql("select public.sumar_tokens_asistente($1, 3000, 200)", [IG_A]);
    const r = await sql("select tokens_entrada::int as e, tokens_salida::int as s from public.uso_asistente where iglesia_id = $1", [IG_A]);
    expect(r.rows[0]).toEqual({ e: 15000, s: 1000 });
  });
  it("cada día empieza de cero", async () => {
    await comoServidor();
    await sql("update public.uso_asistente set fecha = fecha - 1 where iglesia_id = $1", [IG_A]);
    expect(await reservar(IG_A)).toEqual({ permitido: true, usados: 1, limite: 3 });
  });
  it("nadie con sesión puede sumarse ni restarse mensajes", async () => {
    await actuarComo(db, U.adminA);
    await expect(sql("select public.reservar_mensaje_asistente($1)", [IG_A])).rejects.toThrow();
    await expect(sql("select public.devolver_mensaje_asistente($1)", [IG_A])).rejects.toThrow();
  });
  it("el admin ve el uso de su iglesia; un miembro no", async () => {
    await actuarComo(db, U.adminA);
    expect((await sql("select mensajes from public.uso_asistente where iglesia_id = $1", [IG_A])).rows.length).toBeGreaterThan(0);
    expect((await sql("select mensajes from public.uso_asistente where iglesia_id = $1", [IG_B])).rows).toHaveLength(0);
    await actuarComo(db, U.miembroA);
    expect((await sql("select mensajes from public.uso_asistente")).rows).toHaveLength(0);
  });
});
