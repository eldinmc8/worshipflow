// Supabase (PostgREST) devuelve como MÁXIMO 1000 filas por consulta, sin avisar: el resto simplemente
// no llega. Las cargas completas (todas las diapositivas de todas las canciones, todos los encargados
// de todos los eventos...) pasaban ese límite a medida que crecía el contenido de la iglesia, y lo que
// sobraba desaparecía en silencio — canciones con solo algunas diapositivas, y una diapositiva recién
// agregada en vivo que se "esfumaba" a los 2-3 segundos, cuando la recarga en tiempo real traía la
// lista cortada (reportado por Eldin, 2026-10-08).
//
// Esto pide la misma consulta por páginas hasta traerlas todas. `construir` arma la consulta de cero en
// cada página (un query builder de supabase-js no se puede reusar). La consulta debe tener un orden
// total siempre que se pueda (terminar en .order("id")) — si dos filas empatan, la base puede devolverlas en
// distinto orden entre página y página y repetir unas y saltarse otras.
export const TAMANO_PAGINA = 1000;

export async function traerTodas(construir) {
  const filas = [];
  for (;;) {
    const { data, error } = await construir().range(filas.length, filas.length + TAMANO_PAGINA - 1);
    if (error) return { data: null, error };
    const pagina = data || [];
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) return { data: filas, error: null };
  }
}
