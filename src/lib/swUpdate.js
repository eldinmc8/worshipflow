// registerSW (de virtual:pwa-register, generado por vite-plugin-pwa) es lo que de verdad conecta
// registerType:'autoUpdate' con recargar la página sola cuando hay una versión nueva -- antes esto no
// se llamaba desde ningún lado, así que ese comportamiento nunca se activaba (ver la nota en
// vite.config.js sobre injectRegister:false). Con auto:true, en cuanto el service worker nuevo termina
// de activarse, la propia librería hace window.location.reload() sin que haga falta código extra acá.
import { registerSW } from "virtual:pwa-register";

// Que el service worker se ACTIVE apenas hay uno nuevo no basta: el navegador solo lo busca por su
// cuenta al cargar la página o, en el mejor de los casos, una vez cada tanto (en instalado de iPhone
// esto es particularmente poco confiable). Si alguien deja la PWA abierta días enteros sin cerrarla
// del todo, podía quedarse corriendo la versión vieja indefinidamente sin que nadie se lo pidiera.
// checkForUpdate() fuerza una revisión de verdad contra el sw.js del servidor: al abrir la app, cada
// vez que vuelve a primer plano (cambiar de pestaña/app y volver), y como respaldo cada hora mientras
// se quede abierta.
let registration = null;

export function iniciarActualizacionAutomatica() {
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      registration = reg || null;
    },
  });

  const checkForUpdate = () => registration?.update().catch(() => {});
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.addEventListener("focus", checkForUpdate);
  setInterval(checkForUpdate, 60 * 60 * 1000);
}

// Para el botón "Buscar actualizaciones" en Ajustes: dispara la misma revisión que ya corre sola en
// segundo plano, pero de inmediato y con retroalimentación visible, para quien no quiera esperar a que
// pase algo de los chequeos automáticos (o simplemente quiera confirmar que ya tiene la última versión
// después de que le avisamos que publicamos un cambio). Si SÍ hay una versión nueva, el propio
// autoUpdate ya la recarga sola apenas activa (ver iniciarActualizacionAutomatica/register.js) — por
// eso esta función no "aplica" nada ella misma, solo espera un momento razonable: si para entonces la
// recarga automática no se disparó sola, es que no había ninguna actualización pendiente.
export function buscarActualizacionManual() {
  if (!registration) return Promise.resolve();
  return registration.update()
    .catch(() => {})
    .then(() => new Promise((resolve) => setTimeout(resolve, 4000)));
}
