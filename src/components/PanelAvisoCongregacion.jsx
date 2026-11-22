import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Megaphone, Send, Trash2 } from "lucide-react";
import { useCerrarConAtras } from "../lib/atras.js";
import { MENSAJES_AVISO, DURACIONES_AVISO, DURACION_AVISO_DEFECTO, MAX_LETRAS_AVISO, crearAviso } from "../lib/avisoCongregacion.js";

// Ventana "Mensaje" de la consola de Multimedia (2026-11-22): escribe un aviso corto para la congregación,
// elige cuántos segundos dura y lo manda al proyector (ver lib/avisoCongregacion.js).
export default function PanelAvisoCongregacion({ avisoActual = null, segundosRestantes = 0, onEnviar, onQuitar, onCerrar }) {
  useCerrarConAtras(true, onCerrar);
  const [texto, setTexto] = useState("");
  const [duracion, setDuracion] = useState(DURACION_AVISO_DEFECTO);

  const enviar = () => {
    const aviso = crearAviso(texto, duracion);
    if (!aviso) return;
    onEnviar(aviso);
    onCerrar();
  };

  const chip = (activo) => ({ fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", background: activo ? "var(--wf-brand-accent)" : "var(--wf-card)", color: activo ? "var(--wf-on-brand-accent)" : "var(--wf-text)", boxShadow: activo ? "none" : "0 2px 8px rgba(22,50,79,0.08)" });
  const seccion = { fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, margin: "16px 0 6px" };
  const listo = !!texto.trim();

  return createPortal(
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,16,28,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Mensaje para la congregación" onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--wf-bg, #F4F6FA)", borderRadius: 18, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--wf-brand-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Megaphone size={18} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--wf-heading)", flex: 1 }}>Mensaje para la congregación</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--wf-muted)", display: "flex" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, margin: "0 0 4px" }}>Sale en una franja abajo del proyector, encima de lo que esté al aire, y se quita sola.</p>

        {avisoActual && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", borderRadius: 12, padding: "10px 12px", margin: "10px 0 0", boxShadow: "0 2px 8px rgba(22,50,79,0.08)" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--wf-text)" }}>En pantalla: «{avisoActual.texto}» · {segundosRestantes} s</span>
            <button type="button" onClick={onQuitar} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#C23B32", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}><Trash2 size={14} /> Quitar ya</button>
          </div>
        )}

        <div style={seccion}>MENSAJES LISTOS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MENSAJES_AVISO.map((m) => <button key={m} type="button" onClick={() => setTexto(m)} style={chip(texto === m)}>{m.trim()}{m.endsWith(" ") ? "…" : ""}</button>)}
        </div>

        <div style={seccion}>TU MENSAJE</div>
        <textarea
          value={texto} onChange={(e) => setTexto(e.target.value.slice(0, MAX_LETRAS_AVISO))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribe un mensaje corto…" rows={2} maxLength={MAX_LETRAS_AVISO} aria-label="Mensaje"
          style={{ width: "100%", boxSizing: "border-box", resize: "none", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ fontSize: 11, color: "var(--wf-faint)", textAlign: "right", marginTop: 2 }}>{texto.length}/{MAX_LETRAS_AVISO}</div>

        <div style={seccion}>CUÁNTO DURA EN PANTALLA</div>
        <div style={{ display: "flex", gap: 6 }}>
          {DURACIONES_AVISO.map((s) => <button key={s} type="button" onClick={() => setDuracion(s)} style={{ ...chip(duracion === s), flex: 1 }}>{s} s</button>)}
        </div>

        <button type="button" onClick={enviar} disabled={!listo} style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 12, border: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", fontSize: 14, fontWeight: 700, cursor: listo ? "pointer" : "not-allowed", opacity: listo ? 1 : 0.5, fontFamily: "inherit" }}>
          <Send size={16} /> {avisoActual ? "Enviar (reemplaza el actual)" : "Enviar al proyector"}
        </button>
      </div>
    </div>,
    document.body
  );
}
