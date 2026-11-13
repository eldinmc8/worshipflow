// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
import SitioWeb from "../SitioWeb.jsx";
import { CORREO_SOPORTE } from "../lib/soporte.js";
afterEach(cleanup);

const abrir = (ruta) => { window.history.pushState({}, "", ruta); return render(<SitioWeb />); };

// Requisitos de Paddle (2026-11-13): términos con Paddle como comerciante registrado y reembolso sin condiciones.
describe("páginas legales para Paddle", () => {
  it("los términos nombran a Paddle como comerciante registrado y al responsable", () => {
    const { container } = abrir("/web/terminos");
    expect(container.textContent).toMatch(/Paddle\.com es el comerciante registrado \(Merchant of Record\)/);
    expect(container.textContent).toMatch(/Eldin Mcfarlane/);
  });
  it("el reembolso es de 14 días para cualquier pago, sin condiciones", () => {
    const { container } = abrir("/web/reembolsos");
    expect(container.textContent).toMatch(/cualquier pago, sea el primero o una renovación/);
    expect(container.textContent).not.toMatch(/no son reembolsables/);
  });
  it("la privacidad nombra a Paddle", () => {
    const { container } = abrir("/web/privacidad");
    expect(container.textContent).toMatch(/Paddle\.com/);
  });
  it("el correo de contacto es el de WorshipFlow", () => {
    expect(CORREO_SOPORTE).toBe("worshipflowiglesia@gmail.com");
    abrir("/web/terminos");
    expect(screen.getAllByText(CORREO_SOPORTE).length).toBeGreaterThan(0);
  });
});

// "Al correr los dólares los subtítulos también se corren": los subtítulos de grupo quedan fijos.
describe("tabla de comparación", () => {
  it("los subtítulos de grupo están en una celda fija a la izquierda", () => {
    abrir("/web/precios");
    const subtitulo = screen.getByRole("columnheader", { name: "Equipo" });
    expect(subtitulo.style.position).toBe("sticky");
    expect(subtitulo.style.left).toBe("0px");
  });
});

// Página de pago: sin token configurado o con un enlace inválido, no abre nada y manda a la app.
describe("página de pago", () => {
  it("con un enlace inválido muestra el aviso y el botón a la app", () => {
    const { container } = abrir("/web/pagar?plan=gratis");
    expect(container.textContent).toMatch(/no es válido o los pagos todavía no están activos/);
    // En las pruebas la dirección es localhost, así que "la app" es "/" (en worshipflowapp.com es app.worshipflowapp.com).
    expect(screen.getAllByText("Abrir la app web").some((el) => el.closest("a")?.getAttribute("href") === "/")).toBe(true);
  });
});
