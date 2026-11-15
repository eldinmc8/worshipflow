import { describe, expect, it, vi } from "vitest";
import { soportaPantallaCompleta, pedirPantallaCompleta, estaEnPantallaCompleta, esIphone } from "../pantallaCompleta.js";

describe("pantalla completa", () => {
  it("iPhone (sin requestFullscreen): no la soporta y pedirla no falla", async () => {
    const doc = { documentElement: {} };
    expect(soportaPantallaCompleta(doc)).toBe(false);
    await expect(pedirPantallaCompleta(doc)).resolves.toBe(false);
  });
  it("Chrome: la pide con requestFullscreen", async () => {
    const doc = { fullscreenEnabled: true, fullscreenElement: null, documentElement: {} };
    doc.documentElement.requestFullscreen = vi.fn(async () => { doc.fullscreenElement = doc.documentElement; });
    expect(soportaPantallaCompleta(doc)).toBe(true);
    await expect(pedirPantallaCompleta(doc)).resolves.toBe(true);
    expect(estaEnPantallaCompleta(doc)).toBe(true);
  });
  it("Safari en iPad: usa el prefijo webkit", async () => {
    const doc = { webkitFullscreenEnabled: true, documentElement: {} };
    doc.documentElement.webkitRequestFullscreen = vi.fn(() => { doc.webkitFullscreenElement = doc.documentElement; });
    expect(soportaPantallaCompleta(doc)).toBe(true);
    await expect(pedirPantallaCompleta(doc)).resolves.toBe(true);
  });
  it("si el navegador la rechaza, devuelve false sin lanzar error", async () => {
    const doc = { fullscreenEnabled: true, documentElement: { requestFullscreen: () => Promise.reject(new Error("no")) } };
    await expect(pedirPantallaCompleta(doc)).resolves.toBe(false);
  });
  it("reconoce el iPhone", () => {
    expect(esIphone({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe(true);
    expect(esIphone({ userAgent: "Mozilla/5.0 (Linux; Android 14)" })).toBe(false);
  });
});

describe("proyección dentro de un programa de transmisión", () => {
  it("reconoce OBS (fuente Navegador) y el enlace con ?obs=1; un navegador normal no", async () => {
    const { esFuenteDeTransmision } = await import("../pantallaCompleta.js");
    const chrome = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36";
    expect(esFuenteDeTransmision({ navigator: { userAgent: chrome }, location: { search: "" } })).toBe(false);
    expect(esFuenteDeTransmision({ navigator: { userAgent: chrome + " OBS/31.0.0" }, location: { search: "" } })).toBe(true);
    expect(esFuenteDeTransmision({ obsstudio: {}, navigator: { userAgent: chrome }, location: { search: "" } })).toBe(true);
    expect(esFuenteDeTransmision({ navigator: { userAgent: chrome }, location: { search: "?obs=1" } })).toBe(true);
  });
});
