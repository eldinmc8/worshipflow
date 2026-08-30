// Aviso flotante y bonito para errores/mensajes de la app — reemplaza los window.alert() nativos
// (feos, bloquean todo, y antes mostraban el mensaje técnico crudo de Supabase/JS tal cual, como si
// la app estuviera rota). Un solo suscriptor real (ToastHost.jsx, montado una vez en main.jsx)
// escucha estos eventos desde cualquier pantalla, así no hace falta pasar props por toda la app.
const listeners = new Set();
let nextId = 1;

export function showToast(message, type = "info") {
  const toast = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(toast));
}

export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Distingue un fallo por falta de internet de un error real de la app, para no culparla de algo que
// en realidad es que se cortó la señal — y para no mostrarle a la iglesia un mensaje técnico (fetch
// failed, TypeError, etc.) que se ve como que la app está fallando.
function esFalloDeConexion(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return /failed to fetch|networkerror|load failed|network request failed/i.test(err?.message || "");
}

// Reemplazo directo de "window.alert(PREFIJO + ': ' + e.message)" en un catch — registra el error
// real en consola (para poder depurarlo) pero solo muestra al usuario un aviso bonito y sin detalles
// técnicos, distinto según sea o no un problema de conexión.
export function notifyError(prefix, err) {
  console.error(prefix, err);
  if (esFalloDeConexion(err)) {
    showToast(`${prefix} — no hay conexión a internet ahora mismo.`, "offline");
  } else {
    showToast(`${prefix}. Inténtalo de nuevo.`, "error");
  }
}
