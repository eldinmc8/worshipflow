// Asistente por pasos para armar una canción (pedido de Eldin, 2026-11-20): Datos → Estructura →
// Letra → Acordes. Aquí vive la lógica pura (sin pantalla) para poder probarla:
// - Estructura: crear partes y armar el orden en que se canta (con repeticiones).
// - Letra: se escribe dentro de cada parte ya creada. De ahí salen las diapositivas (letra) y, si la
//   parte no tenía acordes escritos aparte, también el texto que ven los músicos (blocks[k].lines).
// - Acordes: se ponen tocando una palabra; la letra NO se puede cambiar desde ahí.
import { diapositivasDeLineas, limpiarParaProyectar, quitarAcordes, distintivoDe } from "./textoCancion.js";

export const TIPOS_PARTE = [
  { id: "intro", label: "Intro", prefix: "IN" },
  { id: "estrofa", label: "Estrofa", prefix: "V", numerar: true },
  { id: "precoro", label: "Pre-coro", prefix: "PC" },
  { id: "coro", label: "Coro", prefix: "C" },
  { id: "puente", label: "Puente", prefix: "P" },
  { id: "instrumental", label: "Instrumental", prefix: "INS" },
  { id: "final", label: "Final", prefix: "F" },
];

// Orden en que se canta.
export function ordenDe(cancion) {
  const blocks = cancion?.blocks || {};
  return (cancion?.defaultStructure || []).filter((k) => blocks[k]);
}
// Canciones viejas sin orden guardado se cantan en el orden de sus partes: al abrir el editor se
// escribe ese orden, para que quitar la última parte del orden no la haga "volver" sola.
export function normalizarOrden(cancion) {
  if (!cancion || (cancion.defaultStructure || []).some((k) => cancion.blocks?.[k])) return cancion;
  return { ...cancion, defaultStructure: Object.keys(cancion.blocks || {}) };
}

// Cada parte una sola vez: primero en el orden en que se canta, luego las que no están en el orden.
export function partesUnicas(cancion) {
  const blocks = cancion?.blocks || {};
  return [...new Set([...ordenDe(cancion), ...Object.keys(blocks)])].filter((k) => blocks[k]);
}

export const partesSinUsar = (cancion) => {
  const orden = new Set(ordenDe(cancion));
  return Object.keys(cancion?.blocks || {}).filter((k) => !orden.has(k));
};

const tieneTexto = (cancion, k) => (cancion.blocks[k]?.lines || []).some((l) => String(l).trim()) || (cancion.letra?.[k] || []).some((s) => (s || []).some((l) => String(l).trim()));

let contador = 0;
const nuevaClave = () => `b${Date.now()}_${contador++}`;

// Toca "+ Coro": si ya hay coro, se repite el mismo; "+ Estrofa" siempre crea la siguiente (Estrofa 2,
// Estrofa 3...). Con { nombre } se crea una parte con ese nombre (ej. "Coro 2", "Tag").
export function agregarParte(cancion, tipoId, { nombre } = {}) {
  const blocks = { ...cancion.blocks };
  const letra = { ...(cancion.letra || {}) };
  const orden = [...ordenDe(cancion)];
  const crear = (badge, label) => {
    const k = nuevaClave();
    blocks[k] = { badge, label, bars: 8, lines: [""] };
    letra[k] = [];
    return k;
  };
  let k;
  if (nombre) {
    k = crear(distintivoDe(nombre), nombre.trim());
  } else {
    const tipo = TIPOS_PARTE.find((t) => t.id === tipoId);
    if (!tipo) return cancion;
    const re = new RegExp(`^${tipo.prefix}(\\d*)$`);
    const delTipo = Object.keys(blocks).filter((x) => re.test(String(blocks[x].badge || "").toUpperCase()));
    if (tipo.numerar) {
      const max = delTipo.reduce((m, x) => Math.max(m, parseInt(String(blocks[x].badge).match(re)[1] || "1", 10)), 0);
      k = crear(`${tipo.prefix}${max + 1}`, `${tipo.label} ${max + 1}`);
    } else if (delTipo.length) {
      k = delTipo[delTipo.length - 1];
    } else {
      k = crear(tipo.prefix, tipo.label);
    }
  }
  return { ...cancion, blocks, letra, defaultStructure: [...orden, k] };
}

