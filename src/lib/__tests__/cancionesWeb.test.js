import { describe, expect, it } from "vitest";
import fs from "fs";
import { resultadosDeLaCuerda, cancionDeLaCuerda, limpiarTextoDeAcordes, decodificarHtml, enlacesDeBusqueda } from "../cancionesWeb.js";
import { textoACancion } from "../textoCancion.js";

// Páginas reales de LaCuerda.net (recortadas a la parte que se lee), bajadas el 2026-11-11.
const leer = (nombre) => fs.readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url), "utf8");

describe("buscar canciones en internet (LaCuerda)", () => {
  it("resultados: título, artista, dirección de la canción y versiones de acordes", () => {
    const r = resultadosDeLaCuerda(leer("lacuerda-busqueda.html"));
    expect(r.length).toBeGreaterThan(20);
    expect(r[0]).toEqual({ titulo: "Cuan grande es el", artista: "Renacer", ruta: "renacer/cuan_grande_es_el", versiones: [1] });
    expect(r[1]).toEqual({ titulo: "Cuan grande es él", artista: "Rojo", ruta: "rojo/cuan_grande_es_el", versiones: [1, 2, 3] });
    expect(r.find((x) => x.artista === "Marcos Witt")).toMatchObject({ ruta: "marcos_witt/cuan_grande_es_el", versiones: [1, 2] });
    expect(r.every((x) => /^[a-z0-9_-]+\/[a-z0-9_-]+$/.test(x.ruta))).toBe(true);
  });
  it("solo cuentan las versiones de acordes (no tablatura, bajo ni teclado)", () => {
    const html = `<a href="/uno/">Uno</A><li id='r000' lcd='TB-12'><a href="javascript:">Sin acordes</a></li>
      <li id='r001' lcd='KRRT-1234'><a href="javascript:">Con acordes</a></li>
      <script>var hds=['uno','uno'];\nvar fns=['sin_acordes','con_acordes'];\nvar NMAX=1;</script>`;
    expect(resultadosDeLaCuerda(html)).toEqual([{ titulo: "Con acordes", artista: "Uno", ruta: "uno/con_acordes", versiones: [2, 3] }]);
  });
  it("una página sin resultados (o que no es de resultados) da lista vacía", () => {
    expect(resultadosDeLaCuerda("<html><body>nada</body></html>")).toEqual([]);
    expect(resultadosDeLaCuerda(null)).toEqual([]);
  });

  it("canción: título, artista y los acordes quedan cada uno en su sílaba", () => {
    const c = cancionDeLaCuerda(leer("lacuerda-cancion.html"));
    expect(c.titulo).toBe("Cuan grande es El");
    expect(c.artista).toBe("Marcos Witt");
    expect(c.texto).not.toMatch(/<|>/);
    const r = textoACancion(c.texto);
    const lineas = Object.values(r.blocks).flatMap((b) => b.lines);
    expect(lineas).toContain("Señor mi D[D]ios Al contemp[F#]lar los c[G]ielos");
    expect(Object.values(r.blocks).map((b) => b.label)).toEqual(["Estrofa", "Coro"]);
    expect(r.tonalidadSugerida).toBe("D");
  });
  it("canción con partes nombradas ('V1:', 'Coro:') y palabras que el sitio marca como acorde (MI, LA)", () => {
    const c = cancionDeLaCuerda(leer("lacuerda-cancion-v2.html"));
    const r = textoACancion(c.texto);
    expect(Object.values(r.blocks).map((b) => b.label)).toEqual(["Estrofa 1", "Coro"]);
    const coro = Object.values(r.blocks).find((b) => b.label === "Coro").lines.join("\n");
    expect(coro).toContain("MI cora[A]zón[A/C#]    ent[D]ona [D#dim7]  LA");
    // Lo que se proyecta va sin acordes.
    expect(Object.values(r.letra).flat(2).join(" ")).not.toMatch(/\[/);
  });
  it("una página que no es una canción da null", () => {
    expect(cancionDeLaCuerda("<html><body>No existe</body></html>")).toBeNull();
    expect(cancionDeLaCuerda("<div id=t_body><PRE>  \n </PRE></div>")).toBeNull();
  });

  it("limpia las costumbres del sitio sin tocar las líneas de acordes", () => {
    expect(limpiarTextoDeAcordes("   C O R O\n\n\n\nD G A D\nletra  \n\n")).toBe("   CORO\n\nD G A D\nletra");
    expect(limpiarTextoDeAcordes("v2.\nletra")).toBe("Estrofa 2\nletra");
  });
  it("entidades HTML y enlaces a los sitios que no se pueden leer", () => {
    expect(decodificarHtml("Se&ntilde;or &amp; Dios &#233;l &#xE9;l &raro;")).toBe("Señor & Dios él él &raro;");
    const e = enlacesDeBusqueda("cuán grande");
    expect(e.map((x) => x.nombre)).toEqual(["Cifra Club", "Letras.com", "Google"]);
    expect(e[0].url).toBe("https://www.cifraclub.com/?q=cu%C3%A1n%20grande");
  });
});
