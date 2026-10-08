import { useEffect, useRef, useState } from "react";

// Arrastrar para reordenar en una CUADRÍCULA (miniaturas de la consola En vivo) — el mismo gesto que
// useArrastreLista del Setlist, pero en dos dimensiones (pedido de Eldin, 2026-10-08: "que se sienta
// natural como en el Setlist"): la miniatura sigue al puntero y las demás de su grupo se recorren con
// una animación corta, pasando de una fila a otra si hace falta, para mostrar dónde va a caer.
//
// Solo se reordena dentro de un grupo (grupoDe(idx) igual; null = no se puede arrastrar). Mientras se
// arrastra, lo que no es del grupo se atenúa para que se note dónde sí se puede soltar.
//
// Gesto igual que en la lista: mouse = presionar y mover más de 4 px; dedo = mantener ~220 ms.
// Botones/enlaces nunca inician el arrastre (el lápiz y el bote de basura siguen funcionando).

const ESPERA_TOQUE_MS = 220;
const TOLERANCIA_TOQUE_PX = 8;
const UMBRAL_MOUSE_PX = 4;
const BORDE_AUTOSCROLL_PX = 70;
const VELOCIDAD_MAX_AUTOSCROLL = 14;
const EXCLUIDO = "button, select, a, input, textarea, [data-no-arrastre]";

// Posición final (dentro del grupo) donde caería: la casilla cuyo centro queda más cerca del centro
// actual de la miniatura arrastrada. Usa las casillas fotografiadas al empezar, así no parpadea.
export function destinoEnGrid(casillas, centroX, centroY) {
  let mejor = 0, distMejor = Infinity;
  casillas.forEach((c, k) => {
    const d = Math.hypot(c.left + c.width / 2 - centroX, c.top + c.height / 2 - centroY);
    if (d < distMejor) { distMejor = d; mejor = k; }
  });
  return mejor;
}

// Cuánto se mueve la miniatura en la posición `p` del grupo para dejar el hueco: a la casilla de al
// lado (la anterior o la siguiente), sea en la misma fila o saltando de fila.
export function desplazamientoGrid(p, desde, destino, casillas) {
  let hacia = p;
  if (desde < destino && p > desde && p <= destino) hacia = p - 1;
  else if (desde > destino && p >= destino && p < desde) hacia = p + 1;
  if (hacia === p) return null;
  return { x: casillas[hacia].left - casillas[p].left, y: casillas[hacia].top - casillas[p].top };
}

function contenedorConScroll(el) {
  let nodo = el?.parentElement;
  while (nodo && nodo !== document.body) {
    const { overflowY } = getComputedStyle(nodo);
    if ((overflowY === "auto" || overflowY === "scroll") && nodo.scrollHeight > nodo.clientHeight) return nodo;
    nodo = nodo.parentElement;
  }
  return null;
}
const scrollDe = (cont) => (cont ? cont.scrollTop : window.scrollY);
const limitesDe = (cont) => {
  if (!cont) return { top: 0, bottom: window.innerHeight };
  const r = cont.getBoundingClientRect();
  return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, window.innerHeight) };
};

