// Canciones: biblioteca, vista de la canción (acordes, Modo Músico), editor y sus ventanas. Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState, useMemo, useRef, useEffect } from "react";
import { buscarCanciones } from "../lib/busqueda.js";
import { FileUp, Plus, Search, Heart, Pencil, Paperclip, Trash2, ListMusic, Music, Minus, FileText, Image as ImgIcon, Link2, ArrowLeft, ChevronDown, Radio, Pause, Users, Play, PencilLine, ChevronLeft, ChevronRight, RefreshCw, X, Check, ClipboardPaste, GripVertical, ChevronUp, Lock } from "lucide-react";
import { usePlan, permite, abrirPlanes } from "../lib/planes.js";
import { acordeEn, usePreferencias, lineaEn } from "../lib/preferencias.js";
import { confirmDialog } from "../lib/confirm.js";
import { listarAdjuntos, tipoDeArchivo, subirAdjunto, agregarEnlace, borrarAdjunto } from "../lib/adjuntosCancion.js";
import { notifyError, showToast } from "../lib/toast.js";
import { supabase } from "../lib/supabaseClient.js";
import { cargarNotas, guardarNota, DUENO_EQUIPO } from "../lib/notasSeccion.js";
import { clearMusicoLive } from "../lib/musicoLive.js";
import { useArrastreLista } from "../lib/arrastreLista.js";
import EditorAnimacionCancion from "../components/EditorAnimacionCancion.jsx";
import EditorTextoCancion from "../components/EditorTextoCancion.jsx";
import { NOTES, iconGhost, ModalShell, inputStyle, addBtnStyle, primaryBtn, clasificacionesActuales, transposeLine, semitoneShift, transposeChordToken, Field } from "./compartido.jsx";

// Agrupa un array plano ['v1','c','v2','c'] en entradas con conteo consecutivo [{key:'v1',count:1},{key:'c',count:1}...]
function groupConsecutive(flat) {
  const out = [];
  flat.forEach((k) => {
    const last = out[out.length - 1];
    if (last && last.key === k) last.count += 1;
    else out.push({ key: k, count: 1 });
  });
  return out;
}

function expandEntries(entries) {
  const out = [];
  entries.forEach((e) => { for (let i = 0; i < e.count; i++) out.push(e.key); });
  return out;
}

function diatonicChords(keyStr) {
  if (!keyStr) return [];
  const isMinor = keyStr.endsWith("m");
  const root = isMinor ? keyStr.slice(0, -1) : keyStr;
  const rootIdx = NOTES.indexOf(root);
  if (rootIdx === -1) return [];
  const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  // 'dom' = quinto grado mayor (dominante) en tonalidad mayor -> 7ma dominante, no maj7
  const qualities = isMinor ? ["min", "dim", "maj", "min", "min", "maj", "maj"] : ["maj", "min", "min", "maj", "dom", "min", "dim"];
  const romans = isMinor ? ["i", "ii°", "III", "iv", "v", "VI", "VII"] : ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  return intervals.map((iv, i) => {
    const note = NOTES[(rootIdx + iv) % 12];
    const q = qualities[i];
    const triadSuffix = q === "min" ? "m" : q === "dim" ? "dim" : ""; // maj y dom son triadas mayores (sin sufijo)
    const sevenSuffix = q === "maj" ? "maj7" : q === "min" ? "m7" : q === "dom" ? "7" : "m7b5";
    return { roman: romans[i], chord: `${note}${triadSuffix}`, chord7: `${note}${sevenSuffix}` };
  });
}

// Todos los acordes útiles de una tonalidad, en grupos, para la barra del editor: una sola fila que
// se desliza hacia la derecha, en vez de alternar entre "Triadas" y "Con séptima". Además de los
// diatónicos trae los que más se usan en alabanza: suspendidos, con bajo (inversiones) y prestados.
function acordesDeTonalidad(keyStr) {
  const diat = diatonicChords(keyStr);
  if (diat.length === 0) return [];
  const isMinor = keyStr.endsWith("m");
  const rootIdx = NOTES.indexOf(isMinor ? keyStr.slice(0, -1) : keyStr);
  const n = (iv) => NOTES[(rootIdx + iv) % 12];
  const grupos = [
    { titulo: "Triadas", acordes: diat.map((c) => ({ chord: c.chord, grado: c.roman })) },
    { titulo: "Séptimas", acordes: diat.map((c) => ({ chord: c.chord7, grado: `${c.roman}7` })) },
  ];
  if (isMinor) {
    grupos.push(
      { titulo: "Suspendidos", acordes: [{ chord: `${n(0)}sus2`, grado: "isus2" }, { chord: `${n(0)}sus4`, grado: "isus4" }, { chord: `${n(7)}sus4`, grado: "Vsus4" }] },
      { titulo: "Con bajo", acordes: [{ chord: `${n(0)}m/${n(3)}`, grado: "i/3" }, { chord: `${n(8)}/${n(0)}`, grado: "VI/1" }, { chord: `${n(10)}/${n(2)}`, grado: "VII/2" }] },
      { titulo: "Dominante", acordes: [{ chord: n(7), grado: "V" }, { chord: `${n(7)}7`, grado: "V7" }] },
    );
  } else {
    grupos.push(
      { titulo: "Suspendidos", acordes: [{ chord: `${n(0)}sus2`, grado: "Isus2" }, { chord: `${n(0)}sus4`, grado: "Isus4" }, { chord: `${n(5)}sus2`, grado: "IVsus2" }, { chord: `${n(7)}sus4`, grado: "Vsus4" }, { chord: `${n(0)}add9`, grado: "Iadd9" }] },
      { titulo: "Con bajo", acordes: [{ chord: `${n(0)}/${n(4)}`, grado: "I/3" }, { chord: `${n(7)}/${n(11)}`, grado: "V/7" }, { chord: `${n(5)}/${n(9)}`, grado: "IV/6" }, { chord: `${n(9)}m/${n(7)}`, grado: "vi/5" }, { chord: `${n(5)}/${n(7)}`, grado: "IV/5" }] },
      { titulo: "Prestados", acordes: [{ chord: n(10), grado: "♭VII" }, { chord: n(8), grado: "♭VI" }, { chord: `${n(5)}m`, grado: "iv" }, { chord: n(2), grado: "II" }, { chord: n(4), grado: "III" }] },
    );
  }
  return grupos;
}

const KEY_OPTIONS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"];

// Si el líder no manda un "sigo aquí" (heartbeat, o cualquier acción — ambos tocan la columna heartbeat)
// en más de esto, se da por perdido: el siguiente que toque "Modo Músico" puede tomar el mando sin
// quedar nadie bloqueado a mitad de un culto. 10s (el valor original) era demasiado poco — un músico
// que se sale un instante sin querer (toca "atrás", el teléfono se bloquea solo, cambia de app un
// segundo) ya alcanzaba a marcar al líder como "caído" y exponía el botón para que cualquier otro
// tomara el mando por error, aunque el líder de verdad volviera enseguida. Con más margen, mientras
// tanto todos quedan simplemente pausados en su sección actual (ver "leaderStale" en SongView) sin
// que nadie tome el mando solo, y si el líder vuelve antes de este tiempo, nada se movió ni cambió.
const MUSICO_LEADER_STALE_MS = 25000;

function isMusicoLeaderFresh(musicoState) {
  return !!(musicoState?.liderId && musicoState?.heartbeat && Date.now() - new Date(musicoState.heartbeat).getTime() < MUSICO_LEADER_STALE_MS);
}

const nextSongId = () => crypto.randomUUID();

