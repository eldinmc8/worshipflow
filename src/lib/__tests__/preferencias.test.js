import { describe, it, expect } from "vitest";
import { acordeEn, lineaEn } from "../preferencias.js";

describe("acordeEn (Do Re Mi)", () => {
  it("cambia la raíz y deja el resto", () => {
    expect(acordeEn("C", "solfeo")).toBe("Do");
    expect(acordeEn("C#m", "solfeo")).toBe("Do#m");
    expect(acordeEn("Bb", "solfeo")).toBe("Sib");
    expect(acordeEn("G/B", "solfeo")).toBe("Sol/Si");
    expect(acordeEn("D/F#", "solfeo")).toBe("Re/Fa#");
    expect(acordeEn("Am7", "solfeo")).toBe("Lam7");
    expect(acordeEn("Asus4", "solfeo")).toBe("Lasus4");
    expect(acordeEn("Bm7b5", "solfeo")).toBe("Sim7b5");
    expect(acordeEn("E7", "solfeo")).toBe("Mi7");
  });
  it("lo que no es acorde queda igual, y en letras no cambia nada", () => {
    expect(acordeEn("N.C.", "solfeo")).toBe("N.C.");
    expect(acordeEn("Coro", "solfeo")).toBe("Coro");
    expect(acordeEn("C#m", "letras")).toBe("C#m");
  });
  it("convierte los acordes de una línea", () => {
    expect(lineaEn("[G]Te alabo [D/F#]Señor", "solfeo")).toBe("[Sol]Te alabo [Re/Fa#]Señor");
  });
});
