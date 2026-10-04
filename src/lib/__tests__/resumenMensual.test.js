import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeFakeSupabase } from "./fakeSupabase.js";

// Resumen mensual (texto libre) de un ministerio: pedido de Eldin el 2026-10-03 (ver
// supabase/migrations/20261003100000_resumen_mensual_ministerio.sql y lib/ministerios.js). Se guarda
// por mes, no por ministerio completo -- estas pruebas fijan que no hay fugas entre meses ni entre
// ministerios, y que guardar dos veces el mismo mes actualiza en vez de duplicar.
let fake;
let ministerios;

beforeEach(async () => {
  vi.resetModules();
  fake = makeFakeSupabase();
  vi.doMock("../supabaseClient.js", () => ({ supabase: fake.client, callUsersFunction: vi.fn() }));
  ministerios = await import("../ministerios.js");
});

describe("getResumenMensual / guardarResumenMensual", () => {
  it("un mes sin resumen todavía devuelve texto vacío, no un error", async () => {
    const texto = await ministerios.getResumenMensual("min-1", "2026-10");
    expect(texto).toBe("");
  });

  it("guarda y después lo vuelve a traer igual", async () => {
    await ministerios.guardarResumenMensual("min-1", "2026-10", "Buen mes, 4 reuniones.");
    const texto = await ministerios.getResumenMensual("min-1", "2026-10");
    expect(texto).toBe("Buen mes, 4 reuniones.");
  });

  it("guardar dos veces el mismo ministerio+mes actualiza la misma fila (no duplica)", async () => {
    await ministerios.guardarResumenMensual("min-1", "2026-10", "Primer borrador");
    await ministerios.guardarResumenMensual("min-1", "2026-10", "Versión final");
    const filas = fake.db.resumen_mensual_ministerio.filter((r) => r.ministerio_id === "min-1" && r.mes === "2026-10");
    expect(filas).toHaveLength(1);
    expect(filas[0].texto).toBe("Versión final");
  });

  it("el resumen de un mes no se mezcla con el de otro mes del mismo ministerio", async () => {
    await ministerios.guardarResumenMensual("min-1", "2026-09", "Resumen de septiembre");
    await ministerios.guardarResumenMensual("min-1", "2026-10", "Resumen de octubre");
    expect(await ministerios.getResumenMensual("min-1", "2026-09")).toBe("Resumen de septiembre");
    expect(await ministerios.getResumenMensual("min-1", "2026-10")).toBe("Resumen de octubre");
  });

  it("el resumen de un ministerio no se mezcla con el de otro ministerio en el mismo mes", async () => {
    await ministerios.guardarResumenMensual("min-1", "2026-10", "Resumen de Infantil");
    await ministerios.guardarResumenMensual("min-2", "2026-10", "Resumen de Jóvenes");
    expect(await ministerios.getResumenMensual("min-1", "2026-10")).toBe("Resumen de Infantil");
    expect(await ministerios.getResumenMensual("min-2", "2026-10")).toBe("Resumen de Jóvenes");
  });
});
