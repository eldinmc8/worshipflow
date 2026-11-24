// Orden de una canción SOLO para un evento (pedido de un músico, 2026-11-24): en el ensayo a veces se
// decide empezar por el coro, repetir una parte o, en una mezcla, terminar con el coro de OTRA canción.
// Ese orden vive en el ítem del setlist (`item.ordenEvento`, guardado en items_servicio.estructura como
// { ordenEvento: [...] }, sin cambio de base) y NUNCA toca la canción del cancionero.
//
// Una parte de otra canción se guarda como una clave especial "otra~<idCanción>~<claveParte>": no se
// copia la letra, se toma de esa canción cada vez (si alguien la corrige, aquí sale corregida).
import { semitoneShift, transposeLine } from "./musicTheory.js";

const PREFIJO = "otra~";

export function claveDeOtra(cancionId, claveParte) {
  return `${PREFIJO}${cancionId}~${claveParte}`;
}

// { cancionId, claveParte } si la clave es de otra canción; null si es una parte propia.
export function leerClaveOtra(clave) {
  if (typeof clave !== "string" || !clave.startsWith(PREFIJO)) return null;
  const resto = clave.slice(PREFIJO.length);
  const corte = resto.indexOf("~");
  if (corte <= 0 || corte === resto.length - 1) return null;
  return { cancionId: resto.slice(0, corte), claveParte: resto.slice(corte + 1) };
}

// El orden especial del ítem, o null si se canta como en el cancionero.
export function ordenEventoDe(item) {
  return Array.isArray(item?.ordenEvento) && item.ordenEvento.length > 0 ? item.ordenEvento : null;
}

// Orden con el que arranca la ventana: el especial si ya hay uno; si no, el de la canción.
export function ordenInicial(song, item) {
  const propio = ordenEventoDe(item);
  if (propio) return [...propio];
  const blocks = song?.blocks || {};
  const base = (song?.defaultStructure || []).filter((k) => blocks[k]);
  return base.length ? base : Object.keys(blocks);
}

// ¿El orden elegido es igual al del cancionero? (entonces no hace falta guardarlo como especial)
export function esIgualAlOriginal(song, orden) {
  return JSON.stringify(orden || []) === JSON.stringify(ordenInicial(song, null));
}

// La parte de otra canción lista para usarse dentro de ESTA canción: acordes pasados al tono de esta
// canción (así la banda sigue en el mismo tono) y el nombre con el título de donde viene.
function parteDeOtra(song, clave, library) {
  const ref = leerClaveOtra(clave);
  if (!ref) return null;
  const otra = (library || []).find((s) => s.id === ref.cancionId);
  const b = otra?.blocks?.[ref.claveParte];
  if (!b) return null;
  const semitonos = otra.key && song.key ? semitoneShift(otra.key, song.key) : 0;
  const tieneLetra = !!(otra.letra && ref.claveParte in otra.letra);
  return {
    block: { ...b, lines: (b.lines || []).map((l) => (semitonos ? transposeLine(l, semitonos) : l)), label: `${b.label || ref.claveParte} · ${otra.title}`, origen: { cancionId: otra.id, claveParte: ref.claveParte, titulo: otra.title } },
    letra: tieneLetra ? otra.letra[ref.claveParte] : undefined,
  };
}

// Copia de la canción para ESTE ítem del setlist: con el orden especial como su Estructura y con las
// partes de otras canciones agregadas. Sin orden especial devuelve la misma canción. Todo lo que arma
// diapositivas, la vista del músico y la pantalla de escenario usa esta copia; la biblioteca no cambia.
export function cancionParaElEvento(song, item, library) {
  const orden = ordenEventoDe(item);
  if (!song || !orden) return song;
  const blocks = { ...(song.blocks || {}) };
  const letra = { ...(song.letra || {}) };
  for (const clave of new Set(orden)) {
    if (blocks[clave] || !leerClaveOtra(clave)) continue;
    const p = parteDeOtra(song, clave, library);
    if (!p) continue;
    blocks[clave] = p.block;
    if (p.letra !== undefined) letra[clave] = p.letra;
  }
  const valido = orden.filter((k) => blocks[k]);
  if (!valido.length) return song;
  return { ...song, blocks, letra, defaultStructure: valido, ordenEspecial: true };
}

// Nombre corto para mostrar en el setlist: "C · V1 · C · C (Otra canción)".
export function resumenOrden(song, item, library) {
  const c = cancionParaElEvento(song, item, library);
  if (!c?.ordenEspecial) return "";
  return c.defaultStructure.map((k) => {
    const b = c.blocks[k];
    const corto = b.badge || b.label || k;
    return b.origen ? `${corto} (${b.origen.titulo})` : corto;
  }).join(" · ");
}

// ---- Cambios al orden (para la ventana "Orden para este culto") ----
export function moverParte(orden, desde, destino) {
  if (destino < 0 || destino >= orden.length || desde === destino) return orden;
  const out = [...orden];
  const [k] = out.splice(desde, 1);
  out.splice(destino, 0, k);
  return out;
}

export function quitarParte(orden, idx) {
  return orden.filter((_, i) => i !== idx);
}

// Repite la parte justo después de donde está (x2), que es lo que se hace en un ensayo.
export function repetirAqui(orden, idx) {
  if (idx < 0 || idx >= orden.length) return orden;
  return [...orden.slice(0, idx + 1), orden[idx], ...orden.slice(idx + 1)];
}

export function agregarAlFinal(orden, clave) {
  return [...orden, clave];
}
