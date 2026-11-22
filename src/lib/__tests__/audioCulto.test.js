import { describe, expect, it } from "vitest";
import { nombreDeAudio, avisoEnlaceAudio, volumenEnFundido, tieneAudio, nuevaDiapositivaAudio } from "../audioCulto.js";

describe("audio del culto", () => {
  it("saca un nombre legible del enlace", () => {
    expect(nombreDeAudio("https://x.supabase.co/storage/v1/object/public/fondos-en-vivo/i/audio/1732300000000-Himno_de_entrada.mp3")).toBe("Himno de entrada");
    expect(nombreDeAudio("https://a.com/musica/Pista%20ofrenda.m4a")).toBe("Pista ofrenda");
    expect(nombreDeAudio("no es enlace")).toBe("Audio");
  });

  it("avisa cuando el enlace no se va a poder reproducir", () => {
    expect(avisoEnlaceAudio("https://a.com/x.mp3").ok).toBe(true);
    expect(avisoEnlaceAudio("https://youtu.be/abc").ok).toBe(false);
    expect(avisoEnlaceAudio("https://open.spotify.com/track/1").ok).toBe(false);
    expect(avisoEnlaceAudio("https://drive.google.com/file/d/1").ok).toBe(false);
    expect(avisoEnlaceAudio("x.mp3").ok).toBe(false);
    expect(avisoEnlaceAudio("")).toBeNull();
  });

  it("el fundido sube y baja el volumen poco a poco", () => {
    expect(volumenEnFundido(0, 1, 0, 1000)).toBe(0);
    expect(volumenEnFundido(0, 1, 500, 1000)).toBeCloseTo(0.5);
    expect(volumenEnFundido(1, 0, 750, 1000)).toBeCloseTo(0.25);
    expect(volumenEnFundido(1, 0, 2000, 1000)).toBe(0);
  });

  it("reconoce una diapositiva con audio", () => {
    expect(tieneAudio({ audio: { url: "https://a.com/x.mp3" } })).toBe(true);
    expect(tieneAudio(nuevaDiapositivaAudio())).toBe(false);
    expect(tieneAudio({ title: "Hola" })).toBe(false);
  });
});
