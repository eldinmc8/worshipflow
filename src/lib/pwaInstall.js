// Captura el evento "beforeinstallprompt" a nivel de módulo (no dentro de un componente) para no
// perdérnoslo si dispara antes de que el usuario llegue a Ajustes — este archivo se importa una sola
// vez desde main.jsx, apenas arranca la app.
let deferredPrompt = null;
let installed = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  notify();
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installed = true;
  notify();
});

export function getInstallState() {
  return { canInstall: !!deferredPrompt, installed };
}

export function subscribeInstallState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// iOS Safari nunca dispara beforeinstallprompt — ahí solo se puede guiar al usuario a hacerlo a mano.
export function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (outcome === "accepted") installed = true;
  notify();
  return outcome === "accepted";
}
