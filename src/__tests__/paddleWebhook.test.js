import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { firmaValida, cambiosPorSuscripcion, precios } from "../../supabase/functions/paddle-webhook/logica.ts";

// Avisos de Paddle (2026-11-13): sin firma válida no se toca nada, y cada estado cambia el plan como toca.
const SECRETO = "pdl_ntfset_prueba_secreto";
const firmar = (cuerpo, ts) => `ts=${ts};h1=${createHmac("sha256", SECRETO).update(`${ts}:${cuerpo}`).digest("hex")}`;

describe("firma de Paddle", () => {
  const cuerpo = '{"event_type":"subscription.created"}';
  const ahora = 1794600000;
  it("acepta la firma correcta", async () => {
    expect(await firmaValida(firmar(cuerpo, ahora), cuerpo, SECRETO, ahora)).toBe(true);
  });
  it("rechaza cuerpo cambiado, secreto equivocado, sin cabecera o firma vieja", async () => {
    expect(await firmaValida(firmar(cuerpo, ahora), cuerpo + " ", SECRETO, ahora)).toBe(false);
    expect(await firmaValida(firmar(cuerpo, ahora), cuerpo, "otro", ahora)).toBe(false);
    expect(await firmaValida(null, cuerpo, SECRETO, ahora)).toBe(false);
    expect(await firmaValida(firmar(cuerpo, ahora - 3600), cuerpo, SECRETO, ahora)).toBe(false);
  });
});

const sub = (extra = {}) => ({
  id: "sub_1", customer_id: "ctm_1", status: "active",
  items: [{ price: { id: "pri_01m7b828dt7zexxkyg8getyr7e", billing_cycle: { interval: "month" } } }],
  current_billing_period: { starts_at: "2026-11-13T00:00:00Z", ends_at: "2026-12-13T00:00:00Z" },
  ...extra,
});

describe("cambios del plan según la suscripción", () => {
  it("activa: sube al plan del precio, quita la prueba y vence al fin del periodo + 3 días", () => {
    expect(cambiosPorSuscripcion(sub())).toMatchObject({
      plan: "crecimiento", plan_periodo: "mensual", en_prueba: false,
      plan_vence: "2026-12-16T00:00:00.000Z", paddle_suscripcion_id: "sub_1", cliente_pago_id: "ctm_1", pago_estado: "active",
    });
  });
  it("los seis precios de prueba están mapeados a su plan y periodo", () => {
    const mapa = precios();
    expect(Object.values(mapa).map((p) => `${p.plan}-${p.periodo}`).sort()).toEqual([
      "crecimiento-anual", "crecimiento-mensual", "iglesia-anual", "iglesia-mensual", "ministerio-anual", "ministerio-mensual",
    ]);
  });
  it("precio desconocido: usa el plan del producto; si no hay plan válido, no cambia nada", () => {
    const otro = { price: { id: "pri_x", billing_cycle: { interval: "year" } }, product: { custom_data: { plan: "iglesia" } } };
    expect(cambiosPorSuscripcion(sub({ items: [otro] }))).toMatchObject({ plan: "iglesia", plan_periodo: "anual" });
    expect(cambiosPorSuscripcion(sub({ items: [{ price: { id: "pri_x" } }] }))).toBeNull();
  });
  it("cancelación programada: sigue activa pero marca que se cancela al final", () => {
    expect(cambiosPorSuscripcion(sub({ scheduled_change: { action: "cancel" } })).pago_estado).toBe("cancela_al_final");
  });
  it("cancelada o pausada: vence en ese momento; atrasada: no cambia la fecha", () => {
    expect(cambiosPorSuscripcion(sub({ status: "canceled", canceled_at: "2026-12-13T00:00:00Z" }))).toMatchObject({ plan_vence: "2026-12-13T00:00:00Z" });
    expect(cambiosPorSuscripcion(sub({ status: "paused", paused_at: "2026-12-01T00:00:00Z" }))).toMatchObject({ plan_vence: "2026-12-01T00:00:00Z" });
    const atrasada = cambiosPorSuscripcion(sub({ status: "past_due" }));
    expect(atrasada.pago_estado).toBe("past_due");
    expect(atrasada).not.toHaveProperty("plan_vence");
  });
  it("PADDLE_PRECIOS agrega los precios del modo real", () => {
    expect(precios('{"pri_live":{"plan":"ministerio","periodo":"anual"}}').pri_live.plan).toBe("ministerio");
    expect(precios("no es json").pri_live).toBeUndefined();
  });
});
