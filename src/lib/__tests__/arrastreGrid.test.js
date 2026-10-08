import { describe, expect, it } from "vitest";
import { destinoEnGrid, desplazamientoGrid } from "../arrastreGrid.js";

// Cuadrícula de 3 columnas (100x60, separadas 10 px): posiciones 0 1 2 / 3 4.
const casillas = [0, 1, 2, 3, 4].map((k) => ({ left: (k % 3) * 110, top: Math.floor(k / 3) * 70, width: 100, height: 60 }));

describe("arrastre en cuadrícula", () => {
  it("cae en la casilla más cercana al centro de la miniatura arrastrada", () => {
    expect(destinoEnGrid(casillas, 50, 30)).toBe(0);
    expect(destinoEnGrid(casillas, 170, 40)).toBe(1);
    expect(destinoEnGrid(casillas, 160, 100)).toBe(4);
  });

  it("al llevar la primera al final, las demás se recorren una casilla atrás (saltando de fila)", () => {
    expect(desplazamientoGrid(1, 0, 4, casillas)).toEqual({ x: -110, y: 0 });
    expect(desplazamientoGrid(3, 0, 4, casillas)).toEqual({ x: 220, y: -70 }); // pasa al final de la fila de arriba
    expect(desplazamientoGrid(4, 0, 4, casillas)).toEqual({ x: -110, y: 0 });
  });

  it("al subir una, las de en medio se recorren adelante y las demás no se mueven", () => {
    expect(desplazamientoGrid(2, 4, 1, casillas)).toEqual({ x: -220, y: 70 });
    expect(desplazamientoGrid(0, 4, 1, casillas)).toBeNull();
  });
});
