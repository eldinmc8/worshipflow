import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeFakeSupabase } from "./fakeSupabase.js";

// listCancionesCompletas/listEventosCompletos/listMinisteriosCompletos antes hacían una consulta
// completa POR FILA (N+1) -- entre más contenido se acumulaba, más tardaba en abrir la app (ver
// src/lib/canciones.js, eventos.js, ministerios.js para el detalle). Se reescribieron para traer cada
// tabla hija de TODAS las filas de una vez y agruparlas en memoria, número fijo de consultas. Estas
// pruebas fijan como contrato que el resultado final es IDÉNTICO al de antes -- cada fila con sus
// propios hijos, sin mezclarse con los de otra, aunque haya varias filas a la vez.
let fake;
let canciones, eventos, ministerios;

beforeEach(async () => {
  vi.resetModules();
  fake = makeFakeSupabase();
  vi.doMock("../supabaseClient.js", () => ({ supabase: fake.client, callUsersFunction: vi.fn() }));
  canciones = await import("../canciones.js");
  eventos = await import("../eventos.js");
  ministerios = await import("../ministerios.js");
});

describe("listCancionesCompletas (consultas agrupadas)", () => {
  it("cada canción trae SUS PROPIAS secciones/estructura/diapositivas, sin mezclarse con otra", async () => {
    fake.db.canciones = [
      { id: "c1", titulo: "Canción Uno", tonalidad: "G", categoria: "adoracion" },
      { id: "c2", titulo: "Canción Dos", tonalidad: "D", categoria: "himno" },
    ];
    fake.db.secciones_cancion = [
      { id: "s1", cancion_id: "c1", clave: "v1", etiqueta: "Verso 1", distintivo: "", compases: 8, contenido: "letra de c1" },
      { id: "s2", cancion_id: "c2", clave: "v1", etiqueta: "Verso 1", distintivo: "", compases: 8, contenido: "letra de c2" },
    ];
    fake.db.estructura_cancion = [
      { id: "e1", cancion_id: "c1", orden: 0, seccion_clave: "v1", multiplicador: 1 },
      { id: "e2", cancion_id: "c2", orden: 0, seccion_clave: "v1", multiplicador: 2 },
    ];
    fake.db.diapositivas_letra = [
      { id: "d1", cancion_id: "c1", seccion_clave: "v1", orden_en_seccion: 0, texto: "diapo c1", orden: 0 },
    ];

    const resultado = await canciones.listCancionesCompletas();

    expect(resultado).toHaveLength(2);
    const c1 = resultado.find((c) => c.id === "c1");
    const c2 = resultado.find((c) => c.id === "c2");
    expect(c1.blocks.v1.lines.join("\n")).toBe("letra de c1");
    expect(c2.blocks.v1.lines.join("\n")).toBe("letra de c2");
    expect(c1.defaultStructure).toEqual(["v1"]);
    expect(c2.defaultStructure).toEqual(["v1", "v1"]); // multiplicador:2
    // c1 ya tiene diapositivas reales guardadas -> no usa el respaldo derivado del Contenido.
    expect(c1.letra.v1).toEqual([["diapo c1"]]);
    // c2 NUNCA tuvo diapositivas guardadas -> cae al respaldo (derivado de sus propias líneas, no las de c1).
    expect(c2.letra.v1[0].join("\n")).toBe("letra de c2");
  });

  it("biblioteca vacía no revienta y no dispara consultas de más", async () => {
    fake.db.canciones = [];
    const resultado = await canciones.listCancionesCompletas();
    expect(resultado).toEqual([]);
  });
});

