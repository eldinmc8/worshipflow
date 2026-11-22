// @vitest-environment jsdom
// Crear una canción desde "Agregar canciones" del setlist (2026-11-22): si no está en la biblioteca se
// crea ahí mismo con el editor por pasos y queda en el culto. Y la X que borra el buscador de un toque.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: { from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {} }, callUsersFunction: vi.fn() }));
import { EventDetail } from "../pantallas/eventos.jsx";

afterEach(cleanup);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
const evento = { id: "e1", title: "Domingo", date: "2026-11-29", serviceOrder: [], worshipRoles: [], reminders: [], vistas: [] };
const library = [{ id: "s1", title: "Agnus Dei", key: "A", tempo: 70, category: "corito", defaultStructure: [] }];
const noop = () => {};
const pintar = (props = {}) => render(
  <EventDetail event={evento} library={library} ministries={[]} isCompact isAdminViewer puedeEditarSetlist userId="u1" usuariosReales={[]}
    onBack={noop} onDelete={noop} onAddReminder={noop} onRemoveReminder={noop} onMarkVisto={noop} onGuardar={vi.fn(async () => {})}
    onAddSong={vi.fn()} onDestinoAgregar={noop} canAddBibleReading={false} canAddSermonPoints={false} {...props} />
);
const abrirBuscador = () => {
  fireEvent.click(screen.getByRole("button", { name: /^Agregar$/ }));
  fireEvent.click(screen.getByRole("button", { name: /Canción/ }));
  return screen.getByPlaceholderText("Buscar canción...");
};

describe("Crear canción desde el setlist", () => {
  it("la X borra lo escrito en el buscador", () => {
    pintar({ onCrearCancion: vi.fn() });
    const buscador = abrirBuscador();
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).toBeNull();
    fireEvent.change(buscador, { target: { value: "agnus" } });
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(buscador.value).toBe("");
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).toBeNull();
  });

  it("si no está, la crea con el título que se buscó y la agrega al culto", async () => {
    const onCrearCancion = vi.fn(async () => "nueva-1");
    pintar({ onCrearCancion });
    fireEvent.change(abrirBuscador(), { target: { value: "Way Maker" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear "Way Maker"/ }));
    const editor = screen.getByTestId("crear-cancion-setlist");
    expect(within(editor).getByPlaceholderText("Nombre de la canción").value).toBe("Way Maker");
    fireEvent.change(within(editor).getByDisplayValue("Selecciona tonalidad"), { target: { value: "E" } });
    await act(async () => { fireEvent.click(within(editor).getByRole("button", { name: "Guardar" })); });
    expect(onCrearCancion).toHaveBeenCalledWith(expect.objectContaining({ title: "Way Maker", key: "E", artist: "Unknown" }));
    expect(screen.queryByTestId("crear-cancion-setlist")).toBeNull();
    // Se vuelve a "Agregar canciones" con el buscador limpio.
    expect(screen.getByPlaceholderText("Buscar canción...").value).toBe("");
  });

  it("quien no puede crear canciones no ve el botón", () => {
    pintar();
    fireEvent.change(abrirBuscador(), { target: { value: "Way Maker" } });
    expect(screen.queryByRole("button", { name: /Crear "Way Maker"/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Nueva canción/ })).toBeNull();
  });
});
