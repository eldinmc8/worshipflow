import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { gruposQueCaben } from "../lib/cintaAdaptable.js";

const ANCHO_BOTON_MAS = 104;

// Cinta de herramientas de la consola que nunca se desliza de lado (pedido de Eldin, 2026-10-21): los
// grupos que no caben en el ancho de la pantalla pasan a un botón "Más opciones" al final, que los
// muestra en un menú flotante. Al agrandar la ventana vuelven solos a la cinta.
//
// grupos: [{ clave, titulo, contenido }] en el orden en que se ven. dibujarGrupo(titulo, contenido,
// ultimo) es el mismo grupoCinta de la consola (divisor y título abajo).
export default function CintaAdaptable({ grupos, dibujarGrupo, tour, estilo }) {
  const filaRef = useRef(null);
  const anchos = useRef(new Map()); // clave -> último ancho medido (se conserva al esconderse)
  const [visibles, setVisibles] = useState(Infinity);
  const [abierto, setAbierto] = useState(false);
  const [, setTick] = useState(0); // vuelve a calcular cuando cambia el ancho de la ventana
  const claves = grupos.map((g) => g.clave).join("|");

  // Después de cada dibujo: medir los grupos a la vista y decidir cuántos caben. Los ocultos conservan
  // su último ancho medido. Es estable: si nada cambió de tamaño, da el mismo número y no redibuja.
  useLayoutEffect(() => {
    const fila = filaRef.current;
    if (!fila) return;
    fila.querySelectorAll("[data-grupo-cinta]").forEach((el) => {
      anchos.current.set(el.getAttribute("data-grupo-cinta"), Math.ceil(el.getBoundingClientRect().width));
    });
    const cs = getComputedStyle(fila);
    const disponible = fila.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 2;
    const n = gruposQueCaben(grupos.map((g) => anchos.current.get(g.clave)), disponible, ANCHO_BOTON_MAS);
    if (n !== visibles) setVisibles(n);
  });
  useEffect(() => {
    const fila = filaRef.current;
    if (!fila || typeof ResizeObserver === "undefined") return;
    let ultimo = fila.clientWidth;
    const ro = new ResizeObserver(() => {
      if (fila.clientWidth !== ultimo) { ultimo = fila.clientWidth; setTick((t) => t + 1); }
    });
    ro.observe(fila);
    return () => ro.disconnect();
  }, []);
  // Si se cambia de pestaña (otros grupos), se cierra el menú.
  useEffect(() => { setAbierto(false); }, [claves]);

  const n = Math.min(visibles, grupos.length);
  const aLaVista = grupos.slice(0, n);
  const ocultos = grupos.slice(n);
  const hayMas = ocultos.length > 0;

  // En el menú: al tocar un botón se cierra (casi siempre abre otra cosa o ya hizo lo suyo); las listas
  // desplegables, casillas y deslizadores lo dejan abierto.
  const alTocarMenu = (e) => {
    const b = e.target.closest("button");
    if (b && !b.closest("[data-mantener-menu]")) setAbierto(false);
  };

  return (
    <div style={{ position: "relative", flexShrink: 0, zIndex: abierto ? 38 : "auto" }}>
      <div ref={filaRef} data-tour={tour} style={{ display: "flex", alignItems: "stretch", gap: 0, overflow: "hidden", ...estilo }}>
        {aLaVista.map((g, i) => (
          <div key={g.clave} data-grupo-cinta={g.clave} style={{ display: "flex", flexShrink: 0 }}>
            {dibujarGrupo(g.titulo, g.contenido, i === aLaVista.length - 1 && !hayMas)}
          </div>
        ))}
        {hayMas && (
          <>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", flexShrink: 0, borderLeft: "1px solid var(--wf-divider)", paddingLeft: 8 }}>
              <button
                type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} aria-haspopup="true"
                title={`Más opciones: ${ocultos.map((g) => g.titulo).filter(Boolean).join(", ")}`}
                className={abierto ? undefined : "hoverable"}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minWidth: 84, minHeight: 50, padding: "4px 8px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, lineHeight: 1.15, whiteSpace: "nowrap",
                  background: abierto ? "var(--wf-brand-primary)" : "transparent", color: abierto ? "var(--wf-on-brand-primary)" : "var(--wf-text)" }}
              >
                <MoreHorizontal size={20} strokeWidth={1.75} />
                Más opciones
                <span style={{ fontSize: 9.5, opacity: 0.75 }}>{ocultos.length} {ocultos.length === 1 ? "grupo" : "grupos"}</span>
              </button>
            </div>
          </>
        )}
      </div>
      {hayMas && abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: "fixed", inset: 0, zIndex: 0 }} />
          <div role="menu" aria-label="Más opciones" onClick={alTocarMenu}
            style={{ position: "absolute", top: "calc(100% + 6px)", right: 12, zIndex: 1, width: "min(560px, calc(100vw - 24px))", maxHeight: "min(480px, 65vh)", overflowY: "auto", padding: "10px 12px 12px", background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 12px 36px rgba(22,50,79,0.25)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-heading)" }}>Más opciones</span>
              <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" title="Cerrar" style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "var(--wf-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            {ocultos.map((g) => (
              <div key={g.clave} style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 8, borderTop: "1px solid var(--wf-divider)" }}>
                {g.titulo && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4 }}>{g.titulo.toUpperCase()}</span>}
                <div data-mantener-menu={g.mantenerAbierto ? "" : undefined} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>{g.contenido}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
