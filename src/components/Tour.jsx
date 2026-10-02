import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Recorrido guiado: oscurece la app, deja "iluminado" el elemento real del paso (buscado por su
// atributo data-tour) y muestra una tarjeta con la explicación al lado. Los pasos vienen de
// lib/tutoriales.js. Un paso cuyo elemento no está en pantalla se salta solo, así un mismo recorrido
// sirve para admin y miembro, celular y computadora, iglesia nueva vacía o con datos.
//
// Mientras está abierto bloquea los toques sobre la app (para que nadie navegue a otra pantalla a
// mitad del recorrido y deje el globo apuntando a la nada); se sale con Saltar, Esc o terminando.

const GUTTER = 16;
const PAD = 6; // aire alrededor del elemento iluminado

function buscarTarget(id) {
  if (!id) return null;
  const candidatos = document.querySelectorAll(`[data-tour="${id}"]`);
  for (const el of candidatos) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function mismoRect(a, b) {
  if (!a || !b) return a === b;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

export default function Tour({ pasos, onTerminar }) {
  // Se decide UNA vez al abrir qué pasos aplican, para que el contador "2 de 5" no cambie a mitad.
  const [visibles] = useState(() => pasos.filter((p) => !p.target || buscarTarget(p.target)));
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef(null);
  const [cardH, setCardH] = useState(180);
  const terminadoRef = useRef(false);

  const terminar = () => {
    if (terminadoRef.current) return;
    terminadoRef.current = true;
    onTerminar();
  };

  useEffect(() => {
    if (visibles.length === 0) terminar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paso = visibles[idx];
  const esUltimo = idx === visibles.length - 1;

  // Al cambiar de paso: si el elemento no se ve completo, se desplaza la pantalla hasta él.
  useEffect(() => {
    const el = buscarTarget(paso?.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fuera = r.top < 0 || r.bottom > window.innerHeight || r.left < 0 || r.right > window.innerWidth;
    if (fuera) el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [paso]);

  // Sigue al elemento cuadro a cuadro: así acompaña el desplazamiento suave, animaciones de entrada
  // de pantalla y cambios de tamaño sin necesidad de escuchar cada cosa por separado.
  useEffect(() => {
    let frame;
    let ultimo = null;
    const medir = () => {
      const el = buscarTarget(paso?.target);
      const r = el ? el.getBoundingClientRect() : null;
      const nuevo = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      if (!mismoRect(nuevo, ultimo)) { ultimo = nuevo; setRect(nuevo); }
      frame = requestAnimationFrame(medir);
    };
    medir();
    return () => cancelAnimationFrame(frame);
  }, [paso]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.getBoundingClientRect().height);
  }, [idx, viewport.w]);

  const siguiente = () => (esUltimo ? terminar() : setIdx((i) => i + 1));
  const anterior = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") terminar();
      else if (e.key === "ArrowRight") siguiente();
      else if (e.key === "ArrowLeft") anterior();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!paso) return null;

  const cardW = Math.min(340, viewport.w - GUTTER * 2);
  const conTarget = !!(paso.target && rect);
  let cardTop;
  let cardLeft;
  if (conTarget) {
    const abajo = viewport.h - (rect.top + rect.height + PAD);
    const arriba = rect.top - PAD;
    if (abajo >= cardH + 24) cardTop = rect.top + rect.height + PAD + 12;
    else if (arriba >= cardH + 24) cardTop = rect.top - PAD - 12 - cardH;
    else cardTop = Math.max(GUTTER, viewport.h - cardH - GUTTER);
    const centro = rect.left + rect.width / 2;
    cardLeft = Math.min(Math.max(centro - cardW / 2, GUTTER), viewport.w - GUTTER - cardW);
  } else {
    cardTop = Math.max(GUTTER, (viewport.h - cardH) / 2);
    cardLeft = (viewport.w - cardW) / 2;
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={paso.titulo} style={{ position: "fixed", inset: 0, zIndex: 9000, fontFamily: "'Poppins', sans-serif" }}>
      <style>{`
        @keyframes wfTourIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes wfTourPulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--wf-brand-accent) 70%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--wf-brand-accent) 0%, transparent); } }
        .wf-tour-card { animation: wfTourIn .22s ease-out; }
        .wf-tour-spot { transition: top .3s ease, left .3s ease, width .3s ease, height .3s ease; }
        .wf-tour-ring { animation: wfTourPulse 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .wf-tour-card, .wf-tour-ring { animation: none; } .wf-tour-spot { transition: none; } }
      `}</style>

      {/* Capa que bloquea los toques sobre la app. Con un elemento iluminado, el oscurecido lo pone
          la sombra gigante del recuadro; sin elemento (tarjeta centrada) lo pone esta misma capa. */}
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", inset: 0, background: conTarget ? "transparent" : "rgba(10,18,30,0.62)" }} />

      {conTarget && (
        <div
          className="wf-tour-spot"
          style={{
            position: "absolute", pointerEvents: "none",
            top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2,
            borderRadius: 16, boxShadow: "0 0 0 9999px rgba(10,18,30,0.62)",
          }}
        >
          <div className="wf-tour-ring" style={{ position: "absolute", inset: 0, borderRadius: 16, border: "2px solid var(--wf-brand-accent)" }} />
        </div>
      )}

      <div
        key={idx}
        ref={cardRef}
        className="wf-tour-card"
        aria-live="polite"
        style={{
          position: "absolute", top: cardTop, left: cardLeft, width: cardW, boxSizing: "border-box",
          background: "var(--wf-card)", color: "var(--wf-text)", borderRadius: 18, padding: "16px 18px 14px",
          boxShadow: "0 18px 44px rgba(10,18,30,0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-active-text)", background: "var(--wf-active-bg)", borderRadius: 12, padding: "2px 9px" }}>
            {idx + 1} de {visibles.length}
          </span>
          {!esUltimo && (
            <button onClick={terminar} style={{ background: "none", border: "none", padding: "4px 2px", fontSize: 12, fontWeight: 600, color: "var(--wf-faint)", cursor: "pointer" }}>
              Saltar
            </button>
          )}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, lineHeight: 1.3 }}>{paso.titulo}</div>
        {paso.lista && (
          <ol style={{ listStyle: "none", padding: 0, margin: "4px 0 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            {paso.lista.map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--wf-text-2)", lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        )}
        {paso.texto && <div style={{ fontSize: 13, color: "var(--wf-text-2)", lineHeight: 1.5 }}>{paso.texto}</div>}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 10 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minWidth: 0 }}>
            {visibles.map((_, i) => (
              <span key={i} style={{ width: i === idx ? 14 : 6, height: 6, borderRadius: 3, background: i === idx ? "var(--wf-brand-accent)" : "var(--wf-border)", transition: "width .2s" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {idx > 0 && (
              <button onClick={anterior} style={{ background: "var(--wf-hover)", border: "none", borderRadius: 12, padding: "9px 12px", fontSize: 13, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" }}>
                Atrás
              </button>
            )}
            <button autoFocus onClick={siguiente} style={{ background: "var(--wf-brand-accent)", border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "var(--wf-on-brand-accent)", cursor: "pointer" }}>
              {esUltimo ? paso.boton || "¡Entendido!" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
