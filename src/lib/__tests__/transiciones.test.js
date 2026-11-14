import { describe, it, expect } from "vitest";
import { transicionDelCulto, transicionDeItem, transicionDeDiapositiva, animacionDeTransicion, conTransicionDeItem } from "../transiciones.js";
import { estiloDeBiblia, estiloParaDiapositiva } from "../estiloBiblia.js";

const cancion = { slideId: "c1-V1-0", type: "cancion" };
const aviso = { slideId: "t1", type: "slide" };
const versiculoSuelto = { slideId: "adhoc-biblia", type: "biblia", reference: "Juan 3:16" };

describe("transiciones", () => {
  it("sin elegir nada no hay transición: todo entra como siempre", () => {
    expect(transicionDelCulto({})).toBe("ninguna");
    expect(transicionDelCulto(null)).toBe("ninguna");
    expect(animacionDeTransicion({ theme: "stage" }, cancion)).toBeNull();
  });
  it("una para todo el culto, con su velocidad", () => {
    const st = { transicion: "fundido" };
    expect(animacionDeTransicion(st, cancion)).toBe("wfTransFundido 0.6s ease both");
    expect(animacionDeTransicion({ ...st, transicionVel: "lenta" }, versiculoSuelto)).toBe("wfTransFundido 1.1s ease both");
    expect(animacionDeTransicion({ transicion: "inventada" }, cancion)).toBeNull();
  });
  it("un elemento puede llevar la suya, y los demás siguen con la del culto", () => {
    const st = conTransicionDeItem({ transicion: "fundido" }, "t1", "zoom");
    expect(transicionDeItem(st, "t1")).toBe("zoom");
    expect(transicionDeDiapositiva(st, aviso)).toBe("zoom");
    expect(transicionDeDiapositiva(st, cancion)).toBe("fundido");
    // "Ninguna" para un solo elemento también vale.
    expect(animacionDeTransicion(conTransicionDeItem(st, "c1", "ninguna"), cancion)).toBeNull();
    // Quitarle la propia = vuelve a la del culto.
    const sin = conTransicionDeItem(st, "t1", null);
    expect(transicionDeItem(sin, "t1")).toBeNull();
    expect(transicionDeDiapositiva(sin, aviso)).toBe("fundido");
  });
  it("es del culto entero: no se mete en el estilo de la Biblia ni se pierde en el de las canciones", () => {
    const st = { theme: "stage", transicion: "deslizar", transicionVel: "rapida", transicionesItems: { t1: "zoom" } };
    expect(estiloDeBiblia(st)).toEqual({ theme: "stage" });
    expect(estiloParaDiapositiva(st, cancion).transicion).toBe("deslizar");
  });
});
