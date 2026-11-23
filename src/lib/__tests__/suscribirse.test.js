import { describe, it, expect, beforeEach } from "vitest";
import { destinoSuscribirse, puedeActivarBeneficio, textoBarraBeneficio, hoyLocal, barraCerradaHoy, cerrarBarraHoy, guardarPendiente, hayPendiente, olvidarPendiente, VIGENCIA_MS, leerSuscribirseDeUrl, enlacePagoBeneficio } from "../suscribirse.js";

const memoria = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
};
beforeEach(() => { globalThis.localStorage = memoria(); });

const ahora = new Date("2026-11-23T12:00:00Z").getTime();
const base = { soy_admin: true, iglesia_id: "11111111-2222-3333-4444-555555555555", tiene_suscripcion: false, beneficio: { grupo: "fase_1", activado_en: null, plazo_hasta: "2026-12-15T23:59:59Z" } };

describe("enlace ?suscribirse", () => {
  it("lee el parámetro", () => {
    expect(leerSuscribirseDeUrl("?suscribirse")).toBe(true);
    expect(leerSuscribirseDeUrl("?otra=1")).toBe(false);
  });
  it("con beneficio disponible y admin va al pago", () => {
    expect(destinoSuscribirse(base, ahora)).toBe("pago");
    expect(enlacePagoBeneficio(base, "a@b.co")).toContain("beneficio=1");
  });
  it("ya activado, vencido, sin grupo, con suscripción o no admin: Ajustes → Plan", () => {
    expect(destinoSuscribirse({ ...base, beneficio: { ...base.beneficio, activado_en: "2026-11-20T00:00:00Z" } }, ahora)).toBe("plan");
    expect(destinoSuscribirse({ ...base, beneficio: { ...base.beneficio, plazo_hasta: "2026-11-01T00:00:00Z" } }, ahora)).toBe("plan");
    expect(destinoSuscribirse({ ...base, beneficio: null }, ahora)).toBe("plan");
    expect(destinoSuscribirse({ ...base, tiene_suscripcion: true }, ahora)).toBe("plan");
    expect(destinoSuscribirse({ ...base, soy_admin: false }, ahora)).toBe("plan");
    expect(destinoSuscribirse(null, ahora)).toBe("plan");
  });
  it("el pedido guardado vence a las 2 horas y se puede olvidar", () => {
    guardarPendiente(ahora);
    expect(hayPendiente(ahora + 60_000)).toBe(true);
    expect(hayPendiente(ahora + VIGENCIA_MS + 1)).toBe(false);
    olvidarPendiente();
    expect(hayPendiente(ahora + 60_000)).toBe(false);
  });
});

describe("barra del beneficio", () => {
  it("texto con meses y fecha", () => {
    const t = textoBarraBeneficio(base.beneficio);
    expect(t).toMatch(/^Activa tu beneficio de 6 meses gratis \(hasta .*2026\)$/);
    expect(textoBarraBeneficio({ grupo: "lista_espera" })).toBe("Activa tu beneficio de 1 mes gratis");
  });
  it("cerrada hoy, vuelve mañana", () => {
    const hoy = new Date(2026, 10, 23, 10);
    const manana = new Date(2026, 10, 24, 8);
    expect(barraCerradaHoy(base.iglesia_id, hoy)).toBe(false);
    cerrarBarraHoy(base.iglesia_id, hoy);
    expect(barraCerradaHoy(base.iglesia_id, new Date(2026, 10, 23, 22))).toBe(true);
    expect(barraCerradaHoy(base.iglesia_id, manana)).toBe(false);
    expect(hoyLocal(hoy)).toBe("2026-11-23");
  });
  it("solo para quien puede activarlo", () => {
    expect(puedeActivarBeneficio(base, ahora)).toBe(true);
    expect(puedeActivarBeneficio({ ...base, soy_admin: false }, ahora)).toBe(false);
  });
});
