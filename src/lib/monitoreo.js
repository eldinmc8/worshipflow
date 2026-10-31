import * as Sentry from "@sentry/react";

// Monitoreo de errores (2026-10-31, después de la pantalla en blanco que nadie vio hasta que avisaron):
// cada error que le pase a alguien en la app llega a Sentry con quién era, de qué iglesia y en qué
// versión, y Sentry manda un correo. Si no hay VITE_SENTRY_DSN configurado (ej. en desarrollo o en
// las pruebas) no hace nada.
const DSN = import.meta.env.VITE_SENTRY_DSN;
const VERSION = import.meta.env.VITE_VERSION_APP || "local";
let activo = false;

export function iniciarMonitoreo() {
  if (!DSN || activo) return;
  activo = true;
  Sentry.init({
    dsn: DSN,
    release: VERSION,
    environment: import.meta.env.MODE,
    // Solo errores — sin grabar sesiones ni medir rendimiento, para no gastar la cuota gratis ni
    // mandar más datos de los necesarios.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: [
      // Ruido conocido que no es un fallo de la app:
      "ResizeObserver loop", // aviso inofensivo del navegador
      "Failed to fetch", // sin internet (la app ya lo maneja con su propio aviso)
      "NetworkError",
      "Load failed",
      "AbortError",
      "Non-Error promise rejection captured",
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
  });
}

// Quién está usando la app — se llama cuando ya se sabe el perfil. Solo el id, el rol y la iglesia
// (nada de correo ni nombre).
export function identificarUsuario(perfil) {
  if (!activo) return;
  if (!perfil) { Sentry.setUser(null); return; }
  Sentry.setUser({ id: perfil.id });
  Sentry.setTag("iglesia", perfil.iglesias?.nombre || perfil.iglesia_id || "?");
  Sentry.setTag("rol", perfil.rol || "?");
}

export function reportarError(error, extra) {
  if (!activo) return;
  Sentry.captureException(error, extra ? { extra } : undefined);
}