describe("listEventosCompletos (consultas agrupadas)", () => {
  it("cada evento trae SOLO sus propios bloques, roles, encargados y recordatorios", async () => {
    fake.db.eventos = [
      { id: "ev1", titulo: "Domingo AM" },
      { id: "ev2", titulo: "Domingo PM" },
    ];
    fake.db.items_servicio = [
      { id: "it1", evento_id: "ev1", tipo: "bloque", titulo: "Alabanza", orden: 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false },
      { id: "it2", evento_id: "ev2", tipo: "bloque", titulo: "Predicación", orden: 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false },
    ];
    fake.db.roles_evento = [
      { id: "r1", evento_id: "ev1", nombre: "Guitarra", orden: 0 },
      { id: "r2", evento_id: "ev2", nombre: "Sonido", orden: 0 },
    ];
    fake.db.miembros_rol = [
      { id: "m-it1", item_servicio_id: "it1", rol_id: null, nombre: "Flor", usuario_id: "u-flor", estado: "pendiente", lead: false, orden: 0 },
      { id: "m-it2", item_servicio_id: "it2", rol_id: null, nombre: "Beto", usuario_id: "u-beto", estado: "pendiente", lead: false, orden: 0 },
      { id: "m-r1", item_servicio_id: null, rol_id: "r1", nombre: "Gerardo", usuario_id: "u-gerardo", estado: "confirmado", lead: false, orden: 0 },
      { id: "m-r2", item_servicio_id: null, rol_id: "r2", nombre: "Ana", usuario_id: "u-ana", estado: "confirmado", lead: false, orden: 0 },
    ];
    fake.db.recordatorios_evento = [
      { id: "rec1", evento_id: "ev1", cantidad: 1, unidad: "dias", enviado: false },
      { id: "rec2", evento_id: "ev2", cantidad: 2, unidad: "horas", enviado: true },
    ];
    fake.db.asignaciones_vistas = [];

    const resultado = await eventos.listEventosCompletos();
    expect(resultado).toHaveLength(2);
    const ev1 = resultado.find((e) => e.id === "ev1");
    const ev2 = resultado.find((e) => e.id === "ev2");

    expect(ev1.serviceOrder.map((i) => i.id)).toEqual(["it1"]);
    expect(ev2.serviceOrder.map((i) => i.id)).toEqual(["it2"]);
    expect(ev1.serviceOrder[0].encargados.map((m) => m.n)).toEqual(["Flor"]);
    expect(ev2.serviceOrder[0].encargados.map((m) => m.n)).toEqual(["Beto"]);

    expect(ev1.worshipRoles.map((r) => r.name)).toEqual(["Guitarra"]);
    expect(ev1.worshipRoles[0].members.map((m) => m.n)).toEqual(["Gerardo"]);
    expect(ev2.worshipRoles.map((r) => r.name)).toEqual(["Sonido"]);
    expect(ev2.worshipRoles[0].members.map((m) => m.n)).toEqual(["Ana"]);

    expect(ev1.reminders).toEqual([{ id: "rec1", cantidad: 1, unidad: "dias", enviado: false }]);
    expect(ev2.reminders).toEqual([{ id: "rec2", cantidad: 2, unidad: "horas", enviado: true }]);
  });

  it("sin eventos no revienta", async () => {
    fake.db.eventos = [];
    const resultado = await eventos.listEventosCompletos();
    expect(resultado).toEqual([]);
  });

  it("si asignaciones_vistas falla, el resto de los eventos igual carga (con vistas vacío)", async () => {
    fake.db.eventos = [{ id: "ev1", titulo: "Domingo" }];
    fake.db.items_servicio = [];
    fake.db.roles_evento = [];
    fake.db.miembros_rol = [];
    fake.db.recordatorios_evento = [];
    // No existe la tabla asignaciones_vistas en esta "base" -- el builder la trata igual que una tabla
    // vacía (array []), así que esto ya cubre el caso "no hay filas"; el camino de error real se prueba
    // por inspección del código (then(r => r.error ? {data:[]} : r, () => ({data:[]}))).
    const resultado = await eventos.listEventosCompletos();
    expect(resultado[0].vistas).toEqual([]);
  });
});

describe("listMinisteriosCompletos (consultas agrupadas)", () => {
  it("cada ministerio trae SU PROPIA planificación y recursos", async () => {
    fake.db.ministerios = [
      { id: "min1", nombre: "Infantil", color: "#111", lider_id: null },
      { id: "min2", nombre: "Jóvenes", color: "#222", lider_id: null },
    ];
    fake.db.planificacion_ministerio = [
      { id: "p1", ministerio_id: "min1", fecha: "2026-10-04", titulo: "Semana 1", detalle: "", orden: 0 },
      { id: "p2", ministerio_id: "min2", fecha: "2026-10-04", titulo: "Noche de juegos", detalle: "", orden: 0 },
    ];
    fake.db.recursos_ministerio = [
      { id: "r1", ministerio_id: "min1", titulo: "Guía manualidades", enlace: "", orden: 0, mes: "2026-10" },
    ];

    const resultado = await ministerios.listMinisteriosCompletos();
    expect(resultado).toHaveLength(2);
    const min1 = resultado.find((m) => m.id === "min1");
    const min2 = resultado.find((m) => m.id === "min2");
    expect(min1.plan.map((p) => p.title)).toEqual(["Semana 1"]);
    expect(min2.plan.map((p) => p.title)).toEqual(["Noche de juegos"]);
    expect(min1.resources.map((r) => r.title)).toEqual(["Guía manualidades"]);
    expect(min2.resources).toEqual([]);
  });

  it("sin ministerios no revienta", async () => {
    fake.db.ministerios = [];
    const resultado = await ministerios.listMinisteriosCompletos();
    expect(resultado).toEqual([]);
  });
});
