// Piezas que usan varias pantallas (estilos de botones, ventana base, constantes de la proyección…). Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { Music, BookOpen, Image as ImgIcon, ListMusic, X } from "lucide-react";
import { parseIsoDateLocal, todayLocal, MONTH_NAMES_FULL } from "../lib/dates.js";
import { saveCache, loadCache } from "../lib/offlineCache.js";
import { guardarCapituloOffline, obtenerCapituloOffline } from "../lib/bibleOfflineStore.js";
import { bloquesDelCulto } from "../lib/ordenCulto.js";
import { createPortal } from "react-dom";

// ---------- Acordes diatónicos de una tonalidad (triadas + con séptima) ----------
export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ---------- Transporte de acordes (tonalidad por evento + ajuste personal del músico) ----------
const FLAT_TO_SHARP = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

function normalizeRoot(root) {
  return FLAT_TO_SHARP[root] || root;
}

// Diferencia en semitonos (0-11) entre la raíz de dos tonalidades; ignora si son mayor/menor.
export function semitoneShift(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const fromIdx = NOTES.indexOf(normalizeRoot(fromKey.replace(/m$/, "")));
  const toIdx = NOTES.indexOf(normalizeRoot(toKey.replace(/m$/, "")));
  if (fromIdx === -1 || toIdx === -1) return 0;
  return ((toIdx - fromIdx) % 12 + 12) % 12;
}

