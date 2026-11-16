import { supabase } from "./supabaseClient.js";

// Biblias que importa cada iglesia desde un archivo Zefania XML (pedido de Eldin, 2026-11-16). Ver la
// migración 20261122000000_biblias_iglesia.sql. El archivo se lee aquí, en el navegador, y se guarda
// versículo por versículo en versiculos_iglesia.
//
// Formato Zefania (el estándar que usan muchas iglesias para compartir Biblias):
//   <XMLBIBLE biblename="…"><INFORMATION><title/><identifier/><language/></INFORMATION>
//     <BIBLEBOOK bnumber="1" bname="Génesis"><CHAPTER cnumber="1"><VERS vnumber="1">texto</VERS>…
// Los libros van numerados del 1 al 66, igual que en el resto de la app (bookid). Los deuterocanónicos
// (67 en adelante) se dejan fuera, igual que con las demás versiones.

// Para que una cita escrita en español ("Juan 3:16") se encuentre también en una Biblia cuyos libros
// tienen nombre en otro idioma (por ejemplo Ixil).
export const NOMBRES_LIBROS_ES = ["Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut", "1 Samuel", "2 Samuel", "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras", "Nehemías", "Ester", "Job", "Salmos", "Proverbios", "Eclesiastés", "Cantares", "Isaías", "Jeremías", "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós", "Abdías", "Jonás", "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías", "Mateo", "Marcos", "Lucas", "Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios", "Gálatas", "Efesios", "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses", "1 Timoteo", "2 Timoteo", "Tito", "Filemón", "Hebreos", "Santiago", "1 Pedro", "2 Pedro", "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis"];

export const TAMANO_MAXIMO_XML = 30 * 1024 * 1024; // una Biblia completa pesa 4-8 MB; con notas, algo más

// Lee los bytes del archivo respetando la codificación que declara (<?xml … encoding="ISO-8859-1"?>);
// muchas Biblias viejas no vienen en UTF-8 y sin esto las tildes saldrían como "Ã©".
export function decodificarXml(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder("utf-16le").decode(u8);
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder("utf-16be").decode(u8);
  const cabecera = new TextDecoder("latin1").decode(u8.slice(0, 200));
  const m = cabecera.match(/encoding\s*=\s*["']([\w.-]+)["']/i);
  let codificacion = (m ? m[1] : "utf-8").toLowerCase();
  try { return new TextDecoder(codificacion, { fatal: codificacion === "utf-8" }).decode(u8); }
  catch {
    // Declara UTF-8 pero trae bytes de Windows-1252: se lee como tal antes que rechazar el archivo.
    codificacion = "windows-1252";
    return new TextDecoder(codificacion).decode(u8);
  }
}

const nombreDe = (el) => (el.localName || el.nodeName || "").toUpperCase();
const hijos = (el, nombre) => Array.from(el.children || []).filter((h) => nombreDe(h) === nombre);
const atributo = (el, ...nombres) => {
  for (const n of nombres) {
    for (const a of Array.from(el.attributes || [])) if (a.name.toLowerCase() === n) return a.value;
  }
  return null;
};

// Texto de un versículo: sin notas al pie ni referencias cruzadas, con los números de Strong (<gr>) y
// los estilos (<STYLE>) convertidos en su texto normal.
const QUITAR = new Set(["NOTE", "XREF", "MEDIA"]);
function textoVersiculo(el) {
  let t = "";
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3 || n.nodeType === 4) t += n.nodeValue;
    else if (n.nodeType === 1) {
      const nombre = nombreDe(n);
      if (QUITAR.has(nombre)) continue;
      if (nombre === "BR") { t += " "; continue; }
      t += textoVersiculo(n);
    }
  }
  return t;
}
const limpiar = (t) => String(t || "").replace(/\s+/g, " ").trim();

