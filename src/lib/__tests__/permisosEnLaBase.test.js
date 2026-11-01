import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { levantarBaseDePrueba, actuarComo } from "./pgliteHarness.js";

// Prueba la migración 20261102000000_permisos_en_la_base.sql: lo que cada quien puede hacer se cumple
// en la base (no solo en la pantalla), sin romper lo que la app hace hoy — en especial que guarda el
// Setlist COMPLETO con cada cambio (upsert de todas las filas, también las que no cambiaron).
const IG = "11111111-1111-1111-1111-111111111111";
const U = {
  admin: "a0000000-0000-0000-0000-000000000001",
  daniel: "a0000000-0000-0000-0000-000000000002", // músico, líder de Alabanza (con editar_setlist + equipo + canciones)
  luis: "a0000000-0000-0000-0000-000000000003", // miembro, líder de Limpieza (solo lo básico)
  ana: "a0000000-0000-0000-0000-000000000004", // miembro, encargada del bloque de Lectura
  marta: "a0000000-0000-0000-0000-000000000005", // multimedia
  pavel: "a0000000-0000-0000-0000-000000000006", // músico, dirige la alabanza (lead en Piano)
  rosa: "a0000000-0000-0000-0000-000000000007", // rol personalizado con editar_setlist
  carlos: "a0000000-0000-0000-0000-000000000008", // miembro sin nada
  gina: "a0000000-0000-0000-0000-000000000009", // rol personalizado con gestionar_ministerios
};
const ROL_SETLIST = "b0000000-0000-0000-0000-000000000001";
const ROL_GRUPOS = "b0000000-0000-0000-0000-000000000002";
const M_ALAB = "c0000000-0000-0000-0000-000000000001";
const M_LIMP = "c0000000-0000-0000-0000-000000000002";
const E1 = "d0000000-0000-0000-0000-000000000001"; // con bloque de Alabanza vinculado
const E2 = "d0000000-0000-0000-0000-000000000002"; // sin Alabanza vinculada
const IT = {
  limp: "e0000000-0000-0000-0000-000000000001",
  lect: "e0000000-0000-0000-0000-000000000002",
  alab: "e0000000-0000-0000-0000-000000000003",
  canc: "e0000000-0000-0000-0000-000000000004",
  e2b: "e0000000-0000-0000-0000-000000000005",
};
const CAN = "f0000000-0000-0000-0000-000000000001";
const PIANO = "f1000000-0000-0000-0000-000000000001";
const ENC_ANA = "f2000000-0000-0000-0000-000000000001";
const ENC_PAVEL = "f2000000-0000-0000-0000-000000000002";

let db;
const como = (u) => actuarComo(db, U[u]);
// Edge Functions con la llave de servicio / editor SQL: sin auth.uid() y sin RLS.
async function comoServidor() {
  await db.query(`reset role`);
  await db.query(`select set_config('test.uid', '', false)`);
}
const sql = (q, p) => db.query(q, p);

