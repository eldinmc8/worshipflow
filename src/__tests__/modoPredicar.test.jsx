// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
const { pasosPredicar, pasoAlAire, bosquejoAItems } = await import("../lib/bosquejos.js");
const { default: ModoPredicar } = await import("../components/ModoPredicar.jsx");
afterEach(cleanup);

// Pedido de Eldin (2026-11-06): que el predicador pueda seguir su bosquejo en el celular si no hay
// pantalla de escenario — a mano, o solo, siguiendo lo que Multimedia tiene al aire.
const bosquejo = {
  titulo: "El buen pastor", citaBase: { ref: "Juan 10:11", version: "RVR1960", text: "Yo soy el buen pastor" },
  ideaCentral: "Jesús cuida de nosotros", mostrarIdea: false,
  puntos: [
    { id: "p1", titulo: "Nos conoce", nota: "Contar la historia del rebaño", versiculos: [{ ref: "Juan 10:14", version: "RVR1960", text: "Conozco mis ovejas" }] },
    { id: "p2", titulo: "", nota: "", versiculos: [] }, // vacío: se salta
    { id: "p3", titulo: "Da su vida", nota: "", versiculos: [] },
  ],
};
let n = 0;
const items = bosquejoAItems(bosquejo, "pred", () => `it${++n}`);
const serviceOrder = [{ id: "pred", type: "seccion", title: "Predicación" }, ...items];

describe("modo predicar", () => {
  it("arma los pasos: inicio, idea central y los puntos con algo escrito", () => {
    expect(pasosPredicar(bosquejo)).toEqual([{ tipo: "inicio" }, { tipo: "idea" }, { tipo: "punto", i: 0 }, { tipo: "punto", i: 2 }]);
  });

  it("sabe en qué paso va lo que Multimedia tiene al aire (también un versículo partido)", () => {
    const pasos = pasosPredicar(bosquejo);
    const titulo = items.find((it) => it.subtitle === "Juan 10:11");
    const punto3 = items.find((it) => it.title === "Da su vida");
    const versPunto1 = items.find((it) => it.reference === "Juan 10:14");
    expect(pasoAlAire(pasos, serviceOrder, "pred", { slideId: titulo.id }, bosquejo)).toBe(0);
    expect(pasoAlAire(pasos, serviceOrder, "pred", { slideId: punto3.id }, bosquejo)).toBe(3);
    expect(pasoAlAire(pasos, serviceOrder, "pred", { slideId: `${versPunto1.id}~1` }, bosquejo)).toBe(2);
    expect(pasoAlAire(pasos, serviceOrder, "pred", { slideId: "cancion-1-0" }, bosquejo)).toBe(-1);
  });

  it("sin transmisión se avanza a mano y muestra la nota privada", () => {
    render(<ModoPredicar bosquejo={bosquejo} serviceOrder={serviceOrder} bloqueId="pred" onClose={() => {}} />);
    expect(screen.getByText("Yo soy el buen pastor")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(screen.getByText("Jesús cuida de nosotros")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Paso siguiente" }));
    expect(screen.getByText("Punto 1 de 2")).toBeTruthy();
    expect(screen.getByText("Contar la historia del rebaño")).toBeTruthy();
    expect(screen.getByText("Conozco mis ovejas")).toBeTruthy();
  });

  it("en vivo sigue a Multimedia, y si se mueve a mano ofrece volver a lo que está al aire", () => {
    const punto3 = items.find((it) => it.title === "Da su vida");
    const { rerender } = render(<ModoPredicar bosquejo={bosquejo} serviceOrder={serviceOrder} bloqueId="pred" enVivo slideAlAire={null} onClose={() => {}} />);
    expect(screen.getByText(/tu bosquejo aún no está al aire/)).toBeTruthy();
    rerender(<ModoPredicar bosquejo={bosquejo} serviceOrder={serviceOrder} bloqueId="pred" enVivo slideAlAire={{ slideId: punto3.id }} onClose={() => {}} />);
    expect(screen.getByText("Punto 2 de 2")).toBeTruthy();
    expect(screen.getByText(/siguiendo a Multimedia/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Paso anterior" }));
    fireEvent.click(screen.getByRole("button", { name: /Ir a lo que está al aire/ }));
    expect(screen.getByText("Punto 2 de 2")).toBeTruthy();
  });
});
