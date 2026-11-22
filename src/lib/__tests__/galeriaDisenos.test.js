import { describe, it, expect, vi } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
import { GALERIA_DISENOS, CATEGORIAS_DISENOS, disenoDisponible, disenosDe } from "../galeriaDisenos.js";
import { FUENTES } from "../diapositivas.js";
import { ICONOS_DISENO } from "../../components/iconosDiseno.js";
import { FUNCIONES_PLAN, tiene } from "../planes.js";

describe("galería de diseños listos", () => {
  it("cada categoría tiene diseños y al menos uno gratis", () => {
    for (const c of CATEGORIAS_DISENOS) {
      const ds = disenosDe(c.clave);
      expect(ds.length).toBeGreaterThanOrEqual(4);
      expect(ds.some((d) => d.gratis)).toBe(true);
    }
    expect(GALERIA_DISENOS.filter((d) => d.gratis)).toHaveLength(6);
  });

  it("claves únicas y diapositivas válidas (fuentes e íconos que la proyección conoce)", () => {
    const claves = new Set(GALERIA_DISENOS.map((d) => d.clave));
    expect(claves.size).toBe(GALERIA_DISENOS.length);
    const fuentes = new Set(FUENTES.map((f) => f.clave));
    const iconos = new Set(ICONOS_DISENO.map((i) => i.clave));
    for (const d of GALERIA_DISENOS) {
      const diap = d.crear();
      expect(diap.id).toBeTruthy();
      expect(diap.capas.length).toBeGreaterThan(0);
      for (const capa of diap.capas) {
        if (capa.tipo === "texto") expect(fuentes.has(capa.fuente)).toBe(true);
        if (capa.tipo === "icono") expect(iconos.has(capa.icono)).toBe(true);
        expect(capa.x + capa.w).toBeLessThanOrEqual(100.01);
        expect(capa.y + capa.h).toBeLessThanOrEqual(100.01);
      }
    }
  });

  it("crear() da ids nuevos cada vez", () => {
    const d = GALERIA_DISENOS[0];
    expect(d.crear().id).not.toBe(d.crear().id);
  });

  it("candado por plan: los de pago piden Ministerio", () => {
    expect(FUNCIONES_PLAN.galeria_disenos.plan).toBe("ministerio");
    const pago = GALERIA_DISENOS.find((d) => !d.gratis);
    const gratis = GALERIA_DISENOS.find((d) => d.gratis);
    expect(disenoDisponible(gratis, tiene({ plan: "gratis" }, "galeria_disenos"))).toBe(true);
    expect(disenoDisponible(pago, tiene({ plan: "gratis" }, "galeria_disenos"))).toBe(false);
    expect(disenoDisponible(pago, tiene({ plan: "ministerio" }, "galeria_disenos"))).toBe(true);
  });
});