// Igual que PostgREST con upsert: insert ... on conflict (id) do update de las columnas enviadas.
async function guardarSetlistCompleto(filas) {
  for (const f of filas) {
    const cols = Object.keys(f);
    const vals = cols.map((_, i) => `$${i + 1}`);
    const set = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`);
    await sql(`insert into public.items_servicio (${cols.join(",")}) values (${vals.join(",")}) on conflict (id) do update set ${set.join(",")}`, cols.map((c) => f[c]));
  }
}
// Lo que la app manda para el Setlist de E1 (como itemServicioAFila: descripción "" en vez de null).
const setlistE1 = () => [
  { id: IT.limp, evento_id: E1, orden: 0, tipo: "bloque", titulo: "Orden y limpieza", descripcion: "", ministerio_id: M_LIMP, estructura: "[]", fondo_tipo: "color", es_punto_bosquejo: false },
  { id: IT.lect, evento_id: E1, orden: 1, tipo: "bloque", titulo: "Lectura y oración inicial", descripcion: "", ministerio_id: null, estructura: "[]", fondo_tipo: "color", es_punto_bosquejo: false },
  { id: IT.alab, evento_id: E1, orden: 2, tipo: "bloque", titulo: "Bloque de Alabanza", descripcion: "", ministerio_id: M_ALAB, estructura: "[]", fondo_tipo: "color", es_punto_bosquejo: false },
  { id: IT.canc, evento_id: E1, orden: 3, tipo: "cancion", cancion_id: CAN, tonalidad_override: null, estructura: "[]", fondo_tipo: "color", es_punto_bosquejo: false },
];

beforeAll(async () => {
  db = await levantarBaseDePrueba();
  const usuarios = [
    [U.admin, "admin", null], [U.daniel, "musico", null], [U.luis, "miembro", null], [U.ana, "miembro", null],
    [U.marta, "multimedia", null], [U.pavel, "musico", null], [U.rosa, "miembro", ROL_SETLIST], [U.carlos, "miembro", null], [U.gina, "miembro", ROL_GRUPOS],
  ];
  await db.exec(`
    insert into public.iglesias (id, nombre, slug) values ('${IG}', 'Iglesia', 'iglesia');
    insert into public.roles_app (id, nombre, permisos, iglesia_id) values
      ('${ROL_SETLIST}', 'Editor de setlist', '{"editar_setlist": true}', '${IG}'),
      ('${ROL_GRUPOS}', 'Coordinador de ministerios', '{"gestionar_ministerios": true}', '${IG}');
    insert into auth.users (id, email) values ${usuarios.map(([id]) => `('${id}', '${id}@x.com')`).join(",")};
    insert into public.usuarios (id, email, nombre, rol, rol_id, iglesia_id) values ${usuarios.map(([id, rol, rolId]) => `('${id}', '${id}@x.com', '${id}', '${rol}', ${rolId ? `'${rolId}'` : "null"}, '${IG}')`).join(",")};
    insert into public.ministerios (id, nombre, lider_id, permisos_lider, iglesia_id) values
      ('${M_ALAB}', 'Alabanza', '${U.daniel}', '{"editar_setlist": true, "equipo": true, "gestionar_canciones": true}', '${IG}'),
      ('${M_LIMP}', 'Limpieza', '${U.luis}', '{}', '${IG}');
    insert into public.canciones (id, titulo, tonalidad, iglesia_id) values ('${CAN}', 'Way Maker', 'G', '${IG}');
    insert into public.diapositivas_letra (cancion_id, seccion_clave, texto, orden, iglesia_id) values ('${CAN}', 'V1', 'Linea', 0, '${IG}');
    insert into public.eventos (id, titulo, fecha, iglesia_id) values ('${E1}', 'Domingo', '2026-11-08', '${IG}'), ('${E2}', 'Miércoles', '2026-11-11', '${IG}');
    insert into public.items_servicio (id, evento_id, orden, tipo, titulo, descripcion, ministerio_id, iglesia_id) values
      ('${IT.limp}', '${E1}', 0, 'bloque', 'Orden y limpieza', null, '${M_LIMP}', '${IG}'),
      ('${IT.lect}', '${E1}', 1, 'bloque', 'Lectura y oración inicial', null, null, '${IG}'),
      ('${IT.alab}', '${E1}', 2, 'bloque', 'Bloque de Alabanza', null, '${M_ALAB}', '${IG}'),
      ('${IT.e2b}', '${E2}', 0, 'bloque', 'Bienvenida', null, null, '${IG}');
    insert into public.items_servicio (id, evento_id, orden, tipo, cancion_id, iglesia_id) values ('${IT.canc}', '${E1}', 3, 'cancion', '${CAN}', '${IG}');
    insert into public.roles_evento (id, evento_id, nombre, iglesia_id) values ('${PIANO}', '${E1}', 'Piano', '${IG}');
    insert into public.miembros_rol (id, item_servicio_id, nombre, usuario_id, estado, iglesia_id) values ('${ENC_ANA}', '${IT.lect}', 'Ana', '${U.ana}', 'pendiente', '${IG}');
    insert into public.miembros_rol (id, rol_id, nombre, usuario_id, estado, lead, iglesia_id) values ('${ENC_PAVEL}', '${PIANO}', 'Pavel', '${U.pavel}', 'confirmado', true, '${IG}');
  `);
});
afterAll(async () => { await db?.close(); });

describe("miembro sin permisos", () => {
  it("no puede cambiar canciones, eventos, el Setlist ni los grupos", async () => {
    await como("carlos");
    await expect(sql(`update public.canciones set titulo = 'X' where id = $1`, [CAN])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.eventos where id = $1`, [E2])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.eventos set titulo = 'X' where id = $1`, [E2])).rejects.toThrow(/permiso/);
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, titulo, iglesia_id) values ($1, 9, 'slide', 'X', $2)`, [E1, IG])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.items_servicio where id = $1`, [IT.canc])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.ministerios set permisos_lider = '{"editar_setlist": true}' where id = $1`, [M_LIMP])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.diapositivas_letra where cancion_id = $1`, [CAN])).rejects.toThrow(/permiso/);
  });
  it("sí puede marcar una canción como favorita", async () => {
    await como("carlos");
    await expect(sql(`update public.canciones set favorito = true where id = $1`, [CAN])).resolves.toBeTruthy();
  });
  it("reenviar el Setlist sin cambios no se bloquea (la app guarda todo junto)", async () => {
    await como("carlos");
    await expect(guardarSetlistCompleto(setlistE1())).resolves.toBeUndefined();
  });
});

describe("confirmar los propios cargos", () => {
  it("cada quien confirma lo suyo, pero no lo de otro", async () => {
    await como("ana");
    await expect(sql(`update public.miembros_rol set estado = 'confirmado' where id = $1`, [ENC_ANA])).resolves.toBeTruthy();
    await expect(sql(`update public.miembros_rol set estado = 'rechazado' where id = $1`, [ENC_PAVEL])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.miembros_rol set usuario_id = $2 where id = $1`, [ENC_ANA, U.carlos])).rejects.toThrow(/permiso/);
  });
});

