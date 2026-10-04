import { describe, expect, it, vi, beforeEach } from "vitest";

// notificaciones.js importa "../supabaseClient.js" directo, que en el archivo real crea un cliente de
// Supabase de verdad con import.meta.env.VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY -- sin esas
// variables (ej. una máquina sin el .env local, o CI) createClient(undefined, undefined) lanza un error
// al cargar el módulo, y decidirAccionPush ni siquiera llega a probarse. Es pura (sin red, sin DOM),
// así que no necesita una base simulada como fakeSupabase.js -- solo evitar que se cargue el cliente
// real, mismo patrón (vi.resetModules + vi.doMock + import dinámico) que eventos.test.js.
let decidirAccionPush;

beforeEach(async () => {
  vi.resetModules();
  vi.doMock("../supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
  ({ decidirAccionPush } = await import("../notificaciones.js"));
});

describe("decidirAccionPush", () => {
  it("si ya tiene alguna suscripción, no hace nada (sin importar el permiso)", () => {
    expect(decidirAccionPush({ tieneSuscripcion: true, permiso: "granted" })).toBe("nada");
    expect(decidirAccionPush({ tieneSuscripcion: true, permiso: "default" })).toBe("nada");
    expect(decidirAccionPush({ tieneSuscripcion: true, permiso: "denied" })).toBe("nada");
  });

  it("si el navegador no soporta push, no hace nada aunque no tenga suscripción", () => {
    expect(decidirAccionPush({ tieneSuscripcion: false, permiso: "sin-soporte" })).toBe("nada");
  });

  it("sin suscripción pero con permiso YA concedido (se perdió por reinstalar/cambiar de teléfono): reinscribe en silencio", () => {
    expect(decidirAccionPush({ tieneSuscripcion: false, permiso: "granted" })).toBe("reinscribir-en-silencio");
  });

  it("sin suscripción y sin haber preguntado nunca: muestra el aviso", () => {
    expect(decidirAccionPush({ tieneSuscripcion: false, permiso: "default" })).toBe("mostrar-aviso");
  });

  it("sin suscripción y bloqueado por el navegador: muestra el aviso (con instrucciones de desbloqueo)", () => {
    expect(decidirAccionPush({ tieneSuscripcion: false, permiso: "denied" })).toBe("mostrar-aviso");
  });
});
