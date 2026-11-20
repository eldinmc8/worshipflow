import { describe, it, expect } from "vitest";
import {
  agregarParte, repetirParte, quitarDelOrden, moverEnOrden, ordenDe, partesUnicas, partesSinUsar,
  escribirLetraParte, textoDeParte, contenidoVaConLetra, pasarAcordes, lineasParaAcordes,
  palabrasDe, ponerAcorde, quitarAcorde, agregarAcordeAlFinal, tieneAcordes,
} from "../pasosCancion.js";

const vacia = () => ({ title: "", key: "G", artist: "", blocks: {}, letra: {}, defaultStructure: [] });
const etiquetas = (c) => ordenDe(c).map((k) => c.blocks[k].label);

describe("Estructura", () => {
  it("las estrofas se numeran solas y el coro se repite", () => {
    let c = vacia();
    c = agregarParte(c, "estrofa");
    c = agregarParte(c, "coro");
    c = agregarParte(c, "estrofa");
    c = agregarParte(c, "coro");
    expect(etiquetas(c)).toEqual(["Estrofa 1", "Coro", "Estrofa 2", "Coro"]);
    expect(Object.keys(c.blocks)).toHaveLength(3);
    expect(c.blocks[ordenDe(c)[0]].badge).toBe("V1");
  });

  it("parte con nombre propio, repetir y mover", () => {
    let c = agregarParte(vacia(), null, { nombre: "Coro 2" });
    c = agregarParte(c, "intro");
    c = moverEnOrden(c, 1, 0);
    c = repetirParte(c, ordenDe(c)[1]);
    expect(etiquetas(c)).toEqual(["Intro", "Coro 2", "Coro 2"]);
  });

  it("quitar una parte vacía la borra; con letra se guarda aparte", () => {
    let c = agregarParte(agregarParte(vacia(), "estrofa"), "coro");
    const [v1, coro] = ordenDe(c);
    c = escribirLetraParte(c, coro, "Santo santo");
    c = quitarDelOrden(c, 0);
    expect(c.blocks[v1]).toBeUndefined();
    c = quitarDelOrden(c, 0);
    expect(c.blocks[coro]).toBeDefined();
    expect(partesSinUsar(c)).toEqual([coro]);
  });
});

describe("Letra", () => {
  it("renglón vacío = nueva diapositiva y llena lo que ven los músicos", () => {
    let c = agregarParte(vacia(), "coro");
    const [k] = ordenDe(c);
    c = escribirLetraParte(c, k, "Porque tú eres Rey\nde reyes\n\nY por siempre\nreinarás");
    expect(c.letra[k]).toEqual([["Porque tú eres Rey", "de reyes"], ["Y por siempre", "reinarás"]]);
    expect(c.blocks[k].lines).toEqual(["Porque tú eres Rey", "de reyes", "", "Y por siempre", "reinarás"]);
    expect(textoDeParte(c, k)).toBe("Porque tú eres Rey\nde reyes\n\nY por siempre\nreinarás");
  });

  it("sin renglones vacíos, una diapositiva cada 2 renglones", () => {
    let c = agregarParte(vacia(), "estrofa");
    const [k] = ordenDe(c);
    c = escribirLetraParte(c, k, "uno\ndos\ntres");
    expect(c.letra[k]).toEqual([["uno", "dos"], ["tres"]]);
  });

  it("cambiar la letra conserva los acordes de los renglones que no cambiaron", () => {
    const nuevas = pasarAcordes(["[G]Santo es el [D]Señor", "[Em]Digno de [C]honor"], ["Santo es el Señor", "Digno de gloria"]);
    expect(nuevas).toEqual(["[G]Santo es el [D]Señor", "Digno de gloria"]);
  });

  it("los renglones de solo acordes se quedan en su lugar", () => {
    expect(pasarAcordes(["[G] [D]", "Santo", "Digno"], ["Santo", "Digno"])).toEqual(["[G] [D]", "Santo", "Digno"]);
  });

  it("si los acordes se escribieron con otra letra, escribir la letra no los toca", () => {
    const c = { ...vacia(), blocks: { a: { label: "Coro", badge: "C", lines: ["[G]Santo // santo"] } }, letra: { a: [["Otra cosa"]] }, defaultStructure: ["a"] };
    expect(contenidoVaConLetra(c, "a")).toBe(false);
    const d = escribirLetraParte(c, "a", "Nueva letra", false);
    expect(d.blocks.a.lines).toEqual(["[G]Santo // santo"]);
    expect(d.letra.a).toEqual([["Nueva letra"]]);
  });

  it("partes únicas: en el orden en que se cantan", () => {
    let c = agregarParte(agregarParte(agregarParte(vacia(), "coro"), "estrofa"), "coro");
    expect(partesUnicas(c).map((k) => c.blocks[k].label)).toEqual(["Coro", "Estrofa 1"]);
  });
});

describe("Acordes", () => {
  it("pone y cambia el acorde de una palabra sin cambiar la letra", () => {
    let l = "Santo es el Señor";
    l = ponerAcorde(l, 0, "G");
    l = ponerAcorde(l, 3, "D");
    expect(l).toBe("[G]Santo es el [D]Señor");
    l = ponerAcorde(l, 0, "Em");
    expect(l).toBe("[Em]Santo es el [D]Señor");
    expect(palabrasDe(l)).toHaveLength(4);
    expect(ponerAcorde("El firma[G]mento", 1, "C")).toBe("El firma[C]mento");
  });

  it("quitar acorde deja la palabra; un acorde suelto se va entero", () => {
    expect(quitarAcorde("[G]Santo es", 0)).toBe("Santo es");
    expect(quitarAcorde("[G] [D] [Em]", 1)).toBe("[G] [Em]");
  });

  it("renglón de solo acordes", () => {
    expect(agregarAcordeAlFinal("", "G")).toBe("[G]");
    expect(agregarAcordeAlFinal("[G]", "D")).toBe("[G] [D]");
  });

  it("sin texto de músicos, se usa la letra escrita", () => {
    const c = { ...vacia(), blocks: { a: { label: "Coro", badge: "C", lines: [""] } }, letra: { a: [["uno", "dos"], ["tres"]] } };
    expect(lineasParaAcordes(c, "a")).toEqual(["uno", "dos", "", "tres"]);
    expect(tieneAcordes(c)).toBe(false);
  });
});
