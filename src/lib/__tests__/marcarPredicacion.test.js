import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261108000000_marcar_predicacion.sql: un bloque marcado a mano como predicación
// (estructura.predicacion) le da al predicador asignado su bosquejo, aunque no se llame "Predicación";
// y un bloque desmarcado no, aunque se llame "Mensaje".
const IG = "11111111-1111-1111-1111-1111111111f1";
const U = { admin: "a6000000-0000-0000-0000-000000000001", pedro: "a6000000-0000-0000-0000-000000000002" };
const E = "d6000000-0000-0000-0000-000000000001";
const B = { palabra: "e6000000-0000-0000-0000-000000000001", mensaje: "e6000000-0000-0000-0000-000000000002", ensenanza: "e6000000-0000-0000-0000-000000000003" };

let db;
const sql = (q, p) => db.query(q, p);
const guardarBosquejo = (bloque) => sql(`insert into public.bosquejos (item_servicio_id, evento_id, iglesia_id, titulo) values ($1, $2, $3, 'Mi sermón')`, [bloque, E, IG]);

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG}', 'Iglesia', 'marca-pred');
    insert into auth.users (id, email) values ('${U.admin}', 'ad@x.com'), ('${U.pedro}', 'pe@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${U.admin}', 'ad@x.com', 'Admin', 'admin', '${IG}'), ('${U.pedro}', 'pe@x.com', 'Pedro', 'miembro', '${IG}');
    insert into public.eventos (id, titulo, fecha, iglesia_id) values ('${E}', 'Domingo', '2026-11-08', '${IG}');
    insert into public.items_servicio (id, evento_id, orden, tipo, titulo, estructura, iglesia_id) values
      ('${B.palabra}', '${E}', 0, 'bloque', 'La Palabra', '{"predicacion": true}', '${IG}'),
      ('${B.mensaje}', '${E}', 1, 'bloque', 'Mensaje de bienvenida', '{"predicacion": false}', '${IG}'),
      ('${B.ensenanza}', '${E}', 2, 'bloque', 'Enseñanza', '[]', '${IG}');
    insert into public.miembros_rol (item_servicio_id, nombre, usuario_id, estado, iglesia_id) values
      ('${B.palabra}', 'Pedro', '${U.pedro}', 'confirmado', '${IG}'),
      ('${B.mensaje}', 'Pedro', '${U.pedro}', 'confirmado', '${IG}'),
      ('${B.ensenanza}', 'Pedro', '${U.pedro}', 'confirmado', '${IG}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("marcar a mano el bloque de la predicación", () => {
  it("el predicador arma su bosquejo en un bloque marcado aunque no se llame Predicación", async () => {
    await actuarComo(db, U.pedro);
    await expect(guardarBosquejo(B.palabra)).resolves.toBeTruthy();
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, titulo, estructura, es_punto_bosquejo, iglesia_id) values ($1, 9, 'slide', 'Punto 1', $2::jsonb, true, $3)`,
      [E, JSON.stringify({ bosquejoDe: B.palabra }), IG])).resolves.toBeTruthy();
  });
  it("un bloque desmarcado no cuenta aunque se llame Mensaje", async () => {
    await actuarComo(db, U.pedro);
    await expect(guardarBosquejo(B.mensaje)).rejects.toThrow();
  });
  it("sin marca, se reconoce por el nombre como antes", async () => {
    await actuarComo(db, U.pedro);
    await expect(guardarBosquejo(B.ensenanza)).rejects.toThrow();
  });
  it("el predicador no puede marcar bloques él mismo; quien arma el Setlist sí", async () => {
    await actuarComo(db, U.pedro);
    await expect(sql(`update public.items_servicio set estructura = '{"predicacion": true}' where id = $1`, [B.ensenanza])).rejects.toThrow(/permiso/);
    await actuarComo(db, U.admin);
    await expect(sql(`update public.items_servicio set estructura = '{"predicacion": true}' where id = $1`, [B.ensenanza])).resolves.toBeTruthy();
    await actuarComo(db, U.pedro);
    await expect(guardarBosquejo(B.ensenanza)).resolves.toBeTruthy();
  });
});
