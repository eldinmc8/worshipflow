import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261003000300 (cierra la fuga por FK entre iglesias, ver aislamientoIglesias.
// test.js para el hallazgo original). Dos cosas a la vez en CADA tabla tocada:
// 1) lo legítimo (mismo dueño en ambos lados) debe seguir funcionando exactamente igual que antes;
// 2) lo cruzado (fila de una iglesia señalando contenido de otra) debe rechazarse.
// Si solo probara (2) y rompiera (1) por accidente, esta prueba no se daría cuenta -- las dos van
// siempre juntas, tabla por tabla.
describe("el WITH CHECK por FK bloquea cruces entre iglesias sin romper lo legítimo", () => {
  let db;
  const A = "11111111-1111-1111-1111-111111111111";
  const B = "22222222-2222-2222-2222-222222222222";
  const ADMIN_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const ADMIN_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  let eventoA, eventoB, cancionA, ministerioA, rolEventoA, itemA, usuarioMiembroA;

  beforeAll(async () => {
    db = await levantarBaseDePrueba();
    await db.exec(`
      insert into public.iglesias (id, nombre, slug) values ('${A}', 'Iglesia A', 'iglesia-a'), ('${B}', 'Iglesia B', 'iglesia-b');
      insert into auth.users (id, email) values ('${ADMIN_A}', 'admin-a@x.com'), ('${ADMIN_B}', 'admin-b@x.com');
      insert into public.usuarios (id, email, nombre, rol, iglesia_id) values
        ('${ADMIN_A}', 'admin-a@x.com', 'Admin A', 'admin', '${A}'),
        ('${ADMIN_B}', 'admin-b@x.com', 'Admin B', 'admin', '${B}');
    `);
    await actuarComo(db, ADMIN_A);
    const ev = await db.query(`insert into public.eventos (titulo, iglesia_id) values ('Evento A', $1) returning id`, [A]);
    eventoA = ev.rows[0].id;
    const can = await db.query(`insert into public.canciones (titulo, iglesia_id) values ('Canción A', $1) returning id`, [A]);
    cancionA = can.rows[0].id;
    const min = await db.query(`insert into public.ministerios (nombre, iglesia_id) values ('Alabanza A', $1) returning id`, [A]);
    ministerioA = min.rows[0].id;
    const rol = await db.query(`insert into public.roles_evento (evento_id, nombre, iglesia_id) values ($1, 'Guitarra', $2) returning id`, [eventoA, A]);
    rolEventoA = rol.rows[0].id;
    const item = await db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, iglesia_id) values ($1, 'bloque', 'Alabanza', 0, $2) returning id`, [eventoA, A]);
    itemA = item.rows[0].id;
    usuarioMiembroA = ADMIN_A; // reutiliza al admin A como "miembro" para las pruebas de usuario_id

    await actuarComo(db, ADMIN_B);
    const evB = await db.query(`insert into public.eventos (titulo, iglesia_id) values ('Evento B', $1) returning id`, [B]);
    eventoB = evB.rows[0].id;
  });

  afterAll(async () => { await db.close(); });

  it("secciones_cancion/diapositivas_letra/estructura_cancion: legítimo pasa, cruzado se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.secciones_cancion (cancion_id, clave, etiqueta, iglesia_id) values ($1,'v1','Verso 1',$2)`, [cancionA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.diapositivas_letra (cancion_id, seccion_clave, iglesia_id) values ($1,'v1',$2)`, [cancionA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.estructura_cancion (cancion_id, orden, seccion_clave, iglesia_id) values ($1,0,'v1',$2)`, [cancionA, A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.secciones_cancion (cancion_id, clave, etiqueta, iglesia_id) values ($1,'v1','Verso 1',$2)`, [cancionA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.diapositivas_letra (cancion_id, seccion_clave, iglesia_id) values ($1,'v1',$2)`, [cancionA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.estructura_cancion (cancion_id, orden, seccion_clave, iglesia_id) values ($1,0,'v1',$2)`, [cancionA, B])).rejects.toThrow();
  });

  it("items_servicio: legítimo (con y sin ministerio_id) pasa, evento_id o ministerio_id cruzado se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, iglesia_id) values ($1,'bloque','Sin ministerio',1,$2)`, [eventoA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, ministerio_id, iglesia_id) values ($1,'bloque','Con ministerio',2,$2,$3)`, [eventoA, ministerioA, A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, iglesia_id) values ($1,'bloque','intruso',0,$2)`, [eventoA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, ministerio_id, iglesia_id) values ($1,'bloque','ministerio ajeno',0,$2,$3)`, [eventoB, ministerioA, B])).rejects.toThrow();
  });

  it("roles_evento y recordatorios_evento: legítimo pasa, evento_id cruzado se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.roles_evento (evento_id, nombre, iglesia_id) values ($1,'Batería',$2)`, [eventoA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.recordatorios_evento (evento_id, cantidad, unidad, iglesia_id) values ($1,2,'dias',$2)`, [eventoA, A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.roles_evento (evento_id, nombre, iglesia_id) values ($1,'intruso',$2)`, [eventoA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.recordatorios_evento (evento_id, cantidad, unidad, iglesia_id) values ($1,2,'dias',$2)`, [eventoA, B])).rejects.toThrow();
  });

  it("miembros_rol: legítimo (por rol_id, por item_servicio_id, con usuario_id) pasa, cualquier referencia cruzada se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.miembros_rol (rol_id, nombre, iglesia_id) values ($1,'Gerardo',$2)`, [rolEventoA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.miembros_rol (item_servicio_id, nombre, iglesia_id) values ($1,'Flor',$2)`, [itemA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.miembros_rol (item_servicio_id, nombre, usuario_id, iglesia_id) values ($1,'Admin A',$2,$3)`, [itemA, usuarioMiembroA, A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.miembros_rol (rol_id, nombre, iglesia_id) values ($1,'intruso',$2)`, [rolEventoA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.miembros_rol (item_servicio_id, nombre, iglesia_id) values ($1,'intruso',$2)`, [itemA, B])).rejects.toThrow();
    // item propio de B, pero usuario_id de A -- también debe rechazarse.
    const itemB = await db.query(`insert into public.items_servicio (evento_id, tipo, titulo, orden, iglesia_id) values ($1,'bloque','de B',0,$2) returning id`, [eventoB, B]);
    await expect(db.query(`insert into public.miembros_rol (item_servicio_id, nombre, usuario_id, iglesia_id) values ($1,'usuario ajeno',$2,$3)`, [itemB.rows[0].id, usuarioMiembroA, B])).rejects.toThrow();
  });

  it("planificacion_ministerio, recursos_ministerio y ministerios.lider_id: legítimo pasa, cruzado se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.planificacion_ministerio (ministerio_id, titulo, iglesia_id) values ($1,'Plan de octubre',$2)`, [ministerioA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.recursos_ministerio (ministerio_id, titulo, iglesia_id) values ($1,'Guía',$2)`, [ministerioA, A])).resolves.toBeTruthy();
    await expect(db.query(`insert into public.ministerios (nombre, lider_id, iglesia_id) values ('Jóvenes A',$1,$2)`, [ADMIN_A, A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.planificacion_ministerio (ministerio_id, titulo, iglesia_id) values ($1,'intruso',$2)`, [ministerioA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.recursos_ministerio (ministerio_id, titulo, iglesia_id) values ($1,'intruso',$2)`, [ministerioA, B])).rejects.toThrow();
    await expect(db.query(`insert into public.ministerios (nombre, lider_id, iglesia_id) values ('intruso',$1,$2)`, [ADMIN_A, B])).rejects.toThrow();
  });

  it("asignaciones_vistas: legítimo pasa, evento de otra iglesia o iglesia_id falsa se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.asignaciones_vistas (evento_id, usuario_id, iglesia_id) values ($1,$2,$3)`, [eventoA, ADMIN_A, A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.asignaciones_vistas (evento_id, usuario_id, iglesia_id) values ($1,$2,$3)`, [eventoA, ADMIN_B, B])).rejects.toThrow();
    // intenta forzar iglesia_id=A para que coincida con el evento -- igual se rechaza, porque A no es su iglesia real.
    await expect(db.query(`insert into public.asignaciones_vistas (evento_id, usuario_id, iglesia_id) values ($1,$2,$3)`, [eventoA, ADMIN_B, A])).rejects.toThrow();
  });

  it("sesiones_en_vivo: legítimo (con evento y en modo libre) pasa, evento de otra iglesia se rechaza", async () => {
    await actuarComo(db, ADMIN_A);
    await expect(db.query(`insert into public.sesiones_en_vivo (iglesia_id, evento_id) values ($1,$2) on conflict (iglesia_id) do update set evento_id = excluded.evento_id`, [A, eventoA])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`insert into public.sesiones_en_vivo (iglesia_id) values ($1) on conflict (iglesia_id) do update set evento_id = null`, [B])).resolves.toBeTruthy(); // modo libre, sin evento -- sigue bien
    await expect(db.query(`insert into public.sesiones_en_vivo (iglesia_id, evento_id) values ($1,$2) on conflict (iglesia_id) do update set evento_id = excluded.evento_id`, [B, eventoA])).rejects.toThrow();
  });

  it("usuarios.rol_id: un admin puede asignar un rol de su propia iglesia, no uno de otra", async () => {
    await actuarComo(db, ADMIN_A);
    const rolA = await db.query(`insert into public.roles_app (nombre, iglesia_id) values ('Sonido', $1) returning id`, [A]);
    await expect(db.query(`update public.usuarios set rol_id = $1 where id = $2`, [rolA.rows[0].id, ADMIN_A])).resolves.toBeTruthy();

    await actuarComo(db, ADMIN_B);
    await expect(db.query(`update public.usuarios set rol_id = $1 where id = $2`, [rolA.rows[0].id, ADMIN_B])).rejects.toThrow();
  });
});
