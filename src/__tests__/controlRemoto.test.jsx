// @vitest-environment jsdom
// Control remoto desde el celular (2026-11-13): la pantalla de Multimedia y los botones del predicador
// mandan órdenes a la tabla comandos_en_vivo (la computadora que transmite las ejecuta).
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

const insertados = [];
const respuesta = { error: null };
vi.mock("../lib/supabaseClient.js", () => ({
  supabase: { from: () => ({ insert: async (fila) => { insertados.push(fila); return respuesta; } }) },
  callUsersFunction: vi.fn(),
}));
window.scrollTo = () => {};
afterEach(() => { cleanup(); insertados.length = 0; respuesta.error = null; });

const { default: ControlRemoto } = await import("../components/ControlRemoto.jsx");
const { default: ModoPredicar } = await import("../components/ModoPredicar.jsx");
const esperar = () => act(() => new Promise((r) => setTimeout(r, 10)));

const evento = {
  title: "Culto dominical",
  serviceOrder: [
    { id: "A", type: "seccion", title: "Alabanza" },
    { id: "c1", type: "cancion", songId: "s1" },
    { id: "P", type: "seccion", title: "Predicación" },
    { id: "t1", type: "slide", title: "La gracia", bosquejoDe: "P", bosquejoPunto: 1 },
  ],
};

describe("control remoto de Multimedia (celular)", () => {
  it("muestra lo que está al aire y manda siguiente, anterior, negro e ir a una parte", async () => {
    render(<ControlRemoto evento={evento} slideAlAire={{ slideId: "c1-0-0", type: "cancion", lines: ["Cuán grande es Él", "mi corazón entona"] }} library={[{ id: "s1", title: "Cuán grande es Él" }]} onCerrar={() => {}} />);
    expect(screen.getByLabelText("Lo que está al aire").textContent).toContain("mi corazón entona");
    fireEvent.click(screen.getByRole("button", { name: "Diapositiva siguiente" })); await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Diapositiva anterior" })); await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Pantalla en negro/ })); await esperar();
    fireEvent.click(screen.getByRole("button", { name: /Diapositiva: La gracia/ })); await esperar();
    expect(insertados).toEqual([
      { accion: "siguiente", item_id: null, bloque_id: null },
      { accion: "anterior", item_id: null, bloque_id: null },
      { accion: "negro", item_id: null, bloque_id: null },
      { accion: "ir_item", item_id: "t1", bloque_id: null },
    ]);
    // La canción al aire se marca en la lista.
    expect(screen.getByRole("button", { name: /Cuán grande es Él/ }).textContent).toContain("AL AIRE");
    // No hay forma de terminar la transmisión desde aquí.
    expect(screen.queryByRole("button", { name: /terminar|finalizar/i })).toBeNull();
  });

  it("si la base no lo deja (sin permiso), lo dice", async () => {
    respuesta.error = { code: "42501", message: "new row violates row-level security policy" };
    render(<ControlRemoto evento={evento} slideAlAire={null} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Diapositiva siguiente" })); await esperar();
    expect(screen.getByRole("alert").textContent).toContain("No tienes permiso");
  });
});

describe("control remoto del predicador (Modo Predicar)", () => {
  const bosquejo = { titulo: "La gracia que transforma", puntos: [{ id: "p1", titulo: "La gracia", versiculos: [] }] };
  it("con su bosquejo al aire, pasa sus diapositivas marcando su bloque", async () => {
    render(<ModoPredicar bosquejo={bosquejo} serviceOrder={evento.serviceOrder} bloqueId="P" enVivo slideAlAire={{ slideId: "t1" }} control={{ bloqueId: "P" }} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Diapositiva siguiente en la pantalla" })); await esperar();
    fireEvent.click(screen.getByRole("button", { name: "Diapositiva anterior en la pantalla" })); await esperar();
    expect(insertados).toEqual([
      { accion: "siguiente", item_id: null, bloque_id: "P" },
      { accion: "anterior", item_id: null, bloque_id: "P" },
    ]);
  });
  it("si su bosquejo todavía no está al aire, no hay botones (solo el aviso)", () => {
    render(<ModoPredicar bosquejo={bosquejo} serviceOrder={evento.serviceOrder} bloqueId="P" enVivo slideAlAire={{ slideId: "c1-0-0" }} control={{ bloqueId: "P" }} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Diapositiva siguiente en la pantalla" })).toBeNull();
    expect(screen.getByText(/Cuando tu bosquejo esté al aire/)).toBeTruthy();
  });
  it("sin permiso de control (o sin transmisión), no aparece nada del control remoto", () => {
    render(<ModoPredicar bosquejo={bosquejo} serviceOrder={evento.serviceOrder} bloqueId="P" enVivo slideAlAire={{ slideId: "t1" }} control={null} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /en la pantalla/ })).toBeNull();
  });
});
