// Animación por canción (pedido de Eldin, 2026-11-06, etapa 3): lo que se arma en la pestaña "Animación"
// del editor de la canción y se aplica solo en vivo.
//
// conf = {
//   general: clave de estilo | "ninguna" | null (null = lo que elija Multimedia),
//   porParte: { [clave de la parte]: clave | "ninguna" },   (sin valor = igual que la canción)
//   momentos: [{ palabra, efecto }],                         (ver EFECTOS_MOMENTO)
//   compas: true/false,                                      (latir al compás del tempo)
// }
// En un evento, la canción del Setlist puede traer otro estilo (item.animacion = { general }) solo para ese
// evento (ver animacionEfectiva).

export const EFECTOS_MOMENTO = [
  { clave: "gigante", nombre: "Palabra gigante", nivel: "palabra" },
  { clave: "brillo", nombre: "Palabra que brilla", nivel: "palabra" },
  { clave: "destello", nombre: "Destello de pantalla", nivel: "pantalla" },
  { clave: "pantalla:puertas", nombre: "Pantalla partida", nivel: "pantalla" },
  { clave: "pantalla:diagonal", nombre: "Corte en diagonal", nivel: "pantalla" },
  { clave: "pantalla:corte", nombre: "Tajo de luz", nivel: "pantalla" },
  { clave: "pantalla:persianas", nombre: "Persianas", nivel: "pantalla" },
  { clave: "pantalla:barrido", nombre: "Luz que pasa", nivel: "pantalla" },
];
const efectoDe = (k) => EFECTOS_MOMENTO.find((e) => e.clave === k);

export function normalizarAnimCancion(c) {
  if (!c || typeof c !== "object") return null;
  const porParte = c.porParte && typeof c.porParte === "object" ? Object.fromEntries(Object.entries(c.porParte).filter(([, v]) => typeof v === "string" && v)) : {};
  const momentos = Array.isArray(c.momentos) ? c.momentos.filter((m) => m && typeof m.palabra === "string" && m.palabra.trim() && efectoDe(m.efecto)).map((m) => ({ palabra: m.palabra.trim(), efecto: m.efecto })) : [];
  const general = typeof c.general === "string" && c.general ? c.general : null;
  const conf = { general, porParte, momentos, compas: !!c.compas };
  return tieneAlgo(conf) ? conf : null;
}

export function tieneAlgo(conf) {
  return !!conf && (!!conf.general || Object.keys(conf.porParte || {}).length > 0 || (conf.momentos || []).length > 0 || !!conf.compas);
}

// La de la canción; si en el evento se eligió otro estilo (item.animacion.general), ese estilo se usa en
// toda la canción ese día (sin los estilos por parte), y se conservan sus momentos especiales y el latido.
export function animacionEfectiva(song, item) {
  const deCancion = normalizarAnimCancion(song?.animacion);
  const delEvento = item?.animacion && typeof item.animacion.general === "string" && item.animacion.general ? item.animacion.general : null;
  if (!delEvento) return deCancion;
  return { general: delEvento, porParte: {}, momentos: deCancion?.momentos || [], compas: !!deCancion?.compas };
}

// Estilo de una parte: el de esa parte, o el general. null = lo que elija Multimedia.
export function estiloDeParte(conf, claveParte) {
  if (!conf) return null;
  return conf.porParte?.[claveParte] || conf.general || null;
}

const limpiar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ\s]/g, "").trim();

// ¿Esta palabra de la letra es un momento especial? Devuelve los efectos de palabra que le tocan.
export function efectosDePalabra(momentos, palabra) {
  const p = limpiar(palabra);
  if (!p || !momentos?.length) return [];
  return momentos.filter((m) => efectoDe(m.efecto)?.nivel === "palabra" && limpiar(m.palabra) === p).map((m) => m.efecto);
}

// El primer efecto de pantalla cuya palabra (o frase) aparece en esta diapositiva.
export function efectoPantallaDe(momentos, lineas) {
  if (!momentos?.length || !lineas?.length) return null;
  const texto = ` ${limpiar(lineas.join(" ")).replace(/\s+/g, " ")} `;
  const m = momentos.find((x) => efectoDe(x.efecto)?.nivel === "pantalla" && texto.includes(` ${limpiar(x.palabra).replace(/\s+/g, " ")} `));
  return m ? m.efecto : null;
}