export const repetirParte = (cancion, k) => (cancion.blocks[k] ? { ...cancion, defaultStructure: [...ordenDe(cancion), k] } : cancion);

export function moverEnOrden(cancion, desde, destino) {
  const orden = [...ordenDe(cancion)];
  if (destino < 0 || destino >= orden.length || desde === destino) return cancion;
  const [k] = orden.splice(desde, 1);
  orden.splice(destino, 0, k);
  return { ...cancion, defaultStructure: orden };
}

// Quita una vez del orden. Si la parte ya no queda en el orden y está vacía, se borra; si tiene letra,
// se guarda aparte ("Partes sin usar") para no perder lo escrito.
export function quitarDelOrden(cancion, idx) {
  const orden = [...ordenDe(cancion)];
  const [k] = orden.splice(idx, 1);
  const out = { ...cancion, defaultStructure: orden };
  if (k && !orden.includes(k) && !tieneTexto(cancion, k)) return borrarParte(out, k);
  return out;
}

export function borrarParte(cancion, k) {
  const blocks = { ...cancion.blocks }; delete blocks[k];
  const letra = { ...(cancion.letra || {}) }; delete letra[k];
  return { ...cancion, blocks, letra, defaultStructure: (cancion.defaultStructure || []).filter((x) => x !== k) };
}

export function renombrarParte(cancion, k, nombre) {
  const label = String(nombre || "").trim();
  if (!label || !cancion.blocks[k]) return cancion;
  return { ...cancion, blocks: { ...cancion.blocks, [k]: { ...cancion.blocks[k], label, badge: distintivoDe(label) } } };
}

// ---- Letra ----
// La parte "va de la mano": lo que ven los músicos (sin acordes) es la misma letra de las diapositivas.
// Solo entonces escribir la letra actualiza también el texto de los músicos. Si alguien escribió
// los acordes con otra letra (canciones viejas), eso no se toca.
export function contenidoVaConLetra(cancion, k) {
  const lines = cancion.blocks[k]?.lines || [];
  if (!lines.some((l) => String(l).trim())) return true;
  // Palabra por palabra: los músicos pueden tener los renglones unidos distinto que las diapositivas.
  return JSON.stringify(clavesDe(lines)) === JSON.stringify(clavesDe((cancion.letra?.[k] || []).flat()));
}

// Texto para el cuadro de la parte: la letra de las diapositivas, con un renglón vacío entre una y otra.
// (Lo que ven los músicos puede traer alargamientos o "//": eso no le toca a quien escribe la letra.)
export function textoDeParte(cancion, k) {
  return (cancion.letra?.[k] || []).map((s) => (s || []).join("\n")).filter((s) => s.trim()).join("\n\n");
}

// ---- Palabras con su "clave" (la palabra como se proyecta) para comparar sin acordes ni alargamientos ----
const claveDe = (palabra) => limpiarParaProyectar(palabra);
// Para emparejar, sin mayúsculas ni signos: "Sientas," y "sientas" son la misma palabra.
const claveSuelta = (palabra) => { const c = claveDe(palabra); return c.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") || c; };
function clavesDe(lineas) {
  const out = [];
  (lineas || []).forEach((l) => String(l).split(/\s+/).forEach((t) => { const c = claveDe(t); if (c) out.push(c); }));
  return out;
}
// Lo que ven los músicos, palabra por palabra: cada palabra con sus acordes/alargamiento, si termina
// renglón, y lo que no es palabra (acordes sueltos, "//") pegado a la palabra de antes.
function palabrasDeContenido(lineas) {
  const palabras = [];
  const soloAcordes = []; // renglones de solo acordes: { antes: índice de la palabra que sigue, linea }
  (lineas || []).forEach((l) => {
    const linea = String(l);
    if (!linea.trim()) return;
    if (!clavesDe([linea]).length) { soloAcordes.push({ antes: palabras.length, linea: linea.replace(/\s+$/, "") }); return; }
    let prefijo = [];
    let ultima = null;
    linea.trim().split(/\s+/).forEach((t) => {
      const c = claveDe(t);
      if (!c) { if (ultima) ultima.sufijos.push(t); else prefijo.push(t); return; }
      ultima = { clave: c, suelta: claveSuelta(t), token: t, prefijo, sufijos: [], fin: false };
      prefijo = [];
      palabras.push(ultima);
    });
    if (ultima) ultima.fin = true;
  });
  return { palabras, soloAcordes };
}
// Pares (vieja, nueva) de palabras iguales en el mismo orden (la subsecuencia común más larga).
function emparejar(a, b) {
  const n = a.length, m = b.length;
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const par = new Map(); // nueva → vieja
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { par.set(j, i); i++; j++; } else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++;
  }
  return par;
}

