// "Pegar canción / Editar como texto" (pedido de Eldin, 2026-10-13): una canción completa en UN
// solo texto, y de vuelta. Sirve para pegar una canción de internet (acordes encima de la letra, tipo
// LaCuerda/Cifra Club), para pegarla ya con [acordes] adentro, o solo la letra; y para editar una
// canción existente como texto.
//
// Formato del texto:
//   [Coro 1]            ← encabezado de sección (también "#Mi sección", "Coro:", "CORO", "Estrofa 2")
//   [G]Venimos ante [D]ti     ← la letra con sus acordes, igual que en la pestaña Contenido
//                       ← un renglón vacío corta la diapositiva
//   [Coro 1]            ← encabezado SIN letra = se repite esa sección (orden del culto)
//   [Coro 1] x2         ← "x2" = dos veces seguidas
//
// LO IMPORTANTE (analizado sobre las 121 canciones reales): la letra que se proyecta (pestaña Letra)
// NO siempre es igual a la del Contenido — en muchas se limpió "míiiiio"→"mío" o se quitaron "//" a
// mano. Por eso este texto edita el Contenido y el orden; las diapositivas de una sección SOLO se
// rehacen si esa sección cambió. Una sección que no se tocó conserva su letra y sus diapositivas
// exactamente como estaban.

// ---- Encabezados de sección ----
const PALABRAS_SECCION = [
  "estrofa", "verso", "coro", "pre-coro", "precoro", "pre coro", "puente", "intro", "introducción", "introduccion",
  "outro", "final", "coda", "instrumental", "interludio", "intermedio", "tag", "solo", "estribillo", "vamp",
];
const RE_PALABRA = new RegExp(`^(?:${PALABRAS_SECCION.map((p) => p.replace(/[-\s]/g, "[-\\s]?")).join("|")})(?=$|[\\s\\d:])`, "i");
const RE_REPETIR = /\s*(?:\(?\s*[x×]\s*(\d+)\s*\)?|\(\s*(\d+)\s*veces?\s*\))\s*$/i;

// ¿La línea es un encabezado? → { etiqueta, veces, resto } | null.
// veces: null = una vez; 0 = sección guardada que no está en el orden. resto: lo que venía en la
// misma línea después de "Intro:" (ej. "Intro: G D Em C").
export function leerEncabezado(linea) {
  let t = String(linea || "").trim();
  if (!t) return null;
  let veces = null;
  const rep = t.match(RE_REPETIR);
  const sinRep = rep ? t.slice(0, rep.index).trim() : t;
  if (rep) veces = Number(rep[1] ?? rep[2]);
  // #Lo que sea
  if (/^#(?!#)\s*\S/.test(sinRep)) return { etiqueta: sinRep.replace(/^#\s*/, "").trim(), veces, resto: "" };
  // [Coro 1] — solo si empieza con una palabra de sección (así nunca se confunde con un acorde [C])
  const corchete = sinRep.match(/^\[\s*([^\]]+?)\s*\]$/);
  if (corchete && RE_PALABRA.test(corchete[1])) return { etiqueta: corchete[1], veces, resto: "" };
  // Coro / CORO / Coro 2 / Coro final / "Coro 2:" / "Intro: G D Em C". Sin dos puntos solo cuenta si la
  // línea es SOLO el nombre (palabra de sección + número o "final"), para no confundir letra que
  // empiece con "Coro…".
  const dosPuntos = sinRep.indexOf(":");
  const izquierda = (dosPuntos >= 0 ? sinRep.slice(0, dosPuntos) : sinRep).trim();
  const resto = dosPuntos >= 0 ? sinRep.slice(dosPuntos + 1).trim() : "";
  if (RE_SOLO_NOMBRE.test(izquierda)) return { etiqueta: capitalizar(izquierda), veces, resto };
  return null;
}
const RE_SOLO_NOMBRE = new RegExp(`^(?:${PALABRAS_SECCION.map((p) => p.replace(/[-\s]/g, "[-\\s]?")).join("|")})(?:\\s*\\d+)?(?:\\s+(?:final|\\d+))?$`, "i");
const capitalizar = (s) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s.charAt(0).toUpperCase() + s.slice(1));

const escribirEncabezado = (etiqueta, veces) => {
  const base = RE_PALABRA.test(etiqueta) ? `[${etiqueta}]` : `#${etiqueta}`;
  return veces === 0 ? `${base} x0` : veces > 1 ? `${base} x${veces}` : base;
};

