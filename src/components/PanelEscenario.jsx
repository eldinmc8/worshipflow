import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquare, Send, Trash2, MonitorSmartphone, ExternalLink, Timer, Play, Pause, RotateCcw } from "lucide-react";
import PantallaOtroEquipo from "./PantallaOtroEquipo.jsx";
import { enlaceEscenario } from "../lib/enlacePantalla.js";
import { obtenerCodigoPantalla } from "../lib/liveSession.js";
import { restanteTemporizador, textoTemporizador, nivelTemporizador, temporizadorActivo, iniciarTemporizador, pausarTemporizador, reanudarTemporizador } from "../lib/escenario.js";

// Panel "Escenario" de la consola de Multimedia (2026-11-01): mensaje corto para quienes están en la
// plataforma (sale grande en la Pantalla de escenario, el público no lo ve), temporizador del mensaje
// (2026-11-02) y cómo abrir esa pantalla. Solo lo tiene quien lleva la transmisión.

export const MENSAJES_ALABANZA = ["Repetir coro", "Último coro", "Alargar", "Terminar canción", "Volver al inicio", "Más despacio", "Más rápido", "Oración"];
export const MENSAJES_PREDICACION = ["Faltan 10 min", "Faltan 5 min", "Tiempo cumplido", "Cerrar en oración", "Llamado al altar"];
export const MENSAJES_RAPIDOS = [...MENSAJES_ALABANZA, ...MENSAJES_PREDICACION];
const DURACIONES_MIN = [20, 30, 40, 45, 60];
const COLOR_NIVEL = { normal: "var(--wf-heading)", aviso: "#E8821E", excedido: "#C23B32" };

