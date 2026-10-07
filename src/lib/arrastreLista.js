import { useEffect, useRef, useState } from "react";

// Arrastrar para reordenar una lista vertical, estilo OnStage: se agarra desde CUALQUIER parte de la
// fila (no solo del ícono de 6 puntos), la fila sigue al dedo y las demás se apartan con una
// animación corta para mostrar dónde va a caer — en vez de marcar con un borde "la fila de destino",
// que con el cálculo anterior (posiciones medidas en vivo, incluida la propia fila que se movía)
// saltaba entre la de arriba y la de abajo.
//
// Cómo se inicia:
// - Dedo / lápiz: mantener presionado ~220 ms sin moverse. Si el dedo se mueve antes, es un scroll
//   normal de la lista y no se arrastra nada. Un toque corto sigue siendo un toque (abrir la canción,
//   escribir en un campo, desplegar la planificación...).
// - Mouse: presionar y mover más de 4 px. Desde un campo de texto no arrastra con mouse (ahí el
//   arrastre del mouse es para seleccionar texto); con el dedo sí, con la pulsación larga.
// - Botones, selects y enlaces nunca inician el arrastre, para no robarles el toque.

const ESPERA_TOQUE_MS = 220;
const TOLERANCIA_TOQUE_PX = 8;
const UMBRAL_MOUSE_PX = 4;
const BORDE_AUTOSCROLL_PX = 70;
const VELOCIDAD_MAX_AUTOSCROLL = 14;
const SIEMPRE_EXCLUIDO = "button, select, a, [data-no-arrastre]";
const CAMPOS_TEXTO = "input, textarea";

// Índice FINAL donde quedaría la fila arrastrada: cuántas de las otras filas tienen su centro por
// encima del centro actual de la arrastrada. Usa las posiciones fotografiadas al empezar (no las de
// ahora, que ya están desplazadas por la animación), así el resultado no parpadea.
export function indiceDestino(filas, desde, centroY) {
  let destino = 0;
  filas.forEach((f, i) => {
    if (i !== desde && f && f.top + f.height / 2 < centroY) destino++;
  });
  return destino;
}

// Cuánto se aparta cada fila (que no es la arrastrada) para dejar el hueco en el destino.
export function desplazamientoFila(idx, desde, destino, salto) {
  if (desde === null || desde === undefined || idx === desde) return 0;
  if (desde < destino && idx > desde && idx <= destino) return -salto;
  if (desde > destino && idx >= destino && idx < desde) return salto;
  return 0;
}

function contenedorConScroll(el) {
  let nodo = el?.parentElement;
  while (nodo && nodo !== document.body) {
    const { overflowY } = getComputedStyle(nodo);
    if ((overflowY === "auto" || overflowY === "scroll") && nodo.scrollHeight > nodo.clientHeight) return nodo;
    nodo = nodo.parentElement;
  }
  return null; // la página completa
}

const scrollDe = (cont) => (cont ? cont.scrollTop : window.scrollY);
const limitesDe = (cont) => {
  if (!cont) return { top: 0, bottom: window.innerHeight };
  const r = cont.getBoundingClientRect();
  return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, window.innerHeight) };
};