// ---- Acordes ----
const NOTA = "(?:[A-G](?:#|b)?|(?:Do|Re|Mi|Fa|Sol|La|Si)(?:#|b)?)";
const ACORDE = `${NOTA}(?:maj|min|m|M|dim|aug|sus|add|º|°|\\+)?\\d*(?:\\(?(?:[#b]?\\d+|sus\\d*|add\\d+|maj\\d*)\\)?)*(?:/${NOTA})?`;
const RE_ACORDE_SOLO = new RegExp(`^\\(?${ACORDE}\\)?$`);
const LATINAS = { Do: "C", Re: "D", Mi: "E", Fa: "F", Sol: "G", La: "A", Si: "B" };
export const aAmericano = (acorde) => acorde.replace(/^\(|\)$/g, "").replace(/(Do|Re|Mi|Fa|Sol|La|Si)/g, (n) => LATINAS[n]);

// ¿Es una línea SOLO de acordes sin corchetes ("G   D/F#   Em")? (las de [G] [D] ya están en formato app)
export function esLineaDeAcordes(linea) {
  const t = String(linea || "").replace(/\t/g, "    ");
  if (!t.trim() || t.includes("[")) return false;
  const tokens = t.trim().split(/\s+/).filter((x) => !/^[|/\-–]+$/.test(x));
  return tokens.length > 0 && tokens.every((x) => RE_ACORDE_SOLO.test(x));
}

// Pone los acordes de una línea de acordes ENCIMA en la letra de abajo, cada uno en su columna:
//   "G       D" + "Venimos ante ti" → "[G]Venimos [D]ante ti"
export function unirAcordesEncima(lineaAcordes, letra) {
  const acordes = [];
  const t = lineaAcordes.replace(/\t/g, "    ");
  const re = /\S+/g;
  let m;
  while ((m = re.exec(t))) { if (!/^[|/\-–]+$/.test(m[0])) acordes.push({ col: m.index, acorde: aAmericano(m[0]) }); }
  let out = (letra || "").replace(/\t/g, "    ");
  for (let i = acordes.length - 1; i >= 0; i--) {
    const { col, acorde } = acordes[i];
    if (col > out.length) out = out + " ".repeat(col - out.length);
    out = `${out.slice(0, col)}[${acorde}]${out.slice(col)}`;
  }
  return out;
}
// Una línea de acordes sin letra abajo (intro, instrumental) → "[G] [D] [Em]".
const acordesSueltos = (linea) => linea.trim().split(/\s+/).filter((x) => !/^[|/\-–]+$/.test(x)).map((x) => `[${aAmericano(x)}]`).join(" ");

export const quitarAcordes = (l) => String(l || "").replace(/\[[^\]]*\]/g, "");

// ---- Diapositivas a partir de la letra de una sección ----
// "graciaaaas" → "gracias", "míiiio" → "mío", "//" fuera (la regla de siempre: eso solo se limpia en
// lo que se proyecta, nunca en el Contenido de los acordes).
const ACENTOS = { á: "a", é: "e", í: "i", ó: "o", ú: "u" };
export function limpiarParaProyectar(linea) {
  let t = quitarAcordes(linea).replace(/\/{2,}/g, " ");
  t = t.replace(/([A-Za-zÁÉÍÓÚáéíóúÑñ])\1{2,}/giu, "$1");
  t = t.replace(/([áéíóú])(a+|e+|i+|o+|u+)/gi, (todo, acentuada, run) => (ACENTOS[acentuada.toLowerCase()] === run[0].toLowerCase() ? acentuada : todo));
  return t.replace(/\s{2,}/g, " ").trim();
}
// Renglón vacío = nueva diapositiva. Si la sección no tiene ningún renglón vacío, se corta cada 2
// líneas (la regla de la iglesia: una diapositiva = 2 líneas). Líneas que solo tenían acordes no se
// proyectan.
export function diapositivasDeLineas(lineas) {
  const grupos = [];
  let actual = [];
  let huboVacio = false;
  lineas.forEach((l) => {
    if (!String(l).trim()) { if (actual.length) { grupos.push(actual); actual = []; } huboVacio = true; return; }
    const limpia = limpiarParaProyectar(l);
    if (limpia) actual.push(limpia);
  });
  if (actual.length) grupos.push(actual);
  if (huboVacio) return grupos;
  const todas = grupos.flat();
  const out = [];
  for (let i = 0; i < todas.length; i += 2) out.push(todas.slice(i, i + 2));
  return out;
}

