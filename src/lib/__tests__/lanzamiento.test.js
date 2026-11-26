import { describe, it, expect } from "vitest";
import { FECHA_LANZAMIENTO, MOMENTO_LANZAMIENTO, yaLanzamos, tiempoRestante, MOMENTO_CIERRE_LISTA, listaEsperaAbierta } from "../lanzamiento.js";

describe("fecha del lanzamiento", () => {
  it("la fecha se puede leer y lleva zona horaria", () => {
    expect(Number.isNaN(MOMENTO_LANZAMIENTO)).toBe(false);
    expect(FECHA_LANZAMIENTO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-06:00$/);
  });
  it("yaLanzamos cambia justo en la fecha", () => {
    expect(yaLanzamos(MOMENTO_LANZAMIENTO - 1)).toBe(false);
    expect(yaLanzamos(MOMENTO_LANZAMIENTO)).toBe(true);
  });
  it("tiempoRestante separa días, horas, minutos y segundos", () => {
    const t = tiempoRestante(MOMENTO_LANZAMIENTO - ((3 * 86400 + 4 * 3600 + 5 * 60 + 6) * 1000));
    expect(t).toMatchObject({ dias: 3, horas: 4, minutos: 5, segundos: 6 });
    expect(tiempoRestante(MOMENTO_LANZAMIENTO + 5000).ms).toBe(0);
  });
  it("la lista de espera cierra a medianoche del 26 de noviembre (Guatemala)", () => {
    expect(new Date(MOMENTO_CIERRE_LISTA).toISOString()).toBe("2026-11-26T06:00:00.000Z");
    expect(listaEsperaAbierta(MOMENTO_CIERRE_LISTA - 1)).toBe(true);
    expect(listaEsperaAbierta(MOMENTO_CIERRE_LISTA)).toBe(false);
    expect(listaEsperaAbierta(MOMENTO_LANZAMIENTO + 1)).toBe(false);
  });
});
