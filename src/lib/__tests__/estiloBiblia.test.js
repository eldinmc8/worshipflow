import { describe, expect, it, vi } from "vitest";
import { estiloDeBiblia, estiloParaDiapositiva, setterDeBiblia, sinEfectosDeCanciones } from "../estiloBiblia.js";

const canciones = { theme: "custom", customBgType: "video", customVideo: "fondo.mp4", font: "moderna", fontScale: 1.2, textColor: "#FFF", animacion: "aurora", animFondo: "estilo", animPorCancion: true, animReceta: { x: 1 }, fondoPorCancion: true, fondosCanciones: { s1: { theme: "noche" } }, bibliaTextColor: "#FFD" };

describe("estilo propio de la Biblia", () => {
  it("sin elegir nada para la Biblia, usa el de canciones SIN letra animada ni fondo por canción", () => {
    const b = estiloDeBiblia(canciones);
    expect(b.theme).toBe("custom");
    expect(b.customVideo).toBe("fondo.mp4");
    expect(b.bibliaTextColor).toBe("#FFD");
    for (const k of ["animacion", "animFondo", "animPorCancion", "animReceta", "fondoPorCancion", "fondosCanciones", "biblia"]) expect(b).not.toHaveProperty(k);
  });
  it("cada diapositiva toma el suyo: versículo → Biblia, canción → canciones", () => {
    const st = { ...canciones, biblia: { theme: "azul", font: "elegante" } };
    expect(estiloParaDiapositiva(st, { type: "biblia" })).toEqual({ theme: "azul", font: "elegante" });
    const deCancion = estiloParaDiapositiva(st, { type: "cancion" });
    expect(deCancion.animacion).toBe("aurora");
    expect(deCancion).not.toHaveProperty("biblia");
    expect(estiloParaDiapositiva(canciones, { type: "slide" })).toBe(canciones);
  });
  it("lo que se elige en modo Biblia queda solo para la Biblia y no toca las canciones", () => {
    let estado = canciones;
    const set = vi.fn((f) => { estado = typeof f === "function" ? f(estado) : f; });
    const setBiblia = setterDeBiblia(set);
    setBiblia((s) => ({ ...s, theme: "noche" }));
    setBiblia((s) => ({ ...s, animacion: "fuego", font: "clasica" })); // la animación nunca entra
    expect(estado.theme).toBe("custom");
    expect(estado.font).toBe("moderna");
    expect(estado.animacion).toBe("aurora");
    expect(estado.biblia.theme).toBe("noche");
    expect(estado.biblia.font).toBe("clasica");
    expect(estado.biblia).not.toHaveProperty("animacion");
    expect(estado.biblia.customVideo).toBe("fondo.mp4"); // arrancó del de canciones
  });
  it("sinEfectosDeCanciones tolera vacío", () => {
    expect(sinEfectosDeCanciones(null)).toEqual({});
    expect(estiloParaDiapositiva(null, { type: "biblia" })).toBeNull();
  });
});
