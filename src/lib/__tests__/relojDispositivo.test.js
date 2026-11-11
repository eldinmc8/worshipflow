import { describe, expect, it } from "vitest";
import { desfaseDeReloj, relojMal, describirDesfase } from "../relojDispositivo.js";

// Llave de mentira con el iat que se quiera (solo importa el payload).
const llave = (iat) => {
  const b64 = btoa(JSON.stringify({ sub: "u1", iat, exp: iat + 3600 })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { access_token: `x.${b64}.y` };
};
const IAT = 1794430000;

describe("reloj de la computadora corrido", () => {
  it("compara la hora local con la hora en que el servidor emitió la llave", () => {
    expect(desfaseDeReloj(llave(IAT), IAT * 1000 + 2000)).toBe(2);
    expect(desfaseDeReloj(llave(IAT), (IAT + 2 * 3600) * 1000)).toBe(7200);
    expect(desfaseDeReloj(llave(IAT), (IAT - 86400) * 1000)).toBe(-86400);
  });
  it("sin llave o con una llave rara, no se sabe (null) y no se marca como mal", () => {
    expect(desfaseDeReloj(null)).toBeNull();
    expect(desfaseDeReloj({ access_token: "no-es-jwt" })).toBeNull();
    expect(relojMal(null)).toBe(false);
  });
  it("unos minutos de diferencia está bien; más de media hora, en cualquier dirección, no", () => {
    expect(relojMal(120)).toBe(false);
    expect(relojMal(-20 * 60)).toBe(false);
    expect(relojMal(31 * 60)).toBe(true);
    expect(relojMal(-2 * 3600)).toBe(true);
  });
  it("lo explica en palabras", () => {
    expect(describirDesfase(7200)).toBe("2 horas adelantada");
    expect(describirDesfase(-3600)).toBe("1 hora atrasada");
    expect(describirDesfase(40 * 60)).toBe("40 minutos adelantada");
    expect(describirDesfase(86400 * 365)).toBe("365 días adelantada");
  });
});
