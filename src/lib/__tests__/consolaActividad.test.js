import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261109000000_consola_actividad.sql: la consola del super admin ve los números de
// actividad de cada iglesia (nunca el contenido) y nadie más puede verlos.
const IG_A = "11111111-1111-1111-1111-1111111111a7";
const IG_B = "11111111-1111-1111-1111-1111111111b7";
const U = { eldin: "a7000000-0000-0000-0000-000000000001", adminA: "a7000000-0000-0000-0000-000000000002", miembroA: "a7000000-0000-0000-0000-000000000003" };

let db;
const sql = (q, p) => db.query(q, p);
const comoServidor = async () => { await db.query("reset role"); await db.query("select set_config('test.uid', '', false)"); };

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG_A}', 'Activa', 'cons-a'), ('${IG_B}', 'Dormida', 'cons-b');
    insert into auth.users (id, email, last_sign_in_at) values
      ('${U.eldin}', 'e@x.com', now()), ('${U.adminA}', 'a@x.com', now() - interval '2 days'), ('${U.miembroA}', 'm@x.com', null);
    insert into public.usuarios (id, email, nombre, rol, estado, iglesia_id) values
      ('${U.eldin}', 'e@x.com', 'Eldin', 'admin', 'activo', '${IG_B}'),
      ('${U.adminA}', 'a@x.com', 'Ana', 'admin', 'activo', '${IG_A}'),
      ('${U.miembroA}', 'm@x.com', 'Mario', 'miembro', 'inactivo', '${IG_A}');
    insert into public.super_admins (usuario_id) values ('${U.eldin}') on conflict do nothing;
    insert into public.canciones (id, titulo, iglesia_id, created_at) values ('c7000000-0000-0000-0000-000000000001', 'De fábrica', '${IG_B}', now() - interval '90 days');
    insert into public.canciones_de_fabrica (cancion_id) values ('c7000000-0000-0000-0000-000000000001');
    insert into public.canciones (titulo, iglesia_id, created_at) values ('Nueva', '${IG_A}', now()), ('Vieja', '${IG_A}', now() - interval '60 days'), ('De fábrica', '${IG_A}', now());
    insert into public.eventos (titulo, fecha, iglesia_id) values ('Próximo', current_date + 3, '${IG_A}'), ('Pasado', current_date - 4, '${IG_A}');
  `);
  // Una transmisión de la iglesia A (la anota el trigger).
  await sql(`insert into public.sesiones_en_vivo (iglesia_id, libre) values ($1, true)`, [IG_A]);
});
afterAll(async () => { await db?.close(); });

describe("consola de iglesias con actividad", () => {
  it("el super admin ve los números de cada iglesia", async () => {
    await actuarComo(db, U.eldin);
    const r = (await sql("select public.resumen_plataforma() as r")).rows[0].r;
    const a = r.find((x) => x.id === IG_A);
    const b = r.find((x) => x.id === IG_B);
    expect(a).toMatchObject({ usuarios: 2, usuarios_activos: 1, canciones: 3, canciones_propias: 2, canciones_nuevas_7d: 1, eventos: 2, eventos_proximos: 1, ingresaron_7d: 1, nunca_entraron: 1, transmisiones_30d: 1, en_vivo_ahora: true });
    expect(a.proximo_evento.titulo).toBe("Próximo");
    expect(a.ultimo_ingreso).toBeTruthy();
    expect(a.ultima_transmision).toBeTruthy();
    expect(b).toMatchObject({ canciones: 1, eventos: 0, transmisiones_30d: 0, en_vivo_ahora: false });
  });

  it("al terminar y volver a transmitir se anota otra vez, pero no en cada cambio de diapositiva", async () => {
    await comoServidor();
    await sql(`update public.sesiones_en_vivo set slide_actual = '{"x":1}' where iglesia_id = $1`, [IG_A]);
    await sql(`update public.sesiones_en_vivo set libre = false where iglesia_id = $1`, [IG_A]);
    await sql(`update public.sesiones_en_vivo set libre = true where iglesia_id = $1`, [IG_A]);
    const n = await sql(`select count(*)::int as n from public.transmisiones where iglesia_id = $1`, [IG_A]);
    expect(n.rows[0].n).toBe(2);
  });

  it("el equipo de una iglesia con su último ingreso", async () => {
    await actuarComo(db, U.eldin);
    const r = await sql("select nombre, ultimo_ingreso from public.usuarios_iglesia_plataforma($1)", [IG_A]);
    expect(r.rows.map((x) => x.nombre)).toEqual(["Ana", "Mario"]);
    expect(r.rows[1].ultimo_ingreso).toBeNull();
  });

  it("cambia el tope del asistente", async () => {
    await actuarComo(db, U.eldin);
    await sql("select public.cambiar_limite_asistente($1, 50)", [IG_A]);
    await comoServidor();
    expect((await sql("select limite_asistente_diario as l from public.iglesias where id = $1", [IG_A])).rows[0].l).toBe(50);
  });

  it("nadie más puede ver ni cambiar nada de esto", async () => {
    await actuarComo(db, U.adminA);
    await expect(sql("select public.resumen_plataforma()")).rejects.toThrow(/super administrador/);
    await expect(sql("select * from public.usuarios_iglesia_plataforma($1)", [IG_A])).rejects.toThrow(/super administrador/);
    await expect(sql("select public.cambiar_limite_asistente($1, 999)", [IG_A])).rejects.toThrow(/super administrador/);
    // La tabla de transmisiones no se le muestra a nadie con sesión (RLS sin políticas).
    expect((await sql("select * from public.transmisiones")).rows).toHaveLength(0);
  });
});
