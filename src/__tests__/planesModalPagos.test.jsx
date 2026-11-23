// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, waitFor } from "@testing-library/react";

// Tu plan con pagos de Paddle (2026-11-13): sin suscripción → "Pagar con tarjeta"; con suscripción viva →
// "Cambiar a este plan" y "Administrar mi suscripción" (sin abrir un segundo pago).
let planActual = null;
vi.mock("../lib/supabaseClient.js", () => ({
  supabase: {
    rpc: (fn) => Promise.resolve({ data: fn === "mi_plan" ? planActual : true, error: null }),
    auth: { getUser: () => Promise.resolve({ data: { user: { email: "admin@iglesia.org" } } }) },
  },
  callUsersFunction: vi.fn(),
}));
afterEach(cleanup);

const base = {
  iglesia_id: "3f2b6c1e-8d4a-4b9e-9f1a-2c3d4e5f6a7b", plan: "crecimiento", plan_contratado: "crecimiento", periodo: "mensual",
  en_prueba: false, vencido: false, vence: "2026-12-16T00:00:00Z", soy_admin: true,
  limites: { miembros: 50, canciones: 200, ministerios: 6 }, uso: { miembros: 3, canciones: 10, ministerios: 1 },
};

async function abrir(plan, titulo = "Plan Crecimiento") {
  planActual = plan;
  vi.resetModules();
  const { PlanesModal } = await import("../components/PlanesModal.jsx");
  render(<PlanesModal onClose={() => {}} />);
  await waitFor(() => expect(screen.getByText(titulo)).toBeTruthy());
}

describe("Tu plan con Paddle", () => {
  it("con suscripción viva: cambiar de plan y administrar, sin otro pago", async () => {
    await abrir({ ...base, tiene_suscripcion: true });
    expect(screen.getAllByText("Cambiar a este plan").length).toBe(2); // Ministerio e Iglesia
    expect(screen.getByText("Tu plan actual")).toBeTruthy();
    expect(screen.getByText("Administrar mi suscripción")).toBeTruthy();
    expect(screen.queryByText("Pagar con tarjeta")).toBeNull();
  });
  it("sin suscripción (super admin en modo de prueba): pagar con tarjeta", async () => {
    await abrir({ ...base, plan: "gratis", plan_contratado: "gratis", tiene_suscripcion: false }, "Plan Gratis");
    await waitFor(() => expect(screen.getAllByText("Pagar con tarjeta").length).toBe(3));
    expect(screen.queryByText("Administrar mi suscripción")).toBeNull();
  });
  it("con beneficio por activar: muestra el grupo y 'Activar mi beneficio' en vez del mes gratis normal", async () => {
    await abrir({ ...base, plan: "gratis", plan_contratado: "gratis", tiene_suscripcion: false, prueba_disponible: true,
      beneficio: { grupo: "fase_2", plazo_hasta: "2099-01-01T00:00:00Z", activado_en: null } }, "Plan Gratis");
    expect(screen.getByText("Beneficio Fase 2")).toBeTruthy();
    expect(screen.getByText("Activar mi beneficio").getAttribute("href")).toContain("beneficio=1");
    expect(screen.queryByText("Empezar mi mes gratis")).toBeNull();
  });
  it("con beneficio activo: fecha en que termina lo gratis y cuándo sube a precio normal", async () => {
    await abrir({ ...base, plan: "iglesia", plan_contratado: "iglesia", tiene_suscripcion: true,
      beneficio: { grupo: "fase_1", activado_en: "2026-12-01T00:00:00Z", gratis_hasta: "2027-06-01T12:00:00Z", precio_hasta: null } }, "Plan Iglesia");
    expect(screen.getByText("Lo gratis termina")).toBeTruthy();
    expect(screen.getByText("Nunca: precio especial para siempre")).toBeTruthy();
    expect(screen.queryByText("Activar mi beneficio")).toBeNull();
  });
  it("plazo vencido sin activar: aviso con el WhatsApp para pedir prórroga", async () => {
    await abrir({ ...base, plan: "gratis", plan_contratado: "gratis", tiene_suscripcion: false,
      beneficio: { grupo: "lista_espera", plazo_hasta: "2020-01-01T00:00:00Z", activado_en: null } }, "Plan Gratis");
    expect(screen.getByText("Venció el plazo para activar tu beneficio")).toBeTruthy();
    expect(screen.getByText("Pedir prórroga por WhatsApp").getAttribute("href")).toContain("wa.me/50239816407");
  });
  it("sin grupo: no aparece nada del beneficio", async () => {
    await abrir({ ...base, tiene_suscripcion: false });
    expect(screen.queryByText(/Beneficio/)).toBeNull();
    expect(screen.queryByText(/prórroga/)).toBeNull();
  });
});
