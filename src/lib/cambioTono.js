// Cambios de tono dentro de una canción e instrumentos con otra afinación (pedido de un músico de
// En-Gadi y de Eldin, 2026-11-24).
//
// · "Sube de tono": es una parte más del orden (Estructura) que dice cuántos medios tonos sube. Todo lo
//   que se toca DESPUÉS de ella (y ella misma) sale en el tono nuevo. Los acordes de toda la canción se
//   escriben en el tono original; la app los pasa sola. Si se usa dos veces, sube dos veces.
//   Se guarda SIN cambio de base: el distintivo de la parte es "↑2" (sube 2 medios tonos), y en el orden
//   de un culto es la clave "tono~2" (no existe en la canción, ver cancionParaElEvento).
//   Se guarda cuánto sube y no la nota fija, así si en un culto cambian el tono de toda la canción, la
//   subida se acomoda sola.
// · "Mi instrumento": trompeta, saxo o corno leen en otro tono que el piano. Es una preferencia de
//   cada teléfono (ver preferencias.js) que suma medios tonos SOLO a lo que ve esa persona.
import { NOTES, normalizeRoot, transposeChordToken } from "./musicTheory.js";

const RE_DISTINTIVO = /^↑(\d{1,2})$/;
const PREFIJO_EVENTO = "tono~";

const mod12 = (n) => ((Math.round(n) % 12) + 12) % 12;

// Medios tonos que sube una parte (1-11), o 0 si no es un cambio de tono.
export function semitonosCambio(block) {
  const m = RE_DISTINTIVO.exec(String(block?.badge || ""));
  if (!m) return 0;
  const n = Number(m[1]);
  return n >= 1 && n <= 11 ? n : 0;
}
export const esCambioTono = (block) => semitonosCambio(block) > 0;
export const distintivoCambio = (n) => `↑${mod12(n)}`;

// Clave de un cambio de tono puesto solo en el orden de un culto.
export const claveCambioEvento = (n) => `${PREFIJO_EVENTO}${mod12(n)}`;
export function leerClaveCambio(clave) {
  if (typeof clave !== "string" || !clave.startsWith(PREFIJO_EVENTO)) return 0;
  const n = Number(clave.slice(PREFIJO_EVENTO.length));
  return Number.isInteger(n) && n >= 1 && n <= 11 ? n : 0;
}
export const bloqueCambioEvento = (n) => ({ badge: distintivoCambio(n), label: "Sube de tono", bars: 4, lines: [] });

// Tono que queda al subir n medios tonos; un tono menor sigue siendo menor ("Am" + 2 → "Bm").
export function tonoMas(key, n) {
  if (!key) return key;
  return transposeChordToken(key, mod12(n));
}

// Medios tonos acumulados en cada posición del orden: [0, 0, 2, 2, 3...]. El cambio de tono ya cuenta
// en su propia posición.
export function cambiosPorPosicion(orden, blocks) {
  let acumulado = 0;
  return (orden || []).map((k) => {
    acumulado += semitonosCambio(blocks?.[k]);
    return mod12(acumulado);
  });
}

// "Sube a D" (o "Baja a D" si da la vuelta más corta hacia abajo, ej. 10 medios tonos = baja un tono).
export function textoCambio(n, tonoNuevo) {
  const v = mod12(n);
  return `${v <= 6 ? "Sube" : "Baja"} a ${tonoNuevo}`;
}

// "medio tono", "1 tono", "1 tono y medio"… para que se entienda sin contar semitonos.
export function cuantoSube(n) {
  const v = mod12(n);
  const abajo = v > 6;
  const s = abajo ? 12 - v : v;
  const tonos = Math.floor(s / 2), medio = s % 2 === 1;
  const t = tonos === 0 ? "medio tono" : `${tonos} tono${tonos > 1 ? "s" : ""}${medio ? " y medio" : ""}`;
  return abajo ? `baja ${t}` : `sube ${t}`;
}

// Opciones para "¿A qué tono sube?": los 11 tonos distintos al actual, del más cercano hacia arriba.
export function opcionesCambio(desdeKey) {
  return Array.from({ length: 11 }, (_, i) => ({ semitonos: i + 1, tono: tonoMas(desdeKey, i + 1) }));
}

// Los tonos por los que pasa la canción, sin repetir seguidos: ["F", "G", "A"].
export function recorridoDeTonos(key, orden, blocks) {
  if (!key) return [];
  const out = [key];
  cambiosPorPosicion(orden, blocks).forEach((s) => {
    const t = tonoMas(key, s);
    if (t !== out[out.length - 1]) out.push(t);
  });
  return out;
}

// ---- Relativa mayor/menor: "C / Am", "Am / C" ----
export function relativa(key) {
  if (!key) return "";
  const menor = key.endsWith("m");
  const raiz = normalizeRoot(menor ? key.slice(0, -1) : key);
  const i = NOTES.indexOf(raiz);
  if (i === -1) return "";
  return menor ? NOTES[(i + 3) % 12] : `${NOTES[(i + 9) % 12]}m`;
}

// ---- Instrumentos con otra afinación ----
// semitonos: cuánto hay que subir lo que suena (concierto) para que ese instrumento lo lea.
export const INSTRUMENTOS = [
  { value: "concierto", label: "Normal", detalle: "Piano, guitarra, bajo, violín, flauta, voces", semitonos: 0 },
  { value: "sib", label: "Si bemol", detalle: "Trompeta, clarinete, saxo tenor", semitonos: 2 },
  { value: "mib", label: "Mi bemol", detalle: "Saxo alto, saxo barítono", semitonos: 9 },
  { value: "fa", label: "Fa", detalle: "Corno francés", semitonos: 7 },
];
export const instrumentoPorValor = (v) => INSTRUMENTOS.find((i) => i.value === v) || INSTRUMENTOS[0];
