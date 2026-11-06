import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeFakeSupabase } from "./fakeSupabase.js";

// eventos.js y recordatorios.js importan "../supabaseClient.js" directo, que en el archivo real crea
// un cliente de Supabase de verdad con import.meta.env -- hay que sustituirlo por el cliente en
// memoria ANTES de importar eventos.js, para cada prueba (vi.resetModules + import dinámico), así cada
// prueba arranca con su propia "base de datos" y su propia línea base (lineaBase.js también se
// re-importa fresca, sin arrastrar estado de la prueba anterior -- ver su Map module-level).
let fake;
let eventos;
let lineaBase;

beforeEach(async () => {
  vi.resetModules();
  fake = makeFakeSupabase();
  vi.doMock("../supabaseClient.js", () => ({ supabase: fake.client, callUsersFunction: vi.fn() }));
  eventos = await import("../eventos.js");
  lineaBase = await import("../lineaBase.js");
});

describe("guardado por diferencias (eventos.js + lineaBase.js)", () => {
  it("un encargado agregado por fuera después de cargar el evento NO se borra al guardar otro cambio", async () => {
    const eventoId = "evento-1";
    fake.db.eventos = [{ id: eventoId, titulo: "Domingo AM" }];
    fake.db.items_servicio = [{ id: "item-1", evento_id: eventoId, tipo: "bloque", titulo: "Limpieza", orden: 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false }];
    fake.db.miembros_rol = [{ id: "m-ana", item_servicio_id: "item-1", nombre: "Ana", usuario_id: "u-ana", estado: "pendiente", lead: false, orden: 0 }];

    // 1) El dispositivo CARGA el evento (como haría listEventosCompletos/getEventoCompleto) y registra
    //    su línea base -- en este punto solo conoce a Ana.
    const eventoCargado = eventos.eventoCompletoAFormatoEditor({
      evento: fake.db.eventos[0], items: fake.db.items_servicio, encargados: fake.db.miembros_rol,
      roles: [], roleMembers: [], recordatorios: [], vistas: [],
    });
    eventos.registrarLineaBaseEventos([eventoCargado]);

    // 2) MIENTRAS TANTO, alguien agrega a Beto por fuera -- otro dispositivo, o el Asistente -- directo
    //    en la base. Este dispositivo nunca se entera, su estado en memoria sigue siendo solo "Ana".
    fake.db.miembros_rol.push({ id: "m-beto", item_servicio_id: "item-1", nombre: "Beto", usuario_id: "u-beto", estado: "pendiente", lead: false, orden: 1 });

    // 3) Este dispositivo guarda un cambio DISTINTO (renombra el bloque), con su serviceOrder de
    //    memoria -- que todavía solo tiene a Ana, porque nunca vio a Beto.
    const serviceOrderDelDispositivo = [
      { ...eventoCargado.serviceOrder[0], title: "Limpieza y orden" },
    ];
    await eventos.sincronizarServiceOrder(eventoId, serviceOrderDelDispositivo);

    // Beto DEBE seguir en la base -- el bug real (octubre 2026) lo borraba aquí.
    const idsFinales = fake.db.miembros_rol.map((m) => m.id);
    expect(idsFinales).toContain("m-beto");
    expect(idsFinales).toContain("m-ana");
    // Y el cambio que sí se pidió (renombrar el bloque) sí se aplicó.
    expect(fake.db.items_servicio.find((i) => i.id === "item-1").titulo).toBe("Limpieza y orden");
  });

  it("si el dispositivo SÍ quita a alguien que conocía, ese sí se borra", async () => {
    const eventoId = "evento-2";
    fake.db.eventos = [{ id: eventoId, titulo: "Domingo PM" }];
    fake.db.items_servicio = [{ id: "item-2", evento_id: eventoId, tipo: "bloque", titulo: "Oración", orden: 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false }];
    fake.db.miembros_rol = [{ id: "m-carla", item_servicio_id: "item-2", nombre: "Carla", usuario_id: "u-carla", estado: "pendiente", lead: false, orden: 0 }];

    const eventoCargado = eventos.eventoCompletoAFormatoEditor({
      evento: fake.db.eventos[0], items: fake.db.items_servicio, encargados: fake.db.miembros_rol,
      roles: [], roleMembers: [], recordatorios: [], vistas: [],
    });
    eventos.registrarLineaBaseEventos([eventoCargado]);

    // El dispositivo SÍ conocía a Carla y la quita a propósito.
    const serviceOrderSinCarla = [{ ...eventoCargado.serviceOrder[0], encargados: [] }];
    await eventos.sincronizarServiceOrder(eventoId, serviceOrderSinCarla);

    expect(fake.db.miembros_rol.map((m) => m.id)).not.toContain("m-carla");
  });

  it("dos guardados seguidos (el segundo sin saber del externo) tampoco borran lo agregado por fuera entre medio", async () => {
    const eventoId = "evento-3";
    fake.db.eventos = [{ id: eventoId, titulo: "Jueves" }];
    fake.db.items_servicio = [{ id: "item-3", evento_id: eventoId, tipo: "bloque", titulo: "Alabanza", orden: 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false }];
    fake.db.miembros_rol = [];

    const eventoCargado = eventos.eventoCompletoAFormatoEditor({
      evento: fake.db.eventos[0], items: fake.db.items_servicio, encargados: [], roles: [], roleMembers: [], recordatorios: [], vistas: [],
    });
    eventos.registrarLineaBaseEventos([eventoCargado]);

    // Primer guardado de este dispositivo: agrega a Diana.
    await eventos.sincronizarServiceOrder(eventoId, [
      { ...eventoCargado.serviceOrder[0], encargados: [{ id: "m-diana", n: "Diana", usuarioId: "u-diana", status: "pendiente", lead: false }] },
    ]);
    expect(fake.db.miembros_rol.map((m) => m.id)).toEqual(["m-diana"]);

    // Entre el primer y el segundo guardado, alguien más agrega a Esteban por fuera.
    fake.db.miembros_rol.push({ id: "m-esteban", item_servicio_id: "item-3", nombre: "Esteban", usuario_id: "u-esteban", estado: "pendiente", lead: false, orden: 1 });

    // Segundo guardado de este dispositivo: solo sabe de Diana (la que él mismo agregó), nada de Esteban.
    await eventos.sincronizarServiceOrder(eventoId, [
      { ...eventoCargado.serviceOrder[0], title: "Alabanza y adoración", encargados: [{ id: "m-diana", n: "Diana", usuarioId: "u-diana", status: "confirmado", lead: false }] },
    ]);

    const idsFinales = fake.db.miembros_rol.map((m) => m.id);
    expect(idsFinales).toContain("m-diana");
    expect(idsFinales).toContain("m-esteban"); // sigue sin borrarse
  });
});

