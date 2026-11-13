import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Control remoto (2026-11-13): quién puede mandarle órdenes a la consola que transmite, revisado por la
// RLS REAL de supabase/migrations/20261118000000_control_remoto.sql.
describe("control remoto: permisos de las órdenes en vivo (RLS real)", () => {
  let db;
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const MULTIMEDIA = "aaaaaaaa-0000-0000-0000-000000000001";
  const PREDICADOR = "aaaaaaaa-0000-0000-0000-000000000002";
  const MIEMBRO = "aaaaaaaa-0000-0000-0000-000000000003";
  const ADMIN_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const EVENTO = "e1111111-1111-1111-1111-111111111111";
  const BLOQUE = "b1111111-1111-1111-1111-111111111111";
  const OTRO_BLOQUE = "b2222222-2222-2222-2222-222222222222";

  const mandar = async (quien, fila) => {
    await actuarComo(db, quien);
    const cols = Object.keys(fila);
    try {
      await db.query(`insert into public.comandos_en_vivo (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, Object.values(fila));
      return true;
    } catch (e) {
      if (process.env.DEBUG_RLS) console.log("RECHAZO", quien, JSON.stringify(fila), e.message);
      return false;
    }
  };

  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`
      insert into public.iglesias (id, nombre, slug) values ('${A}', 'Iglesia A', 'iglesia-a'), ('${B}', 'Iglesia B', 'iglesia-b');
      insert into auth.users (id, email) values ('${ADMIN}', 'a@x.com'), ('${MULTIMEDIA}', 'm@x.com'), ('${PREDICADOR}', 'p@x.com'), ('${MIEMBRO}', 'mi@x.com'), ('${ADMIN_B}', 'b@x.com');
      insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
        ('${ADMIN}', 'a@x.com', 'Admin', 'admin', '${A}'),
        ('${MULTIMEDIA}', 'm@x.com', 'Multi', 'multimedia', '${A}'),
        ('${PREDICADOR}', 'p@x.com', 'Pastor', 'miembro', '${A}'),
        ('${MIEMBRO}', 'mi@x.com', 'Miembro', 'miembro', '${A}'),
        ('${ADMIN_B}', 'b@x.com', 'Admin B', 'admin', '${B}');
    `);
    await actuarComo(db, ADMIN);
    await db.query(`insert into public.eventos (id, titulo, iglesia_id) values ($1, 'Domingo', $2)`, [EVENTO, A]);
    await db.query(`insert into public.items_servicio (id, evento_id, tipo, titulo, orden, iglesia_id) values ($1, $2, 'bloque', 'Predicación', 1, $3), ($4, $2, 'bloque', 'Alabanza', 0, $3)`, [BLOQUE, EVENTO, A, OTRO_BLOQUE]);
    await db.query(`insert into public.miembros_rol (nombre, usuario_id, item_servicio_id, iglesia_id) values ('Pastor', $1, $2, $3)`, [PREDICADOR, BLOQUE, A]);
    await db.query(`insert into public.sesiones_en_vivo (iglesia_id, evento_id, liderado_por) values ($1, $2, $3)`, [A, EVENTO, ADMIN]);
  });
  afterAll(async () => { await db.close(); });

  it("Multimedia y el administrador pueden mandar cualquier orden", async () => {
    expect(await mandar(MULTIMEDIA, { accion: "siguiente" })).toBe(true);
    expect(await mandar(MULTIMEDIA, { accion: "negro" })).toBe(true);
    expect(await mandar(ADMIN, { accion: "ir_item", item_id: "x" })).toBe(true);
  });

  it("un miembro cualquiera no puede mover las diapositivas", async () => {
    expect(await mandar(MIEMBRO, { accion: "siguiente" })).toBe(false);
    expect(await mandar(MIEMBRO, { accion: "siguiente", bloque_id: BLOQUE })).toBe(false); // no predica ahí
  });

  it("el predicador: solo siguiente/anterior y solo en SU bloque de predicación del evento en vivo", async () => {
    expect(await mandar(PREDICADOR, { accion: "siguiente", bloque_id: BLOQUE })).toBe(true);
    expect(await mandar(PREDICADOR, { accion: "anterior", bloque_id: BLOQUE })).toBe(true);
    expect(await mandar(PREDICADOR, { accion: "negro", bloque_id: BLOQUE })).toBe(false);
    expect(await mandar(PREDICADOR, { accion: "siguiente", bloque_id: OTRO_BLOQUE })).toBe(false);
    expect(await mandar(PREDICADOR, { accion: "siguiente" })).toBe(false); // sin bloque = orden de Multimedia
  });

  it("nadie puede mandar a nombre de otro ni a otra iglesia", async () => {
    expect(await mandar(MULTIMEDIA, { accion: "siguiente", usuario_id: ADMIN })).toBe(false);
    expect(await mandar(ADMIN_B, { accion: "siguiente", iglesia_id: A })).toBe(false);
  });

  it("cada iglesia solo ve sus propias órdenes", async () => {
    await actuarComo(db, ADMIN_B);
    expect((await db.query(`select id from public.comandos_en_vivo`)).rows).toHaveLength(0);
    await actuarComo(db, MIEMBRO);
    expect((await db.query(`select id from public.comandos_en_vivo`)).rows.length).toBeGreaterThan(0);
  });
});
