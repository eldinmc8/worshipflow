import { describe, expect, it, vi, beforeEach } from "vitest";

const upsert = vi.fn();
const refreshSession = vi.fn();
vi.mock("../supabaseClient.js", () => ({
  supabase: {
    from: () => ({ upsert: (...a) => upsert(...a) }),
    auth: { refreshSession: () => refreshSession() },
    channel: () => ({ on() { return this; }, subscribe() { return this; }, send: () => Promise.resolve() }),
    removeChannel: () => {},
  },
}));
const { updateLiveSession } = await import("../liveSession.js");

const rls = { code: "42501", message: 'new row violates row-level security policy for table "sesiones_en_vivo"' };
beforeEach(() => { upsert.mockReset(); refreshSession.mockReset(); });

describe("actualizar la proyección con la sesión vencida", () => {
  it("renueva la sesión y reintenta una vez", async () => {
    upsert.mockResolvedValueOnce({ error: rls }).mockResolvedValueOnce({ error: null });
    refreshSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    await updateLiveSession("i", { evento_id: "e" });
    expect(upsert).toHaveBeenCalledTimes(2);
  });
  it("si no puede renovarla, avisa que queda pendiente (no es un error de permisos)", async () => {
    upsert.mockResolvedValue({ error: rls });
    refreshSession.mockRejectedValue(new Error("Failed to fetch"));
    await expect(updateLiveSession("i", {})).rejects.toMatchObject({ sinSesion: true });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it("con sesión válida y aún rechazado, es un error real", async () => {
    upsert.mockResolvedValue({ error: rls });
    refreshSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    const e = await updateLiveSession("i", {}).catch((x) => x);
    expect(e.sinSesion).toBeUndefined();
    expect(e.code).toBe("42501");
  });
  it("otros errores no tocan la sesión", async () => {
    upsert.mockResolvedValue({ error: { code: "23503", message: "fk" } });
    await expect(updateLiveSession("i", {})).rejects.toMatchObject({ code: "23503" });
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