// ---- Distintivo (V1, C, PC…) de una sección nueva, según su nombre ----
const PREFIJOS = [
  [/^pre[-\s]?coro/i, "PC"], [/^coro/i, "C"], [/^(estrofa|verso)/i, "V"], [/^puente/i, "P"], [/^intro/i, "IN"],
  [/^outro/i, "O"], [/^final/i, "F"], [/^coda/i, "T"], [/^instrumental/i, "INS"], [/^interludio/i, "INT"], [/^intermedio/i, "IM"],
  [/^estribillo/i, "C"], [/^tag/i, "T"], [/^solo/i, "S"],
];
export function distintivoDe(etiqueta) {
  const p = PREFIJOS.find(([re]) => re.test(etiqueta.trim()));
  const num = (etiqueta.match(/(\d+)\s*$/) || [])[1] || "";
  return (p ? p[1] : etiqueta.trim().slice(0, 2).toUpperCase()) + num;
}

// ---- Canción → texto ----
const mismoTexto = (a, b) => recortar(a).map((l) => String(l).replace(/\s+$/, "")).join("\n") === recortar(b).map((l) => String(l).replace(/\s+$/, "")).join("\n");
const recortar = (lineas) => {
  const l = [...(lineas || [])];
  while (l.length && !String(l[0]).trim()) l.shift();
  while (l.length && !String(l[l.length - 1]).trim()) l.pop();
  return l;
};
export function cancionATexto(cancion) {
  const blocks = cancion?.blocks || {};
  const orden = (cancion?.defaultStructure || []).filter((k) => blocks[k]);
  const secuencia = orden.length ? orden : Object.keys(blocks);
  const partes = [];
  const escritas = new Set();
  for (let i = 0; i < secuencia.length; ) {
    const k = secuencia[i];
    let veces = 1;
    while (secuencia[i + veces] === k) veces++;
    const b = blocks[k];
    if (!escritas.has(k)) {
      escritas.add(k);
      partes.push([escribirEncabezado(b.label || "Sección", veces), ...recortar(b.lines)].join("\n"));
    } else {
      partes.push(escribirEncabezado(b.label || "Sección", veces));
    }
    i += veces;
  }
  // Secciones guardadas que no están en el orden: al final, con "x0".
  if (orden.length) {
    Object.keys(blocks).filter((k) => !escritas.has(k)).forEach((k) => partes.push([escribirEncabezado(blocks[k].label || "Sección", 0), ...recortar(blocks[k].lines)].join("\n")));
  }
  return partes.join("\n\n");
}

