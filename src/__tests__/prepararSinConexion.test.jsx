// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";

const proximo = { id: "e1", title: "Culto del domingo", date: "2999-01-01", serviceOrder: [{ id: "i1", type: "cancion", songId: "s1" }, { id: "i2", type: "slide", imageUrl: "/fondos/a.png", videoUrl: "" }] };
const cancion = { id: "s1", title: "Canta oh buen cristiano" };

vi.mock("../lib/supabaseClient.js", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "u" } } } }) } } }));
vi.mock("../lib/canciones.js", () => ({ listCancionesCompletas: async () => [cancion] }));
vi.mock("../lib/eventos.js", () => ({ listEventosCompletos: async () => [proximo] }));
vi.mock("../lib/ministerios.js", () => ({ listMinisteriosCompletos: async () => [] }));
vi.mock("../lib/bibleOfflineStore.js", () => ({ contarCapitulosGuardados: async () => 1189, descargarBibliaCompleta: vi.fn(async () => ({ cancelado: false })) }));
vi.mock("../pantallas/compartido.jsx", () => ({ fetchBibleBooks: async () => [{ bookid: 1, chapters: 1189 }], fetchBibleChapter: async () => [] }));
vi.mock("../pantallas/biblia.jsx", () => ({ BIBLE_OFFLINE_VERSION: "RV1960" }));

const { default: PrepararSinConexion } = await import("../components/PrepararSinConexion.jsx");

const cacheMapa = new Map();
beforeEach(() => {
  localStorage.clear(); cacheMapa.clear();
  vi.stubGlobal("caches", { open: async () => ({ match: async (u) => cacheMapa.get(u), put: async (u, r) => { cacheMapa.set(u, r); } }), match: async () => ({}) });
  vi.stubGlobal("fetch", async () => ({ ok: true, type: "basic" }));
  Object.defineProperty(navigator, "serviceWorker", { value: { getRegistration: async () => ({ active: {} }) }, configurable: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Preparar para usar sin conexión", () => {
  it("al inicio avisa lo que falta y, al preparar, lo guarda y marca todo listo", async () => {
    render(<PrepararSinConexion />);
    await screen.findByText(/Todavía no hay eventos guardados/);
    expect(screen.queryByText(/Todo listo/)).toBeNull();

    fireEvent.click(screen.getByText("Preparar ahora"));
    await screen.findByText(/Todo listo|Casi listo/);

    expect(JSON.parse(localStorage.getItem("worshipflow_cache_eventos")).data[0].id).toBe("e1");
    expect(JSON.parse(localStorage.getItem("worshipflow_cache_canciones")).data[0].id).toBe("s1");
    expect(cacheMapa.has("/fondos/a.png")).toBe(true);
    expect(screen.getByText(/1 de 1 guardadas/)).toBeTruthy();
    expect(screen.getByText(/Culto del domingo/)).toBeTruthy();
  });

  it("sin internet no intenta descargar y lo dice", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    try {
      render(<PrepararSinConexion />);
      await screen.findByText("Preparar ahora");
      fireEvent.click(screen.getByText("Preparar ahora"));
      await waitFor(() => expect(localStorage.getItem("worshipflow_cache_eventos")).toBeNull());
    } finally { Object.defineProperty(navigator, "onLine", { value: true, configurable: true }); }
  });
});
