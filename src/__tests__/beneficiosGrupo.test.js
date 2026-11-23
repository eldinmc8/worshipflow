import { describe, it, expect, vi } from "vitest";
import { BENEFICIOS as FRONT, estadoBeneficio, resumenBeneficio, enlaceProrroga } from "../lib/beneficios.js";
import { opcionesCheckout, consultarBeneficio, leerPedidoPago, enlacePago } from "../lib/paddle.js";
import { BENEFICIOS as WEBHOOK, cambiosPorBeneficio, fechasBeneficio, sumarMeses, esSuscripcionDelBeneficio } from "../../supabase/functions/paddle-webhook/beneficio.ts";
import { cambiosPorSuscripcion } from "../../supabase/functions/paddle-webhook/logica.ts";

// Beneficios de lanzamiento por grupo (2026-11-23).
const IGLESIA = "3f2b6c1e-8d4a-4b9e-9f1a-2c3d4e5f6a7b";
const CUANDO = "2026-12-01T15:00:00.000Z";

describe("ids de Paddle por grupo", () => {
  it("la app y el webhook usan los mismos precios, descuentos y meses", () => {
    for (const g of ["fase_1", "fase_2", "lista_espera"]) {
      expect(WEBHOOK[g]).toEqual({ precio: FRONT[g].precio, descuento: FRONT[g].descuento, mesesGratis: FRONT[g].mesesGratis, mesesPrecio: FRONT[g].mesesPrecio });
    }
    expect(FRONT.fase_1).toMatchObject({ precio: "pri_01m8550jkvw6knwnp44jb444x2", descuento: "dsc_01m855casnfv0hsnf33bmt7tdd" });
    expect(FRONT.fase_2).toMatchObject({ precio: "pri_01m85528sbaq8syzzk1t6nb314", descuento: "dsc_01m855jk1be461vfk333b0qa6w" });
    expect(FRONT.lista_espera).toMatchObject({ precio: "pri_01m7pbervbwqyafheyppmyn6pk", descuento: "dsc_01m855mkdcshmcac7k2nwt0bj8" });
  });
});

describe("checkout de /web/pagar", () => {
  const pedido = leerPedidoPago(`?plan=crecimiento&periodo=mensual&iglesia=${IGLESIA}&correo=a@b.org`);
  it("con grupo: precio y descuento del grupo con discountId (sin código) y la marca del beneficio", () => {
    const o = opcionesCheckout(pedido, "fase_2");
    expect(o.items).toEqual([{ priceId: FRONT.fase_2.precio, quantity: 1 }]);
    expect(o.discountId).toBe(FRONT.fase_2.descuento);
    expect(o.discountCode).toBeUndefined();
    expect(o.customData).toEqual({ iglesia_id: IGLESIA, beneficio: "fase_2" });
  });
  it("sin grupo: el pago de siempre, sin descuento", () => {
    const o = opcionesCheckout(pedido, null);
    expect(o.items[0].priceId).toBe(pedido.precio);
    expect(o.discountId).toBeUndefined();
    expect(o.customData).toEqual({ iglesia_id: IGLESIA });
  });
  it("el enlace de 'Activar mi beneficio' lleva la marca", () => {
    const url = enlacePago({ beneficio: true, iglesiaId: IGLESIA, correo: "a@b.org" });
    expect(leerPedidoPago(new URL(url).search)).toMatchObject({ plan: "iglesia", periodo: "mensual", beneficio: true });
  });
  it("pregunta el grupo a la base; si falla o no aplica, null (pago normal)", async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve("fase_1") });
    expect(await consultarBeneficio(IGLESIA, { fetchFn: ok, url: "https://x.supabase.co", llave: "pk" })).toBe("fase_1");
    expect(ok.mock.calls[0][0]).toBe("https://x.supabase.co/rest/v1/rpc/beneficio_para_pago");
    expect(JSON.parse(ok.mock.calls[0][1].body)).toEqual({ p_iglesia: IGLESIA });
    const nulo = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });
    expect(await consultarBeneficio(IGLESIA, { fetchFn: nulo, url: "u", llave: "k" })).toBeNull();
    const roto = vi.fn().mockRejectedValue(new Error("sin red"));
    expect(await consultarBeneficio(IGLESIA, { fetchFn: roto, url: "u", llave: "k" })).toBeNull();
    const sinMigracion = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    expect(await consultarBeneficio(IGLESIA, { fetchFn: sinMigracion, url: "u", llave: "k" })).toBeNull();
  });
});

describe("fechas del beneficio", () => {
  it("fase 1: 6 meses gratis y precio especial sin fin", () => {
    expect(fechasBeneficio("fase_1", CUANDO)).toEqual({ beneficio_activado_en: CUANDO, beneficio_gratis_hasta: "2027-06-01T15:00:00.000Z", beneficio_precio_hasta: null });
  });
  it("fase 2: 3 meses gratis y 6 más con precio especial", () => {
    expect(fechasBeneficio("fase_2", CUANDO)).toMatchObject({ beneficio_gratis_hasta: "2027-03-01T15:00:00.000Z", beneficio_precio_hasta: "2027-09-01T15:00:00.000Z" });
  });
  it("lista de espera: 1 mes gratis y 3 más con precio especial", () => {
    expect(fechasBeneficio("lista_espera", CUANDO)).toMatchObject({ beneficio_gratis_hasta: "2027-01-01T15:00:00.000Z", beneficio_precio_hasta: "2027-04-01T15:00:00.000Z" });
  });
  it("suma meses de calendario sin saltarse febrero", () => {
    expect(sumarMeses("2027-01-31T00:00:00Z", 1)).toBe("2027-02-28T00:00:00.000Z");
  });
});

