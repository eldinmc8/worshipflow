import { describe, it, expect } from "vitest";
import { letraEfectiva, aplicarCambioLetra, letraADiapositivas } from "../letraEnVivo.js";

// Canción que nunca pasó por la pestaña Letra: sin claves en letra, todo sale del Contenido.
const sinLetra = {
  blocks: {
    v1: { label: "Estrofa 1", lines: ["[G]Cuando el día [D]se hace largo", "y no encuentro dónde ir"] },
    c: { label: "Coro", lines: ["Eres mi refugio eterno", "mi lugar seguro"] },
  },
  letra: {},
};
// Canción con letra ya armada, incluida una sección vacía a propósito (instrumental).
const conLetra = {
  blocks: { v1: { label: "Estrofa", lines: ["x"] }, c: { label: "Coro", lines: ["y"] }, i: { label: "Intro", lines: ["z"] } },
  letra: { v1: [["A1", "A2"], ["B1", "B2"]], c: [["C1", "C2"]], i: [] },
};

describe("letraEfectiva", () => {
  it("arma las secciones sin letra desde el Contenido, sin acordes", () => {
    expect(letraEfectiva(sinLetra)).toEqual({
      v1: [["Cuando el día se hace largo", "y no encuentro dónde ir"]],
      c: [["Eres mi refugio eterno", "mi lugar seguro"]],
    });
  });
  it("respeta una sección vacía a propósito", () => {
    expect(letraEfectiva(conLetra).i).toEqual([]);
  });
  it("no modifica la canción original", () => {
    const copia = JSON.parse(JSON.stringify(conLetra));
    aplicarCambioLetra(conLetra, { tipo: "editar", blockKey: "v1", indice: 0, texto: "Z" });
    expect(conLetra).toEqual(copia);
  });
});

describe("aplicarCambioLetra", () => {
  it("agregar en una canción sin letra NO borra las demás secciones (el bug de antes)", () => {
    const nueva = aplicarCambioLetra(sinLetra, { tipo: "agregar", blockKey: "v1", indice: 0, texto: "Línea nueva\notra" });
    expect(nueva.v1).toHaveLength(2);
    expect(nueva.v1[1]).toEqual(["Línea nueva", "otra"]);
    expect(nueva.c).toEqual([["Eres mi refugio eterno", "mi lugar seguro"]]);
    expect(letraADiapositivas(nueva)).toHaveLength(3);
  });
  it("agregar inserta justo después de la diapositiva actual", () => {
    const nueva = aplicarCambioLetra(conLetra, { tipo: "agregar", blockKey: "v1", indice: 0, texto: "N" });
    expect(nueva.v1).toEqual([["A1", "A2"], ["N"], ["B1", "B2"]]);
  });
  it("agregar sin índice va al final de la sección", () => {
    expect(aplicarCambioLetra(conLetra, { tipo: "agregar", blockKey: "c", texto: "N" }).c).toEqual([["C1", "C2"], ["N"]]);
  });
  it("no deja agregar una diapositiva vacía", () => {
    expect(() => aplicarCambioLetra(conLetra, { tipo: "agregar", blockKey: "c", indice: 0, texto: "  \n " })).toThrow(/Escribe/);
  });
  it("editar en una canción sin letra corrige y conserva el resto", () => {
    const nueva = aplicarCambioLetra(sinLetra, { tipo: "editar", blockKey: "c", indice: 0, texto: "Corregida" });
    expect(nueva.c).toEqual([["Corregida"]]);
    expect(nueva.v1[0][0]).toBe("Cuando el día se hace largo");
  });
  it("editar con índice inválido avisa en vez de dañar", () => {
    expect(() => aplicarCambioLetra(conLetra, { tipo: "editar", blockKey: "c", indice: 5, texto: "x" })).toThrow(/No se encontró/);
  });
});

describe("letraADiapositivas", () => {
  it("aplana en el mismo formato que el editor de Canciones", () => {
    expect(letraADiapositivas({ c: [["a", "b"], ["c"]] })).toEqual([
      { seccion_clave: "c", orden_en_seccion: 0, texto: "a\nb" },
      { seccion_clave: "c", orden_en_seccion: 0, texto: "c" },
    ]);
  });
});
