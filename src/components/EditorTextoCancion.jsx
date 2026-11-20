import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ClipboardPaste, AlertTriangle, Info, Check } from "lucide-react";
import { textoACancion } from "../lib/textoCancion.js";
import { acordeEn } from "../lib/preferencias.js";
import { useCerrarConAtras } from "../lib/atras.js";

// "Pegar canción" (simplificada 2026-11-20, pedido de Eldin): con el editor por pasos ya no hace
// falta escribir aquí. Es solo un cuadro para pegar lo que se copió de internet (acordes encima tipo
// LaCuerda, [acordes] adentro o solo la letra) y un resumen corto de lo que se encontró. Después de
// "Usar esto" la canción se revisa en los pasos de siempre (Estructura → Letra → Acordes).
// La conversión vive en lib/textoCancion.js.

const colorSeccion = (label) => {
  const l = (label || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/pre[\s-]?coro/.test(l)) return "#C2508F";
  if (/coro|estribillo/.test(l)) return "#B15EA0";
  if (/puente/.test(l)) return "#3F6FC4";
  if (/estrofa|verso/.test(l)) return "#1F8A73";
  if (/instrumental|interludio|intermedio|solo/.test(l)) return "#8A6D1E";
  if (/intro/.test(l)) return "#A85A26";
  if (/final|outro|coda|tag/.test(l)) return "#3E5C76";
  return "#5B6472";
};

export default function EditorTextoCancion({ cancion, onAplicar, onCerrar }) {
  useCerrarConAtras(!!onCerrar, onCerrar);
  const [texto, setTexto] = useState("");
  const areaRef = useRef(null);
  const puedeLeerPortapapeles = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;
  useEffect(() => { areaRef.current?.focus(); }, []);

  const { blocks, letra, defaultStructure, avisos, tonalidadSugerida, tituloSugerido, acordesEncima } = useMemo(() => textoACancion(texto, null), [texto]);
  const orden = defaultStructure.length ? defaultStructure : Object.keys(blocks);
  const vacio = !texto.trim();

  const pegarDelPortapapeles = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTexto(t);
    } catch { areaRef.current?.focus(); }
  };

  const aplicar = () => onAplicar({
    blocks, letra, defaultStructure,
    key: cancion?.key || tonalidadSugerida || "",
    title: (cancion?.title || "").trim() ? cancion.title : (tituloSugerido || ""),
  });

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 8000, background: "var(--wf-bg)", display: "flex", flexDirection: "column", fontFamily: "var(--wf-font-ui)", color: "var(--wf-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--wf-divider)", background: "var(--wf-card)", flexShrink: 0 }}>
        <button onClick={onCerrar} aria-label="Cerrar" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--wf-text)", display: "flex", padding: 4 }}><X size={20} /></button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 17, fontWeight: 600 }}>Pegar canción</div>
        <button onClick={aplicar} disabled={vacio} style={{ border: "none", borderRadius: 12, padding: "9px 16px", fontWeight: 800, fontSize: 13.5, cursor: vacio ? "not-allowed" : "pointer", opacity: vacio ? 0.4 : 1, background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Check size={16} /> Usar esto</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--wf-muted)" }}>
          Pega la canción que copiaste de internet, con o sin acordes. Las partes (Estrofa, Coro…) y los acordes se acomodan solos, y luego lo revisas en los pasos.
        </p>
        {vacio && puedeLeerPortapapeles && (
          <button onClick={pegarDelPortapapeles} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 52, borderRadius: 14, border: "none", background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
            <ClipboardPaste size={19} /> Pegar lo que copié
          </button>
        )}
        <textarea
          ref={areaRef} value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false}
          aria-label="Canción pegada"
          placeholder="O mantén presionado aquí y elige Pegar"
          style={{ minHeight: vacio ? 220 : 260, flexShrink: 0, width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid var(--wf-divider)", borderRadius: 14, outline: "none", padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, lineHeight: 1.5, background: "var(--wf-card)", color: "var(--wf-text)" }}
        />
        {!vacio && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-muted)" }}>Así quedó el orden de la canción</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {orden.map((k, i) => <span key={i} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: colorSeccion(blocks[k]?.label), borderRadius: 12, padding: "4px 10px" }}>{blocks[k]?.label}</span>)}
            </div>
            {acordesEncima > 0 && <Aviso tipo="ok">Acomodé {acordesEncima} {acordesEncima === 1 ? "renglón" : "renglones"} de acordes que venían encima de la letra.</Aviso>}
            {tituloSugerido && !cancion?.title?.trim() && <Aviso tipo="info">Título: <b>{tituloSugerido}</b> (lo tomé de la primera línea).</Aviso>}
            {tonalidadSugerida && !cancion?.key && <Aviso tipo="info">Tonalidad probable: <b>{acordeEn(tonalidadSugerida)}</b>. La puedes cambiar en Datos.</Aviso>}
            {avisos.map((a, i) => <Aviso key={i} tipo={a.tipo}>{a.texto}</Aviso>)}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Aviso({ tipo, children }) {
  const estilo = tipo === "aviso" ? { bg: "rgba(232,130,30,0.14)", color: "#B2620F", Icon: AlertTriangle } : tipo === "ok" ? { bg: "rgba(31,138,115,0.13)", color: "#1F8A73", Icon: Check } : { bg: "rgba(47,95,168,0.12)", color: "#2F5FA8", Icon: Info };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, background: estilo.bg, color: "var(--wf-text)", borderRadius: 10, padding: "8px 10px" }}>
      <estilo.Icon size={15} color={estilo.color} style={{ flexShrink: 0, marginTop: 1 }} /><span>{children}</span>
    </div>
  );
}
