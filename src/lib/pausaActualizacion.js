// No actualizar en pleno culto (arreglo del 2026-11-09: "cuando estamos en vivo de repente se va a la
// primera diapositiva").
//
// Cada versión nueva se aplicaba sola y RECARGABA la página (lib/swUpdate.js), también en la computadora
// que estaba transmitiendo: la consola volvía a la primera diapositiva y la proyección perdía la pantalla
// completa. Ahora, mientras esta computadora transmite (o practica), o si es una pantalla de
// proyección/escenario, la versión nueva se queda esperando. Al finalizar el evento se aplica sola, unos
// segundos después (para no cortar el aviso de "terminó" que se manda a la base).
// Módulo aparte, sin dependencias, para que la consola lo use sin cargar el registro de la PWA.

let enPausa = false;
let reloj = null;
let alReanudarFn = null;

export const ESPERA_AL_REANUDAR_MS = 4000;

export function pausarActualizacion(pausar) {
  enPausa = !!pausar;
  clearTimeout(reloj);
  if (enPausa) return;
  reloj = setTimeout(() => { if (!enPausa) alReanudarFn?.(); }, ESPERA_AL_REANUDAR_MS);
}

export function actualizacionEnPausa() {
  return enPausa;
}

// swUpdate.js dice qué hacer al reanudar (aplicar la versión que quedó esperando, si hay).
export function alReanudar(fn) {
  alReanudarFn = fn;
}
