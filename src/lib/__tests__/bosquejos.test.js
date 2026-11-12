import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
const { esBloquePredicacion, bosquejoAItems, aplicarBosquejoAlOrden, bosquejoListoParaEnviar, bosquejoTieneCambiosSinEnviar, versiculosSueltos, completarVersosBosquejo, subtituloProyectable } = await import("../bosquejos.js");

const contador = () => { let n = 0; return () => `n${++n}`; };
const juan316 = { ref: "Juan 3:16", version: "RVR1960", text: "Porque de tal manera amó Dios al mundo...", bookId: 43, bookName: "Juan", chapter: 3, verseStart: 16, verseEnd: 16 };
const rom58 = { ref: "Romanos 5:8", version: "RVR1960", text: "Mas Dios muestra su amor para con nosotros...", bookId: 45, bookName: "Romanos", chapter: 5, verseStart: 8, verseEnd: 8 };

describe("esBloquePredicacion", () => {
  it("reconoce los nombres comunes del bloque", () => {
    ["Predicación", "Prédica", "Predica de la Palabra", "Sermón", "Mensaje"].forEach((t) => expect(esBloquePredicacion({ type: "seccion", title: t })).toBe(true));
  });
  it("no confunde otros bloques ni ítems que no son bloques", () => {
    expect(esBloquePredicacion({ type: "seccion", title: "Lectura y oración" })).toBe(false);
    expect(esBloquePredicacion({ type: "slide", title: "Predicación" })).toBe(false);
  });
  it("la marca a mano manda sobre el nombre", () => {
    expect(esBloquePredicacion({ type: "seccion", title: "La Palabra", esPredicacion: true })).toBe(true);
    expect(esBloquePredicacion({ type: "seccion", title: "Mensaje de bienvenida", esPredicacion: false })).toBe(false);
    expect(esBloquePredicacion({ type: "slide", title: "La Palabra", esPredicacion: true })).toBe(false);
  });
});

describe("bosquejoAItems", () => {
  const bosquejo = {
    titulo: " La gracia que transforma ", citaBase: juan316, ideaCentral: "Dios nos ama primero", mostrarIdea: false,
    puntos: [
      { id: "p1", titulo: "Su amor es inmerecido", nota: "Contar la historia del hijo pródigo", versiculos: [rom58] },
      { id: "p2", titulo: "  ", nota: "", versiculos: [] },
      { id: "p3", titulo: "Su amor nos cambia", nota: "", versiculos: [] },
    ],
  };
  it("arma las diapositivas en el orden en que se predica, todas marcadas con el bloque", () => {
    const items = bosquejoAItems(bosquejo, "B1", contador());
    expect(items.map((it) => [it.type, it.title || it.reference])).toEqual([
      ["slide", "La gracia que transforma"],
      ["biblia", "Juan 3:16"],
      ["slide", "Su amor es inmerecido"],
      ["biblia", "Romanos 5:8"],
      ["slide", "Su amor nos cambia"],
    ]);
    expect(items.every((it) => it.bosquejoDe === "B1")).toBe(true);
    expect(items[0].subtitle).toBe("Juan 3:16");
    // Solo el contenido: "Punto 1", "Punto 3" ya no se proyectan; el número viaja aparte.
    expect(items[2]).toMatchObject({ isSermonPoint: true, subtitle: "", bosquejoPunto: 1 });
    expect(items[4]).toMatchObject({ subtitle: "", bosquejoPunto: 3 });
    expect(new Set(items.map((it) => it.id)).size).toBe(items.length);
  });
  it("la nota del predicador nunca se proyecta", () => {
    const items = bosquejoAItems(bosquejo, "B1", contador());
    expect(JSON.stringify(items)).not.toContain("hijo pródigo");
  });
  it("la idea central se proyecta solo si se pidió", () => {
    const items = bosquejoAItems({ ...bosquejo, mostrarIdea: true }, "B1", contador());
    expect(items[2].title).toBe("Dios nos ama primero");
  });
  it("sin título no hay nada que enviar", () => {
    expect(bosquejoListoParaEnviar({ titulo: "  " })).toBe(false);
    expect(bosquejoAItems({ ...bosquejo, titulo: "" }, "B1")).toEqual([]);
  });
  it("solo con título y sin cita también sirve", () => {
    const items = bosquejoAItems({ titulo: "Fe", citaBase: null, puntos: [] }, "B1", contador());
    expect(items).toHaveLength(1);
    expect(items[0].subtitle).toBe("");
  });
});

// Juan 8:1-3 como lo entrega el buscador de la Biblia (con el texto de cada versículo).
const juan8 = {
  ref: "Juan 8:1-3", version: "RVR1960", text: "Y Jesús se fue al monte de los Olivos. Y por la mañana volvió al templo... Entonces los escribas...",
  bookId: 43, bookName: "Juan", chapter: 8, verseStart: 1, verseEnd: 3,
  versos: [{ verse: 1, text: "Y Jesús se fue al monte de los Olivos." }, { verse: 2, text: "Y por la mañana volvió al templo..." }, { verse: 3, text: "Entonces los escribas..." }],
};

