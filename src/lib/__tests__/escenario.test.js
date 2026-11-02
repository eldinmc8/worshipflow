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

import { estaEnPredicacion, datosPredicacion, restanteTemporizador, textoTemporizador, nivelTemporizador, iniciarTemporizador, pausarTemporizador, reanudarTemporizador } from "../escenario.js";

describe("predicación en el escenario", () => {
  const orden = [
    { id: "alab", type: "seccion", title: "Alabanza" },
    { id: "c1", type: "cancion" },
    { id: "pred", type: "seccion", title: "Predicación" },
    { id: "t", type: "slide", title: "La gracia", bosquejoDe: "pred" },
    { id: "p1", type: "slide", title: "Su amor es inmerecido", subtitle: "Punto 1", bosquejoDe: "pred", bosquejoPunto: 1 },
    { id: "v1", type: "biblia", reference: "Romanos 5:8", bosquejoDe: "pred", bosquejoPunto: 1 },
    { id: "p2", type: "slide", title: "Su amor nos cambia", subtitle: "Punto 3", bosquejoDe: "pred" },
    { id: "v2", type: "biblia", reference: "2 Corintios 5:17", bosquejoDe: "pred" },
    { id: "video", type: "slide", title: "Video" },
  ];
  const bosquejos = { pred: { titulo: "La gracia", puntos: [
    { titulo: "Su amor es inmerecido", nota: "Contar lo del hijo pródigo", versiculos: [] },
    { titulo: "", nota: "", versiculos: [] },
    { titulo: "Su amor nos cambia", nota: "Testimonio de Ana", versiculos: [] },
  ] } };

  it("sabe cuándo lo que está al aire es de la predicación", () => {
    expect(estaEnPredicacion(orden, orden[1])).toBe(false);
    expect(estaEnPredicacion(orden, orden[3])).toBe(true);
    expect(estaEnPredicacion(orden, orden[8])).toBe(true); // un video dentro del bloque de Predicación
  });
  it("muestra el punto, el total, la nota privada y los próximos versículos", () => {
    expect(datosPredicacion(orden, orden[4], bosquejos)).toEqual({ titulo: "La gracia", punto: 1, total: 2, nota: "Contar lo del hijo pródigo", proximosVersiculos: ["Romanos 5:8", "2 Corintios 5:17"] });
    // diapositivas viejas sin número guardado: se reconoce por el subtítulo y el versículo toma el de arriba
    expect(datosPredicacion(orden, orden[7], bosquejos)).toMatchObject({ punto: 2, total: 2, nota: "Testimonio de Ana", proximosVersiculos: [] });
    expect(datosPredicacion(orden, orden[3], bosquejos)).toMatchObject({ punto: null, nota: "" });
    expect(datosPredicacion(orden, orden[1], bosquejos)).toBeNull();
  });
});

describe("temporizador del mensaje", () => {
  const t0 = Date.parse("2026-11-08T11:00:00Z");
  it("cuenta hacia atrás, avisa a los 5 minutos y cuenta lo excedido", () => {
    const t = iniciarTemporizador(30 * 60, t0);
    expect(textoTemporizador(restanteTemporizador(t, t0))).toBe("30:00");
    expect(nivelTemporizador(restanteTemporizador(t, t0 + 25 * 60000))).toBe("aviso");
    const pasado = restanteTemporizador(t, t0 + 32 * 60000 + 15000);
    expect(textoTemporizador(pasado)).toBe("+2:15");
    expect(nivelTemporizador(pasado)).toBe("excedido");
  });
  it("se pausa y se reanuda sin perder tiempo", () => {
    const t = iniciarTemporizador(600, t0);
    const pausado = pausarTemporizador(t, t0 + 60000);
    expect(restanteTemporizador(pausado, t0 + 999999)).toBe(540);
    const otraVez = reanudarTemporizador(pausado, t0 + 120000);
    expect(restanteTemporizador(otraVez, t0 + 180000)).toBe(480);
  });
  it("apagado no muestra nada", () => {
    expect(restanteTemporizador(null)).toBeNull();
    expect(textoTemporizador(null)).toBe("");
    expect(textoTemporizador(3725)).toBe("1:02:05");
  });
});
