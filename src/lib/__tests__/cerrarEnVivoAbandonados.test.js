import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba } from "./pgliteHarness.js";

// Prueba la migración 20261113000000_cerrar_en_vivo_abandonados.sql: la base cierra sola los en vivo
// con más de 2 horas sin cambios, aunque nadie de esa iglesia tenga la app abierta.
const IG = ["11111111-1111-1111-1111-1111111111c1", "11111111-1111-1111-1111-1111111111c2", "11111111-1111-1111-1111-1111111111c3", "11111111-1111-1111-1111-1111111111c4"];
const EV = "d3000000-0000-0000-0000-000000000001";

let db;
const fila = async (ig) => (await db.query(`select evento_id, libre, slide_actual, estilo_en_vivo from public.sesiones_en_vivo where iglesia_id = $1`, [ig])).rows[0];

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ${IG.map((id, i) => `('${id}', 'I${i}', 'i-${i}')`).join(",")};
    insert into public.eventos (id, titulo, fecha, iglesia_id) values ('${EV}', 'Vigilia', '2026-11-07', '${IG[0]}');
    insert into public.sesiones_en_vivo (iglesia_id, evento_id, libre, slide_actual, estilo_en_vivo, updated_at) values
      ('${IG[0]}', '${EV}', false, '{"title":"Hola"}', '{"fondo":"azul"}', now() - interval '3 hours'),
      ('${IG[1]}', null, true, '{"title":"Libre"}', null, now() - interval '5 hours'),
      ('${IG[2]}', null, true, '{"title":"Ahora"}', null, now() - interval '30 minutes'),
      ('${IG[3]}', null, false, null, null, now() - interval '9 hours');
  `);
});
afterAll(async () => { await db?.close(); });

describe("cierre de en vivo abandonados en la base", () => {
  it("cierra solo los que llevan más de 2 horas sin cambios, y conserva el estilo", async () => {
    const r = await db.query(`select public.wf_cerrar_en_vivo_abandonados() as n`);
    expect(r.rows[0].n).toBe(2);
    const a = await fila(IG[0]);
    expect(a.evento_id).toBeNull();
    expect(a.slide_actual).toBeNull();
    expect(a.estilo_en_vivo).toEqual({ fondo: "azul" });
    expect((await fila(IG[1])).libre).toBe(false);
    expect((await fila(IG[2])).libre).toBe(true);
  });
  it("correrla otra vez no toca nada", async () => {
    expect((await db.query(`select public.wf_cerrar_en_vivo_abandonados() as n`)).rows[0].n).toBe(0);
  });
});
