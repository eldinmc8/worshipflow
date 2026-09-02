// Reemplazo de window.confirm() nativo — ese diálogo del navegador muestra el dominio real
// (ej. "worshipflow-pearl.vercel.app dice...") en vez de sentirse parte de la app, justo lo que no
// se puede evitar sin tener un dominio propio. Este confirma con una tarjeta con la misma identidad
// visual del resto de la app (ver ConfirmDialogHost.jsx, montado una vez en main.jsx).
//
// Como window.confirm() es síncrono (bloquea y devuelve true/false de una), pero un modal de React
// no puede serlo, confirmDialog() devuelve una Promise<boolean> — cada lugar que antes hacía
// "if (!window.confirm(...)) return;" ahora hace "if (!(await confirmDialog(...))) return;" dentro
// de una función async.
const listeners = new Set();
let resolverActual = null;

export function confirmDialog(mensaje, opciones = {}) {
  // Si ya había un diálogo pendiente sin resolver (no debería pasar en la práctica, es un solo host),
  // se cancela con "false"/null en vez de quedar colgado para siempre.
  if (resolverActual) resolverActual(false);
  return new Promise((resolve) => {
    resolverActual = resolve;
    listeners.forEach((fn) => fn({ tipo: "confirm", mensaje, ...opciones }));
  });
}

// Igual que confirmDialog, pero con un campo de texto — reemplazo de window.prompt() (ej. "Nueva
// contraseña"). Devuelve el texto escrito, o null si se cancela/cierra sin escribir nada.
export function promptDialog(mensaje, opciones = {}) {
  if (resolverActual) resolverActual(null);
  return new Promise((resolve) => {
    resolverActual = resolve;
    listeners.forEach((fn) => fn({ tipo: "prompt", mensaje, ...opciones }));
  });
}

export function subscribeConfirm(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resolverConfirm(valor) {
  if (resolverActual) {
    resolverActual(valor);
    resolverActual = null;
  }
}
