import { describe, it, expect } from "vitest";
import { descargarBibliaCompleta } from "../bibleOfflineStore.js";

// En Node no hay IndexedDB: guardar no hace nada y "ya guardado" siempre es no. Basta para probar
// que la descarga ya no se detiene por un capítulo que falla.
const libros = async () => [{ bookid: 1, chapters: 5 }];
const esperar = async () => {};

describe("descargarBibliaCompleta", () => {
  it("reintenta un capítulo que falla una vez", async () => {
    const veces = {};
    const fetchChapter = async (v, b, c) => { veces[c] = (veces[c] || 0) + 1; if (c === 2 && veces[c] === 1) throw new Error("red"); return [{ verse: 1 }]; };
    const r = await descargarBibliaCompleta("RV1960", { fetchBooks: libros, fetchChapter, esperar });
    expect(r).toEqual({ hechos: 5, total: 5, fallidos: 0, cancelado: false });
    expect(veces[2]).toBe(2);
  });
  it("si un capítulo nunca baja, sigue con los demás y lo cuenta", async () => {
    const pedidos = [];
    const fetchChapter = async (v, b, c) => { pedidos.push(c); if (c === 3) throw new Error("red"); return [{ verse: 1 }]; };
    const r = await descargarBibliaCompleta("RV1960", { fetchBooks: libros, fetchChapter, esperar });
    expect(r.fallidos).toBe(1);
    expect(pedidos).toContain(5);
  });
  it("si fallan muchos seguidos (sin internet), se detiene", async () => {
    const fetchChapter = async () => { throw new Error("sin red"); };
    await expect(descargarBibliaCompleta("RV1960", { fetchBooks: libros, fetchChapter, esperar, maxSeguidos: 2 })).rejects.toThrow();
  });
});