export function transposeChordToken(chord, semitones) {
  if (!semitones) return chord;
  const match = chord.match(/^([A-G])(#|b)?(.*)$/);
  if (!match) return chord;
  const [, letter, accidental, rest] = match;
  const idx = NOTES.indexOf(normalizeRoot(`${letter}${accidental || ""}`));
  if (idx === -1) return chord;
  const shifted = NOTES[((idx + semitones) % 12 + 12) % 12];
  const bassMatch = rest.match(/^([^/]*)\/([A-G])(#|b)?(.*)$/);
  if (bassMatch) {
    const [, suffix, bLetter, bAccidental, bRest] = bassMatch;
    const bIdx = NOTES.indexOf(normalizeRoot(`${bLetter}${bAccidental || ""}`));
    const bShifted = bIdx === -1 ? `${bLetter}${bAccidental || ""}` : NOTES[((bIdx + semitones) % 12 + 12) % 12];
    return `${shifted}${suffix}/${bShifted}${bRest}`;
  }
  return `${shifted}${rest}`;
}

export function transposeLine(raw, semitones) {
  if (!semitones) return raw;
  return raw.replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChordToken(chord, semitones)}]`);
}

// ---------- Librería de canciones (estado inicial) ----------
// Clasificaciones de canción: cada iglesia define las suyas (iglesias.categorias_canciones, editable
// desde Canciones → botón de ajustes junto a los filtros). Cada una dice a qué bloque del Setlist se
// manda sola la canción al agregarla (ver addSong). "clave" es lo que se guarda en
// canciones.categoria y nunca cambia, aunque se renombre la clasificación. Esta lista es solo el
// respaldo si la iglesia todavía no tiene ninguna (mismo valor que el default de la base).
export const CLASIFICACIONES_DEFAULT = [
  { clave: "himno", nombre: "Himno", bloque: "Alabanza" },
  { clave: "corito", nombre: "Corito", bloque: "Alabanza" },
  { clave: "especial", nombre: "Canto especial", bloque: "Alabanza" },
  { clave: "adoracion", nombre: "Adoración", bloque: "Alabanza" },
];

// Clasificaciones de la iglesia con sesión abierta. Se actualiza al inicio de cada render de
// WorshipFlowPrototype (antes de que se rendericen sus hijos), así SongEditor, SetlistPane e
// isWorshipBlock la leen directo sin pasarla como prop por varios componentes intermedios.
// Se cambia con fijarClasificacionesActuales (una variable de otro archivo no se puede reasignar desde
// afuera, y esta parte vive en un archivo distinto del componente principal).
export let clasificacionesActuales = CLASIFICACIONES_DEFAULT;

export function fijarClasificacionesActuales(lista) { clasificacionesActuales = lista; }

// Versiones disponibles a través de la Biblia completa y buscable (ver BibleModal). "RVR1960"/"NVI"/"NTV" son
// las que pediste; "TLA"/"DHH" no están disponibles en la fuente de datos gratuita usada por el prototipo, así
// que se agregaron "PDT" (también en lenguaje sencillo, como TLA) y "LBLA" (más literal, como DHH) en su lugar.
// En producción, cuando haya backend propio, esto se reemplaza por la fuente de texto bíblico que se contrate.
export const BIBLE_VERSIONS = [
  { code: "RV1960", label: "Reina-Valera 1960" },
  // NVI quitada (2026-10-21): bolls.life ya no la tiene — Biblica se lo prohibió y en su lugar devuelve
  // un mensaje de protesta en cada versículo, que salía proyectado tal cual.
  { code: "NTV", label: "Nueva Traducción Viviente" },
  { code: "PDT", label: "Palabra de Dios para Todos" },
  { code: "LBLA", label: "La Biblia de las Américas" },
];

export const TYPE_META = {
  cancion: { label: "Canción", color: "var(--wf-brand-accent)", icon: Music },
  biblia: { label: "Versículo", color: "#2F5FA8", icon: BookOpen },
  slide: { label: "Slide", color: "#B15EA0", icon: ImgIcon },
  seccion: { label: "Bloque", color: "#5661B3", icon: ListMusic },
};

export const LIVE_THEMES = {
  stage: { label: "Escenario", bg: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)" },
  azul: { label: "Azul noche", bg: "radial-gradient(ellipse at center 40%, #0D2340 0%, #01050A 70%)" },
  calido: { label: "Cálido", bg: "radial-gradient(ellipse at center 40%, #3A2416 0%, #0D0704 70%)" },
  puro: { label: "Negro puro", bg: "#000000" },
};

// ---------- Ajustes finos de la letra en vivo (pedido de Eldin, 2026-10-08: que cada iglesia lo deje
// a su gusto). Todos opcionales dentro de liveStyle — sin valor, la proyección se ve como siempre:
//   interlineado (número, ej. 1.35) · espaciado (em, ej. 0.05) · sombra (clave de LIVE_SOMBRAS)
//   oscurecer (0–0.85, sobre imagen/video de fondo) · posicion (arriba/centro/abajo) · alineacion
// Las sombras van en "em" para que se vean igual de proporcionadas en la mini-vista que en el TV.
export const LIVE_SOMBRAS = {
  ninguna: { label: "Ninguna", css: "none" },
  suave: { label: "Suave", css: "0 0.06em 0.25em rgba(0,0,0,0.55)" },
  fuerte: { label: "Fuerte", css: "0 0.08em 0.4em rgba(0,0,0,0.9), 0 0.03em 0.08em rgba(0,0,0,0.9)" },
  contorno: { label: "Contorno", css: "-0.035em -0.035em 0 #000, 0.035em -0.035em 0 #000, -0.035em 0.035em 0 #000, 0.035em 0.035em 0 #000, 0 0.06em 0.2em rgba(0,0,0,0.6)" },
};

export const LIVE_POSICIONES = { arriba: { label: "Arriba", flex: "flex-start" }, centro: { label: "Centro", flex: "center" }, abajo: { label: "Abajo", flex: "flex-end" } };

export const LIVE_ALINEACIONES = { izquierda: { label: "Izquierda", flex: "flex-start", text: "left" }, centro: { label: "Centro", flex: "center", text: "center" }, derecha: { label: "Derecha", flex: "flex-end", text: "right" } };

export const LIVE_FONTS = {
  elegante: { label: "Elegante", family: "'Fraunces', serif", weight: 500, transform: "none", tracking: "normal" },
  editorial: { label: "Editorial", family: "'Playfair Display', serif", weight: 600, transform: "none", tracking: "normal", italic: true },
  moderna: { label: "Moderna", family: "'Poppins', sans-serif", weight: 500, transform: "none", tracking: "normal" },
  minimalista: { label: "Minimalista", family: "'Montserrat', sans-serif", weight: 300, transform: "none", tracking: "0.3px" },
  audaz: { label: "Audaz", family: "'Poppins', sans-serif", weight: 800, transform: "uppercase", tracking: "0.5px" },
  impacto: { label: "Impacto", family: "'Bebas Neue', sans-serif", weight: 400, transform: "uppercase", tracking: "1px" },
  condensada: { label: "Condensada", family: "'Oswald', sans-serif", weight: 600, transform: "uppercase", tracking: "0.5px" },
  redondeada: { label: "Redondeada", family: "'Quicksand', sans-serif", weight: 700, transform: "none", tracking: "normal" },
  clasica: { label: "Clásica", family: "Georgia, 'Times New Roman', serif", weight: 400, transform: "none", tracking: "normal" },
  manuscrita: { label: "Manuscrita", family: "'Caveat', cursive", weight: 600, transform: "none", tracking: "normal" },
  script: { label: "Script", family: "'Dancing Script', cursive", weight: 700, transform: "none", tracking: "normal" },
  monoespaciada: { label: "Monoespaciada", family: "'JetBrains Mono', monospace", weight: 600, transform: "none", tracking: "0.5px" },
  // 8 más (pedido de Eldin, 2026-10-05: "algo parecido a las de ProPresenter") -- completan las
  // familias que todavía faltaban: una sans fina, dos "impacto" distintos entre sí, un serif cálido,
  // un serif clásico/grabado, un marcador grueso, una condensada más suave que Oswald, y un script
  // más juguetón que Dancing Script.
  fina: { label: "Fina", family: "'Raleway', sans-serif", weight: 300, transform: "none", tracking: "0.4px" },
  negrita: { label: "Extra negrita", family: "'Archivo Black', sans-serif", weight: 400, transform: "none", tracking: "normal" },
  cartel: { label: "Cartel", family: "'Anton', sans-serif", weight: 400, transform: "uppercase", tracking: "0.5px" },
  serifCalida: { label: "Serif cálida", family: "'Bitter', serif", weight: 600, transform: "none", tracking: "normal" },
  grabada: { label: "Clásica grabada", family: "'Cinzel', serif", weight: 600, transform: "none", tracking: "0.5px" },
  marcador: { label: "Marcador", family: "'Permanent Marker', cursive", weight: 400, transform: "none", tracking: "normal" },
  condensadaSuave: { label: "Condensada suave", family: "'Barlow Condensed', sans-serif", weight: 600, transform: "none", tracking: "0.3px" },
  scriptJuvenil: { label: "Script juvenil", family: "'Pacifico', cursive", weight: 400, transform: "none", tracking: "normal" },
};

// Objeto "evento" liviano para cuando se transmite sin un evento del calendario detrás (ver
// startFreeEvent) — referencia estable a nivel de módulo para no invalidar el useMemo de `slides` en
// cada render con un objeto nuevo. serviceOrder vacío: no hay plan, todo el contenido es improvisado.
export const EVENTO_LIBRE = { id: null, title: "Transmisión libre", serviceOrder: [] };

export const DEFAULT_COVERS = [
  "linear-gradient(135deg, var(--wf-brand-primary) 0%, #2F5FA8 60%, var(--wf-brand-accent) 100%)",
  "linear-gradient(135deg, var(--wf-brand-primary) 0%, #1F8A73 60%, #2E86AB 100%)",
  "linear-gradient(135deg, var(--wf-brand-primary) 0%, #B15EA0 60%, var(--wf-brand-accent) 100%)",
];

export const nextMinistryChildId = () => crypto.randomUUID();

// Un bloque "pertenece" al equipo de alabanza si su título incluye Alabanza o Adoración, o el nombre
// de cualquier bloque al que esta iglesia manda sus canciones — así
// una iglesia que llama distinto a ese momento del culto no pierde el equipo de alabanza del bloque.
// (ver clasificacionesActuales)
export function isWorshipBlock(item) {
  if (item.type !== "seccion") return false;
  if (/alabanza|ador/i.test(item.title || "")) return true;
  const titulo = normalizarTitulo(item.title);
  return clasificacionesActuales.some((c) => c.bloque && titulo.includes(normalizarTitulo(c.bloque)));
}

// Nombre legible de un ítem del Setlist para notificaciones y para "qué me toca" en la miniatura de un
// evento — alguien puede tener varios cargos distintos en el mismo evento (ej. Multimedia Y una
// canción), así que cada uno necesita decir CUÁL es, no solo "tienes un encargo".
export function serviceItemLabel(item, library) {
  if (item.type === "seccion") return item.title || "Bloque";
  if (item.type === "cancion") return library.find((s) => s.id === item.songId)?.title || "Canción";
  if (item.type === "biblia") return `Lectura: ${item.reference}`;
  if (item.type === "slide") return item.title ? `Diapositiva: ${item.title}` : "Diapositiva";
  return "Ítem del Setlist";
}

// Lista de TODOS los cargos que una persona tiene en un evento (puede ser más de uno — ej. Multimedia Y
// además una canción) para mostrar "Te toca: ..." en su miniatura, en vez de solo un ícono de personas
// que no dice nada de qué le toca a ELLA específicamente.
export function misAsignacionesEnEvento(event, uid, library) {
  if (!uid) return [];
  const labels = [];
  (event.serviceOrder || []).forEach((item) => {
    if ((item.encargados || []).some((m) => m.usuarioId === uid)) labels.push(serviceItemLabel(item, library));
  });
  (event.worshipRoles || []).forEach((r) => {
    if ((r.members || []).some((m) => m.usuarioId === uid)) labels.push(r.name);
  });
  return labels;
}

// Quita tildes y pasa a minúsculas antes de buscar una palabra clave en un título — así "Prédica" o
// "Ofrenda" (singular, sin la "s" final) también coinciden con "predic"/"ofrenda", en vez de exigir
// que el título esté escrito exactamente como el patrón (acentos y plural incluidos).
const PATRON_TILDES = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

export function normalizarTitulo(s) {
  return (s || "").normalize("NFD").replace(PATRON_TILDES, "").toLowerCase();
}

// ¿Este bloque del Setlist está vinculado a un grupo (ministerio) que esta persona lidera?
// gruposQueLidero: Set con los ids de los ministerios donde la persona es líder.
export function lideraBloque(item, gruposQueLidero) {
  return !!(gruposQueLidero && item?.type === "seccion" && item.ministryId && gruposQueLidero.has(item.ministryId));
}

export function Field({ label, required, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label} {required && <span style={{ color: "#C23B32" }}>*</span>}</div>
      {children}
    </div>
  );
}

// Ensayo y nota de quien dirige la alabanza (pedido de Eldin, 2026-10-09). Lo ve todo el equipo de
// alabanza del evento (y los administradores); lo editan los administradores y quien dirige. Lo mismo
// aparece en el Inicio de cada músico/cantante (ver InicioView).
export function quienDirigeAlabanza(event) {
  for (const r of event?.worshipRoles || []) for (const m of r.members || []) if (m.lead) return m;
  return null;
}

export function textoEnsayo(event) {
  if (!event?.ensayoFecha && !event?.ensayoHora) return "";
  const partes = [];
  if (event.ensayoFecha) {
    const d = parseIsoDateLocal(event.ensayoFecha);
    const dias = d ? Math.round((d - todayLocal()) / 86400000) : null;
    const corta = d ? `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()]} ${d.getDate()} ${MONTH_NAMES_FULL[d.getMonth()].slice(0, 3).toLowerCase()}` : event.ensayoFecha;
    partes.push(event.ensayoFecha === event.date ? "El mismo día" : dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : corta);
  }
  if (event.ensayoHora) partes.push(formatHora12(event.ensayoHora));
  return partes.join(" · ");
}

function formatHora12(hora) {
  const m = String(hora || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hora || "";
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "a. m." : "p. m."}`;
}