// Pasa los acordes ya puestos a la letra nueva, palabra por palabra: cada palabra que sigue igual
// conserva sus acordes y su alargamiento, y los renglones quedan como los acomodó el líder (unidos o
// partidos); solo lo nuevo toma los renglones de la letra. Los renglones de solo acordes (una entrada)
// se quedan antes de la palabra que les seguía.
export function pasarAcordes(lineasViejas, lineasNuevas) {
  const { palabras: viejas, soloAcordes } = palabrasDeContenido(lineasViejas);
  const nuevas = [];
  (lineasNuevas || []).forEach((l) => {
    const toks = String(l).trim().split(/\s+/).filter(Boolean);
    toks.forEach((t, x) => nuevas.push({ texto: t, clave: claveDe(t) || t, suelta: claveSuelta(t) || t, fin: x === toks.length - 1 }));
  });
  const par = emparejar(viejas.map((p) => p.suelta), nuevas.map((p) => p.suelta));
  const out = [];
  let actual = [];
  const cerrar = () => { if (actual.length) out.push(actual.join(" ")); actual = []; };
  const pendientes = [...soloAcordes];
  nuevas.forEach((p, j) => {
    const i = par.get(j);
    if (i !== undefined) {
      // Renglones de solo acordes que iban antes de esta palabra (o de una que se borró antes que ella).
      while (pendientes.length && pendientes[0].antes <= i) { cerrar(); out.push(pendientes.shift().linea); }
      const v = viejas[i];
      // Igual: tal cual (con acordes y alargamiento). Si cambió un signo o una mayúscula: la palabra
      // nueva con los mismos acordes encima.
      const { acordes } = partirPalabra(v.token);
      const palabra = v.clave === p.clave ? v.token : armarPalabra(p.texto, acordes);
      actual.push([...v.prefijo, palabra, ...v.sufijos].join(" "));
      // Termina renglón donde lo terminaba el líder, salvo que siga letra nueva en el mismo renglón.
      if (v.fin && (p.fin || j === nuevas.length - 1 || par.has(j + 1))) cerrar();
    } else {
      actual.push(p.texto);
      if (p.fin) cerrar();
    }
  });
  cerrar();
  pendientes.forEach((x) => out.push(x.linea));
  return out.length ? out : [""];
}

// Escribir la letra de una parte. vaConLetra se decide al abrir el paso (no a cada tecla).
// Los renglones vacíos solo cortan diapositivas: los músicos ven la estrofa corrida (2026-11-20).
export function escribirLetraParte(cancion, k, texto, vaConLetra = true) {
  const b = cancion.blocks[k];
  if (!b) return cancion;
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  const letra = { ...(cancion.letra || {}), [k]: diapositivasDeLineas(lineas) };
  const corridas = lineas.map((l) => quitarAcordes(l)).filter((l) => l.trim());
  const blocks = vaConLetra ? { ...cancion.blocks, [k]: { ...b, lines: pasarAcordes(b.lines, corridas) } } : cancion.blocks;
  return { ...cancion, blocks, letra };
}

// ---- Acordes ----
// Lo que se muestra en el paso Acordes: el texto de los músicos; si está vacío, la letra escrita.
export function lineasParaAcordes(cancion, k) {
  const lines = cancion.blocks[k]?.lines || [];
  if (lines.some((l) => String(l).trim())) return lines;
  return (cancion.letra?.[k] || []).flat();
}

// Palabras de un renglón, cada una con su texto (con acordes) y su posición en el renglón.
export function palabrasDe(linea) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(String(linea)))) out.push({ texto: m[0], inicio: m.index });
  return out;
}