// ---- Texto → canción ----
// original (opcional): la canción que se está editando — para conservar claves, distintivos, compases
// y SOBRE TODO las diapositivas de las secciones que no cambiaron.
export function textoACancion(texto, original = null) {
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  const avisos = [];
  // 1) Partir en secciones (en el orden en que aparecen).
  const trozos = [];
  let actual = null;
  lineas.forEach((l, n) => {
    const enc = leerEncabezado(l);
    if (enc) {
      actual = { etiqueta: enc.etiqueta, veces: enc.veces, lineas: [], linea: n + 1 };
      trozos.push(actual);
      if (enc.resto.trim()) actual.lineas.push(enc.resto);
      return;
    }
    if (!actual) {
      if (!l.trim()) return;
      actual = { etiqueta: "Estrofa", veces: null, lineas: [], linea: n + 1, implicita: true };
      trozos.push(actual);
    }
    actual.lineas.push(l);
  });
  // Lo típico al copiar de internet: el título arriba, antes del primer "Estrofa/Coro". Una sola línea
  // corta sin acordes antes de un encabezado se toma como título, no como letra.
  let tituloSugerido = null;
  const primero = trozos[0];
  if (primero?.implicita && trozos.length > 1) {
    const llenas = primero.lineas.filter((l) => l.trim());
    if (llenas.length === 1 && !/\[/.test(llenas[0]) && !esLineaDeAcordes(llenas[0]) && llenas[0].trim().split(/\s+/).length <= 8) {
      tituloSugerido = llenas[0].trim().replace(/[-–—]\s*.*$/, "").trim() || llenas[0].trim();
      trozos.shift();
    }
  }
  if (trozos.some((t) => t.implicita) && trozos.length === 1) avisos.push({ tipo: "info", texto: "No encontré nombres de sección (Coro, Estrofa…): todo quedó en una Estrofa. Puedes agregarlos con los botones." });

  // 2) Acordes encima de la letra → dentro de la letra.
  let acordesEncima = 0;
  trozos.forEach((t) => {
    const out = [];
    for (let i = 0; i < t.lineas.length; i++) {
      const l = t.lineas[i];
      if (esLineaDeAcordes(l)) {
        const sig = t.lineas[i + 1];
        if (sig !== undefined && sig.trim() && !esLineaDeAcordes(sig)) { out.push(unirAcordesEncima(l, sig)); i++; acordesEncima++; }
        else out.push(acordesSueltos(l));
      } else out.push(l);
    }
    t.lineas = recortar(out);
  });

  // 3) Armar bloques, orden y diapositivas.
  const origBlocks = original?.blocks || {};
  const porEtiqueta = {};
  Object.entries(origBlocks).forEach(([k, b]) => { porEtiqueta[(b.label || "").trim().toLowerCase()] = k; });
  const sueltos = {}; // bloques en el orden en que aparecen; abajo se ordenan
  const letraSuelta = {};
  const estructura = [];
  const claveDe = {}; // etiqueta (minúsculas) → clave en esta canción
  let n = 0;
  const base = Date.now();
  trozos.forEach((t) => {
    const id = t.etiqueta.trim().toLowerCase();
    const yaDefinida = claveDe[id];
    if (yaDefinida && t.lineas.length === 0) {
      // Repetición de una sección ya escrita.
      for (let i = 0; i < (t.veces ?? 1); i++) estructura.push(yaDefinida);
      return;
    }
    if (yaDefinida) {
      if (mismoTexto(sueltos[yaDefinida].lines, t.lineas)) { for (let i = 0; i < (t.veces ?? 1); i++) estructura.push(yaDefinida); return; }
      avisos.push({ tipo: "aviso", texto: `"${t.etiqueta}" aparece dos veces con letra distinta (línea ${t.linea}). Quedó como otra sección; cámbiale el nombre si es otra parte.` });
    }
    const claveOrig = !yaDefinida ? porEtiqueta[id] : null;
    const orig = claveOrig ? origBlocks[claveOrig] : null;
    const clave = claveOrig || `b${base}_${n++}`;
    claveDe[id] = clave;
    // Igual que antes = mismo texto (sin contar espacios al final de cada línea, que no se ven).
    const igualQueAntes = orig && mismoTexto(orig.lines, t.lineas);
    sueltos[clave] = igualQueAntes
      ? orig
      : { badge: orig?.badge || distintivoDe(t.etiqueta), label: orig?.label ?? t.etiqueta, bars: orig?.bars || 8, lines: t.lineas.length ? t.lineas : [""] };
    letraSuelta[clave] = igualQueAntes && original?.letra?.[clave] ? original.letra[clave] : diapositivasDeLineas(t.lineas);
    for (let i = 0; i < (t.veces ?? 1); i++) estructura.push(clave);
  });

  // Mismo orden de secciones que tenía la canción (es el orden de las pestañas del editor y de la
  // pestaña Letra); las nuevas al final, en el orden en que aparecen en el texto.
  const ordenBloques = [...Object.keys(origBlocks).filter((k) => k in sueltos), ...Object.keys(sueltos).filter((k) => !(k in origBlocks))];
  const blocks = Object.fromEntries(ordenBloques.map((k) => [k, sueltos[k]]));
  const ordenLetra = [...Object.keys(original?.letra || {}).filter((k) => k in letraSuelta), ...ordenBloques.filter((k) => !(k in (original?.letra || {})))];
  const letra = Object.fromEntries(ordenLetra.filter((k) => k in letraSuelta).map((k) => [k, letraSuelta[k]]));

  // Una canción vieja sin orden guardado: si el texto no cambió el orden, se deja sin orden (igual se
  // proyectan todas sus secciones en orden).
  let defaultStructure = estructura;
  if (original && (original.defaultStructure || []).length === 0) {
    const llaves = Object.keys(blocks);
    if (estructura.length === llaves.length && estructura.every((k, i) => k === llaves[i])) defaultStructure = [];
  }

  // 4) Avisos útiles.
  trozos.forEach((t) => {
    t.lineas.forEach((l) => { if (/\[[^\]]*$/.test(l) || /^[^[]*\]/.test(l)) avisos.push({ tipo: "aviso", texto: `Un acorde quedó sin cerrar en "${t.etiqueta}": ${l.trim().slice(0, 40)}` }); });
  });
  const tonalidadSugerida = sugerirTonalidad(Object.values(blocks).flatMap((b) => b.lines));
  return { blocks, letra, defaultStructure, avisos, acordesEncima, tonalidadSugerida, tituloSugerido, secciones: trozos.map((t) => t.etiqueta) };
}

// Tonalidad probable: el primer acorde de la canción (o el último si coincide más). Solo sugerencia.
export function sugerirTonalidad(lineas) {
  const acordes = [];
  lineas.forEach((l) => { for (const m of String(l).matchAll(/\[([^\]]+)\]/g)) acordes.push(m[1]); });
  if (!acordes.length) return null;
  const raiz = (a) => { const m = a.match(/^([A-G](?:#|b)?)(m(?!aj))?/); return m ? m[1] + (m[2] ? "m" : "") : null; };
  const primero = raiz(acordes[0]);
  const ultimo = raiz(acordes[acordes.length - 1]);
  return primero || ultimo;
}
