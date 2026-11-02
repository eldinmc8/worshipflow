// ¿Este bloque del Setlist es de Predicación? Mismo criterio (por título) que wf_es_titulo_predicacion en
// la base. Aparte (sin Supabase) para que lo usen tanto el bosquejo como la pantalla de escenario.
export const REGEX_PREDICACION = /pr[eé]dic|serm[oó]n|mensaje/i;
export function esBloquePredicacion(item) {
  return !!item && item.type === "seccion" && REGEX_PREDICACION.test(item.title || "");
}
