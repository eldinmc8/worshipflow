import { describe, it, expect, vi } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
import { ordenarRepertorios, cancionesDeRepertorio, agregarCanciones, quitarCancion, moverCancion, limpiarNombre, enlaceRepertorio, repertorioDeLaUrl, aplicarCambio, idsDe } from "../repertorios.js";

describe("repertorios", () => {
  it("se ordenan alfabéticamente, con números como se leen", () => {
    const l = ordenarRepertorios([{ nombre: "Lista 10 Alabanza" }, { nombre: "lista 2 Alabanza" }, { nombre: "Adoración" }]);
    expect(l.map((r) => r.nombre)).toEqual(["Adoración", "lista 2 Alabanza", "Lista 10 Alabanza"]);
  });

  it("muestra solo las canciones que siguen en la biblioteca, en el orden del repertorio", () => {
    const library = [{ id: "a", title: "A" }, { id: "b", title: "B" }];
    expect(cancionesDeRepertorio({ canciones: ["b", "borrada", "a"] }, library).map((s) => s.id)).toEqual(["b", "a"]);
    expect(cancionesDeRepertorio({ canciones: null }, library)).toEqual([]);
    expect(idsDe({ canciones: ["a", 3, "", null] })).toEqual(["a"]);
  });

  it("agrega sin repetir, quita y mueve", () => {
    expect(agregarCanciones(["a"], ["b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
    expect(quitarCancion(["a", "b"], "a")).toEqual(["b"]);
    expect(moverCancion(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moverCancion(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moverCancion(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("limpia el nombre", () => {
    expect(limpiarNombre("  Lista   1  Alabanza ")).toBe("Lista 1 Alabanza");
    expect(limpiarNombre("x".repeat(100))).toHaveLength(80);
  });

  it("arma y lee el enlace para compartir", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const enlace = enlaceRepertorio(id, "https://app.worshipflowapp.com");
    expect(enlace).toBe(`https://app.worshipflowapp.com/?repertorio=${id}`);
    expect(repertorioDeLaUrl(`?repertorio=${id}`)).toBe(id);
    expect(repertorioDeLaUrl("?repertorio=<script>")).toBeNull();
    expect(repertorioDeLaUrl("")).toBeNull();
  });

  it("aplica lo guardado a la lista sin recargar", () => {
    const l = [{ id: "1", nombre: "B" }, { id: "2", nombre: "C" }];
    expect(aplicarCambio(l, { id: "3", nombre: "A" }).map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(aplicarCambio(l, { id: "2", nombre: "A" }).map((r) => r.nombre)).toEqual(["A", "B"]);
    expect(aplicarCambio(l, { id: "1", borrado: true }).map((r) => r.id)).toEqual(["2"]);
  });
});
