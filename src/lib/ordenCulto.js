// "¿En qué parte del culto va?" (pedido de Eldin, 2026-10-11): al agregar algo se elige el bloque
// (Bienvenida, Bloque de Alabanza, Prédica…) y entra al FINAL de ese bloque, justo antes del bloque
// que sigue. Sin bloque elegido, entra al final del culto.

// Bloques del culto, en orden, con cuántos elementos tiene cada uno.
export function bloquesDelCulto(orden = []) {
  const bloques = [];
  orden.forEach((it) => {
    if (it.type === "seccion") bloques.push({ id: it.id, titulo: it.title || "Bloque", cuantos: 0 });
    else if (bloques.length) bloques[bloques.length - 1].cuantos++;
  });
  return bloques;
}

// Índice donde termina un bloque (el del siguiente bloque, o el final). -1 si no existe.
export function finDeBloque(orden, bloqueId) {
  const i = orden.findIndex((it) => it.id === bloqueId && it.type === "seccion");
  if (i === -1) return -1;
  const j = orden.findIndex((it, k) => k > i && it.type === "seccion");
  return j === -1 ? orden.length : j;
}

// El último elemento de un bloque (o el bloque mismo si está vacío): lo que se usa como "después de".
export function anclaDeBloque(orden, bloqueId) {
  const fin = finDeBloque(orden, bloqueId);
  return fin === -1 ? null : orden[fin - 1];
}

// Inserta items al final del bloque elegido (o al final del culto si no hay / no existe). No modifica `orden`.
export function insertarEnBloque(orden, items, bloqueId) {
  const lista = Array.isArray(items) ? items : [items];
  const fin = bloqueId ? finDeBloque(orden, bloqueId) : -1;
  if (fin === -1) return [...orden, ...lista];
  return [...orden.slice(0, fin), ...lista, ...orden.slice(fin)];
}
