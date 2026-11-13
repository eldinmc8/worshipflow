import { describe, expect, it } from "vitest";
import { esteEquipoLleva } from "../equipo.js";

// Qué equipo lleva la transmisión (2026-11-13): el administrador transmitía desde la computadora y en su
// celular (misma cuenta) no le salía el control remoto, porque la app creía que el celular también la llevaba.
describe("qué equipo lleva la transmisión", () => {
  const base = { userId: "eldin", liveOwnerId: "eldin", miEquipo: "celular" };
  it("la computadora que transmite (su equipo está en la sesión) la lleva; el celular de la misma persona no", () => {
    expect(esteEquipoLleva({ ...base, equipoEnVivo: "pc", miEquipo: "pc", isCompact: false })).toBe(true);
    expect(esteEquipoLleva({ ...base, equipoEnVivo: "pc", miEquipo: "celular", isCompact: true })).toBe(false);
  });
  it("otra computadora de la misma persona tampoco (queda como control, hasta que tome la transmisión)", () => {
    expect(esteEquipoLleva({ ...base, equipoEnVivo: "pc", miEquipo: "otra-pc", isCompact: false })).toBe(false);
  });
  it("sesión de antes del cambio (sin equipo): la llevan sus computadoras, nunca un celular", () => {
    expect(esteEquipoLleva({ ...base, equipoEnVivo: null, isCompact: false })).toBe(true);
    expect(esteEquipoLleva({ ...base, equipoEnVivo: null, isCompact: true })).toBe(false);
  });
  it("otra persona nunca la lleva", () => {
    expect(esteEquipoLleva({ userId: "ana", liveOwnerId: "eldin", equipoEnVivo: null, isCompact: false })).toBe(false);
    expect(esteEquipoLleva({ userId: null, liveOwnerId: null, equipoEnVivo: null, isCompact: false })).toBe(false);
  });
});