describe("crear evento desde plantilla (crearEventoCompleto)", () => {
  it("copia bloques con su ministerio_id, los roles del equipo de alabanza y los recordatorios", async () => {
    // Simula lo que cloneServiceOrder/cloneWorshipRoles/cloneRecordatorios (PrototipoWorshipFlow.jsx)
    // producen al clonar una plantilla: ids nuevos, estado de confirmación reiniciado a "pendiente",
    // recordatorios con enviado:false -- eventos.js no conoce la plantilla original, solo recibe este
    // evento ya clonado en memoria y lo tiene que persistir completo.
    const nuevoEvento = {
      id: "evento-nuevo",
      title: "Domingo AM — 12 de octubre",
      dateLabel: "", date: "2026-10-12", hora: "09:00", location: "Templo principal",
      esPlantilla: false,
      serviceOrder: [
        { id: "item-clon-1", type: "seccion", title: "Alabanza", description: "", ministryId: "min-alabanza", encargados: [] },
        { id: "item-clon-2", type: "seccion", title: "Limpieza", description: "", ministryId: "min-limpieza", encargados: [{ id: "enc-1", n: "Flor", usuarioId: "u-flor", status: "pendiente", lead: true }] },
      ],
      worshipRoles: [
        { id: "rol-guitarra", name: "Guitarra", members: [{ id: "miem-1", n: "Gerardo", usuarioId: "u-gerardo", status: "pendiente", lead: false }] },
      ],
      reminders: [{ id: "rec-1", cantidad: 2, unidad: "dias", enviado: false }],
      vistas: [],
    };

    await eventos.crearEventoCompleto(nuevoEvento, "admin-1");

    // El evento en sí.
    expect(fake.db.eventos.find((e) => e.id === "evento-nuevo")).toBeTruthy();

    // Los dos bloques, cada uno con SU ministerio_id (no se mezclan ni se pierden).
    const itemAlabanza = fake.db.items_servicio.find((i) => i.id === "item-clon-1");
    const itemLimpieza = fake.db.items_servicio.find((i) => i.id === "item-clon-2");
    expect(itemAlabanza.ministerio_id).toBe("min-alabanza");
    expect(itemLimpieza.ministerio_id).toBe("min-limpieza");
    expect(itemAlabanza.tipo).toBe("bloque");

    // El encargado del bloque de Limpieza quedó guardado, vinculado a ese ítem.
    const encargadoFlor = fake.db.miembros_rol.find((m) => m.id === "enc-1");
    expect(encargadoFlor).toMatchObject({ item_servicio_id: "item-clon-2", nombre: "Flor", estado: "pendiente" });

    // El rol del equipo de alabanza y su integrante.
    expect(fake.db.roles_evento.find((r) => r.id === "rol-guitarra")).toMatchObject({ nombre: "Guitarra", evento_id: "evento-nuevo" });
    const miembroGerardo = fake.db.miembros_rol.find((m) => m.id === "miem-1");
    expect(miembroGerardo).toMatchObject({ rol_id: "rol-guitarra", nombre: "Gerardo" });

    // El recordatorio, con enviado:false aunque la plantilla original ya lo hubiera usado antes.
    const recordatorio = fake.db.recordatorios_evento.find((r) => r.id === "rec-1");
    expect(recordatorio).toMatchObject({ evento_id: "evento-nuevo", cantidad: 2, unidad: "dias", enviado: false });
  });
});

