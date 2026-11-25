import { describe, it, expect } from "vitest";
import { semitonosCambio, cambiosPorPosicion, tonoMas, textoCambio, cuantoSube, relativa, opcionesCambio, recorridoDeTonos, leerClaveCambio, claveCambioEvento, instrumentoPorValor } from "../cambioTono.js";
import { agregarCambioTono, cambiarCambioTono, renombrarParte, agregarParte } from "../pasosCancion.js";
import { cancionParaElEvento, resumenOrden } from "../ordenEvento.js";
import { armarEscenario } from "../escenario.js";

const base = () => ({
  id: "s1", title: "Canto", key: "C",
  blocks: { v: { badge: "V1", label: "Estrofa 1", lines: ["[C]Hola [G]mundo"] }, c: { badge: "C", label: "Coro", lines: ["[F]Santo [C]es"] } },
  letra: { v: [["Hola mundo"]], c: [["Santo es"]] },
  defaultStructure: ["v", "c"],
});

describe("cambio de tono", () => {
  it("lee el distintivo ↑n", () => {
    expect(semitonosCambio({ badge: "↑2" })).toBe(2);
    expect(semitonosCambio({ badge: "C" })).toBe(0);
    expect(semitonosCambio({ badge: "↑12" })).toBe(0);
  });
  it("acumula por posición y cuenta dos subidas", () => {
    const blocks = { a: { badge: "V1" }, up: { badge: "↑1" }, c: { badge: "C" } };
    expect(cambiosPorPosicion(["a", "c", "up", "c", "up", "c"], blocks)).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it("nombra el tono nuevo y conserva menor", () => {
    expect(tonoMas("C", 2)).toBe("D");
    expect(tonoMas("Am", 2)).toBe("Bm");
    expect(textoCambio(2, "D")).toBe("Sube a D");
    expect(textoCambio(10, "A#")).toBe("Baja a A#");
    expect(cuantoSube(1)).toBe("sube medio tono");
    expect(cuantoSube(3)).toBe("sube 1 tono y medio");
    expect(cuantoSube(10)).toBe("baja 1 tono");
    expect(opcionesCambio("C")).toHaveLength(11);
    expect(recorridoDeTonos("F", ["a", "up", "c", "up"], { a: {}, c: {}, up: { badge: "↑2" } })).toEqual(["F", "G", "A"]);
  });
  it("relativas", () => {
    expect(relativa("C")).toBe("Am");
    expect(relativa("Am")).toBe("C");
    expect(relativa("F")).toBe("Dm");
    expect(relativa("Bb")).toBe("Gm");
    expect(relativa("")).toBe("");
  });
  it("instrumentos", () => {
    expect(instrumentoPorValor("sib").semitonos).toBe(2);
    expect(instrumentoPorValor("raro").semitonos).toBe(0);
  });
});

describe("Sube de tono en la Estructura", () => {
  it("agrega la parte sin letra y la reutiliza si sube lo mismo", () => {
    let c = agregarCambioTono(base(), 2);
    const k = c.defaultStructure[2];
    expect(c.blocks[k]).toMatchObject({ badge: "↑2", label: "Sube de tono" });
    expect(c.letra[k]).toEqual([]);
    c = agregarCambioTono({ ...c, defaultStructure: [...c.defaultStructure, "c"] }, 2);
    expect(c.defaultStructure.at(-1)).toBe(k);
    expect(Object.keys(c.blocks)).toHaveLength(3);
  });
  it("cambiar cuánto sube y renombrar no pierde la subida", () => {
    let c = agregarCambioTono(base(), 2);
    const k = c.defaultStructure[2];
    c = cambiarCambioTono(c, k, 5);
    expect(c.blocks[k].badge).toBe("↑5");
    c = renombrarParte(c, k, "Modulación");
    expect(c.blocks[k]).toMatchObject({ badge: "↑5", label: "Modulación" });
  });
  it("partes nuevas Melodía, Vientos e Interludio", () => {
    let c = agregarParte(base(), "melodia");
    c = agregarParte(c, "vientos");
    c = agregarParte(c, "interludio");
    expect(c.defaultStructure.slice(-3).map((k) => c.blocks[k].badge)).toEqual(["M", "VI", "INT"]);
  });
});

describe("Sube de tono solo para el culto", () => {
  it("la clave tono~n crea una parte sin letra en la copia del evento", () => {
    expect(leerClaveCambio(claveCambioEvento(2))).toBe(2);
    expect(leerClaveCambio("tono~0")).toBe(0);
    const item = { ordenEvento: ["v", "c", "tono~2", "c"] };
    const c = cancionParaElEvento(base(), item, []);
    expect(c.blocks["tono~2"]).toMatchObject({ badge: "↑2" });
    expect(c.letra["tono~2"]).toEqual([]);
    expect(resumenOrden(base(), item, [])).toBe("V1 · C · ↑ D · C");
    expect(resumenOrden(base(), { ...item, keyOverride: "D" }, [])).toBe("V1 · C · ↑ E · C");
  });
  it("la pantalla de escenario pasa los acordes al tono de cada posición", () => {
    const item = { id: "it1", type: "cancion", songId: "s1", ordenEvento: ["c", "tono~2", "c"] };
    const slides = [
      { slideId: "it1-0-0", type: "cancion", blockKey: "c", sectionLabel: "Coro", lines: ["Santo es"] },
      { slideId: "it1-2-0", type: "cancion", blockKey: "c", sectionLabel: "Coro", lines: ["Santo es"] },
    ];
    const r0 = armarEscenario({ slides, indice: 0, serviceOrder: [item], library: [base()] });
    expect(r0.acordes.ahora.lineas).toEqual(["[F]Santo [C]es"]);
    expect(r0.acordes.sigue.lineas).toEqual(["[G]Santo [D]es"]);
    const r1 = armarEscenario({ slides, indice: 1, serviceOrder: [item], library: [base()] });
    expect(r1.acordes.ahora.lineas).toEqual(["[G]Santo [D]es"]);
  });
});
