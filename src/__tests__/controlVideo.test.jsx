// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { controlInicial, posicionActual, aplicarAccion, textoTiempo } from "../lib/videoControl.js";
import VideoProyectado from "../components/VideoProyectado.jsx";
afterEach(cleanup);

// Pedido de Eldin (2026-11-08): manejar el video desde la consola (play, pausa, detener, saltar,
// sonido) sin tocar la pantalla de proyección, que puede ser una Smart TV.
describe("control del video desde la consola", () => {
  it("cada video arranca solo, desde el inicio y con sonido", () => {
    expect(controlInicial(1000)).toMatchObject({ estado: "play", pos: 0, en: 1000, sonido: true });
  });

  it("calcula en qué segundo va aunque la orden llegue tarde", () => {
    const c = controlInicial(0);
    expect(posicionActual(c, 30_000)).toBe(30);
    const pausado = aplicarAccion(c, "pausa", { ahora: 30_000 });
    expect(pausado).toMatchObject({ estado: "pausa", pos: 30 });
    expect(posicionActual(pausado, 90_000)).toBe(30);
    const sigue = aplicarAccion(pausado, "alternar", { ahora: 90_000 });
    expect(sigue.estado).toBe("play");
    expect(posicionActual(sigue, 95_000)).toBe(35);
  });

  it("saltar, ir a un punto, reiniciar, detener y sonido", () => {
    const c = aplicarAccion(controlInicial(0), { saltar: 10 }, { ahora: 5000 });
    expect(c.pos).toBe(15);
    expect(aplicarAccion(c, { saltar: -60 }, { ahora: 5000 }).pos).toBe(0);
    expect(aplicarAccion(c, { saltar: 600 }, { ahora: 5000, duracion: 100 }).pos).toBe(99.5);
    expect(aplicarAccion(c, { ir: 42 }, { ahora: 5000 }).pos).toBe(42);
    expect(aplicarAccion(c, "reiniciar", { ahora: 5000 })).toMatchObject({ estado: "play", pos: 0 });
    const parado = aplicarAccion(c, "stop", { ahora: 5000 });
    expect(parado).toMatchObject({ estado: "stop", pos: 0 });
    expect(aplicarAccion(parado, "play", { ahora: 9000 }).pos).toBe(0);
    expect(aplicarAccion(c, "sonido", { ahora: 5000 }).sonido).toBe(false);
    expect(aplicarAccion(c, "pausa", { ahora: 5000 }).n).toBe(c.n + 1);
  });

  it("textoTiempo", () => {
    expect(textoTiempo(65)).toBe("1:05");
    expect(textoTiempo(3729)).toBe("1:02:09");
  });

  it("la pantalla obedece: detenido se oculta; YouTube se maneja por su API", () => {
    const { container, rerender } = render(<VideoProyectado url="https://x.supabase.co/v.mp4" conSonido control={{ ...controlInicial(), estado: "stop" }} />);
    expect(container.querySelector("video").style.visibility).toBe("hidden");
    rerender(<VideoProyectado url="https://youtu.be/dQw4w9WgXcQ" conSonido control={controlInicial()} />);
    const src = container.querySelector("iframe").getAttribute("src");
    expect(src).toContain("enablejsapi=1");
    expect(src).toContain("mute=1"); // arranca sin sonido (nunca lo bloquea el navegador) y luego se le activa
  });
});

describe("controles en la consola", () => {
  it("muestra el avance que reporta la pantalla, manda cada orden y avisa si el sonido está bloqueado", async () => {
    const { vi } = await import("vitest");
    const { screen, fireEvent } = await import("@testing-library/react");
    vi.doMock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
    const { ControlesVideo } = await import("../pantallas/envivo.jsx");
    const onAccion = vi.fn();
    const estado = { pos: 65, duracion: 240, reproduciendo: false, sonidoBloqueado: true, recibido: Date.now() };
    render(<ControlesVideo control={controlInicial()} estado={estado} onAccion={onAccion} />);
    expect(screen.getByText("1:05")).toBeTruthy();
    expect(screen.getByText("4:00")).toBeTruthy();
    expect(screen.getByText(/no deja el sonido hasta que alguien la toque/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    fireEvent.click(screen.getByRole("button", { name: "Adelante 10 segundos" }));
    fireEvent.click(screen.getByRole("button", { name: "Detener" }));
    fireEvent.click(screen.getByRole("button", { name: "Silenciar" }));
    expect(onAccion.mock.calls.map((c) => c[0])).toEqual(["alternar", { saltar: 10 }, "stop", "sonido"]);
  });
});

describe("YouTube: no hace falta detener y dar play", () => {
  it("insiste hasta que el reproductor contesta y, si queda pausado, lo vuelve a arrancar solo", async () => {
    const { vi } = await import("vitest");
    const { act } = await import("@testing-library/react");
    vi.useFakeTimers();
    try {
      const { container } = render(<VideoProyectado url="https://youtu.be/dQw4w9WgXcQ" conSonido control={controlInicial()} />);
      const iframe = container.querySelector("iframe");
      const enviados = [];
      iframe.contentWindow.postMessage = (m) => enviados.push(JSON.parse(m));
      const deYT = (data) => window.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data), source: iframe.contentWindow }));
      act(() => { iframe.dispatchEvent(new Event("load")); });
      act(() => { vi.advanceTimersByTime(1000); });
      // Pide "listening" varias veces mientras YouTube no conteste.
      expect(enviados.filter((m) => m.event === "listening").length).toBeGreaterThan(1);
      act(() => { deYT({ event: "onReady" }); });
      expect(enviados.some((m) => m.func === "playVideo")).toBe(true);
      // El navegador lo pausó al activarle el sonido (y no fue la consola).
      act(() => { deYT({ event: "onStateChange", info: 2 }); });
      enviados.length = 0;
      act(() => { vi.advanceTimersByTime(3500); });
      expect(enviados.some((m) => m.func === "playVideo")).toBe(true);
      // Si sigue quieto, el siguiente intento ya va sin sonido (eso el navegador siempre lo deja).
      enviados.length = 0;
      act(() => { vi.advanceTimersByTime(2500); });
      expect(enviados.map((m) => m.func)).toEqual(expect.arrayContaining(["mute", "playVideo"]));
    } finally {
      vi.useRealTimers();
    }
  });
});
