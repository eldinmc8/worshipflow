// Orden alfabético en español para todo lo que se lista por nombre (pedido de Eldin, 2026-10-30):
// miembros, canciones, grupos. Ignora mayúsculas y tildes ("Ángel" va con la A, no después de la Z
// como pasaba con el orden de la base) y ordena los números de forma natural ("Salmo 2" antes que
// "Salmo 10").
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export function compararTexto(a, b) {
  return collator.compare((a || "").trim(), (b || "").trim());
}

// Copia ordenada de una lista por el texto que devuelve `campo` (no cambia la original).
export function ordenarPor(lista, campo) {
  return [...(lista || [])].sort((x, y) => compararTexto(campo(x), campo(y)));
}
