import { describe, it, expect } from "vitest";
import { ANIMACIONES, GRUPOS_ANIMACION, armarLineasAnimadas, claseAnimacion, EfectoPantalla } from "../../components/LetrasAnimadas.jsx";
import { ESTILOS_RECETA } from "../estilosAnimados.js";
import { ENTRADAS, PERMANENCIAS, TRATAMIENTOS, PANTALLAS, ACOMODOS, recetaCompleta } from "../animaciones.js";
import { FUENTES } from "../diapositivas.js";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const texto = (n) => (typeof n === "string" ? n : Array.isArray(n) ? n.map(texto).join("") : n?.props ? texto(n.props.children) : "");
const buscar = (n, fn, out = []) => {
  if (Array.isArray(n)) n.forEach((x) => buscar(x, fn, out));
  else if (n?.props) { if (fn(n)) out.push(n); buscar(n.props.children, fn, out); }
  return out;
};

describe("estilos nuevos de letra animada (etapa 1)", () => {
  it("hay 43 estilos nuevos, 58 en total, sin claves repetidas", () => {
    expect(ESTILOS_RECETA).toHaveLength(43);
    expect(new Set(ESTILOS_RECETA.map((e) => e.clave)).size).toBe(43);
    expect(Object.keys(ANIMACIONES)).toHaveLength(58);
    for (const g of ["Concierto", "Collage", "Pantalla partida", "Minimalista"]) expect(GRUPOS_ANIMACION).toContain(g);
  });

  it("cada estilo usa piezas que existen (sin caer a valores por defecto por un error de dedo)", () => {
    const fuentes = new Set(FUENTES.map((f) => f.clave));
    for (const e of ESTILOS_RECETA) {
      const r = e.receta;
      expect(fuentes.has(r.fuente), `${e.clave}: fuente ${r.fuente}`).toBe(true);
      expect(ENTRADAS.some((x) => x.clave === r.entrada), `${e.clave}: entrada ${r.entrada}`).toBe(true);
      expect(PERMANENCIAS.some((x) => x.clave === r.permanencia), `${e.clave}: permanencia`).toBe(true);
      expect(TRATAMIENTOS.some((x) => x.clave === r.tratamiento), `${e.clave}: tratamiento`).toBe(true);
      expect(PANTALLAS.some((x) => x.clave === r.pantalla), `${e.clave}: pantalla`).toBe(true);
      expect(ACOMODOS.some((x) => x.clave === r.acomodo), `${e.clave}: acomodo`).toBe(true);
      expect(recetaCompleta(r)).toMatchObject({ entrada: r.entrada, tratamiento: r.tratamiento, pantalla: r.pantalla });
    }
  });

  it("cada pieza tiene su CSS", () => {
    for (const x of ENTRADAS) expect(css, x.clave).toContain(`@keyframes wfx-${x.clave} `);
    for (const x of PERMANENCIAS.filter((p) => p.dur)) expect(css, x.clave).toContain(`@keyframes wfx-p-${x.clave} `);
    for (const x of TRATAMIENTOS.filter((t) => t.clave !== "ninguno")) expect(css, x.clave).toContain(`.wft-${x.clave}`);
    for (const x of PANTALLAS.filter((t) => !["ninguno", "temblor", "acercar", "espejo"].includes(t.clave))) expect(css, x.clave).toContain(`.wfe-${x.clave}`);
    for (const x of ["temblor", "acercar", "espejo"]) expect(css).toContain(`.wfs-${x}`);
    for (const x of ACOMODOS.filter((t) => t.clave !== "centro")) expect(css, x.clave).toContain(`.wfl-${x.clave}`);
  });

  it("los estilos de receta usan la clase de recetas y se funden con el fondo cuando hace falta", () => {
    expect(claseAnimacion("recortes")).toBe("wfa wfr");
    expect(claseAnimacion("neon")).toBe("wfa wfa-neon");
    expect(ANIMACIONES.recortes.mezcla).toBe(true);
    expect(ANIMACIONES.estadio.mezcla).toBe(false);
  });

  it("recortes de periódico: cada palabra es un papel con su variante, y el texto no cambia", () => {
    const { lineas, clase } = armarLineasAnimadas(ANIMACIONES.recortes, ["Santo es el Señor"], "s1");
    expect(texto(lineas[0])).toBe("Santo es el Señor");
    const papeles = buscar(lineas, (n) => /wft-in/.test(n.props.className || ""));
    expect(papeles).toHaveLength(4);
    papeles.forEach((p) => expect(p.props.className).toMatch(/wft-v[0-6]/));
    expect(clase).toContain("wfl-escalonado");
    // Nota de rescate: un papel por letra.
    const nota = armarLineasAnimadas(ANIMACIONES.notarescate, ["Dios"], "s2");
    expect(buscar(nota.lineas, (n) => /wft-in/.test(n.props.className || ""))).toHaveLength(4);
    expect(texto(nota.lineas[0])).toBe("Dios");
  });

  it("el latido al compás y los efectos de la letra completa van en el contenedor", () => {
    expect(armarLineasAnimadas(ANIMACIONES.estadio, ["Gloria"], "s3").clase).toContain("wfb-latido");
    expect(armarLineasAnimadas(ANIMACIONES.espejo, ["Gloria"], "s3").clase).toContain("wfs-espejo");
  });

  it("los efectos de pantalla se dibujan (y los de la letra completa no agregan capa)", () => {
    expect(EfectoPantalla({ tipo: "puertas" }).props.className).toContain("wfe-puertas");
    expect(EfectoPantalla({ tipo: "persianas" }).props.children).toHaveLength(9);
    expect(EfectoPantalla({ tipo: "destellos", beat: 0.4 }).props.style["--beat"]).toBe("0.4s");
    expect(EfectoPantalla({ tipo: "espejo" })).toBeNull();
    expect(EfectoPantalla({ tipo: "ninguno" })).toBeNull();
  });
});
