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
      const letras = g.items.reduce((n, it) => n + it.str.trim().length, 0);
      const enNegrita = g.items.reduce((n, it) => n + (it.negrita ? it.str.trim().length : 0), 0);
      lineas.push({ pagina, y: g.y, alto: g.h, items: g.items, negrita: letras > 0 && enNegrita / letras >= 0.6, ...textoConPosiciones(g.items) });
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

// ¿Dónde empieza cada canción? Cada cancionero marca sus títulos distinto, así que se prueban varias
// señales y se usa la primera que encuentre al menos dos canciones (pedido de Eldin, 2026-11-11: "que
// solo metan el PDF y se separen solas"):
//   1. letra más grande que el resto · 2. numerados ("12. Título", "#12 Título", "012 - Título")
//   3. en negrita (con la letra normal sin negrita) · 4. EN MAYÚSCULAS con espacio arriba
//   5. renglón de texto con espacio grande arriba y acordes justo debajo (título "normal" de
//      cancionero de acordes: el título, y abajo empieza la canción con su primera línea de acordes)
//   6. una canción por página (desde 3 páginas)
// Ninguna línea de acordes ni encabezado de parte ("Coro", "Estrofa 2") cuenta como título, y un
// índice (muchos títulos seguidos sin letra entre ellos) se salta.
const RE_NUMERADO = /^\s*(?:#|n[°º.]\s*)?(\d{1,4})\s*(?:[.)\-–—:]\s*|\s+(?=[A-ZÁÉÍÓÚÑ¿¡"“]))(\S.*)$/;
const pareceLineaDeTitulo = (l) => {
  const t = l.texto.trim();
  // "Cuán grande es Él ....... 5" es un renglón de índice, no un título.
  return t.length >= 2 && t.length <= 70 && !/(\.{3,}|…)\s*\d{1,4}$/.test(t) && !esLineaDeAcordes(t) && !leerEncabezado(t) && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(t);
};
const esMayusculas = (t) => {
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  return letras.length >= 3 && letras === letras.toUpperCase();
};
// Corridas de 3+ candidatos seguidos = índice o lista, no títulos de canciones.
function sinIndices(inicios, lineas) {
  const fuera = new Set();
  for (let a = 0; a < inicios.length;) {
    let b = a;
    // Seguidos = renglón tras renglón en la MISMA página (el índice termina donde cambia la hoja).
    while (b + 1 < inicios.length && inicios[b + 1] === inicios[b] + 1 && lineas[inicios[b + 1]].pagina === lineas[inicios[b]].pagina) b++;
    if (b - a + 1 >= 3) for (let k = a; k <= b; k++) fuera.add(inicios[k]);
    a = b + 1;
  }
  return inicios.filter((i) => !fuera.has(i));
}
// Dos títulos seguidos (título + subtítulo) cuentan como uno solo.
const sinSeguidos = (inicios) => inicios.filter((i, n) => n === 0 || i !== inicios[n - 1] + 1);

export function iniciosDeCanciones(lineas) {
  const altoNormal = mediana(lineas.map((l) => l.alto));
  const saltos = [];
  for (let i = 1; i < lineas.length; i++) if (lineas[i].pagina === lineas[i - 1].pagina) saltos.push(lineas[i - 1].y - lineas[i].y);
  const saltoNormal = mediana(saltos.filter((x) => x > 0)) || 14;
  const espacioArriba = (i) => i === 0 || lineas[i].pagina !== lineas[i - 1].pagina || lineas[i - 1].y - lineas[i].y > saltoNormal * 1.4;
  const indices = (prueba) => lineas.map((l, i) => (pareceLineaDeTitulo(l) && prueba(l, i) ? i : -1)).filter((i) => i >= 0);
  const pocas = (inicios, max) => inicios.length <= Math.max(2, lineas.length * max);

  const porTamano = sinSeguidos(indices((l) => l.alto >= altoNormal * 1.3));
  const numerados = (() => {
    const c = sinIndices(indices((l) => RE_NUMERADO.test(l.texto)), lineas);
    const nums = c.map((i) => Number(lineas[i].texto.match(RE_NUMERADO)[1]));
    const subenBien = nums.filter((x, n) => n > 0 && x > nums[n - 1]).length >= (nums.length - 1) * 0.7;
    return c.length >= 2 && subenBien ? c : [];
  })();
  const enNegrita = (() => {
    const c = indices((l, i) => l.negrita && !lineas[i - 1]?.negrita && !(lineas[i + 1]?.negrita && lineas[i + 2]?.negrita));
    const negritas = lineas.filter((l) => l.negrita).length;
    return negritas <= lineas.length * 0.35 ? c : [];
  })();
  const enMayusculas = (() => {
    const c = sinIndices(indices((l, i) => esMayusculas(l.texto) && espacioArriba(i)), lineas);
    return pocas(c, 0.2) ? c : [];
  })();
  const porEspacio = (() => {
    const c = indices((l, i) => espacioArriba(i) && lineas[i + 1] && esLineaDeAcordes(lineas[i + 1].texto) && lineas[i + 1].pagina === l.pagina);
    return pocas(c, 0.25) ? c : [];
  })();
  const porPagina = (() => {
    const paginas = [...new Set(lineas.map((l) => l.pagina))];
    if (paginas.length < 3) return [];
    const c = paginas.map((p) => lineas.findIndex((l) => l.pagina === p)).filter((i) => i >= 0 && pareceLineaDeTitulo(lineas[i]));
    return c.length >= paginas.length * 0.8 ? c : [];
  })();

  for (const [modo, inicios] of [["tamano", porTamano], ["numerados", numerados], ["negrita", enNegrita], ["mayusculas", enMayusculas], ["espacio", porEspacio], ["pagina", porPagina]]) {
    // "espacio" es la señal más débil (una estrofa también puede tener espacio arriba): pide 3+.
    if (inicios.length >= (modo === "espacio" ? 3 : 2)) return { modo, inicios };
  }
  // Una sola canción: su título es la línea marcada (más grande, o en negrita/mayúsculas al principio).
  if (porTamano.length === 1) return { modo: "tamano", inicios: porTamano };
  for (const [modo, inicios] of [["negrita", enNegrita], ["mayusculas", enMayusculas], ["numerados", numerados]]) {
    if (inicios.length === 1 && inicios[0] === 0) return { modo, inicios };
  }
  return { modo: "ninguno", inicios: [] };
}

export function cancionesDeLineas(lineasCrudas, nombreArchivo = "") {
  const lineas = quitarRepetidosDePagina(lineasCrudas).filter((l) => !RE_PAGINA.test(l.texto.trim()));
  if (!lineas.length) return [];
  const { modo, inicios } = iniciosDeCanciones(lineas);
  const tramos = [];
  if (inicios.length === 0) {
    // Sin títulos marcados: si la PRIMERA línea es el título (se parece al nombre del archivo, o viene
    // como "Título – Autor"), se usa como título y no como letra.
    const primera = lineas[0].texto.trim();
    const base = normalizarTitulo(tituloDeArchivo(nombreArchivo));
    const pareceTitulo = !esLineaDeAcordes(primera) && !leerEncabezado(primera) && primera.length <= 80 &&
      ((base && normalizarTitulo(primera).includes(base)) || /\s[-–—]\s/.test(primera));
    if (pareceTitulo) tramos.push({ titulo: primera, desde: 1, hasta: lineas.length });
    else tramos.push({ titulo: tituloDeArchivo(nombreArchivo), desde: 0, hasta: lineas.length });
  } else {
    inicios.forEach((ini, n) => {
      let desde = ini + 1;
      // Subtítulo grande justo debajo del título (solo cuando se separa por tamaño).
      while (modo === "tamano" && desde < lineas.length && lineas[desde].alto >= mediana(lineas.map((l) => l.alto)) * 1.3 && pareceLineaDeTitulo(lineas[desde])) desde++;
      let titulo = lineas[ini].texto.trim();
      if (modo === "numerados") titulo = titulo.match(RE_NUMERADO)[2].trim();
      if (modo === "mayusculas") titulo = titulo.charAt(0) + titulo.slice(1).toLowerCase();
      tramos.push({ titulo, desde, hasta: n + 1 < inicios.length ? inicios[n + 1] : lineas.length });
    });
  }
  return tramos.map((t) => armarCancion(t.titulo, lineas.slice(t.desde, t.hasta))).filter((c) => c.texto.trim());
}

const normalizarTitulo = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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
    // Acordes al pie de una página con su letra arriba de la siguiente: también van juntos.
    const cambioDePagina = sig && sig.pagina === l.pagina + 1 && cuerpo.findIndex((x) => x.pagina === sig.pagina) === i + 1;
    if (esLineaDeAcordes(l.texto) && sig && !esLineaDeAcordes(sig.texto) && !leerEncabezado(sig.texto) && (cambioDePagina || (sig.pagina === l.pagina && l.y - sig.y < Math.max(l.alto, sig.alto) * 2.4))) {
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
    // El cambio de página NO corta la diapositiva (la letra sigue igual en la otra hoja); solo un espacio grande.
    if (ant && ant.pagina === s.pagina && ant.y - s.y > saltoNormal * 1.45 && textoFinal[textoFinal.length - 1] !== "") textoFinal.push("");
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
    // Cargar las fuentes de la página para saber cuáles son negrita (títulos en negrita).
    await pagina.getOperatorList().catch(() => {});
    const contenido = await pagina.getTextContent();
    const negritas = new Map();
    const esNegrita = (nombre) => {
      if (!negritas.has(nombre)) {
        let f = null;
        try { f = pagina.commonObjs.has(nombre) ? pagina.commonObjs.get(nombre) : null; } catch { f = null; }
        negritas.set(nombre, !!(f && (f.bold || f.black || /bold|black|heavy|semibold|demi/i.test(`${f.name || ""} ${f.loadedName || ""}`))));
      }
      return negritas.get(nombre);
    };
    contenido.items.forEach((it) => {
      if (typeof it.str !== "string") return;
      const [a, b, , d, e, f] = it.transform;
      const alto = it.height || Math.hypot(b, d) || Math.abs(a) || 10;
      items.push({ str: it.str, x: e, y: f, w: it.width, h: alto, pagina: n, negrita: esNegrita(it.fontName) });
    });
  }
  return items;
}
