// registerSW (de virtual:pwa-register, generado por vite-plugin-pwa) es lo que de verdad conecta
// registerType:'prompt' (ver vite.config.js) con avisar cuando hay una versión nueva -- antes esto no
// se llamaba desde ningún lado, así que ese comportamiento nunca se activaba (ver la nota en
// vite.config.js sobre injectRegister:false).
import { registerSW } from "virtual:pwa-register";

let registration = null;
// Función que devuelve registerSW() -- llamarla (ver aplicarActualizacion) le avisa al service worker
// en espera que ya puede tomar control. Con registerType:'prompt' NO se aplica sola: se queda
// genuinamente esperando hasta que la persona toque "Actualizar" en el aviso visible.
let updateServiceWorker = null;
let refreshNeeded = false;

// Que el service worker se ACTIVE apenas hay uno nuevo no basta: el navegador solo lo busca por su
// cuenta al cargar la página o, en el mejor de los casos, una vez cada tanto (en instalado de iPhone
// esto es particularmente poco confiable). Si alguien deja la PWA abierta días enteros sin cerrarla
// del todo, podía quedarse corriendo la versión vieja indefinidamente sin que nadie se lo pidiera.
// checkForUpdate() fuerza una revisión de verdad contra el sw.js del servidor: al abrir la app, cada
// vez que vuelve a primer plano (cambiar de pestaña/app y volver), y como respaldo cada hora mientras
// se quede abierta.
//
// onUpdateAvailable(callback) se dispara apenas hay una versión nueva instalada y esperando (evento
// "waiting" de Workbox) -- quien llama a esto (main.jsx) lo usa para mostrar un aviso VISIBLE con un
// botón "Actualizar" en vez de dejarlo escondido en un botón de Ajustes que mucha gente ni sabe que
// existe ni va a ir a buscar nunca.
export function iniciarActualizacionAutomatica(onUpdateAvailable) {
  if (!("serviceWorker" in navigator)) return;

  // Recarga la página apenas el service worker NUEVO toma el control (tras el SKIP_WAITING que manda
  // aplicarActualizacion) -- probado en vivo que depender solo del propio manejo interno de "controlar"
  // de la librería de registro NO siempre alcanzaba: el service worker sí quedaba activo con la versión
  // nueva, pero la página se quedaba mostrando el aviso de "hay una actualización" sin recargarse sola,
  // dejando a la persona sin saber si de verdad pasó algo al tocar "Actualizar". Este es el patrón
  // estándar y más confiable (documentado por el propio Chrome/MDN): escuchar el evento del navegador
  // directamente, sin intermediarios.
  let recargando = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });

  updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      registration = reg || null;
    },
    onNeedRefresh() {
      refreshNeeded = true;
      onUpdateAvailable?.();
    },
  });

  const checkForUpdate = () => registration?.update().catch(() => {});
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.addEventListener("focus", checkForUpdate);
  setInterval(checkForUpdate, 60 * 60 * 1000);
}

// El botón "Actualizar" del aviso visible (o, si ya hay una detectada, el de "Buscar actualizaciones"
// en Ajustes): le manda al service worker en espera el mensaje SKIP_WAITING (ver sw.js) y, apenas toma
// control, recarga la página sola.
export function aplicarActualizacion() {
  return updateServiceWorker?.(true);
}

// Para el botón "Buscar actualizaciones" en Ajustes: dispara la misma revisión que ya corre sola en
// segundo plano, pero de inmediato. Si encuentra una versión nueva, eso ya dispara el aviso visible de
// arriba (onNeedRefresh) por su cuenta -- este botón solo necesita esperar un momento razonable y
// avisar si NO había ninguna pendiente (ver hayActualizacionPendiente).
export function buscarActualizacionManual() {
  if (!registration) return Promise.resolve();
  return registration.update()
    .catch(() => {})
    .then(() => new Promise((resolve) => setTimeout(resolve, 3000)));
}

export function hayActualizacionPendiente() {
  return refreshNeeded;
}
