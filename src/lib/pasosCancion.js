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
const lineasLetra = (lineas) => (lineas || []).filter((l) => limpiarParaProyectar(l));
// La parte "va de la mano": lo que ven los músicos (sin acordes) es la misma letra de las diapositivas.
// Solo entonces escribir la letra actualiza también el texto de los músicos. Si alguien escribió
// los acordes con otra letra (canciones viejas), eso no se toca.
export function contenidoVaConLetra(cancion, k) {
  const lines = cancion.blocks[k]?.lines || [];
  if (!lines.some((l) => String(l).trim())) return true;
  const a = lineasLetra(lines).map(limpiarParaProyectar);
  const b = (cancion.letra?.[k] || []).flat().map((l) => limpiarParaProyectar(l)).filter(Boolean);
  return JSON.stringify(a) === JSON.stringify(b);
}

// Texto para el cuadro de la parte: el de los músicos sin acordes (conserva los renglones vacíos tal
// como se escribieron) o, si no va de la mano, el de las diapositivas.
export function textoDeParte(cancion, k) {
  const lines = cancion.blocks[k]?.lines || [];
  if (lines.some((l) => String(l).trim()) && contenidoVaConLetra(cancion, k)) {
    return lines.filter((l) => String(l).trim() === "" || quitarAcordes(l).trim()).map((l) => quitarAcordes(l).replace(/\s+$/, "")).join("\n").replace(/^\n+|\n+$/g, "");
  }
  return (cancion.letra?.[k] || []).map((s) => (s || []).join("\n")).filter((s) => s.trim()).join("\n\n");
}

// Pasa los acordes ya puestos a la letra nueva: cada renglón que sigue igual conserva sus acordes.
// Los renglones que solo tenían acordes (ej. una entrada) se quedan antes del renglón que seguía.
export function pasarAcordes(lineasViejas, lineasNuevas) {
  const viejas = (lineasViejas || []).map(String);
  const clave = viejas.map((l) => limpiarParaProyectar(l));
  const usadas = new Set();
  const destino = new Map(); // índice viejo (con letra) → índice nuevo
  const salida = lineasNuevas.map((l, i) => {
    const c = limpiarParaProyectar(l);
    if (!c) return "";
    let j = clave[i] === c && !usadas.has(i) ? i : clave.findIndex((x, idx) => x === c && !usadas.has(idx));
    if (j < 0) return l.replace(/\s+$/, "");
    usadas.add(j);
    destino.set(j, i);
    return viejas[j];
  });
  // Renglones de solo acordes
  const antesDe = new Map();
  const alFinal = [];
  viejas.forEach((l, i) => {
    if (!/\[[^\]]*\]/.test(l) || quitarAcordes(l).trim()) return;
    let j = i + 1;
    while (j < viejas.length && !clave[j]) j++;
    const n = j < viejas.length ? destino.get(j) : undefined;
    if (n === undefined) { if (j >= viejas.length) alFinal.push(l); return; }
    antesDe.set(n, [...(antesDe.get(n) || []), l]);
  });
  const out = [];
  salida.forEach((l, i) => { (antesDe.get(i) || []).forEach((x) => out.push(x)); out.push(l); });
  out.push(...alFinal);
  while (out.length && !String(out[out.length - 1]).trim()) out.pop();
  return out.length ? out : [""];
}

// Escribir la letra de una parte. vaConLetra se decide al abrir el paso (no a cada tecla).
export function escribirLetraParte(cancion, k, texto, vaConLetra = true) {
  const b = cancion.blocks[k];
  if (!b) return cancion;
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  const letra = { ...(cancion.letra || {}), [k]: diapositivasDeLineas(lineas) };
  const blocks = vaConLetra ? { ...cancion.blocks, [k]: { ...b, lines: pasarAcordes(b.lines, lineas.map((l) => quitarAcordes(l))) } } : cancion.blocks;
  return { ...cancion, blocks, letra };
}

// ---- Acordes ----
// Lo que se muestra en el paso Acordes: el texto de los músicos; si está vacío, la letra escrita.
export function lineasParaAcordes(cancion, k) {
  const lines = cancion.blocks[k]?.lines || [];
  if (lines.some((l) => String(l).trim())) return lines;
  const slides = cancion.letra?.[k] || [];
  return slides.flatMap((s, i) => (i ? ["", ...s] : s));
}

// Palabras de un renglón, cada una con su texto (con acordes) y su posición en el renglón.
export function palabrasDe(linea) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(String(linea)))) out.push({ texto: m[0], inicio: m.index });
  return out;
}

// Pone el acorde al principio de la palabra n; si la palabra ya tenía uno (aunque esté a media
// palabra, ej. "firma[G]mento"), lo cambia ahí mismo. La letra no cambia.
export function ponerAcorde(linea, n, acorde) {
  const p = palabrasDe(linea)[n];
  if (!p) return linea;
  const nueva = /\[[^\]]*\]/.test(p.texto) ? p.texto.replace(/\[[^\]]*\]/, `[${acorde}]`) : `[${acorde}]${p.texto}`;
  return linea.slice(0, p.inicio) + nueva + linea.slice(p.inicio + p.texto.length);
}
// Quita los acordes de la palabra n. Si la "palabra" era solo un acorde, se va entera.
export function quitarAcorde(linea, n) {
  const p = palabrasDe(linea)[n];
  if (!p) return linea;
  const sin = quitarAcordes(p.texto);
  if (!sin) return (linea.slice(0, p.inicio) + linea.slice(p.inicio + p.texto.length)).replace(/\s{2,}/g, " ").trim();
  return linea.slice(0, p.inicio) + sin + linea.slice(p.inicio + p.texto.length);
}
// Renglón de solo acordes (entradas, instrumentales): agrega uno al final.
export const agregarAcordeAlFinal = (linea, acorde) => `${String(linea || "").replace(/\s+$/, "")}${String(linea || "").trim() ? " " : ""}[${acorde}]`;
export const esLineaSoloAcordes = (linea) => /\[[^\]]*\]/.test(linea) && !quitarAcordes(linea).trim();
export const tieneAcordes = (cancion) => Object.values(cancion?.blocks || {}).some((b) => (b.lines || []).some((l) => /\[[^\]]*\]/.test(l)));
