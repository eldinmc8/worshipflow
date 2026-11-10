import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261115000000_planes_suscripcion.sql: Gratis (5 miembros, 50 canciones,
// 1 ministerio, sin plantillas, asistente 5/día), Ministerio (15 miembros, 3 ministerios, 30/día),
// Iglesia (ilimitado, 100/día), prueba de 14 días para iglesias nuevas, y plan vencido = Gratis.
const IG = "11111111-1111-1111-1111-1111111111e1";
const IG_VIEJA = "11111111-1111-1111-1111-1111111111e2";
const ADMIN = "a5000000-0000-0000-0000-000000000001";
const ELDIN = "a5000000-0000-0000-0000-0000000000ff";

let db;
const sql = (q, p) => db.query(q, p);
const comoServidor = async () => { await db.query("reset role"); await db.query("select set_config('test.uid', '', false)"); };
let n = 0;
const agregarMiembro = async (estado = "activo") => {
  await comoServidor();
  const id = `a5100000-0000-0000-0000-${String(++n).padStart(12, "0")}`;
  await sql("insert into auth.users (id, email) values ($1, $2)", [id, `m${n}@x.com`]);
  await sql("insert into public.usuarios (id, email, nombre, rol, estado, iglesia_id) values ($1, $2, 'M', 'miembro', $3, $4)", [id, `m${n}@x.com`, estado, IG]);
  return id;
};
const ponerPlan = async (plan, vence = null) => {
  await comoServidor();
  await sql("update public.iglesias set plan = $1, plan_vence = $2, en_prueba = false where id = $3", [plan, vence, IG]);
};

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  // IG_VIEJA simula una iglesia que ya existía antes de los planes (fundadora, sin vencimiento).
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG}', 'Nueva', 'planes-nueva');
    insert into public.iglesias (id, nombre, slug, plan, plan_vence, en_prueba) values ('${IG_VIEJA}', 'Vieja', 'planes-vieja', 'iglesia', null, false);
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.com'), ('${ELDIN}', 'eldin@x.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${ADMIN}', 'admin@x.com', 'Admin', 'admin', '${IG}'), ('${ELDIN}', 'eldin@x.com', 'Eldin', 'admin', '${IG_VIEJA}');
    insert into public.super_admins (usuario_id) values ('${ELDIN}') on conflict do nothing;
  `);
});
afterAll(async () => { await db?.close(); });

describe("planes de suscripción", () => {
  it("una iglesia nueva arranca con 14 días de prueba del plan Iglesia", async () => {
    await actuarComo(db, ADMIN);
    const p = (await sql("select public.mi_plan() as p")).rows[0].p;
    expect(p.plan).toBe("iglesia");
    expect(p.en_prueba).toBe(true);
    const dias = (new Date(p.vence).getTime() - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(13);
    expect(dias).toBeLessThanOrEqual(14);
    expect(p.limites.miembros).toBeNull();
  });

  it("Gratis: hasta 5 miembros activos; los inactivos no cuentan y no se cuelan al reactivarlos", async () => {
    await ponerPlan("gratis");
    for (let i = 0; i < 4; i++) await agregarMiembro(); // + el admin = 5
    await expect(agregarMiembro()).rejects.toThrow(/hasta 5 miembros/);
    const inactivo = await agregarMiembro("inactivo");
    await comoServidor();
    await expect(sql("update public.usuarios set estado = 'activo' where id = $1", [inactivo])).rejects.toThrow(/hasta 5 miembros/);
    // Editar a alguien que ya estaba activo sigue funcionando.
    await sql("update public.usuarios set nombre = 'Otro' where id = $1", [ADMIN]);
  });

  it("Gratis: 1 ministerio y sin plantillas de eventos", async () => {
    await comoServidor();
    await sql("insert into public.ministerios (nombre, iglesia_id) values ('Alabanza', $1)", [IG]);
    await expect(sql("insert into public.ministerios (nombre, iglesia_id) values ('Jóvenes', $1)", [IG])).rejects.toThrow(/1 ministerio/);
    await expect(sql("insert into public.eventos (titulo, fecha, es_plantilla, iglesia_id) values ('T', current_date, true, $1)", [IG])).rejects.toThrow(/plantillas/);
    await sql("insert into public.eventos (titulo, fecha, iglesia_id) values ('Culto', current_date, $1)", [IG]);
  });

  it("Gratis: hasta 50 canciones", async () => {
    await comoServidor();
    const ya = Number((await sql("select count(*) as c from public.canciones where iglesia_id = $1", [IG])).rows[0].c);
    for (let i = ya; i < 50; i++) await sql("insert into public.canciones (titulo, iglesia_id) values ($1, $2)", [`C${i}`, IG]);
    await expect(sql("insert into public.canciones (titulo, iglesia_id) values ('Una más', $1)", [IG])).rejects.toThrow(/50 canciones/);
  });

  it("Ministerio: sube a 15 miembros, canciones ilimitadas, plantillas y Modo Músico", async () => {
    await ponerPlan("ministerio");
    await agregarMiembro();
    await sql("insert into public.canciones (titulo, iglesia_id) values ('Una más', $1)", [IG]);
    await sql("insert into public.eventos (titulo, fecha, es_plantilla, iglesia_id) values ('Plantilla', current_date, true, $1)", [IG]);
    await actuarComo(db, ADMIN);
    const p = (await sql("select public.mi_plan() as p")).rows[0].p;
    expect(p.limites).toMatchObject({ miembros: 15, modo_musico: true, ministerios: 3 });
    expect(p.uso.miembros).toBe(6);
  });

  it("un plan vencido cuenta como Gratis, sin borrar nada", async () => {
    await ponerPlan("ministerio", new Date(Date.now() - 86400000).toISOString());
    await actuarComo(db, ADMIN);
    const p = (await sql("select public.mi_plan() as p")).rows[0].p;
    expect(p.plan).toBe("gratis");
    expect(p.vencido).toBe(true);
    expect(p.limites.modo_musico).toBe(false);
    expect(p.uso.miembros).toBe(6); // nadie se borró; solo no se puede agregar
    await expect(agregarMiembro()).rejects.toThrow(/hasta 5 miembros/);
  });

  it("asistente: el tope es el menor entre el plan y el de la consola", async () => {
    await comoServidor();
    await sql("update public.iglesias set limite_asistente_diario = 100 where id = $1", [IG]);
    await ponerPlan("gratis");
    expect((await sql("select public.reservar_mensaje_asistente($1) as r", [IG])).rows[0].r.limite).toBe(5);
    await ponerPlan("ministerio");
    expect((await sql("select public.reservar_mensaje_asistente($1) as r", [IG])).rows[0].r.limite).toBe(30);
    await ponerPlan("iglesia");
    expect((await sql("select public.reservar_mensaje_asistente($1) as r", [IG])).rows[0].r.limite).toBe(100);
    await sql("update public.iglesias set limite_asistente_diario = 20 where id = $1", [IG]);
    expect((await sql("select public.reservar_mensaje_asistente($1) as r", [IG])).rows[0].r.limite).toBe(20);
  });

  it("solo el super administrador cambia el plan, y eso termina la prueba", async () => {
    await actuarComo(db, ADMIN);
    await expect(sql("select public.cambiar_plan_iglesia($1, 'iglesia', null, null)", [IG])).rejects.toThrow(/super administrador/);
    await expect(sql("select * from public.planes_plataforma()")).rejects.toThrow();
    await actuarComo(db, ELDIN);
    await sql("select public.cambiar_plan_iglesia($1, 'ministerio', now() + interval '31 days', 'Transferencia')", [IG]);
    const r = (await sql("select * from public.planes_plataforma() where iglesia_id = $1", [IG])).rows[0];
    expect(r).toMatchObject({ plan: "ministerio", plan_efectivo: "ministerio", plan_nota: "Transferencia", en_prueba: false });
    const vieja = (await sql("select * from public.planes_plataforma() where iglesia_id = $1", [IG_VIEJA])).rows[0];
    expect(vieja).toMatchObject({ plan: "iglesia", plan_vence: null });
  });
});
