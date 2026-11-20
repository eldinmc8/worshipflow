import { describe, it, expect } from "vitest";
import { ajustesTransmision, altoFranja, textoParaTransmision } from "../transmision.js";
import { enlaceTransmision, leerTransmisionDeUrl, leerPantallaDeUrl } from "../enlacePantalla.js";

describe("salida para la transmisión (OBS)", () => {
  it("enlace propio /t/<iglesia>/<código>, distinto del de la proyección", () => {
    const url = enlaceTransmision("buen-pastor", "https://app.worshipflowapp.com", "abc123");
    expect(url).toBe("https://app.worshipflowapp.com/t/buen-pastor/abc123");
    expect(leerTransmisionDeUrl("/t/buen-pastor/abc123", "")).toEqual({ slug: "buen-pastor", codigo: "abc123" });
    expect(leerPantallaDeUrl("/t/buen-pastor/abc123", "")).toBeNull();
    expect(leerTransmisionDeUrl("/p/buen-pastor/abc123", "")).toBeNull();
    expect(leerTransmisionDeUrl("/", "?screen=transmision&igl=x&k=y")).toEqual({ slug: "x", codigo: "y" });
  });

  it("ajustes por defecto y dentro de sus límites", () => {
    expect(ajustesTransmision({})).toEqual({ tamano: 1, posicion: "abajo", fondo: "franja" });
    expect(ajustesTransmision(null)).toEqual({ tamano: 1, posicion: "abajo", fondo: "franja" });
    expect(ajustesTransmision({ transmision: { tamano: 9, posicion: "lado", fondo: "sombra" } })).toEqual({ tamano: 1.6, posicion: "abajo", fondo: "sombra" });
    expect(ajustesTransmision({ transmision: { tamano: 0.1, posicion: "arriba" } }).tamano).toBe(0.6);
  });

  it("la franja crece con el tamaño pero nunca tapa media pantalla", () => {
    expect(altoFranja(1)).toBeCloseTo(0.22);
    expect(altoFranja(1.6)).toBeLessThanOrEqual(0.45);
    expect(altoFranja(0.1)).toBeGreaterThanOrEqual(0.12);
  });

  it("qué texto sale según lo que está al aire", () => {
    expect(textoParaTransmision({ type: "cancion", lines: ["Cuán grande es Él", "", "  Mi corazón  "] })).toEqual({ lineas: ["Cuán grande es Él", "Mi corazón"], referencia: "" });
    expect(textoParaTransmision({ type: "biblia", text: "Jehová es mi pastor", reference: "Salmos 23:1", version: "RVR1960" })).toEqual({ lineas: ["Jehová es mi pastor"], referencia: "Salmos 23:1 · RVR1960" });
    expect(textoParaTransmision({ type: "slide", title: "Bienvenidos\nDomingo", subtitle: "10 AM" })).toEqual({ lineas: ["Bienvenidos", "Domingo"], referencia: "10 AM" });
    expect(textoParaTransmision({ type: "slide", diseno: {}, title: "x" })).toBeNull();
    expect(textoParaTransmision({ type: "video" })).toBeNull();
    expect(textoParaTransmision(null)).toBeNull();
    expect(textoParaTransmision({ type: "cancion", lines: ["", " "] })).toBeNull();
  });
});
