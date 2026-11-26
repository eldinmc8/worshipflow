// Crear la iglesia con Google (pedido de Eldin, 2026-11-26).
//
// Antes, entrar con Google sin estar invitado mostraba "Todavía no tienes acceso" y borraba la cuenta. En los días
// antes del lanzamiento eso le pasó a varias iglesias que querían registrarse. Ahora AuthGate le pregunta si quiere
// crear su iglesia (SinIglesia.jsx) o si lo invitaron. La pantalla "Crear mi iglesia" también trae "Crear con
// Google": como Google regresa a la dirección principal sin ?crear-iglesia, el pedido (y el código de invitación, si
// trae) se guarda en este equipo 2 horas para abrir directo el formulario corto al volver.

const LLAVE = "wf_crear_iglesia_google";
export const VIGENCIA_MS = 2 * 60 * 60 * 1000;

export function guardarPedidoCrear(codigo = "", ahora = Date.now()) {
  try { localStorage.setItem(LLAVE, JSON.stringify({ t: ahora, codigo: String(codigo || "").trim() })); } catch { /* sin storage */ }
}

// { codigo } si hay un pedido vigente en este equipo, o null.
export function pedidoCrear(ahora = Date.now()) {
  try {
    const p = JSON.parse(localStorage.getItem(LLAVE) || "null");
    if (!p || !p.t || ahora - p.t < 0 || ahora - p.t >= VIGENCIA_MS) return null;
    return { codigo: p.codigo || "" };
  } catch { return null; }
}

export function olvidarPedidoCrear() {
  try { localStorage.removeItem(LLAVE); } catch { /* sin storage */ }
}

// Nombre sugerido para quien entró con Google (o se registró con nombre).
export function nombreSugerido(user) {
  const m = user?.user_metadata || {};
  return String(m.nombre || m.full_name || m.name || "").trim();
}
