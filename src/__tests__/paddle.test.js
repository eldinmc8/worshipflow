import { describe, it, expect } from "vitest";
import { enlacePago, leerPedidoPago, entornoPaddle, pagosConfigurados, precioPaddle, URL_PAGO } from "../lib/paddle.js";

// Pago con Paddle (2026-11-13): el enlace de la app lleva a worshipflowapp.com/web/pagar con datos válidos.
const IGLESIA = "3f2b6c1e-8d4a-4b9e-9f1a-2c3d4e5f6a7b";

describe("enlace de pago", () => {
  it("siempre apunta al dominio público aprobado, con plan, periodo, iglesia y correo", () => {
    const url = enlacePago({ plan: "crecimiento", anual: true, iglesiaId: IGLESIA, correo: "pastor@iglesia.org" });
    expect(url.startsWith(`${URL_PAGO}?`)).toBe(true);
    expect(leerPedidoPago(new URL(url).search)).toEqual({
      plan: "crecimiento", periodo: "anual", iglesia: IGLESIA, precio: precioPaddle("crecimiento", "anual"), correo: "pastor@iglesia.org",
    });
  });
  it("rechaza plan, periodo o iglesia inválidos, y descarta un correo mal escrito", () => {
    expect(leerPedidoPago(`?plan=gratis&periodo=mensual&iglesia=${IGLESIA}`)).toBeNull();
    expect(leerPedidoPago(`?plan=iglesia&periodo=semanal&iglesia=${IGLESIA}`)).toBeNull();
    expect(leerPedidoPago("?plan=iglesia&periodo=mensual&iglesia=abc")).toBeNull();
    expect(leerPedidoPago(`?plan=iglesia&periodo=mensual&iglesia=${IGLESIA}&correo=nope`).correo).toBe("");
  });
  it("los seis precios existen y son distintos", () => {
    const todos = ["ministerio", "crecimiento", "iglesia"].flatMap((p) => [precioPaddle(p, "mensual"), precioPaddle(p, "anual")]);
    expect(todos.every((x) => x?.startsWith("pri_"))).toBe(true);
    expect(new Set(todos).size).toBe(6);
  });
});

describe("entorno de Paddle según el token", () => {
  it("test_ es sandbox, live_ es real, vacío no está configurado", () => {
    expect(entornoPaddle("test_abc")).toBe("sandbox");
    expect(entornoPaddle("live_abc")).toBe("production");
    expect(pagosConfigurados("")).toBe(false);
    expect(pagosConfigurados("test_abc")).toBe(true);
  });
});
