import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock("../supabaseClient.js", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; }, send: () => Promise.resolve() }),
    removeChannel: () => {},
  },
}));
const { leerSesionPublica, obtenerCodigoPantalla } = await import("../liveSession.js");

beforeEach(() => { rpc.mockReset(); maybeSingle.mockReset(); });

describe("lectura de la sesión en vivo para pantallas sin sesión", () => {
  it("con código vigente devuelve lo que está al aire", async () => {
    rpc.mockResolvedValue({ data: { iglesia_id: "i", evento_id: "e", slide_actual: { title: "Hola" } }, error: null });
    const r = await leerSesionPublica("i", "abc");
    expect(rpc).toHaveBeenCalledWith("sesion_en_vivo_publica", { p_iglesia: "i", p_codigo: "abc" });
    expect(r.estado).toBe("ok");
    expect(r.fila.slide_actual.title).toBe("Hola");
    expect(r.fila.blanked).toBe(false);
  });
  it("con código vencido (o sin código) avisa que venció", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await leerSesionPublica("i", null)).estado).toBe("vencido");
  });
  it("si la base todavía no tiene la función, lee como siempre", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    maybeSingle.mockResolvedValue({ data: { iglesia_id: "i", evento_id: "e" }, error: null });
    const r = await leerSesionPublica("i", null);
    expect(r.estado).toBe("antiguo");
    expect(r.fila.evento_id).toBe("e");
  });
  it("un fallo de red se lanza (la pantalla sigue mostrando lo último)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "08006", message: "network" } });
    await expect(leerSesionPublica("i", "abc")).rejects.toBeTruthy();
  });
  it("el código de la consola es null si la base no lo tiene", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await obtenerCodigoPantalla()).toBeNull();
  });
});