// ---------------- CANCIONES: LISTA ----------------
export function CancionesList({ library, clasificaciones, puedeConfigurarClasificaciones, onGuardarClasificaciones, isAdminViewer, onToggleFavorite, onOpen, onNew, onImportarPdf, onDelete }) {
  const [query, setQuery] = useState("");
  // "todos" + las clasificaciones de ESTA iglesia. "sin" (Sin clasificar) solo aparece si hay
  // canciones cuya clasificación ya no existe (ej. la borraron), para que no queden escondidas.
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [showClasificaciones, setShowClasificaciones] = useState(false);
  const claves = new Set(clasificaciones.map((c) => c.clave));
  const haySinClasificar = library.some((s) => !claves.has(s.category));
  const enFiltro = (s, key) => key === "todos" || (key === "favoritas" ? s.favorite : key === "sin" ? !claves.has(s.category) : s.category === key);
  // Búsqueda tolerante (sin tildes, en cualquier orden, con faltas de ortografía) — ver lib/busqueda.js.
  const filtered = useMemo(() => buscarCanciones(library.filter((s) => enFiltro(s, categoryFilter)), query), [library, categoryFilter, query, clasificaciones]);
  // Barra de clasificaciones (2026-10-10): cada chip dice cuántas canciones tiene, "Favoritas" va
  // fija al inicio, el borde se difumina cuando hay más a la derecha, y la elegida se trae a la vista.
  const filtros = [
    ["todos", "Todos"],
    ...(library.some((s) => s.favorite) || categoryFilter === "favoritas" ? [["favoritas", "Favoritas"]] : []),
    ...clasificaciones.map((c) => [c.clave, c.nombre]),
    ...(haySinClasificar ? [["sin", "Sin clasificar"]] : []),
  ].map(([key, label]) => ({ key, label, total: library.filter((s) => enFiltro(s, key)).length }));
  const barraRef = useRef(null);
  const [bordes, setBordes] = useState({ izq: false, der: false });
  const medirBordes = () => {
    const el = barraRef.current;
    if (!el) return;
    setBordes({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    medirBordes();
    window.addEventListener("resize", medirBordes);
    return () => window.removeEventListener("resize", medirBordes);
  }, [clasificaciones.length]);
  useEffect(() => {
    barraRef.current?.querySelector(`[data-filtro="${categoryFilter}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [categoryFilter]);
  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 22, margin: 0 }}>{library.length} Canciones</h2>
        {isAdminViewer && (
          <div style={{ display: "flex", gap: 8 }}>
            {onImportarPdf && (
              <button onClick={onImportarPdf} title="Importar canciones desde PDF" style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 10, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", color: "var(--wf-text)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <FileUp size={14} /> Importar PDF
              </button>
            )}
            <button data-tour="canciones-nueva" onClick={onNew} style={{ ...iconGhost, width: 30, height: 30, background: "var(--wf-hover)", border: "1px solid var(--wf-border)" }}><Plus size={16} /></button>
          </div>
        )}
      </div>
      <div data-tour="canciones-buscar" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>
        <Search size={15} color="var(--wf-faint)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título o letra" style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 13, width: "100%" }} />
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div ref={barraRef} onScroll={medirBordes} data-tour="canciones-filtros" className="chordbar-scroll" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 4px", scrollbarWidth: "none" }}>
          {filtros.map(({ key, label, total }) => {
            const activo = categoryFilter === key;
            return (
              <button
                key={key} data-filtro={key} onClick={() => setCategoryFilter(key)} aria-pressed={activo}
                style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 20, cursor: "pointer",
                  border: activo ? "1px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)",
                  background: activo ? "var(--wf-brand-accent)" : "var(--wf-card)", color: activo ? "var(--wf-brand-primary)" : "var(--wf-text)" }}
              >
                {key === "favoritas" && <Heart size={12} fill={activo ? "currentColor" : "none"} />}
                {label}
                <span style={{ fontSize: 11, fontWeight: 600, opacity: activo ? 0.85 : 0.55 }}>{total}</span>
              </button>
            );
          })}
          {puedeConfigurarClasificaciones && (
            <button onClick={() => setShowClasificaciones(true)} title="Editar clasificaciones" aria-label="Editar clasificaciones" style={{ flexShrink: 0, width: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 20, border: "1px dashed var(--wf-border)", background: "transparent", color: "var(--wf-muted)", cursor: "pointer" }}>
              <Pencil size={13} />
            </button>
          )}
        </div>
        {/* Difuminado en los bordes: avisa que hay más chips para deslizar. */}
        {bordes.izq && <div aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 4, width: 28, pointerEvents: "none", background: "linear-gradient(to left, transparent, var(--wf-bg))" }} />}
        {bordes.der && <div aria-hidden style={{ position: "absolute", right: 0, top: 0, bottom: 4, width: 40, pointerEvents: "none", background: "linear-gradient(to right, transparent, var(--wf-bg))" }} />}
      </div>
      {showClasificaciones && (
        <ClasificacionesModal
          clasificaciones={clasificaciones}
          library={library}
          onClose={() => setShowClasificaciones(false)}
          onGuardar={async (lista) => { await onGuardarClasificaciones(lista); setShowClasificaciones(false); if (!lista.some((c) => c.clave === categoryFilter)) setCategoryFilter("todos"); }}
        />
      )}
      {filtered.map((s) => (
        <div key={s.id} onClick={() => onOpen(s.id)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>{s.artist || "Unknown"}</div>
          </div>
          {s.hasAttachment && <Paperclip size={15} color="var(--wf-faint)" />}
          <span style={{ fontSize: 11, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 20, padding: "3px 10px", color: "var(--wf-text-2)" }}>{acordeEn(s.key)}</span>
          <span style={{ fontSize: 11, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 20, padding: "3px 10px", color: "var(--wf-text-2)" }}>{s.tempo} bpm</span>
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(s.id); }} style={iconGhost}><Heart size={16} color={s.favorite ? "#C23B32" : "var(--wf-faint)"} fill={s.favorite ? "#C23B32" : "none"} /></button>
          {isAdminViewer && <button onClick={(e) => { e.stopPropagation(); onDelete(s); }} style={iconGhost}><Trash2 size={16} color="var(--wf-faint)" /></button>}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>No hay canciones que coincidan con la búsqueda.</div>}
    </div>
  );
}

// Editor de las clasificaciones de canción de la iglesia — a propósito una sola lista corta (nombre +
// bloque del Setlist), sin más opciones, para que configurarlo tome segundos. Se abre desde el botón
// "Editar" junto a los filtros de Canciones, donde el administrador ve el resultado al instante.
function ClasificacionesModal({ clasificaciones, library, onClose, onGuardar }) {
  const [lista, setLista] = useState(() => clasificaciones.map((c) => ({ ...c })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (i, campo, valor) => setLista((l) => l.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  const quitar = async (i) => {
    const c = lista[i];
    const usadas = library.filter((s) => s.category === c.clave).length;
    if (usadas > 0 && !(await confirmDialog(`${usadas} canción(es) tienen "${c.nombre || "esta clasificación"}". Si la quitas, quedarán como "Sin clasificar" hasta que les pongas otra. ¿Quitarla?`, { danger: true, textoConfirmar: "Quitar" }))) return;
    setLista((l) => l.filter((_, j) => j !== i));
  };
  const agregar = () => setLista((l) => [...l, { clave: `c_${Date.now().toString(36)}`, nombre: "", bloque: l[l.length - 1]?.bloque || "Alabanza" }]);
  const guardar = async () => {
    const limpia = lista.map((c) => ({ clave: c.clave, nombre: (c.nombre || "").trim(), bloque: (c.bloque || "").trim() }));
    if (limpia.length === 0) { setError("Deja al menos una clasificación."); return; }
    if (limpia.some((c) => !c.nombre)) { setError("Ponle nombre a cada clasificación (o quita las vacías)."); return; }
    setBusy(true); setError("");
    try { await onGuardar(limpia); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <ModalShell title="Clasificaciones" icon={ListMusic} color="var(--wf-brand-accent)" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 12 }}>
        Cómo agrupa tu iglesia sus canciones, y a qué bloque del Setlist va cada una al agregarla.
      </div>
      <div style={{ display: "flex", fontSize: 10, fontWeight: 700, color: "var(--wf-faint)", textTransform: "uppercase", gap: 6, marginBottom: 4 }}>
        <span style={{ flex: 1 }}>Nombre</span><span style={{ flex: 1 }}>Va al bloque</span><span style={{ width: 24 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {lista.map((c, i) => (
          <div key={c.clave} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input value={c.nombre} onChange={(e) => cambiar(i, "nombre", e.target.value)} placeholder="Ej. Himno" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
            <input value={c.bloque} onChange={(e) => cambiar(i, "bloque", e.target.value)} placeholder="Al final" style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
            <button type="button" onClick={() => quitar(i)} title="Quitar" style={iconGhost}><Trash2 size={14} color="var(--wf-faint)" /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={agregar} className="hoverable" style={{ ...addBtnStyle, justifyContent: "center", marginBottom: 8 }}><Plus size={14} /> Agregar clasificación</button>
      <div style={{ fontSize: 11, color: "var(--wf-faint)", marginBottom: 12 }}>Si dejas el bloque vacío, la canción se agrega al final del Setlist.</div>
      {error && <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 8 }}>{error}</div>}
      <button type="button" onClick={guardar} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
    </ModalShell>
  );
}

// ---------------- CANCIONES: EDITOR ----------------
function blankSong() {
  return { id: nextSongId(), title: "", tempo: "", compas: "", key: "", artist: "", themes: "", category: clasificacionesActuales[0]?.clave || "corito", favorite: false, hasAttachment: false, defaultStructure: [], blocks: {}, letra: {} };
}

function parseChordLine(raw) {
  let plain = "";
  const positions = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(raw)) !== null) {
    plain += raw.slice(lastIndex, match.index);
    positions.push({ index: plain.length, chord: match[1] });
    lastIndex = regex.lastIndex;
  }
  plain += raw.slice(lastIndex);
  return { plain, positions };
}

function buildChordRow(positions) {
  let row = "";
  positions.forEach(({ index, chord }) => {
    while (row.length < index) row += " ";
    row += `${chord} `;
  });
  return row;
}

// Antes esto armaba UNA sola l\u00EDnea monoespaciada por rengl\u00F3n (acordes arriba, letra abajo, alineados
// por car\u00E1cter con espacios de relleno) \u2014 perfecto para alinear, pero una l\u00EDnea larga nunca se
// achicaba: en el celular se sal\u00EDa del cuadro y quedaba cortada. Tocando en vivo (guitarra/bajo/piano)
// nadie puede estar arrastrando el dedo para ver el resto de cada l\u00EDnea. La soluci\u00F3n real es la que
// usan las apps de acordes (OnSong, Ultimate Guitar): partir la l\u00EDnea en PALABRAS, cada una con su
// propio acorde encima como una unidad chica independiente, y dejar que esas unidades se acomoden en
// varios renglones (flexWrap) seg\u00FAn el ancho real de la pantalla \u2014 el acorde nunca se separa de su
// palabra aunque el conjunto salte de l\u00EDnea, y no hace falta deslizar nada.
function ChordsAboveLyrics({ raw, semitones = 0 }) {
  // Do-Re-Mi o C-D-E según lo que eligió cada quien en Ajustes → Apariencia (solo cambia lo que se ve).
  const { notacion } = usePreferencias();
  const transposed = lineaEn(transposeLine(raw, semitones), notacion);
  const tokens = transposed.split(/(\s+)/).filter((t) => t !== "" && !/^\s+$/.test(t));
  if (tokens.length === 0) {
    return <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, marginBottom: 10, minHeight: "2.6em" }}>&nbsp;</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 6, marginBottom: 10 }}>
      {tokens.map((token, i) => {
        const { plain, positions } = parseChordLine(token);
        const chordRow = buildChordRow(positions);
        return (
          <span key={i} style={{ display: "inline-flex", flexDirection: "column", marginRight: "0.5em", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre", fontSize: 13 }}>
            <span style={{ color: "#1F8A73", fontWeight: 700, minHeight: "1.3em" }}>{chordRow || "\u00A0"}</span>
            <span style={{ color: "var(--wf-text)" }}>{plain || "\u00A0"}</span>
          </span>
        );
      })}
    </div>
  );
}

function badgeColor(badge) {
  const b = (badge || "").toUpperCase();
  if (b.startsWith("IN")) return "#1F8A73"; // Intro/Instrumental (ambas sin letra): teal
  if (b.startsWith("PC")) return "#2F5FA8"; // Pre-coro: azul (chequeado ANTES que Puente, ya que "PC" también empieza con "P")
  if (b.startsWith("C")) return "#D98A54"; // Coro: durazno
  if (b.startsWith("P")) return "#B15EA0"; // Puente: orquídea
  if (b.startsWith("O") || b.startsWith("F")) return "#5661B3"; // Outro/Final (ambas de cierre): índigo
  return "#2E86AB"; // Estrofas y cualquier otro badge personalizado: celeste
}

// Catálogo de tipos de sección para "Añadir secciones" (estilo OnStage) — cada tipo puede repetirse
// (Estrofa 1, Estrofa 2...); el prefijo arma el badge numerado (V1, C2...). El color sale de
// badgeColor() con el prefijo, así el catálogo y las tarjetas ya agregadas siempre coinciden.
// Compases más usados, el primero es el más común. Opcional en cada canción.
const COMPASES = ["4/4", "3/4", "6/8", "2/4", "12/8", "2/2", "5/4", "7/8"];

// Tiempos por compás para el auto-avance por BPM. En 6/8 y 12/8 el pulso se cuenta en negra con
// puntillo (2 y 4 tiempos), que es como se marca el BPM en la práctica. Sin compás: 4, como siempre.
function tiemposPorCompas(compas) {
  const m = String(compas || "").match(/^(\d+)\/(\d+)$/);
  if (!m) return 4;
  const num = parseInt(m[1], 10), den = parseInt(m[2], 10);
  return den === 8 && num % 3 === 0 ? num / 3 : num;
}

const SECTION_TYPES = [
  { id: "estrofa", label: "Estrofa", prefix: "V" },
  { id: "precoro", label: "Pre-coro", prefix: "PC" },
  { id: "coro", label: "Coro", prefix: "C" },
  { id: "puente", label: "Puente", prefix: "P" },
  { id: "intro", label: "Intro", prefix: "IN" },
  { id: "outro", label: "Outro", prefix: "O" },
  { id: "final", label: "Final", prefix: "F" },
  { id: "instrumental", label: "Instrumental", prefix: "INS" },
];

// Clave de sessionStorage donde SongView guarda la cejilla de cada canción, songId → traste (ver ahí).
// Nombre distinto al de la versión anterior ("wf-cejilla", un solo número global) para no leer ese formato.
const CEJILLA_SESSION_KEY = "wf-cejilla-por-cancion";

// Selector de tonalidad + cejilla — reemplaza al viejo <select> de transportar + la caja de Capo
// separada. Una sola pantalla para las dos capas: la raíz (letra natural + ♭/♯, el modo mayor/menor
// SIEMPRE se conserva del original, nunca se ofrece cambiarlo — tocar una tonalidad menor en otra
// tonalidad sigue siendo menor) y la cejilla (traste físico, siempre ≥0 — ya NO es un "transportador"
// con signo negativo como el Capo viejo). Quién puede tocar "Guardar" y qué hace ese guardado
// depende de dónde se abrió este modal — ver SongView, que decide puedeCambiarPermanente/Local.
function TonalidadModal({ song, displayedKey, cejilla, setCejilla, cejillaResultKey, puedeCambiarPermanente, puedeCambiarLocal, onClose, onGuardarPermanente, onGuardarLocal }) {
  const isMinorKey = song.key.endsWith("m");
  const parsed = displayedKey.match(/^([A-G])(#|b)?/);
  const [letra, setLetra] = useState(parsed?.[1] || "C");
  const [alteracion, setAlteracion] = useState(parsed?.[2] || null);
  const puedeCambiarRoot = puedeCambiarPermanente || puedeCambiarLocal;
  const nuevaTonalidad = `${letra}${alteracion || ""}${isMinorKey ? "m" : ""}`;
  const guardar = () => {
    if (puedeCambiarPermanente) onGuardarPermanente(nuevaTonalidad);
    else if (puedeCambiarLocal) onGuardarLocal(nuevaTonalidad);
  };
  const LETRAS = ["C", "D", "E", "F", "G", "A", "B"];
  const activeStyle = { background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)" };
  const inactiveStyle = { background: "var(--wf-hover)", color: "var(--wf-text)" };
  return (
    <ModalShell title="Cambiar tonalidad" icon={Music} color="var(--wf-brand-accent)" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 12 }}>Original {acordeEn(song.key)}</div>

      {puedeCambiarRoot ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {LETRAS.map((l) => (
              <button key={l} onClick={() => setLetra(l)} className="hoverable" style={{ flex: "1 1 36px", padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, ...(letra === l ? activeStyle : inactiveStyle) }}>
                {acordeEn(l)}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--wf-border)", marginBottom: 16 }}>
            <button onClick={() => setAlteracion(alteracion === "b" ? null : "b")} style={{ flex: 1, padding: "9px 0", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, ...(alteracion === "b" ? activeStyle : inactiveStyle) }}>♭</button>
            <button onClick={() => setAlteracion(alteracion === "#" ? null : "#")} style={{ flex: 1, padding: "9px 0", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, ...(alteracion === "#" ? activeStyle : inactiveStyle) }}>♯</button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          {acordeEn(displayedKey)} <span style={{ fontWeight: 400, color: "var(--wf-faint)", fontSize: 11 }}>— solo un administrador puede cambiar la tonalidad desde la biblioteca (sería permanente)</span>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-faint)", marginBottom: 6, textTransform: "uppercase" }}>Cejilla</div>
      <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 8 }}>En qué traste pones el capo — 0 es sin capo. Solo cambia lo que TÚ ves, solo en esta canción, y se recuerda hasta que cierres la app.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 8px", marginBottom: 16 }}>
        <button onClick={() => setCejilla((c) => Math.max(0, c - 1))} className="hoverable" style={{ ...iconGhost, width: 28, height: 28 }}><Minus size={14} /></button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{cejilla}{cejillaResultKey ? ` (${acordeEn(cejillaResultKey)})` : ""}</span>
        <button onClick={() => setCejilla((c) => Math.min(11, c + 1))} className="hoverable" style={{ ...iconGhost, width: 28, height: 28 }}><Plus size={14} /></button>
      </div>

      {puedeCambiarRoot && <button onClick={guardar} style={primaryBtn}>Guardar</button>}
    </ModalShell>
  );
}

// Adjuntos de la canción (PDF, imágenes y enlaces) — ver src/lib/adjuntosCancion.js. Todos los de la
// iglesia los ven y los abren; agregan/quitan solo quienes pueden notas "para todos" (puedeEditar).
function AdjuntosModal({ song, iglesiaId, puedeEditar, onClose, onCambio }) {
  const [adjuntos, setAdjuntos] = useState(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [modoEnlace, setModoEnlace] = useState(false);
  const [enlace, setEnlace] = useState("");
  const [tituloEnlace, setTituloEnlace] = useState("");
  const inputArchivoRef = useRef(null);
  useEffect(() => {
    let vivo = true;
    listarAdjuntos(song.id).then((r) => { if (vivo) setAdjuntos(r); }).catch(() => { if (vivo) { setAdjuntos([]); setErrorCarga(true); } });
    return () => { vivo = false; };
  }, [song.id]);
  const actualizar = (lista) => { setAdjuntos(lista); onCambio?.(lista.length > 0); };
  const elegirArchivos = async (e) => {
    const archivos = [...(e.target.files || [])];
    e.target.value = "";
    if (!archivos.length) return;
    if (!iglesiaId) { notifyError("No se pudo identificar tu iglesia. Vuelve a abrir la app."); return; }
    setSubiendo(true);
    let lista = adjuntos || [];
    for (const file of archivos) {
      if (!tipoDeArchivo(file)) { notifyError(`"${file.name}" no es PDF ni imagen.`); continue; }
      try {
        const nuevo = await subirAdjunto({ iglesiaId, cancionId: song.id, file });
        lista = [...lista, nuevo];
        actualizar(lista);
      } catch (err) {
        notifyError(err?.message ? `No se pudo subir "${file.name}": ${err.message}` : `No se pudo subir "${file.name}".`);
      }
    }
    setSubiendo(false);
  };
  const guardarEnlace = async () => {
    setSubiendo(true);
    try {
      const nuevo = await agregarEnlace({ cancionId: song.id, url: enlace, titulo: tituloEnlace });
      actualizar([...(adjuntos || []), nuevo]);
      setEnlace(""); setTituloEnlace(""); setModoEnlace(false);
    } catch (err) {
      notifyError(err?.message || "No se pudo guardar el enlace.");
    }
    setSubiendo(false);
  };
  const quitar = async (a) => {
    if (!(await confirmDialog(`¿Quitar "${a.titulo}" de esta canción?`, { danger: true, textoConfirmar: "Quitar" }))) return;
    try {
      await borrarAdjunto(a);
      actualizar((adjuntos || []).filter((x) => x.id !== a.id));
    } catch (err) {
      notifyError(err?.message || "No se pudo quitar.");
    }
  };
  const abrir = (a) => window.open(a.url, "_blank", "noopener");
  const iconoDe = (tipo) => (tipo === "pdf" ? FileText : tipo === "imagen" ? ImgIcon : Link2);
  const colorDe = (tipo) => (tipo === "pdf" ? "#C23B32" : tipo === "imagen" ? "#B15EA0" : "#2F5FA8");
  const campo = { width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid var(--wf-border)", background: "var(--wf-bg)", color: "var(--wf-text)", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", marginBottom: 8, outline: "none" };
  const botonAgregar = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "10px 4px", fontSize: 12, fontWeight: 700, color: "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" };
  return (
    <ModalShell title="Adjuntos" icon={Paperclip} color="var(--wf-brand-accent)" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 12 }}>{song.title}</div>
      {adjuntos === null ? (
        <div style={{ fontSize: 13, color: "var(--wf-faint)", padding: "12px 0" }}>Cargando…</div>
      ) : adjuntos.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--wf-faint)", padding: "8px 0 14px" }}>
          {errorCarga ? "No se pudieron cargar los adjuntos." : puedeEditar ? "Todavía no hay nada. Agrega partituras, cifrados, fotos o enlaces (YouTube, Drive…)." : "Esta canción no tiene adjuntos."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {adjuntos.map((a) => {
            const Icono = iconoDe(a.tipo);
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--wf-bg)", borderRadius: 12, padding: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <button onClick={() => abrir(a)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--wf-text)", fontFamily: "inherit" }}>
                  {a.tipo === "imagen" ? (
                    <img src={a.url} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "var(--wf-hover)" }} />
                  ) : (
                    <span style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${colorDe(a.tipo)}1A` }}><Icono size={20} color={colorDe(a.tipo)} /></span>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--wf-faint)" }}>{a.tipo === "pdf" ? "PDF" : a.tipo === "imagen" ? "Imagen" : "Enlace"} · tocar para abrir</span>
                  </span>
                </button>
                {puedeEditar && (
                  <button onClick={() => quitar(a)} title="Quitar" style={{ ...iconGhost, width: 32, height: 32 }}><Trash2 size={15} color="#C23B32" /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {puedeEditar && (
        modoEnlace ? (
          <div>
            <input autoFocus type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="Pega el enlace (YouTube, Drive, Spotify…)" style={campo} />
            <input value={tituloEnlace} onChange={(e) => setTituloEnlace(e.target.value)} placeholder="Nombre (opcional) — ej. Video del ensayo" style={campo} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setModoEnlace(false); setEnlace(""); setTituloEnlace(""); }} style={{ ...primaryBtn, flex: 1, background: "var(--wf-hover)", color: "var(--wf-text)" }}>Cancelar</button>
              <button onClick={guardarEnlace} disabled={subiendo || !enlace.trim()} style={{ ...primaryBtn, flex: 1, opacity: subiendo || !enlace.trim() ? 0.6 : 1 }}>{subiendo ? "Guardando…" : "Agregar"}</button>
            </div>
          </div>
        ) : (
          <>
            <input ref={inputArchivoRef} type="file" multiple accept="application/pdf,.pdf,image/*" onChange={elegirArchivos} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={subiendo} onClick={() => inputArchivoRef.current?.click()} style={botonAgregar}><FileText size={18} color="#C23B32" />PDF o imagen</button>
              <button disabled={subiendo} onClick={() => setModoEnlace(true)} style={botonAgregar}><Link2 size={18} color="#2F5FA8" />Enlace</button>
            </div>
            {subiendo && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 10, textAlign: "center" }}>Subiendo…</div>}
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 10, textAlign: "center" }}>Hasta 20 MB por archivo. Puedes elegir varios a la vez.</div>
          </>
        )
      )}
    </ModalShell>
  );
}

