import { describe, it, expect } from "vitest";
import { buscar, puntuar, leerCita, normalizar } from "../busqueda.js";
import { crearIndice, buscarEnIndice, filtrarResultadosApi } from "../buscarBiblia.js";

// Pedido de Eldin, 2026-10-21: buscar "como YouTube", aunque se escriba mal.
const titulos = ["¡Oye Jehová!", "Alabaré, alabaré, alabaré", "Alabaré al Señor mi Dios", "El Espíritu Santo", "Abres caminos", "Al estar aquí", "Cristo es la roca de poder", "Dios está aquí"];

describe("búsqueda de canciones", () => {
  it("sin tildes ni signos", () => {
    expect(buscar(titulos, "oye jehova")[0]).toBe("¡Oye Jehová!");
    expect(buscar(titulos, "espiritu santo")[0]).toBe("El Espíritu Santo");
  });
  it("con faltas de ortografía", () => {
    expect(buscar(titulos, "alavare")).toContain("Alabaré, alabaré, alabaré");
    expect(buscar(titulos, "jeova")[0]).toBe("¡Oye Jehová!");
    expect(buscar(titulos, "espiritu sanot")[0]).toBe("El Espíritu Santo");
    expect(buscar(titulos, "cristo es la rroca")[0]).toBe("Cristo es la roca de poder");
  });
  it("palabras en otro orden y a medio escribir", () => {
    expect(buscar(titulos, "santo espiritu")[0]).toBe("El Espíritu Santo");
    expect(buscar(titulos, "abres cam")[0]).toBe("Abres caminos");
  });
  it("no trae cualquier cosa", () => {
    expect(buscar(titulos, "navidad")).toEqual([]);
    expect(puntuar("roca", "Dios está aquí")).toBe(null);
  });
  it("lo más parecido primero", () => {
    const r = buscar(titulos, "dios aqui");
    expect(r[0]).toBe("Dios está aquí");
  });
});

const caps = [
  { bookId: 59, chapter: 4, verses: [{ verse: 1, text: "¿De dónde vienen las guerras y los pleitos entre vosotros? ¿No es de vuestras pasiones, las cuales combaten en vuestros miembros?" }] },
  { bookId: 48, chapter: 6, verses: [{ verse: 9, text: "No nos cansemos, pues, de hacer bien; porque a su tiempo segaremos, si no desmayamos." }] },
  { bookId: 19, chapter: 23, verses: [{ verse: 1, text: "Jehová es mi pastor; nada me faltará." }] },
  { bookId: 43, chapter: 3, verses: [{ verse: 16, text: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna." }] },
];

describe("búsqueda en la Biblia", () => {
  const indice = crearIndice(caps);
  it("todas las palabras aunque haya otras en medio", () => {
    expect(buscarEnIndice(indice, "de donde vienen los pleitos")[0].book).toBe(59);
  });
  it("con faltas de ortografía y sin tildes", () => {
    expect(buscarEnIndice(indice, "segáremos")[0].book).toBe(48);
    expect(buscarEnIndice(indice, "jeova es mi pastor")[0].book).toBe(19);
    expect(buscarEnIndice(indice, "de tal manera amo dios al mundo")[0].book).toBe(43);
    expect(buscarEnIndice(indice, "unijenito")[0].book).toBe(43);
  });
  it("si una palabra importante no está, no inventa", () => {
    expect(buscarEnIndice(indice, "pleitos navidad")).toEqual([]);
  });
  it("filtra lo de internet: todas las palabras, en cualquier orden", () => {
    const api = caps.map((c) => ({ pk: c.bookId, book: c.bookId, chapter: c.chapter, verse: c.verses[0].verse, text: c.verses[0].text }));
    const r = filtrarResultadosApi(api, "pleitos de donde vienen");
    expect(r.map((x) => x.book)).toEqual([59]);
  });
});

describe("citas escritas en el buscador", () => {
  const books = [{ bookid: 19, name: "Salmos", chapters: 150 }, { bookid: 43, name: "Juan", chapters: 21 }, { bookid: 46, name: "1 Corintios", chapters: 16 }, { bookid: 59, name: "Santiago", chapters: 5 }, { bookid: 62, name: "1 Juan", chapters: 5 }];
  it("lee varias formas de escribir una cita", () => {
    expect(leerCita("Santiago 4:1", books)).toMatchObject({ libro: { bookid: 59 }, capitulo: 4, desde: 1 });
    expect(leerCita("stgo 4 1", books)).toMatchObject({ libro: { bookid: 59 }, capitulo: 4, desde: 1 });
    expect(leerCita("jn 3.16", books)).toMatchObject({ libro: { bookid: 43 }, capitulo: 3, desde: 16 });
    expect(leerCita("1 cor 13:4-7", books)).toMatchObject({ libro: { bookid: 46 }, capitulo: 13, desde: 4, hasta: 7 });
    expect(leerCita("1 juan 4 8", books)).toMatchObject({ libro: { bookid: 62 } });
    expect(leerCita("salmo 23", books)).toMatchObject({ libro: { bookid: 19 }, capitulo: 23, desde: null });
    expect(leerCita("santigo 4:1", books)).toMatchObject({ libro: { bookid: 59 } });
  });
  it("una frase no es una cita", () => {
    expect(leerCita("de donde vienen los pleitos", books)).toBe(null);
    expect(leerCita("Juan 99", books)).toBe(null);
  });
  it("normalizar", () => { expect(normalizar("¡Oye, Jehová!")).toBe("oye jehova"); });
});
