// Modo oscuro del chrome de la app — cada quien decide en su propio dispositivo (no es una
// preferencia de cuenta sincronizada entre dispositivos, es de este navegador nada más, igual que la
// versión de Biblia elegida o los semitonos del capo). NO aplica a la pantalla de Proyección real ni
// a sus mini-previews: esas se quedan siempre oscuras, como escenario, sin importar esto (ver
// CLAUDE.md e index.css).
//
// Tres opciones — "claro" es el valor por defecto (la app se queda clara/cálida a menos que la
// persona decida lo contrario):
//   - "claro": siempre claro.
//   - "oscuro": siempre oscuro.
//   - "auto": sigue el tema del sistema operativo/navegador (prefers-color-scheme) y se actualiza
//     solo si la persona cambia el tema del sistema mientras la app está abierta.
const KEY = "worshipflow_tema";
const listeners = new Set();
let mediaQuery = null;

export function getTema() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "oscuro" || v === "auto" ? v : "claro";
  } catch {
    return "claro";
  }
}

function prefiereOscuroElSistema() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function resolverOscuro(tema) {
  return tema === "oscuro" || (tema === "auto" && prefiereOscuroElSistema());
}

function aplicarAlDocumento(tema) {
  document.documentElement.setAttribute("data-theme", resolverOscuro(tema) ? "dark" : "light");
}

// Mientras el tema sea "auto", si la persona cambia el tema de su celular/computadora con la app ya
// abierta, esto lo detecta solo — sin tener que reabrir la app para que se note el cambio.
function escucharSistema(tema) {
  if (mediaQuery) { mediaQuery.onchange = null; mediaQuery = null; }
  if (tema !== "auto" || typeof window === "undefined" || !window.matchMedia) return;
  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.onchange = () => aplicarAlDocumento("auto");
}

export function setTema(tema) {
  try {
    localStorage.setItem(KEY, tema);
  } catch {
    // localStorage no disponible (modo incógnito estricto, etc.) — el tema no persiste entre
    // recargas, pero igual se aplica para esta sesión.
  }
  aplicarAlDocumento(tema);
  escucharSistema(tema);
  listeners.forEach((fn) => fn(tema));
}

export function subscribeTema(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Se llama una sola vez al arrancar la app (ver main.jsx), antes de que React monte nada — así no
// hay un parpadeo de claro-y-luego-oscuro si la persona ya había elegido oscuro (o "auto" con el
// sistema en oscuro) antes. La pantalla de Proyección real nunca llama esto: siempre se ve oscura.
export function iniciarTema() {
  const tema = getTema();
  aplicarAlDocumento(tema);
  escucharSistema(tema);
}
