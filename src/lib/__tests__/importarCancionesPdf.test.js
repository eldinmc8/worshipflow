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
