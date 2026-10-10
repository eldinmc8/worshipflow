import { describe, it, expect } from "vitest";
import {
  diapositivasDeItem, esGrupoDiapositivas, itemConDiapositivas, slidesDeGrupo, moverDiapositiva,
  reordenarEnGrupo, quitarDiapositiva, posicionRapida, ajustarAGuias, clonarDiapositiva, PLANTILLAS, nuevaCapaImagen, tituloBase,
} from "../diapositivas.js";

const d = (id, url = `u${id}`) => ({ id, fondo: { tipo: "imagen", url, color: "#000", ajuste: "contain" }, capas: [] });
const grupo = (id, n, title = "Bienvenida") => itemConDiapositivas({ id, type: "slide", title, encargados: [] }, Array.from({ length: n }, (_, k) => d(`${id}-${k}`)));
let n = 0;
const nuevoId = () => `nuevo${++n}`;

describe("diapositivasDeItem", () => {
  it("página vieja de PDF → su imagen de fondo, sin recortar", () => {
    const [x] = diapositivasDeItem({ type: "slide", bg: "presentacion", imageUrl: "p1.jpg", title: "Bienvenida (1/5)" });
    expect(x.fondo).toMatchObject({ tipo: "imagen", url: "p1.jpg", ajuste: "contain" });
    expect(x.capas).toEqual([]);
  });
  it("diapositiva de texto → fondo de color y su texto como capas", () => {
    const [x] = diapositivasDeItem({ type: "slide", bg: "#112233", bgType: "color", title: "Anuncios", subtitle: "Domingo" });
    expect(x.fondo).toMatchObject({ tipo: "color", color: "#112233" });
    expect(x.capas.map((c) => c.texto)).toEqual(["Anuncios", "Domingo"]);
  });
  it("con video de fondo lo conserva", () => {
    const [x] = diapositivasDeItem({ type: "slide", bgType: "video", videoUrl: "v.mp4", title: "" });
    expect(x.fondo).toMatchObject({ tipo: "video", url: "v.mp4" });
  });
  it("un grupo devuelve sus diapositivas tal cual", () => {
    const g = grupo("g", 3);
    expect(diapositivasDeItem(g)).toBe(g.diapositivas);
    expect(esGrupoDiapositivas(g)).toBe(true);
  });
});

describe("itemConDiapositivas", () => {
  it("guarda la primera imagen para versiones viejas de la app", () => {
    const g = grupo("g", 2);
    expect(g).toMatchObject({ bg: "presentacion", imageUrl: "ug-0", bgType: "color" });
  });
});

describe("slidesDeGrupo", () => {
  it("una diapositiva por cada una, con (k/n) y el id del elemento como prefijo", () => {
    const s = slidesDeGrupo(grupo("g", 3));
    expect(s.map((x) => x.slideId)).toEqual(["g~g-0", "g~g-1", "g~g-2"]);
    expect(s[1].title).toBe("Bienvenida (2/3)");
    expect(s[0].diseno.id).toBe("g-0");
  });
  it("si es una sola conserva el id del elemento", () => {
    expect(slidesDeGrupo(grupo("g", 1))[0].slideId).toBe("g");
  });
});

