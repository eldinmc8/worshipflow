import { describe, it, expect } from "vitest";
import { letraATexto, textoALetra, cancionATexto, textoACancion, leerEncabezado, esLineaDeAcordes, unirAcordesEncima, limpiarParaProyectar, diapositivasDeLineas, distintivoDe } from "../textoCancion.js";

describe("encabezados", () => {
  it("reconoce las formas comunes y no confunde letra ni acordes", () => {
    expect(leerEncabezado("CORO:").etiqueta).toBe("Coro");
    expect(leerEncabezado("[Estrofa 2]").etiqueta).toBe("Estrofa 2");
    expect(leerEncabezado("#Letra grande").etiqueta).toBe("Letra grande");
    expect(leerEncabezado("Pre coro").etiqueta).toBe("Pre coro");
    expect(leerEncabezado("[Coro 1] x2")).toMatchObject({ etiqueta: "Coro 1", veces: 2 });
    expect(leerEncabezado("Intro: G D Em C")).toMatchObject({ etiqueta: "Intro", resto: "G D Em C" });
    expect(leerEncabezado("[C]")).toBeNull();
    expect(leerEncabezado("Coro de ángeles cantan")).toBeNull();
    expect(leerEncabezado("Venimos ante ti")).toBeNull();
  });
});

describe("acordes encima de la letra", () => {
  it("detecta líneas de acordes (también Do-Re-Mi) y no la letra", () => {
    expect(esLineaDeAcordes("G       D/F#    Em7")).toBe(true);
    expect(esLineaDeAcordes("Sol   Re   Mim")).toBe(true);
    expect(esLineaDeAcordes("La la la")).toBe(false);
    expect(esLineaDeAcordes("[G] [D]")).toBe(false);
  });
  it("pone cada acorde en su columna", () => {
    expect(unirAcordesEncima("G       D", "Venimos ante ti")).toBe("[G]Venimos [D]ante ti");
    expect(unirAcordesEncima("Sol", "Señor")).toBe("[G]Señor");
    expect(unirAcordesEncima("       Bm", "Señor")).toBe("Señor  [Bm]");
  });
});

describe("diapositivas", () => {
  it("limpia alargamientos y // solo en lo que se proyecta", () => {
    expect(limpiarParaProyectar("[D]míiiiio //graciaaaas// creer")).toBe("mío gracias creer");
  });
  it("renglón vacío corta; sin renglones vacíos van de 2 en 2; las de solo acordes no salen", () => {
    expect(diapositivasDeLineas(["a", "b", "", "c"])).toEqual([["a", "b"], ["c"]]);
    expect(diapositivasDeLineas(["a", "b", "c"])).toEqual([["a", "b"], ["c"]]);
    expect(diapositivasDeLineas(["[G] [D]", "a"])).toEqual([["a"]]);
  });
  it("distintivos", () => {
    expect(distintivoDe("Estrofa 2")).toBe("V2");
    expect(distintivoDe("Pre-coro")).toBe("PC");
    expect(distintivoDe("Coro")).toBe("C");
  });
});

describe("pegar una canción de internet", () => {
  const pegada = `Venimos ante ti

ESTROFA
G              Bm
Venimos ante ti Señor,
Em          A        D
Llenos de alabanza y de adoración.

CORO:
     G          A
Porque tú eres Rey de reyes,
          F#m      Bm
Y Señor de señores.

Coro`;
  const r = textoACancion(pegada);
  it("arma secciones, acordes dentro y el orden con la repetición", () => {
    expect(r.defaultStructure.map((k) => r.blocks[k].label)).toEqual(["Estrofa", "Coro", "Coro"]);
    expect(r.tituloSugerido).toBe("Venimos ante ti");
    const coro = Object.values(r.blocks).find((b) => b.label === "Coro");
    expect(coro.lines[0]).toBe("Porqu[G]e tú eres R[A]ey de reyes,");
    expect(r.acordesEncima).toBe(4);
    expect(r.tonalidadSugerida).toBe("G");
  });
  it("el coro repetido no se duplica", () => {
    expect(Object.values(r.blocks).filter((b) => b.label === "Coro")).toHaveLength(1);
    expect(r.defaultStructure.filter((k) => r.blocks[k].label === "Coro")).toHaveLength(2);
  });
});