export function SongView({ song, isAdminViewer, mode = "biblioteca", onBack, onEdit, onTranspose, onDelete, onPrev, onNext, prevTitle, nextTitle, positionLabel, enterDirection, structureOverride, liveSync, iglesiaId, notasCtx, onAdjuntosChange }) {
  const modoMusicoPermitido = permite(usePlan(), "modo_musico");
  const sectionRefs = useRef({});
  const [showAdjuntos, setShowAdjuntos] = useState(false);
  // Ref aparte, por POSICIÓN en el orden (no por clave de sección): si una sección se repite (V1, V2,
  // V1, Coro...) sectionRefs solo guarda la primera aparición (para los pills de arriba, que son un
  // índice de secciones únicas) — pero el auto-avance de Modo Músico necesita saber a cuál repetición
  // exacta saltar, así que usa este mapa indexado por posición.
  const indexRefs = useRef({});
  const containerRef = useRef(null);
  // Cada canción nueva es un montaje fresco (key distinto en el sitio donde se usa <SongView>), pero el
  // contenedor que hace scroll de verdad es un ancestro que NO se remonta — así que si veníamos con la
  // anterior desplazada hasta el final, la canción siguiente arrancaba también abajo del todo en vez de
  // arriba. Se sube ese ancestro a mano (no con scrollIntoView: esta misma raíz lleva la animación de
  // deslizar entre canciones con transform: translateX, y scrollIntoView calcula la posición CON ese
  // transform aplicado — a mitad de la animación podía terminar calculando mal y no subir del todo).
  useEffect(() => {
    let el = containerRef.current?.parentElement;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight) { el.scrollTop = 0; break; }
      el = el.parentElement;
    }
  }, []);
  const pointerStartRef = useRef(null);
  const draggingRef = useRef(false); // true una vez que el gesto se confirmó horizontal (no scroll vertical)
  // Efecto "galería de fotos": mientras se arrastra, el contenido sigue al dedo en tiempo real (sin
  // transición, dragX se mueve 1 a 1 con el gesto); al soltar, si pasó el umbral termina de salir de la
  // pantalla hacia ese lado (con transición) y RECIÉN AHÍ cambia de canción — la que entra se monta de
  // cero (por el key en el sitio donde se usa <SongView>) y juega su propia animación de entrada desde
  // el lado opuesto. Si no pasó el umbral, vuelve a 0 con transición (como soltar una foto a medio camino).
  const [dragX, setDragX] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | dragging | exiting
  // blockKeys/order se calculan ANTES del "if (!song) return null" de abajo porque los hooks de Modo
  // Músico (justo debajo) los necesitan, y los hooks no se pueden llamar condicionalmente ni después
  // de un return — con song en null, quedan en su valor vacío por defecto sin romper nada.
  const blockKeys = song ? Object.keys(song.blocks) : [];
  // Lo que de verdad debe leer el músico es la canción EN ORDEN DE EJECUCIÓN — la Estructura, repitiendo
  // cada sección las veces que corresponda (V1, V2, V1, Coro...) — no una lista de secciones únicas en
  // el orden en que se crearon, que es lo que mostraba antes (la Estructura quedaba sin ningún efecto
  // real para quien toca). La Estructura ACTUAL de la canción manda siempre que exista: structureOverride
  // es solo una foto fija tomada el día que se agregó al Setlist (no hay pantalla para editarla aparte),
  // así que si después se ajusta la Estructura de la canción, esa foto vieja no debe ganarle. Solo se usa
  // como respaldo si la canción hoy no tiene ninguna Estructura propia; y si ninguna existe, las secciones únicas.
  const order = !song
    ? []
    : song.defaultStructure && song.defaultStructure.length > 0
      ? song.defaultStructure
      : structureOverride && structureOverride.length > 0
        ? structureOverride
        : blockKeys;
  // ---- Modo Músico. Dos formas muy distintas de funcionar:
  // · Fuera de una transmisión en vivo (repaso/ensayo): sigue igual que siempre — auto-avance calculado
  //   por tempo (BPM) × compases de cada sección, con "tap tempo", sincronizado por un canal ad-hoc
  //   (song.id) entre quien tenga la MISMA canción abierta, sin un líder fijo.
  // · EN VIVO: nada de compases ni BPM — el pedido fue explícito, la música real no siempre respeta el
  //   tempo "de papel". El líder avanza a mano (‹›/pills) y cada movimiento se refleja al instante en
  //   todos los demás dispositivos, como un espejo — ver más abajo. ----
  const [autoMode, setAutoMode] = useState(false);
  const [liveBpm, setLiveBpm] = useState(Number(song?.tempo) || 120);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const tapTimesRef = useRef([]);

  // ---- Tonalidad + cejilla de ESTA vista — ver TonalidadModal más abajo para el porqué de cada capa:
  // "tonalidadLocal" es un ajuste que SOLO ve quien lo puso, nunca se guarda en ningún lado (ni
  // siquiera para el mismo usuario en otra sesión) — sustituye a `song.key` únicamente para calcular
  // qué se muestra, nunca lo que hay guardado de verdad (ni la canción de la biblioteca, ni el
  // tonalidad_override compartido del ítem del Setlist, que ya viene aplicado en `song.key` cuando
  // corresponde — ver songWithKeyOverride). "cejilla" es lo que antes se llamaba "Capo": sube/baja
  // medio tono a la vez SOLO en lo que ve este dispositivo, nunca se manda a musico_en_vivo/
  // musicoState ni a ningún otro dispositivo, ni siquiera si este músico es el líder — el líder solo
  // transmite EN QUÉ SECCIÓN está, jamás su cejilla. A diferencia del capo viejo (que podía ir
  // negativo, ej. "Capo -2"), la cejilla representa un traste FÍSICO real — nunca negativa — así que
  // para "ver los acordes de un tono más abajo" ahora se cambia la tonalidad, no la cejilla.
  // Como este componente se remonta entero al cambiar de canción (ver el `key=` en el sitio donde se
  // usa <SongView>), tonalidadLocal arranca limpia en cada canción nueva. La cejilla NO: cada canción
  // recuerda la suya (solo las que el músico decidió ponerle capo), así al ir y volver entre las
  // canciones de una cadena no tiene que reponerla. Vive en sessionStorage como mapa songId → traste
  // (solo este dispositivo, dura hasta cerrar la app/pestaña, nunca se manda a nadie).
  const [tonalidadLocal, setTonalidadLocal] = useState(null);
  const [cejilla, setCejilla] = useState(() => {
    if (!song) return 0;
    try { return Math.min(11, Math.max(0, parseInt(JSON.parse(sessionStorage.getItem(CEJILLA_SESSION_KEY) || "{}")[song.id]) || 0)); } catch { return 0; }
  });
  useEffect(() => {
    if (!song) return;
    try {
      const map = JSON.parse(sessionStorage.getItem(CEJILLA_SESSION_KEY) || "{}");
      if (cejilla > 0) map[song.id] = cejilla; else delete map[song.id];
      sessionStorage.setItem(CEJILLA_SESSION_KEY, JSON.stringify(map));
    } catch { /* sin storage: la cejilla solo dura mientras esta canción esté abierta */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cejilla, song?.id]);
  const [showTonalidadModal, setShowTonalidadModal] = useState(false);
  const displayedKey = tonalidadLocal || song?.key;
  // Semitonos totales a aplicar sobre los acordes TAL COMO están guardados (en song.key): primero lo
  // que haga falta para llegar a la tonalidad mostrada, y encima, la cejilla resta (tocar más abajo
  // porque el capo físico ya sube esos semitonos al sonar).
  const semitonesDesdeOriginal = song ? semitoneShift(song.key, displayedKey) - cejilla : 0;
  const cejillaResultKey = song ? transposeChordToken(displayedKey, -cejilla) : null;

  // ---- Fuera de una transmisión en vivo (repaso/ensayo): sigue igual que siempre — cualquiera que
  // tenga la MISMA canción abierta se sincroniza por un canal ad-hoc (song.id), sin un líder fijo,
  // "cualquiera que ajuste algo se transmite a los demás". ----
  const musicoChannelRef = useRef(null);
  // Ensayo juntos es opcional: solo quien lo activa comparte y recibe sección/tempo/auto-avance con
  // los demás que también lo activaron. Se recuerda en este dispositivo hasta cerrar la app.
  const [ensayoJuntos, setEnsayoJuntosState] = useState(() => { try { return sessionStorage.getItem("wf-ensayo-juntos") === "1"; } catch { return false; } });
  const setEnsayoJuntos = (v) => { setEnsayoJuntosState(v); try { sessionStorage.setItem("wf-ensayo-juntos", v ? "1" : "0"); } catch { /* sin storage */ } };
  useEffect(() => {
    if (!song || liveSync?.active || !ensayoJuntos) return; // en vivo usa musico_en_vivo (líder/seguidor), no este canal
    const channel = supabase.channel(`musico-${song.id}`);
    channel.on("broadcast", { event: "sync" }, ({ payload }) => {
      setAutoMode(payload.autoMode);
      setLiveBpm(payload.liveBpm);
      setCurrentSectionIdx(payload.currentSectionIdx);
      indexRefs.current[payload.currentSectionIdx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }).subscribe();
    musicoChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); musicoChannelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, liveSync?.active, ensayoJuntos]);
  const broadcastMusico = (patch) => {
    musicoChannelRef.current?.send({ type: "broadcast", event: "sync", payload: { autoMode, liveBpm, currentSectionIdx, ...patch } });
  };

  // ---- En vivo: líder/seguidor por transmisión (ver tabla musico_en_vivo — src/lib/musicoLive.js —,
  // DEVICE_ID/musicoState en el componente principal). El primero que toque "Modo Músico" sin que haya
  // ya un líder activo se vuelve el líder: nada de temporizador por BPM, solo "espejo" — cada vez que
  // mueve la sección (‹›/pill) eso se escribe ahí y el resto lo refleja al instante. Si el líder se
  // queda callado más de MUSICO_LEADER_STALE_MS (cerró la app, se quedó sin señal), el siguiente que
  // toque "Modo Músico" toma el mando sin que nadie quede bloqueado a mitad de un culto. Un seguidor
  // puede seguir tocando los pills/‹› para mirar otra sección por su cuenta (no transmite nada) — en
  // cuanto el líder mueve algo de nuevo, ese nuevo estado le llega y lo vuelve a traer.
  const isLive = !!liveSync?.active;
  const isLeaderMe = isLive && liveSync.state?.liderId === liveSync.deviceId;
  const otherLeaderFresh = isLive && isMusicoLeaderFresh(liveSync.state) && liveSync.state.liderId !== liveSync.deviceId;
  // Unido = este músico eligió seguir a quien dirige. Si no se unió, va a su propio ritmo aunque haya
  // alguien dirigiendo (puede usar el auto-avance por BPM y TAP como en un ensayo, solo para él).
  const siguiendo = isLive && !!liveSync.unido && !isLeaderMe;
  const porMiCuenta = !isLive || (!isLeaderMe && !siguiendo);
  const nombreLider = liveSync?.state?.liderNombre || "el líder";
  const isFollowingNow = siguiendo && otherLeaderFresh && liveSync.state.songItemId === liveSync.itemId;
  // Líder registrado pero sin heartbeat reciente (se salió de la canción sin querer, el teléfono se
  // bloqueó, cambió de app un segundo) — TODOS quedan pausados exactamente donde estaban (nadie toma
  // el mando solo), y si estaba siguiendo a ESE líder en ESTA misma canción se lo avisa con claridad
  // en vez de mostrarle de golpe el botón normal de "Modo Músico" (que invitaría a tomar el mando por
  // error). Apenas el líder vuelve a mandar un heartbeat, esto se apaga solo y sigue como si nada.
  const leaderStale = isLive && !!liveSync.state?.liderId && liveSync.state.liderId !== liveSync.deviceId && !otherLeaderFresh;
  const wasFollowingStaleLeader = siguiendo && leaderStale;

  // BUG real (2026-08-30, culto en vivo): si el líder pierde la conexión, jamás vuelve a llegar un
  // heartbeat por Realtime — así que este componente no tiene ningún motivo para volver a renderizar,
  // y "otherLeaderFresh"/isFollowingNow se quedan calculados contra el Date.now() de la ÚLTIMA vez que
  // SÍ llegó algo, "frescos" para siempre aunque hace rato pasaron los MUSICO_LEADER_STALE_MS de
  // verdad. El botón para tomar el mando ni siquiera reaparecía: todos se quedaban viendo "Siguiendo
  // al líder" sin poder pasar ninguna canción más. Este tick fuerza a re-evaluar la frescura cada
  // 2s aunque no llegue ningún dato nuevo.
  const [, forzarRevision] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => forzarRevision((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [isLive]);

  // "Soy el líder" se deriva de musicoState (persiste solo), así que no hace falta restaurar nada al
  // pasar de canción — pero SÍ hay que reflejar la sección donde arranca esta canción nueva (goToItem ya
  // dejó sectionIdx en 0 en musico_en_vivo antes de navegar), para que el propio líder empiece igual que
  // todos los demás.
  useEffect(() => {
    if (!isLeaderMe || !liveSync.state) return;
    setCurrentSectionIdx(liveSync.state.sectionIdx || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSync?.itemId]);

  // Late del líder: mientras este dispositivo sea el líder en vivo, avisa "sigo aquí" cada pocos
  // segundos aunque no haya movido nada — si no, un tramo largo sin cambiar de sección haría ver al
  // líder como "caído" y otro dispositivo podría tomarle el mando de encima.
  useEffect(() => {
    if (!isLive || !isLeaderMe) return;
    const id = setInterval(() => liveSync.onUpdate({ heartbeat: new Date().toISOString() }), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, isLeaderMe]);

  // Seguidor: refleja la sección del líder apenas cambia — y si saltó a OTRA canción, le pide al
  // contenedor que navegue ahí (ver onFollowItem en el sitio donde se usa <SongView>, que resuelve el
  // id de canción a partir del ítem del Setlist). OJO: se engancha con otherLeaderFresh (hay un líder,
  // sin importar en qué canción), NO con isFollowingNow — ese ya EXIGE que la canción coincida, así que
  // el chequeo de "saltó a otra canción" de abajo nunca se cumplía: apenas el líder cambiaba de canción,
  // isFollowingNow pasaba a falso de una (dejaban de coincidir) y el efecto entero se cortaba antes de
  // llegar a onFollowItem — quien seguía se quedaba pegado en la canción vieja, tenía que deslizar él
  // mismo para alcanzar al líder.
  useEffect(() => {
    if (!otherLeaderFresh || !siguiendo) return;
    const state = liveSync.state;
    if (state.songItemId !== liveSync.itemId) { liveSync.onFollowItem(state.songItemId); return; }
    setCurrentSectionIdx(state.sectionIdx || 0);
    indexRefs.current[state.sectionIdx || 0]?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherLeaderFresh, siguiendo, liveSync?.state?.sectionIdx, liveSync?.state?.songItemId]);

  // ---- Notas por parte (pedido de Eldin, 2026-10-14): la del líder la ven todos; "mi nota" solo yo. ----
  const [notas, setNotas] = useState({ disponible: false, equipo: {}, mias: {} });
  // Modo "Anotar" (pedido de Eldin, 2026-10-14): toda la canción en edición a la vez — etiquetas de un
  // toque (x2, Sube, Solo voz…) y un renglón por parte, más una nota de toda la canción. Se guarda solo.
  // Todo vive en notas_seccion: la nota de la canción es seccion_clave "_cancion" y las etiquetas de una
  // parte son "<clave>#tags" (texto separado por comas) — sin tablas nuevas.
  useEffect(() => {
    if (!song?.id || !notasCtx?.usuarioId) return;
    let vivo = true;
    cargarNotas(song.id, notasCtx.usuarioId).then((r) => { if (vivo) setNotas(r); }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, notasCtx?.usuarioId]);
  const [anotando, setAnotando] = useState(false);
  const [capaElegida, setCapa] = useState("equipo");
  const capa = notasCtx?.puedeEquipo ? capaElegida : "mias";
  const [guardandoNotas, setGuardandoNotas] = useState(0);
  const timersNotasRef = useRef({});
  const pendientesRef = useRef({});
  const textoNota = (c, campo) => notas[c]?.[campo]?.texto || "";
  const guardarCampo = (c, campo, texto) => {
    setGuardandoNotas((g) => g + 1);
    return guardarNota({ cancionId: song.id, seccionClave: campo, duenoId: c === "equipo" ? DUENO_EQUIPO : notasCtx.usuarioId, texto, nombre: notasCtx.nombre })
      .catch((e) => notifyError("No se pudo guardar la nota", e))
      .finally(() => setGuardandoNotas((g) => g - 1));
  };
  const ponerLocal = (c, campo, texto) => setNotas((prev) => ({ ...prev, [c]: { ...prev[c], [campo]: { ...(prev[c][campo] || {}), texto, editado_nombre: notasCtx.nombre } } }));
  const escribirNota = (c, campo, texto) => {
    ponerLocal(c, campo, texto);
    const k = `${c}|${campo}`;
    pendientesRef.current[k] = texto;
    clearTimeout(timersNotasRef.current[k]);
    timersNotasRef.current[k] = setTimeout(() => { delete timersNotasRef.current[k]; delete pendientesRef.current[k]; guardarCampo(c, campo, texto); }, 700);
  };
  const guardarPendientes = () => {
    Object.entries(timersNotasRef.current).forEach(([k, t]) => {
      clearTimeout(t);
      const [c, campo] = k.split("|");
      guardarCampo(c, campo, pendientesRef.current[k]);
    });
    timersNotasRef.current = {};
    pendientesRef.current = {};
  };
  useEffect(() => () => guardarPendientes(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const etiquetasDe = (c, clave) => textoNota(c, `${clave}#tags`).split(",").map((x) => x.trim()).filter(Boolean);
  const alternarEtiqueta = (c, clave, et) => {
    const act = etiquetasDe(c, clave);
    const sig = act.includes(et) ? act.filter((x) => x !== et) : [...act, et];
    ponerLocal(c, `${clave}#tags`, sig.join(","));
    guardarCampo(c, `${clave}#tags`, sig.join(","));
  };
  // Tocar una nota abre "Anotar" justo en esa parte; la × la borra de un toque.
  const puedeEditarCapa = (c) => c === "mias" || !!notasCtx?.puedeEquipo;
  const abrirAnotarEn = (c, campo) => {
    if (puedeEditarCapa(c)) setCapa(c);
    setAnotando(true);
    setTimeout(() => {
      const el = document.querySelector(`[data-anotar="${campo}"] textarea`);
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); }
    }, 80);
  };
  const borrarNota = (c, campo) => { ponerLocal(c, campo, ""); guardarCampo(c, campo, ""); showToast("Nota borrada", "info"); };

  // La fila de partes sigue sola a la que suena (solo de lado: nunca mueve la página hacia arriba).
  const filaPartesRef = useRef(null);
  useEffect(() => {
    const fila = filaPartesRef.current;
    const pill = fila?.querySelector(`[data-pill="${currentSectionIdx}"]`);
    if (!fila || !pill) return;
    fila.scrollTo({ left: pill.offsetLeft - fila.offsetLeft - fila.clientWidth / 2 + pill.offsetWidth / 2, behavior: "smooth" });
  }, [currentSectionIdx]);
  const goToSectionIdx = (i) => {
    const clamped = Math.max(0, Math.min(order.length - 1, i));
    setCurrentSectionIdx(clamped);
    indexRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (isLeaderMe) liveSync.onUpdate({ sectionIdx: clamped, heartbeat: new Date().toISOString() });
    else if (!isLive) broadcastMusico({ currentSectionIdx: clamped }); // seguidor: solo local, no transmite nada
  };
  const toggleAutoMode = () => {
    if (!porMiCuenta) return; // quien dirige o sigue no usa auto-avance: todo va a mano, en espejo
    const next = !autoMode;
    setAutoMode(next);
    broadcastMusico({ autoMode: next });
  };
  // Unirse a quien dirige: desde ahora este dispositivo refleja su canción y su sección.
  const unirme = () => {
    setAutoMode(false);
    liveSync.setUnido(true);
    if (liveSync.state?.songItemId && liveSync.state.songItemId !== liveSync.itemId) liveSync.onFollowItem(liveSync.state.songItemId);
    else setCurrentSectionIdx(liveSync.state?.sectionIdx || 0);
  };
  const irAMiRitmo = () => liveSync.setUnido(false);
  // Empezar a dirigir: solo si nadie más está dirigiendo ahora mismo. Los demás NO lo siguen solos,
  // les aparece "Unirme a <nombre>" y cada uno decide.
  const dirigir = () => {
    setAutoMode(false);
    liveSync.setUnido(false);
    liveSync.onUpdate({ liderId: liveSync.deviceId, liderNombre: liveSync.myName || null, songItemId: liveSync.itemId, sectionIdx: currentSectionIdx, heartbeat: new Date().toISOString() });
  };
  const dejarDeDirigir = () => liveSync.onUpdate({ liderId: null, liderNombre: null, heartbeat: null });
  const handleTap = () => {
    if (!porMiCuenta) return; // quien dirige o sigue va a mano, sin BPM
    const now = Date.now();
    const recent = tapTimesRef.current.filter((t) => now - t < 3000).concat(now).slice(-8);
    tapTimesRef.current = recent;
    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgMs);
      setLiveBpm(bpm);
      broadcastMusico({ liveBpm: bpm });
    }
  };
  useEffect(() => {
    if (!autoMode || !song || !porMiCuenta) return; // quien dirige o sigue va a mano; los demás pueden usar su propio auto-avance
    const key = order[currentSectionIdx];
    const block = song.blocks[key];
    if (!block) return;
    const beatsPerBar = tiemposPorCompas(song.compas);
    const durationMs = Math.max(1500, ((block.bars || 8) * beatsPerBar / liveBpm) * 60000);
    const timer = setTimeout(() => {
      if (currentSectionIdx >= order.length - 1) { setAutoMode(false); broadcastMusico({ autoMode: false }); return; } // se acabó la canción
      goToSectionIdx(currentSectionIdx + 1);
    }, durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, currentSectionIdx, liveBpm, order, song, porMiCuenta]);
  if (!song) return null;
  const scrollTo = (key) => sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  // Modo "Anotar": cada parte UNA vez (en el orden en que se canta), con sus etiquetas y un renglón.
  const partesUnicas = [...new Set(order.filter((k) => song.blocks[k])), ...blockKeys.filter((k) => !order.includes(k))];
  const campoNota = { width: "100%", boxSizing: "border-box", borderRadius: 12, border: "1.5px solid var(--wf-brand-accent)", background: "var(--wf-card)", color: "var(--wf-text)", padding: "9px 11px", fontSize: 15, fontFamily: "inherit", lineHeight: 1.35, outline: "none", resize: "none" };
  const terminarAnotar = () => { guardarPendientes(); setAnotando(false); };
  const panelAnotar = (
    <div>
      <div style={{ position: "sticky", top: 0, zIndex: 3, background: "var(--wf-bg)", padding: "6px 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
        {notasCtx?.puedeEquipo ? (
          <div style={{ flex: 1, display: "flex", background: "var(--wf-hover)", borderRadius: 12, padding: 3 }}>
            {[["equipo", "Para todos"], ["mias", "Solo para mí"]].map(([v, t]) => (
              <button key={v} onClick={() => setCapa(v)} style={{ flex: 1, border: "none", borderRadius: 9, padding: "8px 4px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: capa === v ? "var(--wf-card)" : "transparent", color: capa === v ? (v === "equipo" ? "#B58500" : "#2F5FA8") : "var(--wf-faint)", boxShadow: capa === v ? "0 1px 4px rgba(0,0,0,0.12)" : "none" }}>{t}</button>
            ))}
          </div>
        ) : <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "#2F5FA8" }}>Tus notas · solo las ves tú</span>}
        <span style={{ fontSize: 11, color: "var(--wf-faint)", whiteSpace: "nowrap" }}>{guardandoNotas > 0 ? "Guardando…" : "✓ Guardado"}</span>
        <button onClick={terminarAnotar} style={{ background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", border: "none", borderRadius: 12, padding: "9px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Listo</button>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: "var(--wf-muted)", margin: "4px 0 6px" }}>NOTA DE TODA LA CANCIÓN</div>
      <div data-anotar="_cancion"><textarea rows={2} value={textoNota(capa, "_cancion")} onChange={(e) => escribirNota(capa, "_cancion", e.target.value)} placeholder="Ej.: intro 4 compases solo guitarra · terminamos en el coro" style={{ ...campoNota, marginBottom: 18 }} /></div>
      {partesUnicas.map((k) => {
        const b = song.blocks[k];
        const color = badgeColor(b.badge);
        const activas = etiquetasDe(capa, k);
        return (
          <div key={k} data-anotar={k} style={{ marginBottom: 18 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${color}22`, borderRadius: 20, padding: "5px 12px", marginBottom: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.badge}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{b.label}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {ETIQUETAS_PARTE.map((et) => {
                const on = activas.includes(et);
                return (
                  <button key={et} onClick={() => alternarEtiqueta(capa, k, et)}
                    style={{ border: `1.5px solid ${on ? (capa === "equipo" ? "var(--wf-brand-primary)" : "#2F5FA8") : "var(--wf-border)"}`, background: on ? (capa === "equipo" ? "var(--wf-brand-primary)" : "#2F5FA8") : "var(--wf-card)", color: on ? "#fff" : "var(--wf-text)", borderRadius: 14, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{et}</button>
                );
              })}
            </div>
            <textarea rows={1} value={textoNota(capa, k)} onChange={(e) => escribirNota(capa, k, e.target.value)} placeholder={`Nota para ${b.label}…`} style={campoNota} />
          </div>
        );
      })}
      <button onClick={terminarAnotar} style={{ ...primaryBtn, minHeight: 46, marginBottom: 10 }}>Listo</button>
    </div>
  );
  const canSwipe = onPrev || onNext;
  const completeSwipe = (dir, distance) => {
    setPhase("exiting");
    setDragX(dir === "next" ? -distance : distance);
    setTimeout(() => { (dir === "next" ? onNext : onPrev)(); }, 200);
  };
  // Pointer Events (no Touch Events): unifica mouse/touch/lápiz y es más confiable en apps instaladas.
  // setPointerCapture fuerza a que este mismo elemento reciba todo el gesto pase lo que pase con el
  // dedo entre medio (scroll, salirse del borde) — sin esto, en algunos navegadores el "up" se pierde.
  // OJO: se pide recién cuando el arrastre horizontal ya se confirmó (abajo en onPointerMove), NO en
  // cada pointerdown — pedirla de una, en CUALQUIER toque (aunque nunca se convierta en arrastre), le
  // robaba el clic a cualquier botón de adentro (empezando por "Modo Músico": el toque quedaba
  // capturado por este contenedor y el evento de click nunca le llegaba al botón).
  const swipeHandlers = canSwipe ? {
    onPointerDown: (e) => {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      draggingRef.current = false;
    },
    onPointerMove: (e) => {
      const start = pointerStartRef.current;
      if (!start || phase === "exiting") return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!draggingRef.current) {
        if (Math.abs(dx) < 8) return; // todavía no se nota la intención del gesto
        if (Math.abs(dy) > Math.abs(dx)) { pointerStartRef.current = null; return; } // es scroll vertical
        draggingRef.current = true;
        setPhase("dragging");
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      // Resistencia (se mueve, pero poco) si se arrastra hacia un lado sin canción a la que ir.
      const resisted = (dx < 0 && !onNext) || (dx > 0 && !onPrev) ? dx * 0.25 : dx;
      setDragX(resisted);
    },
    onPointerUp: () => {
      const wasDragging = draggingRef.current;
      pointerStartRef.current = null;
      draggingRef.current = false;
      if (!wasDragging) return;
      const threshold = 70;
      const containerWidth = containerRef.current?.offsetWidth || 400;
      if (dragX <= -threshold && onNext) completeSwipe("next", containerWidth);
      else if (dragX >= threshold && onPrev) completeSwipe("prev", containerWidth);
      else { setPhase("idle"); setDragX(0); }
    },
    onPointerCancel: () => { pointerStartRef.current = null; draggingRef.current = false; setPhase("idle"); setDragX(0); },
  } : {};
  const enterClass = enterDirection === "next" ? "song-slide-in-right" : enterDirection === "prev" ? "song-slide-in-left" : "screen-enter";

  return (
    <div
      ref={containerRef}
      className={enterClass}
      style={{
        padding: 20, paddingBottom: (onPrev || onNext) ? 78 : 20, maxWidth: 820, width: "100%", minHeight: "70vh", margin: "0 auto", boxSizing: "border-box", position: "relative",
        touchAction: canSwipe ? "pan-y" : undefined,
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: phase === "dragging" ? "none" : "transform 0.22s ease",
      }}
      {...swipeHandlers}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowTonalidadModal(true)}
            title="Cambiar tonalidad"
            className="hoverable"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "5px 8px", color: "var(--wf-text-2)", cursor: "pointer" }}
          >
            {acordeEn(displayedKey)}{cejilla > 0 ? ` · cejilla ${cejilla}` : ""}
            <ChevronDown size={12} />
          </button>
          {showTonalidadModal && (
            <TonalidadModal
              song={song}
              displayedKey={displayedKey}
              cejilla={cejilla}
              setCejilla={setCejilla}
              cejillaResultKey={cejillaResultKey}
              puedeCambiarPermanente={mode === "biblioteca" && isAdminViewer}
              puedeCambiarLocal={mode === "setlist"}
              onClose={() => setShowTonalidadModal(false)}
              onGuardarPermanente={(nuevaTonalidad) => { onTranspose(song.id, nuevaTonalidad); setTonalidadLocal(null); setShowTonalidadModal(false); }}
              onGuardarLocal={(nuevaTonalidad) => { setTonalidadLocal(nuevaTonalidad === song.key ? null : nuevaTonalidad); setShowTonalidadModal(false); }}
            />
          )}
          {(song.hasAttachment || notasCtx?.puedeEquipo) && (
            <button onClick={() => setShowAdjuntos(true)} title="Adjuntos (PDF, imágenes, enlaces)" className="hoverable"
              style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 32, background: song.hasAttachment ? "var(--wf-active-bg)" : "var(--wf-hover)", border: `1px solid ${song.hasAttachment ? "var(--wf-brand-accent)" : "var(--wf-border)"}`, borderRadius: 10, cursor: "pointer", color: song.hasAttachment ? "var(--wf-brand-accent)" : "var(--wf-text-2)" }}>
              <Paperclip size={16} />
            </button>
          )}
          {showAdjuntos && (
            <AdjuntosModal song={song} iglesiaId={iglesiaId} puedeEditar={!!notasCtx?.puedeEquipo} onClose={() => setShowAdjuntos(false)} onCambio={(tiene) => onAdjuntosChange?.(song.id, tiene)} />
          )}
          {isAdminViewer && (
            <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "var(--wf-text)", cursor: "pointer" }}>
              <Pencil size={14} /> Editar
            </button>
          )}
          {isAdminViewer && (
            <button onClick={() => onDelete(song)} title="Eliminar canción" style={iconGhost}>
              <Trash2 size={14} color="#C23B32" />
            </button>
          )}
        </div>
      </div>

      <h2 style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 24, fontWeight: 600, margin: "0 0 4px" }}>{song.title}</h2>
      <div style={{ fontSize: 13, color: "var(--wf-muted)", marginBottom: 16 }}>
        {song.artist || "Unknown"} · {song.tempo} bpm{song.compas ? ` · ${song.compas}` : ""}
        {positionLabel && <span style={{ marginLeft: 8, fontWeight: 700, color: "var(--wf-brand-accent)" }}>· {positionLabel} en el setlist</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: (autoMode || isLeaderMe) ? "var(--wf-active-bg)" : "var(--wf-bg)", border: `1px solid ${(autoMode || isLeaderMe) ? "var(--wf-brand-accent)" : "var(--wf-divider)"}`, borderRadius: 16, padding: "8px 10px", marginBottom: 16, flexWrap: "wrap" }}>
        {/* En vivo, Modo Músico es voluntario: alguien dirige, y cada músico decide si se une o va a su
            propio ritmo. Fuera de vivo, "Ensayar juntos" hace lo mismo sin un líder fijo.
            Plan Gratis: sin Modo Músico (auto-avance, dirigir, ensayar juntos) — se ven los acordes y se
            avanza a mano, y el candado abre la ventana de planes. */}
        {!modoMusicoPermitido ? (
          <button onClick={abrirPlanes} className="hoverable" title="Modo Músico es parte de los planes Ministerio e Iglesia" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", color: "var(--wf-muted)", border: "1px dashed var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Lock size={13} /> Modo Músico · Plan Ministerio
          </button>
        ) : isLeaderMe ? (
          <>
            <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}><Radio size={13} /> Estás dirigiendo</span>
            <button onClick={dejarDeDirigir} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", color: "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Dejar de dirigir</button>
          </>
        ) : siguiendo ? (
          <>
            {wasFollowingStaleLeader ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", color: "var(--wf-muted)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}><Pause size={13} /> Pausado: {nombreLider} se desconectó</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}><Radio size={13} /> Siguiendo a {nombreLider}</span>
            )}
            <button onClick={irAMiRitmo} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", color: "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ir a mi ritmo</button>
          </>
        ) : (
          <>
            {isLive && otherLeaderFresh && (
              <button onClick={unirme} className="hoverable" style={{ ...{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", color: "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", border: "none" }}><Users size={13} /> Unirme a {nombreLider}</button>
            )}
            {isLive && !otherLeaderFresh && (
              <button onClick={dirigir} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", color: "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Radio size={13} /> Dirigir a los músicos</button>
            )}
            <button onClick={toggleAutoMode} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: autoMode ? "var(--wf-brand-accent)" : "var(--wf-card)", color: autoMode ? "var(--wf-on-brand-accent)" : "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {autoMode ? <><Pause size={13} /> Auto-avance: ON</> : <><Play size={13} /> Auto-avance</>}
            </button>
            {!isLive && (
              <button onClick={() => setEnsayoJuntos(!ensayoJuntos)} title="Comparte sección y tempo con quienes también lo activen en esta canción" className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: ensayoJuntos ? "var(--wf-active-bg)" : "var(--wf-card)", color: "var(--wf-text)", border: `1px solid ${ensayoJuntos ? "var(--wf-brand-accent)" : "var(--wf-border)"}`, borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Users size={13} /> {ensayoJuntos ? "Ensayando juntos" : "Ensayar juntos"}
              </button>
            )}
          </>
        )}
        {notas.disponible && (
          <button onClick={() => setAnotando(true)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", color: "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <PencilLine size={13} /> Anotar
          </button>
        )}
        <button onClick={() => goToSectionIdx(currentSectionIdx - 1)} disabled={currentSectionIdx === 0} style={{ ...iconGhost, opacity: currentSectionIdx === 0 ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
        <button onClick={() => goToSectionIdx(currentSectionIdx + 1)} disabled={currentSectionIdx >= order.length - 1} style={{ ...iconGhost, opacity: currentSectionIdx >= order.length - 1 ? 0.4 : 1 }}><ChevronRight size={16} /></button>
        {/* Respaldo manual: si por lo que sea el líder queda pegado (perdió señal, cerró la app) y hay
            que esperar no es opción a mitad de un culto, cualquiera puede reiniciar Modo Músico de una —
            nadie queda de líder, el próximo que toque "Modo Músico" toma el mando limpio. OJO: tiene que
            seguir visible cuando el líder ya está "leaderStale" (no solo isFollowingNow, que exige
            frescura) — si no, este botón desaparecía justo cuando más hacía falta: apenas el líder se
            pone viejo/caído es cuando alguien necesita poder reiniciar, no antes. */}
        {isLive && (isLeaderMe || siguiendo || leaderStale) && (
          <button
            onClick={async () => {
              if (!(await confirmDialog("¿Reiniciar Modo Músico? Nadie va a quedar dirigiendo, y cualquiera podrá tocar \"Dirigir a los músicos\".", { textoConfirmar: "Reiniciar" }))) return;
              clearMusicoLive(iglesiaId).catch((e) => notifyError("No se pudo reiniciar Modo Músico", e));
            }}
            title="El líder se quedó pegado (perdió conexión, cerró la app) — esto reinicia Modo Músico para todos"
            className="hoverable" style={iconGhost}
          >
            <RefreshCw size={14} />
          </button>
        )}
        {/* TAP tempo y el bpm ya no aplican en vivo — ahí no hay compases/BPM, solo el líder avanzando a
            mano y todos reflejándolo. */}
        {porMiCuenta && modoMusicoPermitido && (
          <>
            <button onClick={handleTap} className="hoverable" style={{ background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--wf-text)", cursor: "pointer" }}>TAP</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-muted)" }}>{liveBpm} bpm</span>
          </>
        )}
      </div>

      {anotando ? panelAnotar : (<>
      {(["equipo", "mias"]).map((c) => textoNota(c, "_cancion").trim() && (
        <TiraNota key={c} tipo={c} etiqueta={c === "equipo" ? "NOTA DE LA CANCIÓN · LÍDER" : "NOTA DE LA CANCIÓN · MÍA"} texto={textoNota(c, "_cancion")}
          onAbrir={() => abrirAnotarEn(c, "_cancion")} onBorrar={puedeEditarCapa(c) ? () => borrarNota(c, "_cancion") : null} />
      ))}
      {/* Partes de la canción EN ORDEN (pedido de Eldin, 2026-10-14: con solo "V1"/"C" no se sabía qué
          parte era). Se lee el nombre completo, y la parte que suena queda resaltada; en celular la fila
          se desliza de lado y sigue sola a la parte actual. */}
      <div ref={filaPartesRef} className="chordbar-scroll" style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
        {order.map((key, i) => {
          const b = song.blocks[key];
          if (!b) return null;
          const color = badgeColor(b.badge);
          const actual = (autoMode || isLive) && i === currentSectionIdx;
          return (
            <button key={`${key}-${i}`} data-pill={i}
              onClick={() => goToSectionIdx(i)} className="hoverable"
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, borderRadius: 18, border: `1.5px solid ${color}`, background: actual ? color : "transparent", color: actual ? "#fff" : "var(--wf-text)", fontSize: 12.5, fontWeight: 700, padding: "6px 12px 6px 6px", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
              <span style={{ minWidth: 22, height: 22, borderRadius: 11, padding: "0 4px", boxSizing: "border-box", background: actual ? "rgba(255,255,255,0.25)" : `${color}22`, color: actual ? "#fff" : color, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.badge}</span>
              {b.label || b.badge}
            </button>
          );
        })}
      </div>

      {order.map((key, i) => {
        const b = song.blocks[key];
        if (!b) return null;
        const color = badgeColor(b.badge);
        // Antes solo se resaltaba con el auto-avance por BPM (autoMode) — en vivo ya no hay auto-avance
        // (ver más arriba), pero la sección "actual" del líder/seguidor sigue siendo currentSectionIdx,
        // así que también cuenta para resaltar cuál es la que está sonando ahora.
        const isActive = (autoMode || isLive) && i === currentSectionIdx;
        return (
          // Tocar la TARJETA de la sección (letra+acordes, no los círculos de arriba) salta ahí mismo —
          // en vivo, si sos el líder, ese salto se refleja al instante en todos los demás músicos, como
          // pedido: cada parte de la canción funciona como un botón propio, no solo el badge de arriba.
          <div
            key={`${key}-${i}`}
            ref={(el) => { if (!sectionRefs.current[key]) sectionRefs.current[key] = el; indexRefs.current[i] = el; }}
            onClick={() => goToSectionIdx(i)}
            role="button"
            tabIndex={0}
            className="hoverable"
            style={{ marginBottom: 16, borderRadius: 14, outline: isActive ? "2px solid var(--wf-brand-accent)" : "none", outlineOffset: 3, cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${color}22`, borderRadius: 20, padding: "5px 12px", marginRight: 2 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.badge}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{b.label}</span>
              </div>
              {etiquetasDe("equipo", key).map((et) => <EtiquetaParte key={`e-${et}`} texto={et} />)}
              {etiquetasDe("mias", key).map((et) => <EtiquetaParte key={`m-${et}`} texto={et} mia />)}
            </div>
            {textoNota("equipo", key).trim() && <TiraNota tipo="equipo" etiqueta="LÍDER" texto={textoNota("equipo", key)} onAbrir={() => abrirAnotarEn("equipo", key)} onBorrar={puedeEditarCapa("equipo") ? () => borrarNota("equipo", key) : null} />}
            {textoNota("mias", key).trim() && <TiraNota tipo="mias" etiqueta="MI NOTA" texto={textoNota("mias", key)} onAbrir={() => abrirAnotarEn("mias", key)} onBorrar={() => borrarNota("mias", key)} />}
            <div style={{ background: isActive ? "var(--wf-active-bg)" : "var(--wf-hover)", borderRadius: 14, padding: 16 }}>
              {b.lines.map((l, i2) => <ChordsAboveLyrics key={i2} raw={l} semitones={semitonesDesdeOriginal} />)}
            </div>
          </div>
        );
      })}

      </>)}

      {/* Fija abajo (como la barra de acordes del editor): para saber qué sigue en Modo Músico sin
          tener que bajar hasta el final de la canción actual ni cambiar de pantalla — antes esta
          pista solo aparecía como texto genérico ("Desliza para cambiar de canción") al final del
          todo del scroll, así que en la práctica había que llegar hasta ahí para verla. */}
      {(onPrev || onNext) && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "var(--bottom-nav-height, 78px)", background: "var(--wf-card)", borderTop: "1px solid var(--wf-divider)", boxShadow: "0 -4px 14px rgba(22,50,79,0.1)", padding: "8px 6px", zIndex: 40, display: "flex", alignItems: "stretch", gap: 6 }}>
          <button
            onClick={onPrev} disabled={!onPrev} className={onPrev ? "hoverable" : undefined}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", borderRadius: 12, padding: "6px 10px", cursor: onPrev ? "pointer" : "default", opacity: onPrev ? 1 : 0.35, textAlign: "left" }}
          >
            <ChevronLeft size={16} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--wf-faint)", letterSpacing: 0.5 }}>ANTERIOR</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prevTitle || "—"}</div>
            </div>
          </button>
          <div style={{ width: 1, background: "var(--wf-divider)", flexShrink: 0 }} />
          <button
            onClick={onNext} disabled={!onNext} className={onNext ? "hoverable" : undefined}
            style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, background: "none", border: "none", borderRadius: 12, padding: "6px 10px", cursor: onNext ? "pointer" : "default", opacity: onNext ? 1 : 0.35, textAlign: "right" }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--wf-faint)", letterSpacing: 0.5 }}>SIGUIENTE</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextTitle || "—"}</div>
            </div>
            <ChevronRight size={16} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Notas por parte (ver modo "Anotar" en SongView) ----
const ETIQUETAS_PARTE = ["x2", "Sube", "Baja", "Solo voz", "Solo piano", "Banda completa", "Corte", "Instrumental"];

function EtiquetaParte({ texto, mia }) {
  const naranja = /^x\d/i.test(texto);
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3, textTransform: "uppercase", borderRadius: 9, padding: "3px 8px",
      background: mia ? "transparent" : naranja ? "var(--wf-brand-accent)" : "var(--wf-brand-primary)",
      color: mia ? "#2F5FA8" : naranja ? "var(--wf-on-brand-accent)" : "var(--wf-on-brand-primary)",
      border: mia ? "1.5px solid #2F5FA8" : "1.5px solid transparent" }}>{texto}</span>
  );
}