const sub = (extra = {}) => ({
  id: "sub_b", customer_id: "ctm_1", status: "trialing",
  items: [{ price: { id: FRONT.fase_1.precio, billing_cycle: { interval: "month" } } }],
  current_billing_period: { starts_at: CUANDO, ends_at: "2027-06-01T15:00:00Z" },
  discount: { id: FRONT.fase_1.descuento },
  custom_data: { iglesia_id: IGLESIA, beneficio: "fase_1" },
  ...extra,
});
const iglesia = (extra = {}) => ({ grupo_beneficio: "fase_1", beneficio_activado_en: null, beneficio_plazo_hasta: "2026-12-15T00:00:00Z", ...extra });

describe("webhook: activar el beneficio", () => {
  it("suscripción creada o activada de una iglesia con grupo: guarda la activación y las fechas", () => {
    expect(cambiosPorBeneficio(iglesia(), "subscription.created", sub(), CUANDO)).toMatchObject({ beneficio_activado_en: CUANDO, beneficio_gratis_hasta: "2027-06-01T15:00:00.000Z", beneficio_precio_hasta: null });
    expect(cambiosPorBeneficio(iglesia(), "subscription.activated", sub({ status: "active" }), CUANDO)).not.toBeNull();
  });
  it("plan Iglesia mientras está en prueba o activa (precio del grupo)", () => {
    expect(cambiosPorSuscripcion(sub())).toMatchObject({ plan: "iglesia", plan_periodo: "mensual", en_prueba: true });
    expect(cambiosPorSuscripcion(sub({ status: "active", items: [{ price: { id: FRONT.fase_2.precio, billing_cycle: { interval: "month" } } }] }))).toMatchObject({ plan: "iglesia" });
  });
  it("una sola vez: si ya estaba activado, no se vuelve a activar", () => {
    expect(cambiosPorBeneficio(iglesia({ beneficio_activado_en: "2026-11-01T00:00:00Z" }), "subscription.created", sub(), CUANDO)).toBeNull();
  });
  it("sin grupo o con una suscripción normal: no toca el beneficio", () => {
    expect(cambiosPorBeneficio(iglesia({ grupo_beneficio: null }), "subscription.created", sub(), CUANDO)).toBeNull();
    expect(cambiosPorBeneficio(null, "subscription.created", sub(), CUANDO)).toBeNull();
    const normal = sub({ items: [{ price: { id: "pri_01m7p57kacjcsmn0db54164mr6" } }], discount: null, custom_data: { iglesia_id: IGLESIA } });
    expect(cambiosPorBeneficio(iglesia(), "subscription.created", normal, CUANDO)).toBeNull();
  });
  it("lista de espera: el precio es el mismo de la prueba normal, así que solo cuenta con su descuento o la marca", () => {
    const precio = { items: [{ price: { id: FRONT.lista_espera.precio } }] };
    expect(esSuscripcionDelBeneficio({ ...precio }, "lista_espera")).toBe(false);
    expect(esSuscripcionDelBeneficio({ ...precio, discount: { id: FRONT.lista_espera.descuento } }, "lista_espera")).toBe(true);
    expect(esSuscripcionDelBeneficio({ ...precio, custom_data: { beneficio: "lista_espera" } }, "lista_espera")).toBe(true);
  });
});

describe("webhook: cancelación o pago fallido", () => {
  const activada = iglesia({ beneficio_activado_en: "2026-11-01T00:00:00Z" });
  it("cancelada: Gratis desde ese momento", () => {
    expect(cambiosPorBeneficio(activada, "subscription.canceled", sub({ status: "canceled", canceled_at: CUANDO }), CUANDO)).toEqual({ plan_vence: CUANDO, en_prueba: false });
  });
  it("pago fallido (past_due): Gratis ya, sin días de gracia", () => {
    expect(cambiosPorBeneficio(activada, "subscription.past_due", sub({ status: "past_due" }), CUANDO)).toEqual({ plan_vence: CUANDO, en_prueba: false });
  });
  it("activa normal: nada extra", () => {
    expect(cambiosPorBeneficio(activada, "subscription.updated", sub({ status: "active" }), CUANDO)).toBeNull();
  });
});

describe("estado del beneficio en la app", () => {
  const ahora = new Date("2026-12-01T00:00:00Z").getTime();
  it("ninguno, disponible, vencido o activo", () => {
    expect(estadoBeneficio(null, ahora)).toBe("ninguno");
    expect(estadoBeneficio({ grupo: "fase_1", plazo_hasta: "2026-12-15T00:00:00Z" }, ahora)).toBe("disponible");
    expect(estadoBeneficio({ grupo: "fase_1", plazo_hasta: "2026-11-15T00:00:00Z" }, ahora)).toBe("vencido");
    expect(estadoBeneficio({ grupo: "fase_1", plazo_hasta: "2026-11-15T00:00:00Z", activado_en: "2026-11-10T00:00:00Z" }, ahora)).toBe("activo");
  });
  it("textos y WhatsApp de prórroga", () => {
    expect(resumenBeneficio("fase_1")).toContain("para siempre");
    expect(resumenBeneficio("fase_2")).toBe("3 meses gratis del plan Iglesia y después 6 meses con precio especial");
    expect(enlaceProrroga("Iglesia Demo")).toMatch(/^https:\/\/wa\.me\/50239816407\?text=/);
  });
});
