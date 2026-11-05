import { describe, it, expect } from "vitest";
import { estadoSalud, alertasIglesia, pasosArranque, haceCuanto, ultimaActividad, prioridadAtencion } from "../saludIglesia.js";

const AHORA = new Date("2026-11-05T12:00:00Z").getTime();
const hace = (dias) => new Date(AHORA - dias * 86400000).toISOString();
const base = { activa: true, creada: hace(60), usuarios: 6, canciones: 40, canciones_propias: 35, eventos: 8, eventos_proximos: 2, ministerios: 3, nunca_entraron: 0 };

describe("salud de cada iglesia", () => {
  it("dice hace cuánto", () => {
    expect(haceCuanto(null, AHORA)).toBe("nunca");
    expect(haceCuanto(hace(0), AHORA)).toBe("hoy");
    expect(haceCuanto(hace(1), AHORA)).toBe("ayer");
    expect(haceCuanto(hace(5), AHORA)).toBe("hace 5 días");
    expect(haceCuanto(hace(21), AHORA)).toBe("hace 3 semanas");
    expect(haceCuanto(hace(90), AHORA)).toBe("hace 3 meses");
  });

  it("la última actividad es lo más reciente entre entrar, canciones, eventos y transmisiones", () => {
    expect(ultimaActividad({ ultimo_ingreso: hace(9), ultima_cancion: hace(2), ultima_transmision: hace(4) })).toBe(hace(2));
    expect(ultimaActividad({})).toBeNull();
  });

  it("activa, bajando, sin uso, nueva y pausada", () => {
    expect(estadoSalud({ ...base, ultimo_ingreso: hace(2) }, AHORA)).toBe("activa");
    expect(estadoSalud({ ...base, ultimo_ingreso: hace(12) }, AHORA)).toBe("bajando");
    expect(estadoSalud({ ...base, ultimo_ingreso: hace(40) }, AHORA)).toBe("dormida");
    expect(estadoSalud({ ...base }, AHORA)).toBe("dormida");
    expect(estadoSalud({ ...base, creada: hace(3), eventos: 0, canciones_propias: 0, ultimo_ingreso: hace(3) }, AHORA)).toBe("nueva");
    expect(estadoSalud({ ...base, activa: false, ultimo_ingreso: hace(1) }, AHORA)).toBe("pausada");
  });

  it("avisa lo que hay que revisar", () => {
    const sinUso = alertasIglesia({ ...base, usuarios: 1, eventos_proximos: 0, canciones_propias: 0 }, AHORA).map((a) => a.texto);
    expect(sinUso).toEqual(expect.arrayContaining(["Nadie ha entrado nunca", "No tiene eventos próximos", "Solo tiene 1 usuario: no ha invitado a su equipo", "No ha agregado canciones propias"]));
    expect(alertasIglesia({ ...base, ultimo_ingreso: hace(1) }, AHORA)).toEqual([]);
    expect(alertasIglesia({ ...base, ultimo_ingreso: hace(1), nunca_entraron: 2 }, AHORA)[0].texto).toBe("2 personas invitadas no han entrado");
    // Una iglesia recién creada no se alarma por no tener eventos todavía.
    expect(alertasIglesia({ ...base, creada: hace(2), ultimo_ingreso: hace(0), eventos_proximos: 0, usuarios: 1, canciones_propias: 0 }, AHORA)).toEqual([]);
  });

  it("primeros pasos de una iglesia fundadora", () => {
    const pasos = pasosArranque({ canciones_propias: 0, usuarios: 1, ministerios: 0, eventos: 1, eventos_proximos: 0, ultima_transmision: null });
    expect(pasos.filter((p) => p.hecho).map((p) => p.clave)).toEqual(["evento"]);
  });

  it("las que necesitan más atención van primero", () => {
    const dormida = { ...base, ultimo_ingreso: hace(40), eventos_proximos: 0 };
    const bajando = { ...base, ultimo_ingreso: hace(12) };
    expect(prioridadAtencion(dormida, AHORA)).toBeLessThan(prioridadAtencion(bajando, AHORA));
  });
});
