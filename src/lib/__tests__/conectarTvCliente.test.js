import { describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../supabaseClient.js", () => ({ supabase: { rpc: (...a) => rpc(...a) } }));
const { tokenDelTv, vincularTv, direccionDeTvConectado, direccionTv } = await import("../conectarTv.js");

const almacen = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe("conectar TV (app)", () => {
  it("el TV guarda y reutiliza su token secreto", () => {
    const a = almacen();
    const t = tokenDelTv(a);
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(tokenDelTv(a)).toBe(t);
  });
  it("la dirección del TV conectado lleva el código y ?tv=1", () => {
    expect(direccionDeTvConectado({ tipo: "proyeccion", slug: "buen-pastor", codigo: "abc123def456" }, "https://x.app")).toBe("https://x.app/p/buen-pastor/abc123def456?tv=1");
    expect(direccionDeTvConectado({ tipo: "escenario", slug: "buen-pastor", codigo: "abc" }, "https://x.app")).toBe("https://x.app/e/buen-pastor/abc?tv=1");
    expect(direccionTv("https://x.app")).toBe("https://x.app/tv");
  });
  it("valida el número y traduce los errores", async () => {
    await expect(vincularTv("12 34", "proyeccion")).rejects.toThrow(/6 números/);
    rpc.mockResolvedValueOnce({ error: null });
    await expect(vincularTv("123 456", "escenario")).resolves.toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("tv_vincular", { p_codigo: "123456", p_tipo: "escenario" });
    rpc.mockResolvedValueOnce({ error: { code: "P0002" } });
    await expect(vincularTv("123456", "proyeccion")).rejects.toThrow(/no existe o ya venció/);
    rpc.mockResolvedValueOnce({ error: { code: "42501" } });
    await expect(vincularTv("123456", "proyeccion")).rejects.toThrow(/Solo Multimedia/);
  });
});
