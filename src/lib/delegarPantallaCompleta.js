// Proyección en pantalla completa SIN tocar la segunda pantalla (2026-11-08, reporte de EL AMATE: "no
// podíamos darle clic a la segunda pantalla").
//
// Por qué antes no entraba sola: la consola abría la ventana de proyección y le pedía pantalla completa
// desde la consola (popup.document.documentElement.requestFullscreen()). Chrome lo rechaza siempre
// ("Permissions check failed"): el clic de "Iniciar evento" cuenta para la ventana de la consola, no para
// la de proyección. Quedaba en ventana normal esperando que alguien la tocara EN el proyector — y con el
// proyector en el techo y el mouse en otra pantalla, la gente no sabía o no podía.
//
// Cómo se arregla: Chrome deja que una ventana le "pase" su permiso de pantalla completa a otra ventana
// del mismo sitio (delegación de capacidad: postMessage con { delegate: "fullscreen" }). La consola,
// todavía con el clic fresco, se lo pasa a la ventana de proyección y esta entra sola en pantalla
// completa. Probado en Chromium: funciona si la proyección avisa que está lista dentro de ~5 segundos
// del clic; por eso el aviso sale de un script mínimo en index.html (no espera a que cargue la app).
// En el navegador que no lo soporte no pasa nada malo: queda el aviso de siempre en la proyección, y
// tocar "Abrir proyección" en la consola lo vuelve a intentar con la ventana ya cargada.

export const MENSAJE_LISTA = "wf-proyeccion-lista"; // proyección → consola: "ya puedo recibirlo"
export const MENSAJE_FS = "wf-pantalla-completa"; // consola → proyección: "entra en pantalla completa"

// Le pasa a la ventana de proyección el permiso de pantalla completa del clic actual. false si el
// navegador no dejó (sin clic reciente, ventana cerrada, etc.).
export function delegarPantallaCompleta(ventana, origen) {
  if (!ventana || ventana.closed) return false;
  try {
    ventana.postMessage({ wf: MENSAJE_FS }, { targetOrigin: origen, delegate: "fullscreen" });
    return true;
  } catch {
    return false;
  }
}

// Espera el aviso de "lista" de ESA ventana de proyección y en ese momento le delega la pantalla
// completa. Hay que llamarla justo después de window.open (en el mismo clic). Resuelve true/false.
export function esperarListaYDelegar(ventana, { origen, escucha = typeof window !== "undefined" ? window : null, limiteMs = 6000 } = {}) {
  return new Promise((resolver) => {
    if (!ventana || !escucha) { resolver(false); return; }
    let hecho = false;
    const terminar = (ok) => {
      if (hecho) return;
      hecho = true;
      escucha.removeEventListener("message", alMensaje);
      clearTimeout(reloj);
      resolver(ok);
    };
    function alMensaje(e) {
      if (e.source !== ventana || e.origin !== origen || e.data?.wf !== MENSAJE_LISTA) return;
      terminar(delegarPantallaCompleta(ventana, origen));
    }
    escucha.addEventListener("message", alMensaje);
    const reloj = setTimeout(() => terminar(false), limiteMs);
  });
}
