import { describe, it, expect } from "vitest";
import { generarFechas, hastaMaximo, problemaDelRango, tituloParaFecha, fechasRepetidas, personasDePlantilla, sumarMeses, finDeMes, resumenRango } from "../publicarVarias.js";

describe("publicar una plantilla en varias fechas", () => {
  it("todos los miércoles de diciembre 2026", () => {
    expect(generarFechas({ desde: "2026-12-01", hasta: "2026-12-31", dias: [3] })).toEqual(["2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23", "2026-12-30"]);
  });
  it("un año completo de miércoles da 52 o 53 servicios", () => {
    const f = generarFechas({ desde: "2026-11-20", hasta: hastaMaximo("2026-11-20"), dias: [3] });
    expect(f.length).toBeGreaterThanOrEqual(52);
    expect(f.length).toBeLessThanOrEqual(53);
    expect(f[f.length - 1] <= "2027-11-19").toBe(true);
  });
  it("varios días y cada 2 semanas", () => {
    expect(generarFechas({ desde: "2026-12-01", hasta: "2026-12-31", dias: [0, 3], frecuencia: "quincenal" })).toEqual(["2026-12-02", "2026-12-06", "2026-12-16", "2026-12-20", "2026-12-30"]);
  });
  it("una vez al mes: primer y último miércoles", () => {
    expect(generarFechas({ desde: "2026-12-01", hasta: "2027-02-28", dias: [3], frecuencia: "mensual", semanaDelMes: 1 })).toEqual(["2026-12-02", "2027-01-06", "2027-02-03"]);
    expect(generarFechas({ desde: "2026-12-01", hasta: "2027-02-28", dias: [3], frecuencia: "mensual", semanaDelMes: 5 })).toEqual(["2026-12-30", "2027-01-27", "2027-02-24"]);
  });
  it("no deja pasar de un año ni rangos al revés", () => {
    expect(hastaMaximo("2026-11-20")).toBe("2027-11-19");
    expect(problemaDelRango("2026-11-20", "2027-11-19")).toBeNull();
    expect(problemaDelRango("2026-11-20", "2027-11-20")).toMatch(/un año/);
    expect(problemaDelRango("2026-11-20", "2026-11-01")).toMatch(/antes/);
    expect(generarFechas({ desde: "2026-11-20", hasta: "2028-01-01", dias: [3] })).toEqual([]);
  });
  it("atajos de rango", () => {
    expect(finDeMes("2026-11-20")).toBe("2026-11-30");
    expect(sumarMeses("2026-11-20", 3)).toBe("2027-02-19");
    expect(sumarMeses("2026-11-20", 12)).toBe("2027-11-19");
  });
  it("título con fecha y repetidos", () => {
    expect(tituloParaFecha("Culto de oración", "2026-12-03")).toBe("Culto de oración – 3 dic");
    expect(tituloParaFecha("Culto de oración", "2026-11-20", "fecha", "19:00")).toBe("Viernes 20 de noviembre · 7:00 pm");
    expect(tituloParaFecha("", "2026-11-20", "fecha", null)).toBe("Viernes 20 de noviembre");
    const eventos = [
      { title: "Culto de Oración – 2 dic", date: "2026-12-02" },
      { title: "Culto de oracion", date: "2026-12-09" },
      { title: "Otra cosa", date: "2026-12-16" },
      { title: "Culto de oración", date: "2026-12-23", esPlantilla: true },
      { title: "Miércoles 30 de diciembre · 7:00 pm", date: "2026-12-30" },
    ];
    expect([...fechasRepetidas(eventos, "Culto de oración", ["2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23", "2026-12-30"])].sort()).toEqual(["2026-12-02", "2026-12-09"]);
    expect([...fechasRepetidas(eventos, "Culto de oración", ["2026-12-30"], (f) => tituloParaFecha("", f, "fecha", "19:00"))]).toEqual(["2026-12-30"]);
  });
  it("cada persona de la plantilla una sola vez", () => {
    const pl = { serviceOrder: [{ encargados: [{ usuarioId: "a" }, { usuarioId: "b" }] }, { encargados: [{ usuarioId: "a" }, { n: "Sin cuenta" }] }], worshipRoles: [{ members: [{ usuarioId: "c" }, { usuarioId: "b" }] }] };
    expect(personasDePlantilla(pl).sort()).toEqual(["a", "b", "c"]);
    expect(resumenRango(["2026-12-02", "2027-01-06"])).toBe("del 2 dic al 6 ene");
  });
});
