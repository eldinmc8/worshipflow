import { describe, it, expect, vi } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
import { tipoDeArchivo, normalizarEnlace, tituloPorDefecto } from "../adjuntosCancion.js";

describe("adjuntos de canción", () => {
  it("reconoce PDFs e imágenes y rechaza lo demás", () => {
    expect(tipoDeArchivo({ type: "application/pdf", name: "a.pdf" })).toBe("pdf");
    expect(tipoDeArchivo({ type: "", name: "Partitura.PDF" })).toBe("pdf");
    expect(tipoDeArchivo({ type: "image/jpeg", name: "foto.jpg" })).toBe("imagen");
    expect(tipoDeArchivo({ type: "", name: "foto.heic" })).toBe("imagen");
    expect(tipoDeArchivo({ type: "audio/mpeg", name: "pista.mp3" })).toBeNull();
  });
  it("arregla enlaces pegados sin https y rechaza texto suelto", () => {
    expect(normalizarEnlace("  youtu.be/abc ")).toBe("https://youtu.be/abc");
    expect(normalizarEnlace("https://drive.google.com/x")).toBe("https://drive.google.com/x");
    expect(normalizarEnlace("hola mundo")).toBeNull();
    expect(normalizarEnlace("hola")).toBeNull();
    expect(normalizarEnlace("")).toBeNull();
  });
  it("pone un nombre útil si no le escriben título", () => {
    expect(tituloPorDefecto("enlace", { url: "https://www.youtube.com/watch?v=1" })).toBe("YouTube");
    expect(tituloPorDefecto("enlace", { url: "https://open.spotify.com/track/1" })).toBe("Spotify");
    expect(tituloPorDefecto("enlace", { url: "https://ejemplo.com/x" })).toBe("ejemplo.com");
    expect(tituloPorDefecto("pdf", { nombreArchivo: "Cuan grande es El.pdf" })).toBe("Cuan grande es El");
    expect(tituloPorDefecto("imagen", { nombreArchivo: "" })).toBe("Imagen");
  });
});

import { esVideo, agruparAdjuntos, tituloParaArchivo } from "../adjuntosCancion.js";
describe("material para músicos", () => {
  it("reconoce videos de YouTube y Vimeo", () => {
    expect(esVideo({ tipo: "enlace", url: "https://youtu.be/x" })).toBe(true);
    expect(esVideo({ tipo: "enlace", url: "https://m.youtube.com/watch?v=1" })).toBe(true);
    expect(esVideo({ tipo: "enlace", url: "https://vimeo.com/1" })).toBe(true);
    expect(esVideo({ tipo: "enlace", url: "https://drive.google.com/x" })).toBe(false);
    expect(esVideo({ tipo: "pdf", url: "https://youtu.be/x" })).toBe(false);
  });
  it("separa enlaces y archivos, en orden alfabético", () => {
    const { enlaces, archivos } = agruparAdjuntos([
      { id: 1, tipo: "enlace", titulo: "Tutorial trompeta" },
      { id: 2, tipo: "pdf", titulo: "Voces" },
      { id: 3, tipo: "enlace", titulo: "álbum" },
      { id: 4, tipo: "imagen", titulo: "Bajo" },
    ]);
    expect(enlaces.map((a) => a.id)).toEqual([3, 1]);
    expect(archivos.map((a) => a.id)).toEqual([4, 2]);
  });
  it("numera los archivos cuando suben varios con el mismo nombre", () => {
    expect(tituloParaArchivo("Voces", 0, 2, "a.jpg", "imagen")).toBe("Voces 1");
    expect(tituloParaArchivo("Voces", 1, 2, "b.jpg", "imagen")).toBe("Voces 2");
    expect(tituloParaArchivo("Trompeta en Si bemol", 0, 1, "x.pdf", "pdf")).toBe("Trompeta en Si bemol");
    expect(tituloParaArchivo("", 0, 1, "Partitura.pdf", "pdf")).toBe("Partitura");
  });
});
