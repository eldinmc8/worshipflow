import { describe, it, expect } from "vitest";
import { armarOrdenDelCulto, resumenOrden, configCuenta } from "../asistenteEvento.js";

let n = 0;
const id = () => `id${++n}`;

describe("asistente de evento: armar el orden del culto", () => {
  it("cuenta regresiva primero, luego cada momento con su contenido y encargados pendientes", () => {
    const orden = armarOrdenDelCulto({
      cuenta: 10,
      momentos: [
        { title: "Bienvenida", contenido: [], encargados: [{ usuarioId: "u1", n: "Ana" }] },
        { title: "  ", contenido: [{ type: "cancion", songId: "x" }], encargados: [] },
        { title: "Alabanza", contenido: [{ type: "cancion", songId: "s1" }, { type: "cancion", songId: "s2" }], encargados: [] },
      ],
    }, id);
    expect(orden.map((o) => o.type)).toEqual(["slide", "seccion", "seccion", "cancion", "cancion"]);
    expect(orden[0].cuentaRegresiva).toMatchObject({ modo: "minutos", minutos: 10 });
    expect(orden[1]).toMatchObject({ title: "Bienvenida", encargados: [{ n: "Ana", usuarioId: "u1", status: "pendiente", lead: false }] });
    expect(new Set(orden.map((o) => o.id)).size).toBe(orden.length);
  });
  it("sin cuenta y resumen", () => {
    expect(configCuenta(null)).toBeNull();
    expect(configCuenta("hora")).toEqual({ modo: "hora" });
    const datos = { cuenta: null, momentos: [{ title: "A", contenido: [{ type: "cancion" }], encargados: [{ usuarioId: "u1" }] }, { title: "B", contenido: [{ type: "biblia" }], encargados: [{ usuarioId: "u1" }, { usuarioId: "u2" }] }] };
    expect(armarOrdenDelCulto(datos, id).some((o) => o.cuentaRegresiva)).toBe(false);
    expect(resumenOrden(datos)).toEqual({ momentos: 2, canciones: 1, encargados: 2, cuenta: false });
  });
});
