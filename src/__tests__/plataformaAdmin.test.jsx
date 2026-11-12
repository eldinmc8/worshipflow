// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
const RESUMEN = [
  { id: "ig-1", nombre: "Iglesia Viva", activa: true, creada: hace(60), usuarios: 8, usuarios_activos: 8, usuarios_nuevos_30d: 2, ultimo_ingreso: hace(1), nunca_entraron: 0, ingresaron_7d: 5, canciones: 40, canciones_propias: 35, canciones_nuevas_7d: 3, canciones_nuevas_30d: 6, ultima_cancion: hace(2), eventos: 9, eventos_proximos: 2, eventos_creados_30d: 4, plantillas: 1, proximo_evento: { titulo: "Culto dominical", fecha: hace(-3).slice(0, 10) }, ultimo_evento: hace(4).slice(0, 10), ultimo_evento_creado: hace(3), ministerios: 3, ultima_transmision: hace(4), transmisiones_30d: 4, en_vivo_ahora: false, bosquejos_30d: 2, asistente_30d: 12, limite_asistente: 30 },
  { id: "ig-2", nombre: "Iglesia Dormida", activa: true, creada: hace(45), usuarios: 1, usuarios_activos: 1, usuarios_nuevos_30d: 0, ultimo_ingreso: hace(30), nunca_entraron: 0, ingresaron_7d: 0, canciones: 5, canciones_propias: 0, canciones_nuevas_7d: 0, canciones_nuevas_30d: 0, ultima_cancion: null, eventos: 0, eventos_proximos: 0, eventos_creados_30d: 0, plantillas: 0, proximo_evento: null, ultimo_evento: null, ultimo_evento_creado: null, ministerios: 0, ultima_transmision: null, transmisiones_30d: 0, en_vivo_ahora: false, bosquejos_30d: 0, asistente_30d: 0, limite_asistente: 30 },
];
const borrados = [];
const consulta = (data) => { const q = { select: () => q, order: () => q, eq: (k, v) => { if (q.borrando) borrados.push(v); return q; }, is: () => q, delete: () => { q.borrando = true; return q; }, maybeSingle: () => Promise.resolve({ data, error: null }), then: (fn) => Promise.resolve({ data, error: null }).then(fn) }; return q; };
const CODIGOS = [
  { codigo: "abc123def456", nota: "Iglesia Betel — pastor Juan Pérez, invitada en la conferencia de líderes de Guatemala para probar la app con su equipo de alabanza", creado_at: hace(1), vence_at: hace(-29), usado_at: null, iglesia_id: null },
  { codigo: "0f0f0f0f0f0f", nota: "Iglesia Sion", creado_at: hace(28), vence_at: hace(-2), usado_at: null, iglesia_id: null },
  { codigo: "999999999999", nota: null, creado_at: hace(9), vence_at: hace(-21), usado_at: hace(5), iglesia_id: "ig-1" },
  { codigo: "777777777777", nota: "Iglesia Olvidada", creado_at: hace(40), vence_at: hace(10), usado_at: null, iglesia_id: null },
];
const rpc = vi.fn((nombre) => {
  if (nombre === "resumen_plataforma") return Promise.resolve({ data: RESUMEN, error: null });
  if (nombre === "usuarios_iglesia_plataforma") return Promise.resolve({ data: [{ id: "u1", nombre: "Pastor Juan", email: "juan@x.com", rol: "admin", ultimo_ingreso: hace(30) }], error: null });
  return Promise.resolve({ data: null, error: null });
});
const USUARIOS = [{ id: "u1", nombre: "Pastor Juan", email: "juan@x.com", rol: "admin", iglesia_id: "ig-1" }, { id: "u2", nombre: "Ana", email: "ana@x.com", rol: "miembro", iglesia_id: "ig-1" }];
const callUsersFunction = vi.fn(async () => ({ success: true, nombre: "Iglesia Dormida", usuarios: 1 }));
vi.mock("../lib/supabaseClient.js", () => ({
  supabase: { rpc, from: (t) => consulta(t === "codigos_invitacion" ? CODIGOS : t === "usuarios" ? USUARIOS : []) },
  callUsersFunction,
}));
const dialogos = { confirmar: true, escribir: null };
vi.mock("../lib/confirm.js", () => ({ confirmDialog: vi.fn(async () => dialogos.confirmar), promptDialog: vi.fn(async () => dialogos.escribir) }));
afterEach(() => { cleanup(); borrados.length = 0; callUsersFunction.mockClear(); });
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

  it("muestra varios códigos de invitación pendientes a la vez, cada uno de un solo uso y con vencimiento", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    expect(await screen.findByText("abc123def456")).toBeTruthy();
    expect(screen.getByText("0f0f0f0f0f0f")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Copiar enlace/ })).toHaveLength(2);
    expect(screen.getByText(/una sola iglesia/)).toBeTruthy();
    expect(screen.getByText("vence en 29 días")).toBeTruthy();
    expect(screen.getByText("vence en 2 días")).toBeTruthy();
    // Los usados quedan aparte, con la iglesia que lo usó.
    expect(screen.queryByText("999999999999")).toBeNull();
    expect(screen.queryByText("777777777777")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ver códigos usados o vencidos \(2\)/ }));
    expect(screen.getByText(/por Iglesia Viva/)).toBeTruthy();
    expect(screen.getByText(/sin usarse/)).toBeTruthy();
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

  it("códigos: 'Ver detalles' muestra todo sin recortes (nota completa, iglesia, correo del admin, fechas)", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalles del código abc123def456" }));
    const modal = screen.getByRole("dialog", { name: "Detalles del código abc123def456" });
    expect(modal.textContent).toContain("Iglesia Betel — pastor Juan Pérez, invitada en la conferencia de líderes de Guatemala para probar la app con su equipo de alabanza");
    expect(modal.textContent).toContain("Disponible");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Uno usado: iglesia que lo usó, correo de su administrador y fecha de canje.
    fireEvent.click(screen.getByRole("button", { name: /Ver códigos usados o vencidos/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver detalles del código 999999999999" }));
    const usado = screen.getByRole("dialog");
    expect(usado.textContent).toContain("Usado");
    expect(usado.textContent).toContain("Iglesia Viva");
    expect(usado.textContent).toContain("juan@x.com");
    expect(usado.textContent).not.toContain("ana@x.com"); // solo administradores
  });

  it("códigos: borrar pide confirmación, lo quita de Supabase y de la lista al instante", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Borrar código 0f0f0f0f0f0f" }));
    await screen.findByText("abc123def456");
    await new Promise((r) => setTimeout(r, 0));
    expect(borrados).toEqual(["0f0f0f0f0f0f"]);
    expect(screen.queryByText("0f0f0f0f0f0f")).toBeNull();
    expect(screen.getByText("abc123def456")).toBeTruthy();
  });

  it("códigos: si se cancela la confirmación no se borra nada", async () => {
    dialogos.confirmar = false;
    render(<PlataformaAdmin onExit={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Borrar código 0f0f0f0f0f0f" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(borrados).toEqual([]);
    expect(screen.getByText("0f0f0f0f0f0f")).toBeTruthy();
    dialogos.confirmar = true;
  });

  it("códigos: el buscador filtra por código, por nombre y por iglesia (también los usados)", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    const buscar = await screen.findByLabelText("Buscar códigos");
    fireEvent.change(buscar, { target: { value: "sion" } });
    expect(screen.getByText("0f0f0f0f0f0f")).toBeTruthy();
    expect(screen.queryByText("abc123def456")).toBeNull();
    fireEvent.change(buscar, { target: { value: "abc123" } });
    expect(screen.getByText("abc123def456")).toBeTruthy();
    expect(screen.queryByText("0f0f0f0f0f0f")).toBeNull();
    fireEvent.change(buscar, { target: { value: "iglesia viva" } });
    expect(screen.getByText("999999999999")).toBeTruthy(); // usado por Iglesia Viva: aparece sin abrir "Ver usados"
    expect(screen.getByText("Ningún código disponible coincide con la búsqueda.")).toBeTruthy();
  });

  it("borrar iglesia: hay que escribir el nombre exacto; si no coincide no se llama al servidor", async () => {
    render(<PlataformaAdmin onExit={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver perfil de Iglesia Dormida" }));
    dialogos.escribir = "Iglesia Equivocada";
    fireEvent.click(screen.getByRole("button", { name: /Borrar iglesia/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(callUsersFunction).not.toHaveBeenCalled();
    dialogos.escribir = "Iglesia Dormida";
    fireEvent.click(screen.getByRole("button", { name: /Borrar iglesia/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(callUsersFunction).toHaveBeenCalledWith("eliminar-iglesia", { iglesia_id: "ig-2", confirmacion: "Iglesia Dormida" });
    // Vuelve a la lista de iglesias.
    expect(await screen.findByText("Invitar iglesias nuevas")).toBeTruthy();
    dialogos.escribir = null;
  });
});
