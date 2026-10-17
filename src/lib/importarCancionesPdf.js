import { esLineaDeAcordes, aAmericano, leerEncabezado, textoACancion } from "./textoCancion.js";

// Importar canciones desde PDF (pedido de Eldin, 2026-10-17): un equipo que ya tiene sus canciones en
// PDF las sube de una vez — un PDF por canción (LaCuerda, Cifra Club, OnSong…) o un cancionero con
// muchas — y quedan como canciones normales: letra, acordes en su sílaba, partes y diapositivas.
//
// Todo trabaja con la POSICIÓN de cada texto en la página (no solo con el texto), porque en un PDF los
// acordes van ENCIMA de la letra: el acorde se pega a la sílaba que tiene justo debajo según su
// posición horizontal. Con letra de ancho fijo (Courier, típico de LaCuerda) queda exacto; con letra
// proporcional puede correrse una letra, por eso el importador deja revisar antes de guardar.

// ---- 1) Texto del PDF → líneas con posición ----
// items: [{ str, x, y, w, h, pagina }] — y crece hacia ARRIBA (coordenadas de PDF).
export function lineasDeItems(items) {
  const porPagina = new Map();
  items.filter((it) => it.str && it.str.trim()).forEach((it) => {
    if (!porPagina.has(it.pagina)) porPagina.set(it.pagina, []);
    porPagina.get(it.pagina).push(it);
  });
  const lineas = [];
  [...porPagina.keys()].sort((a, b) => a - b).forEach((pagina) => {
    const its = porPagina.get(pagina).sort((a, b) => b.y - a.y || a.x - b.x);
    const grupos = [];
    its.forEach((it) => {
      const g = grupos.find((gr) => Math.abs(gr.y - it.y) < Math.max(2, Math.min(gr.h, it.h) * 0.45));
      if (g) { g.items.push(it); g.h = Math.max(g.h, it.h); } else grupos.push({ y: it.y, h: it.h, items: [it] });
    });
    grupos.sort((a, b) => b.y - a.y).forEach((g) => {
      g.items.sort((a, b) => a.x - b.x);
      lineas.push({ pagina, y: g.y, alto: g.h, items: g.items, ...textoConPosiciones(g.items) });
    });
  });
  return lineas;
}

// Une los pedazos de una línea en un solo texto y guarda la X de cada letra (para pegar acordes).
function textoConPosiciones(items) {
  let texto = "";
  const xs = [];
  let finAnterior = null;
  items.forEach((it) => {
    const ancho = it.str.length ? it.w / it.str.length : 0;
    if (finAnterior !== null) {
      const hueco = it.x - finAnterior;
      const espacios = ancho > 0 ? Math.round(hueco / ancho) : 0;
      if (hueco > ancho * 0.3 && !texto.endsWith(" ") && !it.str.startsWith(" ")) {
        for (let k = 0; k < Math.max(1, espacios); k++) { texto += " "; xs.push(finAnterior + k * ancho); }
      }
    }
    for (let k = 0; k < it.str.length; k++) { texto += it.str[k]; xs.push(it.x + k * ancho); }
    finAnterior = it.x + it.w;
  });
  return { texto: texto.replace(/\s+$/, ""), xs };
}

// ---- 2) Acordes encima → [Acorde] dentro de la letra ----
function acordesConPosicion(linea) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(linea.texto))) out.push({ acorde: aAmericano(m[0]), x: linea.xs[m.index] ?? 0 });
  return out;
}
export function pegarAcordes(lineaAcordes, lineaLetra) {
  let texto = lineaLetra.texto;
  const xs = lineaLetra.xs;
  const inserciones = acordesConPosicion(lineaAcordes).map(({ acorde, x }) => {
    // La letra cuyo inicio queda más cerca (por la izquierda) de donde empieza el acorde.
    let idx = 0;
    for (let i = 0; i < xs.length; i++) { if (xs[i] <= x + 1.5) idx = i; else break; }
    if (x > (xs[xs.length - 1] ?? 0) + 4) idx = texto.length; // acorde después del final de la letra
    return { idx, acorde };
  });
  // De atrás para adelante, para no mover las posiciones que faltan.
  inserciones.sort((a, b) => b.idx - a.idx).forEach(({ idx, acorde }) => {
    if (idx > texto.length) { texto = `${texto.padEnd(idx, " ")}`; }
    texto = `${texto.slice(0, idx)}[${acorde}]${texto.slice(idx)}`;
  });
  return texto;
}