// Sugerencia de abreviatura a partir de lo que trae el archivo ("Biblia Ixil 2005" → "BIXIL").
export function sugerirCodigo(...candidatos) {
  for (const c of candidatos) {
    const limpio = String(c || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (limpio.length >= 2 && limpio.length <= 10) return limpio;
  }
  for (const c of candidatos) {
    const palabras = String(c || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    if (!palabras.length) continue;
    const iniciales = palabras.map((p) => (/^\d+$/.test(p) ? p : p[0])).join("");
    if (iniciales.length >= 2) return iniciales.slice(0, 10);
    return palabras[0].slice(0, 10).padEnd(2, "X");
  }
  return "MIBIBLIA";
}

// Recibe el texto XML; devuelve todo lo necesario para mostrar el resumen y guardarla.
// Lanza un Error con un mensaje para la persona si el archivo no sirve.
export function leerZefania(xml, DOMParserImpl = globalThis.DOMParser) {
  if (!xml || !String(xml).trim()) throw new Error("El archivo está vacío.");
  const doc = new DOMParserImpl().parseFromString(String(xml).replace(/^﻿/, ""), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("El archivo no es un XML válido. Revisa que no esté dañado o incompleto.");
  const raiz = doc.documentElement;
  if (!raiz || nombreDe(raiz) !== "XMLBIBLE") {
    throw new Error("Este archivo no tiene el formato Zefania XML (debe empezar con <XMLBIBLE>). Por ahora solo se puede importar ese formato.");
  }
  const info = hijos(raiz, "INFORMATION")[0];
  const datoInfo = (nombre) => (info ? limpiar(hijos(info, nombre)[0]?.textContent) : "");
  const nombre = limpiar(atributo(raiz, "biblename")) || datoInfo("TITLE") || "Biblia importada";
  const idioma = datoInfo("LANGUAGE");

  const libros = [];
  const versiculos = [];
  const repetidos = new Set();
  let sinNumero = 0;
  hijos(raiz, "BIBLEBOOK").forEach((libroEl, i) => {
    let bookid = Number(atributo(libroEl, "bnumber"));
    if (!Number.isInteger(bookid) || bookid < 1) { bookid = i + 1; sinNumero++; }
    if (bookid > 66 || repetidos.has(bookid)) return;
    repetidos.add(bookid);
    let maxCap = 0;
    for (const capEl of hijos(libroEl, "CHAPTER")) {
      const capitulo = Number(atributo(capEl, "cnumber"));
      if (!Number.isInteger(capitulo) || capitulo < 1 || capitulo > 200) continue;
      const vistos = new Set();
      for (const vEl of hijos(capEl, "VERS")) {
        const versiculo = Number(atributo(vEl, "vnumber"));
        if (!Number.isInteger(versiculo) || versiculo < 1 || versiculo > 250 || vistos.has(versiculo)) continue;
        const texto = limpiar(textoVersiculo(vEl)).slice(0, 4000);
        if (!texto) continue;
        vistos.add(versiculo);
        versiculos.push({ libro: bookid, capitulo, versiculo, texto });
      }
      if (vistos.size) maxCap = Math.max(maxCap, capitulo);
    }
    if (maxCap) {
      const nombreLibro = limpiar(atributo(libroEl, "bname")) || NOMBRES_LIBROS_ES[bookid - 1];
      libros.push({ bookid, name: nombreLibro, chapters: maxCap });
    }
  });
  libros.sort((a, b) => a.bookid - b.bookid);
  if (!versiculos.length) throw new Error("No se encontró ningún versículo en el archivo.");
  if (sinNumero && sinNumero === hijos(raiz, "BIBLEBOOK").length && libros.length !== 66 && libros.length !== 27) {
    throw new Error("Los libros del archivo no traen su número (bnumber) y no se puede saber cuál es cuál.");
  }
  return {
    nombre: nombre.slice(0, 80),
    idioma: idioma.slice(0, 40),
    codigoSugerido: sugerirCodigo(atributo(raiz, "biblename"), datoInfo("IDENTIFIER"), datoInfo("TITLE")),
    libros,
    versiculos,
    testamentos: { antiguo: libros.some((l) => l.bookid <= 39), nuevo: libros.some((l) => l.bookid >= 40) },
  };
}

// Revisión de la abreviatura antes de guardar. existentes = códigos que ya usa la app o la iglesia.
export function errorCodigo(codigo, existentes = []) {
  const c = String(codigo || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(c)) return "La abreviatura debe tener de 2 a 10 letras o números, sin espacios (ej. IXIL).";
  if (existentes.map((x) => String(x).toUpperCase()).includes(c)) return `Ya hay una versión con la abreviatura ${c}. Elige otra.`;
  return null;
}

// ---------------- Base de datos ----------------

const sinTabla = (error) => error && (error.code === "42P01" || error.code === "PGRST205" || /biblias_iglesia|versiculos_iglesia/.test(error.message || ""));

// Las Biblias completas de mi iglesia. null si la migración todavía no está aplicada.
export async function listarBibliasIglesia() {
  const { data, error } = await supabase.from("biblias_iglesia")
    .select("id, codigo, nombre, idioma, libros, total_versiculos, created_at")
    .eq("completa", true).order("created_at", { ascending: true });
  if (error) { if (sinTabla(error)) return null; throw error; }
  return data || [];
}

const LOTE = 1000;

// Guarda una Biblia leída con leerZefania. Si algo falla a medio camino, borra lo subido.
// reemplazaId: la Biblia que esta reemplaza (se borra solo después de que la nueva quedó completa).
export async function importarBiblia({ iglesiaId, usuarioId, datos, codigo, nombre, idioma, reemplazaId = null, onProgreso }) {
  const fila = {
    iglesia_id: iglesiaId,
    codigo: String(codigo).trim().toUpperCase(),
    nombre: String(nombre || datos.nombre).trim().slice(0, 80) || "Biblia importada",
    idioma: String(idioma || "").trim().slice(0, 40) || null,
    libros: datos.libros,
    total_versiculos: datos.versiculos.length,
    completa: false,
    creado_por: usuarioId || null,
  };
  // Al reemplazar con la misma abreviatura: la vieja se renombra un momento para no chocar con la nueva.
  let codigoViejo = null;
  if (reemplazaId) {
    const { data: vieja, error } = await supabase.from("biblias_iglesia").select("codigo").eq("id", reemplazaId).single();
    if (error) throw error;
    codigoViejo = vieja.codigo;
    if (codigoViejo === fila.codigo) {
      const { error: e } = await supabase.from("biblias_iglesia").update({ codigo: "TMP" + Date.now().toString(36).toUpperCase().slice(-7) }).eq("id", reemplazaId);
      if (e) throw e;
    } else codigoViejo = null;
  }
  const devolverCodigo = async () => { if (codigoViejo) await supabase.from("biblias_iglesia").update({ codigo: codigoViejo }).eq("id", reemplazaId); };
  const { data: nueva, error } = await supabase.from("biblias_iglesia").insert(fila).select("id").single();
  if (error) {
    await devolverCodigo();
    if (error.code === "23505") throw new Error(`Ya hay una versión con la abreviatura ${fila.codigo}. Elige otra.`);
    throw error;
  }
  try {
    const total = datos.versiculos.length;
    for (let i = 0; i < total; i += LOTE) {
      const lote = datos.versiculos.slice(i, i + LOTE).map((v) => ({ ...v, biblia_id: nueva.id, iglesia_id: iglesiaId }));
      const { error: e } = await supabase.from("versiculos_iglesia").insert(lote);
      if (e) throw e;
      onProgreso?.(Math.min(total, i + LOTE), total);
    }
    const { error: e2 } = await supabase.from("biblias_iglesia").update({ completa: true }).eq("id", nueva.id);
    if (e2) throw e2;
  } catch (e) {
    await supabase.from("biblias_iglesia").delete().eq("id", nueva.id);
    await devolverCodigo();
    throw e;
  }
  if (reemplazaId) await supabase.from("biblias_iglesia").delete().eq("id", reemplazaId);
  return nueva.id;
}

export async function borrarBibliaIglesia(id) {
  const { error } = await supabase.from("biblias_iglesia").delete().eq("id", id);
  if (error) throw error;
}

// Mismo formato que bolls.life: [{ verse, text }].
export async function capituloBibliaIglesia(bibliaId, libro, capitulo) {
  const { data, error } = await supabase.from("versiculos_iglesia").select("versiculo, texto")
    .eq("biblia_id", bibliaId).eq("libro", libro).eq("capitulo", capitulo).order("versiculo");
  if (error) throw new Error("No se pudo cargar el capítulo.");
  return (data || []).map((v) => ({ verse: v.versiculo, text: v.texto }));
}

// Búsqueda por palabras; mismo formato que los resultados de bolls.life.
export async function buscarEnBibliaIglesia(bibliaId, texto) {
  const limpio = String(texto || "").replace(/[%_\\,()]/g, " ").trim();
  if (!limpio) return [];
  const { data, error } = await supabase.from("versiculos_iglesia").select("libro, capitulo, versiculo, texto")
    .eq("biblia_id", bibliaId).ilike("texto", `%${limpio}%`).order("libro").order("capitulo").order("versiculo").limit(200);
  if (error) throw new Error("No se pudo buscar en la Biblia.");
  return (data || []).map((v) => ({ pk: `${v.libro}-${v.capitulo}-${v.versiculo}`, book: v.libro, chapter: v.capitulo, verse: v.versiculo, text: v.texto }));
}
