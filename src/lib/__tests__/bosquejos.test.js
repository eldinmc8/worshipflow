import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
const { esBloquePredicacion, bosquejoAItems, aplicarBosquejoAlOrden, bosquejoListoParaEnviar, bosquejoTieneCambiosSinEnviar } = await import("../bosquejos.js");

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
    expect(items[2]).toMatchObject({ isSermonPoint: true, subtitle: "Punto 1" });
    expect(items[4].subtitle).toBe("Punto 3");
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