function TiraNota({ tipo, etiqueta, texto, onAbrir, onBorrar }) {
  const lider = tipo === "equipo";
  const parar = (e) => e.stopPropagation(); // no "saltar a esta parte" ni arrastrar de canción
  return (
    <div onClick={(e) => { parar(e); onAbrir?.(); }} onPointerDown={parar} role="button" title="Tocar para editar"
      style={{ display: "flex", gap: 8, alignItems: "flex-start", background: lider ? "#F6C94526" : "#2F5FA81F", borderLeft: `3px solid ${lider ? "#E0A800" : "#2F5FA8"}`, borderRadius: 10, padding: "8px 6px 8px 10px", marginBottom: 8, fontSize: 13.5, lineHeight: 1.4, cursor: onAbrir ? "pointer" : "default" }}>
      <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, color: lider ? "#B58500" : "#2F5FA8", background: lider ? "#F6C94540" : "#2F5FA826", borderRadius: 8, padding: "2px 6px", marginTop: 1 }}>{etiqueta}</span>
      <span style={{ whiteSpace: "pre-wrap", flex: 1 }}>{texto}</span>
      {onBorrar && (
        <button onClick={(e) => { parar(e); onBorrar(); }} onPointerDown={parar} aria-label="Borrar nota"
          style={{ flexShrink: 0, width: 28, height: 28, margin: "-4px 0", borderRadius: 14, border: "none", background: "transparent", color: "var(--wf-faint)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}

// Catálogo estilo OnStage para agregar varias secciones de una — la lista de tipos (Estrofa, Coro...)
// se muestra sin numerar hasta que se marca la primera; a partir de ahí cada tipo va "creciendo" de a
// una repetición por vez (marcar Estrofa 1 revela Estrofa 2, marcar esa revela Estrofa 3...), en vez de
// mostrar de entrada un número fijo de repeticiones que probablemente no coincida con la canción real.
// Cuántas secciones de cada tipo ya tiene la canción (el número más alto: V1, V2, V3 → 3; "C" sin
// número cuenta como 1). Así "Añadir" arranca en la que sigue (Estrofa 4) en vez de repetir Estrofa 1.
function ultimoNumeroPorTipo(blocks) {
  const max = {};
  Object.values(blocks || {}).forEach((b) => {
    const m = String(b.badge || "").match(/^([A-Z]+)(\d*)$/);
    if (!m) return;
    const tipo = SECTION_TYPES.find((t) => t.prefix === m[1]);
    if (!tipo) return;
    const n = m[2] ? parseInt(m[2], 10) : 1;
    max[tipo.id] = Math.max(max[tipo.id] || 0, n);
  });
  return max;
}

function AddSectionsModal({ existingBlocks, onClose, onAdd }) {
  const [query, setQuery] = useState("");
  const yaTiene = useMemo(() => ultimoNumeroPorTipo(existingBlocks), [existingBlocks]);
  const [checkedCounts, setCheckedCounts] = useState({}); // { [typeId]: cuántas repeticiones están marcadas }
  const toggleInstance = (typeId, n) => {
    setCheckedCounts((c) => {
      const current = c[typeId] || 0;
      // Tocar una ya marcada (o cualquiera antes de ella) la desmarca A ELLA Y a las que venían
      // después — no tendría sentido dejar "Estrofa 3" marcada sin la "Estrofa 2".
      const next = n <= current ? n - 1 : n;
      return { ...c, [typeId]: Math.max(0, next) };
    });
  };
  const filteredTypes = SECTION_TYPES.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()));
  const totalChecked = Object.values(checkedCounts).reduce((a, b) => a + b, 0);
  // Ref (no state) para bloquear un doble-toque en el mismo instante — el modal se cierra apenas se
  // confirma, pero en un celular con la pantalla algo lenta dos toques rápidos podían caer ANTES de
  // que React llegue a desmontarlo, agregando las mismas secciones dos (o más) veces.
  const submittedRef = useRef(false);
  const confirm = () => {
    if (submittedRef.current) return;
    const toAdd = [];
    SECTION_TYPES.forEach((t) => {
      const count = checkedCounts[t.id] || 0;
      const base = yaTiene[t.id] || 0;
      for (let n = base + 1; n <= base + count; n++) toAdd.push({ badge: `${t.prefix}${n}`, label: `${t.label} ${n}` });
    });
    if (toAdd.length === 0) return;
    submittedRef.current = true;
    onAdd(toAdd);
    onClose();
  };
  return (
    <ModalShell title="Añadir nuevas secciones" icon={ListMusic} color="#2F5FA8" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 10px", marginBottom: 10 }}>
        <Search size={13} color="var(--wf-faint)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar una nueva sección" style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 12, width: "100%" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflowY: "auto", marginBottom: 12 }}>
        {filteredTypes.map((t) => {
          const count = checkedCounts[t.id] || 0;
          const color = badgeColor(t.prefix);
          const base = yaTiene[t.id] || 0;
          const revealed = Math.min(count + 1, 12); // tope generoso — ninguna canción real necesita más
          return Array.from({ length: revealed }, (_, i) => {
            const n = i + 1; // posición dentro de lo que se va a agregar
            const numero = base + n; // número real de la sección (Estrofa 4 si ya hay 3)
            const isChecked = n <= count;
            const showNumber = base > 0 || revealed > 1; // con una sola instancia a la vista y ninguna previa, se ve "Estrofa" pelado
            return (
              <button
                key={`${t.id}-${n}`}
                onClick={() => toggleInstance(t.id, n)}
                className="hoverable"
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: isChecked ? `${color}18` : "var(--wf-card)", border: isChecked ? `1.5px solid ${color}` : "1px solid var(--wf-divider)", borderRadius: 14, padding: "10px 12px", cursor: "pointer" }}
              >
                <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {showNumber ? `${t.prefix}${numero}` : t.prefix}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--wf-text)" }}>{showNumber ? `${t.label} ${numero}` : t.label}</span>
                {isChecked ? <Check size={16} color={color} /> : <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid var(--wf-border)" }} />}
              </button>
            );
          });
        })}
        {filteredTypes.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No hay secciones que coincidan.</div>}
      </div>
      <button onClick={confirm} disabled={totalChecked === 0} style={{ ...primaryBtn, opacity: totalChecked === 0 ? 0.4 : 1, cursor: totalChecked === 0 ? "not-allowed" : "pointer" }}>
        Agregar{totalChecked > 0 ? ` (${totalChecked})` : ""}
      </button>
    </ModalShell>
  );
}

