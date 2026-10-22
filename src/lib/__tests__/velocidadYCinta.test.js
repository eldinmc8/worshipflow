import { describe, it, expect } from "vitest";
import { armarLineasAnimadas, velocidadLetra, definicionDeReceta, BASE_TIEMPO } from "../../components/LetrasAnimadas.jsx";
import { gruposQueCaben } from "../cintaAdaptable.js";

// Pedido de Eldin, 2026-10-21: letra animada un poco más rápida por defecto y con velocidad ajustable;
// la cinta de la consola sin deslizar de lado ("Más opciones" al final).
describe("velocidad de la letra animada", () => {
  it("normal ya es más rápido que el diseño original y la velocidad elegida lo ajusta", () => {
    expect(BASE_TIEMPO).toBeLessThan(1);
    expect(armarLineasAnimadas("suave", ["Santo"], "s").vars["--wfv"]).toBe(0.75);
    expect(armarLineasAnimadas("suave", ["Santo"], "s", 1.5).vars["--wfv"]).toBe(0.5);
    expect(armarLineasAnimadas("suave", ["Santo"], "s", 0.75).vars["--wfv"]).toBe(1);
  });

  it("velocidadLetra tiene valor por defecto y límites", () => {
    expect(velocidadLetra({})).toBe(1);
    expect(velocidadLetra({ animVelocidad: 1.4 })).toBe(1.4);
    expect(velocidadLetra({ animVelocidad: 99 })).toBe(2.5);
    expect(velocidadLetra({ animVelocidad: "x" })).toBe(1);
  });

  it("en las animaciones de la iglesia, más rápido = entradas más cortas y turnos más seguidos", () => {
    const def = definicionDeReceta({ unidad: "palabra", entrada: "subir", velocidad: 1, separacion: 0.2 });
    const retrasoSegunda = (vel) => {
      const { lineas } = armarLineasAnimadas(def, ["uno dos"], "s", vel);
      const pal = lineas[0].props.children.filter((n) => typeof n !== "string");
      const anim = pal[1].props.style.animation; // "wfx-subir 0.600s ... 0.263s both"
      const [, dur, retraso] = anim.match(/wfx-subir ([\d.]+)s \S+ ([\d.]+)s/) || anim.match(/wfx-subir ([\d.]+)s .*? ([\d.]+)s both/);
      return { dur: +dur, retraso: +retraso };
    };
    const normal = retrasoSegunda(1), rapida = retrasoSegunda(2);
    expect(rapida.dur).toBeLessThan(normal.dur);
    expect(rapida.retraso).toBeLessThan(normal.retraso);
  });
});

describe("cinta de la consola", () => {
  it("si todo cabe, no hay botón de Más opciones", () => {
    expect(gruposQueCaben([100, 200, 150], 500, 100)).toBe(3);
  });
  it("lo que no cabe pasa a Más opciones (reservando su lugar)", () => {
    expect(gruposQueCaben([100, 200, 150], 420, 100)).toBe(2);
    expect(gruposQueCaben([100, 200, 150], 350, 100)).toBe(1);
  });
  it("siempre queda al menos el primer grupo y se mide todo antes de decidir", () => {
    expect(gruposQueCaben([300, 200], 150, 100)).toBe(1);
    expect(gruposQueCaben([100, undefined, 150], 120, 100)).toBe(3);
  });
});
