// @vitest-environment jsdom
// Borrar varias canciones a la vez (2026-11-22): en la biblioteca, "Seleccionar" deja marcar varias
// canciones (o todas las que se ven) y borrarlas juntas con un solo botón.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: { from: () => ({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} }, callUsersFunction: vi.fn() }));
import { CancionesList } from "../pantallas/canciones.jsx";

afterEach(cleanup);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

const library = [
  { id: "a", title: "Agnus Dei", artist: "", key: "A", tempo: 70, category: "adoracion" },
  { id: "b", title: "Bueno es alabarte", artist: "", key: "G", tempo: 120, category: "alabanza" },
  { id: "c", title: "Cuán grande es Él", artist: "", key: "D", tempo: 72, category: "adoracion" },
];
const clasificaciones = [{ clave: "adoracion", nombre: "Adoración" }, { clave: "alabanza", nombre: "Alabanza" }];

function montar(extra = {}) {
  const props = { library, clasificaciones, isAdminViewer: true, onToggleFavorite: vi.fn(), onOpen: vi.fn(), onNew: vi.fn(), onDelete: vi.fn(), onDeleteMany: vi.fn(async () => true), ...extra };
  render(<CancionesList {...props} />);
  return props;
}

describe("Borrar varias canciones", () => {
  it("marca dos canciones y las borra juntas; tocar una canción no la abre mientras se selecciona", async () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: /Seleccionar/ }));
    fireEvent.click(screen.getByText("Agnus Dei"));
    fireEvent.click(screen.getByText("Cuán grande es Él"));
    expect(p.onOpen).not.toHaveBeenCalled();
    expect(screen.getByText("2 seleccionadas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Borrar \(2\)/ }));
    await vi.waitFor(() => expect(p.onDeleteMany).toHaveBeenCalledTimes(1));
    expect(p.onDeleteMany.mock.calls[0][0].map((s) => s.id)).toEqual(["a", "c"]);
    await vi.waitFor(() => expect(screen.queryByTestId("barra-seleccion")).toBeNull());
  });

  it("Marcar todas marca solo las que se ven con el filtro, y Cancelar sale sin borrar", () => {
    const p = montar();
    fireEvent.click(screen.getByRole("button", { name: /Adoración/ }));
    fireEvent.click(screen.getByRole("button", { name: /Seleccionar/ }));
    fireEvent.click(screen.getByRole("button", { name: /Marcar todas \(2\)/ }));
    expect(screen.getByText("2 seleccionadas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(p.onDeleteMany).not.toHaveBeenCalled();
    expect(screen.queryByTestId("barra-seleccion")).toBeNull();
  });

  it("quien no administra canciones no ve Seleccionar", () => {
    montar({ isAdminViewer: false });
    expect(screen.queryByRole("button", { name: /Seleccionar/ })).toBeNull();
  });
});
