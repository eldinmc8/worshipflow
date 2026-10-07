import { describe, it, expect } from "vitest";
import { indiceDestino, desplazamientoFila } from "../arrastreLista.js";

// 4 filas de 50 px con 8 px de separación: tops 0, 58, 116, 174 (centros 25, 83, 141, 199).
const filas = [0, 58, 116, 174].map((top) => ({ top, height: 50 }));

describe("indiceDestino", () => {
  it("sin moverse se queda en su lugar", () => {
    expect(indiceDestino(filas, 1, 83)).toBe(1);
  });
  it("bajando, cambia de lugar solo al pasar el centro de la siguiente", () => {
    expect(indiceDestino(filas, 1, 140)).toBe(1);
    expect(indiceDestino(filas, 1, 142)).toBe(2);
    expect(indiceDestino(filas, 1, 500)).toBe(3);
  });
  it("subiendo, cambia de lugar solo al pasar el centro de la anterior", () => {
    expect(indiceDestino(filas, 2, 84)).toBe(2);
    expect(indiceDestino(filas, 2, 82)).toBe(1);
    expect(indiceDestino(filas, 2, -100)).toBe(0);
  });
  it("es estable alrededor del punto de partida (no parpadea entre vecinas)", () => {
    for (let y = 60; y <= 138; y += 2) expect(indiceDestino(filas, 1, y)).toBe(1);
  });
  it("tolera huecos en la foto de filas", () => {
    const conHueco = [filas[0], undefined, filas[2], filas[3]];
    expect(indiceDestino(conHueco, 0, 150)).toBe(1);
  });
});

describe("desplazamientoFila", () => {
  it("bajando de 0 a 2, las filas 1 y 2 suben un salto", () => {
    expect([0, 1, 2, 3].map((i) => desplazamientoFila(i, 0, 2, 58))).toEqual([0, -58, -58, 0]);
  });
  it("subiendo de 3 a 1, las filas 1 y 2 bajan un salto", () => {
    expect([0, 1, 2, 3].map((i) => desplazamientoFila(i, 3, 1, 58))).toEqual([0, 58, 58, 0]);
  });
  it("sin arrastre o sin cambio, nadie se mueve", () => {
    expect(desplazamientoFila(1, null, 2, 58)).toBe(0);
    expect([0, 1, 2].map((i) => desplazamientoFila(i, 1, 1, 58))).toEqual([0, 0, 0]);
  });
});
