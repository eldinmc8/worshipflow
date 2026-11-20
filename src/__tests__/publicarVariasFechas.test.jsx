// @vitest-environment jsdom
// "Publicar en varias fechas" desde una plantilla: los pasos Días → Fechas → Revisar y lo que se publica.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import PublicarVariasFechas from "../components/PublicarVariasFechas.jsx";

afterEach(cleanup);

describe("PublicarVariasFechas", () => {
  it("publica todos los miércoles del rango, sin los repetidos", async () => {
    const onPublicar = vi.fn(async (datos, prog) => { prog(datos.fechas.length); return { creados: datos.fechas.length, fallidos: 0 }; });
    const eventos = [{ id: "x", title: "Culto de oración – 9 dic", date: "2026-12-09" }];
    render(<PublicarVariasFechas plantilla={{ id: "p", title: "Culto de oración", serviceOrder: [] }} eventos={eventos} onPublicar={onPublicar} onCerrar={() => {}} />);
    const siguiente = () => screen.getByRole("button", { name: /Siguiente/ });
    expect(siguiente().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Miércoles" }));
    fireEvent.click(siguiente());
    fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: "2026-12-01" } });
    fireEvent.change(document.querySelectorAll('input[type="date"]')[1], { target: { value: "2026-12-31" } });
    expect(screen.getByText("5 servicios")).toBeTruthy();
    fireEvent.click(siguiente());
    expect(screen.getByText("Ya existe")).toBeTruthy();
    expect(screen.getByText("4 de 5 fechas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nombre + fecha" }));
    expect(screen.getByText("Culto de oración – 2 dic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fecha y hora" }));
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: "19:00" } });
    expect(screen.getAllByText("Miércoles 2 de diciembre · 7:00 pm").length).toBeGreaterThan(0);
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: "" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Publicar 4 servicios/ })); });
    const [datos] = onPublicar.mock.calls[0];
    expect(datos.fechas.map((f) => f.date)).toEqual(["2026-12-02", "2026-12-16", "2026-12-23", "2026-12-30"]);
    expect(datos.fechas[0].title).toBe("Miércoles 2 de diciembre");
    expect(screen.getByText(/Se publicaron 4 servicios/)).toBeTruthy();
  });

  it("no deja elegir un rango mayor a un año", () => {
    render(<PublicarVariasFechas plantilla={{ id: "p", title: "Domingo", serviceOrder: [] }} eventos={[]} onPublicar={vi.fn()} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Domingo" }));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: "2026-12-01" } });
    fireEvent.change(document.querySelectorAll('input[type="date"]')[1], { target: { value: "2027-12-15" } });
    expect(screen.getAllByText(/no puede ser mayor a un año/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Siguiente/ }).disabled).toBe(true);
  });
});
