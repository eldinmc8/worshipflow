// Pantalla completa en todos los navegadores (arreglo del 2026-11-02, pedido de Eldin: "en iPhone sale
// 'Toca para pantalla completa', tocamos y el aviso no se quita").
//
// - Chrome, Edge, Firefox, Android: requestFullscreen normal.
// - Safari en iPad y Mac: solo con prefijo (webkitRequestFullscreen / webkitFullscreenElement).
// - Safari en iPhone: Apple NO permite pantalla completa para páginas web (solo para videos). Ahí no hay
//   nada que pedir: el aviso de "toca para pantalla completa" nunca debe salir, o se queda para siempre.
//   Lo más parecido en iPhone es "Agregar a inicio" desde Compartir (se abre sin las barras de Safari).

export function soportaPantallaCompleta(doc = typeof document !== "undefined" ? document : null) {
  const el = doc?.documentElement;
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen) && (doc.fullscreenEnabled !== false || doc.webkitFullscreenEnabled));
}

export function estaEnPantallaCompleta(doc = typeof document !== "undefined" ? document : null) {
  return !!(doc && (doc.fullscreenElement || doc.webkitFullscreenElement));
}

// Devuelve true si quedó en pantalla completa; nunca lanza error.
export async function pedirPantallaCompleta(doc = typeof document !== "undefined" ? document : null) {
  const el = doc?.documentElement;
  if (!el) return false;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  return estaEnPantallaCompleta(doc);
}

export function salirDePantallaCompleta(doc = typeof document !== "undefined" ? document : null) {
  try {
    if (doc?.exitFullscreen && doc.fullscreenElement) doc.exitFullscreen().catch?.(() => {});
    else if (doc?.webkitExitFullscreen && doc.webkitFullscreenElement) doc.webkitExitFullscreen();
  } catch { /* nada */ }
}

// Escucha entrar/salir de pantalla completa (con y sin prefijo). Devuelve la función para dejar de escuchar.
export function alCambiarPantallaCompleta(cb, doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return () => {};
  doc.addEventListener("fullscreenchange", cb);
  doc.addEventListener("webkitfullscreenchange", cb);
  return () => { doc.removeEventListener("fullscreenchange", cb); doc.removeEventListener("webkitfullscreenchange", cb); };
}

// iPhone/iPod (el iPad moderno se presenta como Mac con pantalla táctil y sí soporta el prefijo).
export function esIphone(nav = typeof navigator !== "undefined" ? navigator : null) {
  return /iPhone|iPod/i.test(nav?.userAgent || "");
}
