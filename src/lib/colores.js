// Fase 5 (identidad por iglesia): decide si el texto/ícono encima de un color debe ser claro u
// oscuro para seguir siendo legible — en vez de asumir a la fuerza "el primario siempre es oscuro,
// el acento siempre es claro" (lo que rompía, por ejemplo, con una iglesia que elige blanco de
// primario y negro de acento: el texto blanco fijo de siempre quedaba invisible sobre su propia
// barra, ahora blanca). Usado por AuthGate.jsx, que fija --wf-on-brand-primary/accent en tiempo de
// ejecución.
//
// Luminancia relativa + razón de contraste de WCAG (no una fórmula de "brillo percibido" simple) —
// se probó contra los dos colores de marca de siempre de Jesús El Buen Pastor antes de usarla: una
// fórmula más simple (brillo percibido con un umbral fijo) clasificaba MAL el naranja #E8821E
// (decía que necesitaba texto blanco cuando el diseño real siempre usó navy, que se ve mejor) — con
// esta fórmula los dos colores de marca dan exactamente el mismo resultado que ya tenían.
export function colorLegibleSobre(hex) {
  const limpio = (hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return "#FFFFFF"; // hex inválido: cae al default de siempre
  const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = canal(parseInt(limpio.slice(0, 2), 16)), g = canal(parseInt(limpio.slice(2, 4), 16)), b = canal(parseInt(limpio.slice(4, 6), 16));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const contrasteConBlanco = 1.05 / (L + 0.05);
  const contrasteConNegro = (L + 0.05) / 0.05;
  return contrasteConNegro >= contrasteConBlanco ? "#16233A" : "#FFFFFF"; // mismo oscuro que var(--wf-text) en claro / blanco de siempre
}
