import { describe, it, expect } from "vitest";
import {
  normalizarCuenta, horaDelEvento, cuentaPorMinutos, segundosRestantes, textoCuenta, digitosCuenta,
  slideCuentaRegresiva, conHoraFinal, arrancarSiHaceFalta, slideCuentaAlMomento, progresoCuenta, itemCuentaRegresiva, esCuentaRegresiva,
} from "../cuentaRegresiva.js";

const AHORA = new Date("2026-11-08T09:50:00").getTime();
const EVENTO = { date: "2026-11-08", hora: "10:00:00" };

describe("cuenta regresiva", () => {
  it("normaliza la configuración con valores por defecto", () => {
    const c = normalizarCuenta({ minutos: "abc", modo: "raro", alTerminar: "x", mostrarTexto: false });
    expect(c).toMatchObject({ minutos: 5, modo: "hora", alTerminar: "mensaje", mostrarTexto: false, estilo: "clasico", fondo: "propio" });
    expect(normalizarCuenta(null).mostrarTexto).toBe(true);
  });

  it("formatea el tiempo", () => {
    expect(textoCuenta(65)).toBe("01:05");
    expect(textoCuenta(3723)).toBe("1:02:03");
    expect(textoCuenta(0)).toBe("00:00");
    expect(digitosCuenta(605)).toEqual(["10", "05"]);
    expect(segundosRestantes(AHORA + 1500, AHORA)).toBe(2);
    expect(segundosRestantes(AHORA - 5000, AHORA)).toBe(0);
    expect(segundosRestantes(null, AHORA)).toBeNull();
  });

  it("hasta la hora del culto usa la fecha y hora del evento", () => {
    expect(horaDelEvento(EVENTO)).toBe(new Date("2026-11-08T10:00:00").getTime());
    expect(horaDelEvento({ date: "2026-11-08", hora: "10:00" })).toBe(new Date("2026-11-08T10:00:00").getTime());
    const s = conHoraFinal(slideCuentaRegresiva(itemCuentaRegresiva("c1", { modo: "hora" })), { evento: EVENTO, ahora: AHORA });
    expect(s.cuenta.hasta).toBe(horaDelEvento(EVENTO));
    expect(s.cuenta.total).toBe(600);
  });

  it("sin hora en el evento, cuenta los minutos", () => {
    expect(cuentaPorMinutos({ modo: "hora" }, { date: "2026-11-08" })).toBe(true);
    expect(cuentaPorMinutos({ modo: "hora" }, EVENTO)).toBe(false);
  });

  it("por minutos: arranca al ponerse al aire y sigue si ya iba", () => {
    const slide = slideCuentaRegresiva(itemCuentaRegresiva("c2", { modo: "minutos", minutos: 3 }));
    let horas = arrancarSiHaceFalta({}, slide, EVENTO, AHORA);
    expect(horas.c2).toBe(AHORA + 180000);
    // Un minuto después sigue igual (no vuelve a empezar).
    expect(arrancarSiHaceFalta(horas, slide, EVENTO, AHORA + 60000)).toBe(horas);
    // Ya terminada: al volver a ponerla, empieza de nuevo.
    horas = arrancarSiHaceFalta(horas, slide, EVENTO, AHORA + 200000);
    expect(horas.c2).toBe(AHORA + 200000 + 180000);
    const conHora = conHoraFinal(slide, { evento: EVENTO, horasFinales: horas });
    expect(conHora.cuenta).toMatchObject({ hasta: AHORA + 380000, total: 180 });
  });

  it("al momento desde la consola ya trae su hora final", () => {
    const s = slideCuentaAlMomento({ modo: "minutos", minutos: 10 }, EVENTO, AHORA);
    expect(s.cuenta.hasta).toBe(AHORA + 600000);
    expect(progresoCuenta(s.cuenta, 300)).toBeCloseTo(0.5);
  });

  it("reconoce el elemento del Setlist", () => {
    expect(esCuentaRegresiva(itemCuentaRegresiva("x", {}))).toBe(true);
    expect(esCuentaRegresiva({ type: "slide", title: "Hola" })).toBe(false);
  });
});
