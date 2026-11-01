import { useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquare, Send, Trash2, MonitorSmartphone, ExternalLink } from "lucide-react";
import PantallaOtroEquipo from "./PantallaOtroEquipo.jsx";
import { enlaceEscenario } from "../lib/enlacePantalla.js";

// Panel "Escenario" de la consola de Multimedia (2026-11-01): mensaje corto para quienes están en la
// plataforma (sale grande en la Pantalla de escenario, el público no lo ve) y cómo abrir esa pantalla.
// Solo lo tiene quien lleva la transmisión, igual que iniciar/finalizar y el estilo en vivo.

export const MENSAJES_RAPIDOS = ["Repetir coro", "Último coro", "Alargar", "Terminar canción", "Volver al inicio", "Más despacio", "Más rápido", "Oración"];

export default function PanelEscenario({ mensaje, onMensaje, iglesiaId, slug, onCerrar }) {
  const [texto, setTexto] = useState(mensaje || "");
  const [verEnlace, setVerEnlace] = useState(false);
  const enviar = (t) => { const limpio = (t ?? texto).trim().slice(0, 80); onMensaje(limpio); setTexto(limpio); };

  if (verEnlace) return <PantallaOtroEquipo tipo="escenario" iglesiaId={iglesiaId} slug={slug} onCerrar={() => setVerEnlace(false)} />;

  const chip = (activo) => ({ fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", background: activo ? "var(--wf-brand-accent)" : "var(--wf-card)", color: activo ? "var(--wf-on-brand-accent)" : "var(--wf-text)", boxShadow: activo ? "none" : "0 2px 8px rgba(22,50,79,0.08)" });
  const boton = { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 12, border: "none", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: 1, boxShadow: "0 2px 8px rgba(22,50,79,0.08)", fontFamily: "inherit", textDecoration: "none" };

  return createPortal(
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,16,28,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Pantalla de escenario" onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--wf-bg, #F4F6FA)", borderRadius: 18, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--wf-brand-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MessageSquare size={18} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--wf-heading)", flex: 1 }}>Mensaje al escenario</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--wf-muted)", display: "flex" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>Sale en grande en la pantalla de escenario. El público no lo ve.</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {MENSAJES_RAPIDOS.map((m) => (
            <button key={m} type="button" onClick={() => enviar(m)} style={chip(mensaje === m)}>{m}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
            placeholder="Escribe un mensaje corto…" maxLength={80}
            style={{ flex: 1, minWidth: 0, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", fontFamily: "inherit" }}
          />
          <button type="button" onClick={() => enviar()} disabled={!texto.trim()} aria-label="Enviar mensaje" style={{ ...boton, flex: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: texto.trim() ? 1 : 0.5 }}><Send size={16} /></button>
        </div>
        {mensaje && (
          <button type="button" onClick={() => { onMensaje(""); setTexto(""); }} style={{ ...boton, width: "100%", color: "#C23B32", marginBottom: 4 }}>
            <Trash2 size={15} /> Quitar «{mensaje}»
          </button>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, margin: "16px 0 6px" }}>PANTALLA DE ESCENARIO</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setVerEnlace(true)} style={boton}><MonitorSmartphone size={16} /> En un TV o tablet</button>
          <a href={enlaceEscenario(slug)} target="_blank" rel="noopener noreferrer" style={boton}><ExternalLink size={16} /> Abrir aquí</a>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5, marginTop: 10 }}>
          Muestra la letra al aire, lo que sigue, la parte de la canción, la siguiente canción, el reloj y estos mensajes. Si pones la proyección en negro, el escenario sigue viendo la letra.
        </div>
      </div>
    </div>,
    document.body,
  );
}
