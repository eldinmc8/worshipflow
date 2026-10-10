import { describe, it, expect } from "vitest";
import { partirEn, partesDeVersiculo, expandirVersiculosLargos } from "../dividirTexto.js";

const LARGO = "Por tanto, no temas, porque yo estoy contigo en el camino largo y en la noche oscura; no desmayes, porque yo te sostengo con mi mano firme, te doy fuerzas cuando ya no puedes, y te levanto cada vez que caes, para que sepas que nunca has estado solo.";
const MUY_LARGO = LARGO + " " + LARGO + " " + LARGO;

describe("partirEn", () => {
  it("prefiere el punto y coma cerca de la mitad", () => {
    const [a, b] = partirEn(LARGO, 2);
    expect(a.endsWith(";")).toBe(true);
    expect(b.startsWith("no desmayes")).toBe(true);
  });
  it("sin pausa fuerte usa la coma", () => {
    expect(partirEn("Eres mi refugio eterno, mi lugar seguro Señor", 2)).toEqual(["Eres mi refugio eterno,", "mi lugar seguro Señor"]);
  });
  it("sin puntuación corta en el espacio más parejo", () => {
    expect(partirEn("Santo santo eres tú", 2)).toEqual(["Santo santo", "eres tú"]);
  });
  it("una sola palabra no se parte", () => {
    expect(partirEn("Aleluya", 2)).toEqual(["Aleluya"]);
  });
  it("nunca pierde ni duplica palabras", () => {
    for (const n of [2, 3]) expect(partirEn(MUY_LARGO, n).join(" ")).toBe(MUY_LARGO);
  });
  it("texto vacío no da partes", () => {
    expect(partirEn("   ", 2)).toEqual([]);
  });
});

describe("partesDeVersiculo", () => {
  it("corto → 1, largo → 2, exageradamente largo → 3 (máximo)", () => {
    expect(partesDeVersiculo("El que confía no será avergonzado.")).toHaveLength(1);
    expect(partesDeVersiculo(LARGO)).toHaveLength(2);
    expect(partesDeVersiculo(MUY_LARGO)).toHaveLength(3);
  });
  it("con letra más grande (menos palabras por parte) divide antes", () => {
    expect(partesDeVersiculo(LARGO, 40)).toHaveLength(2);
    expect(partesDeVersiculo(LARGO, 20)).toHaveLength(3);
  });
});

describe("expandirVersiculosLargos", () => {
  const slides = [
    { slideId: "s1", type: "cancion", lines: ["x"] },
    { slideId: "b1", type: "biblia", reference: "Isaías 41:10", text: LARGO, bookId: 23 },
    { slideId: "b2", type: "biblia", reference: "Salmos 46:10", text: "Estad quietos." },
  ];
  it("parte solo los versículos largos y marca cada parte", () => {
    const out = expandirVersiculosLargos(slides);
    expect(out.map((s) => s.slideId)).toEqual(["s1", "b1~0", "b1~1", "b2"]);
    expect(out[1].reference).toBe("Isaías 41:10 (1/2)");
    expect(out[2].reference).toBe("Isaías 41:10 (2/2)");
    expect(out[1].baseSlideId).toBe("b1");
    expect(out[1].baseText).toBe(LARGO);
    expect(out[1].baseReference).toBe("Isaías 41:10");
    expect(out[2].parte).toBe(1);
  });
  it("no modifica la lista original", () => {
    const copia = JSON.parse(JSON.stringify(slides));
    expandirVersiculosLargos(slides);
    expect(slides).toEqual(copia);
  });
});

import { reorganizarLetra } from "../dividirTexto.js";

describe("reorganizarLetra", () => {
  const slides = [
    { slideId: "it1-0-0", type: "cancion", songId: "s", blockKey: "v1", sectionLabel: "Estrofa", blockLabel: "Estrofa (1/2)", slideIndexInBlock: 0, lines: ["Cuando el día se hace largo", "y no encuentro dónde ir"] },
    { slideId: "it1-0-1", type: "cancion", songId: "s", blockKey: "v1", sectionLabel: "Estrofa", blockLabel: "Estrofa (2/2)", slideIndexInBlock: 1, lines: ["Tu voz me llama", ""] },
    { slideId: "it1-1-0", type: "cancion", songId: "s", blockKey: "c", sectionLabel: "Coro", blockLabel: "Coro", slideIndexInBlock: 0, lines: ["Eres mi refugio eterno, mi lugar seguro Señor", "Aleluya"] },
    { slideId: "b1", type: "biblia", text: "x" },
  ];
  it("dos_lineas deja todo igual", () => {
    expect(reorganizarLetra(slides, "dos_lineas")).toBe(slides);
  });
  it("una_linea_dos_renglones: líneas cortas juntas, largas partidas en dos", () => {
    const out = reorganizarLetra(slides, "una_linea_dos_renglones");
    const canciones = out.filter((s) => s.type === "cancion");
    expect(canciones.map((s) => s.lines)).toEqual([
      ["Cuando el día se hace largo", "y no encuentro dónde ir"],
      ["Tu voz", "me llama"],
      ["Eres mi refugio eterno,", "mi lugar seguro Señor"],
      ["Aleluya"],
    ]);
    expect(canciones.map((s) => s.blockLabel)).toEqual(["Estrofa (1/2)", "Estrofa (2/2)", "Coro (1/2)", "Coro (2/2)"]);
    expect(out[out.length - 1].type).toBe("biblia");
  });
  it("no deja pedazos sueltos de una frase partida en dos líneas guardadas", () => {
    const himno = [
      { slideId: "x-0-0", type: "cancion", songId: "h", blockKey: "c", sectionLabel: "Coro", lines: ["Dame de beber de tu", "manantial;"] },
      { slideId: "x-0-1", type: "cancion", songId: "h", blockKey: "c", sectionLabel: "Coro", lines: ["Hallé un buen amigo,", "mi amado Salvador"] },
    ];
    expect(reorganizarLetra(himno, "una_linea_dos_renglones").map((s) => s.lines)).toEqual([
      ["Dame de beber de tu", "manantial;"],
      ["Hallé un buen amigo,", "mi amado Salvador"],
    ]);
  });
  it("cada diapositiva recuerda la original para corregir la letra completa", () => {
    const out = reorganizarLetra(slides, "una_linea_dos_renglones");
    expect(out[0].baseLines).toEqual(slides[0].lines);
    expect(out[0].slideIndexInBlock).toBe(0);
    expect(out[1].slideIndexInBlock).toBe(1);
    expect(new Set(out.map((s) => s.slideId)).size).toBe(out.length);
  });
  it("una_linea: un renglón por diapositiva", () => {
    const out = reorganizarLetra(slides, "una_linea").filter((s) => s.type === "cancion");
    expect(out.every((s) => s.lines.length === 1)).toBe(true);
    expect(out).toHaveLength(5);
  });
});

import { palabrasPorParteSegun } from "../dividirTexto.js";
describe("ajuste de la iglesia: dividir versículos largos", () => {
  it("apagado: el versículo largo queda completo en una sola diapositiva", () => {
    const tope = palabrasPorParteSegun(1, false);
    expect(partesDeVersiculo(MUY_LARGO, tope)).toEqual([MUY_LARGO]);
    const slides = [{ slideId: "b1", type: "biblia", reference: "Isaías 41:10", text: MUY_LARGO }];
    expect(expandirVersiculosLargos(slides, tope)).toEqual(slides);
  });
  it("encendido: divide como siempre", () => {
    expect(partesDeVersiculo(LARGO, palabrasPorParteSegun(1, true))).toHaveLength(2);
  });
});
