// Dominio propio, estilo OnStage (pedido de Eldin, 2026-11-13):
// - worshipflowapp.com (y www): "/" SIEMPRE muestra la página web (SitioWeb, la misma de /web),
//   tenga o no sesión la persona.
// - app.worshipflowapp.com: la app. El botón "Abrir la app web" de la página lleva ahí.
// - La dirección vieja (worshipflow-pearl.vercel.app) se queda igual que siempre: "/" abre la app.

export const DOMINIOS_PAGINA = ["worshipflowapp.com", "www.worshipflowapp.com"];
export const URL_APP_PROPIA = "https://app.worshipflowapp.com/";

const esDominioPagina = (hostname) => DOMINIOS_PAGINA.includes((hostname || "").toLowerCase());

// A dónde lleva "Abrir la app web": desde el dominio propio, a app.worshipflowapp.com; si no, a "/".
export function direccionApp(hostname) {
  return esDominioPagina(hostname) ? URL_APP_PROPIA : "/";
}

export function mostrarPortada({ hostname, pathname, search = "", hash = "", instalada = false }) {
  if (!esDominioPagina(hostname)) return false;
  // App instalada (ícono en el celular o la computadora): siempre abre la app, nunca la página web
  // (2026-11-17, iglesia que usa la app para la Biblia: quien la instaló desde worshipflowapp.com antes
  // del cambio veía la página web, y "Abrir la app web" la sacaba al navegador).
  if (instalada) return false;
  if (pathname !== "/" && pathname !== "") return false;
  const params = new URLSearchParams(search);
  // Regreso de un inicio de sesión o de un enlace de correo: lo maneja la app.
  if (params.has("code") || params.has("error") || /access_token|refresh_token|error_description|type=/.test(hash)) return false;
  // Enlaces viejos con parámetros (?screen=publico, ?crear-iglesia...) siguen funcionando como siempre.
  if ([...params.keys()].length > 0) return false;
  return true;
}
