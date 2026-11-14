import { describe, it, expect, vi } from "vitest";
import { instalarResizeObserverRespaldo } from "../resizeObserverRespaldo.js";

function ventanaFalsa() {
  const oyentes = {};
  return {
    oyentes,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    removeEventListener: (tipo) => { delete oyentes[tipo]; },
  };
}

describe("ResizeObserver de respaldo (navegadores viejos)", () => {
  it("no toca el navegador si ya trae ResizeObserver", () => {
    const real = class {};
    const w = { ResizeObserver: real };
    expect(instalarResizeObserverRespaldo(w)).toBe(false);
    expect(w.ResizeObserver).toBe(real);
  });

  it("avisa al empezar y cada vez que cambia el tamaño, y deja de avisar al desconectar", () => {
    vi.useFakeTimers();
    const w = ventanaFalsa();
    expect(instalarResizeObserverRespaldo(w)).toBe(true);
    const el = { clientWidth: 100, clientHeight: 50 };
    const cb = vi.fn();
    const ro = new w.ResizeObserver(cb);
    ro.observe(el);
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(1); // mismo tamaño: no avisa
    el.clientWidth = 300;
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb.mock.calls[1][0][0].contentRect.width).toBe(300);
    el.clientHeight = 80;
    w.oyentes.resize();
    expect(cb).toHaveBeenCalledTimes(3);
    ro.disconnect();
    expect(w.oyentes.resize).toBeUndefined();
    el.clientWidth = 10;
    vi.advanceTimersByTime(2000);
    expect(cb).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
