import { describe, it, expect } from "vitest";
import { colorPropioDe, fondoFijo, tipoDeFondo, fondoParaRecordar } from "../fondoDiapositiva.js";

describe("fondo propio de una diapositiva de texto", () => {
  it("sin la marca, usa el fondo de Estilo (como todas las diapositivas que ya existen)", () => {
    expect(colorPropioDe({ bgType: "color", bg: "#1B2029" })).toBeNull();
    expect(colorPropioDe({ bgType: "color", bg: "var(--wf-brand-primary)" })).toBeNull();
    expect(colorPropioDe({ bg: "presentacion", imageUrl: "x" })).toBeNull();
    expect(tipoDeFondo({ bgType: "color", bg: "#2A1F33" })).toBe("estilo");
  });
  it("con la marca, es un color liso propio", () => {
    expect(colorPropioDe({ bgType: "color", bg: fondoFijo("#16324F") })).toBe("#16324F");
    expect(tipoDeFondo({ bgType: "color", bg: fondoFijo("#000000") })).toBe("liso");
  });
  it("una marca mal escrita o con imagen/video no cuenta como color liso", () => {
    expect(colorPropioDe({ bgType: "color", bg: "fijo:rojo" })).toBeNull();
    expect(colorPropioDe({ bgType: "imagen", bg: fondoFijo("#000000"), imageUrl: "x" })).toBeNull();
    expect(tipoDeFondo({ bgType: "imagen", imageUrl: "x" })).toBe("imagen");
    expect(tipoDeFondo({ bgType: "video" })).toBe("video");
  });
  it("recuerda el color liso o la imagen del último texto rápido; lo demás vuelve al de Estilo", () => {
    expect(fondoParaRecordar({ bgType: "color", bg: fondoFijo("#0B0F17") })).toEqual({ bgType: "color", bg: "fijo:#0B0F17" });
    expect(fondoParaRecordar({ bgType: "imagen", imageUrl: "https://x/a.jpg" })).toEqual({ bgType: "imagen", imageUrl: "https://x/a.jpg" });
    expect(fondoParaRecordar({ bgType: "imagen", imageUrl: "" })).toEqual({ bgType: "color", bg: "#1B2029" });
    expect(fondoParaRecordar({ bgType: "video", videoUrl: "https://x/a.mp4" })).toEqual({ bgType: "color", bg: "#1B2029" });
  });
});
