// Una diapositiva de texto sin letra propia ni tamaño de subtítulo mandaba estructura = null, y la
// columna es NOT NULL: el guardado del Setlist COMPLETO fallaba ("No se guardó", 2026-11-22).
import { describe, it, expect, vi } from "vitest";

const upserts = [];
vi.mock("../lib/supabaseClient.js", () => {
  const consulta = () => {
    const q = {
      upsert: async (filas) => { upserts.push(filas); return { error: null }; },
      select: () => q, eq: () => q, in: () => q, not: () => q, delete: () => q,
      then: (res) => res({ data: [], error: null }),
    };
    return q;
  };
  return { supabase: { from: consulta } };
});
import { sincronizarServiceOrder } from "../lib/eventos.js";

describe("guardar el Setlist", () => {
  it("ninguna fila lleva estructura null", async () => {
    await sincronizarServiceOrder("ev1", [
      { id: "a", type: "slide", title: "Bienvenidos", subtitle: "" },
      { id: "b", type: "slide", title: "Con letra", fuente: "Poppins" },
      { id: "c", type: "seccion", title: "Alabanza" },
    ]);
    const filas = upserts.flat();
    expect(filas).toHaveLength(3);
    filas.forEach((f) => expect(f.estructura).not.toBeNull());
    expect(filas.find((f) => f.id === "b").estructura).toEqual({ fuente: "Poppins" });
  });
});
