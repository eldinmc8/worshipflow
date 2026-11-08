import { describe, expect, it, vi } from "vitest";
import { delegarPantallaCompleta, esperarListaYDelegar, MENSAJE_LISTA, MENSAJE_FS } from "../delegarPantallaCompleta.js";

const ORIGEN = "https://worshipflow.app";
function escuchaFalsa() {
  const fns = new Set();
  return { addEventListener: (_t, f) => fns.add(f), removeEventListener: (_t, f) => fns.delete(f), emitir: (e) => [...fns].forEach((f) => f(e)), cuantos: () => fns.size };
}

describe("pantalla completa de la proyección sin tocar el proyector", () => {
  it("le pasa a la proyección el permiso del clic", () => {
    const ventana = { closed: false, postMessage: vi.fn() };
    expect(delegarPantallaCompleta(ventana, ORIGEN)).toBe(true);
    expect(ventana.postMessage).toHaveBeenCalledWith({ wf: MENSAJE_FS }, { targetOrigin: ORIGEN, delegate: "fullscreen" });
  });
  it("si el navegador no deja delegar (sin clic reciente) o la ventana está cerrada, devuelve false", () => {
    expect(delegarPantallaCompleta({ closed: false, postMessage: () => { throw new Error("Delegation is not allowed without transient user activation."); } }, ORIGEN)).toBe(false);
    expect(delegarPantallaCompleta({ closed: true, postMessage: vi.fn() }, ORIGEN)).toBe(false);
    expect(delegarPantallaCompleta(null, ORIGEN)).toBe(false);
  });
  it("delega apenas ESA ventana avisa que está lista, e ignora mensajes de otras", async () => {
    const ventana = { closed: false, postMessage: vi.fn() };
    const escucha = escuchaFalsa();
    const p = esperarListaYDelegar(ventana, { origen: ORIGEN, escucha });
    escucha.emitir({ source: {}, origin: ORIGEN, data: { wf: MENSAJE_LISTA } });
    escucha.emitir({ source: ventana, origin: "https://otro.sitio", data: { wf: MENSAJE_LISTA } });
    expect(ventana.postMessage).not.toHaveBeenCalled();
    escucha.emitir({ source: ventana, origin: ORIGEN, data: { wf: MENSAJE_LISTA } });
    expect(await p).toBe(true);
    expect(ventana.postMessage).toHaveBeenCalledTimes(1);
    expect(escucha.cuantos()).toBe(0);
  });
  it("si la proyección nunca avisa, se rinde y deja de escuchar", async () => {
    vi.useFakeTimers();
    const escucha = escuchaFalsa();
    const p = esperarListaYDelegar({ closed: false, postMessage: vi.fn() }, { origen: ORIGEN, escucha, limiteMs: 6000 });
    vi.advanceTimersByTime(6001);
    expect(await p).toBe(false);
    expect(escucha.cuantos()).toBe(0);
    vi.useRealTimers();
  });
});
