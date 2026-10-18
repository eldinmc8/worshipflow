import { describe, it, expect } from "vitest";
import { cssAnimacion, recetaCompleta, pasosDeDiapositiva, capaTieneAnimacion, listaPalabrasClave } from "../animaciones.js";
import { definicionDeReceta, armarLineasAnimadas, animacionActiva, definicionAnimacion } from "../../components/LetrasAnimadas.jsx";

describe("piezas de animación", () => {
  it("arma la entrada y, después, la animación que se repite", () => {
    const css = cssAnimacion({ entrada: "subir", permanencia: "flotar", velocidad: 2, retraso: 0.5 });
    expect(css).toMatch(/^wfx-subir 0\.400s .* 0\.500s both, wfx-p-flotar .* 0\.950s infinite alternate$/);
    expect(cssAnimacion({ entrada: "nada", permanencia: "quieta" })).toBeUndefined();
  });
  it("completa recetas viejas o incompletas sin romperse", () => {
    const r = recetaCompleta({ entrada: "inventada", velocidad: 99, fondo: { tipo: "confeti" } });
    expect(r.entrada).toBe("aparecer");
    expect(r.velocidad).toBe(2);
    expect(r.fondo).toMatchObject({ tipo: "confeti", tono: 0, densidad: 1 });
  });
  it("lee la lista de palabras clave", () => {
    expect(listaPalabrasClave("Jesús, ¡Rey!\nCordero")).toEqual(["jesús", "rey", "cordero"]);
  });
  it("cuenta los clics de una diapositiva", () => {
    const d = { capas: [{ anim: { paso: 2 } }, { anim: { paso: 0, entrada: "subir" } }, {}] };
    expect(pasosDeDiapositiva(d)).toBe(2);
    expect(capaTieneAnimacion(d.capas[1])).toBe(true);
    expect(capaTieneAnimacion(d.capas[2])).toBe(false);
  });
});

describe("recetas propias en la proyección", () => {
  it("una receta guardada en el estilo en vivo se proyecta con sus palabras clave", () => {
    const receta = { entrada: "golpe", unidad: "palabra", claves: true, colorClave: "#00FF00", palabrasClave: "Rey" };
    const liveStyle = { animacion: "mia:abc", animReceta: receta, animNombre: "Jóvenes" };
    expect(animacionActiva(liveStyle)).toBe("mia:abc");
    const { def } = definicionAnimacion(liveStyle);
    expect(def.nombre).toBe("Jóvenes");
    const { lineas } = armarLineasAnimadas(def, ["Al Rey de reyes"], "s1");
    const palabras = lineas[0].props.children.filter((n) => typeof n !== "string");
    expect(palabras[1].props.style.color).toBe("#00FF00");
    expect(palabras[0].props.style.animation).toMatch(/^wfx-golpe/);
  });
  it("sin receta, una clave propia no activa nada", () => {
    expect(animacionActiva({ animacion: "mia:abc" })).toBe(null);
  });
  it("con 'Mi fondo de siempre' no hay fondo animado", () => {
    expect(definicionDeReceta({ fondo: { tipo: "propio" } }).fondo).toBe(null);
  });
});
