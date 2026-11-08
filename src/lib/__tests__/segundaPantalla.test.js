import { describe, it, expect } from "vitest";
import { elegirOtraPantalla, medidasVentana, motivoSinSegundaPantalla } from "../segundaPantalla.js";

// Reporte (2026-11-08): "la computadora reconoce la segunda pantalla pero dice que conecte una, y la
// proyección sale en mi pantalla y tengo que arrastrarla".
const laptop = { left: 0, top: 0, width: 1920, height: 1080, availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040, isPrimary: true, label: "Pantalla integrada" };
const proyector = { left: 1920, top: 0, width: 1280, height: 720, availLeft: 1920, availTop: 0, availWidth: 1280, availHeight: 720, isPrimary: false, label: "Epson" };

describe("abrir la proyección en el segundo monitor", () => {
  it("encuentra el proyector aunque Chrome entregue objetos distintos para la misma pantalla", () => {
    const detalles = { screens: [laptop, proyector], currentScreen: { ...laptop } }; // copia, no el mismo objeto
    expect(elegirOtraPantalla(detalles)).toBe(proyector);
  });

  it("si la consola está en el monitor secundario, abre en el principal", () => {
    expect(elegirOtraPantalla({ screens: [laptop, proyector], currentScreen: { ...proyector } })).toBe(laptop);
  });

  it("proyector a la izquierda (coordenadas negativas) y sin currentScreen", () => {
    const izq = { ...proyector, left: -1280, availLeft: -1280 };
    expect(elegirOtraPantalla({ screens: [laptop, izq] })).toBe(izq);
    expect(medidasVentana(izq).features).toBe("left=-1280,top=0,width=1280,height=720");
  });

  it("con una sola pantalla (modo Duplicar) no hay otra, y el mensaje explica Windows + P", () => {
    expect(elegirOtraPantalla({ screens: [laptop], currentScreen: laptop })).toBeNull();
    expect(motivoSinSegundaPantalla({ extendido: false })).toMatch(/Windows \+ P/);
    expect(motivoSinSegundaPantalla({ permisoDenegado: true })).toMatch(/Administración de ventanas/);
    expect(motivoSinSegundaPantalla({ soportado: false })).toMatch(/Chrome/);
  });
});