describe("marca manual del bloque de la predicación", () => {
  it("se guarda en estructura y vuelve al cargar", async () => {
    const eventoId = "evento-pred";
    fake.db.eventos = [{ id: eventoId, titulo: "Domingo" }];
    fake.db.items_servicio = [
      { id: "b-pal", evento_id: eventoId, tipo: "bloque", titulo: "La Palabra", orden: 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false },
      { id: "b-otro", evento_id: eventoId, tipo: "bloque", titulo: "Anuncios", orden: 1, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false },
    ];
    fake.db.miembros_rol = [];
    const cargar = () => eventos.eventoCompletoAFormatoEditor({ evento: fake.db.eventos[0], items: fake.db.items_servicio, encargados: fake.db.miembros_rol, roles: [], roleMembers: [], recordatorios: [], vistas: [] });
    const ev = cargar();
    expect(ev.serviceOrder[0].esPredicacion).toBeUndefined();
    eventos.registrarLineaBaseEventos([ev]);
    await eventos.sincronizarServiceOrder(eventoId, [{ ...ev.serviceOrder[0], esPredicacion: true }, ev.serviceOrder[1]]);
    expect(fake.db.items_servicio.find((i) => i.id === "b-pal").estructura).toEqual({ predicacion: true });
    // Sin marca, el bloque sigue igual que antes.
    expect(fake.db.items_servicio.find((i) => i.id === "b-otro").estructura).toEqual([]);
    expect(cargar().serviceOrder[0].esPredicacion).toBe(true);
  });
});

describe("cuenta regresiva en el Setlist", () => {
  it("su configuración se guarda en estructura y vuelve al cargar", async () => {
    const eventoId = "evento-cuenta";
    fake.db.eventos = [{ id: eventoId, titulo: "Domingo" }];
    fake.db.items_servicio = [];
    fake.db.miembros_rol = [];
    const config = { modo: "minutos", minutos: 7, estilo: "neon", mostrarTexto: false, texto: "", alTerminar: "avanzar", mensajeFinal: "", fondo: "propio" };
    await eventos.sincronizarServiceOrder(eventoId, [{ id: "c1", type: "slide", title: "Cuenta regresiva", subtitle: "", bg: "#0B0F17", bgType: "color", cuentaRegresiva: config, encargados: [] }]);
    const fila = fake.db.items_servicio.find((i) => i.id === "c1");
    expect(fila).toMatchObject({ tipo: "slide", estructura: { cuentaRegresiva: config } });
    const ev = eventos.eventoCompletoAFormatoEditor({ evento: fake.db.eventos[0], items: fake.db.items_servicio, encargados: [], roles: [], roleMembers: [], recordatorios: [], vistas: [] });
    expect(ev.serviceOrder[0].cuentaRegresiva).toEqual(config);
  });
});

describe("animación de una canción solo en este evento", () => {
  it("viaja en items_servicio.animacion y vuelve al cargar; sin la columna se guarda sin ella", async () => {
    const eventoId = "evento-anim";
    fake.db.eventos = [{ id: eventoId, titulo: "Domingo" }];
    fake.db.items_servicio = [];
    fake.db.miembros_rol = [];
    await eventos.sincronizarServiceOrder(eventoId, [{ id: "c1", type: "cancion", songId: "s1", animacion: { general: "neon" }, encargados: [] }]);
    expect(fake.db.items_servicio.find((i) => i.id === "c1").animacion).toEqual({ general: "neon" });
    const ev = eventos.eventoCompletoAFormatoEditor({ evento: fake.db.eventos[0], items: fake.db.items_servicio, encargados: [], roles: [], roleMembers: [], recordatorios: [], vistas: [] });
    expect(ev.serviceOrder[0].animacion).toEqual({ general: "neon" });
    // Una canción que nunca supo de la animación no manda la columna.
    const fila = eventos.eventoCompletoAFormatoEditor({ evento: fake.db.eventos[0], items: [{ id: "c2", evento_id: eventoId, tipo: "cancion", cancion_id: "s1", orden: 0 }], encargados: [], roles: [], roleMembers: [], recordatorios: [], vistas: [] }).serviceOrder[0];
    expect("animacion" in fila).toBe(false);
  });
});
