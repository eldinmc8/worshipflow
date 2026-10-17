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