export function SongEditor({ song, isAdminViewer, onCancel, onSave, onDirtyChange, draftGetterRef }) {
  const canEditKey = isAdminViewer || !song;
  const initialSnapshotRef = useRef(song ? JSON.stringify(song) : JSON.stringify(blankSong()));
  const [draft, setDraft] = useState(() => JSON.parse(initialSnapshotRef.current));
  // "Escribir" (pedido de Eldin, 2026-10-13): la letra se escribe directo en un cuadro grande y las
  // diapositivas salen solas. Canción nueva o sin letra abre ahí; una ya armada, en Detalles.
  const [subTab, setSubTab] = useState(() => {
    const d = song || blankSong();
    return Object.values(d.blocks || {}).every((b) => !(b.lines || []).some((l) => String(l).trim())) ? "escribir" : "detalles";
  }); // escribir | detalles | contenido | estructura (la pestaña Letra se quitó el 2026-10-14: Escribir la reemplaza)
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [showAddSections, setShowAddSections] = useState(false);
  const textareaRefs = useRef({});
  // "Pegar canción / Editar como texto" (ver components/EditorTextoCancion.jsx). Sin letra todavía =
  // modo pegar (cuadro vacío); con letra = la canción completa como texto.
  const sinLetra = Object.values(draft.blocks).every((b) => !(b.lines || []).some((l) => String(l).trim()));
  // Lo que el cuadro "Escribir" sugirió la última vez (tonalidad/título): si la persona no lo cambió a
  // mano, se va actualizando mientras escribe; si lo cambió, se respeta.
  const autoRef = useRef({ key: "", title: "" });
  const escribirTexto = ({ blocks, letra, defaultStructure, key, title }) => {
    setDraft((d) => {
      const auto = autoRef.current;
      const nuevoKey = key && (!d.key || d.key === auto.key) ? key : d.key;
      const nuevoTitulo = title && (!d.title.trim() || d.title === auto.title) ? title : d.title;
      if (nuevoKey === key) auto.key = key;
      if (nuevoTitulo === title) auto.title = title;
      // Artista es obligatorio para guardar; una canción escrita aquí no lo trae → "Unknown", como las demás.
      return { ...d, blocks, letra, defaultStructure, key: nuevoKey, title: nuevoTitulo, artist: d.artist.trim() ? d.artist : "Unknown" };
    });
  };

  // En celular, el teclado nativo se come la mitad inferior de la pantalla pero el navegador NO
  // achica el viewport donde vive esta barra "fixed" — se queda calculando su posición contra el
  // alto de pantalla COMPLETO (como si el teclado no existiera), así que termina tapada debajo del
  // teclado en vez de flotar justo encima, como sí hacen los teclados de acordes de apps nativas.
  // window.visualViewport sí conoce el alto REAL visible (descontando el teclado) — se usa para
  // empujar la barra hacia arriba exactamente lo que el teclado ocupa.
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onViewportChange = () => {
      const inset = window.innerHeight - vv.height - vv.offsetTop;
      // Un umbral chico filtra los cambios normales de la barra de direcciones del navegador al
      // hacer scroll (unos pocos px) para que la barra no "salte" cuando en realidad no hay teclado.
      setKeyboardInset(inset > 100 ? inset : 0);
    };
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    onViewportChange();
    return () => { vv.removeEventListener("resize", onViewportChange); vv.removeEventListener("scroll", onViewportChange); };
  }, []);

  // Avisa al contenedor si hay cambios sin guardar (para el guard de "atrás" con confirmación) y le
  // deja siempre a mano el borrador actual (para el botón "Guardar y salir" de esa confirmación). Todo
  // en un solo efecto sin dependencias: la limpieza de la render anterior corre justo antes que este
  // efecto, así que solo queda "sucio" en falso cuando de verdad se desmonta (nada la pisa después).
  useEffect(() => {
    if (draftGetterRef) draftGetterRef.current = () => draft;
    if (onDirtyChange) onDirtyChange(JSON.stringify(draft) !== initialSnapshotRef.current);
    return () => { if (onDirtyChange) onDirtyChange(false); if (draftGetterRef) draftGetterRef.current = null; };
  });

  const blockKeys = Object.keys(draft.blocks);
  const setBlockField = (key, field, value) => setDraft((d) => ({ ...d, blocks: { ...d.blocks, [key]: { ...d.blocks[key], [field]: value } } }));
  const setBlockLines = (key, text) => setBlockField(key, "lines", text.split("\n"));

  // Agrega varias secciones de una (ver AddSectionsModal) — cada una con su propio key único aunque
  // se hayan creado en el mismo tick (Date.now() solo no alcanza para eso).
  const addSections = (list) => {
    setDraft((d) => {
      const blocks = { ...d.blocks };
      const letra = { ...d.letra };
      list.forEach((s, i) => {
        const key = `b${Date.now()}_${i}`;
        blocks[key] = { badge: s.badge, label: s.label, bars: 8, lines: [""] };
        letra[key] = [[""]];
      });
      return { ...d, blocks, letra };
    });
  };
  // Mover partes en Contenido (pedido de Eldin, 2026-11-05): ej. empezó por el verso y luego quiere la
  // intro hasta arriba. Cambia solo el orden en el editor (y en cómo se guardan), no la Estructura.
  const moverBloque = (desde, destino) => setDraft((d) => {
    const keys = Object.keys(d.blocks);
    if (destino < 0 || destino >= keys.length || desde === destino) return d;
    const [k] = keys.splice(desde, 1);
    keys.splice(destino, 0, k);
    const letra = Object.fromEntries([...keys.filter((x) => d.letra?.[x]).map((x) => [x, d.letra[x]]), ...Object.entries(d.letra || {}).filter(([x]) => !keys.includes(x))]);
    return { ...d, blocks: Object.fromEntries(keys.map((x) => [x, d.blocks[x]])), letra };
  });
  const arrastreContenido = useArrastreLista({ habilitado: true, onReorder: moverBloque });
  const removeBlock = (key) => setDraft((d) => {
    const blocks = { ...d.blocks }; delete blocks[key];
    const letra = { ...d.letra }; delete letra[key];
    return { ...d, blocks, letra, defaultStructure: d.defaultStructure.filter((k) => k !== key) };
  });

  const insertChord = (chord) => {
    let key = activeBlockKey;
    if (!key || !draft.blocks[key]) key = blockKeys[0];
    if (!key) return;
    const el = textareaRefs.current[key];
    const text = draft.blocks[key].lines.join("\n");
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const insertion = `[${chord}]`;
    setBlockLines(key, text.slice(0, start) + insertion + text.slice(end));
    setActiveBlockKey(key);
    requestAnimationFrame(() => {
      const el2 = textareaRefs.current[key];
      if (el2) { el2.focus(); const pos = start + insertion.length; el2.setSelectionRange(pos, pos); }
    });
  };

  // Retroceso con el cursor justo después del "]" de un acorde "[Am7]" borra el acorde entero. Borrar
  // desde adentro del acorde sigue siendo letra por letra, para poder corregirlo (ej. [G] → [Gm]).
  // Se detecta comparando el texto antes/después en onChange y no en keydown, porque los teclados de
  // Android no siempre reportan la tecla de borrar como "Backspace".
  const onContentChange = (key, e) => {
    const prev = draft.blocks[key].lines.join("\n");
    const next = e.target.value;
    const pos = e.target.selectionStart;
    const inputType = e.nativeEvent && e.nativeEvent.inputType;
    const isBackspace = !inputType || inputType === "deleteContentBackward";
    if (isBackspace && prev[pos] === "]" && next.length === prev.length - 1 && prev.slice(0, pos) + prev.slice(pos + 1) === next) {
      const chordRe = /\[[^[\]\n]*\]/g;
      let m;
      while ((m = chordRe.exec(prev))) {
        if (pos === m.index + m[0].length - 1) {
          setBlockLines(key, prev.slice(0, m.index) + prev.slice(m.index + m[0].length));
          requestAnimationFrame(() => {
            const el = textareaRefs.current[key];
            if (el) el.setSelectionRange(m.index, m.index);
          });
          return;
        }
      }
    }
    setBlockLines(key, next);
  };

  const entries = groupConsecutive(draft.defaultStructure);
  const setEntries = (newEntries) => setDraft((d) => ({ ...d, defaultStructure: expandEntries(newEntries) }));
  const changeCount = (idx, delta) => {
    const arr = [...entries]; arr[idx] = { ...arr[idx], count: Math.max(0, arr[idx].count + delta) };
    setEntries(arr.filter((e) => e.count > 0));
  };
  // Reordenar la estructura igual que el Setlist (pedido de Eldin, 2026-10-08): se agarra la sección
  // desde cualquier parte (mouse: presionar y mover; dedo: mantener presionado) — sin flechitas.
  const arrastreEstructura = useArrastreLista({
    habilitado: true,
    onReorder: (desde, destino) => { const arr = [...entries]; const [movida] = arr.splice(desde, 1); arr.splice(destino, 0, movida); setEntries(arr); },
  });
  const addEntry = (key) => setEntries([...entries, { key, count: 1 }]);

  const canSave = draft.title.trim() && draft.key.trim() && draft.artist.trim();
  // Guarda contra tocar "Guardar" varias veces seguidas (típico en celular, cuando no queda claro al
  // toque si ya registró) — para una canción NUEVA, cada tap disparaba su propio insert antes de que el
  // primero terminara y la pantalla navegara afuera, dejando la misma canción duplicada/triplicada.
  const [isSaving, setIsSaving] = useState(false);
  const handleSaveClick = () => {
    if (isSaving) return;
    setIsSaving(true);
    // onSave ya avisa con una alerta si falla (ver saveSong) — acá solo importa reactivar el botón,
    // así que el rechazo se descarta a propósito en vez de dejarlo como "unhandled rejection".
    Promise.resolve(onSave(draft)).catch(() => {}).finally(() => setIsSaving(false));
  };

  return (
    <div style={{ padding: 20, maxWidth: subTab === "escribir" ? 1200 : 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      {/* Fijo al hacer scroll: así "Guardar" queda siempre a mano después de agregar bloques, acordes
          o diapositivas más abajo, sin tener que volver a subir hasta el principio. */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--wf-bg)", paddingBottom: 10, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button onClick={onCancel} style={iconGhost}><ArrowLeft size={16} /></button>
            <span style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 20, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song ? "Editar canción" : "Nueva canción"}</span>
          </div>
          <span style={{ flex: 1 }} />
          <button data-tour="cancion-guardar" disabled={!canSave || isSaving} onClick={handleSaveClick} style={{ ...primaryBtn, width: "auto", padding: "8px 18px", opacity: canSave && !isSaving ? 1 : 0.4, cursor: canSave && !isSaving ? "pointer" : "not-allowed" }}>{isSaving ? "Guardando…" : "Guardar"}</button>
        </div>

        <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--wf-divider)", marginTop: 14, overflowX: "auto", scrollbarWidth: "none" }}>
          {[["escribir", "Escribir"], ["detalles", "Detalles"], ["contenido", "Contenido"], ["estructura", "Estructura"], ["animacion", "Animación"]].map(([val, label]) => (
            <button key={val} data-tour={`cancion-${val === "escribir" ? "texto" : val}`} onClick={() => setSubTab(val)} style={{ background: "none", border: "none", padding: "0 0 10px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4, color: subTab === val ? "var(--wf-text)" : "var(--wf-faint)", borderBottom: subTab === val ? "2px solid #2F5FA8" : "2px solid transparent", cursor: "pointer" }}>{val === "escribir" && <PencilLine size={13} />}{label}</button>
          ))}
        </div>
      </div>

      {subTab === "escribir" && !canSave && !sinLetra && (
        <button onClick={() => setSubTab("detalles")} style={{ display: "block", width: "100%", textAlign: "left", background: "color-mix(in srgb, var(--wf-brand-accent) 10%, transparent)", border: "none", borderRadius: 12, padding: "8px 12px", marginBottom: 10, fontSize: 12.5, color: "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" }}>
          Para guardar falta {[!draft.title.trim() && "el título", !draft.key.trim() && "la tonalidad"].filter(Boolean).join(" y ") || "completar Detalles"} → <b>ir a Detalles</b>
        </button>
      )}
      {subTab === "escribir" && <EditorTextoCancion inline cancion={draft} nueva={sinLetra} onCambio={escribirTexto} />}
      {subTab === "detalles" && sinLetra && (
        <button onClick={() => setSubTab("escribir")} className="hoverable"
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", maxWidth: 480, textAlign: "left", border: "1.5px dashed var(--wf-brand-accent)", background: "color-mix(in srgb, var(--wf-brand-accent) 8%, transparent)", borderRadius: 16, padding: "12px 14px", marginBottom: 16, cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ClipboardPaste size={20} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontWeight: 800, fontSize: 14.5 }}>¿Ya tienes la canción escrita?</span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--wf-muted)" }}>Escríbela o pégala completa en la pestaña Escribir, con o sin acordes, y se arma sola.</span>
          </span>
        </button>
      )}
      {subTab === "detalles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
          <Field label="Título" required><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Introduce un título" style={inputStyle} /></Field>
          <Field label="Tempo"><input value={draft.tempo} onChange={(e) => setDraft({ ...draft, tempo: e.target.value })} placeholder="Introduce el tempo" style={inputStyle} /></Field>
          <Field label="Compás">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {COMPASES.map((c) => (
                <button key={c} type="button" onClick={() => setDraft({ ...draft, compas: draft.compas === c ? "" : c })} style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, border: "none", background: draft.compas === c ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: draft.compas === c ? "var(--wf-on-brand-accent)" : "var(--wf-text)", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>{c}</button>
              ))}
            </div>
            <span style={{ display: "block", fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>Opcional. Toca el elegido otra vez para quitarlo.</span>
          </Field>
          <Field label="Tonalidad" required>
            {canEditKey ? (
              <select value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} style={inputStyle}>
                <option value="">Selecciona tonalidad</option>
                {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            ) : (
              <div style={{ ...inputStyle, color: "var(--wf-muted)", background: "var(--wf-hover)" }}>
                {draft.key || "Sin definir"}
                <span style={{ display: "block", fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>Solo un administrador puede cambiar la tonalidad definitiva de la canción.</span>
              </div>
            )}
          </Field>
          <Field label="Artista" required><input value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} placeholder="Elegir artista" style={inputStyle} /></Field>
          <Field label="Temas"><input value={draft.themes} onChange={(e) => setDraft({ ...draft, themes: e.target.value })} placeholder="Ej. Adoración, Fe" style={inputStyle} /></Field>
          <Field label="Clasificación" required>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {clasificacionesActuales.map(({ clave: key, nombre }) => ({ key, c: { label: nombre } })).map(({ key, c }) => (
                <button key={key} type="button" onClick={() => setDraft({ ...draft, category: key })} style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, border: "none", background: draft.category === key ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: draft.category === key ? "var(--wf-brand-primary)" : "var(--wf-text)", cursor: "pointer" }}>{c.label}</button>
              ))}
            </div>
            <span style={{ display: "block", fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>Define a qué bloque del Setlist se manda esta canción al agregarla{(() => { const b = clasificacionesActuales.find((c) => c.clave === draft.category)?.bloque; return b ? ` (esta va a "${b}")` : " (esta va al final)"; })()}.</span>
          </Field>
        </div>
      )}

      {subTab === "contenido" && (
        <div style={{ paddingBottom: draft.key ? 166 : 0 }}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 14 }}>Escribe la letra con los acordes en formato <code style={{ color: "#1F8A73" }}>[Acorde]</code> justo antes de la sílaba, o toca un acorde de la barra de abajo para insertarlo donde esté el cursor. Esto es lo que ve el músico.</div>

          {!draft.key && (
            <div style={{ fontSize: 12, color: "var(--wf-faint)", marginBottom: 14 }}>Elige una tonalidad en "Detalles" para ver aquí los acordes que puedes usar.</div>
          )}

          {blockKeys.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--wf-faint)", fontSize: 13, padding: "40px 0" }}>
              No se añadieron secciones,{" "}
              <button onClick={() => setShowAddSections(true)} style={{ background: "none", border: "none", color: "#2F5FA8", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>añadir secciones</button>
            </div>
          )}

          {blockKeys.length > 1 && <div style={{ fontSize: 11.5, color: "var(--wf-faint)", marginBottom: 8 }}>Para cambiar el orden de las partes, usa las flechas o arrastra la parte desde su barra de arriba.</div>}
          {blockKeys.map((key, idx) => (
            <div key={key} data-parte={key} {...arrastreContenido.filaProps(idx)} style={{ background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: 14, marginBottom: 10, ...arrastreContenido.estiloFila(idx) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                {blockKeys.length > 1 && <GripVertical size={14} color="var(--wf-border-soft)" style={{ flexShrink: 0, cursor: "grab" }} />}
                <input data-no-arrastre value={draft.blocks[key].badge} onChange={(e) => setBlockField(key, "badge", e.target.value)} style={{ ...inputStyle, width: 46, textAlign: "center", padding: "6px 4px" }} />
                <input data-no-arrastre value={draft.blocks[key].label} onChange={(e) => setBlockField(key, "label", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <input data-no-arrastre type="number" min={1} value={draft.blocks[key].bars || 8} onChange={(e) => setBlockField(key, "bars", Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 48, textAlign: "center", padding: "6px 4px" }} />
                  <span style={{ fontSize: 10, color: "var(--wf-faint)", whiteSpace: "nowrap" }}>compases</span>
                </div>
                {blockKeys.length > 1 && (
                  <>
                    <button onClick={() => moverBloque(idx, idx - 1)} disabled={idx === 0} aria-label={`Subir ${draft.blocks[key].label}`} title="Subir" style={{ ...iconGhost, opacity: idx === 0 ? 0.3 : 1 }}><ChevronUp size={15} /></button>
                    <button onClick={() => moverBloque(idx, idx + 1)} disabled={idx === blockKeys.length - 1} aria-label={`Bajar ${draft.blocks[key].label}`} title="Bajar" style={{ ...iconGhost, opacity: idx === blockKeys.length - 1 ? 0.3 : 1 }}><ChevronDown size={15} /></button>
                  </>
                )}
                <button onClick={() => removeBlock(key)} aria-label={`Quitar ${draft.blocks[key].label}`} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
              </div>
              <textarea
                data-no-arrastre
                ref={(el) => { textareaRefs.current[key] = el; }}
                onFocus={() => setActiveBlockKey(key)}
                value={draft.blocks[key].lines.join("\n")}
                onChange={(e) => onContentChange(key, e)}
                rows={draft.blocks[key].lines.length + 1}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 8, border: activeBlockKey === key ? "1px solid #1F8A73" : "1px solid var(--wf-border)" }}
              />
              <div style={{ marginTop: 4 }}>
                {draft.blocks[key].lines.map((l, i) => <ChordsAboveLyrics key={i} raw={l} />)}
              </div>
            </div>
          ))}
          {blockKeys.length > 0 && (
            <button onClick={() => setShowAddSections(true)} className="hoverable" style={addBtnStyle}><Plus size={14} /> Agregar secciones</button>
          )}
        </div>
      )}

      {subTab === "animacion" && <EditorAnimacionCancion draft={draft} setDraft={setDraft} />}

      {subTab === "estructura" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 8 }}><ListMusic size={13} /> ESTRUCTURA ACTUAL</div>
            {entries.map((e, idx) => (
              <div key={idx} {...arrastreEstructura.filaProps(idx)} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 12, padding: "8px 10px", marginBottom: 6, ...arrastreEstructura.estiloFila(idx) }}>
                <GripVertical size={14} color="var(--wf-border-soft)" />
                <span style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--wf-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{draft.blocks[e.key]?.badge}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{draft.blocks[e.key]?.label}</span>
                <button onClick={() => changeCount(idx, -1)} style={iconGhost}><Minus size={13} /></button>
                <span style={{ fontSize: 12, width: 22, textAlign: "center" }}>x{e.count}</span>
                <button onClick={() => changeCount(idx, 1)} style={iconGhost}><Plus size={13} /></button>
              </div>
            ))}
            {entries.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12 }}>Agrega bloques desde la derecha.</div>}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 8 }}><ListMusic size={13} /> ESTRUCTURAS DISPONIBLES</div>
            {blockKeys.map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 12, padding: "8px 10px", marginBottom: 6 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--wf-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{draft.blocks[key].badge}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{draft.blocks[key].label}</span>
                <button onClick={() => addEntry(key)} style={iconGhost}><Plus size={15} color="var(--wf-brand-accent)" /></button>
              </div>
            ))}
            {blockKeys.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12 }}>Primero agrega secciones en la pestaña Contenido.</div>}
          </div>
        </div>
      )}

      {/* Barra de acordes: fija arriba de la nav, como una barra de accesorios de teclado (estilo
          OnStage). No vive en el flujo normal a propósito — así el scroll de las secciones de la
          canción nunca la arrastra, y siempre queda lista para tocar un acorde. Se desliza en
          horizontal con el dedo (overflowX) en vez de envolver en varias líneas. */}
      {subTab === "contenido" && draft.key && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: keyboardInset > 0 ? keyboardInset : "var(--bottom-nav-height, 78px)", background: "var(--wf-card)", borderTop: "1px solid var(--wf-divider)", boxShadow: "0 -4px 14px rgba(22,50,79,0.1)", padding: "8px 0 10px", zIndex: 45 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>ACORDES DE {draft.key.toUpperCase()} <span style={{ fontWeight: 500, color: "var(--wf-faint)" }}>· desliza para ver más</span></div>
            <div className="chordbar-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", alignItems: "stretch" }}>
              {acordesDeTonalidad(draft.key).map((g, gi) => (
                <div key={g.titulo} style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "stretch", paddingLeft: gi === 0 ? 0 : 8, borderLeft: gi === 0 ? "none" : "1px solid var(--wf-divider)" }}>
                  <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 9, fontWeight: 700, color: "var(--wf-faint)", textTransform: "uppercase", textAlign: "center" }}>{g.titulo}</span>
                  {g.acordes.map((c) => (
                    <button key={c.chord + c.grado} onClick={() => insertChord(c.chord)} className="hoverable" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "8px 12px", cursor: "pointer" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{c.chord}</span>
                      <span style={{ fontSize: 10, color: "var(--wf-faint)", whiteSpace: "nowrap" }}>{c.grado}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showAddSections && <AddSectionsModal existingBlocks={draft.blocks} onClose={() => setShowAddSections(false)} onAdd={addSections} />}
    </div>
  );
}
