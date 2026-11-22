// @vitest-environment jsdom
// Mensaje para la congregación (2026-11-22): franja en el proyector, encima de lo que está al aire, que se
// quita sola. Ver lib/avisoCongregacion.js.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => ({ supabase: { from: () => ({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} }, callUsersFunction: async () => ({}) }));
const { ProjectionPanel } = await import("../pantallas/proyeccion.jsx");
const { default: PanelAvisoCongregacion } = await import("../components/PanelAvisoCongregacion.jsx");
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };
import { crearAviso, avisoValido, segundosRestantesAviso } from "../lib/avisoCongregacion.js";
import { estiloDeBiblia } from "../lib/estiloBiblia.js";

const cancion = { slideId: "s1", type: "cancion", songTitle: "Canto", blockLabel: "Coro", lines: ["Santo es el Señor", "Digno de alabar"] };

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("mensaje para la congregación", () => {
  it("crearAviso limpia el texto, corta a 120 letras y valida la duración", () => {
    expect(crearAviso("   ")).toBeNull();
    const a = crearAviso("  Hola   iglesia ", 15, 1000);
    expect(a.texto).toBe("Hola iglesia");
    expect(a.duracionSeg).toBe(15);
    expect(crearAviso("x".repeat(200), 7).texto.length).toBe(120);
    expect(crearAviso("x", 7).duracionSeg).toBe(10);
  });

  it("un aviso viejo que quedó guardado ya no vale", () => {
    const a = crearAviso("Hola", 10, 0);
    expect(avisoValido(a, 5000)).toBe(true);
    expect(segundosRestantesAviso(a, 4000)).toBe(6);
    expect(avisoValido(a, 10_000 + 3 * 60_000)).toBe(false);
  });

  it("no se pasa al estilo de la Biblia", () => {
    expect(estiloDeBiblia({ theme: "stage", avisoCongregacion: crearAviso("Hola") }).avisoCongregacion).toBeUndefined();
  });

  it("la proyección muestra la franja encima de la letra y se quita sola", () => {
    vi.useFakeTimers();
    const estilo = { theme: "stage", avisoCongregacion: crearAviso("Favor de silenciar sus celulares", 5) };
    const { container } = render(<ProjectionPanel slide={cancion} blanked={false} split={false} liveStyle={estilo} />);
    expect(screen.getByText("Favor de silenciar sus celulares")).toBeTruthy();
    expect(container.textContent).toContain("Santo es el Señor");
    act(() => { vi.advanceTimersByTime(5200); });
    expect(screen.queryByText("Favor de silenciar sus celulares")).toBeNull();
  });

  it("las miniaturas de la consola no la muestran, salvo la de Al aire", () => {
    const estilo = { theme: "stage", avisoCongregacion: crearAviso("Bienvenidos", 10) };
    const { container, rerender } = render(<ProjectionPanel slide={cancion} blanked={false} split={false} liveStyle={estilo} thumbnail />);
    expect(container.querySelector("[data-aviso-congregacion]")).toBeNull();
    rerender(<ProjectionPanel slide={cancion} blanked={false} split={false} liveStyle={estilo} thumbnail aviso />);
    expect(container.querySelector("[data-aviso-congregacion]")).not.toBeNull();
  });

  it("la ventana Mensaje arma el aviso con el texto y la duración elegidos", () => {
    const onEnviar = vi.fn();
    const onCerrar = vi.fn();
    render(<PanelAvisoCongregacion onEnviar={onEnviar} onQuitar={() => {}} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByText("Se busca al dueño del carro placa…"));
    const cuadro = screen.getByLabelText("Mensaje");
    fireEvent.change(cuadro, { target: { value: cuadro.value + "ABC-123" } });
    fireEvent.click(screen.getByText("30 s"));
    fireEvent.click(screen.getByText("Enviar al proyector"));
    expect(onEnviar).toHaveBeenCalledTimes(1);
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ texto: "Se busca al dueño del carro placa ABC-123", duracionSeg: 30 });
    expect(onCerrar).toHaveBeenCalled();
  });
});