// ---------- Biblia completa y buscable: se consulta en vivo (fetch) a la API pública bolls.life, así el
// operador navega Libro → Capítulo → Versículo(s) sin tener que escribir ni copiar/pegar el texto. Se
// cachea por versión a nivel de módulo para no repetir la descarga de la lista de libros en cada apertura. ----------
const bibleBooksCache = {};

// Si falla el pedido en vivo (sin internet, API caída) se cae a la última lista de libros guardada
// localmente — es un archivo chico (unos 66 nombres), así que basta con offlineCache. El texto de
// cada capítulo, mucho más pesado, vive aparte en IndexedDB (ver bibleOfflineStore.js).
export async function fetchBibleBooks(version) {
  if (bibleBooksCache[version]) return bibleBooksCache[version];
  try {
    const res = await fetch(`https://bolls.life/get-books/${version}/`);
    if (!res.ok) throw new Error("No se pudo cargar la lista de libros.");
    const data = await res.json();
    bibleBooksCache[version] = data;
    saveCache(`biblia_libros_${version}`, data);
    return data;
  } catch (e) {
    const cached = loadCache(`biblia_libros_${version}`);
    if (cached) { bibleBooksCache[version] = cached; return cached; }
    throw e;
  }
}

export async function fetchBibleChapter(version, bookId, chapter) {
  try {
    const res = await fetch(`https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`);
    if (!res.ok) throw new Error("No se pudo cargar el capítulo.");
    const data = await res.json();
    guardarCapituloOffline(version, bookId, chapter, data); // sin esperarlo: no atrasa la lectura por guardar
    return data;
  } catch (e) {
    const offline = await obtenerCapituloOffline(version, bookId, chapter);
    if (offline) return offline;
    throw e;
  }
}

