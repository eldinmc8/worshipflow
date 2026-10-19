import { describe, it, expect } from "vitest";
import { letraATexto, textoALetra } from "../textoCancion.js";
import { letraEfectiva } from "../letraEnVivo.js";

const cancion = {
  blocks: { v1: { label: "Estrofa 1", lines: ["[G]Linea uno", "[D]Linea dos", "", "Linea tres", "Linea cuatro"] }, c: { label: "Coro", lines: ["Santo es el Señor"] } },
  letra: { v1: [["Linea uno", "Linea dos"], ["Linea tres", "Linea cuatro"]] }, // el coro no tiene diapositivas guardadas
  defaultStructure: ["v1", "c", "v1"],
};

describe("editar la letra completa desde la consola", () => {
  it("abrir y guardar sin tocar nada deja la letra igual", () => {
    const base = { ...cancion, letra: letraEfectiva(cancion) };
    const r = textoALetra(letraATexto(base), base);
    expect(r.letra).toEqual(base.letra);
    expect(r.defaultStructure).toEqual(cancion.defaultStructure);
  });
  it("una corrección cambia solo esa diapositiva", () => {
    const base = { ...cancion, letra: letraEfectiva(cancion) };
    const texto = letraATexto(base).replace("Linea tres", "Línea tres corregida");
    const r = textoALetra(texto, base);
    expect(r.letra.v1[1]).toEqual(["Línea tres corregida", "Linea cuatro"]);
    expect(r.letra.v1[0]).toEqual(["Linea uno", "Linea dos"]);
    expect(r.letra.c).toEqual(base.letra.c);
  });
});
