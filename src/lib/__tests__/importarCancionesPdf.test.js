import { describe, expect, it } from "vitest";
import fs from "fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { itemsDePdf, lineasDeItems, cancionesDeLineas } from "../importarCancionesPdf.js";
import { textoACancion } from "../textoCancion.js";

const leer = async (nombre) => {
  const items = await itemsDePdf(pdfjs, new Uint8Array(fs.readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url))));
  return cancionesDeLineas(lineasDeItems(items), nombre);
};

describe("importar canciones desde PDF", () => {
  it("un PDF por canción: título, autor, tono, partes y acordes en su sílaba", async () => {
    const [c, ...resto] = await leer("vine-a-adorar.pdf");
    expect(resto).toHaveLength(0);
    expect(c.titulo).toBe("Vine a adorarte");
    expect(c.artista).toBe("Prueba Demo");
    expect(c.tonalidad).toBe("G");
    expect(c.texto).toContain("[Em]Vine a decir que e[C]res mi Dios");
    const r = textoACancion(c.texto);
    expect(Object.values(r.blocks).map((b) => b.label)).toEqual(["Estrofa 1", "Coro"]);
  });
  it("letra de ancho fijo (LaCuerda): acordes exactos, 'Título - Autor', sin número de página", async () => {
    const [c] = await leer("lacuerda-courier.pdf");
    expect(c.titulo).toBe("Al estar aquí");
    expect(c.artista).toBe("Danilo Montero");
    expect(c.texto).toContain("[A2]Al estar en l[E/G#]a presencia de[F#m7] tu divinidad");
    expect(c.texto).toContain("Y a[A7]l conte[Dmaj7]mplar");
    expect(c.texto).not.toMatch(/1\/1/);
  });
  it("cancionero: separa cada canción por su título y quita el pie repetido", async () => {
    const cs = await leer("cancionero.pdf");
    expect(cs.map((c) => c.titulo)).toEqual(["Cuán grande es Él", "Sublime gracia", "Castillo fuerte"]);
    expect(cs.every((c) => !c.texto.includes("micancionero"))).toBe(true);
    expect(cs[1].texto).toBe("Sublime gracia del Señor\nQue a un pecador salvó\n\nFui ciego mas hoy veo yo\nPerdido y Él me halló");
  });
});

describe("PDF real (Yeshua – Generación 12)", () => {
  it("título en la primera línea, acordes al pie de página con su letra, partes", async () => {
    const [c, ...resto] = await leer("yeshua.pdf");
    expect(resto).toHaveLength(0);
    expect(c.titulo).toBe("YESHUA");
    expect(c.artista).toBe("Generación 12");
    expect(c.texto).not.toContain("YESHUA – Generación 12");
    expect(c.texto).toContain("Qu[C#m]iero conoce[B]r a Jesús\nQu[A]iero");
    const r = textoACancion(c.texto);
    expect(Object.values(r.blocks).map((b) => b.label)).toEqual(["Estrofa", "Pre-coro", "Coro"]);
  });
});

// Cancioneros donde los títulos NO son más grandes (pedido de Eldin, 2026-11-11: "que solo metan el
// PDF y se separen solas"). PDFs de prueba hechos con reportlab: 5 canciones cada uno.
const CINCO = ["Cuán grande es Él", "Sublime gracia", "Castillo fuerte", "Santo Santo Santo", "Grande es tu fidelidad"];
describe("separar canciones de un cancionero", () => {
  it("títulos en negrita, del mismo tamaño que la letra", async () => {
    const cs = await leer("cancionero-negrita.pdf");
    expect(cs.map((c) => c.titulo)).toEqual(CINCO);
    expect(cs[0].texto).toContain("[G]Señor mi Dios");
    expect(cs[1].texto).not.toContain("Castillo");
  });
  it("títulos numerados (\"1. Título\"): el número no queda en el título", async () => {
    expect((await leer("cancionero-numerado.pdf")).map((c) => c.titulo)).toEqual(CINCO);
  });
  it("títulos en MAYÚSCULAS", async () => {
    const cs = await leer("cancionero-mayusculas.pdf");
    expect(cs).toHaveLength(5);
    expect(cs[1].titulo).toBe("Sublime gracia");
  });
  it("una canción por página, con el título en letra normal", async () => {
    expect((await leer("cancionero-por-pagina.pdf")).map((c) => c.titulo)).toEqual(CINCO);
  });
  it("índice al principio: se salta, y una línea en mayúsculas dentro de la letra no corta la canción", async () => {
    const cs = await leer("cancionero-con-indice.pdf");
    expect(cs.map((c) => c.titulo)).toEqual(CINCO);
    expect(cs[0].texto).not.toMatch(/\.{3,}/);
    expect(cs[0].texto).toContain("ALELUYA ALELUYA");
  });
});

describe("separar canciones (sin PDF)", () => {
  const linea = (texto, pagina, y, extra = {}) => ({ texto, pagina, y, alto: 11, xs: [...texto].map((_, i) => 60 + i * 6), items: [], negrita: false, ...extra });
  it("100 canciones numeradas en 25 páginas", () => {
    const lineas = [];
    for (let n = 1; n <= 100; n++) {
      const pagina = Math.ceil(n / 4);
      const base = 700 - ((n - 1) % 4) * 150;
      lineas.push(linea(`${n}. Canción número ${n}`, pagina, base));
      lineas.push(linea(`Primera línea de la canción ${n}`, pagina, base - 30));
      lineas.push(linea(`Segunda línea, canción ${n}`, pagina, base - 46));
    }
    const cs = cancionesDeLineas(lineas, "cancionero.pdf");
    expect(cs).toHaveLength(100);
    expect(cs[41].titulo).toBe("Canción número 42");
    expect(cs[41].texto).toBe("Primera línea de la canción 42\nSegunda línea, canción 42");
  });
  it("una canción sola con el título en negrita no se parte", () => {
    const cs = cancionesDeLineas([
      linea("Mi canción", 1, 700, { negrita: true }),
      linea("Coro", 1, 670, { negrita: true }),
      linea("Letra del coro", 1, 654),
      linea("Otra línea", 1, 638),
    ], "mi-cancion.pdf");
    expect(cs).toHaveLength(1);
    expect(cs[0].titulo).toBe("Mi canción");
  });
});

describe("PDF real (Coros en tonalidad menor)", () => {
  it("títulos del mismo tamaño, sin negrita ni números: espacio arriba y acordes debajo", async () => {
    const cs = await leer("coros-tonalidad-menor.pdf");
    expect(cs.map((c) => c.titulo)).toEqual(["En el Principio el Espíritu de Dios", "Cuando el pueblo del Señor alaba a Dios", "Quien, quien, quien", "Oh Jerusalén", "Su gloria cubrió lo cielos", "Pon aceite en mi lámpara Señor", "Satúrame", "Yo me alegré", "Hallé un buen amigo", "Mi Sendero de amor"]);
    // La canción que sigue en la otra página no pierde su letra.
    expect(cs[4].texto).toContain("rayos brilla[A]ntes salían de sus m[Dm]anos.");
    expect(cs[8].texto.split("\n")).toHaveLength(4);
  });
});
