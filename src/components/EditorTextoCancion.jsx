import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ClipboardPaste, AlertTriangle, Info, Check, Eye, PencilLine } from "lucide-react";
import { cancionATexto, textoACancion } from "../lib/textoCancion.js";
import { parseChordLine, buildChordRow } from "../lib/musicTheory.js";
import { acordeEn, lineaEn } from "../lib/preferencias.js";

// "Pegar canción / Editar como texto" (pedido de Eldin, 2026-10-13). Toda la canción en un solo
// cuadro: se pega de internet (acordes encima, tipo LaCuerda), con [acordes] adentro o solo la letra.
// A la derecha (abajo en celular) se ve en vivo cómo queda: secciones, acordes sobre la letra y las
// diapositivas. Nada se guarda hasta "Usar esto" y luego Guardar en el editor de siempre.
// La conversión vive en lib/textoCancion.js (probada de ida y vuelta con las 121 canciones reales).

const SECCIONES_RAPIDAS = [
  { etiqueta: "Estrofa", numerar: true },
  { etiqueta: "Pre-coro" },
  { etiqueta: "Coro" },
  { etiqueta: "Puente" },
  { etiqueta: "Intro" },
  { etiqueta: "Final" },
];

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

function LineaConAcordes({ linea }) {
  if (!String(linea).trim()) return <div style={{ height: 10 }} />;
  const { plain, positions } = parseChordLine(lineaEn(linea));
  const soloAcordes = !plain.trim() && positions.length > 0;
  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.35, whiteSpace: "pre", overflowX: "auto" }}>
      {positions.length > 0 && <div style={{ color: "#1F8A73", fontWeight: 700 }}>{soloAcordes ? positions.map((p) => p.chord).join("  ") : buildChordRow(positions)}</div>}
      {!soloAcordes && <div style={{ color: "var(--wf-text)" }}>{plain}</div>}
    </div>
  );
}