describe("líder de grupo con lo básico (Luis, Limpieza)", () => {
  it("guarda el Setlist completo cambiando solo el título de SU bloque (y con el orden renumerado)", async () => {
    await como("luis");
    const filas = setlistE1();
    filas[0].titulo = "Limpieza y orden";
    await expect(guardarSetlistCompleto(filas)).resolves.toBeUndefined();
    const r = await sql(`select titulo from public.items_servicio where id = $1`, [IT.limp]);
    expect(r.rows[0].titulo).toBe("Limpieza y orden");
  });
  it("no puede cambiar otros bloques ni canciones aunque lleguen en el mismo guardado", async () => {
    await como("luis");
    const filas = setlistE1();
    filas[0].titulo = "Limpieza y orden";
    filas[3].tonalidad_override = "A";
    await expect(guardarSetlistCompleto(filas)).rejects.toThrow(/permiso/);
    await expect(sql(`update public.items_servicio set titulo = 'X' where id = $1`, [IT.lect])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.items_servicio set ministerio_id = null where id = $1`, [IT.limp])).rejects.toThrow(/permiso/);
  });
  it("asigna encargados en su bloque, no en otros", async () => {
    await como("luis");
    await expect(sql(`insert into public.miembros_rol (item_servicio_id, nombre, usuario_id, iglesia_id) values ($1, 'Carlos', $2, $3)`, [IT.limp, U.carlos, IG])).resolves.toBeTruthy();
    await expect(sql(`insert into public.miembros_rol (item_servicio_id, nombre, usuario_id, iglesia_id) values ($1, 'Carlos', $2, $3)`, [IT.lect, U.carlos, IG])).rejects.toThrow(/permiso/);
    await expect(sql(`insert into public.miembros_rol (rol_id, nombre, usuario_id, iglesia_id) values ($1, 'Carlos', $2, $3)`, [PIANO, U.carlos, IG])).rejects.toThrow(/permiso/);
  });
  it("edita la planificación de su grupo, no la de otro, y no se cambia a sí mismo los permisos", async () => {
    await como("luis");
    await expect(sql(`insert into public.planificacion_ministerio (ministerio_id, fecha, titulo, iglesia_id) values ($1, '2026-11-08', 'Barrer', $2)`, [M_LIMP, IG])).resolves.toBeTruthy();
    await expect(sql(`insert into public.planificacion_ministerio (ministerio_id, fecha, titulo, iglesia_id) values ($1, '2026-11-08', 'X', $2)`, [M_ALAB, IG])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.ministerios set permisos_lider = '{"editar_setlist": true}' where id = $1`, [M_LIMP])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.ministerios set lider_id = $2 where id = $1`, [M_ALAB, U.luis])).rejects.toThrow(/permiso/);
  });
});

describe("líder de Alabanza con permisos (Daniel)", () => {
  it("edita el Setlist y el equipo de los eventos de su grupo", async () => {
    await como("daniel");
    const filas = setlistE1();
    filas[3].tonalidad_override = "A";
    await expect(guardarSetlistCompleto(filas)).resolves.toBeUndefined();
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, cancion_id, iglesia_id) values ($1, 4, 'cancion', $2, $3)`, [E1, CAN, IG])).resolves.toBeTruthy();
    await expect(sql(`insert into public.roles_evento (evento_id, nombre, iglesia_id) values ($1, 'Voz', $2)`, [E1, IG])).resolves.toBeTruthy();
    await expect(sql(`insert into public.miembros_rol (rol_id, nombre, usuario_id, iglesia_id) values ($1, 'Carlos', $2, $3)`, [PIANO, U.carlos, IG])).resolves.toBeTruthy();
  });
  it("no toca eventos donde su grupo no está", async () => {
    await como("daniel");
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, titulo, iglesia_id) values ($1, 1, 'slide', 'X', $2)`, [E2, IG])).rejects.toThrow(/permiso/);
    await expect(sql(`insert into public.roles_evento (evento_id, nombre, iglesia_id) values ($1, 'Voz', $2)`, [E2, IG])).rejects.toThrow(/permiso/);
  });
  it("gestiona el cancionero porque su grupo se lo da", async () => {
    await como("daniel");
    await expect(sql(`update public.canciones set tonalidad = 'A' where id = $1`, [CAN])).resolves.toBeTruthy();
    await como("luis");
    await expect(sql(`update public.canciones set tonalidad = 'B' where id = $1`, [CAN])).rejects.toThrow(/permiso/);
  });
  it("no puede crear ni borrar eventos", async () => {
    await como("daniel");
    await expect(sql(`insert into public.eventos (titulo, iglesia_id) values ('X', $1)`, [IG])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.eventos where id = $1`, [E1])).rejects.toThrow(/permiso/);
  });
});

