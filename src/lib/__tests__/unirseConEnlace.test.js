import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261124000000_unirse_con_enlace.sql: enlace para unirse + aprobación del líder,
// y que una cuenta sin fila en "usuarios" ya no vea datos de ninguna iglesia.
const IG_A = "11111111-1111-1111-1111-1111111111e1";
const IG_B = "11111111-1111-1111-1111-1111111111e2";
const U = {
  adminA: "a5000000-0000-0000-0000-000000000001",
  miembroA: "a5000000-0000-0000-0000-000000000002",
  adminB: "a5000000-0000-0000-0000-000000000003",
  nuevo: "a5000000-0000-0000-0000-000000000004",
  otro: "a5000000-0000-0000-0000-000000000005",
};

let db;
const uno = async (q, p) => (await db.query(q, p)).rows[0];
const comoServidor = async () => { await db.query("reset role"); await db.query("select set_config('test.uid', '', false)"); };
const falla = async (q, p) => { try { await db.query(q, p); } catch (e) { return e.message; } return null; };

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  await db.exec(`
    insert into public.iglesias (id, nombre, slug, plan) values ('${IG_A}', 'Iglesia A', 'union-a', 'iglesia'), ('${IG_B}', 'Iglesia B', 'union-b', 'iglesia');
    insert into auth.users (id, email) values
      ('${U.adminA}', 'admin@a.com'), ('${U.miembroA}', 'm@a.com'), ('${U.adminB}', 'admin@b.com'),
      ('${U.nuevo}', 'Nuevo@Correo.com'), ('${U.otro}', 'otro@correo.com');
    insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
      ('${U.adminA}', 'admin@a.com', 'Admin A', 'admin', '${IG_A}'),
      ('${U.miembroA}', 'm@a.com', 'Miembro A', 'miembro', '${IG_A}'),
      ('${U.adminB}', 'admin@b.com', 'Admin B', 'admin', '${IG_B}');
    insert into public.canciones (titulo, iglesia_id) values ('Secreta A', '${IG_A}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("unirse a una iglesia con enlace", () => {
  let codigo;

  it("una cuenta sin fila en usuarios no ve nada de ninguna iglesia", async () => {
    await actuarComo(db, U.nuevo);
    expect((await uno("select public.mi_iglesia_id() as m")).m).toBeNull();
    expect((await uno("select count(*)::int as n from public.canciones")).n).toBe(0);
    expect((await uno("select count(*)::int as n from public.usuarios")).n).toBe(0);
  });

  it("solo un admin obtiene el código, y es siempre el mismo hasta cambiarlo", async () => {
    await actuarComo(db, U.miembroA);
    expect(await falla("select public.wf_codigo_union()")).toMatch(/administrador/);
    await actuarComo(db, U.adminA);
    codigo = (await uno("select public.wf_codigo_union() as c")).c;
    expect(codigo).toMatch(/^[0-9a-f]{10}$/);
    expect((await uno("select public.wf_codigo_union() as c")).c).toBe(codigo);
  });

  it("sin sesión solo se ve el nombre de la iglesia del código", async () => {
    await actuarComo(db, null);
    expect((await uno("select * from public.wf_iglesia_por_codigo($1)", [codigo])).nombre).toBe("Iglesia A");
    expect((await db.query("select * from public.wf_iglesia_por_codigo('noexiste')")).rows).toHaveLength(0);
  });

  it("quien abre el enlace queda pendiente, y sigue sin ver nada", async () => {
    await actuarComo(db, U.nuevo);
    expect((await uno("select public.wf_solicitar_ingreso('malo', 'X') as r")).r).toEqual({ estado: "codigo_invalido" });
    const r = (await uno("select public.wf_solicitar_ingreso($1, 'Ana Nueva') as r", [codigo])).r;
    expect(r).toEqual({ estado: "pendiente", iglesia: "Iglesia A" });
    expect((await uno("select public.wf_mi_solicitud() as r")).r).toEqual({ estado: "pendiente", iglesia: "Iglesia A" });
    expect((await uno("select count(*)::int as n from public.canciones")).n).toBe(0);
    // No puede aprobarse a sí mismo ni escribir en la tabla directo.
    expect(await falla("select public.wf_aprobar_solicitud(id, 'admin') from public.solicitudes_ingreso")).toMatch(/administrador/);
    expect(await falla(`insert into public.solicitudes_ingreso (iglesia_id, usuario_id, email, nombre) values ('${IG_B}', '${U.nuevo}', 'x', 'x')`)).not.toBeNull();
  });

  it("solo los admins de esa iglesia ven la solicitud", async () => {
    await actuarComo(db, U.adminA);
    const filas = (await db.query("select nombre, email from public.solicitudes_ingreso")).rows;
    expect(filas).toEqual([{ nombre: "Ana Nueva", email: "nuevo@correo.com" }]);
    await actuarComo(db, U.miembroA);
    expect((await db.query("select * from public.solicitudes_ingreso")).rows).toHaveLength(0);
    await actuarComo(db, U.adminB);
    expect((await db.query("select * from public.solicitudes_ingreso")).rows).toHaveLength(0);
  });

  it("un admin de otra iglesia no puede aprobarla", async () => {
    await comoServidor();
    const id = (await uno("select id from public.solicitudes_ingreso where usuario_id = $1", [U.nuevo])).id;
    await actuarComo(db, U.adminB);
    expect(await falla("select public.wf_aprobar_solicitud($1, 'miembro')", [id])).toMatch(/ya no existe/);
  });

  it("al aprobarla entra con el rol elegido y ve su iglesia", async () => {
    await comoServidor();
    const id = (await uno("select id from public.solicitudes_ingreso where usuario_id = $1", [U.nuevo])).id;
    await actuarComo(db, U.adminA);
    expect(await falla("select public.wf_aprobar_solicitud($1, 'jefe')", [id])).toMatch(/Rol no válido/);
    await db.query("select public.wf_aprobar_solicitud($1, 'musico')", [id]);
    await actuarComo(db, U.nuevo);
    expect(await uno("select rol, iglesia_id, nombre, perfil_completo from public.usuarios where id = $1", [U.nuevo]))
      .toEqual({ rol: "musico", iglesia_id: IG_A, nombre: "Ana Nueva", perfil_completo: true });
    expect((await uno("select count(*)::int as n from public.canciones")).n).toBe(1);
    expect((await uno("select public.wf_mi_solicitud() as r")).r).toBeNull();
    expect((await uno("select public.wf_solicitar_ingreso($1, 'Ana') as r", [codigo])).r).toEqual({ estado: "miembro" });
  });

  it("rechazada: volver a abrir el mismo enlace no la revive", async () => {
    await actuarComo(db, U.otro);
    await db.query("select public.wf_solicitar_ingreso($1, 'Otro')", [codigo]);
    await comoServidor();
    const id = (await uno("select id from public.solicitudes_ingreso where usuario_id = $1", [U.otro])).id;
    await actuarComo(db, U.adminA);
    await db.query("select public.wf_rechazar_solicitud($1)", [id]);
    await actuarComo(db, U.otro);
    expect((await uno("select public.wf_solicitar_ingreso($1, 'Otro') as r", [codigo])).r.estado).toBe("rechazada");
  });

  it("con un rol personalizado: solo uno de esta iglesia", async () => {
    const tercero = "a5000000-0000-0000-0000-000000000006";
    await comoServidor();
    await db.exec(`insert into auth.users (id, email) values ('${tercero}', 'tres@correo.com');
      insert into public.roles_app (id, nombre, iglesia_id) values ('b5000000-0000-0000-0000-00000000000a', 'Ujier', '${IG_A}'), ('b5000000-0000-0000-0000-00000000000b', 'Ujier B', '${IG_B}');`);
    await actuarComo(db, tercero);
    await db.query("select public.wf_solicitar_ingreso($1, 'Tres')", [codigo]);
    await comoServidor();
    const id = (await uno("select id from public.solicitudes_ingreso where usuario_id = $1", [tercero])).id;
    await actuarComo(db, U.adminA);
    expect(await falla("select public.wf_aprobar_solicitud($1, 'miembro', 'b5000000-0000-0000-0000-00000000000b')", [id])).toMatch(/Rol no válido/);
    await db.query("select public.wf_aprobar_solicitud($1, 'miembro', 'b5000000-0000-0000-0000-00000000000a')", [id]);
    expect(await uno("select rol, rol_id from public.usuarios where id = $1", [tercero])).toEqual({ rol: "miembro", rol_id: "b5000000-0000-0000-0000-00000000000a" });
  });

  it("cambiar el código anula el enlace anterior", async () => {
    await actuarComo(db, U.adminA);
    const nuevo = (await uno("select public.wf_cambiar_codigo_union() as c")).c;
    expect(nuevo).not.toBe(codigo);
    await actuarComo(db, null);
    expect((await db.query("select * from public.wf_iglesia_por_codigo($1)", [codigo])).rows).toHaveLength(0);
    expect((await db.query("select * from public.wf_iglesia_por_codigo($1)", [nuevo])).rows).toHaveLength(1);
  });
});
