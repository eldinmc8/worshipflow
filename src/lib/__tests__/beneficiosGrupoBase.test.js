import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Migración 20261126000000_beneficios_grupo.sql: mi_plan() con el beneficio, la consulta pública de la página de pago
// y que nadie desde la app pueda tocar las columnas del beneficio (una sola vez por iglesia).
const IG = "11111111-1111-1111-1111-1111111111b1";
const IG_SIN = "11111111-1111-1111-1111-1111111111b2";
const IG_VENCIDA = "11111111-1111-1111-1111-1111111111b3";
const ADMIN = "a6000000-0000-0000-0000-000000000001";
const ADMIN_SIN = "a6000000-0000-0000-0000-000000000002";

let db;
const sql = (q, p) => db.query(q, p);
const comoServidor = async () => {
  await db.query("reset role");
  await db.query("select set_config('test.uid', '', false)");
  await db.query("select set_config('test.role', 'service_role', false)");
};

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await comoServidor();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug, grupo_beneficio, beneficio_plazo_hasta) values
      ('${IG}', 'Con grupo', 'ben-con', 'fase_2', now() + interval '10 days'),
      ('${IG_VENCIDA}', 'Vencida', 'ben-vencida', 'lista_espera', now() - interval '1 day');
    insert into public.iglesias (id, nombre, slug) values ('${IG_SIN}', 'Sin grupo', 'ben-sin');
    insert into auth.users (id, email) values ('${ADMIN}', 'a@x.com'), ('${ADMIN_SIN}', 'b@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${ADMIN}', 'a@x.com', 'A', 'admin', '${IG}'), ('${ADMIN_SIN}', 'b@x.com', 'B', 'admin', '${IG_SIN}');
  `);
});
afterAll(async () => { await db?.close(); });

const pagoPublico = async (id) => {
  await actuarComo(db, null);
  return (await sql("select public.beneficio_para_pago($1) as g", [id])).rows[0].g;
};

describe("beneficios por grupo en la base", () => {
  it("mi_plan() trae el beneficio; sin grupo, null", async () => {
    await actuarComo(db, ADMIN);
    const p = (await sql("select public.mi_plan() as p")).rows[0].p;
    expect(p.beneficio).toMatchObject({ grupo: "fase_2", activado_en: null, disponible: true, plazo_vencido: false });
    await actuarComo(db, ADMIN_SIN);
    expect((await sql("select public.mi_plan() as p")).rows[0].p.beneficio).toBeNull();
  });

  it("la página de pago (sin sesión) solo recibe el grupo si todavía se puede activar", async () => {
    expect(await pagoPublico(IG)).toBe("fase_2");
    expect(await pagoPublico(IG_SIN)).toBeNull();
    expect(await pagoPublico(IG_VENCIDA)).toBeNull();
  });

  it("el admin de la iglesia no puede tocar el beneficio (ni reiniciarlo)", async () => {
    await actuarComo(db, ADMIN);
    await expect(sql("update public.iglesias set beneficio_plazo_hasta = now() + interval '1 year' where id = $1", [IG])).rejects.toThrow(/solo lo cambia WorshipFlow/);
    // Otros cambios de su iglesia siguen funcionando.
    await sql("update public.iglesias set nombre = 'Con grupo 2' where id = $1", [IG]);
  });

  it("el aviso de Paddle (service role) lo activa y ya no se puede volver a usar", async () => {
    await comoServidor();
    await sql("update public.iglesias set beneficio_activado_en = now(), beneficio_gratis_hasta = now() + interval '3 months' where id = $1", [IG]);
    expect(await pagoPublico(IG)).toBeNull();
    await actuarComo(db, ADMIN);
    const p = (await sql("select public.mi_plan() as p")).rows[0].p;
    expect(p.beneficio.disponible).toBe(false);
    await expect(sql("update public.iglesias set beneficio_activado_en = null where id = $1", [IG])).rejects.toThrow(/solo lo cambia WorshipFlow/);
  });

  it("plazo vencido sin activar: mi_plan() lo marca para mostrar el aviso", async () => {
    await comoServidor();
    await sql("insert into auth.users (id, email) values ('a6000000-0000-0000-0000-000000000003', 'c@x.com')");
    await sql("insert into public.usuarios (id, email, nombre, rol, iglesia_id) values ('a6000000-0000-0000-0000-000000000003', 'c@x.com', 'C', 'admin', $1)", [IG_VENCIDA]);
    await actuarComo(db, "a6000000-0000-0000-0000-000000000003");
    const p = (await sql("select public.mi_plan() as p")).rows[0].p;
    expect(p.beneficio).toMatchObject({ grupo: "lista_espera", disponible: false, plazo_vencido: true });
  });
});
