// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
import SitioWeb from "../SitioWeb.jsx";
import { CORREO_SOPORTE } from "../lib/soporte.js";
import { MOMENTO_LANZAMIENTO } from "../lib/lanzamiento.js";
afterEach(() => { cleanup(); vi.useRealTimers(); });
// Pone el reloj antes o después del lanzamiento oficial (solo la fecha; los setInterval siguen reales).
const reloj = (ms) => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(ms); };
const despues = () => reloj(MOMENTO_LANZAMIENTO + 60_000);
const antes = () => reloj(MOMENTO_LANZAMIENTO - (2 * 86400 + 3 * 3600) * 1000);

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

// "Al darle pagar al plan sigue enviando a WhatsApp" (2026-11-18): "Elegir plan" lleva a la app con ?planes=1.
describe("botón Elegir plan", () => {
  it("los planes pagados llevan a la app (no a WhatsApp) y ofrecen crear la iglesia a quien no tiene cuenta", () => {
    despues();
    abrir("/web/precios");
    const botones = screen.getAllByText("Elegir plan").map((b) => b.closest("a"));
    expect(botones.length).toBe(3);
    botones.forEach((a) => {
      expect(a.getAttribute("href")).toMatch(/[?&]planes=1$/);
      expect(a.getAttribute("href")).not.toMatch(/wa\.me/);
    });
    expect(screen.getAllByText("Crea tu iglesia").length).toBe(3);
  });
});

// Registro abierto (2026-11-18): el primer botón es "Crear mi iglesia gratis", ya no "Pedir mi código".
describe("registro abierto", () => {
  it("la portada empieza con Crear mi iglesia y lleva al alta en la app", () => {
    despues();
    const { container } = abrir("/web");
    const crear = screen.getAllByText("Crear mi iglesia gratis")[0].closest("a");
    expect(crear.getAttribute("href")).toMatch(/[?&]crear-iglesia$/);
    expect(container.textContent).not.toMatch(/Pedir mi código/);
    expect(container.textContent).not.toMatch(/14 días del plan Iglesia/);
    expect(container.textContent).toMatch(/30 días gratis del plan Iglesia/);
  });
});

// Cuenta regresiva (2026-11-19): antes del lanzamiento se ven precios e información, pero no se crea iglesia.
describe("cuenta regresiva del lanzamiento", () => {
  it("antes del lanzamiento la portada muestra la cuenta y no enlaza al alta", () => {
    antes();
    const { container } = abrir("/web");
    expect(screen.getAllByRole("timer").length).toBeGreaterThan(0);
    expect(container.textContent).toMatch(/Lanzamiento oficial en 2 días, 3 h/);
    expect([...container.querySelectorAll("a")].some((a) => /crear-iglesia/.test(a.getAttribute("href") || ""))).toBe(false);
    expect(screen.getAllByText("Avísame del lanzamiento").length).toBeGreaterThan(0);
  });
  it("antes del lanzamiento los precios se ven completos pero sin botones de pago", () => {
    antes();
    const { container } = abrir("/web/precios");
    expect(container.textContent).toMatch(/\$29\.99/);
    expect(screen.queryAllByText("Elegir plan").length).toBe(0);
    expect([...container.querySelectorAll("a")].some((a) => /planes=1|crear-iglesia/.test(a.getAttribute("href") || ""))).toBe(false);
  });
  it("después del lanzamiento ya no hay cuenta regresiva", () => {
    despues();
    abrir("/web");
    expect(screen.queryAllByRole("timer").length).toBe(0);
  });
});
