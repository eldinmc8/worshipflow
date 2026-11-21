// @vitest-environment jsdom
// Pantalla de una plantilla/evento (2026-11-21): el nombre se edita ahí mismo, botón "Guardar" que
// espera a la base y dice "Guardado" o "No se guardó", y la tuerca pasó a ser "Configurar alertas".
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
  it("edita el nombre debajo de PLANTILLA y lo guarda con el botón", async () => {
    const onGuardar = vi.fn(async () => {});
    pintar({ onGuardar });
    expect(screen.getByText("PLANTILLA")).toBeTruthy();
    expect(screen.queryByText("Ajustes del evento")).toBeNull();
    fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), { target: { value: "Culto de Miércoles" } });
    expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ })); });
    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ title: "Culto de Miércoles" }));
    expect(screen.getByRole("button", { name: /Guardado/ })).toBeTruthy();
  });

  it("si la base no guarda, lo dice en el botón", async () => {
    pintar({ onGuardar: vi.fn(async () => { throw new Error("400"); }) });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ })); });
    expect(screen.getByRole("button", { name: /No se guardó/ })).toBeTruthy();
  });

  it("un guardado automático que falló también se muestra", () => {
    pintar({ huboErrorAlGuardar: true });
    expect(screen.getByRole("button", { name: /No se guardó/ })).toBeTruthy();
  });

  it("no deja guardar sin nombre", () => {
    pintar();
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
