// Pestaña "Animación" del editor de canciones (pedido de Eldin, 2026-11-06, etapa 3 de la letra animada):
// se deja preparado desde la edición el estilo de letra animada de la canción, uno distinto por parte si se
// quiere, momentos especiales (ej. palabra gigante en "Santo") y si late al compás de su tempo. En vivo
// cambia solo al pasar de una parte a otra; Multimedia lo puede apagar.
import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, Sparkles } from "lucide-react";
import { ANIMACIONES, GRUPOS_ANIMACION } from "./LetrasAnimadas.jsx";
import { ProjectionPanel } from "../pantallas/proyeccion.jsx";
import { EFECTOS_MOMENTO, normalizarAnimCancion, estiloDeParte } from "../lib/animacionCancion.js";

const etiqueta = { fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" };
const campo = { width: "100%", boxSizing: "border-box", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "8px 10px", fontSize: 13, color: "var(--wf-text)", fontFamily: "inherit" };
const tarjeta = { background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: 14, marginBottom: 12 };

// Lista de estilos agrupada por categoría (un <select>: cómodo en el celular con 100+ estilos).
export function SelectEstilo({ valor, onCambiar, vacio = "Lo que elija Multimedia", incluirNinguna = true, ...resto }) {
  const porGrupo = useMemo(() => GRUPOS_ANIMACION.map((g) => [g, Object.entries(ANIMACIONES).filter(([, a]) => a.grupo === g)]), []);
  return (
    <select value={valor || ""} onChange={(e) => onCambiar(e.target.value || null)} style={campo} {...resto}>
      <option value="">{vacio}</option>
      {incluirNinguna && <option value="ninguna">Sin animación (letra normal)</option>}
      {porGrupo.map(([g, lista]) => (
        <optgroup key={g} label={g}>
          {lista.map(([k, a]) => <option key={k} value={k}>{a.nombre}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

const quitarAcordes = (l) => String(l || "").replace(/\[[^\]]+\]/g, "").replace(/\s{2,}/g, " ").trim();

export default function EditorAnimacionCancion({ draft, setDraft }) {
  const conf = draft.animacion || {};
  const general = conf.general || null;
  const porParte = conf.porParte || {};
  const momentos = conf.momentos || [];
  const claves = Object.keys(draft.blocks || {});
  const [parteVista, setParteVista] = useState(() => claves[0] || null);
  const [vuelta, setVuelta] = useState(0);

  // Mientras se edita se guarda tal cual (un momento a medio escribir no desaparece); al guardar la canción
  // se limpia (ver guardarCancion en lib/canciones.js).
  const cambiar = (patch) => setDraft((d) => ({ ...d, animacion: { ...(d.animacion || {}), ...patch } }));
  const cambiarParte = (k, v) => {
    const nuevo = { ...porParte };
    if (v) nuevo[k] = v; else delete nuevo[k];
    cambiar({ porParte: nuevo });
  };
  const cambiarMomento = (i, patch) => cambiar({ momentos: momentos.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  // Vista previa: la primera diapositiva de la parte elegida, como saldría en la proyección.
  const parte = parteVista && draft.blocks?.[parteVista] ? parteVista : claves[0];
  const lineasVista = useMemo(() => {
    const diap = draft.letra?.[parte]?.find((ls) => (ls || []).some((l) => String(l).trim()));
    const ls = (diap || draft.blocks?.[parte]?.lines || []).map(quitarAcordes).filter(Boolean).slice(0, 2);
    return ls.length ? ls : ["Santo, santo es el Señor", "digno de toda gloria"];
  }, [draft.letra, draft.blocks, parte]);
  const estiloVista = estiloDeParte(normalizarAnimCancion(conf), parte);
  const tempo = Number(draft.tempo) > 0 ? Number(draft.tempo) : null;
  const slideVista = { slideId: `vista-${parte}-${vuelta}`, type: "cancion", lines: lineasVista, blockLabel: draft.blocks?.[parte]?.label || "", songTitle: draft.title || "", tempo, anim: estiloVista || null, momentos, animCompas: !!conf.compas };
  // Momentos especiales también se ven sin estilo propio de la parte (con el de la canción).
  const momentoEnVista = momentos.find((m) => lineasVista.join(" ").toLowerCase().includes(String(m.palabra).toLowerCase()));

  return (
    <div>
      <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Prepara aquí cómo se anima la letra de esta canción. En vivo cambia sola al pasar de una parte a otra, y Multimedia siempre la puede cambiar o apagar. Para un evento en particular también se puede cambiar desde el Setlist.
      </div>

      {/* Vista previa */}
      <div style={tarjeta}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={etiqueta}>Vista previa</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {claves.length > 1 && (
              <select aria-label="Parte para la vista previa" value={parte || ""} onChange={(e) => { setParteVista(e.target.value); setVuelta((v) => v + 1); }} style={{ ...campo, width: "auto", padding: "5px 8px", fontSize: 12 }}>
                {claves.map((k) => <option key={k} value={k}>{draft.blocks[k].label || k}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setVuelta((v) => v + 1)} style={{ ...campo, width: "auto", padding: "5px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 600 }}><RotateCcw size={13} /> Repetir</button>
          </div>
        </div>
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", display: "flex", background: "#000" }}>
          <ProjectionPanel key={slideVista.slideId} slide={slideVista} blanked={false} split={false} liveStyle={{ animPorCancion: true }} />
        </div>
        {!estiloVista && (
          <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginTop: 8 }}>
            {momentoEnVista ? "Los momentos especiales se ven con letra animada: elige un estilo para la canción o para esta parte." : "Esta parte usará lo que elija Multimedia en vivo."}
          </div>
        )}
      </div>

      {/* Estilo de la canción */}
      <div style={tarjeta}>
        <div style={{ ...etiqueta, display: "flex", alignItems: "center", gap: 5 }}><Sparkles size={12} />Estilo de la canción</div>
        <SelectEstilo aria-label="Estilo de la canción" valor={general} onCambiar={(v) => { cambiar({ general: v }); setVuelta((x) => x + 1); }} />
        <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginTop: 6 }}>Se usa en todas las partes, salvo las que cambies abajo.</div>
      </div>

      {/* Por parte */}
      {claves.length > 0 && (
        <div style={tarjeta}>
          <div style={etiqueta}>Un estilo distinto por parte</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {claves.map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--wf-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>{draft.blocks[k].badge}</span>
                <span style={{ fontSize: 13, width: 110, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.blocks[k].label}</span>
                <SelectEstilo aria-label={`Estilo de ${draft.blocks[k].label}`} valor={porParte[k] || null} vacio="Igual que la canción"
                  onCambiar={(v) => { cambiarParte(k, v); setParteVista(k); setVuelta((x) => x + 1); }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Momentos especiales */}
      <div style={tarjeta}>
        <div style={etiqueta}>Momentos especiales</div>
        <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 10 }}>Cuando sale esa palabra o frase en la letra: la palabra en grande, que brille, un destello o un efecto de pantalla.</div>
        {momentos.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <input aria-label="Palabra o frase" value={m.palabra} onChange={(e) => cambiarMomento(i, { palabra: e.target.value })} placeholder="Ej. Santo" style={{ ...campo, flex: "1 1 140px", width: "auto" }} />
            <select aria-label="Efecto" value={m.efecto} onChange={(e) => cambiarMomento(i, { efecto: e.target.value })} style={{ ...campo, flex: "1 1 160px", width: "auto" }}>
              {EFECTOS_MOMENTO.map((ef) => <option key={ef.clave} value={ef.clave}>{ef.nombre}</option>)}
            </select>
            <button type="button" aria-label="Quitar momento" onClick={() => cambiar({ momentos: momentos.filter((_, j) => j !== i) })} style={{ background: "none", border: "none", color: "#C23B32", cursor: "pointer", padding: 6 }}><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" onClick={() => setDraft((d) => ({ ...d, animacion: { ...(d.animacion || {}), momentos: [...((d.animacion || {}).momentos || []), { palabra: "", efecto: "gigante" }] } }))}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#2F5FA8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <Plus size={14} /> Agregar momento
        </button>
      </div>

      {/* Ritmo */}
      <div style={tarjeta}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={!!conf.compas} onChange={(e) => cambiar({ compas: e.target.checked })} style={{ accentColor: "#E8821E", marginTop: 3 }} />
          <span>
            <b>Latir al compás</b>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--wf-muted)" }}>
              {tempo ? `La letra late con el tempo de la canción (${tempo} BPM). En vivo se puede recalibrar con el tap tempo.` : "Ponle el tempo (BPM) en Detalles para que la letra lata a su ritmo."}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
