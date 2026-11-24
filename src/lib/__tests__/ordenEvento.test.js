import { describe, expect, it } from "vitest";
import {
  claveDeOtra, leerClaveOtra, ordenEventoDe, ordenInicial, esIgualAlOriginal, cancionParaElEvento, resumenOrden,
  moverParte, quitarParte, repetirAqui, agregarAlFinal,
} from "../ordenEvento.js";
import { armarEscenario } from "../escenario.js";

const cancion = {
  id: "s1", title: "Way Maker", key: "G",
  defaultStructure: ["V1", "C", "V2", "C"],
  blocks: { V1: { label: "Verso 1", badge: "V1", lines: ["[G]Aquí estás"] }, C: { label: "Coro", badge: "C", lines: ["[C]Milagroso"] }, V2: { label: "Verso 2", badge: "V2", lines: ["[G]Tú estás"] } },
  letra: { V1: [["Aquí estás"]], C: [["Milagroso"]], V2: [["Tú estás"]] },
};
const otra = {
  id: "s2", title: "Grande es tu fidelidad", key: "D",
  defaultStructure: ["V1", "C"],
  blocks: { V1: { label: "Verso 1", badge: "V1", lines: ["[D]Oh Dios eterno"] }, C: { label: "Coro", badge: "C", lines: ["[D]Grande es tu [A]fidelidad"] } },
  letra: { V1: [["Oh Dios eterno"]], C: [["Grande es tu fidelidad"]] },
};
const library = [cancion, otra];

describe("claves de partes de otra canción", () => {
  it("van y vuelven", () => {
    const k = claveDeOtra("s2", "C");
    expect(leerClaveOtra(k)).toEqual({ cancionId: "s2", claveParte: "C" });
    expect(leerClaveOtra("C")).toBeNull();
    expect(leerClaveOtra("otra~")).toBeNull();
    expect(leerClaveOtra(undefined)).toBeNull();
  });
});

describe("cancionParaElEvento", () => {
  it("sin orden especial deja la canción tal cual", () => {
    expect(cancionParaElEvento(cancion, { songId: "s1" }, library)).toBe(cancion);
    expect(cancionParaElEvento(cancion, { songId: "s1", ordenEvento: [] }, library)).toBe(cancion);
  });

  it("usa el orden del culto y no toca la canción del cancionero", () => {
    const antes = JSON.stringify(cancion);
    const c = cancionParaElEvento(cancion, { ordenEvento: ["C", "V1", "C", "C"] }, library);
    expect(c.defaultStructure).toEqual(["C", "V1", "C", "C"]);
    expect(c.ordenEspecial).toBe(true);
    expect(JSON.stringify(cancion)).toBe(antes);
  });

  it("trae la parte de otra canción con sus acordes en el tono de esta y su letra", () => {
    const k = claveDeOtra("s2", "C");
    const c = cancionParaElEvento(cancion, { ordenEvento: ["V1", "C", k] }, library);
    expect(c.defaultStructure).toEqual(["V1", "C", k]);
    expect(c.blocks[k].label).toBe("Coro · Grande es tu fidelidad");
    expect(c.blocks[k].lines).toEqual(["[G]Grande es tu [D]fidelidad"]); // D → G
    expect(c.letra[k]).toEqual([["Grande es tu fidelidad"]]);
    expect(c.blocks[k].origen).toEqual({ cancionId: "s2", claveParte: "C", titulo: "Grande es tu fidelidad" });
    expect(otra.blocks.C.lines).toEqual(["[D]Grande es tu [A]fidelidad"]);
  });

  it("si la otra canción ya no existe, esa parte se salta", () => {
    const c = cancionParaElEvento(cancion, { ordenEvento: ["C", claveDeOtra("borrada", "C")] }, library);
    expect(c.defaultStructure).toEqual(["C"]);
  });

  it("si no queda ninguna parte válida, se canta como en el cancionero", () => {
    expect(cancionParaElEvento(cancion, { ordenEvento: ["X"] }, library)).toBe(cancion);
  });

  it("resumen corto para el setlist", () => {
    expect(resumenOrden(cancion, { ordenEvento: ["C", "V1", claveDeOtra("s2", "C")] }, library)).toBe("C · V1 · C (Grande es tu fidelidad)");
    expect(resumenOrden(cancion, { songId: "s1" }, library)).toBe("");
  });
});

describe("armar el orden", () => {
  it("arranca con el del cancionero o el especial guardado", () => {
    expect(ordenInicial(cancion, null)).toEqual(["V1", "C", "V2", "C"]);
    expect(ordenInicial(cancion, { ordenEvento: ["C"] })).toEqual(["C"]);
    expect(ordenInicial({ blocks: { A: {}, B: {} } }, null)).toEqual(["A", "B"]);
    expect(ordenEventoDe({ ordenEvento: [] })).toBeNull();
  });
  it("sabe si quedó igual al original", () => {
    expect(esIgualAlOriginal(cancion, ["V1", "C", "V2", "C"])).toBe(true);
    expect(esIgualAlOriginal(cancion, ["C", "V1", "C"])).toBe(false);
  });
  it("mover, quitar, repetir y agregar", () => {
    const o = ["V1", "C", "V2"];
    expect(moverParte(o, 1, 0)).toEqual(["C", "V1", "V2"]);
    expect(moverParte(o, 0, -1)).toBe(o);
    expect(quitarParte(o, 1)).toEqual(["V1", "V2"]);
    expect(repetirAqui(o, 1)).toEqual(["V1", "C", "C", "V2"]);
    expect(agregarAlFinal(o, "C")).toEqual(["V1", "C", "V2", "C"]);
  });
});

describe("pantalla de escenario con una parte de otra canción", () => {
  it("la banda ve los acordes de esa parte en el tono del culto", () => {
    const k = claveDeOtra("s2", "C");
    const item = { id: "it1", type: "cancion", songId: "s1", keyOverride: "A", ordenEvento: ["C", k] };
    const slides = [
      { slideId: "it1-0-0", type: "cancion", sectionLabel: "Coro", blockLabel: "Coro", blockKey: "C", lines: ["Milagroso"] },
      { slideId: "it1-1-0", type: "cancion", sectionLabel: "Coro · Grande es tu fidelidad", blockLabel: "Coro · Grande es tu fidelidad", blockKey: k, lines: ["Grande es tu fidelidad"] },
    ];
    const e = armarEscenario({ slides, indice: 0, serviceOrder: [item], library });
    expect(e.acordes.sigue.lineas).toEqual(["[A]Grande es tu [E]fidelidad"]); // D → G (canción) → A (culto)
    const e2 = armarEscenario({ slides, indice: 1, serviceOrder: [item], library });
    expect(e2.acordes.ahora.etiqueta).toBe("Coro · Grande es tu fidelidad");
  });
});