// ---- Una palabra por dentro: letra sin acordes + acordes con su posición (antes de qué letra) ----
export function partirPalabra(texto) {
  let plano = "";
  const acordes = [];
  const re = /\[([^\]]*)\]/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto))) {
    plano += texto.slice(ultimo, m.index);
    acordes.push({ pos: plano.length, acorde: m[1] });
    ultimo = re.lastIndex;
  }
  plano += texto.slice(ultimo);
  return { plano, acordes };
}
export function armarPalabra(plano, acordes) {
  const orden = [...acordes].sort((a, b) => a.pos - b.pos);
  let out = "", ultimo = 0;
  orden.forEach(({ pos, acorde }) => { const p = Math.min(Math.max(pos, 0), plano.length); out += plano.slice(ultimo, p) + `[${acorde}]`; ultimo = p; });
  return out + plano.slice(ultimo);
}
const cambiarPalabra = (linea, n, fn) => {
  const p = palabrasDe(linea)[n];
  if (!p) return linea;
  const nueva = fn(p.texto);
  if (!nueva) return (linea.slice(0, p.inicio) + linea.slice(p.inicio + p.texto.length)).replace(/\s{2,}/g, " ").trim();
  return linea.slice(0, p.inicio) + nueva + linea.slice(p.inicio + p.texto.length);
};

// Pone (o cambia) el acorde antes de la letra número pos de la palabra n. La letra no cambia.
// Una "palabra" que es solo un acorde se cambia entera.
export function ponerAcorde(linea, n, acorde, pos = 0) {
  return cambiarPalabra(linea, n, (texto) => {
    const { plano, acordes } = partirPalabra(texto);
    if (!plano) return `[${acorde}]`;
    return armarPalabra(plano, [...acordes.filter((a) => a.pos !== pos), { pos, acorde }]);
  });
}
// Quita el acorde de esa letra (sin pos: todos los de la palabra). Un acorde suelto se va entero.
export function quitarAcorde(linea, n, pos = null) {
  return cambiarPalabra(linea, n, (texto) => {
    const { plano, acordes } = partirPalabra(texto);
    if (!plano) return "";
    return armarPalabra(plano, pos === null ? [] : acordes.filter((a) => a.pos !== pos));
  });
}

