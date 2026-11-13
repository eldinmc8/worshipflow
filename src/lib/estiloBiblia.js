// Estilo propio para la Biblia (pedido de Eldin, 2026-11-09): "el efecto de las canciones y letras
// interactivas deberían ser solo para las canciones; la Biblia debería tener su propio fondo y no
// mezclarse".
//
// Antes había UN solo estilo en vivo (fondo, tipografía, letra animada…) para todo. Ahora:
// - El estilo de siempre (liveStyle) es el de las CANCIONES (y diapositivas, cuentas, etc.).
// - liveStyle.biblia guarda el estilo de los VERSÍCULOS: mismo formato, elegido con el mismo panel de
//   Estilo. Nunca lleva letra animada ni fondo por canción.
// - Mientras no se haya elegido nada para la Biblia, usa el de las canciones SIN la animación (así nada
//   cambia de golpe para quien ya tenía su estilo armado, salvo que la letra animada ya no le cae encima
//   a los versículos).
// Viaja dentro del mismo estilo en vivo (sesiones_en_vivo.estilo_en_vivo), así que la proyección lo
// aplica sola: ProjectionPanel elige uno u otro según la diapositiva (estiloParaDiapositiva).

// Lo que es solo de canciones: la letra animada (y su fondo) y el fondo por canción.
const SOLO_CANCIONES = new Set(["fondoPorCancion", "fondosCanciones"]);
const esSoloCanciones = (clave) => SOLO_CANCIONES.has(clave) || /^anim/.test(clave);

export function sinEfectosDeCanciones(estilo) {
  const limpio = {};
  for (const [k, v] of Object.entries(estilo || {})) {
    if (k !== "biblia" && !esSoloCanciones(k)) limpio[k] = v;
  }
  return limpio;
}

// El estilo con el que se ven los versículos.
export function estiloDeBiblia(liveStyle) {
  const propio = liveStyle?.biblia && typeof liveStyle.biblia === "object" ? liveStyle.biblia : null;
  return sinEfectosDeCanciones(propio || liveStyle);
}

// El que le toca a una diapositiva: versículo → el de la Biblia; todo lo demás → el de las canciones
// (sin la sub-parte de la Biblia, que no le hace falta).
export function estiloParaDiapositiva(liveStyle, slide) {
  if (!liveStyle) return liveStyle;
  if (slide?.type === "biblia") return estiloDeBiblia(liveStyle);
  if (!("biblia" in liveStyle)) return liveStyle;
  const { biblia: _biblia, ...canciones } = liveStyle;
  return canciones;
}

// Para el panel de Estilo: el mismo setLiveStyle de siempre, pero que escribe en el estilo de la Biblia.
// Acepta un objeto o una función (estiloBiblia) => estiloBiblia, igual que setState.
export function setterDeBiblia(setLiveStyle) {
  return (cambio) => setLiveStyle((st) => {
    const actual = estiloDeBiblia(st);
    const nuevo = typeof cambio === "function" ? cambio(actual) : cambio;
    return { ...st, biblia: sinEfectosDeCanciones(nuevo) };
  });
}

// Para el panel de Estilo en modo Canciones (pedido de Eldin, 2026-11-12: "quiero que sus fondos sean
// independientes, pero al parecer siguen ligados"). Mientras la Biblia no tenía nada propio seguía al
// estilo de las canciones, así que cambiar el fondo de las canciones le cambiaba el fondo también a los
// versículos. Ahora, la primera vez que un cambio de las canciones le tocaría a la Biblia, la Biblia se
// queda con lo que tenía hasta ese momento como estilo propio: nada cambia de golpe y desde ahí cada uno
// va por su lado.
export function setterDeCanciones(setLiveStyle) {
  return (cambio) => setLiveStyle((st) => {
    const nuevo = typeof cambio === "function" ? cambio(st) : cambio;
    if (!st || !nuevo || typeof nuevo !== "object") return nuevo;
    if (nuevo.biblia && typeof nuevo.biblia === "object") return nuevo;
    const antes = estiloDeBiblia(st);
    if (JSON.stringify(antes) === JSON.stringify(estiloDeBiblia(nuevo))) return nuevo;
    return { ...nuevo, biblia: antes };
  });
}