describe("editar como texto una canción existente", () => {
  const original = {
    blocks: {
      v: { badge: "V1", label: "Estrofa 1", bars: 8, lines: ["[G]Graciaaaas Señor", "[D]por tu amor"] },
      c: { badge: "C1", label: "Coro 1", bars: 16, lines: ["[C]Aleluya"] },
      x: { badge: "INS", label: "Instrumental", bars: 4, lines: ["[G] [D]"] },
    },
    letra: { v: [["Gracias Señor"], ["por tu amor"]], c: [["Aleluya"]], x: [] },
    defaultStructure: ["v", "c", "c", "v", "c"],
  };
  it("ida y vuelta idéntica (incluye x2 y la sección sin usar)", () => {
    const texto = cancionATexto(original);
    expect(texto).toContain("[Coro 1] x2");
    expect(texto).toContain("[Instrumental] x0");
    const r = textoACancion(texto, original);
    expect(r.blocks).toEqual(original.blocks);
    expect(r.letra).toEqual(original.letra);
    expect(r.defaultStructure).toEqual(original.defaultStructure);
  });
  it("solo se rehacen las diapositivas de la sección que cambió", () => {
    const texto = cancionATexto(original).replace("[C]Aleluya", "[C]Aleluya, amén\n[G]Gloria");
    const r = textoACancion(texto, original);
    expect(r.letra.v).toEqual(original.letra.v); // la limpieza a mano se respeta
    expect(r.letra.c).toEqual([["Aleluya, amén", "Gloria"]]);
    expect(r.blocks.c).toMatchObject({ badge: "C1", bars: 16 });
  });
});

describe("estructura sola, sin nombres de sección", () => {
  it("el párrafo que se repite es el coro y lo demás estrofas, en orden", () => {
    const t = "Primera estrofa uno\nPrimera estrofa dos\n\nEste es el coro\nque se repite\n\nSegunda estrofa uno\nSegunda estrofa dos\n\nEste es el coro\nque se repite";
    const r = textoACancion(t);
    expect(r.defaultStructure.map((k) => r.blocks[k].label)).toEqual(["Estrofa 1", "Coro", "Estrofa 2", "Coro"]);
    expect(Object.values(r.blocks).filter((b) => b.label === "Coro")).toHaveLength(1);
  });
  it("coro de dos párrafos (dos diapositivas)", () => {
    const t = "Mi primera parte\n\nCoro a\n\nCoro b\n\nOtra parte\n\nCoro a\n\nCoro b";
    const r = textoACancion(t);
    const coro = Object.entries(r.blocks).find(([, b]) => b.label === "Coro");
    expect(r.letra[coro[0]]).toEqual([["Coro a"], ["Coro b"]]);
    expect(r.defaultStructure.map((k) => r.blocks[k].label)).toEqual(["Estrofa 1", "Coro", "Estrofa 2", "Coro"]);
  });
  it("sin repeticiones se queda en una sola Estrofa con sus diapositivas por renglón vacío", () => {
    const r = textoACancion("uno\ndos\n\ntres\ncuatro");
    expect(Object.values(r.blocks)).toHaveLength(1);
    expect(Object.values(r.letra)[0]).toEqual([["uno", "dos"], ["tres", "cuatro"]]);
  });
});

describe("solo letra (pestaña Escribir de una canción existente)", () => {
  const cancion = {
    blocks: { a: { badge: "V1", label: "Estrofa 1", lines: ["[G]hola mundo", "dos"] }, c: { badge: "C", label: "Coro", lines: ["[D]coro"] } },
    letra: { a: [["hola mundo", "dos"]], c: [["coro uno", "coro dos"]] },
    defaultStructure: ["a", "c", "a", "c", "c"],
  };
  it("cada parte aparece una vez, sin acordes", () => {
    expect(letraATexto(cancion)).toBe("[Estrofa 1]\nhola mundo\ndos\n\n[Coro]\ncoro uno\ncoro dos");
  });
  it("sin cambios: todo queda igual (mismos objetos)", () => {
    const r = textoALetra(letraATexto(cancion), cancion);
    expect(r.letra.a).toBe(cancion.letra.a);
    expect(r.blocks.a).toBe(cancion.blocks.a);
    expect(r.defaultStructure).toEqual(cancion.defaultStructure);
  });
  it("renglón vacío = nueva diapositiva; acordes y orden no se tocan", () => {
    const r = textoALetra("[Estrofa 1]\nhola mundo\n\ndos\n\n[Coro]\ncoro uno\ncoro dos", cancion);
    expect(r.letra.a).toEqual([["hola mundo"], ["dos"]]);
    expect(r.letra.c).toBe(cancion.letra.c);
    expect(r.blocks.a.lines).toEqual(["[G]hola mundo", "dos"]);
    expect(r.defaultStructure).toEqual(["a", "c", "a", "c", "c"]);
  });
  it("parte nueva va al final del orden; una parte que falta no se borra", () => {
    const r = textoALetra("[Coro]\ncoro uno\ncoro dos\n\n[Puente]\nnueva", cancion);
    const k = Object.keys(r.blocks).find((x) => r.blocks[x].label === "Puente");
    expect(r.letra[k]).toEqual([["nueva"]]);
    expect(r.defaultStructure).toEqual(["a", "c", "a", "c", "c", k]);
    expect(r.letra.a).toBe(cancion.letra.a);
    expect(r.avisos.some((a) => /No están en el texto: Estrofa 1/.test(a.texto))).toBe(true);
  });
});