export function useArrastreGrid({ habilitado, grupoDe, onReorder }) {
  const [estado, setEstado] = useState(null); // { desde, grupo, destino, dx, dy }
  const [soltando, setSoltando] = useState(false);
  const itemsRef = useRef({});
  const gestoRef = useRef(null);
  const opcionesRef = useRef({ habilitado, grupoDe, onReorder });
  opcionesRef.current = { habilitado, grupoDe, onReorder };

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
    gestoRef.current = null;
  };
  useEffect(() => limpiar, []);

  const actualizar = () => {
    const g = gestoRef.current;
    if (!g?.activo) return;
    const dx = g.ultimoX - g.x0;
    const dy = g.ultimoY + scrollDe(g.contenedor) - g.inicioContenidoY;
    const propia = g.casillas[g.posDesde];
    const destino = destinoEnGrid(g.casillas, propia.left + propia.width / 2 + dx, propia.top + propia.height / 2 + dy);
    g.destino = destino;
    setEstado({ desde: g.desde, grupo: g.grupo, destino, dx, dy });
  };

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
    const clave = opcionesRef.current.grupoDe(g.desde);
    // Los del mismo grupo, en orden (índices de la lista completa).
    const grupo = Object.keys(itemsRef.current).map(Number).filter((i) => itemsRef.current[i] && opcionesRef.current.grupoDe(i) === clave).sort((a, b) => a - b);
    g.activo = true;
    g.contenedor = contenedorConScroll(g.elemento);
    const scroll = scrollDe(g.contenedor);
    g.grupo = grupo;
    g.posDesde = grupo.indexOf(g.desde);
    g.casillas = grupo.map((i) => {
      const r = itemsRef.current[i].getBoundingClientRect();
      return { left: r.left, top: r.top + scroll, width: r.width, height: r.height };
    });
    g.inicioContenidoY = g.y0 + scroll;
    g.destino = g.posDesde;
    g.userSelectPrevio = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.getSelection?.()?.removeAllRanges?.();
    navigator.vibrate?.(12);
    setEstado({ desde: g.desde, grupo, destino: g.posDesde, dx: 0, dy: 0 });
    g.raf = requestAnimationFrame(autoScroll);
  };

  const itemProps = (idx) => ({
    ref: (el) => { if (el) itemsRef.current[idx] = el; else delete itemsRef.current[idx]; },
    onPointerDown: (e) => {
      const { habilitado: hab, grupoDe: grupoDeFn } = opcionesRef.current;
      if (!hab || gestoRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (grupoDeFn(idx) == null) return;
      if (e.target.closest?.(EXCLUIDO)) return;
      const g = { desde: idx, pointerId: e.pointerId, tipo: e.pointerType, elemento: e.currentTarget, x0: e.clientX, y0: e.clientY, ultimoX: e.clientX, ultimoY: e.clientY, activo: false };
      g.alMover = (ev) => {
        if (ev.pointerId !== g.pointerId) return;
        g.ultimoX = ev.clientX; g.ultimoY = ev.clientY;
        if (!g.activo) {
          const dist = Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0);
          if (g.tipo === "mouse") { if (dist > UMBRAL_MOUSE_PX) activar(); else return; }
          else { if (dist > TOLERANCIA_TOQUE_PX) limpiar(); return; }
        }
        actualizar();
      };
      g.alSoltar = (ev) => {
        if (ev.pointerId !== g.pointerId) return;
        if (g.activo) {
          const { grupo, posDesde, destino } = g;
          // El clic que llega justo después de soltar no debe proyectar la miniatura.
          const tragarClick = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
          window.addEventListener("click", tragarClick, { capture: true, once: true });
          setTimeout(() => window.removeEventListener("click", tragarClick, { capture: true }), 350);
          setSoltando(true);
          setEstado(null);
          limpiar();
          if (destino !== posDesde) opcionesRef.current.onReorder(grupo[posDesde], grupo[destino]);
        } else {
          limpiar();
        }
      };
      g.alCancelar = (ev) => {
        if (ev.pointerId !== g.pointerId) return;
        if (g.activo) { setSoltando(true); setEstado(null); }
        limpiar();
      };
      g.bloquearScroll = (te) => { if (g.activo && te.cancelable) te.preventDefault(); };
      gestoRef.current = g;
      window.addEventListener("pointermove", g.alMover);
      window.addEventListener("pointerup", g.alSoltar);
      window.addEventListener("pointercancel", g.alCancelar);
      window.addEventListener("touchmove", g.bloquearScroll, { passive: false });
      if (g.tipo !== "mouse") g.timer = setTimeout(activar, ESPERA_TOQUE_MS);
    },
    onContextMenu: (e) => { if (opcionesRef.current.habilitado && opcionesRef.current.grupoDe(idx) != null) e.preventDefault(); },
    onDragStart: (e) => e.preventDefault(), // nunca el arrastre nativo del navegador (imagen fantasma)
  });

  // Estilo de cada miniatura: la arrastrada sigue al puntero, levantada; las de su grupo se recorren;
  // las de otros grupos se atenúan mientras dura el arrastre.
  const estiloItem = (idx) => {
    const { habilitado: hab, grupoDe: grupoDeFn } = opcionesRef.current;
    const base = hab && grupoDeFn(idx) != null ? { cursor: "grab", WebkitUserSelect: "none", userSelect: "none", touchAction: "manipulation" } : {};
    if (!estado) return { ...base, transition: soltando ? "none" : undefined };
    const p = estado.grupo.indexOf(idx);
    if (idx === estado.desde) {
      return { ...base, cursor: "grabbing", position: "relative", zIndex: 5, transform: `translate(${estado.dx}px, ${estado.dy}px) scale(1.04)`, transition: "box-shadow 0.15s", boxShadow: "0 16px 34px rgba(22,50,79,0.35)" };
    }
    if (p === -1) return { ...base, opacity: 0.35, transition: "opacity 0.15s" };
    const g = gestoRef.current;
    const mover = g ? desplazamientoGrid(p, estado.grupo.indexOf(estado.desde), estado.destino, g.casillas) : null;
    return { ...base, transform: mover ? `translate(${mover.x}px, ${mover.y}px)` : undefined, transition: "transform 0.2s ease" };
  };

  return { itemProps, estiloItem, arrastrando: estado !== null };
}
