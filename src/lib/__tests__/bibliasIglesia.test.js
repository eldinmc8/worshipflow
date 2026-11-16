// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
vi.mock("../supabaseClient.js", () => ({ supabase: {} }));
const { leerZefania, decodificarXml, sugerirCodigo, errorCodigo } = await import("../bibliasIglesia.js");

// Biblias importadas por la iglesia en formato Zefania XML (pedido de Eldin, 2026-11-16).
const XML = `<?xml version="1.0" encoding="utf-8"?>
<XMLBIBLE xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" biblename="Biblia Ixil de prueba">
  <INFORMATION><title>Ixil</title><identifier>IXL</identifier><language>Ixil</language></INFORMATION>
  <BIBLEBOOK bnumber="19" bname="Salmo">
    <CHAPTER cnumber="23"><CAPTION>Salmo de David</CAPTION><VERS vnumber="1">Kub'aal <STYLE css="x">Dios</STYLE> u'l nuk'<NOTE>nota al pie</NOTE></VERS></CHAPTER>
  </BIBLEBOOK>
  <BIBLEBOOK bnumber="43" bname="Juan" bsname="Jn">
    <CHAPTER cnumber="3">
      <VERS vnumber="16">Ye' Kub'aal  tib'i<gr str="25">tz'ik</gr>
        as texto</VERS>
      <VERS vnumber="16">repetido</VERS>
      <VERS vnumber="17"></VERS>
    </CHAPTER>
  </BIBLEBOOK>
  <BIBLEBOOK bnumber="70" bname="Tobías"><CHAPTER cnumber="1"><VERS vnumber="1">fuera</VERS></CHAPTER></BIBLEBOOK>
</XMLBIBLE>`;

describe("leer Zefania XML", () => {
  it("trae nombre, idioma, libros con su número y versículos limpios", () => {
    const d = leerZefania(XML);
    expect(d.nombre).toBe("Biblia Ixil de prueba");
    expect(d.idioma).toBe("Ixil");
    expect(d.libros).toEqual([{ bookid: 19, name: "Salmo", chapters: 23 }, { bookid: 43, name: "Juan", chapters: 3 }]);
    expect(d.versiculos).toEqual([
      { libro: 19, capitulo: 23, versiculo: 1, texto: "Kub'aal Dios u'l nuk'" },
      { libro: 43, capitulo: 3, versiculo: 16, texto: "Ye' Kub'aal tib'itz'ik as texto" },
    ]);
    expect(d.testamentos).toEqual({ antiguo: true, nuevo: true });
  });

  it("rechaza lo que no es Zefania con un mensaje claro", () => {
    expect(() => leerZefania("")).toThrow(/vacío/);
    expect(() => leerZefania("<osis><div/></osis>")).toThrow(/Zefania/);
    expect(() => leerZefania("<XMLBIBLE><BIBLEBOOK")).toThrow(/XML válido/);
    expect(() => leerZefania("<XMLBIBLE biblename='x'></XMLBIBLE>")).toThrow(/ningún versículo/);
  });

  it("respeta la codificación declarada (Biblias viejas en ISO-8859-1)", () => {
    const texto = `<?xml version="1.0" encoding="ISO-8859-1"?><XMLBIBLE biblename="Señor"><BIBLEBOOK bnumber="1" bname="Génesis"><CHAPTER cnumber="1"><VERS vnumber="1">Él creó</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`;
    const bytes = Uint8Array.from(Array.from(texto).map((c) => c.charCodeAt(0)));
    const d = leerZefania(decodificarXml(bytes));
    expect(d.nombre).toBe("Señor");
    expect(d.libros[0].name).toBe("Génesis");
    expect(d.versiculos[0].texto).toBe("Él creó");
  });

  it("sugiere y revisa la abreviatura", () => {
    expect(sugerirCodigo("Ixil")).toBe("IXIL");
    expect(sugerirCodigo("Biblia en Ixil de Nebaj 2005")).toBe("BEIDN2005");
    expect(errorCodigo("IXIL", ["RV1960"])).toBeNull();
    expect(errorCodigo("rv1960", ["RV1960"])).toMatch(/Ya hay/);
    expect(errorCodigo("con espacio", [])).toMatch(/2 a 10/);
  });
});