export function useArrastreLista({ habilitado, puedeArrastrar, onReorder }) {
  const [estado, setEstado] = useState(null); // { desde, destino, dy }
  const [soltando, setSoltando] = useState(false);
  const filasRef = useRef({});
  const gestoRef = useRef(null);
  const opcionesRef = useRef({ habilitado, puedeArrastrar, onReorder });
  opcionesRef.current = { habilitado, puedeArrastrar, onReorder };

  // Tras soltar, el orden nuevo y el fin de los desplazamientos llegan en el mismo render: sin
  // transición en ese cuadro, si no las filas "volarían" desde su posición vieja.
  useEffect(() => {
    if (!soltando) return;
    const id = requestAnimationFrame(() => setSoltando(false));
    return () => cancelAnimationFrame(id);
  }, [soltando]);

  const limpiar = () => {
    const g = gestoRef.current;
    if (!g) return;
    clearTimeout(g.timer);
    cancelAnimationFrame(g.raf);
    window.removeEventListener("pointermove", g.alMover);
    window.removeEventListener("pointerup", g.alSoltar);
    window.removeEventListener("pointercancel", g.alCancelar);
    window.removeEventListener("touchmove", g.bloquearScroll);
    document.body.style.userSelect = g.userSelectPrevio ?? "";
    document.body.style.webkitUserSelect = g.userSelectPrevio ?? "";
    gestoRef.current = null;
  };

  useEffect(() => limpiar, []);

  const actualizar = () => {
    const g = gestoRef.current;
    if (!g?.activo) return;
    const dy = g.ultimoY + scrollDe(g.contenedor) - g.inicioContenidoY;
    const fila = g.filas[g.desde];
    const destino = indiceDestino(g.filas, g.desde, fila.top + fila.height / 2 + dy);
    g.destino = destino;
    setEstado({ desde: g.desde, destino, dy });
  };

  // Desplaza la lista sola cuando el dedo está cerca del borde de arriba/abajo, para poder llevar un
  // elemento más allá de lo que se ve en pantalla.
  const autoScroll = () => {
    const g = gestoRef.current;
    if (!g?.activo) return;
    const { top, bottom } = limitesDe(g.contenedor);
    let paso = 0;
    if (g.ultimoY < top + BORDE_AUTOSCROLL_PX) paso = -VELOCIDAD_MAX_AUTOSCROLL * (1 - Math.max(g.ultimoY - top, 0) / BORDE_AUTOSCROLL_PX);
    else if (g.ultimoY > bottom - BORDE_AUTOSCROLL_PX) paso = VELOCIDAD_MAX_AUTOSCROLL * (1 - Math.max(bottom - g.ultimoY, 0) / BORDE_AUTOSCROLL_PX);
    if (paso) {
      if (g.contenedor) g.contenedor.scrollTop += paso;
      else window.scrollBy(0, paso);
      actualizar();
    }
    g.raf = requestAnimationFrame(autoScroll);
  };

  const activar = () => {
    const g = gestoRef.current;
    if (!g || g.activo) return;
    g.activo = true;
    g.contenedor = contenedorConScroll(g.elemento);
    const scroll = scrollDe(g.contenedor);
    // Foto de las posiciones al empezar, en coordenadas del contenido (sumando el scroll), para que
    // el auto-scroll no las invalide.
    const filas = [];
    Object.entries(filasRef.current).forEach(([i, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      filas[Number(i)] = { top: r.top + scroll, height: r.height };
    });
    g.filas = filas;
    const propia = filas[g.desde];
    const siguiente = filas.slice(g.desde + 1).find(Boolean);
    const anterior = filas.slice(0, g.desde).reverse().find(Boolean);
    g.salto = siguiente ? siguiente.top - propia.top : anterior ? propia.top + propia.height - (anterior.top + anterior.height) : propia.height;
    // Desde donde se PRESIONÓ (no desde donde iba el puntero al activarse): con mouse el arrastre se
    // activa ya movido unos píxeles, y ese tramo inicial también cuenta.
    g.inicioContenidoY = g.y0 + scroll;
    g.destino = g.desde;
    g.userSelectPrevio = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    if (document.activeElement && g.elemento.contains(document.activeElement)) document.activeElement.blur();
    window.getSelection?.()?.removeAllRanges?.();
    navigator.vibrate?.(12);
    setEstado({ desde: g.desde, destino: g.desde, dy: 0 });
    g.raf = requestAnimationFrame(autoScroll);
  };

  const filaProps = (idx) => ({
    ref: (el) => { filasRef.current[idx] = el; },
    onPointerDown: (e) => {
      const { habilitado: hab, puedeArrastrar: puede } = opcionesRef.current;
      if (!hab || gestoRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (puede && !puede(idx)) return;
      if (e.target.closest?.(SIEMPRE_EXCLUIDO)) return;
      if (e.pointerType === "mouse" && e.target.closest?.(CAMPOS_TEXTO)) return;
      const g = {
        desde: idx, pointerId: e.pointerId, tipo: e.pointerType, elemento: e.currentTarget,
        x0: e.clientX, y0: e.clientY, ultimoY: e.clientY, activo: false,
      };
      g.alMover = (ev) => {
        if (ev.pointerId !== g.pointerId) return;
        g.ultimoY = ev.clientY;
        if (!g.activo) {
          const dist = Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0);
          if (g.tipo === "mouse") { if (dist > UMBRAL_MOUSE_PX) activar(); else return; }
          else { if (dist > TOLERANCIA_TOQUE_PX) limpiar(); return; } // se movió antes de tiempo: era scroll
        }
        actualizar();
      };
      g.alSoltar = (ev) => {
        if (ev.pointerId !== g.pointerId) return;
        if (g.activo) {
          const { desde, destino } = g;
          // El click que llega justo después de soltar no debe abrir la canción ni desplegar nada.
          const tragarClick = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
          window.addEventListener("click", tragarClick, { capture: true, once: true });
          setTimeout(() => window.removeEventListener("click", tragarClick, { capture: true }), 350);
          setSoltando(true);
          setEstado(null);
          limpiar();
          if (destino !== desde) opcionesRef.current.onReorder(desde, destino);
        } else {
          limpiar();
        }
      };
      g.alCancelar = (ev) => {
        if (ev.pointerId !== g.pointerId) return;
        if (g.activo) { setSoltando(true); setEstado(null); }
        limpiar();
      };
      // Con el dedo, una vez agarrado el elemento, el movimiento ya no debe desplazar la página.
      g.bloquearScroll = (te) => { if (g.activo && te.cancelable) te.preventDefault(); };
      gestoRef.current = g;
      window.addEventListener("pointermove", g.alMover);
      window.addEventListener("pointerup", g.alSoltar);
      window.addEventListener("pointercancel", g.alCancelar);
      window.addEventListener("touchmove", g.bloquearScroll, { passive: false });
      if (g.tipo !== "mouse") g.timer = setTimeout(activar, ESPERA_TOQUE_MS);
    },
    // Evita el menú de "copiar/compartir" del celular al mantener presionado.
    onContextMenu: (e) => { if (opcionesRef.current.habilitado) e.preventDefault(); },
  });

  // Estilo de cada fila: la arrastrada sigue al dedo, levantada; las demás se apartan.
  const estiloFila = (idx) => {
    const { habilitado: hab, puedeArrastrar: puede } = opcionesRef.current;
    const arrastrable = hab && (!puede || puede(idx));
    const base = arrastrable ? { cursor: "grab", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" } : {};
    if (!estado) return { ...base, transition: soltando ? "none" : undefined };
    if (idx === estado.desde) {
      return {
        ...base, cursor: "grabbing", position: "relative", zIndex: 5,
        transform: `translateY(${estado.dy}px) scale(1.02)`, transition: "box-shadow 0.15s",
        boxShadow: "0 14px 30px rgba(22,50,79,0.32)",
      };
    }
    const g = gestoRef.current;
    const mover = desplazamientoFila(idx, estado.desde, estado.destino, g?.salto ?? 0);
    return { ...base, transform: mover ? `translateY(${mover}px)` : undefined, transition: "transform 0.18s ease" };
  };

  return { filaProps, estiloFila, arrastrando: estado !== null, indiceArrastrado: estado?.desde ?? null };
}
