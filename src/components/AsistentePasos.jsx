import { useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useCerrarConAtras } from "../lib/atras.js";

// Marco de "pasos" de pantalla completa (mismo estilo que el asistente de Nueva canción): arriba el
// título y la barrita de pasos numerados, abajo Atrás / Siguiente. Lo usan Publicar en varias fechas,
// Nueva plantilla y Nuevo evento. Pensado primero para celular.
//
// pasos: [{ clave, nombre }]; paso: índice actual; puedeSeguir: si el botón principal está activo;
// falta: texto que se muestra cuando no se puede seguir; omitir: si el paso se puede saltar;
// textoFinal: lo que dice el botón del último paso; ocupado: deshabilita todo (ej. publicando).
export const botonPie = { minHeight: 48, borderRadius: 14, fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };

export default function AsistentePasos({ titulo, pasos, paso, onPaso, onCerrar, puedeSeguir = true, falta = "", omitir = false, onFinal, textoFinal = "Listo", ocupado = false, children }) {
  useCerrarConAtras(true, () => { if (!ocupado) onCerrar(); });
  const cuerpoRef = useRef(null);
  const ir = (i) => {
    onPaso(i);
    requestAnimationFrame(() => cuerpoRef.current?.scrollTo?.({ top: 0 }));
  };
  const ultimo = paso === pasos.length - 1;
  const siguiente = () => (ultimo ? onFinal() : ir(paso + 1));

  return createPortal(
    <div role="dialog" aria-label={titulo} style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--wf-bg)", display: "flex", flexDirection: "column", color: "var(--wf-text)" }}>
      <div style={{ padding: "12px 16px 0", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onCerrar} disabled={ocupado} aria-label="Salir" style={{ background: "transparent", border: "none", color: "var(--wf-muted)", cursor: "pointer", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}><ArrowLeft size={18} /></button>
          <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 19, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
        </div>
        <div role="tablist" style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {pasos.map((p, i) => {
            const activo = i === paso;
            const hecho = i < paso;
            const bloqueado = ocupado || (i > paso && !puedeSeguir);
            return (
              <button key={p.clave} role="tab" aria-selected={activo} disabled={bloqueado || i > paso + 1} onClick={() => ir(i)}
                style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 2px 8px", border: "none", background: "none", cursor: bloqueado ? "not-allowed" : "pointer", opacity: i > paso && (bloqueado || i > paso + 1) ? 0.45 : 1, fontFamily: "inherit", borderBottom: `3px solid ${activo ? "var(--wf-brand-accent)" : hecho ? "color-mix(in srgb, var(--wf-brand-accent) 40%, transparent)" : "var(--wf-divider)"}` }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, background: activo ? "var(--wf-brand-accent)" : hecho ? "color-mix(in srgb, var(--wf-brand-accent) 22%, transparent)" : "var(--wf-hover)", color: activo ? "var(--wf-on-brand-accent, #fff)" : "var(--wf-text)" }}>
                  {hecho ? <Check size={14} /> : i + 1}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: activo ? 800 : 600, color: activo ? "var(--wf-text)" : "var(--wf-muted)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div ref={cuerpoRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: 16, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>{children}</div>
      </div>

      <div style={{ borderTop: "1px solid var(--wf-divider)", background: "var(--wf-bg)", padding: "10px 0", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 8 }}>
          {paso > 0 ? (
            <button type="button" disabled={ocupado} onClick={() => ir(paso - 1)} style={{ ...botonPie, background: "var(--wf-hover)", border: "none", color: "var(--wf-text)" }}><ChevronLeft size={18} /> Atrás</button>
          ) : null}
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--wf-muted)", minWidth: 0 }}>{puedeSeguir ? "" : falta}</span>
          {omitir && !ultimo && <button type="button" disabled={ocupado} onClick={() => ir(paso + 1)} style={{ ...botonPie, background: "transparent", border: "1.5px solid var(--wf-border)", color: "var(--wf-text)" }}>Omitir</button>}
          <button type="button" disabled={!puedeSeguir || ocupado} onClick={siguiente}
            style={{ ...botonPie, border: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent, #fff)", opacity: puedeSeguir && !ocupado ? 1 : 0.4, cursor: puedeSeguir && !ocupado ? "pointer" : "not-allowed" }}>
            {ultimo ? <><Check size={18} /> {textoFinal}</> : <>Siguiente <ChevronRight size={18} /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Tarjeta-título de cada paso: "Paso 2 · ¿Desde cuándo?" + explicación corta.
export function EncabezadoPaso({ titulo, ayuda }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontFamily: "var(--wf-font-titulo)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", margin: "4px 0 4px" }}>{titulo}</h2>
      {ayuda && <p style={{ fontSize: 13.5, color: "var(--wf-muted)", margin: 0 }}>{ayuda}</p>}
    </div>
  );
}

// Botón tipo píldora (días, frecuencias, atajos).
export function Pildora({ activo, onClick, children, disabled = false }) {
  return (
    <button type="button" aria-pressed={activo} disabled={disabled} onClick={onClick}
      style={{ fontSize: 14, fontWeight: 700, minHeight: 42, padding: "8px 14px", borderRadius: 21, border: "none", background: activo ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: activo ? "var(--wf-on-brand-accent, #fff)" : "var(--wf-text)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit" }}>
      {children}
    </button>
  );
}