// "¿En qué parte del culto va?" — fila de botones con los bloques del culto (pedido de Eldin,
// 2026-10-11). valor: id del bloque elegido o null (textoSinElegir: "Al final del culto", "Después de
// lo que estás viendo"...). Se usa en "+ Agregar" del Setlist y de la consola.
export function ElegirParteDelCulto({ orden, valor, onCambiar, textoSinElegir }) {
  // Lista desplegable (pedido de Eldin, 2026-10-11: mejor que burbujas).
  const bloques = bloquesDelCulto(orden);
  if (bloques.length === 0) return null;
  return (
    <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--wf-divider)" }}>
      <label htmlFor="parte-del-culto" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--wf-text)", marginBottom: 7 }}>¿En qué parte del culto va?</label>
      <select id="parte-del-culto" value={valor || ""} onChange={(e) => onCambiar(e.target.value || null)}
        style={{ ...inputStyle, fontSize: 14, fontWeight: 600, cursor: "pointer", borderColor: valor ? "var(--wf-brand-accent)" : undefined }}>
        <option value="">{textoSinElegir}</option>
        {bloques.map((b) => <option key={b.id} value={b.id}>{b.titulo}</option>)}
      </select>
    </div>
  );
}

export function ModalShell({ title, icon: Icon, color, onClose, children, alto = false }) {
  // Portal a document.body (no un <div> normal en el sitio donde se usa <ModalShell>) — "position:
  // fixed" por sí solo no basta: si algún ancestro tiene un transform activo (ej. SongView, que anima
  // transform al deslizar entre canciones del Setlist), ese ancestro se vuelve el "contenedor" del
  // fixed y el modal queda atrapado ahí en vez de la pantalla real — mezclado con el scroll de esa
  // vista, a veces cortado a la mitad. Un portal a <body> lo saca del todo de ese árbol, así que
  // siempre se ve completo y centrado en la pantalla real, sin importar desde dónde se abra.
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      {/* alto: usa casi toda la pantalla y deja que una lista de adentro (flex: 1) llene el espacio. */}
      <div style={alto
        ? { background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 16, padding: 18, width: "min(440px, calc(100vw - 20px))", height: "calc(100dvh - 24px)", maxHeight: "calc(100vh - 24px)", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }
        : { background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 16, padding: 20, width: 360, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={16} color={color} /><span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span></div>
          <button onClick={onClose} style={iconGhost}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------------- estilos compartidos ----------------
export const iconGhost = { background: "transparent", border: "none", color: "var(--wf-muted)", cursor: "pointer", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 };

export const miniBtnStyle = { display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "4px 8px", fontSize: 10, color: "#2F5FA8", cursor: "pointer" };

export const ghostToggleBtn = { fontSize: 12, fontWeight: 700, padding: "8px 12px", borderRadius: 12, border: "1px solid var(--wf-border)", background: "var(--wf-hover)", color: "var(--wf-heading)", cursor: "pointer" };

export const addBtnStyle = { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: "9px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };

export const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };

export const primaryBtn = { width: "100%", background: "var(--wf-brand-accent)", border: "none", borderRadius: 12, padding: "10px", fontSize: 13, fontWeight: 700, color: "var(--wf-on-brand-accent)", cursor: "pointer" };
