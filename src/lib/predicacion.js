// ¿Este bloque del Setlist es de Predicación? Mismo criterio que wf_es_bloque_predicacion en la base.
// Aparte (sin Supabase) para que lo usen tanto el bosquejo como la pantalla de escenario.
// - Si quien arma el Setlist lo marcó a mano ("Este bloque es la predicación", 2026-11-04), manda eso
//   (esPredicacion true/false), así funciona aunque la iglesia lo llame "La Palabra" o "Enseñanza".
// - Si no, se reconoce por el nombre del bloque.
export const REGEX_PREDICACION = /pr[eé]dic|serm[oó]n|mensaje/i;
export function esBloquePredicacion(item) {
  if (!item || item.type !== "seccion") return false;
  if (typeof item.esPredicacion === "boolean") return item.esPredicacion;
  return REGEX_PREDICACION.test(item.title || "");
}
