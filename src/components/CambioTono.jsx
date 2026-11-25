import { ArrowUp } from "lucide-react";
import { acordeEn } from "../lib/preferencias.js";
import { opcionesCambio, cuantoSube } from "../lib/cambioTono.js";

// Cuadro "¿A qué tono sube?" (ver lib/cambioTono.js). Se usa en la Estructura de la canción y en
// "Orden para este culto". Muestra los tonos de verdad (D, E…) y cuánto sube cada uno, para que nadie
// tenga que contar medios tonos.
export const COLOR_CAMBIO = "#E8821E";

export function ElegirCambioTono({ desdeKey, actual = 0, titulo = "¿A qué tono sube?", onElegir, onCancelar }) {
  const opciones = opcionesCambio(desdeKey);
  return (
    <div style={{ background: "var(--wf-card)", border: `1.5px solid ${COLOR_CAMBIO}`, borderRadius: 14, padding: 12, margin: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: "var(--wf-text)" }}>
        <ArrowUp size={16} color={COLOR_CAMBIO} /> {titulo}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--wf-muted)", margin: "2px 0 10px" }}>
        {desdeKey ? <>Hasta aquí va en <b>{acordeEn(desdeKey)}</b>. Los acordes se siguen escribiendo en el tono original: la app los pasa sola.</> : "Elige cuánto sube."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 6 }}>
        {opciones.map((o) => {
          const activo = o.semitonos === actual;
          return (
            <button key={o.semitonos} type="button" onClick={() => onElegir(o.semitonos)} aria-pressed={activo} className="hoverable"
              style={{ minHeight: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 12, border: activo ? "none" : "1px solid var(--wf-divider)", background: activo ? COLOR_CAMBIO : "var(--wf-bg)", color: activo ? "#fff" : "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{desdeKey ? acordeEn(o.tono) : `+${o.semitonos}`}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, opacity: activo ? 0.9 : 0.65 }}>{cuantoSube(o.semitonos)}</span>
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onCancelar} style={{ marginTop: 8, background: "none", border: "none", padding: 0, fontSize: 12.5, fontWeight: 700, color: "var(--wf-muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
    </div>
  );
}