describe("pasajes del bosquejo: un versículo por diapositiva (como la Biblia)", () => {
  it("un pasaje se reparte en un versículo por diapositiva, con su propia cita", () => {
    const sueltos = versiculosSueltos(juan8);
    expect(sueltos.map((v) => v.ref)).toEqual(["Juan 8:1", "Juan 8:2", "Juan 8:3"]);
    expect(sueltos[1]).toMatchObject({ text: "Y por la mañana volvió al templo...", verseStart: 2, verseEnd: 2, version: "RVR1960", bookId: 43, chapter: 8 });
  });
  it("en el bosquejo: cita base y versículos de cada punto, uno por uno y con la marca del punto", () => {
    const items = bosquejoAItems({ titulo: "La mujer adúltera", citaBase: juan8, puntos: [{ id: "p1", titulo: "Jesús nos recibe", versiculos: [juan8] }] }, "B1", contador());
    expect(items.map((it) => it.title || it.reference)).toEqual(["La mujer adúltera", "Juan 8:1", "Juan 8:2", "Juan 8:3", "Jesús nos recibe", "Juan 8:1", "Juan 8:2", "Juan 8:3"]);
    expect(items.slice(5).every((it) => it.bosquejoPunto === 1 && it.type === "biblia")).toBe(true);
    expect(items[0].subtitle).toBe("Juan 8:1-3");
  });
  it("un solo versículo, o un pasaje sin el texto de cada versículo, sale completo como antes", () => {
    expect(versiculosSueltos(juan316)).toEqual([juan316]);
    const { versos, ...sinVersos } = juan8; // eslint-disable-line no-unused-vars
    expect(versiculosSueltos(sinVersos)).toEqual([sinVersos]);
  });
  it("bosquejos guardados antes: completa el texto de cada versículo trayendo el capítulo una sola vez", async () => {
    const { versos, ...viejo } = juan8; // eslint-disable-line no-unused-vars
    const traer = vi.fn(async () => [1, 2, 3, 4].map((n) => ({ verse: n, text: `<b>v${n}</b>` })));
    const b = await completarVersosBosquejo({ titulo: "X", citaBase: viejo, puntos: [{ id: "p", versiculos: [viejo, juan316], subpuntos: [{ id: "s", versiculos: [viejo] }] }] }, traer);
    expect(traer).toHaveBeenCalledTimes(1);
    expect(traer).toHaveBeenCalledWith("RVR1960", 43, 8);
    expect(b.citaBase.versos).toEqual([{ verse: 1, text: "v1" }, { verse: 2, text: "v2" }, { verse: 3, text: "v3" }]);
    expect(b.puntos[0].versiculos[1]).toEqual(juan316); // un solo versículo: no hace falta
    expect(b.puntos[0].subpuntos[0].versiculos[0].versos).toHaveLength(3);
  });
  it("si el capítulo no se puede traer (sin internet), el pasaje queda como estaba", async () => {
    const { versos, ...viejo } = juan8; // eslint-disable-line no-unused-vars
    const b = await completarVersosBosquejo({ titulo: "X", citaBase: viejo, puntos: [] }, () => Promise.reject(new Error("sin red")));
    expect(b.citaBase).toEqual(viejo);
  });
  it("las etiquetas 'Punto N' / 'Conclusión' de diapositivas ya enviadas no se proyectan; otros subtítulos sí", () => {
    expect(subtituloProyectable({ bosquejoDe: "B1", subtitle: "Punto 2" })).toBe("");
    expect(subtituloProyectable({ bosquejoDe: "B1", subtitle: "Punto 1 · A" })).toBe("");
    expect(subtituloProyectable({ bosquejoDe: "B1", subtitle: "Conclusión 2" })).toBe("");
    expect(subtituloProyectable({ bosquejoDe: "B1", subtitle: "Juan 3:16" })).toBe("Juan 3:16");
    expect(subtituloProyectable({ subtitle: "Punto 2" })).toBe("Punto 2"); // una diapositiva normal, no del bosquejo
  });
});

describe("aplicarBosquejoAlOrden", () => {
  const orden = [
    { id: "A", type: "seccion", title: "Alabanza" },
    { id: "c1", type: "cancion" },
    { id: "B1", type: "seccion", title: "Predicación" },
    { id: "v1", type: "slide", title: "Video" },
    { id: "viejo1", type: "slide", bosquejoDe: "B1" },
    { id: "viejo2", type: "biblia", bosquejoDe: "B1" },
    { id: "otro", type: "slide", bosquejoDe: "B9" },
    { id: "D", type: "seccion", title: "Despedida" },
    { id: "c2", type: "cancion" },
  ];
  it("reemplaza la versión anterior al final del bloque de Predicación", () => {
    const nuevos = [{ id: "n1", bosquejoDe: "B1" }, { id: "n2", bosquejoDe: "B1" }];
    expect(aplicarBosquejoAlOrden(orden, "B1", nuevos).map((it) => it.id)).toEqual(["A", "c1", "B1", "v1", "otro", "n1", "n2", "D", "c2"]);
  });
  it("no modifica el orden original", () => {
    aplicarBosquejoAlOrden(orden, "B1", []);
    expect(orden).toHaveLength(9);
  });
  it("si el bloque ya no existe no agrega nada", () => {
    expect(aplicarBosquejoAlOrden(orden, "NO", [{ id: "n1" }])).toEqual(orden);
  });
});

describe("bosquejoTieneCambiosSinEnviar", () => {
  it("avisa solo si se editó después de enviarlo", () => {
    expect(bosquejoTieneCambiosSinEnviar({ enviadoAt: null, updatedAt: "2026-11-01T10:00:00Z" })).toBe(false);
    expect(bosquejoTieneCambiosSinEnviar({ enviadoAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z" })).toBe(false);
    expect(bosquejoTieneCambiosSinEnviar({ enviadoAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T12:00:00Z" })).toBe(true);
  });
});
