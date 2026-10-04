import { describe, expect, it, beforeEach } from "vitest";
import { fijarLineaBase, idsABorrar, actualizarTrasGuardar } from "../lineaBase.js";

// lineaBase.js es el núcleo del "guardado por diferencias" (ver su propio comentario de cabecera):
// solo se borra lo que ESTE dispositivo conocía (su línea base) y el usuario quitó -- nunca una fila
// que otro dispositivo agregó después de que este cargó el evento.
describe("lineaBase", () => {
  beforeEach(() => {
    // Cada prueba usa una clave distinta, así no hace falta limpiar el Map module-level entre pruebas.
  });

  it("sin línea base (evento recién creado en este dispositivo) no borra nada", () => {
    expect(idsABorrar("clave-sin-base", ["a", "b"])).toEqual([]);
  });

  it("borra solo lo que estaba en la línea base y ya no está en lo local", () => {
    fijarLineaBase("clave-1", ["a", "b", "c"]);
    expect(idsABorrar("clave-1", ["a", "c"])).toEqual(["b"]);
  });

  it("NUNCA borra una fila que nunca estuvo en la línea base, aunque no esté en lo local (el caso del bug real)", () => {
    // El dispositivo cargó el evento viendo solo "a" y "b".
    fijarLineaBase("clave-2", ["a", "b"]);
    // Otro dispositivo (o el Asistente) agregó "externo-c" DESPUÉS de esa carga -- este dispositivo
    // nunca lo tuvo en memoria, así que tampoco aparece en su estado local al guardar.
    const idsLocalesAlGuardar = ["a", "b"]; // "externo-c" nunca estuvo aquí, ni se quitó a propósito
    expect(idsABorrar("clave-2", idsLocalesAlGuardar)).toEqual([]);
  });

  it("actualizarTrasGuardar fija la nueva línea base como (ids en la base) ∩ (ids locales) -- no todos los de la base", () => {
    fijarLineaBase("clave-3", ["a"]);
    // Tras guardar, en la base real ya quedaron "a", "b" (local) y "externo-c" (que alguien más agregó
    // en paralelo y nunca se tocó). La nueva línea base debe incluir "externo-c" -- si no, el PRÓXIMO
    // guardado de este dispositivo lo borraría por "ya no estar en su local", repitiendo el mismo bug.
    actualizarTrasGuardar("clave-3", ["a", "b", "externo-c"], ["a", "b"]);
    // La próxima vez que a este dispositivo "b" desaparezca de su estado local, si debe poder borrarse...
    expect(idsABorrar("clave-3", ["a"])).toEqual(["b"]);
    // ...pero "externo-c" nunca debe poder borrarse desde este dispositivo, porque nunca estuvo en su
    // estado local (la línea base real tras actualizarTrasGuardar es la intersección, no "a,b,externo-c").
    expect(idsABorrar("clave-3", [])).not.toContain("externo-c");
  });
});
