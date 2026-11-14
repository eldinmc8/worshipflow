// Fondo propio de una diapositiva de texto (pedido de Eldin, 2026-11-14: "al agregar un texto rápido
// queda con el fondo de las canciones y no se puede cambiar rápido").
//
// Una diapositiva de texto con bgType "color" SIEMPRE ha usado el fondo que esté puesto en Estilo (el
// de las canciones): su campo `bg` nunca se proyectó. Para darle un color liso propio sin tocar la
// base (fondo_tipo solo acepta color/imagen/video) se marca en `bg`, que es texto libre — igual que
// las presentaciones importadas (bg = "presentacion"): "fijo:#0B0F17". Sin la marca, todo sigue como
// antes: el fondo de Estilo.
const MARCA = "fijo:";
const HEX = /^#[0-9a-f]{6}$/i;

// El color liso propio de la diapositiva ("#RRGGBB"), o null si usa el fondo de Estilo.
export function colorPropioDe(slide) {
  if (!slide || (slide.bgType || "color") !== "color") return null;
  const bg = String(slide.bg || "");
  if (!bg.startsWith(MARCA)) return null;
  const color = bg.slice(MARCA.length);
  return HEX.test(color) ? color : null;
}

export const fondoFijo = (color) => `${MARCA}${color}`;

// Qué muestra el selector de fondo: "estilo" | "liso" | "imagen" | "video".
export function tipoDeFondo(draft) {
  const t = draft?.bgType || "color";
  if (t === "imagen" || t === "video") return t;
  return colorPropioDe(draft) ? "liso" : "estilo";
}

// Lo que se recuerda del último texto rápido para que el siguiente empiece con el mismo fondo.
export function fondoParaRecordar(draft) {
  const tipo = tipoDeFondo(draft);
  if (tipo === "liso") return { bgType: "color", bg: draft.bg };
  if (tipo === "imagen" && draft.imageUrl) return { bgType: "imagen", imageUrl: draft.imageUrl };
  return { bgType: "color", bg: "#1B2029" }; // el de Estilo (un video no se recuerda: casi nunca se repite)
}

// Colores lisos sugeridos: oscuros, para que la letra clara se lea.
export const COLORES_LISOS = ["#000000", "#0B0F17", "#16324F", "#1F2A2C", "#2A1F33", "#332420", "#5A1E1A"];
