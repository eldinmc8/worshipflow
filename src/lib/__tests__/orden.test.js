import { describe, it, expect } from "vitest";
import { ordenarPor, compararTexto } from "../orden.js";

describe("orden alfabético", () => {
  it("ignora mayúsculas y tildes", () => {
    const nombres = ["zoila", "Ángel", "beto", "Álvaro", "Carlos"];
    expect(ordenarPor(nombres, (x) => x)).toEqual(["Álvaro", "Ángel", "beto", "Carlos", "zoila"]);
  });
  it("ordena números de forma natural", () => {
    expect(ordenarPor(["Salmo 10", "Salmo 2"], (x) => x)).toEqual(["Salmo 2", "Salmo 10"]);
  });
  it("trata vacíos sin romperse", () => {
    expect(compararTexto(null, "a")).toBeLessThan(0);
  });
});
