import { textoACancion, leerEncabezado, aAmericano } from "./textoCancion.js";

// Importar canciones desde otros programas (pedido de Eldin, 2026-11-26: "algo fácil", porque la
// página ya promete que se pueden traer las canciones). Un solo botón recibe uno o muchos archivos
// de un solo y la app reconoce sola qué es cada uno — por lo que trae adentro, no solo por el nombre:
//   - PDF (lo lee importarCancionesPdf.js)
//   - Texto .txt (uno por canción, o varios en un archivo con "Título:" arriba de cada una):
//     así exportan ProPresenter ("Como texto plano"), MediaShout, EasyWorship vía OpenLP y casi todos.
//   - Word .docx con la letra
//   - ChordPro (.cho, .chopro, .chordpro, .crd): OnSong, SongSelect, muchos cancioneros
//   - OpenLyrics .xml: lo que exportan OpenLP y otros (y OpenLP lee EasyWorship y SongShow Plus)
//   - OpenSong (archivos sin extensión, en XML)
//   - JSON de Holyrics (Holyrics File JSON)
//   - SongBeamer .sng
// Todo termina en el mismo texto de "Pegar canción completa" (ver textoCancion.js) y pasa por la
// misma revisión del importador antes de guardar. La letra NUNCA se cambia: solo se quitan cosas
// que no son letra (CCLI, comentarios de los programas).
//
// No se leen (todavía): el formato propio de Holyrics (.muf/.mufl/.hpls, un objeto de Java sin
// documentar) ni las presentaciones de ProPresenter (.pro); para esos se explica qué hacer.

const sinExtension = (nombre) => String(nombre || "Canción").replace(/\.[a-z0-9]{1,8}$/i, "").replace(/_+/g, " ").replace(/\s+/g, " ").trim() || "Canción";
const extension = (nombre) => (String(nombre || "").match(/\.([a-z0-9]{1,8})$/i) || [])[1]?.toLowerCase() || "";

