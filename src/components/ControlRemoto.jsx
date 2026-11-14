import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, MonitorOff, Monitor, Smartphone, Loader2, BookOpen, ArrowLeft } from "lucide-react";
import { mandarComando, itemDeDiapositiva } from "../lib/controlRemoto.js";
import { resumenDiapositiva } from "../lib/escenario.js";
import { serviceItemLabel } from "../pantallas/compartido.jsx";
import { BibleBrowserBody } from "../pantallas/biblia.jsx";
import { useCerrarConAtras } from "../lib/atras.js";

// Si a los ESPERA_MS de una orden no cambió nada al aire, se avisa (la orden sí salió del celular).
export const ESPERA_MS = 4000;

// Control remoto de Multimedia desde el celular (pedido de Eldin, 2026-11-13). Muestra lo que está al
// aire (de la sesión en vivo) y manda órdenes a la computadora que transmite: Anterior, Siguiente,
// Pantalla en negro, ir directo a una parte del culto, o buscar un versículo de la Biblia y proyectarlo.
// No puede iniciar ni terminar la transmisión.
// La vista previa del aire es oscura (regla de oro: lo que se proyecta, estilo escenario).
export default function ControlRemoto({ evento, slideAlAire, negro = false, library = [], onCerrar }) {
  useCerrarConAtras(true, onCerrar);
  const [enviando, setEnviando] = useState(null); // acción que se está mandando
  const [error, setError] = useState(null);
  const orden = (evento?.serviceOrder || []).filter((it) => it.type !== "seccion");
  const alAire = resumenDiapositiva(slideAlAire);
  const itemAlAire = itemDeDiapositiva(evento?.serviceOrder, slideAlAire);

  const [biblia, setBiblia] = useState(false); // buscador de versículos abierto
  useCerrarConAtras(biblia, () => setBiblia(false));

  // ¿La computadora obedeció? Se nota porque cambia lo que está al aire. Si pasa un rato sin ningún
  // cambio, se dice qué revisar — antes el celular no decía nada y parecía que el botón no servía.
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const firma = `${slideAlAire?.slideId || ""}|${slideAlAire?.reference || ""}|${(slideAlAire?.text || "").length}|${negro ? 1 : 0}`;
  const esperaRef = useRef(null);
  useEffect(() => { clearTimeout(esperaRef.current); setSinRespuesta(false); }, [firma]);
  useEffect(() => () => clearTimeout(esperaRef.current), []);

  const mandar = async (accion, { itemId = null, datos = null } = {}) => {
    setEnviando(itemId ? `ir:${itemId}` : accion); setError(null);
    let ok = true;
    try {
      await mandarComando({ accion, itemId, datos });
      if (navigator.vibrate) navigator.vibrate(15);
      clearTimeout(esperaRef.current);
      esperaRef.current = setTimeout(() => setSinRespuesta(true), ESPERA_MS);
    } catch (e) {
      ok = false;
      setError(e.message);
    }
    setEnviando(null);
    return ok;
  };
  const proyectarVersiculo = async (v) => {
    const ok = await mandar("biblia", { datos: { ref: v.ref, version: v.version, text: v.text, bookId: v.bookId, bookName: v.bookName, chapter: v.chapter, verseStart: v.verseStart, verseEnd: v.verseEnd } });
    if (ok) setBiblia(false);
  };

  const grande = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", borderRadius: 18, padding: "22px 10px", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" };

  return createPortal(
    <div role="dialog" aria-label="Control remoto de las diapositivas" style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--wf-bg)", color: "var(--wf-text)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--wf-divider)", background: "var(--wf-card)" }}>
        <Smartphone size={20} color="var(--wf-brand-accent)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 18, fontWeight: 600 }}>Control remoto</div>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{evento?.title || "En vivo"}</div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar control remoto" style={{ background: "var(--wf-hover)", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--wf-text)" }}><X size={18} /></button>
      </div>

      {biblia && (
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <button onClick={() => setBiblia(false)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--wf-text)", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "4px 0 12px" }}><ArrowLeft size={18} /> Volver al control</button>
          {error && <div role="alert" style={{ fontSize: 13, color: "#C23B32", background: "#C23B3214", borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>{error}</div>}
          <BibleBrowserBody onAdd={proyectarVersiculo} submitLabel={enviando ? "Enviando…" : "Proyectar"} />
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: biblia ? "none" : "flex", flexDirection: "column", gap: 14 }}>
        {/* Lo que está al aire */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: "#C23B32", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#C23B32" }} /> AL AIRE{negro ? " · PANTALLA EN NEGRO" : ""}
          </div>
          <div aria-label="Lo que está al aire" style={{ background: "#0E141C", color: "#fff", borderRadius: 16, minHeight: 130, padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", opacity: negro ? 0.35 : 1 }}>
            {alAire ? (
              <>
                {alAire.lineas.map((l, i) => <div key={i} style={{ fontSize: alAire.tipo === "biblia" ? 15 : 18, lineHeight: 1.35, fontWeight: 600 }}>{l}</div>)}
                {alAire.tipo === "biblia" && alAire.etiqueta && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>{alAire.etiqueta}</div>}
              </>
            ) : <div style={{ fontSize: 14, opacity: 0.6 }}>Nada al aire todavía</div>}
          </div>
        </div>

        {error && <div role="alert" style={{ fontSize: 13, color: "#C23B32", background: "#C23B3214", borderRadius: 10, padding: "8px 10px" }}>{error}</div>}

        {sinRespuesta && !error && (
          <div role="status" style={{ fontSize: 13, color: "var(--wf-text)", background: "color-mix(in srgb, var(--wf-brand-accent) 14%, transparent)", borderRadius: 10, padding: "8px 10px", lineHeight: 1.4 }}>
            No se vio ningún cambio en la pantalla. Si ya estabas en la primera o la última diapositiva, es normal. Si no, revisa que la computadora que transmite tenga internet y la consola En vivo abierta; si sigue igual, recarga la página en esa computadora.
          </div>
        )}

        <button onClick={() => { setError(null); setBiblia(true); }} disabled={!!enviando}
          style={{ ...grande, flex: "none", padding: "14px 10px", fontSize: 15, background: "var(--wf-card)", color: "#2F5FA8", boxShadow: "0 1px 3px rgba(22,50,79,0.08)" }}>
          <BookOpen size={18} /> Versículo de la Biblia
        </button>

        {/* Ir a una parte del culto */}
        {orden.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Ir a</div>
            <div style={{ background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 1px 3px rgba(22,50,79,0.08)", overflow: "hidden" }}>
              {orden.map((it, i) => {
                const activo = itemAlAire?.id === it.id;
                return (
                  <button key={it.id} onClick={() => mandar("ir_item", { itemId: it.id })} disabled={!!enviando}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", borderTop: i ? "1px solid var(--wf-divider)" : "none", background: activo ? "color-mix(in srgb, var(--wf-brand-accent) 12%, transparent)" : "transparent", padding: "12px 14px", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit", fontSize: 14, fontWeight: activo ? 700 : 500 }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{serviceItemLabel(it, library)}</span>
                    {activo && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#C23B32" }}>AL AIRE</span>}
                    {enviando === `ir:${it.id}` && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--wf-faint)", textAlign: "center" }}>La computadora que transmite hace el cambio. Desde aquí no se puede terminar la transmisión.</div>
      </div>
      {/* Mando fijo abajo, al alcance del pulgar (rediseño de la consola, 2026-11-14): Anterior,
          Siguiente y Negro ya no se van con el scroll de la lista "Ir a". */}
      {!biblia && (
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px calc(14px + env(safe-area-inset-bottom))", background: "var(--wf-card)", borderRadius: "20px 20px 0 0", boxShadow: "0 -2px 10px rgba(22,50,79,0.10)" }}>
        {/* Anterior / Siguiente */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => mandar("anterior")} disabled={!!enviando} aria-label="Diapositiva anterior" style={{ ...grande, background: "var(--wf-hover)", color: "var(--wf-text)" }}>
            {enviando === "anterior" ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronLeft size={22} />} Anterior
          </button>
          <button onClick={() => mandar("siguiente")} disabled={!!enviando} aria-label="Diapositiva siguiente" style={{ ...grande, flex: 1.4, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)" }}>
            Siguiente {enviando === "siguiente" ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={22} />}
          </button>
        </div>
        <button onClick={() => mandar("negro")} disabled={!!enviando} aria-pressed={negro}
          style={{ ...grande, flex: "none", padding: "14px 10px", fontSize: 15, background: negro ? "#C23B32" : "var(--wf-hover)", color: negro ? "#fff" : "var(--wf-text)" }}>
          {negro ? <><Monitor size={18} /> Volver a mostrar</> : <><MonitorOff size={18} /> Pantalla en negro</>}
        </button>
      </div>
      )}
    </div>,
    document.body
  );
}
