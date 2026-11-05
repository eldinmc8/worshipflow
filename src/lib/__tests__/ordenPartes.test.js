import { describe, expect, it, vi } from "vitest";

const insertados = [];
let faltaColumna = false;
vi.mock("../supabaseClient.js", () => ({
  supabase: {
    from: () => ({
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: (filas) => {
        if (faltaColumna && filas.some((f) => "orden" in f)) return Promise.resolve({ error: { code: "PGRST204", message: "Could not find the 'orden' column of 'secciones_cancion'" } });
        insertados.push(filas);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

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

  it("el orden elegido a mano en Contenido manda sobre la Estructura", async () => {
    const { cancionCompletaAFormatoEditor } = await import("../canciones.js");
    const r = cancionCompletaAFormatoEditor({
      cancion: { id: 1, titulo: "x" },
      secciones: [{ clave: "v1", etiqueta: "Estrofa", contenido: "a", orden: 1 }, { clave: "intro", etiqueta: "Intro", contenido: "b", orden: 0 }, { clave: "c", etiqueta: "Coro", contenido: "c", orden: 2 }],
      estructura: [{ seccion_clave: "v1" }, { seccion_clave: "c" }, { seccion_clave: "intro" }],
      diapositivas: [],
    });
    expect(Object.keys(r.blocks)).toEqual(["intro", "v1", "c"]);
  });

  it("guarda el orden de las partes, y si la base todavía no tiene la columna guarda como antes", async () => {
    const { guardarSecciones } = await import("../canciones.js");
    await guardarSecciones("s1", [{ clave: "intro" }, { clave: "v1" }]);
    expect(insertados.at(-1)).toEqual([{ clave: "intro", cancion_id: "s1", orden: 0 }, { clave: "v1", cancion_id: "s1", orden: 1 }]);
    faltaColumna = true;
    await guardarSecciones("s1", [{ clave: "intro" }]);
    expect(insertados.at(-1)).toEqual([{ clave: "intro", cancion_id: "s1" }]);
  });
});