describe("moverDiapositiva", () => {
  const orden = () => [grupo("a", 3), { id: "c", type: "cancion", songId: "s" }, grupo("b", 1, "Ofrenda")];
  it("mover a otro grupo: sale del origen y entra al final del destino", () => {
    const o = moverDiapositiva(orden(), { itemId: "a", indice: 1, destino: "b", nuevoId });
    expect(o[0].diapositivas.map((x) => x.id)).toEqual(["a-0", "a-2"]);
    expect(o[2].diapositivas).toHaveLength(2);
    expect(o[2].diapositivas[1].fondo.url).toBe("ua-1");
    expect(o[2].diapositivas[1].id).not.toBe("a-1"); // copia con id nuevo
  });
  it("copiar deja la original", () => {
    const o = moverDiapositiva(orden(), { itemId: "a", indice: 0, destino: "b", copiar: true, nuevoId });
    expect(o[0].diapositivas).toHaveLength(3);
    expect(o[2].diapositivas).toHaveLength(2);
  });
  it("grupo nuevo o suelta: entra justo después del origen", () => {
    const o = moverDiapositiva(orden(), { itemId: "a", indice: 2, destino: "nuevo", nombreNuevo: "Logo", nuevoId });
    expect(o.map((x) => x.title || x.type)).toEqual(["Bienvenida", "Logo", "cancion", "Ofrenda"]);
    const s = moverDiapositiva(orden(), { itemId: "a", indice: 0, destino: "suelta", nuevoId });
    expect(s[1].title).toBe("Bienvenida");
    expect(s[1].diapositivas).toHaveLength(1);
  });
  it("si el origen se queda vacío, desaparece", () => {
    const o = moverDiapositiva(orden(), { itemId: "b", indice: 0, destino: "a", nuevoId });
    expect(o.map((x) => x.id)).toEqual(["a", "c"]);
    expect(o[0].diapositivas).toHaveLength(4);
  });
  it("una diapositiva vieja de texto se convierte al moverla", () => {
    const viejo = [{ id: "t", type: "slide", title: "Anuncio", bg: "#000000", bgType: "color" }, grupo("b", 1)];
    const o = moverDiapositiva(viejo, { itemId: "t", indice: 0, destino: "b", nuevoId });
    expect(o).toHaveLength(1);
    expect(o[0].diapositivas[1].capas[0].texto).toBe("Anuncio");
  });
  it("no modifica el orden original", () => {
    const original = orden();
    const copia = JSON.parse(JSON.stringify(original));
    moverDiapositiva(original, { itemId: "a", indice: 0, destino: "b", nuevoId });
    expect(original).toEqual(copia);
  });
});

describe("reordenar y quitar dentro del grupo", () => {
  it("reordena", () => {
    const o = reordenarEnGrupo([grupo("a", 3)], "a", 0, 2);
    expect(o[0].diapositivas.map((x) => x.id)).toEqual(["a-1", "a-2", "a-0"]);
  });
  it("quitar la última borra el elemento", () => {
    expect(quitarDiapositiva([grupo("a", 1)], "a", 0)).toEqual([]);
    expect(quitarDiapositiva([grupo("a", 2)], "a", 0)[0].diapositivas.map((x) => x.id)).toEqual(["a-1"]);
  });
});

describe("herramientas del editor", () => {
  it("posición rápida con margen", () => {
    expect(posicionRapida({ x: 0, y: 0, w: 40, h: 20 }, 2, 1)).toMatchObject({ x: 30, y: 75 });
    expect(posicionRapida({ x: 0, y: 0, w: 40, h: 20 }, 0, 2)).toMatchObject({ x: 55, y: 5 });
  });
  it("se pega al centro del lienzo", () => {
    const { capa, guias } = ajustarAGuias({ x: 29.5, y: 10, w: 40, h: 20 }, []);
    expect(capa.x).toBe(30);
    expect(guias.x).toBe(50);
  });
  it("clonar cambia todos los ids", () => {
    const x = PLANTILLAS[0].crear();
    const c = clonarDiapositiva(x);
    expect(c.id).not.toBe(x.id);
    expect(c.capas.map((k) => k.id).some((id) => x.capas.some((k) => k.id === id))).toBe(false);
  });
  it("imagen nueva respeta su proporción", () => {
    const img = nuevaCapaImagen("u", 1000, 1000);
    expect(Math.round((img.w * 16) / 9)).toBe(Math.round(img.h)); // cuadrada en pantalla 16:9
  });
  it("título base sin (k/n)", () => {
    expect(tituloBase("Bienvenida (2/5)")).toBe("Bienvenida");
  });
});
