// Portada en el dominio propio (pedido de Eldin, 2026-11-13): en worshipflowapp.com, quien entra a "/"
// SIN sesión ve la página web (SitioWeb, la misma de /web); quien ya tiene sesión pasa directo a la app.
// La dirección vieja (worshipflow-pearl.vercel.app) se queda igual que siempre: "/" abre la app.
//
// "Entrar" de la página web lleva a "/?entrar", que siempre abre el inicio de sesión.
// Al volver de Google (?code=... o #access_token=...) también se abre la app, nunca la portada.

export const DOMINIOS_CON_PORTADA = ["worshipflowapp.com", "www.worshipflowapp.com"];

// ¿Hay una sesión de Supabase guardada en este navegador? (clave sb-<proyecto>-auth-token)
export function haySesionGuardada(storage) {
  try {
    const s = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    if (!s) return false;
    for (let i = 0; i < s.length; i++) {
      const clave = s.key(i);
      if (clave && /^sb-.+-auth-token$/.test(clave) && s.getItem(clave)) return true;
    }
  } catch {
    // Navegador sin acceso a localStorage: mejor mostrar la app (pedirá iniciar sesión).
    return true;
  }
  return false;
}

export function mostrarPortada({ hostname, pathname, search = "", hash = "", haySesion }) {
  if (!DOMINIOS_CON_PORTADA.includes((hostname || "").toLowerCase())) return false;
  if (pathname !== "/" && pathname !== "") return false;
  const params = new URLSearchParams(search);
  if (params.has("entrar")) return false;
  // Regreso del inicio de sesión con Google o de un enlace de correo.
  if (params.has("code") || params.has("error") || /access_token|refresh_token|error_description|type=/.test(hash)) return false;
  // Cualquier otro parámetro (?screen=publico, ?crear-iglesia...) lo maneja la app como siempre.
  if ([...params.keys()].length > 0) return false;
  return !haySesion;
}
