// Cuántos grupos de la cinta de la consola caben a la vista (pedido de Eldin, 2026-10-21: "no le gusta
// que haya que correr eso, mejor un botón que diga más opciones al final"). Los grupos se muestran en
// orden; los que no caben pasan al botón "Más opciones" del final.
//
// anchos: ancho en px de cada grupo, en orden (null/undefined si todavía no se ha medido).
// disponible: ancho útil de la cinta. anchoBoton: lo que ocupa el botón "Más opciones".
// Devuelve cuántos grupos (desde el primero) se dejan a la vista. Siempre al menos 1.
export function gruposQueCaben(anchos, disponible, anchoBoton) {
  const n = anchos.length;
  if (n === 0) return 0;
  // Si falta medir alguno, se muestran todos para poder medirlos.
  if (anchos.some((a) => a == null)) return n;
  const total = anchos.reduce((s, a) => s + a, 0);
  if (total <= disponible) return n;
  let usado = anchoBoton;
  let caben = 0;
  for (const a of anchos) {
    if (usado + a > disponible) break;
    usado += a;
    caben++;
  }
  return Math.max(1, caben);
}
