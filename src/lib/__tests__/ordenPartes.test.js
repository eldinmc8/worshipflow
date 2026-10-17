import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient.js", () => ({ supabase: {} }));

describe("partes de la canción en el orden en que se canta", () => {
  it("ordena las partes según la Estructura, sin repetir, y las no usadas al final", async () => {
    const { cancionCompletaAFormatoEditor } = await import("../canciones.js");
    const r = cancionCompletaAFormatoEditor({
      cancion: { id: 1, titulo: "x" },
      secciones: [{ clave: "out", etiqueta: "Outro", contenido: "a" }, { clave: "c", etiqueta: "Coro", contenido: "b" }, { clave: "v1", etiqueta: "Estrofa 1", contenido: "c" }, { clave: "x", etiqueta: "Sin usar", contenido: "d" }],
      estructura: [{ seccion_clave: "v1", multiplicador: 1 }, { seccion_clave: "c", multiplicador: 2 }, { seccion_clave: "v1" }, { seccion_clave: "out" }],
      diapositivas: [{ seccion_clave: "out", texto: "a" }, { seccion_clave: "v1", texto: "c" }],
    });
    expect(Object.keys(r.blocks)).toEqual(["v1", "c", "out", "x"]);
    expect(Object.keys(r.letra)).toEqual(["v1", "c", "out", "x"]);
    expect(r.defaultStructure).toEqual(["v1", "c", "c", "v1", "out"]);
  });
});
