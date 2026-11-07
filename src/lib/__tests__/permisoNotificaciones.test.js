// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
const { suscribirPush, esRechazoDeNotificaciones } = await import("../notificaciones.js");

// Alerta de Sentry del 2026-11-07: un admin tocó "Bloquear" al pedir permiso de notificaciones y eso
// llegó como error de la app. No dar permiso no es una falla: se marca para explicarlo y no reportarlo.
describe("permiso de notificaciones rechazado", () => {
  afterEach(() => { vi.unstubAllGlobals(); delete navigator.serviceWorker; delete window.PushManager; });

  it("si la persona no da permiso, el error queda marcado como esperado", async () => {
    Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
    window.PushManager = function PushManager() {};
    vi.stubGlobal("Notification", { requestPermission: () => Promise.resolve("denied") });
    const err = await suscribirPush("u1").catch((e) => e);
    expect(err.codigo).toBe("permiso-denegado");
    expect(esRechazoDeNotificaciones(err)).toBe(true);
  });

  it("un navegador sin push también es esperado; un error cualquiera no", async () => {
    const err = await suscribirPush("u1").catch((e) => e);
    expect(err.codigo).toBe("sin-soporte");
    expect(esRechazoDeNotificaciones(err)).toBe(true);
    expect(esRechazoDeNotificaciones(new Error("fallo real"))).toBe(false);
  });
});