// ---- 3) Líneas → canciones ----
const RE_PAGINA = /^(p[áa]g(ina)?\.?\s*)?\d{1,3}(\s*(de|\/)\s*\d{1,3})?$/i;
const RE_TONO = /^(tono|tonalidad|key|tom)\s*[:\-]\s*([A-G][#b]?m?|(?:Do|Re|Mi|Fa|Sol|La|Si)[#b]?m?)\b/i;
const RE_AUTOR = /^(autor(es)?|artista|int[ée]rprete|compositor|letra y m[úu]sica|by)\s*[:\-]\s*(.+)$/i;
const mediana = (arr) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Encabezados y pies que se repiten en varias páginas (ej. el sitio web del cancionero): fuera.
function quitarRepetidosDePagina(lineas) {
  const paginas = [...new Set(lineas.map((l) => l.pagina))];
  if (paginas.length < 2) return lineas;
  const bordes = new Map();
  paginas.forEach((p) => {
    const de = lineas.filter((l) => l.pagina === p);
    [de[0], de[de.length - 1]].filter(Boolean).forEach((l) => bordes.set(l.texto.trim(), (bordes.get(l.texto.trim()) || 0) + 1));
  });
  const fuera = new Set([...bordes].filter(([, n]) => n >= 2).map(([t]) => t));
  return lineas.filter((l) => !fuera.has(l.texto.trim()));
}

export function cancionesDeLineas(lineasCrudas, nombreArchivo = "") {
  const lineas = quitarRepetidosDePagina(lineasCrudas).filter((l) => !RE_PAGINA.test(l.texto.trim()));
  if (!lineas.length) return [];
  // Títulos: letra claramente más grande que el resto, línea corta, que no sea acordes ni "Coro".
  const altoNormal = mediana(lineas.map((l) => l.alto));
  const esTitulo = (l) => l.alto >= altoNormal * 1.3 && l.texto.trim().length <= 70 && !esLineaDeAcordes(l.texto) && !leerEncabezado(l.texto);
  const inicios = lineas.map((l, i) => (esTitulo(l) ? i : -1)).filter((i) => i >= 0);
  // Varios títulos seguidos (título + subtítulo grande) cuentan como uno solo.
  const iniciosLimpios = inicios.filter((i, n) => n === 0 || i !== inicios[n - 1] + 1);
  const tramos = [];
  if (iniciosLimpios.length === 0) tramos.push({ titulo: tituloDeArchivo(nombreArchivo), desde: 0, hasta: lineas.length });
  else iniciosLimpios.forEach((ini, n) => {
    let desde = ini + 1;
    while (desde < lineas.length && inicios.includes(desde)) desde++;
    tramos.push({ titulo: lineas[ini].texto.trim(), desde, hasta: n + 1 < iniciosLimpios.length ? iniciosLimpios[n + 1] : lineas.length });
  });
  return tramos.map((t) => armarCancion(t.titulo, lineas.slice(t.desde, t.hasta))).filter((c) => c.texto.trim());
}

function tituloDeArchivo(nombre) {
  return String(nombre || "Canción").replace(/\.pdf$/i, "").replace(/[_]+/g, " ")
    .replace(/\s*[-–|]\s*(lacuerda|cifra ?club|acordes|chords|letra).*$/i, "").replace(/\s+/g, " ").trim() || "Canción";
}

function armarCancion(titulo, lineas) {
  let artista = "";
  let tonalidad = "";
  const cuerpo = [];
  lineas.forEach((l, i) => {
    const t = l.texto.trim();
    const tono = t.match(RE_TONO);
    const autor = t.match(RE_AUTOR);
    if (tono && !tonalidad) { tonalidad = aAmericano(tono[2]); return; }
    if (autor && !artista && i < 8) { artista = autor[3].trim(); return; }
    cuerpo.push(l);
  });
  // Acordes encima de la letra → dentro; renglón vacío donde el PDF deja un espacio grande.
  const salida = []; // { texto, y, pagina }
  for (let i = 0; i < cuerpo.length; i++) {
    const l = cuerpo[i];
    const sig = cuerpo[i + 1];
    if (esLineaDeAcordes(l.texto) && sig && sig.pagina === l.pagina && !esLineaDeAcordes(sig.texto) && !leerEncabezado(sig.texto) && l.y - sig.y < Math.max(l.alto, sig.alto) * 2.4) {
      salida.push({ texto: pegarAcordes(l, sig), y: sig.y, pagina: sig.pagina, alto: sig.alto });
      i++;
    } else {
      salida.push({ texto: esLineaDeAcordes(l.texto) ? acordesConPosicion(l).map((a) => `[${a.acorde}]`).join(" ") : l.texto, y: l.y, pagina: l.pagina, alto: l.alto });
    }
  }
  const saltos = [];
  for (let i = 1; i < salida.length; i++) if (salida[i].pagina === salida[i - 1].pagina) saltos.push(salida[i - 1].y - salida[i].y);
  const saltoNormal = mediana(saltos.filter((s) => s > 0)) || 14;
  const textoFinal = [];
  salida.forEach((s, i) => {
    const ant = salida[i - 1];
    if (ant && (ant.pagina !== s.pagina || ant.y - s.y > saltoNormal * 1.45) && textoFinal[textoFinal.length - 1] !== "") textoFinal.push("");
    // Un encabezado de parte ("Coro", "Estrofa 2") siempre empieza en su propio bloque.
    if (leerEncabezado(s.texto) && textoFinal.length && textoFinal[textoFinal.length - 1] !== "") textoFinal.push("");
    textoFinal.push(s.texto.replace(/\s+$/, ""));
  });
  // "Título - Artista" (así exportan LaCuerda y muchos cancioneros).
  let tituloFinal = titulo;
  const partido = titulo.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (partido && !artista) { tituloFinal = partido[1].trim(); artista = partido[2].trim(); }
  return { titulo: tituloFinal, artista, tonalidad, texto: textoFinal.join("\n").trim() };
}

// ---- 4) Archivo PDF → canciones listas para revisar ----
// Devuelve [{ titulo, artista, tonalidad, texto, resultado }] (resultado = textoACancion del texto) o
// lanza "SIN_TEXTO" si el PDF es una imagen escaneada (no trae texto que se pueda leer).
export async function cancionesDePdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const items = await itemsDePdf(pdfjs, new Uint8Array(await file.arrayBuffer()));
  if (!items.some((it) => it.str.trim())) throw new Error("SIN_TEXTO");
  return cancionesDeLineas(lineasDeItems(items), file.name).map((c) => ({ ...c, resultado: textoACancion(c.texto) }));
}

export async function itemsDePdf(pdfjs, datos) {
  const pdf = await pdfjs.getDocument({ data: datos, disableFontFace: true }).promise;
  const items = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const contenido = await pagina.getTextContent();
    contenido.items.forEach((it) => {
      if (typeof it.str !== "string") return;
      const [a, b, , d, e, f] = it.transform;
      const alto = it.height || Math.hypot(b, d) || Math.abs(a) || 10;
      items.push({ str: it.str, x: e, y: f, w: it.width, h: alto, pagina: n });
    });
  }
  return items;
}
