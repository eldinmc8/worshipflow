// @vitest-environment jsdom
// Pantalla de una plantilla/evento (2026-11-22): encabezado limpio de solo lectura con botón "Editar"
// (Guardar / Cancelar), aviso con "Reintentar" si un guardado automático falló, y "Configurar alertas".
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: { from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {} }, callUsersFunction: vi.fn() }));
import { EventDetail } from "../pantallas/eventos.jsx";

afterEach(cleanup);
const plantilla = { id: "p1", title: "Servicio General Miércoles", esPlantilla: true, serviceOrder: [], worshipRoles: [], reminders: [], vistas: [] };
const noop = () => {};
const pintar = (props = {}) => render(
  <EventDetail event={plantilla} library={[]} ministries={[]} isCompact isAdminViewer puedeEditarSetlist userId="u1" usuariosReales={[]}
    onBack={noop} onDelete={noop} onAddReminder={noop} onRemoveReminder={noop} onMarkVisto={noop} onGuardar={vi.fn(async () => {})}
    canAddBibleReading={false} canAddSermonPoints={false} {...props} />
);

describe("Guardar plantilla", () => {
  it("el encabezado se ve limpio, sin formulario, con un botón Editar", () => {
    pintar();
    expect(screen.getByText("PLANTILLA")).toBeTruthy();
    expect(screen.getAllByText("Servicio General Miércoles").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Nombre de la plantilla")).toBeNull();
    expect(screen.queryByRole("button", { name: /Guardar/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
  });

  it("Editar abre el nombre y Guardar lo guarda y vuelve a cerrarse", async () => {
    const onGuardar = vi.fn(async () => {});
    pintar({ onGuardar });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), { target: { value: "Culto de Miércoles" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Guardar/ })); });
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ title: "Culto de Miércoles" }));
    expect(screen.queryByLabelText("Nombre de la plantilla")).toBeNull();
    expect(screen.getByText("Guardado")).toBeTruthy();
  });

  it("Cancelar cierra sin guardar", () => {
    const onGuardar = vi.fn(async () => {});
    pintar({ onGuardar });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Nombre de la plantilla")).toBeNull();
  });

  it("si la base no guarda, lo dice y deja los campos abiertos", async () => {
    pintar({ onGuardar: vi.fn(async () => { throw new Error("400"); }) });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Guardar/ })); });
    expect(screen.getByText(/No se guardó/)).toBeTruthy();
    expect(screen.getByLabelText("Nombre de la plantilla")).toBeTruthy();
  });

  it("un guardado automático que falló sale como aviso con Reintentar", async () => {
    const onGuardar = vi.fn(async () => {});
    pintar({ huboErrorAlGuardar: true, onGuardar });
    expect(screen.getByText(/no se guardó/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); });
    expect(onGuardar).toHaveBeenCalledWith(null);
  });

  it("no deja guardar sin nombre", () => {
    pintar();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: /Escribe un nombre/ }).disabled).toBe(true);
  });

  it("la tuerca es ahora 'Configurar alertas' y ahí se agregan", () => {
    const onAddReminder = vi.fn();
    pintar({ onAddReminder });
    fireEvent.click(screen.getByRole("button", { name: /Configurar alertas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar alerta/ }));
    expect(onAddReminder).toHaveBeenCalledWith(1, "dias");
  });
});
