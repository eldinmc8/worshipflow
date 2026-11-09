// @vitest-environment jsdom
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";
import SelectorZonaHoraria from "../components/SelectorZonaHoraria.jsx";
afterEach(cleanup);

function Prueba({ alGuardar }) {
  const [zona, setZona] = useState("Etc/GMT+6");
  return <form onSubmit={(e) => { e.preventDefault(); alGuardar("enviado"); }}><SelectorZonaHoraria value={zona} onChange={(z) => { setZona(z); alGuardar(z); }} /></form>;
}

// "El buscador de país no funciona" (2026-11-09): los resultados tienen que VERSE al escribir.
describe("buscador de zona horaria", () => {
  it("al escribir se ven los resultados, y con un toque queda elegida", () => {
    let ultimo = null;
    render(<Prueba alGuardar={(v) => { ultimo = v; }} />);
    fireEvent.change(screen.getByLabelText("Buscar zona horaria"), { target: { value: "venezuela" } });
    const lista = screen.getByRole("listbox", { name: "Zonas horarias" });
    expect(within(lista).getAllByRole("option").map((o) => o.textContent)).toEqual(["Venezuela (UTC-4)"]);
    fireEvent.click(within(lista).getByRole("option"));
    expect(ultimo).toBe("America/Caracas");
    expect(screen.getByLabelText("Buscar zona horaria").value).toBe("");
    expect(screen.getByRole("option", { selected: true }).textContent).toMatch(/Guatemala|Venezuela/); // la lista vuelve a los países
  });
  it("Enter elige el primer resultado y no envía el formulario", () => {
    const eventos = [];
    render(<Prueba alGuardar={(v) => eventos.push(v)} />);
    const buscador = screen.getByLabelText("Buscar zona horaria");
    fireEvent.change(buscador, { target: { value: "madrid" } });
    fireEvent.keyDown(buscador, { key: "Enter" });
    expect(eventos).toEqual(["Europe/Madrid"]);
  });
  it("sin coincidencias lo dice", () => {
    render(<Prueba alGuardar={() => {}} />);
    fireEvent.change(screen.getByLabelText("Buscar zona horaria"), { target: { value: "atlantida" } });
    expect(screen.getByText(/No hay zonas con/)).toBeTruthy();
  });
});
