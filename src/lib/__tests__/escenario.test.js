import { describe, expect, it } from "vitest";
import { armarEscenario, abreviarParte, resumenDiapositiva, tiempoTranscurrido, perteneceA } from "../escenario.js";

const A = "aaaaaaaa-0000-0000-0000-000000000001"; // canción 1
const B = "aaaaaaaa-0000-0000-0000-000000000002"; // versículo
const C = "aaaaaaaa-0000-0000-0000-000000000003"; // canción 2
const library = [{ id: "s1", title: "Way Maker", key: "E" }, { id: "s2", title: "Grande es tu fidelidad", key: "D" }];
const serviceOrder = [
  { id: "blk", type: "seccion", title: "Alabanza" },
  { id: A, type: "cancion", songId: "s1", keyOverride: "G" },
  { id: B, type: "biblia", reference: "Juan 3:16" },
  { id: C, type: "cancion", songId: "s2" },
];
const cancion = (item, pos, n, parte, lineas) => ({ slideId: `${item}-${pos}-${n}`, type: "cancion", songTitle: "Way Maker", sectionLabel: parte, blockLabel: parte, blockKey: parte, lines: lineas });
const slides = [
  cancion(A, 0, 0, "Verso 1", ["Aquí estás", "obrando en este lugar"]),
  cancion(A, 0, 1, "Verso 1", ["Te adoro", ""]),
  cancion(A, 1, 0, "Coro", ["Milagroso", "promesa fiel"]),
  cancion(A, 2, 0, "Verso 2", ["Aquí estás"]),
  cancion(A, 3, 0, "Coro", ["Milagroso"]),
  { slideId: B, type: "biblia", reference: "Juan 3:16", text: "Porque de tal manera amó Dios al mundo" },
  cancion(C, 0, 0, "Verso 1", ["Oh Dios eterno"]),
];

describe("armarEscenario", () => {
  it("muestra la parte actual, la que sigue y la siguiente diapositiva", () => {
    const e = armarEscenario({ slides, indice: 1, serviceOrder, library });
    expect(e.cancion).toEqual({ titulo: "Way Maker", tono: "G" });
    expect(e.partes.map((p) => p.corto)).toEqual(["V1", "C", "V2", "C"]);
    expect(e.parteActual).toBe(0);
    expect(e.siguienteParte).toBe("Coro");
    expect(e.siguiente).toMatchObject({ tipo: "cancion", lineas: ["Milagroso", "promesa fiel"] });
    expect(e.siguienteEsOtro).toBe(false);
  });
  it("el coro repetido cuenta como otra parte (resalta el segundo coro, no el primero)", () => {
    const e = armarEscenario({ slides, indice: 4, serviceOrder, library });
    expect(e.parteActual).toBe(3);
    expect(e.siguienteParte).toBe("");
    expect(e.siguienteEsOtro).toBe(true);
    expect(e.siguiente).toMatchObject({ tipo: "biblia", etiqueta: "Juan 3:16" });
  });
  it("dice cuál es la siguiente canción y lo que viene en el culto", () => {
    const e = armarEscenario({ slides, indice: 0, serviceOrder, library });
    expect(e.siguienteCancion).toEqual({ titulo: "Grande es tu fidelidad", tono: "D" });
    expect(e.proximos.map((p) => p.titulo)).toEqual(["Juan 3:16", "Grande es tu fidelidad"]);
  });
  it("en un versículo no hay partes de canción", () => {
    const e = armarEscenario({ slides, indice: 5, serviceOrder, library });
    expect(e.cancion).toBeNull();
    expect(e.partes).toEqual([]);
    expect(e.siguiente.titulo).toBe("Way Maker");
  });
  it("algo fuera del plan (versículo suelto) no rompe nada", () => {
    const e = armarEscenario({ slides, indice: -1, alAire: { slideId: "suelto", type: "biblia", reference: "Sal 23:1", text: "..." }, serviceOrder, library, mensaje: "  Último coro  ", inicio: "2026-11-01T10:00:00Z" });
    expect(e.siguiente).toBeNull();
    expect(e.proximos).toEqual([]);
    expect(e.mensaje).toBe("Último coro");
    expect(e.inicio).toBe("2026-11-01T10:00:00Z");
  });
});

describe("ayudantes", () => {
  it("abrevia las partes", () => {
    expect(["Verso 1", "Coro", "Pre-coro", "Puente", "Intro", "Final", "Estrofa 2", "Algo raro"].map(abreviarParte)).toEqual(["V1", "C", "PC", "P", "I", "F", "V2", "ALG"]);
  });
  it("resume diapositivas de texto y versículos sin líneas vacías", () => {
    expect(resumenDiapositiva(slides[1]).lineas).toEqual(["Te adoro"]);
    expect(resumenDiapositiva({ type: "slide", title: "La gracia", subtitle: "Punto 1" }).lineas).toEqual(["La gracia", "Punto 1"]);
    expect(resumenDiapositiva(null)).toBeNull();
  });
  it("reconoce a qué elemento pertenece una diapositiva", () => {
    expect(perteneceA(slides[0], A)).toBe(true);
    expect(perteneceA({ slideId: `${B}~1` }, B)).toBe(true);
    expect(perteneceA(slides[0], B)).toBe(false);
  });
  it("cuenta el tiempo transcurrido", () => {
    const inicio = "2026-11-01T10:00:00Z";
    expect(tiempoTranscurrido(inicio, Date.parse("2026-11-01T10:12:04Z"))).toBe("12:04");
    expect(tiempoTranscurrido(inicio, Date.parse("2026-11-01T11:05:09Z"))).toBe("1:05:09");
    expect(tiempoTranscurrido(null)).toBe("");
  });
});
