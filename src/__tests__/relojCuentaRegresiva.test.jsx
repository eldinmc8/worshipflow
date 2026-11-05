// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import RelojCuentaRegresiva, { ESTILOS_CUENTA } from "../components/RelojCuentaRegresiva.jsx";
import CuentaRegresivaModal from "../components/CuentaRegresivaModal.jsx";

beforeAll(() => {
  // jsdom no mide nada: le damos un tamaño de pantalla para que el reloj se dibuje.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 1280 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 720 });
});
afterEach(cleanup);

describe("reloj de cuenta regresiva", () => {
  it("hay 20 estilos y todos se dibujan con el tiempo que falta", () => {
    expect(ESTILOS_CUENTA).toHaveLength(20);
    expect(new Set(ESTILOS_CUENTA.map((e) => e.id)).size).toBe(20);
    const hasta = Date.now() + 4 * 60 * 1000 + 30500;
    for (const e of ESTILOS_CUENTA) {
      const { container, unmount } = render(<RelojCuentaRegresiva cuenta={{ estilo: e.id, hasta, total: 300 }} />);
      expect(container.textContent, e.id).toMatch(/04:3[01]/);
      expect(container.textContent, e.id).toMatch(/El servicio comienza en/);
      unmount();
    }
  });

  it("el texto de arriba es opcional", () => {
    const { container } = render(<RelojCuentaRegresiva cuenta={{ estilo: "clasico", mostrarTexto: false }} muestra={90} />);
    expect(container.textContent).toContain("01:30");
    expect(container.textContent).not.toMatch(/comienza/);
  });

  it("al llegar a cero muestra el mensaje, o se queda en 00:00", () => {
    const pasado = Date.now() - 1000;
    const a = render(<RelojCuentaRegresiva cuenta={{ estilo: "neon", hasta: pasado, alTerminar: "mensaje", mensajeFinal: "¡Bienvenidos a casa!" }} />);
    expect(a.container.textContent).toContain("¡Bienvenidos a casa!");
    a.unmount();
    const b = render(<RelojCuentaRegresiva cuenta={{ estilo: "neon", hasta: pasado, alTerminar: "quedarse" }} />);
    expect(b.container.textContent).toContain("00:00");
  });

  it("la ventana permite elegir estilo, texto y qué pasa al terminar", () => {
    let guardado = null;
    render(<CuentaRegresivaModal evento={{ date: "2026-11-08", hora: "10:00:00" }} onClose={() => {}} onGuardar={(c) => { guardado = c; }} />);
    expect(screen.getByText(/Hasta la hora del culto \(/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Por minutos" }));
    fireEvent.click(screen.getByRole("button", { name: "10 min" }));
    fireEvent.click(screen.getByTitle("Neón"));
    fireEvent.click(screen.getByRole("button", { name: "Solo el reloj" }));
    fireEvent.click(screen.getByRole("button", { name: "Pasar sola a lo que sigue" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar al Setlist" }));
    expect(guardado).toMatchObject({ modo: "minutos", minutos: 10, estilo: "neon", mostrarTexto: false, alTerminar: "avanzar" });
  });
});