describe("borrar una canción que está en un Setlist", () => {
  it("quien gestiona el cancionero la borra y el Setlist queda desvinculado", async () => {
    await comoServidor();
    const tmp = "f0000000-0000-0000-0000-0000000000ff";
    await sql(`insert into public.canciones (id, titulo, iglesia_id) values ($1, 'Temporal', $2)`, [tmp, IG]);
    await sql(`insert into public.diapositivas_letra (cancion_id, seccion_clave, texto, orden, iglesia_id) values ($1, 'V1', 'x', 0, $2)`, [tmp, IG]);
    await sql(`insert into public.items_servicio (evento_id, orden, tipo, cancion_id, iglesia_id) values ($1, 20, 'cancion', $2, $3)`, [E1, tmp, IG]);
    await como("carlos");
    await expect(sql(`delete from public.canciones where id = $1`, [tmp])).rejects.toThrow(/permiso/);
    await como("daniel");
    await expect(sql(`delete from public.canciones where id = $1`, [tmp])).resolves.toBeTruthy();
    const r = await sql(`select count(*)::int n from public.items_servicio where evento_id = $1 and orden = 20 and cancion_id is null`, [E1]);
    expect(r.rows[0].n).toBe(1);
  });
});

describe("encargada del bloque de Lectura (Ana)", () => {
  it("puede agregar su versículo pero nada más", async () => {
    await como("ana");
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, referencia, iglesia_id) values ($1, 5, 'biblia', 'Juan 3:16', $2)`, [E1, IG])).resolves.toBeTruthy();
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, titulo, iglesia_id) values ($1, 6, 'slide', 'X', $2)`, [E1, IG])).rejects.toThrow(/permiso/);
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, referencia, iglesia_id) values ($1, 6, 'biblia', 'Juan 1:1', $2)`, [E2, IG])).rejects.toThrow(/permiso/);
  });
});

describe("quien dirige la alabanza (Pavel)", () => {
  it("pone el ensayo y la nota del evento, pero no cambia el evento", async () => {
    await como("pavel");
    await expect(sql(`update public.eventos set ensayo_hora = '18:00', nota_alabanza = 'Llegar temprano' where id = $1`, [E1])).resolves.toBeTruthy();
    await expect(sql(`update public.eventos set titulo = 'X' where id = $1`, [E1])).rejects.toThrow(/permiso/);
    await expect(sql(`update public.eventos set ensayo_hora = '18:00' where id = $1`, [E2])).rejects.toThrow(/permiso/);
  });
});

describe("Multimedia (Marta)", () => {
  it("cambia el Setlist y corrige letras desde En vivo, pero no el resto del cancionero", async () => {
    await como("marta");
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, titulo, iglesia_id) values ($1, 1, 'slide', 'Anuncio', $2)`, [E2, IG])).resolves.toBeTruthy();
    await expect(sql(`update public.diapositivas_letra set texto = 'Linea corregida' where cancion_id = $1`, [CAN])).resolves.toBeTruthy();
    await expect(sql(`update public.canciones set titulo = 'X' where id = $1`, [CAN])).rejects.toThrow(/permiso/);
    await expect(sql(`delete from public.eventos where id = $1`, [E2])).rejects.toThrow(/permiso/);
  });
});