// ---- Bytes → texto (UTF-8, UTF-16 con marca, o Windows-1252 de los programas viejos) ----
export function decodificarTexto(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// ---- ¿Qué es este archivo? ----
export function tipoDeArchivoCancion(nombre, bytes) {
  const ext = extension(nombre);
  const empieza = (...b) => b.every((x, i) => bytes[i] === x);
  if (ext === "pdf" || empieza(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (empieza(0xac, 0xed) || ["muf", "mufl", "hpls"].includes(ext)) return "holyrics";
  if (ext === "pro" || ext === "pro6" || ext === "pro7" || ext === "proplaylist") return "propresenter";
  if (empieza(0x50, 0x4b)) return ext === "docx" ? "docx" : "zip"; // PK = archivo comprimido
  if (["doc", "ppt", "pptx", "key", "pages", "xls", "xlsx"].includes(ext)) return "otro";
  // Muchos ceros = archivo binario que no es texto.
  const muestra = bytes.subarray(0, 2000);
  const ceros = muestra.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  if (ceros > muestra.length * 0.1 && !(bytes[0] === 0xff && bytes[1] === 0xfe) && !(bytes[0] === 0xfe && bytes[1] === 0xff)) return "otro";
  return "texto"; // el contenido decide (ver tipoDeTexto)
}

export function tipoDeTexto(texto, nombre = "") {
  const t = texto.trim();
  const ext = extension(nombre);
  if (/^[[{]/.test(t)) { try { JSON.parse(t); return "json"; } catch { /* no es JSON */ } }
  if (/^<(\?xml|song[\s>])/i.test(t)) {
    if (/openlyrics|<verse[\s>]/i.test(t)) return "openlyrics";
    if (/<lyrics[\s>]/i.test(t)) return "opensong";
  }
  if (["cho", "chopro", "chordpro", "crd", "chordpro"].includes(ext) || /^\s*\{\s*(title|t|soc|start_of_chorus|sov|start_of_verse|new_song|ns)\s*[:}]/im.test(t)) return "chordpro";
  if (ext === "sng" || /^#(Title|LangCount|Editor)=/m.test(t)) return "songbeamer";
  return "texto";
}

// ---- Texto simple (.txt, Word, ProPresenter "texto plano", MediaShout…) ----
const RE_META = /^\s*(t[ií]tulo|title|autor(?:es)?|author|artista|artist|tono|tonalidad|key|tempo|bpm)\s*[:=]\s*(.*)$/i;
const RE_NO_LETRA = /^\s*(ccli\b|©|\(c\)\s|copyright\b|derechos reservados|all rights reserved|licencia ccli|ccli license)/i;

export function cancionesDeTexto(texto, nombre = "") {
  const limpio = String(texto || "").replace(/\r\n?/g, "\n");
  // Varias canciones en un archivo: separadas por salto de página o con "Título:" arriba de cada una.
  let trozos = limpio.split("\f");
  if (trozos.length === 1) {
    const lineas = limpio.split("\n");
    const inicios = lineas.map((l, i) => (/^\s*(t[ií]tulo|title)\s*[:=]/i.test(l) ? i : -1)).filter((i) => i >= 0);
    if (inicios.length >= 2) {
      trozos = inicios.map((ini, n) => lineas.slice(n === 0 ? 0 : ini, inicios[n + 1] ?? lineas.length).join("\n"));
    }
  }
  return trozos.map((tr) => cancionDeTexto(tr, trozos.length === 1 ? nombre : "")).filter((c) => c.texto.trim());
}

function cancionDeTexto(texto, nombre) {
  let titulo = "", artista = "", tonalidad = "", tempo = "";
  const cuerpo = [];
  texto.split("\n").forEach((l) => {
    const meta = l.match(RE_META);
    if (meta && meta[2].trim()) {
      const campo = meta[1].toLowerCase();
      const valor = meta[2].trim();
      if (/^t[ií]tulo|^title/.test(campo)) { if (!titulo) titulo = valor; return; }
      if (/^autor|^author|^artist/.test(campo)) { if (!artista) artista = valor; return; }
      if (/^tono|^tonalidad|^key/.test(campo)) { if (!tonalidad) tonalidad = aAmericano(valor.split(/\s/)[0]); return; }
      if (/^tempo|^bpm/.test(campo)) { if (!tempo) tempo = (valor.match(/\d+/) || [""])[0]; return; }
    }
    if (RE_NO_LETRA.test(l)) return;
    cuerpo.push(l.replace(/\s+$/, ""));
  });
  let letra = cuerpo.join("\n").replace(/^\n+|\n+$/g, "");
  if (!titulo) {
    // El título suele ir solo en la primera línea (ProPresenter, copiar de un programa).
    const r = textoACancion(letra);
    if (r.tituloSugerido) {
      titulo = r.tituloSugerido;
      letra = letra.replace(/^[^\n]*\n?/, "").replace(/^\n+/, "");
      const partido = cuerpo.find((l) => l.trim())?.trim().match(/^.+?\s+[-–—]\s+(.+)$/);
      if (partido && !artista) artista = partido[1].trim();
    } else titulo = sinExtension(nombre);
  }
  return { titulo, artista, tonalidad, tempo, texto: letra };
}

// ---- ChordPro ----
export function cancionesDeChordPro(texto, nombre = "") {
  const canciones = [];
  let c = null;
  const nueva = () => { c = { titulo: "", artista: "", tonalidad: "", tempo: "", lineas: [], usaPartes: false, pideNombre: true, estrofas: 0 }; canciones.push(c); };
  nueva();
  const agregarEncabezado = (etiqueta) => {
    if (c.lineas.length && c.lineas[c.lineas.length - 1] !== "") c.lineas.push("");
    c.lineas.push(leerEncabezado(`[${etiqueta}]`) ? `[${etiqueta}]` : `#${etiqueta}`);
    c.pideNombre = false;
  };
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  c.usaPartes = lineas.some((l) => /^\s*\{\s*(start_of_|so[cvb]\b)/i.test(l));
  lineas.forEach((l) => {
    const d = l.trim().match(/^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i);
    if (d) {
      const dir = d[1].toLowerCase();
      const valor = (d[2] || "").trim();
      if (dir === "new_song" || dir === "ns") { const usa = c.usaPartes; nueva(); c.usaPartes = usa; return; }
      if (dir === "title" || dir === "t") { c.titulo = valor; return; }
      if (["artist", "subtitle", "st", "composer", "lyricist"].includes(dir)) { if (!c.artista || dir === "artist") c.artista = valor; return; }
      if (dir === "key") { c.tonalidad = aAmericano(valor); return; }
      if (dir === "tempo") { c.tempo = (valor.match(/\d+/) || [""])[0]; return; }
      if (dir === "start_of_chorus" || dir === "soc") return agregarEncabezado(valor || "Coro");
      if (dir === "start_of_verse" || dir === "sov") return agregarEncabezado(valor || `Estrofa ${++c.estrofas}`);
      if (dir === "start_of_bridge" || dir === "sob") return agregarEncabezado(valor || "Puente");
      if (/^(end_of_|eo[cvbt]$)/.test(dir)) { c.lineas.push(""); c.pideNombre = true; return; }
      if (dir === "chorus") { agregarEncabezado(valor || "Coro"); c.lineas.push(""); c.pideNombre = true; return; }
      if (["comment", "c", "ci", "cb", "comment_italic", "comment_box", "highlight"].includes(dir)) {
        if (leerEncabezado(valor)) agregarEncabezado(leerEncabezado(valor).etiqueta);
        return; // otros comentarios ("repetir 2 veces") no son letra
      }
      return; // cualquier otra instrucción del formato
    }
    if (/^\s*#/.test(l)) return; // comentario de ChordPro
    if (l.trim() && c.usaPartes && c.pideNombre && !leerEncabezado(l)) agregarEncabezado(`Estrofa ${++c.estrofas}`);
    if (leerEncabezado(l)) c.pideNombre = false;
    c.lineas.push(l.replace(/\s+$/, ""));
  });
  return canciones
    .map((x, i) => ({ titulo: x.titulo || (i === 0 ? sinExtension(nombre) : `Canción ${i + 1}`), artista: x.artista, tonalidad: x.tonalidad, tempo: x.tempo, texto: x.lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim() }))
    .filter((x) => x.texto);
}

// ---- Ayudas para XML ----
const hijos = (el, nombre) => [...(el?.getElementsByTagName("*") || [])].filter((e) => e.localName === nombre);
const primero = (el, nombre) => hijos(el, nombre)[0] || null;
const textoDe = (el) => (el?.textContent || "").trim();
function leerXml(texto) {
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("XML_MALO");
  return doc;
}
const NOMBRE_PARTE = { v: "Estrofa", c: "Coro", p: "Pre-coro", b: "Puente", i: "Intro", e: "Final", t: "Tag", o: "Otra parte" };
// "v1" → "Estrofa 1", "c" → "Coro". solo: si es la única de su tipo se deja sin número.
function nombreDeCodigo(codigo, solo) {
  const m = String(codigo || "").trim().match(/^([a-z])[a-z]*\s*(\d*)([a-z]?)$/i);
  if (!m) return codigo;
  const base = NOMBRE_PARTE[m[1].toLowerCase()] || codigo;
  return m[2] && !solo ? `${base} ${m[2]}` : base;
}
const encabezadoTexto = (etiqueta) => (leerEncabezado(`[${etiqueta}]`) ? `[${etiqueta}]` : `#${etiqueta}`);

// Arma el texto con las partes en el orden de la canción: la primera vez va con su letra; las
// siguientes, solo el nombre (= se repite). Las que no están en el orden van al final.
function textoEnOrden(partes, orden) {
  const salida = [];
  const usadas = new Set();
  const poner = (p) => {
    if (salida.length) salida.push("");
    salida.push(encabezadoTexto(p.etiqueta));
    if (!usadas.has(p.codigo)) { salida.push(...p.lineas); usadas.add(p.codigo); }
  };
  // "c" y "c1" son la misma parte (OpenLP y OpenSong escriben el orden de las dos formas).
  const igual = (a, b) => { const n = (x) => x.trim().toLowerCase().replace(/^([a-z]+)1$/, "$1"); return n(a) === n(b); };
  orden.forEach((cod) => { const p = partes.find((x) => igual(x.codigo, cod)); if (p) poner(p); });
  partes.forEach((p) => { if (!usadas.has(p.codigo)) poner(p); });
  return salida.join("\n").trim();
}
function etiquetar(partes) {
  const cuantas = {};
  partes.forEach((p) => { const k = p.codigo.charAt(0).toLowerCase(); cuantas[k] = (cuantas[k] || 0) + 1; });
  partes.forEach((p) => { p.etiqueta = nombreDeCodigo(p.codigo, cuantas[p.codigo.charAt(0).toLowerCase()] === 1); });
}

// ---- OpenLyrics (OpenLP y otros) ----
export function cancionesDeOpenLyrics(texto, nombre = "") {
  const doc = leerXml(texto);
  const cancion = doc.documentElement;
  const titulo = textoDe(primero(cancion, "title")) || sinExtension(nombre);
  const autores = hijos(cancion, "author").filter((a) => a.getAttribute("type") !== "translation").map(textoDe).filter(Boolean);
  const tonalidad = aAmericano(textoDe(primero(cancion, "key")));
  const tempoEl = primero(cancion, "tempo");
  const tempo = tempoEl && (tempoEl.getAttribute("type") || "bpm") === "bpm" ? (textoDe(tempoEl).match(/\d+/) || [""])[0] : "";
  // Un renglón de <lines>: texto, <br/> = salto, <chord> = [Acorde] (0.8: name="G"; 0.9: root/structure/bass).
  const renglon = (nodo) => {
    let out = "";
    nodo.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += n.nodeValue.replace(/\s*\n\s*/g, " ");
      else if (n.nodeType === 1) {
        const tag = n.localName;
        if (tag === "br") out += "\n";
        else if (tag === "comment") { /* nota para el que proyecta, no es letra */ }
        else if (tag === "chord") {
          const nombreAcorde = n.getAttribute("name") || `${n.getAttribute("root") || ""}${n.getAttribute("structure") === "major" ? "" : (n.getAttribute("structure") || "").replace(/^minor$/, "m")}${n.getAttribute("bass") ? `/${n.getAttribute("bass")}` : ""}`;
          if (nombreAcorde) out += `[${nombreAcorde}]`;
          out += renglon(n);
        } else out += renglon(n);
      }
    });
    return out;
  };
  const partes = hijos(cancion, "verse").filter((v) => !v.getAttribute("lang") || v.getAttribute("lang") === hijos(cancion, "verse")[0].getAttribute("lang")).map((v, i) => {
    const lineas = [];
    hijos(v, "lines").forEach((ls, k) => {
      if (k > 0) lineas.push(""); // cada <lines> es una diapositiva
      renglon(ls).split("\n").forEach((r) => lineas.push(r.trim()));
    });
    return { codigo: v.getAttribute("name") || `v${i + 1}`, lineas };
  });
  etiquetar(partes);
  const orden = textoDe(primero(cancion, "verseOrder")).split(/\s+/).filter(Boolean);
  return [{ titulo, artista: autores.join(", "), tonalidad, tempo, texto: textoEnOrden(partes, orden) }].filter((c) => c.texto);
}

// ---- OpenSong ----
export function cancionesDeOpenSong(texto, nombre = "") {
  const doc = leerXml(texto);
  const s = doc.documentElement;
  const campo = (n) => textoDe([...s.children].find((e) => e.localName === n));
  const partes = [];
  let actual = null;
  campo("lyrics").replace(/\r\n?/g, "\n").split("\n").forEach((l) => {
    const enc = l.match(/^\[\s*([^\]]+?)\s*\]\s*$/);
    if (enc) { actual = { codigo: enc[1], lineas: [] }; partes.push(actual); return; }
    if (/^;/.test(l)) return; // comentario
    if (!actual) { actual = { codigo: "V", lineas: [] }; partes.push(actual); }
    if (/^\s*(\|\||---|-!!)\s*$/.test(l)) { actual.lineas.push(""); return; }
    if (/^\./.test(l)) { actual.lineas.push({ acordes: l.slice(1) }); return; }
    const num = l.match(/^(\d)(.*)$/);
    if (num) { actual.lineas.push({ num: num[1], letra: num[2].replace(/\|\|?/g, " ").replace(/\s+$/, "") }); return; }
    actual.lineas.push(l.replace(/^ /, "").replace(/\|\|?/g, " ").replace(/\s+$/, ""));
  });
  // Himnos: "[V]" con renglones "1 …", "2 …" = una estrofa por número (los acordes sirven para todas).
  const finales = [];
  partes.forEach((p) => {
    const nums = [...new Set(p.lineas.filter((x) => x?.num).map((x) => x.num))];
    const aTexto = (x) => (typeof x === "string" ? x : x.acordes !== undefined ? x.acordes : x.letra);
    if (!nums.length) { finales.push({ codigo: p.codigo, lineas: p.lineas.map(aTexto) }); return; }
    nums.forEach((n) => finales.push({ codigo: /\d/.test(p.codigo) ? p.codigo : `${p.codigo}${n}`, lineas: p.lineas.filter((x) => !x?.num || x.num === n).map(aTexto) }));
  });
  finales.forEach((p) => { while (p.lineas.length && !p.lineas[p.lineas.length - 1].trim()) p.lineas.pop(); });
  etiquetar(finales);
  const orden = campo("presentation").split(/\s+/).filter(Boolean);
  return [{
    titulo: campo("title") || sinExtension(nombre), artista: campo("author"), tonalidad: aAmericano(campo("key")),
    tempo: (campo("tempo").match(/\d+/) || [""])[0], texto: textoEnOrden(finales.filter((p) => p.lineas.some((x) => x.trim())), orden),
  }].filter((c) => c.texto);
}

// ---- JSON de Holyrics ("Holyrics File JSON") ----
export function cancionesDeJsonHolyrics(texto, nombre = "") {
  const datos = JSON.parse(texto);
  const lista = Array.isArray(datos) ? datos : Array.isArray(datos?.songs) ? datos.songs : Array.isArray(datos?.data) ? datos.data : [datos];
  return lista.filter((x) => x && typeof x === "object").map((s, i) => {
    const parrafos = s.paragraphs || s.lyrics?.paragraphs;
    let letra = "";
    if (Array.isArray(parrafos)) {
      letra = parrafos.map((p) => {
        const t = String(typeof p === "string" ? p : p?.text ?? "").replace(/\r\n?/g, "\n").trim();
        const desc = String(p?.description || "").trim();
        return desc && desc.length <= 30 && t ? `${encabezadoTexto(desc)}\n${t}` : t;
      }).filter(Boolean).join("\n\n");
    } else {
      letra = String((typeof s.lyrics === "string" ? s.lyrics : s.lyrics?.full_text) ?? s.full_text ?? s.text ?? "").replace(/\r\n?/g, "\n").trim();
    }
    return {
      titulo: String(s.title || s.name || "").trim() || (lista.length === 1 ? sinExtension(nombre) : `Canción ${i + 1}`),
      artista: String(s.artist || s.author || "").trim(),
      tonalidad: aAmericano(String(s.key || "").trim()),
      tempo: String(s.bpm || s.tempo || "").match(/\d+/)?.[0] || "",
      texto: letra,
    };
  }).filter((c) => c.texto);
}

// ---- SongBeamer (.sng) ----
export function cancionesDeSongBeamer(texto, nombre = "") {
  const meta = {};
  const cuerpo = [];
  String(texto || "").replace(/\r\n?/g, "\n").split("\n").forEach((l) => {
    const m = l.match(/^#([A-Za-z]+)=(.*)$/);
    if (m && !cuerpo.length) { meta[m[1].toLowerCase()] = m[2].trim(); return; }
    cuerpo.push(/^-{2,3}\s*$/.test(l) ? "" : l.replace(/\s+$/, ""));
  });
  // El primer renglón de un bloque suele ser el nombre de la parte (Verse 1, Chorus, Strophe 1, Refrain).
  const lineas = cuerpo.map((l, i) => {
    const nombreParte = l.match(/^(Strophe|Refrain|Bridge|Vers)\s*(\d*)$/i);
    if ((i === 0 || cuerpo[i - 1] === "") && nombreParte) {
      const base = { strophe: "Estrofa", vers: "Estrofa", refrain: "Coro", bridge: "Puente" }[nombreParte[1].toLowerCase()];
      return `[${nombreParte[2] ? `${base} ${nombreParte[2]}` : base}]`;
    }
    return l;
  });
  return [{
    titulo: meta.title || sinExtension(nombre), artista: meta.author || meta.melody || "",
    tonalidad: aAmericano(meta.key || ""), tempo: (meta.tempo || "").match(/\d+/)?.[0] || "",
    texto: lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  }].filter((c) => c.texto);
}

// ---- Archivo → canciones listas para revisar ----
// Devuelve [{ titulo, artista, tonalidad, tempo, texto, resultado }] o lanza un Error cuyo mensaje es
// un código que la ventana convierte en explicación: HOLYRICS, PROPRESENTER, NO_SE_LEE, SIN_TEXTO.
export async function cancionesDeArchivo(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoDeArchivoCancion(file.name, bytes);
  if (tipo === "pdf") {
    const { cancionesDePdf } = await import("./importarCancionesPdf.js");
    return cancionesDePdf(file);
  }
  if (tipo === "holyrics") throw new Error("HOLYRICS");
  if (tipo === "propresenter") throw new Error("PROPRESENTER");
  if (tipo === "zip" || tipo === "otro") throw new Error("NO_SE_LEE");
  let lista;
  if (tipo === "docx") {
    const modulo = await import("mammoth/mammoth.browser.js");
    const mammoth = modulo.extractRawText ? modulo : modulo.default;
    const { value } = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
    lista = cancionesDeTexto(value, file.name);
  } else lista = cancionesDeTextoArchivo(decodificarTexto(bytes), file.name);
  if (!lista.length) throw new Error("SIN_TEXTO");
  return lista.map((c) => ({ ...c, resultado: textoACancion(c.texto) }));
}

// El texto de un archivo, según lo que trae adentro (separado para poder probarlo sin archivos).
export function cancionesDeTextoArchivo(texto, nombre = "") {
  switch (tipoDeTexto(texto, nombre)) {
    case "json": return cancionesDeJsonHolyrics(texto, nombre);
    case "openlyrics": return cancionesDeOpenLyrics(texto, nombre);
    case "opensong": return cancionesDeOpenSong(texto, nombre);
    case "chordpro": return cancionesDeChordPro(texto, nombre);
    case "songbeamer": return cancionesDeSongBeamer(texto, nombre);
    default: return cancionesDeTexto(texto, nombre);
  }
}
