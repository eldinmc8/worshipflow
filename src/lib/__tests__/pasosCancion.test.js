import { describe, it, expect } from "vitest";
import {
  agregarParte, repetirParte, quitarDelOrden, moverEnOrden, ordenDe, partesUnicas, partesSinUsar,
  escribirLetraParte, textoDeParte, contenidoVaConLetra, pasarAcordes, lineasParaAcordes,
  palabrasDe, ponerAcorde, quitarAcorde, agregarAcordeAlFinal, tieneAcordes,
  alargarLetra, acortarLetra, puedeAlargar, revisarTextoAcordes, unirRenglones, partirRenglon,
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
  it("renglón vacío = nueva diapositiva; los músicos ven la estrofa corrida", () => {
    let c = agregarParte(vacia(), "coro");
    const [k] = ordenDe(c);
    c = escribirLetraParte(c, k, "Porque tú eres Rey\nde reyes\n\nY por siempre\nreinarás");
    expect(c.letra[k]).toEqual([["Porque tú eres Rey", "de reyes"], ["Y por siempre", "reinarás"]]);
    expect(c.blocks[k].lines).toEqual(["Porque tú eres Rey", "de reyes", "Y por siempre", "reinarás"]);
    expect(textoDeParte(c, k)).toBe("Porque tú eres Rey\nde reyes\n\nY por siempre\nreinarás");
  });

  it("sin renglones vacíos, una diapositiva cada 2 renglones", () => {
    let c = agregarParte(vacia(), "estrofa");
    const [k] = ordenDe(c);
    c = escribirLetraParte(c, k, "uno\ndos\ntres");
    expect(c.letra[k]).toEqual([["uno", "dos"], ["tres"]]);
  });

  it("cambiar la letra conserva los acordes de las palabras que no cambiaron", () => {
    const nuevas = pasarAcordes(["[G]Santo es el [D]Señor", "[Em]Digno de [C]honor"], ["Santo es el Señor", "Digno de gloria"]);
    expect(nuevas).toEqual(["[G]Santo es el [D]Señor", "[Em]Digno de gloria"]);
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
    expect(ponerAcorde("El firma[G]mento", 1, "C", 5)).toBe("El firma[C]mento");
    expect(ponerAcorde("firmamento", 0, "D", 5)).toBe("firma[D]mento");
    expect(ponerAcorde("[G]Dios", 0, "D", 3)).toBe("[G]Dio[D]s");
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
    expect(lineasParaAcordes(c, "a")).toEqual(["uno", "dos", "tres"]);
    expect(tieneAcordes(c)).toBe(false);
  });

  it("alargar una letra es solo para los músicos: la diapositiva no cambia", () => {
    let c = agregarParte(vacia(), "coro");
    const [k] = ordenDe(c);
    c = escribirLetraParte(c, k, "Santo Dios");
    let linea = c.blocks[k].lines[0];
    linea = alargarLetra(linea, 1, 2); // la "o" de Dios
    expect(linea).toBe("Santo Diooos");
    linea = ponerAcorde(linea, 1, "G", 3);
    linea = ponerAcorde(linea, 1, "D", 5);
    expect(linea).toBe("Santo Dio[G]oo[D]s");
    linea = alargarLetra(linea, 1, 3);
    expect(linea).toBe("Santo Dio[G]ooo[D]s");
    c = { ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], lines: [linea] } } };
    expect(contenidoVaConLetra(c, k)).toBe(true);
    // Multimedia vuelve a escribir la misma letra: los acordes y el alargamiento se quedan.
    c = escribirLetraParte(c, k, "Santo Dios", true);
    expect(c.blocks[k].lines).toEqual(["Santo Dio[G]ooo[D]s"]);
    expect(c.letra[k]).toEqual([["Santo Dios"]]);
  });

  it("acortar regresa la letra; las letras dobles de verdad no se alargan", () => {
    expect(acortarLetra("Diooos", 0, 2)).toBe("Dios");
    expect(acortarLetra("Dioooos", 0, 2)).toBe("Diooos");
    expect(alargarLetra("Dios", 0, 0)).toBe("Dddios");
    expect(puedeAlargar("creer", 2)).toBe(false);
    expect(alargarLetra("Dió", 0, 2)).toBe("Dióoo");
    expect(acortarLetra("Dióoo", 0, 2)).toBe("Dió");
  });

  it("escribir como texto: se aceptan acordes y alargamientos, no cambios de letra", () => {
    const r = revisarTextoAcordes(["Santo es el Señor"], "[G]Saaanto es el [D]Señor\n[A] [E]");
    expect(r.ok).toBe(true);
    expect(r.lineas).toEqual(["[G]Saaanto es el [D]Señor", "[A] [E]"]);
    const mal = revisarTextoAcordes(["Santo es el Señor", "Digno"], "[G]Santo es mi Señor\nDigno");
    expect(mal).toMatchObject({ ok: false, renglon: 1, esperado: "el", escrito: "mi" });
    // Unir renglones en el texto sí se puede: la letra es la misma.
    expect(revisarTextoAcordes(["Prepárate para", "que sientas"], "[G]Prepárate para [Em]que sientas").ok).toBe(true);
  });

  it("unir y partir renglones solo para el músico; se conserva aunque multimedia corrija", () => {
    let c = agregarParte(vacia(), "estrofa");
    const [k] = ordenDe(c);
    c = escribirLetraParte(c, k, "Prepárate para\nque sientas,\n\nPrepárate para\nque sientas,");
    let lines = c.blocks[k].lines;
    expect(lines).toHaveLength(4);
    lines = unirRenglones(lines, 0);
    lines = unirRenglones(lines, 1);
    lines = [ponerAcorde(lines[0], 0, "G"), ponerAcorde(lines[1], 3, "D")];
    expect(lines).toEqual(["[G]Prepárate para que sientas,", "Prepárate para que [D]sientas,"]);
    c = { ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], lines } } };
    expect(contenidoVaConLetra(c, k)).toBe(true);
    // Multimedia corrige una palabra: lo demás (renglones unidos y acordes) se queda.
    c = escribirLetraParte(c, k, "Prepárate para\nque sientas,\n\nPrepárate para\nque sientas hoy,", true);
    expect(c.blocks[k].lines).toEqual(["[G]Prepárate para que sientas,", "Prepárate para que [D]sientas hoy,"]);
    expect(c.letra[k]).toEqual([["Prepárate para", "que sientas,"], ["Prepárate para", "que sientas hoy,"]]);
    expect(partirRenglon(["[G]Prepárate para que sientas,"], 0, 2)).toEqual(["[G]Prepárate para", "que sientas,"]);
  });

  it("un acorde suelto al final del renglón y una entrada de solo acordes no se pierden", () => {
    expect(pasarAcordes(["[G] [D]", "Santo [Em]", "Digno"], ["Santo", "Digno de ti"])).toEqual(["[G] [D]", "Santo [Em]", "Digno de ti"]);
  });
});
