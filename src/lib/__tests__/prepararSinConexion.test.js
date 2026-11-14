import { describe, it, expect, beforeEach, vi } from "vitest";
import { recolectarMedios, fuentesDeEventos, guardarYVerificar, guardarCanciones, guardarImagenes, appGuardada, eventosProximos } from "../prepararSinConexion.js";

const cacheFalsa = () => {
  const m = new Map();
  return {
    m,
    api: { open: async () => ({ match: async (u) => m.get(u), put: async (u, r) => { m.set(u, r); } }), match: async (u) => (u === "/index.html" ? {} : undefined) },
  };
};

describe("recolectarMedios", () => {
  it("separa imágenes propias, externas y videos, en cualquier parte de la estructura", () => {
    const m = recolectarMedios(
      [{ imageUrl: "https://abc.supabase.co/storage/v1/object/public/fondos/a.jpg", diapositivas: [{ imageUrl: "/fondos/b.png" }] }],
      { x: { y: "https://otro.com/foto.jpg", v: "https://abc.supabase.co/storage/v1/object/public/f/clip.mp4", yt: "https://youtu.be/xyz", data: "data:image/png;base64,AAA", texto: "Dios es bueno" } },
    );
    expect(m.imagenes.sort()).toEqual(["/fondos/b.png", "https://abc.supabase.co/storage/v1/object/public/fondos/a.jpg"]);
    expect(m.externas).toEqual(["https://otro.com/foto.jpg"]);
    expect(m.videos.sort()).toEqual(["https://abc.supabase.co/storage/v1/object/public/f/clip.mp4", "https://youtu.be/xyz"]);
  });
  it("no se cuelga con referencias circulares ni con texto normal", () => {
    const a = { t: "hola" }; a.yo = a;
    expect(recolectarMedios(a, null, undefined, 5)).toEqual({ imagenes: [], externas: [], videos: [] });
  });
});

describe("fuentesDeEventos / eventosProximos", () => {
  it("toma solo las canciones usadas por los eventos", () => {
    const f = fuentesDeEventos([{ serviceOrder: [{ songId: "s1" }, { type: "seccion" }] }], [{ id: "s1" }, { id: "s2" }]);
    expect(f.canciones).toEqual([{ id: "s1" }]);
  });
  it("ignora plantillas y eventos pasados", () => {
    const r = eventosProximos([{ id: 1 }, { id: 2, esPlantilla: true }, { id: 3, pasado: true }], (e) => !e.pasado);
    expect(r.map((e) => e.id)).toEqual([1]);
  });
});

// localStorage de mentira (el entorno de pruebas es Node); limite = caracteres máximos por valor.
function localStorageFalso(limite = Infinity) {
  const d = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (d.has(k) ? d.get(k) : null),
    setItem: (k, v) => { if (String(v).length > limite) throw new Error("QuotaExceededError"); d.set(k, String(v)); },
  });
}

describe("guardado en el equipo", () => {
  beforeEach(() => { localStorageFalso(); });
  it("verifica que lo guardado de verdad quedó", () => {
    expect(guardarYVerificar("eventos", [{ id: 1 }])).toBe(true);
    expect(JSON.parse(localStorage.getItem("worshipflow_cache_eventos")).data).toEqual([{ id: 1 }]);
  });
  it("si el cancionero completo no cabe, guarda las de los eventos próximos", () => {
    localStorageFalso(200);
    const todas = Array.from({ length: 50 }, (_, i) => ({ id: "c" + i, t: "x".repeat(20) }));
    const r = guardarCanciones(todas, [todas[0]]);
    expect(r).toEqual({ completo: false, guardadas: 1, total: 50 });
  });
  it("si todo cabe, guarda el cancionero completo", () => {
    expect(guardarCanciones([{ id: 1 }, { id: 2 }], [{ id: 1 }])).toEqual({ completo: true, guardadas: 2, total: 2 });
  });
});

describe("guardarImagenes", () => {
  it("guarda las nuevas, salta las que ya están y reporta las que fallan", async () => {
    const { m, api } = cacheFalsa();
    m.set("/ya.png", {});
    const fetchFn = async (u) => { if (u.includes("roto")) throw new Error("red"); return { ok: true, type: "cors" }; };
    const avance = [];
    const r = await guardarImagenes(["/ya.png", "/nueva.png", "/roto.png"], { cachesApi: api, fetchFn, onProgreso: (h, t) => avance.push([h, t]) });
    expect(r.guardadas).toBe(2);
    expect(r.fallidas).toEqual(["/roto.png"]);
    expect(m.has("/nueva.png")).toBe(true);
    expect(avance.at(-1)).toEqual([3, 3]);
  });
  it("sin lista no hace nada", async () => {
    expect(await guardarImagenes([])).toEqual({ guardadas: 0, fallidas: [] });
  });
});

describe("appGuardada", () => {
  it("true con service worker activo y copia de la app", async () => {
    const { api } = cacheFalsa();
    expect(await appGuardada({ nav: { serviceWorker: { getRegistration: async () => ({ active: {} }) } }, cachesApi: api })).toBe(true);
  });
  it("false si no hay service worker activo", async () => {
    const { api } = cacheFalsa();
    expect(await appGuardada({ nav: { serviceWorker: { getRegistration: async () => ({}) } }, cachesApi: api })).toBe(false);
    expect(await appGuardada({ nav: {}, cachesApi: api })).toBe(false);
  });
});