describe("roles personalizados", () => {
  it("'Editar el Setlist' edita cualquier Setlist pero no crea eventos", async () => {
    await como("rosa");
    await expect(sql(`insert into public.items_servicio (evento_id, orden, tipo, titulo, iglesia_id) values ($1, 2, 'slide', 'X', $2)`, [E2, IG])).resolves.toBeTruthy();
    await expect(sql(`insert into public.eventos (titulo, iglesia_id) values ('X', $1)`, [IG])).rejects.toThrow(/permiso/);
  });
  it("'Gestionar ministerios' borra un grupo aunque esté vinculado en el Setlist (se desvincula solo)", async () => {
    await comoServidor();
    const extra = "c0000000-0000-0000-0000-0000000000ff";
    await sql(`insert into public.ministerios (id, nombre, iglesia_id) values ($1, 'Temporal', $2)`, [extra, IG]);
    await sql(`update public.items_servicio set ministerio_id = $1 where id = $2`, [extra, IT.e2b]);
    await como("gina");
    await expect(sql(`delete from public.ministerios where id = $1`, [extra])).resolves.toBeTruthy();
    const r = await sql(`select ministerio_id from public.items_servicio where id = $1`, [IT.e2b]);
    expect(r.rows[0].ministerio_id).toBeNull();
  });
});

describe("administrador y servidor", () => {
  it("el administrador puede todo, incluso borrar un evento con todo su Setlist", async () => {
    await como("admin");
    await expect(sql(`update public.canciones set titulo = 'Way Maker (en vivo)' where id = $1`, [CAN])).resolves.toBeTruthy();
    await expect(sql(`delete from public.eventos where id = $1`, [E2])).resolves.toBeTruthy();
    const r = await sql(`select count(*)::int n from public.items_servicio where evento_id = $1`, [E2]);
    expect(r.rows[0].n).toBe(0);
  });
  it("las funciones del servidor (sin sesión) siguen pudiendo todo", async () => {
    await comoServidor();
    await sql(`update public.eventos set titulo = 'Domingo AM' where id = $1`, [E1]);
    const r = await sql(`select titulo from public.eventos where id = $1`, [E1]);
    expect(r.rows[0].titulo).toBe("Domingo AM");
  });
});