// ---- Alargar una letra (solo para los músicos: "Dios" → "Diooos") ----
// En las diapositivas los alargamientos se limpian solos cuando la letra se repite 3 veces o más
// (o una vocal se repite después de su vocal con tilde: "Dióoos"). Por eso el primer toque pone
// tres de una vez, y una letra que ya viene doble en la palabra ("creer", "llamar") no se alarga:
// la proyección la confundiría con un alargamiento y la cortaría.
const TILDES = { á: "a", é: "e", í: "i", ó: "o", ú: "u", Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U" };
const esLetra = (c) => /\p{L}/u.test(c || "");
function tramo(plano, pos) {
  const c = plano[pos];
  if (!esLetra(c)) return null;
  const base = TILDES[c] ? null : c.toLowerCase();
  // Con tilde: la "ó" y las "o" sin tilde que le siguen.
  if (TILDES[c]) {
    let fin = pos + 1;
    while (fin < plano.length && plano[fin].toLowerCase() === TILDES[c].toLowerCase()) fin++;
    return { ini: pos, fin, letra: TILDES[c].toLowerCase(), tilde: true };
  }
  let ini = pos, fin = pos + 1;
  while (ini > 0 && plano[ini - 1].toLowerCase() === base) ini--;
  while (fin < plano.length && plano[fin].toLowerCase() === base) fin++;
  // Si antes viene la misma vocal con tilde, el tramo empieza en ella.
  if (ini > 0 && TILDES[plano[ini - 1]] && TILDES[plano[ini - 1]].toLowerCase() === base) return { ini: ini - 1, fin, letra: base, tilde: true };
  return { ini, fin, letra: base, tilde: false };
}
const largo = (t) => t.fin - t.ini - (t.tilde ? 1 : 0); // cuántas letras iguales hay (sin contar la de tilde)
export function puedeAlargar(texto, pos) {
  const { plano } = partirPalabra(texto);
  const t = tramo(plano, pos);
  return !!t && (t.tilde || largo(t) !== 2);
}
export function puedeAcortar(texto, pos) {
  const { plano } = partirPalabra(texto);
  const t = tramo(plano, pos);
  return !!t && (t.tilde ? largo(t) >= 1 : largo(t) >= 3);
}
function moverLetras(texto, pos, cuantas) {
  const { plano, acordes } = partirPalabra(texto);
  const t = tramo(plano, pos);
  if (!t || !cuantas) return texto;
  if (cuantas > 0) {
    const nuevo = plano.slice(0, t.fin) + t.letra.repeat(cuantas) + plano.slice(t.fin);
    return armarPalabra(nuevo, acordes.map((a) => (a.pos >= t.fin ? { ...a, pos: a.pos + cuantas } : a)));
  }
  const quitar = -cuantas;
  const desde = t.fin - quitar;
  const nuevo = plano.slice(0, desde) + plano.slice(t.fin);
  return armarPalabra(nuevo, acordes.map((a) => (a.pos >= t.fin ? { ...a, pos: a.pos - quitar } : a.pos > desde ? { ...a, pos: desde } : a)));
}
export function alargarLetra(linea, n, pos) {
  return cambiarPalabra(linea, n, (texto) => {
    if (!puedeAlargar(texto, pos)) return texto;
    const t = tramo(partirPalabra(texto).plano, pos);
    return moverLetras(texto, pos, t.tilde ? (largo(t) === 0 ? 2 : 1) : largo(t) === 1 ? 2 : 1);
  });
}
export function acortarLetra(linea, n, pos) {
  return cambiarPalabra(linea, n, (texto) => {
    if (!puedeAcortar(texto, pos)) return texto;
    const t = tramo(partirPalabra(texto).plano, pos);
    const l = largo(t);
    return moverLetras(texto, pos, t.tilde ? (l <= 2 ? -l : -1) : l === 3 ? -2 : -1);
  });
}

// ---- Escribir los acordes como texto (para quien escribe rápido en la computadora) ----
// Se puede escribir [G] donde sea y alargar palabras, pero la letra tiene que seguir siendo la misma:
// si cambió, se dice en qué renglón y no se guarda.
export function revisarTextoAcordes(original, texto) {
  const nuevas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  const antes = clavesDe(original || []);
  const despues = clavesDe(nuevas);
  const n = Math.max(antes.length, despues.length);
  for (let i = 0; i < n; i++) {
    if (antes[i] !== despues[i]) {
      // En qué renglón del texto quedó esa palabra.
      let cuenta = 0, renglon = nuevas.length;
      for (let r = 0; r < nuevas.length; r++) { cuenta += clavesDe([nuevas[r]]).length; if (cuenta > i) { renglon = r + 1; break; } }
      return { ok: false, renglon, esperado: antes[i] || "", escrito: despues[i] || "" };
    }
  }
  return { ok: true, lineas: nuevas.filter((l) => l.trim()).map((l) => l.replace(/\s+$/, "")) };
}

// Renglón de solo acordes (entradas, instrumentales): agrega uno al final.
export const agregarAcordeAlFinal = (linea, acorde) => `${String(linea || "").replace(/\s+$/, "")}${String(linea || "").trim() ? " " : ""}[${acorde}]`;
export const esLineaSoloAcordes = (linea) => /\[[^\]]*\]/.test(linea) && !quitarAcordes(linea).trim();
export const tieneAcordes = (cancion) => Object.values(cancion?.blocks || {}).some((b) => (b.lines || []).some((l) => /\[[^\]]*\]/.test(l)));

// ---- Renglones del músico: unir y partir (la letra y las diapositivas no cambian) ----
export function unirRenglones(lineas, i) {
  if (i < 0 || i >= lineas.length - 1) return lineas;
  const out = [...lineas];
  out.splice(i, 2, `${String(lineas[i]).replace(/\s+$/, "")} ${String(lineas[i + 1]).trim()}`);
  return out;
}
export function partirRenglon(lineas, i, n) {
  const linea = String(lineas[i] || "");
  const p = palabrasDe(linea)[n];
  if (!p || n === 0) return lineas;
  const out = [...lineas];
  out.splice(i, 1, linea.slice(0, p.inicio).replace(/\s+$/, ""), linea.slice(p.inicio));
  return out;
}
