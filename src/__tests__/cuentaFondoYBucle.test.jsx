// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import RelojCuentaRegresiva from "../components/RelojCuentaRegresiva.jsx";
import { normalizarCuenta, fondoPersonalizado, CUENTA_DEFAULT } from "../lib/cuentaRegresiva.js";
import { urlIncrustada, tipoDeVideo } from "../lib/videoEnlace.js";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1280 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 720 });
});
afterEach(cleanup);

describe("fondo propio de la cuenta regresiva (2026-11-27)", () => {
  it("por defecto pasa sola a lo que sigue y el mensaje dice Iniciamos", () => {
    expect(CUENTA_DEFAULT.alTerminar).toBe("avanzar");
    expect(CUENTA_DEFAULT.mensajeFinal).toContain("Iniciamos");
  });
  it("normaliza color, imagen y oscurecido", () => {
    expect(normalizarCuenta({ fondo: "color", fondoColor: "rojo" }).fondoColor).toBe("#0B0F17");
    expect(normalizarCuenta({ fondo: "imagen" }).fondo).toBe("propio"); // sin imagen todavía
    expect(normalizarCuenta({ fondo: "imagen", fondoImagen: "https://x/a.jpg", oscurecer: 200 })).toMatchObject({ fondo: "imagen", oscurecer: 80 });
    expect(fondoPersonalizado({ fondo: "video", fondoVideo: "https://x/v.mp4", oscurecer: 10 })).toEqual({ tipo: "video", url: "https://x/v.mp4", oscurecer: 10 });
    expect(fondoPersonalizado({ fondo: "propio" })).toBeNull();
  });
  it("dibuja la imagen de fondo debajo del reloj", () => {
    render(<RelojCuentaRegresiva cuenta={{ fondo: "imagen", fondoImagen: "https://x/ofrenda.jpg", oscurecer: 0 }} muestra={60} quieto />);
    const fondo = screen.getByTestId("fondo-cuenta");
    expect(fondo.querySelector("img").getAttribute("src")).toBe("https://x/ofrenda.jpg");
  });
  it("al terminar con mensaje ya no deja 'El servicio comienza en' arriba", () => {
    const { container } = render(<RelojCuentaRegresiva cuenta={{ hasta: Date.now() - 5000, alTerminar: "mensaje", mensajeFinal: "¡Iniciamos!\nBienvenidos" }} />);
    expect(container.textContent).not.toContain("El servicio comienza en");
    expect(container.textContent).toContain("Iniciamos");
  });
});

describe("video en bucle (2026-11-27)", () => {
  it("YouTube con sonido se repite si se pide", () => {
    const info = tipoDeVideo("https://youtu.be/dQw4w9WgXcQ");
    expect(urlIncrustada(info, { conSonido: true })).not.toContain("loop=1");
    expect(urlIncrustada(info, { conSonido: true, repetir: true })).toContain("loop=1");
  });
});
