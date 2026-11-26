// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  tipoDeArchivoCancion, tipoDeTexto, decodificarTexto, cancionesDeTextoArchivo, cancionesDeArchivo,
} from "../importarArchivosCancion.js";
import { textoACancion, leerEncabezado } from "../textoCancion.js";

const etiquetas = (texto) => {
  const r = textoACancion(texto);
  return { partes: Object.values(r.blocks).map((b) => b.label), orden: r.defaultStructure.map((k) => r.blocks[k].label), r };
};
const archivo = (nombre, contenido) => {
  const bytes = typeof contenido === "string" ? new TextEncoder().encode(contenido) : contenido;
  return { name: nombre, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

describe("partes en inglés", () => {
  it("Verse/Chorus/Bridge pasan a Estrofa/Coro/Puente", () => {
    expect(leerEncabezado("Verse 1").etiqueta).toBe("Estrofa 1");
    expect(leerEncabezado("[Chorus]").etiqueta).toBe("Coro");
    expect(leerEncabezado("Pre-Chorus").etiqueta).toBe("Pre-coro");
    expect(leerEncabezado("BRIDGE:").etiqueta).toBe("Puente");
    expect(leerEncabezado("Chorus x2")).toMatchObject({ etiqueta: "Coro", veces: 2 });
    expect(leerEncabezado("Every chorus sings")).toBeNull();
  });
});

describe("qué archivo es", () => {
  const b = (...x) => new Uint8Array([...x, 0, 0, 0]);
  it("reconoce por contenido", () => {
    expect(tipoDeArchivoCancion("x", b(0x25, 0x50, 0x44, 0x46))).toBe("pdf");
    expect(tipoDeArchivoCancion("canciones.mufl", b(0xac, 0xed, 0, 5))).toBe("holyrics");
    expect(tipoDeArchivoCancion("letra.docx", b(0x50, 0x4b, 3, 4))).toBe("docx");
    expect(tipoDeArchivoCancion("Cancion.pro", b(1, 2))).toBe("propresenter");
    expect(tipoDeArchivoCancion("Grande es el Señor", new TextEncoder().encode("<?xml version='1.0'?><song>"))).toBe("texto");
    expect(tipoDeTexto("<?xml version='1.0'?><song><lyrics>[V1]</lyrics></song>")).toBe("opensong");
    expect(tipoDeTexto('<song xmlns="http://openlyrics.info/namespace/2009/song">')).toBe("openlyrics");
    expect(tipoDeTexto("{title: Hola}\n[G]Hola")).toBe("chordpro");
    expect(tipoDeTexto('[{"title":"x"}]')).toBe("json");
    expect(tipoDeTexto("Coro\nHola")).toBe("texto");
  });
  it("lee texto de Windows (acentos) y UTF-16", () => {
    expect(decodificarTexto(new Uint8Array([0x63, 0x6f, 0x72, 0x61, 0x7a, 0xf3, 0x6e]))).toBe("corazón");
    const u16 = new Uint8Array([0xff, 0xfe, 0x53, 0, 0xed, 0]);
    expect(decodificarTexto(u16)).toBe("Sí");
  });
});

describe("texto simple", () => {
  it("ProPresenter texto plano: título arriba, partes en inglés, sin CCLI", () => {
    const txt = "Cuan grande es Él - Tradicional\n\nVerse 1\nSeñor mi Dios\nal contemplar los cielos\n\nChorus\nMi corazón entona la canción\ncuán grande es Él\n\nVerse 2\nAl recorrer\nlos montes y los valles\n\nChorus\n\nCCLI Song # 14181";
    const [c] = cancionesDeTextoArchivo(txt, "cuan.txt");
    expect(c.titulo).toBe("Cuan grande es Él");
    expect(c.artista).toBe("Tradicional");
    expect(c.texto).not.toMatch(/CCLI/);
    const { partes, orden } = etiquetas(c.texto);
    expect(partes).toEqual(["Estrofa 1", "Coro", "Estrofa 2"]);
    expect(orden).toEqual(["Estrofa 1", "Coro", "Estrofa 2", "Coro"]);
  });
  it("varias canciones en un archivo con Título:", () => {
    const txt = "Título: Primera\nAutor: Ana\nTono: Sol\n\nHola hola\n\nTítulo: Segunda\n\nAdiós adiós";
    const lista = cancionesDeTextoArchivo(txt, "todas.txt");
    expect(lista.map((c) => c.titulo)).toEqual(["Primera", "Segunda"]);
    expect(lista[0]).toMatchObject({ artista: "Ana", tonalidad: "G", texto: "Hola hola" });
  });
  it("sin título adentro usa el nombre del archivo y no cambia la letra", () => {
    const [c] = cancionesDeTextoArchivo("Te alabo Señor\ncon todo mi ser\n\nTe alabo Señor\ncon todo mi ser", "Te_alabo.txt");
    expect(c.titulo).toBe("Te alabo");
    expect(c.texto).toBe("Te alabo Señor\ncon todo mi ser\n\nTe alabo Señor\ncon todo mi ser");
  });
});

describe("ChordPro", () => {
  it("título, tono, coro y estrofas sin nombre", () => {
    const cho = "{title: Digno es el Señor}\n{artist: Marcos}\n{key: D}\n{tempo: 72}\n# comentario\n[D]Digno es el [G]Señor\n\n{soc}\n[A]Santo santo\n{eoc}\n\nOtra [Em]estrofa\n{chorus}";
    const [c] = cancionesDeTextoArchivo(cho, "digno.cho");
    expect(c).toMatchObject({ titulo: "Digno es el Señor", artista: "Marcos", tonalidad: "D", tempo: "72" });
    const { partes, orden, r } = etiquetas(c.texto);
    expect(partes).toEqual(["Estrofa 1", "Coro", "Estrofa 2"]);
    expect(orden).toEqual(["Estrofa 1", "Coro", "Estrofa 2", "Coro"]);
    expect(Object.values(r.blocks)[0].lines[0]).toBe("[D]Digno es el [G]Señor");
  });
});

describe("OpenLyrics (OpenLP)", () => {
  it("partes, acordes, diapositivas y orden", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8">
  <properties><titles><title>Renuévame</title></titles><authors><author>Marcos Witt</author></authors>
  <key>G</key><tempo type="bpm">70</tempo><verseOrder>v1 c v1 c</verseOrder></properties>
  <lyrics>
    <verse name="v1"><lines><chord name="G"/>Renuévame<br/>Señor Jesús</lines><lines>ya no quiero ser igual</lines></verse>
    <verse name="c1"><lines>Pon en mí<br/>tu corazón</lines></verse>
  </lyrics>
</song>`;
    const [c] = cancionesDeTextoArchivo(xml, "renuevame.xml");
    expect(c).toMatchObject({ titulo: "Renuévame", artista: "Marcos Witt", tonalidad: "G", tempo: "70" });
    const { partes, orden, r } = etiquetas(c.texto);
    expect(partes).toEqual(["Estrofa", "Coro"]);
    expect(orden).toEqual(["Estrofa", "Coro", "Estrofa", "Coro"]);
    const estrofa = Object.keys(r.blocks)[0];
    expect(r.blocks[estrofa].lines[0]).toBe("[G]Renuévame");
    expect(r.letra[estrofa]).toEqual([["Renuévame", "Señor Jesús"], ["ya no quiero ser igual"]]);
  });
});

describe("OpenSong", () => {
  it("acordes encima con punto y orden de presentación", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<song><title>Al que está sentado</title><author>Desconocido</author><key>C</key><presentation>V1 C V1</presentation>
<lyrics>[V1]
.C       G
 Al que está sentado
; nota
[C]
 Sea la gloria</lyrics></song>`;
    const [c] = cancionesDeTextoArchivo(xml, "Al que esta sentado");
    expect(c).toMatchObject({ titulo: "Al que está sentado", tonalidad: "C" });
    const { orden, r } = etiquetas(c.texto);
    expect(orden).toEqual(["Estrofa", "Coro", "Estrofa"]);
    expect(Object.values(r.blocks)[0].lines[0]).toBe("[C]Al que e[G]stá sentado");
    expect(c.texto).not.toMatch(/nota/);
  });
  it("himno con estrofas numeradas", () => {
    const xml = "<song><title>Himno</title><lyrics>[V]\n1Primera estrofa\n2Segunda estrofa</lyrics></song>";
    const { partes } = etiquetas(cancionesDeTextoArchivo(xml)[0].texto);
    expect(partes).toEqual(["Estrofa 1", "Estrofa 2"]);
  });
});

describe("JSON de Holyrics", () => {
  it("varias canciones con párrafos", () => {
    const json = JSON.stringify([
      { title: "Santo", artist: "Coalo", key: "E", lyrics: { paragraphs: [{ text: "Santo santo\nes el Señor" }, { text: "Coro aquí", description: "Coro" }] } },
      { title: "Vacía", lyrics: { paragraphs: [] } },
      { title: "Otra", lyrics: "Linea uno\nLinea dos" },
    ]);
    const lista = cancionesDeTextoArchivo(json, "holyrics.json");
    expect(lista.map((c) => c.titulo)).toEqual(["Santo", "Otra"]);
    expect(lista[0]).toMatchObject({ artista: "Coalo", tonalidad: "E" });
    expect(etiquetas(lista[0].texto).partes).toEqual(["Estrofa", "Coro"]);
  });
});

describe("SongBeamer", () => {
  it("encabezado #Title y bloques con ---", () => {
    const sng = "#Title=Cristo vive\n#Author=Anónimo\n---\nVerse 1\nCristo vive\n---\nChorus\nAleluya";
    const [c] = cancionesDeTextoArchivo(sng, "cristo.sng");
    expect(c).toMatchObject({ titulo: "Cristo vive", artista: "Anónimo" });
    expect(etiquetas(c.texto).partes).toEqual(["Estrofa 1", "Coro"]);
  });
});

describe("archivos completos", () => {
  it("Holyrics .mufl y ProPresenter .pro avisan en vez de fallar callados", async () => {
    await expect(cancionesDeArchivo(archivo("todas.mufl", new Uint8Array([0xac, 0xed, 0, 5, 1])))).rejects.toThrow("HOLYRICS");
    await expect(cancionesDeArchivo(archivo("x.pro", new Uint8Array([1, 2, 3])))).rejects.toThrow("PROPRESENTER");
  });
  it("un .txt queda listo para revisar", async () => {
    const [c] = await cancionesDeArchivo(archivo("Hola.txt", "Coro\nHola Señor\n"));
    expect(c.titulo).toBe("Hola");
    expect(Object.values(c.resultado.blocks)[0].label).toBe("Coro");
  });
});
