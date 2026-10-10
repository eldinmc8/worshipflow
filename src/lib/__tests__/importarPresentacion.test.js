import { describe, expect, it } from "vitest";
import { tipoDeArchivo, dividirEnDiapositivas, itemsDeImportacion, esPaginaPresentacion, MARCA_PRESENTACION } from "../importarPresentacion.js";

const archivo = (name, type = "") => ({ name, type });

describe("tipoDeArchivo", () => {
  it("reconoce PDF, imágenes, Word y texto", () => {
    expect(tipoDeArchivo(archivo("Prédica.PDF"))).toBe("pdf");
    expect(tipoDeArchivo(archivo("letra canva.png", "image/png"))).toBe("imagen");
    expect(tipoDeArchivo(archivo("foto.jpeg"))).toBe("imagen");
    expect(tipoDeArchivo(archivo("bosquejo.docx"))).toBe("docx");
    expect(tipoDeArchivo(archivo("notas.txt", "text/plain"))).toBe("texto");
  });
  it("PowerPoint/Keynote directo: pide exportarlo a PDF; lo demás no se acepta", () => {
    expect(tipoDeArchivo(archivo("culto.pptx"))).toBe("presentacion-sin-pdf");
    expect(tipoDeArchivo(archivo("culto.key"))).toBe("presentacion-sin-pdf");
    expect(tipoDeArchivo(archivo("hoja.xlsx"))).toBeNull();
  });
});

describe("dividirEnDiapositivas", () => {
  const bosquejo = "La fe que mueve montañas\n\n1. Creer\nsin ver\n\n\n2. Obedecer\r\n\r\n   \n3. Perseverar  ";
  it("por espacio entre párrafos: cada bloque con sus líneas", () => {
    expect(dividirEnDiapositivas(bosquejo, "bloque")).toEqual(["La fe que mueve montañas", "1. Creer\nsin ver", "2. Obedecer", "3. Perseverar"]);
  });
  it("cada línea sola", () => {
    expect(dividirEnDiapositivas(bosquejo, "parrafo")).toEqual(["La fe que mueve montañas", "1. Creer", "sin ver", "2. Obedecer", "3. Perseverar"]);
  });
  it("texto vacío: nada", () => {
    expect(dividirEnDiapositivas("  \n\n ", "bloque")).toEqual([]);
  });
});

describe("itemsDeImportacion", () => {
  let n = 0;
  const nuevoId = () => `id${++n}`;

  it("páginas: un bloque con el nombre y UN elemento con todas las páginas como diapositivas", () => {
    const items = itemsDeImportacion({ nombre: "Prédica Juan 3.pdf", paginas: [{ url: "u1" }, { url: "u2" }], agrupar: true, nuevoId });
    expect(items[0]).toMatchObject({ type: "seccion", title: "Prédica Juan 3" });
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ type: "slide", title: "Prédica Juan 3", bg: MARCA_PRESENTACION, imageUrl: "u1", bgType: "color" });
    expect(items[1].diapositivas.map((d) => d.fondo.url)).toEqual(["u1", "u2"]);
    expect(esPaginaPresentacion(items[1])).toBe(true); // una versión vieja de la app muestra al menos la primera página
  });

  it("texto: puntos del bosquejo editables, sin bloque si no se pide", () => {
    const items = itemsDeImportacion({ nombre: "bosquejo.docx", textos: ["Uno", "Dos"], agrupar: false, nuevoId });
    expect(items).toHaveLength(2);
    expect(items.every((it) => it.type === "slide" && it.isSermonPoint && !esPaginaPresentacion(it))).toBe(true);
    expect(items.map((it) => it.title)).toEqual(["Uno", "Dos"]);
  });
});
