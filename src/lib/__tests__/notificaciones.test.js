import { describe, expect, it } from "vitest";
import { decidirAccionPush } from "../notificaciones.js";

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
