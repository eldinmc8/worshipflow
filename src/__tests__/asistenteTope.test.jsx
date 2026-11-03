// @vitest-environment jsdom
// Tope diario del asistente (2026-11-03): la pantalla muestra cuántos mensajes quedan hoy, y al llegar al
// límite lo dice como mensaje del asistente y no deja mandar más.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const estado = { uso: { usados: 28, limite: 30 } };
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: () => Promise.resolve({}) }));
vi.mock("../lib/asistente.js", () => ({
  obtenerUsoAsistente: () => Promise.resolve(estado.uso),
  obtenerReglasAsistente: () => Promise.resolve({ reglas: "" }),
  guardarReglasAsistente: () => Promise.resolve({}),
  aplicarPlanAsistente: () => Promise.resolve({}),
  enviarMensajeAsistente: vi.fn(async () => {
    if (estado.uso.usados >= estado.uso.limite) {
      const e = new Error("Llegaron al límite de hoy del asistente (30 mensajes por día). Se renueva a medianoche.");
      e.datos = { limiteDiario: true, uso: estado.uso };
      throw e;
    }
    estado.uso = { ...estado.uso, usados: estado.uso.usados + 1 };
    return { tipo: "texto", texto: "Listo.", uso: estado.uso };
  }),
}));
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
afterEach(() => cleanup());

const { AsistenteChatScreen } = await import("../pantallas/asistente.jsx");

async function escribirYMandar(texto) {
  fireEvent.change(screen.getByPlaceholderText(/Escribe qué quieres armar/), { target: { value: texto } });
  fireEvent.keyDown(screen.getByPlaceholderText(/Escribe qué quieres armar/), { key: "Enter" });
  await new Promise((r) => setTimeout(r, 30));
}

describe("tope diario del asistente en la pantalla", () => {
  it("muestra cuántos quedan, avisa al llegar al límite y bloquea", async () => {
    render(<AsistenteChatScreen />);
    expect(await screen.findByText(/Te quedan 2 mensajes hoy \(de 30\)/)).toBeTruthy();
    await escribirYMandar("Hola");
    expect(await screen.findByText(/Te queda 1 mensaje hoy/)).toBeTruthy();
    await escribirYMandar("Otro");
    expect(await screen.findByText(/Llegaron al límite de hoy \(30 mensajes\)/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Se acabaron los mensajes de hoy/).disabled).toBe(true);
  });
});
