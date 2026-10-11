import { describe, it, expect } from "vitest";
import { bloquesDelCulto, insertarEnBloque, anclaDeBloque } from "../ordenCulto.js";

const orden = [
  { id: "b0", type: "seccion", title: "Bienvenida" }, { id: "s1", type: "slide" },
  { id: "b1", type: "seccion", title: "Alabanza" }, { id: "c1", type: "cancion" }, { id: "c2", type: "cancion" },
  { id: "b2", type: "seccion", title: "Prédica" },
  { id: "b3", type: "seccion", title: "Ofrenda" }, { id: "s2", type: "slide" },
];
const nuevo = { id: "n", type: "slide" };

describe("ordenCulto", () => {
  it("lista los bloques con cuántos tiene", () => {
    expect(bloquesDelCulto(orden).map((b) => `${b.titulo}:${b.cuantos}`)).toEqual(["Bienvenida:1", "Alabanza:2", "Prédica:0", "Ofrenda:1"]);
  });
  it("entra al final del bloque, antes del siguiente", () => {
    expect(insertarEnBloque(orden, nuevo, "b1").map((x) => x.id)).toEqual(["b0", "s1", "b1", "c1", "c2", "n", "b2", "b3", "s2"]);
  });
  it("bloque vacío: justo después de su título", () => {
    expect(insertarEnBloque(orden, nuevo, "b2").map((x) => x.id).slice(5, 8)).toEqual(["b2", "n", "b3"]);
  });
  it("último bloque o sin bloque: al final", () => {
    expect(insertarEnBloque(orden, nuevo, "b3").at(-1).id).toBe("n");
    expect(insertarEnBloque(orden, nuevo, null).at(-1).id).toBe("n");
    expect(insertarEnBloque(orden, nuevo, "no-existe").at(-1).id).toBe("n");
  });
  it("varios a la vez y sin modificar el original", () => {
    const copia = [...orden];
    expect(insertarEnBloque(orden, [nuevo, { id: "m" }], "b0").map((x) => x.id).slice(0, 4)).toEqual(["b0", "s1", "n", "m"]);
    expect(orden).toEqual(copia);
  });
  it("ancla: último del bloque, o el bloque si está vacío", () => {
    expect(anclaDeBloque(orden, "b1").id).toBe("c2");
    expect(anclaDeBloque(orden, "b2").id).toBe("b2");
  });
});