export default function EditorTextoCancion({ cancion, nueva = false, onAplicar, onCerrar }) {
  const textoInicial = useMemo(() => (nueva ? "" : cancionATexto(cancion)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [texto, setTexto] = useState(textoInicial);
  const [vista, setVista] = useState("escribir"); // celular: "escribir" | "vista"
  const [angosto, setAngosto] = useState(() => window.innerWidth < 900);
  const areaRef = useRef(null);
  useEffect(() => {
    const r = () => setAngosto(window.innerWidth < 900);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  useEffect(() => { if (!angosto || vista === "escribir") areaRef.current?.focus(); }, [angosto, vista]);

  const resultado = useMemo(() => textoACancion(texto, nueva ? null : cancion), [texto, cancion, nueva]);
  const { blocks, letra, defaultStructure, avisos, tonalidadSugerida, tituloSugerido, acordesEncima } = resultado;
  const orden = defaultStructure.length ? defaultStructure : Object.keys(blocks);
  const vacio = !texto.trim();
  const cambiaTonalidad = tonalidadSugerida && !cancion?.key;

  // Botones rápidos: ponen el encabezado en una línea propia donde está el cursor.
  const insertarSeccion = ({ etiqueta, numerar }) => {
    const el = areaRef.current;
    const ini = el ? el.selectionStart : texto.length;
    const fin = el ? el.selectionEnd : texto.length;
    let nombre = etiqueta;
    if (numerar) {
      const usados = (texto.match(new RegExp(`^\\s*\\[?${etiqueta}\\s*(\\d+)`, "gim")) || []).length + (new RegExp(`^\\s*\\[?${etiqueta}\\]?\\s*$`, "im").test(texto) ? 1 : 0);
      nombre = `${etiqueta} ${usados + 1}`;
    }
    const antes = texto.slice(0, ini);
    const despues = texto.slice(fin);
    const pre = antes && !antes.endsWith("\n\n") ? (antes.endsWith("\n") ? "\n" : "\n\n") : "";
    const insercion = `${pre}[${nombre}]\n`;
    const nuevo = antes + insercion + despues;
    setTexto(nuevo);
    requestAnimationFrame(() => { const pos = (antes + insercion).length; el?.focus(); el?.setSelectionRange(pos, pos); });
  };

  const aplicar = () => onAplicar({
    blocks, letra, defaultStructure,
    key: cancion?.key || tonalidadSugerida || "",
    title: (cancion?.title || "").trim() ? cancion.title : (tituloSugerido || cancion?.title || ""),
  });

  const C = { borde: "var(--wf-divider)" };
  const panelTexto = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <textarea
        ref={areaRef} value={texto} onChange={(e) => setTexto(e.target.value)} spellCheck={false}
        placeholder={"Pega aquí la canción, con o sin acordes.\n\nEjemplo:\n\n[Estrofa 1]\nG              Bm\nVenimos ante ti Señor,\nEm         A        D\nLlenos de alabanza y de adoración.\n\n[Coro]\n[G]Porque tú eres [A]Rey de reyes\n\n· Un renglón vacío = nueva diapositiva\n· [Coro] sin letra = se repite el coro"}
        style={{ flex: 1, minHeight: 0, width: "100%", boxSizing: "border-box", resize: "none", border: "none", outline: "none", padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, lineHeight: 1.5, background: "var(--wf-card)", color: "var(--wf-text)" }}
      />
      <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderTop: `1px solid ${C.borde}`, overflowX: "auto", background: "var(--wf-bg)", flexShrink: 0 }}>
        {SECCIONES_RAPIDAS.map((s) => (
          <button key={s.etiqueta} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertarSeccion(s)}
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 16, border: "none", cursor: "pointer", background: `color-mix(in srgb, ${colorSeccion(s.etiqueta)} 18%, transparent)`, color: colorSeccion(s.etiqueta), fontFamily: "inherit" }}>
            + {s.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );

  const panelVista = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", padding: "14px 16px", background: "var(--wf-bg)" }}>
      {vacio ? (
        <div style={{ color: "var(--wf-faint)", fontSize: 13, lineHeight: 1.6, padding: "30px 10px", textAlign: "center" }}>
          <ClipboardPaste size={28} style={{ opacity: 0.5, marginBottom: 8 }} /><br />
          Pega la canción a la izquierda y aquí ves cómo queda: secciones, acordes sobre la letra y las diapositivas.
        </div>
      ) : (
        <>
          {(avisos.length > 0 || acordesEncima > 0 || cambiaTonalidad || (tituloSugerido && !cancion?.title)) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {acordesEncima > 0 && <Aviso tipo="ok">Acomodé {acordesEncima} línea{acordesEncima === 1 ? "" : "s"} de acordes que venían encima de la letra. Revisa que cada acorde quedó en su sílaba.</Aviso>}
              {tituloSugerido && !cancion?.title && <Aviso tipo="info">Título: <b>{tituloSugerido}</b> (lo tomé de la primera línea).</Aviso>}
              {cambiaTonalidad && <Aviso tipo="info">Tonalidad probable: <b>{acordeEn(tonalidadSugerida)}</b>. Se pone sola; la puedes cambiar en Detalles.</Aviso>}
              {avisos.map((a, i) => <Aviso key={i} tipo={a.tipo}>{a.texto}</Aviso>)}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5, marginBottom: 8 }}>ORDEN DE LA CANCIÓN</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
            {orden.map((k, i) => <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: colorSeccion(blocks[k]?.label), borderRadius: 12, padding: "3px 9px" }}>{blocks[k]?.label}</span>)}
          </div>
          {Object.entries(blocks).map(([k, b]) => {
            const slides = letra[k] || [];
            const conservada = !nueva && cancion?.blocks?.[k] === b;
            const veces = orden.filter((x) => x === k).length;
            return (
              <div key={k} style={{ background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 2px 10px rgba(22,50,79,0.07)", padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: colorSeccion(b.label), borderRadius: 10, padding: "2px 8px" }}>{b.badge}</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{b.label}</span>
                  {veces > 1 && <span style={{ fontSize: 11, color: "var(--wf-muted)" }}>· se canta {veces} veces</span>}
                  {veces === 0 && <span style={{ fontSize: 11, color: "var(--wf-muted)" }}>· guardada, no está en el orden</span>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: conservada ? "var(--wf-muted)" : "#1F8A73" }}>{conservada ? "sin cambios" : nueva ? "" : "cambió"}</span>
                </div>
                {b.lines.map((l, i) => <LineaConAcordes key={i} linea={l} />)}
                <div style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, color: "var(--wf-muted)" }}>
                  {slides.length === 0 ? "SIN DIAPOSITIVAS (solo para músicos)" : `${slides.length} DIAPOSITIVA${slides.length === 1 ? "" : "S"}${conservada ? " · se quedan como estaban" : ""}`}
                </div>
                {slides.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, marginTop: 6 }}>
                    {slides.map((s, i) => (
                      <div key={i} style={{ aspectRatio: "16/9", background: "#10141B", borderRadius: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 8, boxSizing: "border-box", fontSize: 11, lineHeight: 1.3, fontFamily: "'Fraunces', serif", overflow: "hidden" }}>
                        <div>{s.map((x, j) => <div key={j}>{x}</div>)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 8000, background: "var(--wf-bg)", display: "flex", flexDirection: "column", fontFamily: "'Poppins', sans-serif", color: "var(--wf-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: `1px solid ${C.borde}`, background: "var(--wf-card)", flexShrink: 0 }}>
        <button onClick={onCerrar} aria-label="Cerrar" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--wf-text)", display: "flex", padding: 4 }}><X size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600 }}>{nueva ? "Pegar canción" : "Editar como texto"}</div>
          <div style={{ fontSize: 11.5, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nueva ? "Con o sin acordes · los acordes encima de la letra se acomodan solos" : "Las secciones que no cambies conservan sus diapositivas"}</div>
        </div>
        <button onClick={aplicar} disabled={vacio} style={{ border: "none", borderRadius: 12, padding: "9px 16px", fontWeight: 800, fontSize: 13.5, cursor: vacio ? "not-allowed" : "pointer", opacity: vacio ? 0.4 : 1, background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}><Check size={16} /> Usar esto</button>
      </div>
      {angosto && (
        <div style={{ display: "flex", borderBottom: `1px solid ${C.borde}`, background: "var(--wf-card)", flexShrink: 0 }}>
          {[["escribir", "Escribir", PencilLine], ["vista", "Vista previa", Eye]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => setVista(v)} style={{ flex: 1, padding: "9px 0", border: "none", background: "transparent", cursor: "pointer", fontWeight: 700, fontSize: 13, color: vista === v ? "var(--wf-text)" : "var(--wf-faint)", borderBottom: `2px solid ${vista === v ? "var(--wf-brand-accent)" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}><Icon size={15} /> {label}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {angosto ? (vista === "escribir" ? panelTexto : panelVista) : (
          <>
            {panelTexto}
            <div style={{ width: 1, background: C.borde }} />
            {panelVista}
          </>
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
