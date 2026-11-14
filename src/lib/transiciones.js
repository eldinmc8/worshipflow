// Transiciones entre diapositivas (pedido de Eldin, 2026-11-14: "debemos añadir transiciones para los
// elementos del setlist… una para todo el culto y la opción de asignar diferentes para cada elemento").
//
// - liveStyle.transicion: la de TODO el culto ("ninguna" si no se ha elegido: nada cambia para quien no la usa).
// - liveStyle.transicionVel: "rapida" | "normal" | "lenta".
// - liveStyle.transicionesItems[itemId]: la propia de un elemento del orden del culto, si se le puso una.
// Viajan dentro del estilo en vivo (sesiones_en_vivo.estilo_en_vivo), así que la proyección y la TV las
// aplican solas. Son del culto entero, no del estilo de Canciones ni del de la Biblia (ver estiloBiblia.js).
// Es una animación de ENTRADA de lo nuevo (solo opacidad y movimiento, que hasta las Smart TV viejas
// entienden); los @keyframes viven en index.css, lo único que comparten la consola y la proyección.
import { perteneceA } from "./escenario.js";

export const TRANSICIONES = {
  ninguna: { label: "Ninguna", anim: null },
  fundido: { label: "Fundido", anim: "wfTransFundido" },
  deslizar: { label: "Deslizar", anim: "wfTransDeslizar" },
  zoom: { label: "Zoom", anim: "wfTransZoom" },
};

export const VELOCIDADES_TRANSICION = {
  rapida: { label: "Rápida", seg: 0.3 },
  normal: { label: "Normal", seg: 0.6 },
  lenta: { label: "Lenta", seg: 1.1 },
};

const valida = (clave) => (clave && TRANSICIONES[clave] ? clave : null);

// La transición general del culto.
export function transicionDelCulto(liveStyle) {
  return valida(liveStyle?.transicion) || "ninguna";
}

// La propia de un elemento del orden del culto, o null si usa la del culto.
export function transicionDeItem(liveStyle, itemId) {
  return valida(liveStyle?.transicionesItems?.[itemId]);
}

// La que le toca a una diapositiva: la de su elemento si tiene; si no, la del culto.
export function transicionDeDiapositiva(liveStyle, slide) {
  const propias = liveStyle?.transicionesItems;
  if (slide && propias && typeof propias === "object") {
    for (const itemId of Object.keys(propias)) {
      if (valida(propias[itemId]) && perteneceA(slide, itemId)) return propias[itemId];
    }
  }
  return transicionDelCulto(liveStyle);
}

// El valor CSS de `animation` para esa diapositiva, o null si entra sin transición.
export function animacionDeTransicion(liveStyle, slide) {
  const def = TRANSICIONES[transicionDeDiapositiva(liveStyle, slide)];
  if (!def?.anim) return null;
  const vel = VELOCIDADES_TRANSICION[liveStyle?.transicionVel] || VELOCIDADES_TRANSICION.normal;
  return `${def.anim} ${vel.seg}s ease both`;
}

// Para el panel de Estilo y el orden del culto. clave null o igual a la del culto = quitar la propia.
export function conTransicionDeItem(liveStyle, itemId, clave) {
  const propias = { ...(liveStyle?.transicionesItems || {}) };
  if (valida(clave)) propias[itemId] = clave;
  else delete propias[itemId];
  return { ...liveStyle, transicionesItems: propias };
}
