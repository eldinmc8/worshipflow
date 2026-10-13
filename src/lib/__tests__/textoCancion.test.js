import { describe, it, expect } from "vitest";
import { cancionATexto, textoACancion, leerEncabezado, esLineaDeAcordes, unirAcordesEncima, limpiarParaProyectar, diapositivasDeLineas, distintivoDe } from "../textoCancion.js";

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
