import { describe, expect, it, vi } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: { rpc: vi.fn(() => Promise.resolve({ data: null })) } }));
const { tiene, ANIMACIONES_BASICAS } = await import("../planes.js");
const { COMPARATIVO } = await import("../planesDatos.js");

// Plan Gratis más limitado y canciones libres en los planes de pago (Eldin, 2026-11-26).
describe("límites del plan Gratis", () => {
  const nuevas = ["pantallas_extra", "botones_rapidos", "audio_culto", "material_cancion", "sin_conexion"];
  it("escenario/OBS, botones de un toque, audio, material y sin conexión piden Ministerio", () => {
    for (const f of nuevas) {
      expect(tiene({ plan: "gratis" }, f)).toBe(false);
      expect(tiene({ plan: "ministerio" }, f)).toBe(true);
      expect(tiene({ plan: "iglesia" }, f)).toBe(true);
    }
  });
  it("mientras no se sabe el plan, no se traba nada", () => {
    for (const f of nuevas) expect(tiene(null, f)).toBe(true);
  });
  it("solo 3 letras animadas básicas", () => { expect(ANIMACIONES_BASICAS).toHaveLength(3); });
  it("la página de precios dice canciones ilimitadas en los planes de pago", () => {
    const fila = COMPARATIVO.flatMap((g) => g.filas).find((f) => f[0] === "Canciones");
    expect(fila).toEqual(["Canciones", "20", "Ilimitadas", "Ilimitadas", "Ilimitadas"]);
  });
});
