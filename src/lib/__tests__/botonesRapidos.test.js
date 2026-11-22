// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import {
  botonesDeFabrica, normalizarBotones, normalizarPaso, leerBotones, guardarBotones, pasoIncompleto,
  resumenPaso, indiceDestino, cuentaDelPaso, fondoDeEstilo, MAX_BOTONES,
} from "../botonesRapidos.js";

describe("botones de un solo toque", () => {
  beforeEach(() => localStorage.clear());

  it("sin nada guardado vienen los 3 de fábrica", () => {
    const b = leerBotones();
    expect(b.map((x) => x.nombre)).toEqual(["Inicio del culto", "Empezar alabanza", "Final del culto"]);
    expect(b[0].pasos.map((p) => p.tipo)).toEqual(["fondo", "cuenta", "musica"]);
    expect(b[1].pasos.map((p) => p.tipo)).toEqual(["bajarMusica", "irA"]);
  });

  it("se guardan en esta computadora y vuelven igual", () => {
    const lista = botonesDeFabrica();
    lista[0].nombre = "Bienvenida";
    lista[0].pasos[2] = { tipo: "musica", url: "https://a.com/x.mp3", nombre: "x", repetir: false };
    guardarBotones(lista);
    const vuelta = leerBotones();
    expect(vuelta[0].nombre).toBe("Bienvenida");
    expect(vuelta[0].pasos[2]).toEqual({ tipo: "musica", url: "https://a.com/x.mp3", nombre: "x", repetir: false });
  });

  it("una lista vacía guardada se respeta (no vuelven los de fábrica)", () => {
    guardarBotones([]);
    expect(leerBotones()).toEqual([]);
  });

  it("limpia datos raros: pasos desconocidos, minutos fuera de rango, demasiados botones", () => {
    expect(normalizarPaso({ tipo: "borrarTodo" })).toBeNull();
    expect(normalizarPaso({ tipo: "cuenta", modo: "minutos", minutos: 9999 })).toEqual({ tipo: "cuenta", modo: "minutos", minutos: 120 });
    expect(normalizarPaso({ tipo: "mensaje", texto: "Hola", segundos: 7 }).segundos).toBe(10);
    const muchos = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, nombre: `B${i}`, pasos: [] }));
    expect(normalizarBotones(muchos)).toHaveLength(MAX_BOTONES);
  });

  it("guarda solo el fondo del estilo, no todo el estilo", () => {
    expect(fondoDeEstilo({ theme: "azul", font: "audaz", fontScale: 1.3 })).toEqual({ theme: "azul" });
    expect(fondoDeEstilo({ theme: "custom", customBgType: "imagen", customImage: "https://a/i.jpg", customVideo: "v" })).toEqual({ theme: "custom", customBgType: "imagen", customImage: "https://a/i.jpg" });
  });

  it("marca los pasos que faltan completar", () => {
    expect(pasoIncompleto({ tipo: "fondo", fondo: null })).toBe(true);
    expect(pasoIncompleto({ tipo: "musica", url: "" })).toBe(true);
    expect(pasoIncompleto({ tipo: "mensaje", texto: "  " })).toBe(true);
    expect(pasoIncompleto({ tipo: "bajarMusica" })).toBe(false);
    expect(pasoIncompleto({ tipo: "fondo", fondo: { theme: "stage" } })).toBe(false);
  });

  it("resume cada paso en palabras sencillas", () => {
    expect(resumenPaso({ tipo: "cuenta", modo: "minutos", minutos: 10 })).toBe("Cuenta regresiva de 10 min");
    expect(resumenPaso({ tipo: "irA", destino: "primerCanto" })).toBe("Ir a el primer canto");
    expect(resumenPaso({ tipo: "fondo", fondo: { theme: "azul" } }, { temas: { azul: { label: "Azul noche" } } })).toBe("Fondo: Azul noche");
  });

  it("'Ir a' encuentra el primer canto, el inicio o el final", () => {
    const slides = [{ type: "slide" }, { type: "biblia" }, { type: "cancion" }, { type: "cancion" }, { type: "slide" }];
    expect(indiceDestino("primerCanto", slides)).toBe(2);
    expect(indiceDestino("inicio", slides)).toBe(0);
    expect(indiceDestino("final", slides)).toBe(4);
    expect(indiceDestino("primerCanto", [{ type: "slide" }])).toBeNull();
    expect(indiceDestino("inicio", [])).toBeNull();
  });

  it("la cuenta va sobre el fondo del botón si el botón pone uno", () => {
    expect(cuentaDelPaso({ modo: "minutos", minutos: 3 }, true)).toMatchObject({ modo: "minutos", minutos: 3, fondo: "estilo" });
    expect(cuentaDelPaso({ modo: "hora" }, false)).toMatchObject({ modo: "hora", fondo: "propio" });
  });
});