export default function PanelEscenario({ mensaje, onMensaje, iglesiaId, slug, onCerrar, temporizador = null, onTemporizador = null, autoTemporizador = null, onAutoTemporizador = null }) {
  const [texto, setTexto] = useState(mensaje || "");
  const [verEnlace, setVerEnlace] = useState(false);
  const [codigo, setCodigo] = useState(null); // el enlace lleva el código vigente (vence al finalizar la transmisión)
  const [ahora, setAhora] = useState(() => Date.now());
  const [duracionMin, setDuracionMin] = useState(() => Math.round((temporizador?.duracionSeg || autoTemporizador?.duracionSeg || 1800) / 60));
  useEffect(() => { let vivo = true; obtenerCodigoPantalla().then((c) => { if (vivo) setCodigo(c); }); return () => { vivo = false; }; }, []);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const enviar = (t) => { const limpio = (t ?? texto).trim().slice(0, 80); onMensaje(limpio); setTexto(limpio); };

  if (verEnlace) return <PantallaOtroEquipo tipo="escenario" iglesiaId={iglesiaId} slug={slug} onCerrar={() => setVerEnlace(false)} />;

  const chip = (activo) => ({ fontSize: 13, fontWeight: 600, padding: "8px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "inherit", background: activo ? "var(--wf-brand-accent)" : "var(--wf-card)", color: activo ? "var(--wf-on-brand-accent)" : "var(--wf-text)", boxShadow: activo ? "none" : "0 2px 8px rgba(22,50,79,0.08)" });
  const boton = { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 12, border: "none", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: 1, boxShadow: "0 2px 8px rgba(22,50,79,0.08)", fontFamily: "inherit", textDecoration: "none" };
  const seccion = { fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, margin: "16px 0 6px" };

  const activo = temporizadorActivo(temporizador);
  const corriendo = !!temporizador?.finEn;
  const restante = restanteTemporizador(temporizador, ahora);
  const nivel = nivelTemporizador(restante);
  const duracionSeg = Math.max(1, Number(duracionMin) || 30) * 60;
  const cambiarDuracion = (min) => {
    setDuracionMin(min);
    if (autoTemporizador && onAutoTemporizador) onAutoTemporizador({ ...autoTemporizador, duracionSeg: Math.max(1, Number(min) || 30) * 60 });
  };

  return createPortal(
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,16,28,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Pantalla de escenario" onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--wf-bg, #F4F6FA)", borderRadius: 18, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--wf-brand-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MessageSquare size={18} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--wf-heading)", flex: 1 }}>Escenario</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--wf-muted)", display: "flex" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, margin: "0 0 8px" }}>Mensajes y temporizador para quienes están en la plataforma. El público no los ve.</p>

        <div style={seccion}>MENSAJE · ALABANZA</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MENSAJES_ALABANZA.map((m) => <button key={m} type="button" onClick={() => enviar(m)} style={chip(mensaje === m)}>{m}</button>)}
        </div>
        <div style={seccion}>MENSAJE · PREDICACIÓN</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {MENSAJES_PREDICACION.map((m) => <button key={m} type="button" onClick={() => enviar(m)} style={chip(mensaje === m)}>{m}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
            placeholder="O escribe un mensaje corto…" maxLength={80}
            style={{ flex: 1, minWidth: 0, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", fontFamily: "inherit" }}
          />
          <button type="button" onClick={() => enviar()} disabled={!texto.trim()} aria-label="Enviar mensaje" style={{ ...boton, flex: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: texto.trim() ? 1 : 0.5 }}><Send size={16} /></button>
        </div>
        {mensaje && (
          <button type="button" onClick={() => { onMensaje(""); setTexto(""); }} style={{ ...boton, width: "100%", color: "#C23B32", marginBottom: 4 }}>
            <Trash2 size={15} /> Quitar «{mensaje}»
          </button>
        )}

        {onTemporizador && (
          <>
            <div style={{ ...seccion, display: "flex", alignItems: "center", gap: 6 }}><Timer size={13} /> TEMPORIZADOR DEL MENSAJE</div>
            <div style={{ background: "var(--wf-card)", borderRadius: 14, padding: 12, boxShadow: "0 2px 8px rgba(22,50,79,0.08)" }}>
              {activo ? (
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: COLOR_NIVEL[nivel], lineHeight: 1.1 }}>{textoTemporizador(restante)}</div>
                  <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>{!corriendo ? "En pausa" : nivel === "excedido" ? "Se pasó del tiempo" : nivel === "aviso" ? "Últimos minutos" : "Corriendo · se ve en el escenario"}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
                  {DURACIONES_MIN.map((m) => <button key={m} type="button" onClick={() => cambiarDuracion(m)} style={{ ...chip(Number(duracionMin) === m), padding: "7px 10px" }}>{m} min</button>)}
                  <input type="number" min={1} max={240} value={duracionMin} onChange={(e) => cambiarDuracion(e.target.value)} aria-label="Minutos"
                    style={{ width: 64, background: "var(--wf-bg, #F4F6FA)", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "7px 8px", fontSize: 13, color: "var(--wf-text)", fontFamily: "inherit" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                {!activo && <button type="button" onClick={() => onTemporizador(iniciarTemporizador(duracionSeg))} style={{ ...boton, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)" }}><Play size={15} /> Iniciar {duracionMin} min</button>}
                {activo && corriendo && <button type="button" onClick={() => onTemporizador(pausarTemporizador(temporizador))} style={boton}><Pause size={15} /> Pausar</button>}
                {activo && !corriendo && <button type="button" onClick={() => onTemporizador(reanudarTemporizador(temporizador))} style={{ ...boton, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)" }}><Play size={15} /> Seguir</button>}
                {activo && <button type="button" onClick={() => onTemporizador(null)} style={{ ...boton, color: "#C23B32" }}><RotateCcw size={15} /> Quitar</button>}
              </div>
              {autoTemporizador && onAutoTemporizador && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, fontSize: 12.5, color: "var(--wf-text)", lineHeight: 1.4, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!autoTemporizador.activo} onChange={(e) => onAutoTemporizador({ activo: e.target.checked, duracionSeg })} style={{ marginTop: 2, accentColor: "#E8821E" }} />
                  <span>Iniciar solo cuando empiece la predicación ({Math.round((autoTemporizador.activo ? autoTemporizador.duracionSeg : duracionSeg) / 60)} min)</span>
                </label>
              )}
            </div>
          </>
        )}

        <div style={seccion}>PANTALLA DE ESCENARIO</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setVerEnlace(true)} style={boton}><MonitorSmartphone size={16} /> En un TV o tablet</button>
          <a href={enlaceEscenario(slug, window.location.origin, codigo)} target="_blank" rel="noopener noreferrer" style={boton}><ExternalLink size={16} /> Abrir aquí</a>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5, marginTop: 10 }}>
          Muestra la letra al aire, lo que sigue, la siguiente canción, el reloj, estos mensajes y el temporizador. En la predicación, el predicador ve además en qué punto va y su nota privada.
        </div>
      </div>
    </div>,
    document.body,
  );
}
