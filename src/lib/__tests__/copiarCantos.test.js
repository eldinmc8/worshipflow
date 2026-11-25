import { describe, it, expect } from "vitest";
import { cultosParaCopiar, cantosDeCulto, cantosACopiar } from "../copiarCantos.js";

const canto = (id, songId, extra = {}) => ({ id, type: "cancion", songId, ...extra });
const hoy = new Date(2026, 10, 25);

describe("copiar cantos de otro culto", () => {
  const eventos = [
    { id: "a", title: "Domingo pasado", date: "2026-11-22", serviceOrder: [{ id: "b1", type: "seccion" }, canto("x1", 1)] },
    { id: "b", title: "Hace dos domingos", date: "2026-11-15", serviceOrder: [canto("x2", 2)] },
    { id: "c", title: "Próximo", date: "2026-11-29", serviceOrder: [canto("x3", 3)] },
    { id: "d", title: "Sin cantos", date: "2026-11-20", serviceOrder: [{ id: "s", type: "slide" }] },
    { id: "e", title: "Plantilla", esPlantilla: true, serviceOrder: [canto("x4", 4)] },
    { id: "actual", title: "Este", date: "2026-11-25", serviceOrder: [canto("x5", 5)] },
  ];

  it("lista los cultos con cantos: pasados del más reciente, luego próximos; sin el actual ni plantillas", () => {
    const { pasados, proximos } = cultosParaCopiar(eventos, "actual", hoy);
    expect(pasados.map((e) => e.id)).toEqual(["a", "b"]);
    expect(proximos.map((e) => e.id)).toEqual(["c"]);
  });

  it("solo toma los cantos del culto", () => {
    expect(cantosDeCulto(eventos[0]).map((c) => c.id)).toEqual(["x1"]);
  });

  it("copia tono y orden para el culto, sin id ni encargados, y salta canciones borradas", () => {
    const cantos = [
      canto("i1", 1, { keyOverride: "D", ordenEvento: ["V1", "C", "C"], encargados: [{ id: 9 }] }),
      canto("i2", 99),
    ];
    const copia = cantosACopiar(cantos, [{ id: 1 }]);
    expect(copia).toEqual([{ type: "cancion", songId: 1, keyOverride: "D", ordenEvento: ["V1", "C", "C"] }]);
    copia[0].ordenEvento.push("X");
    expect(cantos[0].ordenEvento).toHaveLength(3); // no comparte el arreglo con el culto de origen
  });
});
