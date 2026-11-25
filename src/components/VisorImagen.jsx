// Visor a pantalla completa para las fotos de partituras de una canción (2026-11-25). La app no deja
// hacer zoom a toda la página (viewport user-scalable=no), así que aquí el zoom es propio: dos dedos
// para agrandar y mover, doble toque para agrandar/volver, rueda del ratón en la computadora.
// Si hay varias fotos, flechas para pasar de una a otra. Atrás del teléfono lo cierra.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useCerrarConAtras } from "../lib/atras.js";

const MIN = 1;
const MAX = 6;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

export default function VisorImagen({ imagenes, inicial = 0, onClose }) {
  useCerrarConAtras(true, onClose);
  const [indice, setIndice] = useState(inicial);
  const [vista, setVista] = useState({ escala: 1, x: 0, y: 0 });
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const punteros = useRef(new Map());
  const gesto = useRef(null);
  const ultimoToque = useRef(0);
  const actual = imagenes[indice];
  const hayVarias = imagenes.length > 1;

  useEffect(() => { setVista({ escala: 1, x: 0, y: 0 }); }, [indice]);
  useEffect(() => {
    const tecla = (e) => {
      if (e.key === "ArrowRight") setIndice((i) => Math.min(imagenes.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [imagenes.length]);

  const iniciarGesto = () => {
    const ps = [...punteros.current.values()];
    const v = vistaRef.current;
    if (ps.length >= 2) {
      const [a, b] = ps;
      gesto.current = { tipo: "pinza", dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ...v };
    } else if (ps.length === 1) {
      gesto.current = { tipo: "mover", px: ps[0].x, py: ps[0].y, ...v };
    } else {
      gesto.current = null;
    }
  };
  const abajo = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.current.size === 1) {
      const ahora = Date.now();
      if (ahora - ultimoToque.current < 300) {
        setVista((v) => (v.escala > 1 ? { escala: 1, x: 0, y: 0 } : { escala: 2.5, x: 0, y: 0 }));
        ultimoToque.current = 0;
        gesto.current = null;
        return;
      }
      ultimoToque.current = ahora;
    }
    iniciarGesto();
  };
  const mover = (e) => {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    const ps = [...punteros.current.values()];
    if (g.tipo === "pinza" && ps.length >= 2) {
      const [a, b] = ps;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const escala = limitar(g.escala * (dist / g.dist), MIN, MAX);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      setVista({ escala, x: g.x + (cx - g.cx), y: g.y + (cy - g.cy) });
    } else if (g.tipo === "mover" && ps.length === 1 && g.escala > 1) {
      setVista({ escala: g.escala, x: g.x + (ps[0].x - g.px), y: g.y + (ps[0].y - g.py) });
    }
  };
  const arriba = (e) => {
    const g = gesto.current;
    const p = punteros.current.get(e.pointerId);
    punteros.current.delete(e.pointerId);
    // Deslizar a un lado sin zoom = pasar a la otra foto.
    if (g?.tipo === "mover" && g.escala === 1 && p && hayVarias) {
      const dx = p.x - g.px;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(p.y - g.py)) {
        setIndice((i) => limitar(i + (dx < 0 ? 1 : -1), 0, imagenes.length - 1));
      }
    }
    if (vistaRef.current.escala <= 1.02) setVista({ escala: 1, x: 0, y: 0 });
    iniciarGesto();
  };
  const rueda = (e) => {
    const escala = limitar(vistaRef.current.escala * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN, MAX);
    setVista((v) => (escala <= 1.02 ? { escala: 1, x: 0, y: 0 } : { ...v, escala }));
  };

  const boton = { width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
  return createPortal(
    <div role="dialog" aria-label={actual?.titulo || "Imagen"} style={{ position: "fixed", inset: 0, zIndex: 400, background: "#0B1220", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "max(10px, env(safe-area-inset-top)) 12px 10px", color: "#fff" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{actual?.titulo}</div>
          <div style={{ fontSize: 11, opacity: 0.65 }}>{hayVarias ? `${indice + 1} de ${imagenes.length} · ` : ""}Dos dedos o doble toque para agrandar</div>
        </div>
        <button onClick={() => window.open(actual?.url, "_blank", "noopener")} title="Abrir aparte" style={boton}><ExternalLink size={18} /></button>
        <button onClick={onClose} title="Cerrar" style={boton}><X size={22} /></button>
      </div>
      <div
        onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={arriba} onWheel={rueda}
        style={{ flex: 1, overflow: "hidden", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", userSelect: "none" }}
      >
        {actual && (
          <img
            src={actual.url} alt={actual.titulo || ""} draggable={false}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`, transition: gesto.current ? "none" : "transform 0.15s ease", pointerEvents: "none", background: "#fff" }}
          />
        )}
        {hayVarias && indice > 0 && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setIndice(indice - 1)} title="Anterior" style={{ ...boton, position: "absolute", left: 10 }}><ChevronLeft size={24} /></button>
        )}
        {hayVarias && indice < imagenes.length - 1 && (
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setIndice(indice + 1)} title="Siguiente" style={{ ...boton, position: "absolute", right: 10 }}><ChevronRight size={24} /></button>
        )}
      </div>
    </div>,
    document.body,
  );
}
