// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
const RESUMEN = [
  { id: "ig-1", nombre: "Iglesia Viva", activa: true, creada: hace(60), usuarios: 8, usuarios_activos: 8, usuarios_nuevos_30d: 2, ultimo_ingreso: hace(1), nunca_entraron: 0, ingresaron_7d: 5, canciones: 40, canciones_propias: 35, canciones_nuevas_7d: 3, canciones_nuevas_30d: 6, ultima_cancion: hace(2), eventos: 9, eventos_proximos: 2, eventos_creados_30d: 4, plantillas: 1, proximo_evento: { titulo: "Culto dominical", fecha: hace(-3).slice(0, 10) }, ultimo_evento: hace(4).slice(0, 10), ultimo_evento_creado: hace(3), ministerios: 3, ultima_transmision: hace(4), transmisiones_30d: 4, en_vivo_ahora: false, bosquejos_30d: 2, asistente_30d: 12, limite_asistente: 30 },
  { id: "ig-2", nombre: "Iglesia Dormida", activa: true, creada: hace(45), usuarios: 1, usuarios_activos: 1, usuarios_nuevos_30d: 0, ultimo_ingreso: hace(30), nunca_entraron: 0, ingresaron_7d: 0, canciones: 5, canciones_propias: 0, canciones_nuevas_7d: 0, canciones_nuevas_30d: 0, ultima_cancion: null, eventos: 0, eventos_proximos: 0, eventos_creados_30d: 0, plantillas: 0, proximo_evento: null, ultimo_evento: null, ultimo_evento_creado: null, ministerios: 0, ultima_transmision: null, transmisiones_30d: 0, en_vivo_ahora: false, bosquejos_30d: 0, asistente_30d: 0, limite_asistente: 30 },
];
const consulta = (data) => { const q = { select: () => q, order: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data, error: null }), then: (fn) => Promise.resolve({ data, error: null }).then(fn) }; return q; };
const rpc = vi.fn((nombre) => {
  if (nombre === "resumen_plataforma") return Promise.resolve({ data: RESUMEN, error: null });
  if (nombre === "usuarios_iglesia_plataforma") return Promise.resolve({ data: [{ id: "u1", nombre: "Pastor Juan", email: "juan@x.com", rol: "admin", ultimo_ingreso: hace(30) }], error: null });
  return Promise.resolve({ data: null, error: null });
});
vi.mock("../lib/supabaseClient.js", () => ({
  supabase: { rpc, from: (t) => consulta(t === "plataforma_config" ? { codigo_invitacion: "abc123def456" } : []) },
  callUsersFunction: vi.fn(),
}));
afterEach(cleanup);
const { default: PlataformaAdmin } = await import("../PlataformaAdmin.jsx");

describe("consola de iglesias", () => {
  it("muestra primero las iglesias que necesitan atención, con sus avisos", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    expect(await screen.findByText("Iglesia Dormida")).toBeTruthy();
    // En "Necesitan atención" no aparece la que va bien.
    expect(screen.queryByText("Iglesia Viva")).toBeNull();
    expect(screen.getByText(/Nadie entra desde hace 4 semanas/)).toBeTruthy();
    expect(screen.getByText("No tiene eventos próximos")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Todas/ }));
    expect(screen.getByText("Iglesia Viva")).toBeTruthy();
    expect(screen.getByText("+3 esta semana")).toBeTruthy();
  });

  it("el código de invitación es de un solo uso y se copia como enlace", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    expect((await screen.findByLabelText("Código de invitación")).value).toBe("abc123def456");
    expect(screen.getByText(/una sola iglesia/)).toBeTruthy();
  });

  it("abre el perfil de una iglesia con primeros pasos, actividad y su equipo", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver perfil de Iglesia Dormida" }));
    expect(screen.getByText("Primeros pasos")).toBeTruthy();
    expect(screen.getByText("0 de 6")).toBeTruthy();
    expect(await screen.findByText(/Pastor Juan/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nueva contraseña/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Tope del asistente: 30\/día/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Todas las iglesias/ }));
    expect(await screen.findByText("Iglesia Dormida")).toBeTruthy();
  });
});
