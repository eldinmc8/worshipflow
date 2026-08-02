import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import {
  Music, Mic2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus,
  Radio, ListMusic, BookOpen, Image as ImgIcon, Trash2, GripVertical,
  MonitorOff, X, Search, Sparkles, Calendar, MapPin, Users, Check,
  UserPlus, Paperclip, Play, ArrowLeft, Home, Heart, RefreshCw, Pencil,
  Star, LogOut, Settings, Download,
  ClipboardList, FolderOpen, ExternalLink, LayoutGrid, SkipBack, SkipForward, Copy, KeyRound, Bell,
} from "lucide-react";
import { listCancionesCompletas, guardarCancionDesdeEditor, deleteCancion } from "./lib/canciones.js";
import {
  listEventosCompletos, crearEventoCompleto, sincronizarServiceOrder, sincronizarWorshipRoles, deleteEvento, updateEvento,
} from "./lib/eventos.js";
import { listMinisteriosCompletos, crearMinisterio, actualizarLiderMinisterio, sincronizarPlan, sincronizarRecursos } from "./lib/ministerios.js";
import { updateLiveSession, clearLiveSession, getLiveSession, subscribeLiveSession } from "./lib/liveSession.js";
import { sincronizarRecordatorios } from "./lib/recordatorios.js";
import { listMisNotificaciones, marcarLeida, marcarTodasLeidas, subscribeNotificaciones, suscribirPush, desuscribirPush, estaSuscritoPush } from "./lib/notificaciones.js";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { getInstallState, subscribeInstallState, isIosSafari, promptInstall } from "./lib/pwaInstall.js";
import { parseIsoDateLocal, todayLocal, isUpcoming, compareByDay, MONTH_NAMES_FULL, MONTH_ABBR, DOW_LABELS, monthKey, monthLabelFromKey, formatFullDate, buildMonthWeeks } from "./lib/dates.js";

// ---------- Vista de celular: se activa sola según el ancho real de la pantalla, no un dispositivo fijo ----------
const MOBILE_BREAKPOINT = 768;
function useIsCompact() {
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isCompact;
}

// ---------- Utilidades de acordes/letra ----------
function stripChords(line) { return line.replace(/\[[^\]]+\]/g, ""); }
// La 'letra' de cada sección ahora es un ARRAY DE DIAPOSITIVAS, cada una con sus propias líneas.
// Al derivar desde Contenido, arranca como una sola diapositiva con todas las líneas de la sección.
function deriveLetra(blocks) {
  const out = {};
  Object.entries(blocks).forEach(([key, b]) => { out[key] = [b.lines.map(stripChords)]; });
  return out;
}
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

// ---------- Acordes diatónicos de una tonalidad (triadas + con séptima) ----------
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
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

// ---------- Transporte de acordes (tonalidad por evento + ajuste personal del músico) ----------
const FLAT_TO_SHARP = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
function normalizeRoot(root) {
  return FLAT_TO_SHARP[root] || root;
}
// Diferencia en semitonos (0-11) entre la raíz de dos tonalidades; ignora si son mayor/menor.
function semitoneShift(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const fromIdx = NOTES.indexOf(normalizeRoot(fromKey.replace(/m$/, "")));
  const toIdx = NOTES.indexOf(normalizeRoot(toKey.replace(/m$/, "")));
  if (fromIdx === -1 || toIdx === -1) return 0;
  return ((toIdx - fromIdx) % 12 + 12) % 12;
}
function transposeChordToken(chord, semitones) {
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
function transposeLine(raw, semitones) {
  if (!semitones) return raw;
  return raw.replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChordToken(chord, semitones)}]`);
}
// Devuelve una COPIA transportada de la canción para mostrarla en la tonalidad que se eligió para
// ese ítem del Setlist en particular (tonalidad_override), sin tocar la canción real de la
// biblioteca — a diferencia de transposeSong (que sí muta y guarda), esto es solo para lectura.
function songWithKeyOverride(song, overrideKey) {
  if (!song || !overrideKey || overrideKey === song.key) return song;
  const semitones = semitoneShift(song.key, overrideKey);
  const blocks = Object.fromEntries(Object.entries(song.blocks).map(([key, b]) => [key, { ...b, lines: b.lines.map((l) => transposeLine(l, semitones)) }]));
  return { ...song, key: overrideKey, blocks };
}

const KEY_OPTIONS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B", "Cm", "Dm", "Em", "Fm", "Gm", "Am", "Bm"];

// ---------- Librería de canciones (estado inicial) ----------
// Clasificación de la canción: determina a qué bloque del Setlist se manda automáticamente al agregarla
// (ver addSong) — Himno/Corito/Canto especial van al "Bloque de Alabanza"; Adoración va al "Bloque de Adoración".
const SONG_CATEGORIES = {
  himno: { label: "Himno", block: "Alabanza" },
  corito: { label: "Corito", block: "Alabanza" },
  especial: { label: "Canto especial", block: "Alabanza" },
  adoracion: { label: "Adoración", block: "Adoración" },
};
// Versiones disponibles a través de la Biblia completa y buscable (ver BibleModal). "RVR1960"/"NVI"/"NTV" son
// las que pediste; "TLA"/"DHH" no están disponibles en la fuente de datos gratuita usada por el prototipo, así
// que se agregaron "PDT" (también en lenguaje sencillo, como TLA) y "LBLA" (más literal, como DHH) en su lugar.
// En producción, cuando haya backend propio, esto se reemplaza por la fuente de texto bíblico que se contrate.
const BIBLE_VERSIONS = [
  { code: "RV1960", label: "Reina-Valera 1960" },
  { code: "NVI", label: "Nueva Versión Internacional" },
  { code: "NTV", label: "Nueva Traducción Viviente" },
  { code: "PDT", label: "Palabra de Dios para Todos" },
  { code: "LBLA", label: "La Biblia de las Américas" },
];
const BIBLE_QUICK = [
  { ref: "Salmos 100:1-2", version: "RV1960", text: "Toda la tierra celebra con gozo la presencia del Señor y sirve delante de él con alegría." },
  { ref: "Filipenses 4:6-7", version: "NVI", text: "No se inquieten por nada; en toda situación, presenten sus peticiones delante de Dios, y su paz cuidará sus corazones." },
  { ref: "Isaías 41:10", version: "RV1960", text: "No temas, porque yo estoy contigo; te sostengo con mi mano derecha." },
];

const TYPE_META = {
  cancion: { label: "Canción", color: "#E8821E", icon: Music },
  biblia: { label: "Versículo", color: "#2F5FA8", icon: BookOpen },
  slide: { label: "Slide", color: "#B15EA0", icon: ImgIcon },
  seccion: { label: "Bloque", color: "#5661B3", icon: ListMusic },
};

// ---------- Color por sección para el grid de diapositivas del panel Multimedia (estilo "grid de shows" tipo FreeShow) ----------
const sectionColorFor = (s) => {
  if (s.type !== "cancion") return TYPE_META[s.type]?.color || "#5B6472";
  const label = (s.blockLabel || "").toLowerCase();
  if (label.includes("coro")) return "#B15EA0"; // orquídea
  if (label.includes("puente")) return "#5661B3"; // índigo
  if (label.includes("estrofa") || label.includes("verso")) return "#1F8A73"; // teal
  return "#5B6472";
};

// ---------- Estilo en vivo de la proyección: fondo y tipografía, ajustables por multimedia mientras transmite ----------
const LIVE_THEMES = {
  stage: { label: "Escenario", bg: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)" },
  azul: { label: "Azul noche", bg: "radial-gradient(ellipse at center 40%, #0D2340 0%, #01050A 70%)" },
  calido: { label: "Cálido", bg: "radial-gradient(ellipse at center 40%, #3A2416 0%, #0D0704 70%)" },
  puro: { label: "Negro puro", bg: "#000000" },
};
const LIVE_FONTS = {
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
};

// UUIDs reales (no ids falsos tipo "it301"): así cualquier fila creada en el cliente ya sirve
// directo como primary key real en Supabase, sin tener que "reconciliar" un id falso con el real
// que devolvería el servidor después de guardar.
const nextId = () => crypto.randomUUID();
const nextSongId = () => crypto.randomUUID();

// ---------- Equipo / iglesia ----------
const TEAM_NAME = "Iglesia Jesús El Buen Pastor";

// ---------- Convierte una canción + estructura en diapositivas proyectables (planeada o improvisada) ----------
function songToSlides(idPrefix, song, structure) {
  const out = [];
  // "structure" (el orden guardado en el Setlist) o song.defaultStructure (pestaña Estructura de la
  // canción) pueden venir vacíos — ej. una canción a la que nunca se le llenó "Estructura" guarda un
  // arreglo [] ahí, y como [] es verdadero en JS, el "||" de abajo nunca caía al respaldo: la canción
  // quedaba SIN diapositivas en vivo aunque su pestaña Letra sí tuviera contenido. Si ambos vienen
  // vacíos, se usan todas las secciones que la canción sí tenga (en el orden en que existen) — mejor
  // un orden razonable por defecto que una canción muda en la proyección.
  const order = structure && structure.length > 0
    ? structure
    : song.defaultStructure && song.defaultStructure.length > 0
      ? song.defaultStructure
      : Object.keys(song.blocks || {});
  order.forEach((blockKey, i) => {
    const block = song.blocks[blockKey];
    if (!block) return;
    const slideGroups = (song.letra && song.letra[blockKey]) || [block.lines.map(stripChords)];
    slideGroups.forEach((lines, si) => {
      out.push({
        slideId: `${idPrefix}-${i}-${si}`, type: "cancion", songTitle: song.title,
        blockLabel: slideGroups.length > 1 ? `${block.label} (${si + 1}/${slideGroups.length})` : block.label,
        lines,
      });
    });
  });
  return out;
}
// ---------- Construye slides proyectables. Usa 'letra' (diapositivas ya armadas) porque eso es lo que alimenta la proyección ----------
function buildSlides(serviceOrder, library) {
  const slides = [];
  serviceOrder.forEach((item) => {
    if (item.type === "cancion") {
      const song = library.find((s) => s.id === item.songId);
      if (!song) return;
      slides.push(...songToSlides(item.id, song, item.structure));
    } else if (item.type === "biblia") {
      slides.push({ slideId: item.id, type: "biblia", reference: item.reference, version: item.version, text: item.text, bookId: item.bookId, bookName: item.bookName, chapter: item.chapter, verseStart: item.verseStart, verseEnd: item.verseEnd });
    } else if (item.type === "slide") {
      slides.push({ slideId: item.id, type: "slide", title: item.title, subtitle: item.subtitle, bg: item.bg, bgType: item.bgType, videoUrl: item.videoUrl });
    }
  });
  return slides;
}

const DEFAULT_COVERS = [
  "linear-gradient(135deg, #16324F 0%, #2F5FA8 60%, #E8821E 100%)",
  "linear-gradient(135deg, #16324F 0%, #1F8A73 60%, #2E86AB 100%)",
  "linear-gradient(135deg, #16324F 0%, #B15EA0 60%, #E8821E 100%)",
];
const MINISTRY_COLORS = ["#E8821E", "#2E86AB", "#B15EA0", "#1F8A73", "#C23B32", "#5661B3"];
const nextMinistryChildId = () => crypto.randomUUID();

// Nuevos ids al clonar un evento plantilla: si se copiaran los ids, chocarían en la base de datos real
// (items_servicio.id es su propia primary key). Los encargados se copian con la misma gente pero
// confirmación reiniciada a "pendiente" — es una semana distinta, hay que reconfirmar a cada quien.
function cloneServiceOrder(order) {
  return order.map((item) => ({
    ...item, id: nextId(),
    encargados: (item.encargados || []).map((m) => ({ ...m, id: nextId(), status: "pendiente" })),
  }));
}
// Mismo criterio para el equipo de alabanza compartido entre los bloques de Alabanza y Adoración.
function cloneWorshipRoles(roles) {
  return roles.map((r) => ({
    ...r, id: nextId(),
    members: r.members.map((m) => ({ ...m, id: nextId(), status: "pendiente" })),
  }));
}
// Y para los recordatorios de una plantilla: "enviado" siempre arranca en false — es un evento
// nuevo, todavía no se le mandó ningún recordatorio.
function cloneRecordatorios(reminders) {
  return (reminders || []).map((r) => ({ ...r, id: nextId(), enviado: false }));
}
// Un bloque "pertenece" al equipo de alabanza si su título incluye Alabanza o Adoración — mismo criterio
// que ya usa addSong para mandar canciones al bloque correcto (SONG_CATEGORIES).
function isWorshipBlock(item) {
  return item.type === "seccion" && /alabanza|ador/i.test(item.title || "");
}
// Un bloque "pertenece" a lectura bíblica/oración por el mismo criterio (título) — el encargado de
// ESE bloque en el evento puede agregar su propio versículo, aunque no sea administrador.
function isBibleReadingBlock(item) {
  return item.type === "seccion" && /lectura|oraci[oó]n/i.test(item.title || "");
}
// Limpieza es un privilegio aparte del resto del equipo: quien está asignado a este bloque solo ve
// este bloque, nada del resto del Setlist (ver CleaningOnlyPanel).
function isCleaningBlock(item) {
  return item.type === "seccion" && /limpieza/i.test(item.title || "");
}
// Vista reducida para quien solo tiene el privilegio de Limpieza en este evento: ni el Setlist
// completo, ni la biblioteca de canciones, ni botones de agregar — solo su propio bloque, de solo
// lectura (encargados incluidos), tal como se ve el resto de bloques cuando no se pueden editar.
function CleaningOnlyPanel({ block }) {
  return (
    <div style={{ flex: 1, padding: 20, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64707F", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 10 }}><Sparkles size={13} color="#5661B3" /> TU PRIVILEGIO EN ESTE EVENTO</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{block.title}</div>
        {block.description && <div style={{ fontSize: 13, color: "#33415A", marginBottom: 16 }}>{block.description}</div>}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 8 }}>EQUIPO ASIGNADO</div>
        {(block.encargados || []).length === 0 ? (
          <div style={{ color: "#8996A6", fontSize: 13 }}>Nadie asignado todavía.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {block.encargados.map((m, i) => (
              <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{m.n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                <span style={{ fontSize: 13 }}>{m.n}{m.lead && <span style={{ fontSize: 10, color: "#E8821E", fontWeight: 700 }}> · Encargado</span>}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorshipFlowPrototype({ userId, perfil, onGoToUsuarios }) {
  const isCompact = useIsCompact(); // vista de celular: en pantallas angostas se activan los layouts compactos y se oculta Multimedia
  const [tab, setTab] = useState("inicio"); // inicio | canciones | eventos | envivo | proyeccion
  // Multimedia y Pantalla son de escritorio (quien controla la proyección); si la pantalla se vuelve angosta
  // mientras estás ahí, regresa a Inicio en vez de dejarte en una pantalla que ya no debería ser alcanzable.
  useEffect(() => {
    if (isCompact && (tab === "envivo" || tab === "proyeccion")) setTab("inicio");
  }, [isCompact, tab]);
  // Canciones y Eventos arrancan vacíos y se cargan de verdad desde Supabase — ya no hay datos de
  // ejemplo del prototipo. Ministerios sigue siendo local por ahora (todavía no tiene tabla real).
  const [library, setLibrary] = useState([]);
  // El guardado automático por atrás físico/gesto (más abajo, junto al listener de popstate) vive
  // dentro de un efecto que se monta una sola vez, así que no puede leer `library`/`userId` del render
  // actual sin quedarse con el valor viejo del primer render (cuando `library` todavía estaba vacío) —
  // de ahí estas refs, mantenidas al día en cada render.
  const libraryRef = useRef(library);
  const userIdRef = useRef(userId);
  useEffect(() => { libraryRef.current = library; userIdRef.current = userId; }, [library, userId]);
  const [openSong, setOpenSong] = useState(null); // null = lista; { id, mode: 'view' | 'edit' }
  const [events, setEvents] = useState([]);
  const [datosListos, setDatosListos] = useState(false);
  const reloadLibrary = () => listCancionesCompletas().then(setLibrary).catch((e) => window.alert("No se pudo cargar el cancionero: " + e.message));
  useEffect(() => {
    Promise.all([
      listCancionesCompletas().then(setLibrary),
      listEventosCompletos().then(setEvents),
      listMinisteriosCompletos().then(setMinistries),
    ])
      .catch((e) => window.alert("No se pudieron cargar los datos: " + e.message))
      .finally(() => setDatosListos(true));
  }, []);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [blanked, setBlanked] = useState(false);
  // Contenido improvisado en vivo (versículo/canción/video que no están en el setlist): reemplaza al plan mientras esté activo.
  const [adHoc, setAdHoc] = useState(null); // { label, slides } | null
  const [adHocIdx, setAdHocIdx] = useState(0);
  const [showBibleForm, setShowBibleForm] = useState(false);
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [slideDraft, setSlideDraft] = useState({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "" });
  const [showSermonForm, setShowSermonForm] = useState(false);
  const [sermonPointText, setSermonPointText] = useState("");

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const [liveEventId, setLiveEventId] = useState(null);
  const [liveOwnerId, setLiveOwnerId] = useState(null); // usuario que inició la transmisión; solo esa persona puede finalizarla
  const liveEvent = events.find((e) => e.id === liveEventId);
  const slides = useMemo(() => (liveEvent ? buildSlides(liveEvent.serviceOrder, library) : []), [liveEvent, library]);
  const current = adHoc ? adHoc.slides[adHocIdx] : slides[activeIdx];
  const next = adHoc ? adHoc.slides[adHocIdx + 1] : slides[activeIdx + 1];

  // ---- Lectura bíblica en vivo: "Siguiente/Anterior versículo" y cambio de versión sin reabrir el buscador.
  // Solo funciona para versículos elegidos con el buscador de la Biblia (traen bookId/chapter) — los que se
  // escribieron a mano o son de "acceso rápido" no tienen cómo saber cuál es el próximo versículo. ----
  // Guarda en Supabase en segundo plano cada vez que cambia el setlist de un evento — el estado local
  // se actualiza al instante (para que la operación en vivo se sienta rápida) y la persistencia real
  // pasa por detrás, sin bloquear la interacción.
  const updateLiveOrder = (fn) => {
    let nuevoOrden = null;
    setEvents((evs) => evs.map((e) => {
      if (e.id !== liveEventId) return e;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) sincronizarServiceOrder(liveEventId, nuevoOrden).catch((err) => window.alert("No se pudo guardar el setlist: " + err.message));
  };
  // Para cuando a Multimedia se le olvidó agregar algo en el Setlist (un anuncio, etc.): agrega una slide
  // directo al plan en vivo (no al overlay "improvisado" temporal) y salta a proyectarla de inmediato.
  // `slides.length` (antes de agregar) es exactamente el índice donde queda la nueva, ya que se agrega al final.
  const addLiveSlide = (draft) => {
    updateLiveOrder((o) => [...o, { id: nextId(), type: "slide", ...draft }]);
    setAdHoc(null); setAdHocIdx(0); setBlanked(false);
    setActiveIdx(slides.length);
  };
  // Corregir texto de un versículo/slide/punto del bosquejo ya agregado (typos, etc.) — solo aplica a
  // slideId que son directamente el id del elemento del plan (biblia/slide), no a las de canción (que
  // vienen de la estructura de la canción, no del evento).
  const editLiveSlide = (slideId, patch) => updateLiveOrder((o) => o.map((item) => (item.id === slideId ? { ...item, ...patch } : item)));
  const applyBibleSlidePatch = (patch) => {
    if (adHoc) {
      setAdHoc((a) => ({ ...a, slides: a.slides.map((s, i) => (i === adHocIdx ? { ...s, ...patch } : s)) }));
    } else if (current) {
      updateLiveOrder((o) => o.map((item) => (item.id === current.slideId ? { ...item, ...patch } : item)));
    }
  };
  const navigateBibleVerse = async (direction) => {
    if (!current || current.type !== "biblia" || !current.bookId) return;
    const fromVerse = direction > 0 ? current.verseEnd : current.verseStart;
    try {
      const result = await fetchAdjacentBibleVerse(current.version, current.bookId, current.chapter, fromVerse, direction);
      if (!result) { window.alert(direction > 0 ? "Ya no hay más versículos después de este en el libro." : "Este ya es el primer versículo del libro."); return; }
      const bookName = result.bookName || current.bookName;
      applyBibleSlidePatch({ reference: `${bookName} ${result.chapter}:${result.verse}`, text: result.text, chapter: result.chapter, verseStart: result.verse, verseEnd: result.verse, bookName });
    } catch {
      window.alert("No se pudo cargar el versículo. Revisa tu conexión a internet.");
    }
  };
  const changeBibleVersion = async (newVersion) => {
    if (!current || current.type !== "biblia" || !current.bookId || current.version === newVersion) return;
    try {
      const [books, chapterVerses] = await Promise.all([fetchBibleBooks(newVersion), fetchBibleChapter(newVersion, current.bookId, current.chapter)]);
      const book = books.find((b) => b.bookid === current.bookId);
      const bookName = book?.name || current.bookName;
      const picked = chapterVerses.filter((v) => v.verse >= current.verseStart && v.verse <= current.verseEnd);
      const text = picked.map((v) => v.text.replace(/\s+/g, " ").trim()).join(" ");
      const ref = current.verseStart === current.verseEnd ? `${bookName} ${current.chapter}:${current.verseStart}` : `${bookName} ${current.chapter}:${current.verseStart}-${current.verseEnd}`;
      applyBibleSlidePatch({ version: newVersion, reference: ref, text, bookName });
    } catch {
      window.alert("No se pudo cargar esa versión en este momento. Revisa tu conexión a internet.");
    }
  };

  const updateOrder = (fn) => {
    let nuevoOrden = null;
    setEvents((evs) => evs.map((e) => {
      if (e.id !== selectedEventId) return e;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) sincronizarServiceOrder(selectedEventId, nuevoOrden).catch((err) => window.alert("No se pudo guardar el setlist: " + err.message));
  };
  // Cada canción se manda sola al bloque que le corresponde según su clasificación (Himno/Corito/Canto
  // especial → Alabanza; Adoración → Adoración) — se agrega al final de ese bloque, o se crea el bloque si
  // el evento todavía no lo tiene. Los bloques son simples marcadores de posición (no hay anidado real en
  // los datos), así que "pertenecer a un bloque" es estar entre ese marcador y el siguiente.
  const addSong = (songId) => {
    const song = library.find((s) => s.id === songId);
    const newItem = { id: nextId(), type: "cancion", songId, structure: song.defaultStructure };
    const targetBlock = SONG_CATEGORIES[song.category]?.block;
    updateOrder((o) => {
      if (!targetBlock) return [...o, newItem]; // sin clasificación: al final, como antes
      let blockIdx = -1;
      o.forEach((item, i) => { if (item.type === "seccion" && item.title.toLowerCase().includes(targetBlock.toLowerCase())) blockIdx = i; });
      if (blockIdx === -1) {
        return [...o, { id: nextId(), type: "seccion", title: `Bloque de ${targetBlock}`, description: `Bloque de ${targetBlock.toLowerCase()}.`, ministryId: null }, newItem];
      }
      let insertAt = o.length;
      for (let i = blockIdx + 1; i < o.length; i++) { if (o[i].type === "seccion") { insertAt = i; break; } }
      return [...o.slice(0, insertAt), newItem, ...o.slice(insertAt)];
    });
  };
  const addBible = (b) => { updateOrder((o) => [...o, { id: nextId(), type: "biblia", reference: b.ref, version: b.version, text: b.text, bookId: b.bookId, bookName: b.bookName, chapter: b.chapter, verseStart: b.verseStart, verseEnd: b.verseEnd }]); setShowBibleForm(false); };
  const addSlide = () => {
    if (!slideDraft.title && !(slideDraft.bgType === "video" && slideDraft.videoUrl)) return; // se permite solo-video sin texto
    updateOrder((o) => [...o, { id: nextId(), type: "slide", ...slideDraft }]);
    setSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "" });
    setShowSlideForm(false);
  };
  const addSeccion = (title, description) => updateOrder((o) => [...o, { id: nextId(), type: "seccion", title: title.trim() || "Nuevo bloque", description: description.trim(), ministryId: null }]);
  // Punto del bosquejo del predicador: se guarda como una "slide" más (así Multimedia la proyecta igual que
  // cualquier otra), marcada con isSermonPoint para distinguirla visualmente en el Setlist y en el grid en vivo.
  const addSermonPoint = () => {
    if (!sermonPointText.trim()) return;
    updateOrder((o) => [...o, { id: nextId(), type: "slide", title: sermonPointText.trim(), subtitle: "", bg: "#16324F", bgType: "color", isSermonPoint: true }]);
    setSermonPointText("");
    setShowSermonForm(false);
  };
  const linkMinistry = (itemId, ministryId) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, ministryId: ministryId || null } : i)));
  const updateSeccionText = (itemId, field, value) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)));
  const setSongKey = (itemId, key, defaultKey) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, keyOverride: key === defaultKey ? null : key } : i)));
  const removeItem = (id) => updateOrder((o) => o.filter((i) => i.id !== id));
  const move = (idx, dir) => updateOrder((o) => { const arr = [...o]; const j = idx + dir; if (j < 0 || j >= arr.length) return arr; [arr[idx], arr[j]] = [arr[j], arr[idx]]; return arr; });
  // Arrastrar y soltar desde el ícono de 6 puntos: saca el elemento de su posición y lo inserta donde se soltó.
  const reorderItem = (fromIdx, toIdx) => updateOrder((o) => {
    if (fromIdx === toIdx) return o;
    const arr = [...o];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    return arr;
  });
  const duplicateItem = (id) => updateOrder((o) => {
    const idx = o.findIndex((i) => i.id === id);
    if (idx === -1) return o;
    return [...o.slice(0, idx + 1), { ...o[idx], id: nextId() }, ...o.slice(idx + 1)];
  });

  // Encargados de un ítem del Setlist (bloque, canción, versículo o slide) — viven directo en la burbuja
  // de ese ítem, ya no en una pantalla de "Roles/Participantes" separada.
  const updateItemEncargados = (itemId, fn) =>
    updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, encargados: fn(i.encargados || []) } : i)));
  // Avisa a alguien que lo acaban de asignar a algo (encargado de un bloque, equipo de alabanza, líder
  // de ministerio) — notificación in-app + push real si tiene un dispositivo suscrito. No bloquea la
  // asignación si falla (solo avisa en consola): la persona ya quedó asignada de todas formas.
  const notificarAsignacion = (usuarioId, { titulo, cuerpo, eventoId }) => {
    if (!usuarioId || usuarioId === userId) return; // no hace falta avisarse a uno mismo
    callUsersFunction("notificar-asignacion", { usuario_id: usuarioId, tipo: "asignacion", titulo, cuerpo, evento_id: eventoId || null })
      .catch((e) => console.warn("No se pudo notificar la asignación:", e.message));
  };
  const addEncargado = (itemId, usuario) => {
    if (!usuario) return;
    updateItemEncargados(itemId, (encargados) => [...encargados, { id: nextId(), n: usuario.nombre, usuarioId: usuario.id, status: "pendiente", lead: false }]);
    notificarAsignacion(usuario.id, { titulo: "Te asignaron un encargo", cuerpo: `Tienes un encargo en "${selectedEvent?.title}".`, eventoId: selectedEventId });
  };
  const setEncargadoStatus = (itemId, idx, status) =>
    updateItemEncargados(itemId, (encargados) => encargados.map((m, mi) => (mi === idx ? { ...m, status } : m)));
  const setEncargadoLead = (itemId, idx) =>
    updateItemEncargados(itemId, (encargados) => encargados.map((m, mi) => (mi === idx ? { ...m, lead: !m.lead } : m)));
  const removeEncargado = (itemId, idx) => {
    let removido = null;
    updateItemEncargados(itemId, (encargados) => {
      removido = encargados[idx];
      return encargados.filter((_, mi) => mi !== idx);
    });
    if (removido) notificarAsignacion(removido.usuarioId, { titulo: "Te quitaron un encargo", cuerpo: `Ya no tienes un encargo en "${selectedEvent?.title}".`, eventoId: selectedEventId });
  };

  // Equipo de alabanza: un solo roster de roles (Guitarra, Batería, Voz...) compartido por los bloques
  // de Alabanza y Adoración del mismo evento — por eso vive en el evento, no en cada bloque.
  const updateWorshipRoles = (fn) => {
    let nuevo = null;
    setEvents((evs) => evs.map((e) => {
      if (e.id !== selectedEventId) return e;
      nuevo = fn(e.worshipRoles || []);
      return { ...e, worshipRoles: nuevo };
    }));
    if (nuevo) sincronizarWorshipRoles(selectedEventId, nuevo).catch((err) => window.alert("No se pudo guardar el equipo de alabanza: " + err.message));
  };
  const addWorshipRole = (name) => {
    if (!name.trim()) return;
    updateWorshipRoles((roles) => [...roles, { id: nextId(), name: name.trim(), members: [] }]);
  };
  const removeWorshipRole = (roleId) => updateWorshipRoles((roles) => roles.filter((r) => r.id !== roleId));
  const updateWorshipRoleMembers = (roleId, fn) =>
    updateWorshipRoles((roles) => roles.map((r) => (r.id === roleId ? { ...r, members: fn(r.members) } : r)));
  const addWorshipRoleMember = (roleId, usuario) => {
    if (!usuario) return;
    updateWorshipRoleMembers(roleId, (members) => [...members, { id: nextId(), n: usuario.nombre, usuarioId: usuario.id, status: "pendiente", lead: false }]);
    notificarAsignacion(usuario.id, { titulo: "Te asignaron al equipo de alabanza", cuerpo: `Quedaste en el equipo de alabanza de "${selectedEvent?.title}".`, eventoId: selectedEventId });
  };
  const setWorshipRoleMemberStatus = (roleId, idx, status) =>
    updateWorshipRoleMembers(roleId, (members) => members.map((m, mi) => (mi === idx ? { ...m, status } : m)));
  const setWorshipRoleMemberLead = (roleId, idx) =>
    updateWorshipRoleMembers(roleId, (members) => members.map((m, mi) => (mi === idx ? { ...m, lead: !m.lead } : m)));
  const removeWorshipRoleMember = (roleId, idx) => {
    let removido = null;
    updateWorshipRoleMembers(roleId, (members) => {
      removido = members[idx];
      return members.filter((_, mi) => mi !== idx);
    });
    if (removido) notificarAsignacion(removido.usuarioId, { titulo: "Te quitaron del equipo de alabanza", cuerpo: `Ya no estás en el equipo de alabanza de "${selectedEvent?.title}".`, eventoId: selectedEventId });
  };

  const goto = (i) => {
    setBlanked(false);
    if (adHoc) { setAdHocIdx(Math.min(Math.max(i, 0), adHoc.slides.length - 1)); return; }
    setActiveIdx(Math.min(Math.max(i, 0), slides.length - 1));
  };
  const gotoPlanSlide = (i) => { setAdHoc(null); setAdHocIdx(0); setBlanked(false); setActiveIdx(Math.min(Math.max(i, 0), slides.length - 1)); };
  const exitAdHoc = () => { setAdHoc(null); setAdHocIdx(0); };
  const startAdHocBible = (b) => { setAdHoc({ label: `Versículo improvisado: ${b.ref}`, slides: [{ slideId: "adhoc-biblia", type: "biblia", reference: b.ref, version: b.version, text: b.text, bookId: b.bookId, bookName: b.bookName, chapter: b.chapter, verseStart: b.verseStart, verseEnd: b.verseEnd }] }); setAdHocIdx(0); setBlanked(false); };
  const startAdHocSong = (song) => { setAdHoc({ label: `Canción improvisada: ${song.title}`, slides: songToSlides("adhoc-cancion", song, song.defaultStructure) }); setAdHocIdx(0); setBlanked(false); };
  const startAdHocVideo = (url) => { setAdHoc({ label: "Video improvisado", slides: [{ slideId: "adhoc-video", type: "slide", title: "", subtitle: "", bg: "#000", bgType: "video", videoUrl: url }] }); setAdHocIdx(0); setBlanked(false); };
  // Como PowerPoint: la proyección solo se abre si hay una segunda pantalla (proyector/monitor)
  // realmente conectada y detectada — si no hay una, no se abre nada (nunca sobre la misma pantalla
  // del panel de control). Requiere Chrome/Edge (Window Management API).
  // Ventana con nombre fijo: si ya está abierta, la reutiliza/enfoca en vez de abrir una duplicada.
  const PROYECCION_WINDOW_NAME = "worshipflow-proyeccion";
  const PROYECCION_WINDOW_FEATURES = "toolbar=no,menubar=no,location=no,status=no,directories=no,scrollbars=no";
  // Se guarda apenas se detectan las pantallas (ver useEffect más abajo) para que, al hacer clic en
  // "Iniciar evento"/"Reabrir proyección", window.open ocurra en el mismo tick del clic sin esperar un
  // permiso async de por medio — así el navegador sigue viendo la ventana como abierta por gesto del
  // usuario y le permite pedir pantalla completa sola, sin que el operador tenga que darle un clic extra.
  const screenDetailsRef = useRef(null);
  useEffect(() => {
    if (!("getScreenDetails" in window)) return;
    window.getScreenDetails().then((sd) => { screenDetailsRef.current = sd; }).catch(() => {});
  }, []);
  const openOnOtherScreen = (screenDetails) => {
    const url = `${window.location.origin}${window.location.pathname}?screen=publico`;
    const otherScreen = screenDetails.screens.find((s) => s !== screenDetails.currentScreen);
    if (!otherScreen) {
      window.alert("No se detectó una segunda pantalla conectada. Conecta el proyector/monitor y vuelve a intentar para que se abra ahí solo.");
      return;
    }
    const popup = window.open(url, PROYECCION_WINDOW_NAME, `${PROYECCION_WINDOW_FEATURES},left=${otherScreen.left},top=${otherScreen.top},width=${otherScreen.width},height=${otherScreen.height}`);
    // Pedir pantalla completa DESDE ACÁ (el opener, justo tras window.open, todavía con el gesto del
    // clic activo) es más confiable que pedirla desde dentro de la propia ventana emergente una vez
    // cargada — el "activation" del clic no siempre le alcanza a su propio script para cuando termina
    // de montar React. Este es el patrón que la documentación de Chrome recomienda para abrir una
    // ventana en pantalla completa sobre un segundo monitor. PublicScreen.jsx igual mantiene su propio
    // intento + un botón de respaldo por si el navegador bloquea esto (Firefox, popup reutilizado, etc).
    if (popup) {
      const requestFs = () => popup.document?.documentElement?.requestFullscreen?.().catch(() => {});
      if (popup.document?.readyState === "complete") requestFs();
      else popup.addEventListener("load", requestFs, { once: true });
    }
  };
  const startPresentation = async () => {
    if (!("getScreenDetails" in window)) {
      window.alert("Este navegador no permite detectar una segunda pantalla automáticamente. Usa Chrome o Edge para que la proyección se abra sola ahí.");
      return;
    }
    if (screenDetailsRef.current) { openOnOtherScreen(screenDetailsRef.current); return; }
    try {
      const screenDetails = await window.getScreenDetails();
      screenDetailsRef.current = screenDetails;
      openOnOtherScreen(screenDetails);
    } catch {
      window.alert("No se pudo detectar las pantallas conectadas (permiso denegado). Conecta el proyector/monitor y vuelve a intentar.");
    }
  };
  const startEvent = (eventId) => {
    if (liveEventId && liveEventId !== eventId) {
      const otherTitle = events.find((e) => e.id === liveEventId)?.title;
      const ok = window.confirm(`"${otherTitle}" ya está en vivo. ¿Finalizarlo e iniciar este evento en su lugar?`);
      if (!ok) return;
    }
    setLiveEventId(eventId); setLiveOwnerId(userId); setActiveIdx(0); setBlanked(false); setAdHoc(null); setAdHocIdx(0); setTab("envivo");
    startPresentation(); // abre/enfoca la pantalla de proyección de una vez, sin paso manual extra
  };
  const endEvent = () => {
    setLiveEventId(null); setLiveOwnerId(null); setBlanked(false); setAdHoc(null); setAdHocIdx(0); setTab("eventos");
    clearLiveSession().catch((e) => window.alert("No se pudo cerrar la sesión en vivo: " + e.message));
  };

  const toggleFavorite = (songId) => {
    const song = library.find((s) => s.id === songId);
    if (!song) return;
    const nuevoValor = !song.favorite;
    setLibrary((lib) => lib.map((s) => (s.id === songId ? { ...s, favorite: nuevoValor } : s)));
    guardarCancionDesdeEditor({ ...song, favorite: nuevoValor }, true, userId).catch((e) => window.alert("No se pudo guardar: " + e.message));
  };
  // Transporta la canción completa a una nueva tonalidad: recalcula todos los acordes de todos los bloques.
  const transposeSong = (songId, newKey) => {
    let transposed = null;
    setLibrary((lib) => lib.map((s) => {
      if (s.id !== songId) return s;
      const semitones = semitoneShift(s.key, newKey);
      const blocks = Object.fromEntries(Object.entries(s.blocks).map(([key, b]) => [key, { ...b, lines: b.lines.map((l) => transposeLine(l, semitones)) }]));
      transposed = { ...s, key: newKey, blocks };
      return transposed;
    }));
    if (transposed) guardarCancionDesdeEditor(transposed, true, userId).catch((e) => window.alert("No se pudo guardar la transposición: " + e.message));
  };
  // Guarda el borrador en Supabase y refleja el resultado en la librería en memoria, sin decidir qué
  // pantalla mostrar después — lo reutilizan tanto "Guardar" (que sí navega a la vista de la canción)
  // como la confirmación de "Guardar y salir" al presionar atrás con cambios sin guardar (que navega
  // a donde el usuario iba, no de vuelta a la canción).
  const persistSongDraft = (draft) => {
    const existeEnDb = library.some((s) => s.id === draft.id);
    return guardarCancionDesdeEditor(draft, existeEnDb, userId).then((idReal) => {
      const guardado = { ...draft, id: idReal };
      setLibrary((lib) => (existeEnDb ? lib.map((s) => (s.id === draft.id ? guardado : s)) : [...lib, guardado]));
      return idReal;
    });
  };
  const saveSong = (draft) => {
    persistSongDraft(draft)
      .then((idReal) => setOpenSong({ id: idReal, mode: "view" }))
      .catch((e) => window.alert("No se pudo guardar la canción: " + e.message));
  };
  const deleteSong = (song) => {
    if (!window.confirm(`¿Eliminar "${song.title}"? Esto no se puede deshacer.`)) return;
    setLibrary((lib) => lib.filter((s) => s.id !== song.id));
    setOpenSong(null);
    deleteCancion(song.id).catch((e) => window.alert("No se pudo eliminar la canción: " + e.message));
  };
  const createEvent = ({ templateId, title, dateLabel, date, hora, location, esPlantilla }) => {
    const template = events.find((e) => e.id === templateId);
    const newEvent = {
      id: nextId(),
      title, dateLabel, date, hora: hora || null, location,
      openPositions: template ? template.openPositions : 0,
      cover: template ? template.cover : DEFAULT_COVERS[events.length % DEFAULT_COVERS.length],
      serviceOrder: template ? cloneServiceOrder(template.serviceOrder) : [],
      worshipRoles: template ? cloneWorshipRoles(template.worshipRoles || []) : [],
      reminders: template ? cloneRecordatorios(template.reminders) : [],
      esPlantilla: !!esPlantilla,
    };
    setEvents((evs) => [...evs, newEvent]);
    crearEventoCompleto(newEvent, userId).catch((e) => window.alert("No se pudo guardar el evento: " + e.message));
    setSelectedEventId(newEvent.id);
  };
  const deleteEvent = (event) => {
    if (event.id === liveEventId) { window.alert("No puedes eliminar un evento que está en vivo — finalízalo primero."); return; }
    if (!window.confirm(`¿Eliminar "${event.title}"? Esto borra también su Setlist y sus encargados. No se puede deshacer.`)) return;
    setEvents((evs) => evs.filter((e) => e.id !== event.id));
    setSelectedEventId(null);
    deleteEvento(event.id).catch((e) => window.alert("No se pudo eliminar el evento: " + e.message));
  };

  // Recordatorios: mismo patrón que updateMinistry — calcula el nuevo valor dentro del setter y
  // sincroniza con ESE valor (no con el estado viejo que todavía tendría el closure).
  const updateEventReminders = (eventId, fn) => {
    let nuevo = null;
    setEvents((evs) => evs.map((e) => {
      if (e.id !== eventId) return e;
      nuevo = fn(e);
      return nuevo;
    }));
    if (nuevo) sincronizarRecordatorios(eventId, nuevo.reminders).catch((e) => window.alert("No se pudo guardar el recordatorio: " + e.message));
  };
  const addReminder = (eventId, cantidad, unidad) => updateEventReminders(eventId, (e) => ({ ...e, reminders: [...(e.reminders || []), { id: nextId(), cantidad, unidad, enviado: false }] }));
  const removeReminder = (eventId, reminderId) => updateEventReminders(eventId, (e) => ({ ...e, reminders: (e.reminders || []).filter((r) => r.id !== reminderId) }));
  const setEventHora = (eventId, hora) => {
    setEvents((evs) => evs.map((e) => (e.id === eventId ? { ...e, hora: hora || null } : e)));
    updateEvento(eventId, { hora: hora || null }).catch((e) => window.alert("No se pudo guardar la hora: " + e.message));
  };

  const favoritesCount = library.filter((s) => s.favorite).length;
  // Las plantillas son eventos normales marcados con esPlantilla: no aparecen en el feed de cultos
  // reales (Inicio, Eventos, Mi Horario), solo en el selector "crear desde plantilla" y en la vista
  // de administración de plantillas — ambas armadas por administradores generales.
  const realEvents = events.filter((e) => !e.esPlantilla);
  const plantillas = events.filter((e) => e.esPlantilla);

  // ---- Identidad y control de acceso REALES: vienen de la cuenta con la que iniciaste sesión (perfil,
  // desde AuthGate) — ya no un selector que cualquiera podía cambiarse solo. Un rol lo asigna un
  // administrador desde Usuarios. Solo un administrador puede "probar" cómo se ve la app con otro
  // rol/persona (ver Ajustes) — para todos los demás su acceso queda fijo a su cuenta real.
  const ROLE_DB_TO_LABEL = { admin: "Administrador", multimedia: "Multimedia", musico: "Músico", miembro: "Miembro" };
  const realIsAdmin = perfil?.rol === "admin";
  const realRoleLabel = ROLE_DB_TO_LABEL[perfil?.rol] || "Miembro";
  const realName = perfil?.nombre || "";
  const [roleOverride, setRoleOverride] = useState(null); // solo un admin lo puede poner (ver Ajustes)
  const [nameOverride, setNameOverride] = useState(null);
  const [usuariosReales, setUsuariosReales] = useState([]); // lista real de miembros ya registrados (RLS: cualquier autenticado puede leerla)
  useEffect(() => {
    supabase.from("usuarios").select("id, nombre, rol").order("nombre").then(({ data }) => setUsuariosReales(data || []));
  }, []);

  // ---- Notificaciones (campanita del header): carga las propias al entrar y se suscribe en tiempo
  // real a las nuevas (asignaciones, recordatorios de eventos) — mismo patrón que subscribeLiveSession.
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  useEffect(() => {
    listMisNotificaciones(userId).then(setNotifications).catch(() => {});
    const unsubscribe = subscribeNotificaciones(userId, (fila) => setNotifications((ns) => [fila, ...ns]));
    return unsubscribe;
  }, [userId]);
  const unreadCount = notifications.filter((n) => !n.leido).length;
  const openNotification = (n) => {
    if (!n.leido) {
      setNotifications((ns) => ns.map((x) => (x.id === n.id ? { ...x, leido: true } : x)));
      marcarLeida(n.id).catch(() => {});
    }
    if (n.evento_id) { setShowNotifications(false); goToEvent(n.evento_id); }
  };
  const markAllNotificationsRead = () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, leido: true })));
    marcarTodasLeidas(userId).catch(() => {});
  };
  const myRole = realIsAdmin && roleOverride ? roleOverride : realRoleLabel;
  // Administrador y Multimedia controlan la transmisión en vivo — así ningún músico o miembro puede
  // detenerla por accidente desde su teléfono (ver Ajustes → "Rol de este dispositivo").
  const canControlLive = myRole === "Administrador" || myRole === "Multimedia";
  // Iniciar la transmisión es más delicado que solo controlarla ya en marcha: únicamente Multimedia
  // (ni Administrador) ve el botón "Iniciar evento", y únicamente desde un escritorio — nunca desde un
  // teléfono, ni para Multimedia ni para nadie, para que solo se inicie desde el equipo conectado de verdad.
  const canStartLive = myRole === "Multimedia" && !isCompact;
  const myName = realIsAdmin && nameOverride ? nameOverride : realName;
  const isAdminViewer = realIsAdmin && nameOverride ? usuariosReales.find((u) => u.nombre === nameOverride)?.rol === "admin" : realIsAdmin;
  // Agregar versículos al Setlist es de administradores, con una sola excepción: quien esté asignado
  // como encargado de un bloque de Lectura bíblica/Oración EN ESTE EVENTO puede agregar su propio
  // versículo para esa lectura, aunque no sea administrador.
  const canAddBibleReading = () => isAdminViewer || !!(selectedEvent?.serviceOrder || []).find(
    (it) => isBibleReadingBlock(it) && (it.encargados || []).some((m) => m.usuarioId === userId)
  );
  const canAddSermonPoints = () => isAdminViewer;

  // ---- Estilo en vivo de la proyección (fondo/tipografía/tamaño), editable solo por Multimedia mientras transmite ----
  const [liveStyle, setLiveStyle] = useState({ theme: "stage", font: "elegante", fontScale: 1 });

  // ---- Sincroniza la pantalla pública (ventana/dispositivo aparte) vía Supabase Realtime — ya no
  // BroadcastChannel, que solo funcionaba dentro del mismo navegador: ahora el panel de control y la
  // proyección pueden estar en computadoras distintas de verdad. Solo transmite mientras hay un
  // evento en vivo Y este dispositivo es quien lo está llevando (si no, un músico que solo está
  // observando "En vivo" encendido en su teléfono pisaría por accidente lo que Multimedia proyecta).
  useEffect(() => {
    if (!liveEventId || userId !== liveOwnerId) return;
    updateLiveSession({ evento_id: liveEventId, liderado_por: userId, slide_actual: current || null, blanked, estilo_en_vivo: liveStyle, ad_hoc_label: adHoc?.label || null })
      .catch((e) => window.alert("No se pudo actualizar la proyección: " + e.message));
  }, [current, blanked, liveStyle, liveEventId, liveOwnerId, adHoc, userId]);

  // ---- Sincroniza EN TIEMPO REAL, en todos los dispositivos, si hay un evento en vivo ahora mismo y
  // quién lo está llevando — así el indicador "En vivo" (pestaña, franja de Inicio, tarjeta del evento)
  // se enciende para músicos/miembros apenas Multimedia inicia la transmisión, sin que cada quien tenga
  // que haberlo iniciado desde su propio teléfono. Antes esto era solo estado local: cada dispositivo
  // solo se enteraba de un evento en vivo si ÉL MISMO lo había iniciado.
  useEffect(() => {
    getLiveSession()
      .then((fila) => { setLiveEventId(fila?.evento_id || null); setLiveOwnerId(fila?.liderado_por || null); })
      .catch(() => {});
    const unsubscribe = subscribeLiveSession((fila) => {
      setLiveEventId(fila.evento_id || null);
      setLiveOwnerId(fila.liderado_por || null);
    });
    return unsubscribe;
  }, []);

  // ---- Ministerios ----
  const [ministries, setMinistries] = useState([]);
  const [selectedMinistryId, setSelectedMinistryId] = useState(null);
  // Grupos: solo administradores ven todos; quien lidera uno o más grupos ve la pestaña pero solo SUS
  // propios grupos (no los de los demás), aunque tenga dos o más asignados.
  const myMinistries = ministries.filter((m) => m.leaderId === userId);
  const canSeeGrupos = isAdminViewer || myMinistries.length > 0;
  const visibleMinistries = isAdminViewer ? ministries : myMinistries;
  // Guarda en Supabase solo la parte que de verdad cambió (plan o recursos), comparando por
  // referencia — cada mutador de abajo crea un array nuevo únicamente para lo que tocó.
  const updateMinistry = (id, fn) => {
    let anterior = null, nuevo = null;
    setMinistries((ms) => ms.map((m) => {
      if (m.id !== id) return m;
      anterior = m;
      nuevo = fn(m);
      return nuevo;
    }));
    if (!nuevo) return;
    if (nuevo.plan !== anterior.plan) sincronizarPlan(id, nuevo.plan).catch((e) => window.alert("No se pudo guardar la planificación: " + e.message));
    if (nuevo.resources !== anterior.resources) sincronizarRecursos(id, nuevo.resources).catch((e) => window.alert("No se pudo guardar el recurso: " + e.message));
  };
  const addPlanItem = (id) => updateMinistry(id, (m) => ({ ...m, plan: [...m.plan, { id: nextMinistryChildId(), date: "", title: "", detail: "" }] }));
  const updatePlanItem = (id, itemId, field, value) => updateMinistry(id, (m) => ({ ...m, plan: m.plan.map((p) => (p.id === itemId ? { ...p, [field]: value } : p)) }));
  const removePlanItem = (id, itemId) => updateMinistry(id, (m) => ({ ...m, plan: m.plan.filter((p) => p.id !== itemId) }));
  const addResource = (id, resource) => updateMinistry(id, (m) => ({ ...m, resources: [...m.resources, { id: nextMinistryChildId(), ...resource }] }));
  const removeResource = (id, resourceId) => updateMinistry(id, (m) => ({ ...m, resources: m.resources.filter((r) => r.id !== resourceId) }));
  const createMinistry = ({ name, leaderId, color }) => {
    const leaderName = usuariosReales.find((u) => u.id === leaderId)?.nombre || "";
    const newM = { id: nextId(), name, leaderId: leaderId || null, leaderName, color, memberCount: 0, plan: [], resources: [] };
    setMinistries((ms) => [...ms, newM]);
    crearMinisterio(newM, userId).catch((e) => window.alert("No se pudo guardar el ministerio: " + e.message));
    setSelectedMinistryId(newM.id);
  };
  const setMinistryLeader = (id, leaderId) => {
    const previousLeaderId = ministries.find((m) => m.id === id)?.leaderId || null;
    const leaderName = usuariosReales.find((u) => u.id === leaderId)?.nombre || "";
    const ministryName = ministries.find((m) => m.id === id)?.name || "un grupo";
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, leaderId: leaderId || null, leaderName } : m)));
    actualizarLiderMinisterio(id, leaderId || null).catch((e) => window.alert("No se pudo actualizar el líder: " + e.message));
    if (leaderId) notificarAsignacion(leaderId, { titulo: "Te asignaron como líder", cuerpo: `Ahora eres líder del grupo "${ministryName}".` });
    if (previousLeaderId && previousLeaderId !== leaderId) notificarAsignacion(previousLeaderId, { titulo: "Ya no eres líder", cuerpo: `Dejaste de ser líder del grupo "${ministryName}".` });
  };

  // ---- Botón "atrás" real ----
  // Cada pantalla dentro de la app (una pestaña, un evento abierto, una canción abierta, un ministerio
  // abierto) se empuja como su propia entrada del historial del navegador. Así, el botón/gesto "atrás"
  // del teléfono o del navegador va regresando pantalla por pantalla — como cualquier app real — en vez
  // de salir de la app de un solo salto. Los botones "‹ Volver" de la propia interfaz usan exactamente
  // el mismo mecanismo (history.back()), así que ambos caminos siempre coinciden.
  const isPoppingNavRef = useRef(false);
  const hasMountedNavRef = useRef(false);
  // Si el estado (sin importar la pestaña) no tiene nada "abierto" es una pantalla raíz de esa pestaña.
  const isRootState = (s) => !s.selectedEventId && !s.openSong && !s.selectedMinistryId;
  // true mientras estemos parados exactamente en Inicio-raíz sin haber avanzado a otra pestaña todavía.
  const isAtHomeRootRef = useRef(true);
  // Última combinación tab/evento/ministerio/canción que de verdad se apiló o reemplazó — se usa para
  // detectar un "movimiento lateral" (deslizar/Siguiente a OTRA canción dentro del mismo lector) y así
  // decidir reemplazar en vez de apilar (ver más abajo).
  const prevNavRef = useRef({ tab, selectedEventId, openSong, selectedMinistryId });
  // El listener de "popstate" se registra UNA sola vez (deps: []), así que su closure nunca ve valores
  // actualizados de tab/openSong/etc. — estos refs, sincronizados en cada render, son cómo lee los
  // valores VIGENTES al momento real en que se dispara el evento (ej. para el guard de SongEditor abajo).
  const tabRef = useRef(tab);
  const selectedEventIdRef = useRef(selectedEventId);
  const openSongRef = useRef(openSong);
  const selectedMinistryIdRef = useRef(selectedMinistryId);
  useEffect(() => {
    tabRef.current = tab; selectedEventIdRef.current = selectedEventId; openSongRef.current = openSong; selectedMinistryIdRef.current = selectedMinistryId;
  }, [tab, selectedEventId, openSong, selectedMinistryId]);
  // Si se está editando una canción con cambios sin guardar y se sale por el botón "‹" propio o por
  // cambiar de pestaña, se pregunta si guardar o descartar (ver requestLeaveSongEditor más abajo). Por
  // atrás físico/gesto NO se pregunta — ya se intentó cancelar esa navegación desde JS reapilando el
  // historial (para poder mostrar la misma alerta) y resultó poco confiable en celulares/PWA: el gesto
  // quedaba a medias y la pantalla se trababa sin dejar salir del editor. En su lugar se guarda solo,
  // sin preguntar, y se deja pasar la navegación normal — así nunca se pierde nada de todas formas.
  const songEditDirtyRef = useRef(false);
  const songDraftGetterRef = useRef(null);
  const [songExitPrompt, setSongExitPrompt] = useState(false);
  const pendingNavigateRef = useRef(null);
  // Aviso breve (no bloqueante) para cuando el atrás físico/gesto guarda solo, sin preguntar — así queda
  // claro que el cambio no se perdió aunque no haya salido la alerta de guardar/descartar.
  const [songAutoSaveToast, setSongAutoSaveToast] = useState(false);
  const songAutoSaveToastTimeoutRef = useRef(null);
  useEffect(() => {
    const onPopState = (e) => {
      if (!e.state || e.state.screen !== "app-nav") return;
      const editingSongNow = tabRef.current === "canciones" && openSongRef.current?.mode === "edit";
      if (editingSongNow && songEditDirtyRef.current) {
        const draft = songDraftGetterRef.current?.();
        if (draft) {
          const existeEnDb = libraryRef.current.some((s) => s.id === draft.id);
          guardarCancionDesdeEditor(draft, existeEnDb, userIdRef.current)
            .then((idReal) => {
              const guardado = { ...draft, id: idReal };
              setLibrary((lib) => (existeEnDb ? lib.map((s) => (s.id === draft.id ? guardado : s)) : [...lib, guardado]));
              clearTimeout(songAutoSaveToastTimeoutRef.current);
              setSongAutoSaveToast(true);
              songAutoSaveToastTimeoutRef.current = setTimeout(() => setSongAutoSaveToast(false), 2200);
            })
            .catch((e2) => window.alert("No se pudo guardar la canción: " + e2.message));
        }
        songEditDirtyRef.current = false;
      }
      isPoppingNavRef.current = true;
      const s = { tab: e.state.tab ?? "inicio", selectedEventId: e.state.selectedEventId ?? null, openSong: e.state.openSong ?? null, selectedMinistryId: e.state.selectedMinistryId ?? null };
      isAtHomeRootRef.current = s.tab === "inicio" && isRootState(s);
      prevNavRef.current = s;
      setTab(s.tab);
      setSelectedEventId(s.selectedEventId);
      setOpenSong(s.openSong);
      setSelectedMinistryId(s.selectedMinistryId);
    };
    window.addEventListener("popstate", onPopState);
    if (!history.state || history.state.screen !== "app-nav") {
      // Primera vez que esta pantalla existe de verdad (recién cargó la página): siembra la entrada base.
      history.replaceState({ screen: "app-nav", tab, selectedEventId, openSong, selectedMinistryId }, "");
    } else {
      // Nos volvieron a montar (ej. al volver de Usuarios) con una entrada "app-nav" que ya existía en
      // el historial — sincroniza lo que se ve en pantalla con lo que esa entrada dice de verdad, para
      // que el historial real del navegador y la pantalla nunca queden desalineados.
      isPoppingNavRef.current = true;
      const s = { tab: history.state.tab ?? "inicio", selectedEventId: history.state.selectedEventId ?? null, openSong: history.state.openSong ?? null, selectedMinistryId: history.state.selectedMinistryId ?? null };
      isAtHomeRootRef.current = s.tab === "inicio" && isRootState(s);
      prevNavRef.current = s;
      setTab(s.tab);
      setSelectedEventId(s.selectedEventId);
      setOpenSong(s.openSong);
      setSelectedMinistryId(s.selectedMinistryId);
    }
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hasMountedNavRef.current) { hasMountedNavRef.current = true; return; }
    if (isPoppingNavRef.current) { isPoppingNavRef.current = false; return; }
    const prev = prevNavRef.current;
    const next = { screen: "app-nav", tab, selectedEventId, openSong, selectedMinistryId };
    if (isRootState(next)) {
      // Cambiar de pestaña SIN entrar a nada (Eventos → Canciones → Ajustes, todas en su lista raíz) no
      // debe apilarse: si no, "atrás" te haría retroceder pestaña por pestaña en vez de ir a Inicio de
      // un solo golpe. Solo la primera vez que nos movemos de Inicio hacia otra pestaña se apila (para
      // dejar Inicio como piso); de ahí en adelante, moverse entre raíces de pestañas reemplaza.
      if (tab !== "inicio" && isAtHomeRootRef.current) {
        history.pushState(next, "");
      } else {
        history.replaceState(next, "");
      }
      isAtHomeRootRef.current = tab === "inicio";
    } else {
      // Moverse de UNA canción abierta a OTRA sin cambiar de evento/pestaña/ministerio (deslizar o
      // "Siguiente" dentro del lector abierto desde un Setlist) reemplaza en vez de apilar — si no,
      // "atrás" iría regresando canción por canción en vez de volver de un solo golpe al Setlist/lista
      // de donde se abrió la primera. Cualquier OTRO tipo de entrada (evento, ministerio, o la primera
      // canción que se abre) sigue apilando normalmente. OJO: el modo (view/edit) también tiene que
      // coincidir — si no, pasar de "ver" a "editar" la misma canción (con Editar) se confundía con un
      // deslizar lateral y REEMPLAZABA la entrada de "ver" en vez de apilar un paso real, así que "atrás"
      // desde el editor se saltaba la vista de solo lectura en vez de volver a ella.
      const isLateralSongSwap = !!prev.openSong && !!openSong && prev.openSong.mode === openSong.mode && prev.tab === tab && prev.selectedEventId === selectedEventId && prev.selectedMinistryId === selectedMinistryId;
      if (isLateralSongSwap) {
        history.replaceState(next, "");
      } else {
        history.pushState(next, "");
      }
      isAtHomeRootRef.current = false;
    }
    prevNavRef.current = next;
  }, [tab, selectedEventId, openSong, selectedMinistryId]);

  // Punto único por el que sale cualquier navegación que podría abandonar el editor de canciones (el
  // botón "‹" propio, o el nav inferior): si hay cambios sin guardar, la detiene y pregunta primero;
  // si no, la deja pasar de inmediato. `navigateFn` es la acción real (setTab/history.back/etc.).
  const requestLeaveSongEditor = (navigateFn) => {
    const editingSongNow = tab === "canciones" && openSong?.mode === "edit";
    if (editingSongNow && songEditDirtyRef.current) {
      pendingNavigateRef.current = navigateFn;
      setSongExitPrompt(true);
      return;
    }
    navigateFn();
  };
  const exitSongEditor = () => {
    songEditDirtyRef.current = false;
    setSongExitPrompt(false);
    pendingNavigateRef.current?.();
    pendingNavigateRef.current = null;
  };
  const handleDiscardSongEdit = () => exitSongEditor();
  const handleSaveSongEdit = () => {
    const draft = songDraftGetterRef.current?.();
    if (draft) persistSongDraft(draft).catch((e) => window.alert("No se pudo guardar la canción: " + e.message));
    exitSongEditor();
  };
  const handleKeepEditingSong = () => { pendingNavigateRef.current = null; setSongExitPrompt(false); };
  // Saltar a un evento específico desde Inicio/Ajustes: limpia openSong/selectedMinistryId por la misma
  // razón que el nav inferior — si no, podía quedar "pegada" una canción o ministerio de otra pestaña.
  const goToEvent = (id) => requestLeaveSongEditor(() => { setSelectedEventId(id); setOpenSong(null); setSelectedMinistryId(null); setTab("eventos"); });

  if (!datosListos) {
    return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", color: "#8996A6", fontFamily: "'Poppins', sans-serif", fontSize: 14 }}>Cargando…</div>;
  }

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#F4F6FA", color: "#16233A", height: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&family=Caveat:wght@600;700&family=Playfair+Display:ital,wght@1,600&family=Montserrat:wght@300;700&family=Bebas+Neue&family=Oswald:wght@500;600&family=Quicksand:wght@500;700&family=Dancing+Script:wght@600;700&display=swap');
        @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        .live-dot { animation: pulseDot 1.6s ease-in-out infinite; }
        @keyframes glowPulse { 0%,100% { opacity:.55; transform: scale(1); } 50% { opacity:.85; transform: scale(1.04); } }
        .spotlight-glow { animation: glowPulse 3.2s ease-in-out infinite; }
        .hoverable:hover { background:#EEF1F6 !important; }
        .thumb:hover { transform: translateY(-2px); }
        .thumb { transition: transform .15s; }
        .navitem { transition: transform .15s, background .15s; }
        .navitem:active { transform: scale(0.92); }
        input, textarea, select { font-family: inherit; }
      `}</style>

      {/* Header: borde inferior curvo, sin pestañas — la navegación vive abajo, flotante */}
      <div style={{ background: "#16324F", padding: "16px 20px 26px", borderRadius: "0 0 28px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(232,130,30,0.15)" }} />
        <div style={{ position: "absolute", bottom: -40, left: 40, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {/* Fondo blanco detrás del logo (el ícono ya trae su propio fondo blanco, pero el círculo
                asegura que se vea igual sobre el header azul marino) — sin zoom (contain, no cover) para
                que se vea el logo COMPLETO (antes se recortaba la "J" de "Jesús" al hacerle zoom). */}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              <img src="/pwa-192x192.png" alt="Iglesia Jesús El Buen Pastor" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#fff" }}>JBP App</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {liveEvent && (
              <button onClick={() => setTab("envivo")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F0704A" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#FFD9C7" }}>EN VIVO</span>
              </button>
            )}
            <button onClick={() => setShowNotifications(true)} title="Notificaciones" style={{ position: "relative", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Bell size={15} color="#fff" />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -3, right: -3, background: "#E8821E", color: "#16324F", fontSize: 9, fontWeight: 800, borderRadius: 8, minWidth: 14, height: 14, lineHeight: "14px", textAlign: "center", padding: "0 2px" }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showNotifications && (
        <ModalShell title="Notificaciones" icon={Bell} color="#E8821E" onClose={() => setShowNotifications(false)}>
          {unreadCount > 0 && (
            <button onClick={markAllNotificationsRead} style={{ ...ghostToggleBtn, marginBottom: 10 }}>Marcar todas como leídas</button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
            {notifications.length === 0 && <div style={{ fontSize: 13, color: "#8996A6", textAlign: "center", padding: "20px 0" }}>No tienes notificaciones todavía.</div>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className="hoverable"
                style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "left", background: n.leido ? "#FFFFFF" : "#FFF6EC", border: n.leido ? "1px solid #EEF1F6" : "1px solid #F3D9B8", borderRadius: 10, padding: "10px 12px", cursor: n.evento_id ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!n.leido && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8821E", flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{n.titulo}</span>
                </div>
                {n.cuerpo && <div style={{ fontSize: 12, color: "#64707F" }}>{n.cuerpo}</div>}
                <div style={{ fontSize: 10, color: "#B0B8C4", marginTop: 2 }}>{new Date(n.created_at).toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" })}</div>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      {!["envivo", "proyeccion"].includes(tab) && (
      <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", flex: tab === "inicio" ? 1 : "none", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {tab === "inicio" && (
        <InicioView events={realEvents} library={library} favoritesCount={favoritesCount} memberCount={usuariosReales.length} liveEventId={liveEventId} isCompact={isCompact} onSelectEvent={goToEvent} onGoToTeam={realIsAdmin && onGoToUsuarios ? onGoToUsuarios : () => setTab("ajustes")} onOpenSong={(id) => { setTab("canciones"); setOpenSong({ id, mode: "view" }); }} />
      )}

      {tab === "ajustes" && (
        <SettingsView
          realIsAdmin={realIsAdmin}
          myRole={myRole}
          roleOverride={roleOverride}
          setRoleOverride={setRoleOverride}
          myName={myName}
          nameOverride={nameOverride}
          setNameOverride={setNameOverride}
          usuariosReales={usuariosReales}
          perfil={perfil}
          events={realEvents}
          onSelectEvent={goToEvent}
          onGoToUsuarios={onGoToUsuarios}
          userId={userId}
        />
      )}

      {tab === "ministerios" && !selectedMinistryId && (
        <MinistriesList ministries={visibleMinistries} usuariosReales={usuariosReales} isAdminViewer={isAdminViewer} onSelect={setSelectedMinistryId} onCreate={createMinistry} />
      )}
      {tab === "ministerios" && selectedMinistryId && (
        <MinistryDetail
          ministry={ministries.find((m) => m.id === selectedMinistryId)}
          usuariosReales={usuariosReales}
          isAdminViewer={isAdminViewer}
          canEdit={isAdminViewer || ministries.find((m) => m.id === selectedMinistryId)?.leaderId === userId}
          onBack={() => window.history.back()}
          onAddPlanItem={() => addPlanItem(selectedMinistryId)}
          onUpdatePlanItem={(itemId, field, value) => updatePlanItem(selectedMinistryId, itemId, field, value)}
          onRemovePlanItem={(itemId) => removePlanItem(selectedMinistryId, itemId)}
          onAddResource={(resource) => addResource(selectedMinistryId, resource)}
          onRemoveResource={(resourceId) => removeResource(selectedMinistryId, resourceId)}
          onSetLeader={(leaderId) => setMinistryLeader(selectedMinistryId, leaderId)}
        />
      )}

      {tab === "canciones" && openSong === null && (
        <CancionesList library={library} isAdminViewer={isAdminViewer} onToggleFavorite={toggleFavorite} onOpen={(id) => setOpenSong({ id, mode: "view" })} onNew={() => setOpenSong({ id: null, mode: "edit" })} onDelete={deleteSong} />
      )}
      {tab === "canciones" && openSong && openSong.mode === "view" && (
        <SongView song={library.find((s) => s.id === openSong.id)} isAdminViewer={isAdminViewer} onBack={() => window.history.back()} onEdit={() => setOpenSong({ id: openSong.id, mode: "edit" })} onTranspose={transposeSong} onDelete={deleteSong} />
      )}
      {tab === "canciones" && openSong && openSong.mode === "edit" && (
        <SongEditor
          song={openSong.id ? library.find((s) => s.id === openSong.id) : null}
          isAdminViewer={isAdminViewer}
          onCancel={() => requestLeaveSongEditor(() => window.history.back())}
          onSave={saveSong}
          onDirtyChange={(d) => { songEditDirtyRef.current = d; }}
          draftGetterRef={songDraftGetterRef}
        />
      )}
      {songExitPrompt && (
        <ModalShell title="Cambios sin guardar" icon={Pencil} color="#E8821E" onClose={handleKeepEditingSong}>
          <div style={{ fontSize: 13, color: "#33415A", marginBottom: 16 }}>Esta canción tiene cambios sin guardar. ¿Qué quieres hacer antes de salir?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={handleSaveSongEdit} style={primaryBtn}>Guardar y salir</button>
            <button onClick={handleDiscardSongEdit} style={{ ...primaryBtn, background: "#EEF1F6", color: "#C23B32" }}>Descartar cambios y salir</button>
            <button onClick={handleKeepEditingSong} style={{ ...primaryBtn, background: "none", boxShadow: "none" }}>Seguir editando</button>
          </div>
        </ModalShell>
      )}
      {songAutoSaveToast && (
        <div style={{ position: "fixed", left: "50%", bottom: 88, transform: "translateX(-50%)", background: "#16324F", color: "#FFFFFF", fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 999, boxShadow: "0 8px 24px rgba(22,50,79,0.3)", zIndex: 200, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={16} color="#5CD6A9" /> Cambios guardados
        </div>
      )}

      {tab === "eventos" && !selectedEvent && (
        <EventList events={realEvents} plantillas={plantillas} isAdminViewer={isAdminViewer} liveEventId={liveEventId} onSelect={setSelectedEventId} onCreate={createEvent} />
      )}

      {tab === "eventos" && selectedEvent && !openSong && (
        <EventDetail
          event={selectedEvent} library={library} ministries={ministries} isCompact={isCompact}
          isLive={selectedEvent.id === liveEventId} canStartLive={canStartLive} isAdminViewer={isAdminViewer}
          userId={userId} usuariosReales={usuariosReales}
          onBack={() => window.history.back()}
          onStart={() => startEvent(selectedEvent.id)} onGoLive={() => setTab("envivo")} onDelete={deleteEvent}
          onAddSong={addSong} onAddSeccion={addSeccion}
          onAddBibleClick={() => setShowBibleForm(true)} onAddSlideClick={() => setShowSlideForm(true)}
          onRemove={removeItem} onMove={move} onDuplicate={duplicateItem} onReorder={reorderItem}
          onLinkMinistry={linkMinistry} onUpdateSeccionText={updateSeccionText}
          onSetSongKey={setSongKey}
          canAddBibleReading={canAddBibleReading()}
          canAddSermonPoints={canAddSermonPoints()}
          onAddEncargado={addEncargado} onSetEncargadoStatus={setEncargadoStatus} onSetEncargadoLead={setEncargadoLead} onRemoveEncargado={removeEncargado}
          onAddWorshipRole={addWorshipRole} onRemoveWorshipRole={removeWorshipRole} onAddWorshipRoleMember={addWorshipRoleMember} onSetWorshipRoleMemberStatus={setWorshipRoleMemberStatus} onSetWorshipRoleMemberLead={setWorshipRoleMemberLead} onRemoveWorshipRoleMember={removeWorshipRoleMember}
          onViewMinistry={(id) => { setTab("ministerios"); setSelectedMinistryId(id); }}
          onOpenSong={(songId, itemId) => setOpenSong({ id: songId, mode: "view", itemId })}
          onAddReminder={(cantidad, unidad) => addReminder(selectedEvent.id, cantidad, unidad)}
          onRemoveReminder={(reminderId) => removeReminder(selectedEvent.id, reminderId)}
          onSetHora={(hora) => setEventHora(selectedEvent.id, hora)}
          showBibleForm={showBibleForm} setShowBibleForm={setShowBibleForm} addBible={addBible}
          showSlideForm={showSlideForm} setShowSlideForm={setShowSlideForm} slideDraft={slideDraft} setSlideDraft={setSlideDraft} addSlide={addSlide}
          showSermonForm={showSermonForm} setShowSermonForm={setShowSermonForm} sermonPointText={sermonPointText} setSermonPointText={setSermonPointText} addSermonPoint={addSermonPoint}
        />
      )}

      {tab === "eventos" && selectedEvent && openSong && (() => {
        // Abrir una canción desde el Setlist de un evento: mismo lector de solo lectura que en
        // Canciones, pero con "Anterior/Siguiente" limitado a las canciones DE ESTE evento (para que
        // el músico pueda ir pasando el setlist completo en vivo) y respetando la tonalidad_override
        // que se haya elegido para ese ítem en particular (no la tonalidad guardada de la canción).
        // OJO: se ubica por el id del ÍTEM del Setlist (openSong.itemId), no por el id de la canción —
        // si la misma canción se repite varias veces en el setlist, todas comparten el mismo song id,
        // así que buscar por song id siempre encontraba la PRIMERA repetición y deslizar no avanzaba.
        const songItems = selectedEvent.serviceOrder.filter((it) => it.type === "cancion");
        const pos = openSong.itemId != null
          ? songItems.findIndex((it) => it.id === openSong.itemId)
          : songItems.findIndex((it) => it.songId === openSong.id);
        const currentItem = pos >= 0 ? songItems[pos] : null;
        const baseSong = library.find((s) => s.id === openSong.id);
        const displaySong = songWithKeyOverride(baseSong, currentItem?.keyOverride);
        const prevItem = pos > 0 ? songItems[pos - 1] : null;
        const nextItem = pos >= 0 && pos < songItems.length - 1 ? songItems[pos + 1] : null;
        const positionLabel = pos >= 0 && songItems.length > 1 ? `${pos + 1} de ${songItems.length}` : null;
        return (
          <SongView
            key={currentItem?.id ?? openSong.id}
            song={displaySong} isAdminViewer={isAdminViewer} positionLabel={positionLabel}
            enterDirection={openSong.enterDir}
            onBack={() => window.history.back()}
            onEdit={() => { setTab("canciones"); setOpenSong({ id: openSong.id, mode: "edit" }); }}
            onTranspose={transposeSong} onDelete={deleteSong}
            onPrev={prevItem ? () => setOpenSong({ id: prevItem.songId, mode: "view", itemId: prevItem.id, enterDir: "prev" }) : null}
            onNext={nextItem ? () => setOpenSong({ id: nextItem.songId, mode: "view", itemId: nextItem.id, enterDir: "next" }) : null}
          />
        );
      })()}
      </div>
      )}

      {tab === "envivo" && liveEvent && (
        <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", flex: 1, minHeight: 0, display: "flex" }}>
          <MultimediaControl
            eventTitle={liveEvent.title} library={library} slides={slides} activeIdx={activeIdx} adHocIdx={adHocIdx}
            goto={goto} gotoPlanSlide={gotoPlanSlide} blanked={blanked} setBlanked={setBlanked} current={current} next={next}
            onEnd={endEvent} canEnd={userId === liveOwnerId} liveOwner={usuariosReales.find((u) => u.id === liveOwnerId)?.nombre || "otro dispositivo"} liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={isCompact}
            adHoc={adHoc} onExitAdHoc={exitAdHoc} onStartAdHocBible={startAdHocBible} onStartAdHocSong={startAdHocSong} onStartAdHocVideo={startAdHocVideo}
            onOpenPublicScreen={startPresentation}
            onNavigateBibleVerse={navigateBibleVerse} onChangeBibleVersion={changeBibleVersion}
            onAddLiveSlide={addLiveSlide} onEditLiveSlide={editLiveSlide}
          />
        </div>
      )}

      {tab === "proyeccion" && liveEvent && (
        <div style={{ flex: 1, display: "flex" }}><ProjectionPanel slide={current} blanked={blanked} split={false} liveStyle={liveStyle} /></div>
      )}

      </div>

      {/* Nav flotante inferior: isla redondeada con burbuja activa. Vive como hermano normal del área
          con scroll (no position: fixed/sticky) para que el layout le reserve su propio espacio siempre
          y el contenido nunca pueda quedar tapado detrás de ella, tenga o no scroll la pantalla. */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "10px 0 14px", zIndex: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#16324F", borderRadius: 24, padding: 6, boxShadow: "0 8px 24px rgba(22,50,79,0.35)", maxWidth: "94vw", overflowX: "auto" }}>
          {[["inicio", "Inicio", Home], ["canciones", "Canciones", Music], ["eventos", "Eventos", Calendar], ["ministerios", "Grupos", LayoutGrid], ["envivo", "En vivo", Radio], ["proyeccion", "Pantalla", ImgIcon], ["ajustes", "Ajustes", Settings]]
            .filter(([val]) => !isCompact || (val !== "envivo" && val !== "proyeccion")) // Control en vivo/Proyección son de escritorio: en celular no aparecen
            .filter(([val]) => val !== "ministerios" || canSeeGrupos) // Grupos: solo admins o quien lidera al menos uno
            .map(([val, label, Icon]) => {
            const needsLive = val === "envivo" || val === "proyeccion";
            const needsLiveControlRole = (val === "envivo" || val === "proyeccion") && !canControlLive;
            const isDisabled = (needsLive && !liveEvent) || needsLiveControlRole;
            const active = tab === val;
            return (
              <button
                key={val}
                onClick={() => requestLeaveSongEditor(() => {
                  // Cambiar de pestaña siempre lleva a la RAÍZ de esa pestaña — si no se limpian estos
                  // tres, quedaban "pegados" (ej. abrir una canción desde un evento y luego, sin volver
                  // antes, tocar otra pestaña dejaba esa canción/evento fantasma abierto por debajo).
                  setTab(val); setSelectedEventId(null); setOpenSong(null); setSelectedMinistryId(null);
                })}
                disabled={isDisabled}
                className="navitem"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: active ? "#E8821E" : "transparent", border: "none", borderRadius: 18, padding: "8px 12px", cursor: isDisabled ? "not-allowed" : "pointer", opacity: isDisabled ? 0.35 : 1, flexShrink: 0 }}
              >
                <Icon size={17} color={active ? "#16324F" : "rgba(255,255,255,0.8)"} />
                <span style={{ fontSize: 9, fontWeight: 700, color: active ? "#16324F" : "rgba(255,255,255,0.6)" }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- AVATAR STACK ----------------
function AvatarStack({ initials, max = 3 }) {
  const shown = initials.slice(0, max);
  const rest = initials.length - shown.length;
  return (
    <div style={{ display: "flex" }}>
      {shown.map((init, i) => (
        <div key={i} style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", border: "2px solid #16233A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginLeft: i === 0 ? 0 : -8 }}>{init}</div>
      ))}
      {rest > 0 && <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#E8821E", color: "#16233A", border: "2px solid #16233A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, marginLeft: -8 }}>+{rest}</div>}
    </div>
  );
}
function eventAvatars(event) {
  const names = new Set();
  event.serviceOrder.forEach((item) => (item.encargados || []).forEach((m) => names.add(m.n)));
  return Array.from(names).map((n) => n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase());
}

// ---------------- INICIO ----------------
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function StatCard({ icon: Icon, label, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={onClick ? "hoverable" : undefined} style={{ flex: 1, background: "#fff", border: "none", borderRadius: 16, boxShadow: "0 4px 14px rgba(22,50,79,0.06)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, minWidth: 0, textAlign: "left", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color="#2F5FA8" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#16233A", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: "#8996A6", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    </Tag>
  );
}

// Agrupa eventos por día del mes REAL que se está viendo (year/month reales, no todo el historial junto
// — dos eventos en el mismo día-del-mes pero meses distintos ya no chocan en la misma celda).
function eventsByDay(events, year, month) {
  const map = {};
  events.forEach((ev) => {
    const d = parseIsoDateLocal(ev.date);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    (map[d.getDate()] = map[d.getDate()] || []).push(ev);
  });
  return map;
}
function nextUpcomingEvent(events, liveEventId) {
  if (liveEventId) return events.find((e) => e.id === liveEventId);
  return events
    .filter((ev) => isUpcoming(ev))
    .slice()
    .sort(compareByDay)[0];
}

function InicioView({ events, library, favoritesCount, memberCount, liveEventId, onSelectEvent, onGoToTeam, onOpenSong, isCompact }) {
  const liveEvent = events.find((e) => e.id === liveEventId);
  const [showFavorites, setShowFavorites] = useState(false);
  const favoriteSongs = library.filter((s) => s.favorite);
  const today = todayLocal();
  // Mes que se está viendo en el calendario — arranca en el mes real de hoy, navegable con ‹ ›.
  const [viewedMonth, setViewedMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const isViewingCurrentMonth = viewedMonth.year === today.getFullYear() && viewedMonth.month === today.getMonth();
  const changeMonth = (delta) => setViewedMonth(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const weeks = useMemo(() => buildMonthWeeks(viewedMonth.year, viewedMonth.month), [viewedMonth]);
  const byDay = useMemo(() => eventsByDay(events, viewedMonth.year, viewedMonth.month), [events, viewedMonth]);
  const eventsThisMonth = Object.values(byDay).reduce((acc, list) => acc + list.length, 0);
  const nextEvent = useMemo(() => nextUpcomingEvent(events, liveEventId), [events, liveEventId]);
  const nextDate = nextEvent ? parseIsoDateLocal(nextEvent.date) : null;
  const nextIsLive = nextEvent && nextEvent.id === liveEventId;

  return (
    <div className="screen-enter" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "22px 24px", boxSizing: "border-box", overflow: isCompact ? "auto" : "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600 }}>{greetingWord()}</div>
          <div style={{ fontSize: 13, color: "#64707F", marginTop: 2 }}>{TEAM_NAME}</div>
        </div>
        {liveEvent && (
          <button onClick={() => onSelectEvent(liveEvent.id)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#16324F", borderRadius: 20, padding: "9px 16px", border: "none", cursor: "pointer", flexShrink: 0 }}>
            <span className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8821E" }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>En vivo: {liveEvent.title}</span>
            <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", gap: 20, flex: 1, minHeight: 0 }}>
        {/* Calendario del mes en curso */}
        <div style={{ flex: isCompact ? "none" : 1.3, minHeight: 0, background: "#fff", borderRadius: 20, boxShadow: "0 6px 20px rgba(22,50,79,0.08)", padding: 18, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => changeMonth(-1)} style={iconGhost}><ChevronLeft size={16} /></button>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: "#16324F" }}>{MONTH_NAMES_FULL[viewedMonth.month]} {viewedMonth.year}</span>
              <button onClick={() => changeMonth(1)} style={iconGhost}><ChevronRight size={16} /></button>
              {!isViewingCurrentMonth && (
                <button onClick={() => setViewedMonth({ year: today.getFullYear(), month: today.getMonth() })} style={{ ...ghostToggleBtn, padding: "4px 8px", fontSize: 10 }}>Hoy</button>
              )}
            </div>
            <span style={{ fontSize: 11, color: "#8996A6", flexShrink: 0 }}>{eventsThisMonth} {eventsThisMonth === 1 ? "evento" : "eventos"} este mes</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6, flexShrink: 0 }}>
            {DOW_LABELS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#8996A6" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isCompact ? "none" : 1, minHeight: 0 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, flex: isCompact ? "none" : 1, minHeight: isCompact ? 40 : 0 }}>
                {week.map((day, di) => {
                  if (day === null) return <div key={di} />;
                  const dayEvents = byDay[day] || [];
                  const isNext = !!(nextDate && nextDate.getFullYear() === viewedMonth.year && nextDate.getMonth() === viewedMonth.month && day === nextDate.getDate());
                  const isToday = isViewingCurrentMonth && day === today.getDate();
                  return (
                    <button
                      key={di}
                      disabled={dayEvents.length === 0}
                      onClick={() => dayEvents[0] && onSelectEvent(dayEvents[0].id)}
                      className={dayEvents.length && !isNext ? "hoverable" : undefined}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                        borderRadius: 10, border: isToday && !isNext ? "1.5px solid #2F5FA8" : "1.5px solid transparent",
                        background: isNext ? "#E8821E" : dayEvents.length ? "#EEF1F6" : "transparent",
                        cursor: dayEvents.length ? "pointer" : "default", padding: 0,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: isNext ? 800 : 600, color: isNext ? "#fff" : "#33415A" }}>{day}</span>
                      {dayEvents.length > 0 && (
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: isNext ? "#fff" : "#E8821E" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Próximo evento + resumen rápido */}
        <div style={{ flex: isCompact ? "none" : 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {nextEvent ? (
            <button onClick={() => onSelectEvent(nextEvent.id)} className="hoverable" style={{ flex: isCompact ? "none" : 1, minHeight: isCompact ? 150 : 0, textAlign: "left", border: "none", cursor: "pointer", borderRadius: 20, padding: 0, overflow: "hidden", background: nextEvent.cover || DEFAULT_COVERS[0], color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: nextIsLive ? "0 10px 24px rgba(232,130,30,0.45)" : "0 10px 22px rgba(22,50,79,0.2)" }}>
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, opacity: 0.85 }}>{nextIsLive ? "● EN VIVO AHORA" : "PRÓXIMO EVENTO"}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, margin: "6px 0 4px", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{nextEvent.title}</div>
                <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 5 }}><MapPin size={12} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextEvent.location}</span></div>
              </div>
              <div style={{ padding: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", background: "rgba(0,0,0,0.12)" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{nextDate ? nextDate.getDate() : "–"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>{nextDate ? MONTH_ABBR[nextDate.getMonth()] : ""}{nextEvent.dateLabel ? ` · ${nextEvent.dateLabel}` : ""}</div>
                </div>
                <AvatarStack initials={eventAvatars(nextEvent)} max={3} />
              </div>
            </button>
          ) : (
            <div style={{ flex: isCompact ? "none" : 1, minHeight: isCompact ? 100 : 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#8996A6", fontSize: 13, background: "#fff", borderRadius: 20 }}>No hay eventos próximos.</div>
          )}

          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <StatCard icon={Heart} label="Canciones favoritas" value={favoritesCount} onClick={() => setShowFavorites(true)} />
            <StatCard icon={Users} label="Miembros del equipo" value={memberCount} onClick={onGoToTeam} />
          </div>
        </div>
      </div>

      {showFavorites && (
        <ModalShell title="Canciones favoritas" icon={Heart} color="#C23B32" onClose={() => setShowFavorites(false)}>
          {favoriteSongs.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8996A6" }}>Todavía no has marcado ninguna canción como favorita — busca el corazón en Canciones.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
              {favoriteSongs.map((s) => (
                <button key={s.id} onClick={() => { setShowFavorites(false); onOpenSong(s.id); }} className="hoverable" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: "#EEF1F6", border: "none", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{s.key} · {s.tempo} bpm</div>
                  </div>
                  <ChevronRight size={14} color="#8996A6" />
                </button>
              ))}
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}

// ---------------- AJUSTES ----------------
function ToggleSwitch({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ width: 44, height: 26, borderRadius: 20, background: checked ? "#E8821E" : "#C7D0DD", border: "none", position: "relative", cursor: "pointer", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .15s" }} />
    </button>
  );
}
function NavRow({ icon: Icon, label, onClick, right, danger }) {
  // Si no hay onClick propio de la fila (ej. cuando "right" ya es interactivo, como un ToggleSwitch),
  // usamos un <div> en vez de <button> — un <button> no puede contener otro <button> (HTML inválido).
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: "14px 16px", marginBottom: 8, cursor: onClick ? "pointer" : "default", boxSizing: "border-box" }}>
      <Icon size={18} color={danger ? "#C23B32" : "#33415A"} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: danger ? "#C23B32" : "#16233A" }}>{label}</span>
      {right}
    </Tag>
  );
}
function SectionLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "#64707F", letterSpacing: 0.5, margin: "18px 0 8px" }}>{children}</div>;
}

function useInstallState() {
  const [state, setState] = useState(getInstallState);
  useEffect(() => subscribeInstallState(() => setState(getInstallState())), []);
  return state;
}

function SettingsView({ realIsAdmin, myRole, roleOverride, setRoleOverride, myName, nameOverride, setNameOverride, usuariosReales, perfil, events, onSelectEvent, onGoToUsuarios, userId }) {
  const [horarioAbierto, setHorarioAbierto] = useState(false);
  const [showTeamList, setShowTeamList] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pushEstado, setPushEstado] = useState("cargando"); // cargando | activo | inactivo | sin-soporte
  const [pushBusy, setPushBusy] = useState(false);
  const install = useInstallState();
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushEstado("sin-soporte");
      return;
    }
    estaSuscritoPush().then((si) => setPushEstado(si ? "activo" : "inactivo")).catch(() => setPushEstado("inactivo"));
  }, []);
  const activarPush = async () => {
    setPushBusy(true);
    try {
      await suscribirPush(userId);
      setPushEstado("activo");
    } catch (e) {
      window.alert(e.message || "No se pudo activar las notificaciones push.");
    } finally {
      setPushBusy(false);
    }
  };
  const desactivarPush = async () => {
    setPushBusy(true);
    try {
      await desuscribirPush();
      setPushEstado("inactivo");
    } catch (e) {
      window.alert(e.message || "No se pudo desactivar las notificaciones push.");
    } finally {
      setPushBusy(false);
    }
  };
  const ROLE_OPTIONS = ["Administrador", "Multimedia", "Músico", "Miembro"];
  const initials = (myName || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const misEventos = useMemo(
    () => events.filter((e) => e.serviceOrder.some((item) => (item.encargados || []).some((m) => m.n === myName))),
    [events, myName]
  );

  const signOut = () => {
    if (!window.confirm("¿Cerrar sesión?")) return;
    supabase.auth.signOut();
  };

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 18 }}>Ajustes</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0, color: "#fff" }}>{initials}</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{myName || "Sin nombre"}</div>
          {perfil?.email && <div style={{ fontSize: 12, color: "#64707F" }}>{perfil.email}</div>}
          <span style={{ display: "inline-block", marginTop: 4, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 12, padding: "2px 10px", fontSize: 11, color: "#33415A" }}>{myRole}</span>
        </div>
      </div>

      <SectionLabel>APLICACIÓN</SectionLabel>
      {install.installed ? (
        <NavRow icon={Check} label="La app ya está instalada" right={null} />
      ) : install.canInstall ? (
        <NavRow icon={Download} label="Instalar la app" onClick={() => promptInstall()} right={<ChevronRight size={16} color="#8996A6" />} />
      ) : isIosSafari() ? (
        <NavRow icon={Download} label="Compartir → Agregar a inicio para instalar" right={null} />
      ) : (
        <NavRow icon={Download} label="Instalar la app" right={<span style={{ fontSize: 11, color: "#8996A6" }}>Disponible desde el menú del navegador</span>} />
      )}
      {pushEstado === "sin-soporte" ? (
        <NavRow icon={Bell} label="Notificaciones push no disponibles en este navegador" right={null} />
      ) : pushEstado === "activo" ? (
        // A propósito sin un botón de un solo toque para desactivar — solo un enlace chico que primero
        // confirma con una advertencia, para que nadie las apague sin querer o sin pensarlo.
        <NavRow
          icon={Bell}
          label="Notificaciones push activadas"
          right={pushBusy ? null : (
            <span
              onClick={(e) => { e.stopPropagation(); if (window.confirm("¿Seguro que quieres desactivar las notificaciones push? Podrías perderte avisos de tus asignaciones y recordatorios de eventos.")) desactivarPush(); }}
              style={{ fontSize: 11, color: "#8996A6", fontWeight: 600, cursor: "pointer" }}
            >
              Desactivar
            </span>
          )}
        />
      ) : pushEstado === "inactivo" ? (
        <NavRow icon={Bell} label="Activar notificaciones push" onClick={activarPush} right={pushBusy ? null : <ChevronRight size={16} color="#8996A6" />} />
      ) : null}

      <SectionLabel>ROL DE ESTE DISPOSITIVO</SectionLabel>
      <div style={{ background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#64707F", marginBottom: 10 }}>Solo los roles <b>Administrador</b> y <b>Multimedia</b> pueden controlar la transmisión y finalizar un evento en vivo — así ningún músico o miembro puede detenerla por accidente desde su teléfono. Tu rol lo asigna un administrador desde Usuarios.</div>
        {realIsAdmin ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#E8821E", marginBottom: 8 }}>Como administrador puedes probar cómo se ve la app con otro rol:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ROLE_OPTIONS.map((r) => (
                <button key={r} onClick={() => setRoleOverride(r === myRole && roleOverride ? null : r)} style={{ fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 20, border: myRole === r ? "none" : "1px solid #C7D0DD", cursor: "pointer", background: myRole === r ? "#16324F" : "#FFFFFF", color: myRole === r ? "#fff" : "#33415A" }}>{r}</button>
              ))}
            </div>
          </>
        ) : (
          <span style={{ display: "inline-block", background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 12, padding: "3px 12px", fontSize: 12, fontWeight: 700, color: "#33415A" }}>{myRole}</span>
        )}
      </div>

      {realIsAdmin && (
        <>
          <SectionLabel>ADMINISTRACIÓN</SectionLabel>
          <NavRow icon={Settings} label="Usuarios" onClick={onGoToUsuarios} right={<ChevronRight size={16} color="#8996A6" />} />

          <SectionLabel>SIMULAR IDENTIDAD (SOLO ADMINISTRADORES)</SectionLabel>
          <div style={{ background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: "#64707F", marginBottom: 10 }}>Simula qué ve la app si "inicias sesión" como otra persona ya registrada — así puedes probar que cada quien vea solo lo que le corresponde (limpieza solo ve limpieza, nadie salvo administradores ve Predicación, etc.).</div>
            <select value={nameOverride || ""} onChange={(e) => setNameOverride(e.target.value || null)} style={inputStyle}>
              <option value="">Yo mismo</option>
              {usuariosReales.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre}{u.rol === "admin" ? " (administrador)" : ""}</option>)}
            </select>
          </div>
        </>
      )}

      <SectionLabel>EQUIPO</SectionLabel>
      <button onClick={() => setShowTeamList(true)} className="hoverable" style={{ background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: 16, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", cursor: "pointer", textAlign: "left" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{TEAM_NAME}</div>
          <div style={{ fontSize: 12, color: "#64707F" }}>{usuariosReales.length} {usuariosReales.length === 1 ? "miembro" : "miembros"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AvatarStack initials={usuariosReales.map((u) => u.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase())} max={2} />
          <ChevronRight size={16} color="#8996A6" />
        </div>
      </button>
      {showTeamList && (
        <ModalShell title={TEAM_NAME} icon={Users} color="#6E63C7" onClose={() => setShowTeamList(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "60vh", overflowY: "auto" }}>
            {usuariosReales.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid #EEF1F6" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {u.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{u.nombre}</span>
                {u.rol === "admin" && <span style={{ fontSize: 10, fontWeight: 700, color: "#2F5FA8", background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 12, padding: "2px 8px" }}>ADMIN</span>}
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      <SectionLabel>PERSONAL</SectionLabel>
      <NavRow icon={Calendar} label="Mi Horario" onClick={() => setHorarioAbierto((v) => !v)} right={<span style={{ fontSize: 11, color: "#8996A6", display: "flex", alignItems: "center", gap: 4 }}>{misEventos.length} {horarioAbierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>} />
      {horarioAbierto && (
        misEventos.length ? (
          <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {misEventos.map((e) => (
              <button key={e.id} onClick={() => onSelectEvent(e.id)} className="hoverable" style={{ textAlign: "left", background: "#FFFFFF", border: "none", boxShadow: "0 2px 10px rgba(22,50,79,0.07)", borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: "#8996A6" }}>{formatFullDate(e.date) || e.dateLabel}</div>
                </div>
                <ChevronRight size={14} color="#8996A6" />
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#8996A6", marginBottom: 8, padding: "0 4px" }}>No estás asignado a ningún rol en próximos eventos.</div>
        )
      )}

      <SectionLabel>CUENTA</SectionLabel>
      <NavRow icon={KeyRound} label="Cambiar contraseña" onClick={() => setShowChangePassword(true)} right={<ChevronRight size={16} color="#8996A6" />} />
      <NavRow icon={LogOut} label="Cerrar sesión" danger onClick={signOut} />

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      <div style={{ textAlign: "center", fontSize: 11, color: "#C3CBD6", marginTop: 20 }}>JBP App</div>
    </div>
  );
}

// Cambiar la propia contraseña sin depender de un administrador — a diferencia de "Reiniciar
// contraseña" en Usuarios (que un admin usa para OTRA persona), esto es autoservicio: updateUser()
// de Supabase Auth ya cambia la contraseña de la sesión actual sin pedir la anterior.
function ChangePasswordModal({ onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  return (
    <ModalShell title="Cambiar contraseña" icon={KeyRound} color="#16324F" onClose={onClose}>
      {done ? (
        <div style={{ fontSize: 13, color: "#1F8A73", fontWeight: 700 }}>Contraseña actualizada correctamente.</div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="password" required placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoFocus />
          <input type="password" required placeholder="Confirmar contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
        </form>
      )}
    </ModalShell>
  );
}

// ---------------- MINISTERIOS ----------------
function MinistriesList({ ministries, usuariosReales, isAdminViewer, onSelect, onCreate }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", leaderId: "", color: MINISTRY_COLORS[0] });

  const submit = () => {
    if (!form.name.trim()) return;
    onCreate(form);
    setForm({ name: "", leaderId: "", color: MINISTRY_COLORS[0] });
    setShowForm(false);
  };

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>Ministerios</h2>
        {isAdminViewer && <button onClick={() => setShowForm(true)} style={{ ...iconGhost, width: 30, height: 30, background: "#EEF1F6", border: "1px solid #C7D0DD" }}><Plus size={16} /></button>}
      </div>
      <div style={{ fontSize: 12, color: "#64707F", marginBottom: 16 }}>Cada ministerio tiene su propio espacio para compartir la planificación del mes y recursos con su equipo. Cualquier miembro puede ser el líder de un grupo.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {ministries.map((m) => (
          <button key={m.id} onClick={() => onSelect(m.id)} className="hoverable" style={{ textAlign: "left", background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: 16, cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: `${m.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Users size={17} color={m.color} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{m.name}</div>
            <div style={{ fontSize: 12, color: "#64707F" }}>Líder: {m.leaderName || "Sin asignar"}</div>
            <div style={{ fontSize: 12, color: "#8996A6", marginTop: 2 }}>{m.memberCount} miembros · {m.plan.length} planes este mes</div>
          </button>
        ))}
      </div>

      {showForm && (
        <ModalShell title="Nuevo ministerio" icon={LayoutGrid} color="#5661B3" onClose={() => setShowForm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Nombre" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Ministerio de Matrimonios" style={inputStyle} /></Field>
            <Field label="Líder">
              <select value={form.leaderId} onChange={(e) => setForm({ ...form, leaderId: e.target.value })} style={inputStyle}>
                <option value="">Sin asignar</option>
                {usuariosReales.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Field>
            <Field label="Color">
              <div style={{ display: "flex", gap: 8 }}>
                {MINISTRY_COLORS.map((c) => (<button key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: form.color === c ? "2px solid #fff" : "1px solid #C7D0DD", cursor: "pointer" }} />))}
              </div>
            </Field>
          </div>
          <button onClick={submit} disabled={!form.name.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: form.name.trim() ? 1 : 0.4 }}>Crear ministerio</button>
        </ModalShell>
      )}
    </div>
  );
}

function MinistryDetail({ ministry, usuariosReales, isAdminViewer, canEdit, onBack, onAddPlanItem, onUpdatePlanItem, onRemovePlanItem, onAddResource, onRemoveResource, onSetLeader }) {
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceDraft, setResourceDraft] = useState({ title: "", link: "" });
  if (!ministry) return null;

  const submitResource = () => {
    if (!resourceDraft.title.trim()) return;
    onAddResource(resourceDraft);
    setResourceDraft({ title: "", link: "" });
    setShowResourceForm(false);
  };

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <button onClick={onBack} style={{ ...iconGhost, marginBottom: 10 }}><ArrowLeft size={16} /></button>
      <div style={{ borderRadius: 12, background: `linear-gradient(135deg, ${ministry.color}33, #EEF1F6)`, padding: 20, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{ministry.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#33415A" }}>
          Líder:
          {isAdminViewer ? (
            <select value={ministry.leaderId || ""} onChange={(e) => onSetLeader(e.target.value || null)} style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12 }}>
              <option value="">Sin asignar</option>
              {usuariosReales.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : (
            <span style={{ fontWeight: 700 }}>{ministry.leaderName || "Sin asignar"}</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><ClipboardList size={15} color={ministry.color} /> Planificación del mes</div>
        {canEdit && <button onClick={onAddPlanItem} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar fecha</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {ministry.plan.map((p) => (
          <div key={p.id} style={{ background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input type="date" disabled={!canEdit} title="Fecha del domingo (o día) al que corresponde esta planificación" value={p.date || ""} onChange={(e) => onUpdatePlanItem(p.id, "date", e.target.value)} style={{ ...inputStyle, width: 150, fontSize: 12, fontWeight: 700, flexShrink: 0 }} />
              <input disabled={!canEdit} value={p.title} onChange={(e) => onUpdatePlanItem(p.id, "title", e.target.value)} placeholder="Título de la semana" style={{ ...inputStyle, flex: 1, fontWeight: 700 }} />
              {canEdit && <button onClick={() => onRemovePlanItem(p.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>}
            </div>
            <textarea disabled={!canEdit} value={p.detail} onChange={(e) => onUpdatePlanItem(p.id, "detail", e.target.value)} placeholder="Detalle, recursos necesarios, responsables..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        ))}
        {ministry.plan.length === 0 && <div style={{ color: "#8996A6", fontSize: 13 }}>Aún no hay planificación este mes.</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><FolderOpen size={15} color={ministry.color} /> Recursos</div>
        {canEdit && <button onClick={() => setShowResourceForm(true)} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar recurso</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ministry.resources.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 8, padding: "10px 12px" }}>
            <FolderOpen size={14} color="#8996A6" />
            <span style={{ fontSize: 13, flex: 1 }}>{r.title}</span>
            {r.link && <a href={r.link} target="_blank" rel="noreferrer" style={{ color: "#2F5FA8" }}><ExternalLink size={14} /></a>}
            {canEdit && <button onClick={() => onRemoveResource(r.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>}
          </div>
        ))}
        {ministry.resources.length === 0 && <div style={{ color: "#8996A6", fontSize: 13 }}>No hay recursos compartidos todavía.</div>}
      </div>

      {showResourceForm && (
        <ModalShell title="Agregar recurso" icon={FolderOpen} color={ministry.color} onClose={() => setShowResourceForm(false)}>
          <Field label="Título" required><input value={resourceDraft.title} onChange={(e) => setResourceDraft({ ...resourceDraft, title: e.target.value })} placeholder="Ej. Guía de manualidades" style={inputStyle} /></Field>
          <div style={{ height: 10 }} />
          <Field label="Enlace (opcional)"><input value={resourceDraft.link} onChange={(e) => setResourceDraft({ ...resourceDraft, link: e.target.value })} placeholder="https://..." style={inputStyle} /></Field>
          <button onClick={submitResource} style={{ ...primaryBtn, marginTop: 14 }}>Agregar</button>
        </ModalShell>
      )}
    </div>
  );
}

// ---------------- CANCIONES: LISTA ----------------
function CancionesList({ library, isAdminViewer, onToggleFavorite, onOpen, onNew, onDelete }) {
  const [query, setQuery] = useState("");
  const filtered = library.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>{library.length} Canciones</h2>
        {isAdminViewer && <button onClick={onNew} style={{ ...iconGhost, width: 30, height: 30, background: "#EEF1F6", border: "1px solid #C7D0DD" }}><Plus size={16} /></button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
        <Search size={15} color="#8996A6" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título o letra" style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 13, width: "100%" }} />
      </div>
      {filtered.map((s) => (
        <div key={s.id} onClick={() => onOpen(s.id)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: "14px 16px", marginBottom: 8, cursor: "pointer" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: "#64707F" }}>{s.artist || "Unknown"}</div>
          </div>
          {s.hasAttachment && <Paperclip size={15} color="#8996A6" />}
          <span style={{ fontSize: 11, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 20, padding: "3px 10px", color: "#33415A" }}>{s.key}</span>
          <span style={{ fontSize: 11, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 20, padding: "3px 10px", color: "#33415A" }}>{s.tempo} bpm</span>
          <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(s.id); }} style={iconGhost}><Heart size={16} color={s.favorite ? "#C23B32" : "#8996A6"} fill={s.favorite ? "#C23B32" : "none"} /></button>
          {isAdminViewer && <button onClick={(e) => { e.stopPropagation(); onDelete(s); }} style={iconGhost}><Trash2 size={16} color="#8996A6" /></button>}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ color: "#8996A6", fontSize: 13 }}>No hay canciones que coincidan con la búsqueda.</div>}
    </div>
  );
}

// ---------------- CANCIONES: EDITOR ----------------
function blankSong() {
  return { id: nextSongId(), title: "", tempo: "", key: "", artist: "", themes: "", category: "corito", favorite: false, hasAttachment: false, defaultStructure: [], blocks: {}, letra: {} };
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
function ChordsAboveLyrics({ raw, semitones = 0 }) {
  const { plain, positions } = parseChordLine(transposeLine(raw, semitones));
  const chordRow = buildChordRow(positions);
  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre", fontSize: 13, marginBottom: 10 }}>
      <div style={{ color: "#1F8A73", fontWeight: 700, minHeight: "1.3em" }}>{chordRow || "\u00A0"}</div>
      <div style={{ color: "#16233A" }}>{plain || "\u00A0"}</div>
    </div>
  );
}
function SlideMiniPreview({ lines }) {
  return (
    <div style={{ background: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)", borderRadius: 8, padding: "16px 10px", minHeight: 70, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 12, lineHeight: 1.4, color: "#F3F1EC" }}>
        {lines.filter((l) => l.trim()).length ? lines.map((l, i) => <div key={i}>{l || "\u00A0"}</div>) : <span style={{ color: "#3A4150" }}>Diapositiva vacía</span>}
      </div>
    </div>
  );
}

function badgeColor(badge) {
  if (/^c/i.test(badge)) return "#D98A54"; // Coro: durazno
  if (/^p/i.test(badge)) return "#B15EA0"; // Puente: orquídea
  return "#2E86AB"; // Estrofas: celeste
}

function SongView({ song, isAdminViewer, onBack, onEdit, onTranspose, onDelete, onPrev, onNext, positionLabel, enterDirection }) {
  const sectionRefs = useRef({});
  const containerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const draggingRef = useRef(false); // true una vez que el gesto se confirmó horizontal (no scroll vertical)
  // Efecto "galería de fotos": mientras se arrastra, el contenido sigue al dedo en tiempo real (sin
  // transición, dragX se mueve 1 a 1 con el gesto); al soltar, si pasó el umbral termina de salir de la
  // pantalla hacia ese lado (con transición) y RECIÉN AHÍ cambia de canción — la que entra se monta de
  // cero (por el key en el sitio donde se usa <SongView>) y juega su propia animación de entrada desde
  // el lado opuesto. Si no pasó el umbral, vuelve a 0 con transición (como soltar una foto a medio camino).
  const [dragX, setDragX] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | dragging | exiting
  if (!song) return null;
  const blockKeys = Object.keys(song.blocks);
  const scrollTo = (key) => sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  const isMinorKey = song.key.endsWith("m");
  const keyChoices = KEY_OPTIONS.filter((k) => k.endsWith("m") === isMinorKey);
  const canSwipe = onPrev || onNext;
  const completeSwipe = (dir, distance) => {
    setPhase("exiting");
    setDragX(dir === "next" ? -distance : distance);
    setTimeout(() => { (dir === "next" ? onNext : onPrev)(); }, 200);
  };
  // Pointer Events (no Touch Events): unifica mouse/touch/lápiz y es más confiable en apps instaladas.
  // setPointerCapture fuerza a que este mismo elemento reciba todo el gesto pase lo que pase con el
  // dedo entre medio (scroll, salirse del borde) — sin esto, en algunos navegadores el "up" se pierde.
  const swipeHandlers = canSwipe ? {
    onPointerDown: (e) => {
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
      draggingRef.current = false;
      e.currentTarget.setPointerCapture?.(e.pointerId);
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
        padding: 20, maxWidth: 820, width: "100%", minHeight: "70vh", margin: "0 auto", boxSizing: "border-box", position: "relative",
        touchAction: canSwipe ? "pan-y" : undefined,
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: phase === "dragging" ? "none" : "transform 0.22s ease",
      }}
      {...swipeHandlers}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdminViewer && (
            <select
              value={song.key}
              onChange={(e) => onTranspose(song.id, e.target.value)}
              title="Transportar la canción a otra tonalidad"
              style={{ fontSize: 11, fontWeight: 700, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 6, padding: "5px 6px", color: "#33415A" }}
            >
              {keyChoices.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
          {!isAdminViewer && (
            <span style={{ fontSize: 11, fontWeight: 700, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 6, padding: "5px 8px", color: "#33415A" }}>{song.key}</span>
          )}
          {song.hasAttachment && <Paperclip size={16} color="#8996A6" />}
          {isAdminViewer && (
            <button onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "#16233A", cursor: "pointer" }}>
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

      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, margin: "0 0 4px" }}>{song.title}</h2>
      <div style={{ fontSize: 13, color: "#64707F", marginBottom: 16 }}>
        {song.artist || "Unknown"} · {song.tempo} bpm
        {positionLabel && <span style={{ marginLeft: 8, fontWeight: 700, color: "#E8821E" }}>· {positionLabel} en el setlist</span>}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {blockKeys.map((key) => {
          const b = song.blocks[key];
          const color = badgeColor(b.badge);
          return (
            <button key={key} onClick={() => scrollTo(key)} className="hoverable" style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${color}`, background: "transparent", color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {b.badge}
            </button>
          );
        })}
      </div>

      {blockKeys.map((key) => {
        const b = song.blocks[key];
        const color = badgeColor(b.badge);
        return (
          <div key={key} ref={(el) => { sectionRefs.current[key] = el; }} style={{ marginBottom: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${color}22`, borderRadius: 20, padding: "5px 12px", marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.badge}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{b.label}</span>
            </div>
            <div style={{ background: "#EEF1F6", borderRadius: 10, padding: 16 }}>
              {b.lines.map((l, i) => <ChordsAboveLyrics key={i} raw={l} />)}
            </div>
          </div>
        );
      })}

      {(onPrev || onNext) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, color: "#8996A6", fontSize: 12 }}>
          {onPrev && <ChevronLeft size={14} />}
          <span>Desliza para {onPrev && onNext ? "cambiar de canción" : onNext ? "la siguiente canción" : "la canción anterior"}</span>
          {onNext && <ChevronRight size={14} />}
        </div>
      )}
    </div>
  );
}

function SongEditor({ song, isAdminViewer, onCancel, onSave, onDirtyChange, draftGetterRef }) {
  const canEditKey = isAdminViewer || !song;
  const initialSnapshotRef = useRef(song ? JSON.stringify(song) : JSON.stringify(blankSong()));
  const [draft, setDraft] = useState(() => JSON.parse(initialSnapshotRef.current));
  const [subTab, setSubTab] = useState("detalles"); // detalles | contenido | letra | estructura
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [chordMode, setChordMode] = useState("triadas"); // triadas | septimas
  const textareaRefs = useRef({});

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

  // ---- Editor de diapositivas (Letra) ----
  const setSlideText = (key, slideIdx, text) => setDraft((d) => {
    const group = [...d.letra[key]]; group[slideIdx] = text.split("\n");
    return { ...d, letra: { ...d.letra, [key]: group } };
  });
  const addSlide = (key, afterIdx) => setDraft((d) => {
    const group = [...(d.letra[key] || [])];
    group.splice(afterIdx + 1, 0, [""]);
    return { ...d, letra: { ...d.letra, [key]: group } };
  });
  const removeSlide = (key, slideIdx) => setDraft((d) => {
    const group = [...d.letra[key]];
    if (group.length <= 1) return d;
    group.splice(slideIdx, 1);
    return { ...d, letra: { ...d.letra, [key]: group } };
  });
  const moveSlide = (key, slideIdx, dir) => setDraft((d) => {
    const group = [...d.letra[key]]; const j = slideIdx + dir;
    if (j < 0 || j >= group.length) return d;
    [group[slideIdx], group[j]] = [group[j], group[slideIdx]];
    return { ...d, letra: { ...d.letra, [key]: group } };
  });
  const syncLetraFromContenido = (key) => setDraft((d) => ({ ...d, letra: { ...d.letra, [key]: [d.blocks[key].lines.map(stripChords)] } }));
  const autoSplit = (key) => setDraft((d) => {
    const flat = d.blocks[key].lines.map(stripChords);
    const chunks = []; for (let i = 0; i < flat.length; i += 2) chunks.push(flat.slice(i, i + 2));
    return { ...d, letra: { ...d.letra, [key]: chunks.length ? chunks : [[""]] } };
  });

  const addBlock = () => {
    const n = blockKeys.length + 1;
    const key = `b${Date.now()}`;
    setDraft((d) => ({
      ...d,
      blocks: { ...d.blocks, [key]: { badge: `V${n}`, label: `Estrofa ${n}`, bars: 8, lines: [""] } },
      letra: { ...d.letra, [key]: [[""]] },
    }));
  };
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

  const entries = groupConsecutive(draft.defaultStructure);
  const setEntries = (newEntries) => setDraft((d) => ({ ...d, defaultStructure: expandEntries(newEntries) }));
  const changeCount = (idx, delta) => {
    const arr = [...entries]; arr[idx] = { ...arr[idx], count: Math.max(0, arr[idx].count + delta) };
    setEntries(arr.filter((e) => e.count > 0));
  };
  const moveEntry = (idx, dir) => { const arr = [...entries]; const j = idx + dir; if (j < 0 || j >= arr.length) return; [arr[idx], arr[j]] = [arr[j], arr[idx]]; setEntries(arr); };
  const addEntry = (key) => setEntries([...entries, { key, count: 1 }]);

  const canSave = draft.title.trim() && draft.key.trim() && draft.artist.trim();

  return (
    <div style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      {/* Fijo al hacer scroll: así "Guardar" queda siempre a mano después de agregar bloques, acordes
          o diapositivas más abajo, sin tener que volver a subir hasta el principio. */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#F4F6FA", paddingBottom: 10, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onCancel} style={iconGhost}><ArrowLeft size={16} /></button>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 }}>{song ? "Editar canción" : "Nueva canción"}</span>
          </div>
          <button disabled={!canSave} onClick={() => onSave(draft)} style={{ ...primaryBtn, width: "auto", padding: "8px 18px", opacity: canSave ? 1 : 0.4, cursor: canSave ? "pointer" : "not-allowed" }}>Guardar</button>
        </div>

        <div style={{ display: "flex", gap: 18, borderBottom: "1px solid #DDE3ED", marginTop: 14 }}>
          {[["detalles", "Detalles"], ["contenido", "Contenido"], ["letra", "Letra"], ["estructura", "Estructura"]].map(([val, label]) => (
            <button key={val} onClick={() => setSubTab(val)} style={{ background: "none", border: "none", padding: "0 0 10px", fontSize: 13, fontWeight: 700, color: subTab === val ? "#16233A" : "#8996A6", borderBottom: subTab === val ? "2px solid #2F5FA8" : "2px solid transparent", cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>

      {subTab === "detalles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
          <Field label="Título" required><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Introduce un título" style={inputStyle} /></Field>
          <Field label="Tempo"><input value={draft.tempo} onChange={(e) => setDraft({ ...draft, tempo: e.target.value })} placeholder="Introduce el tempo" style={inputStyle} /></Field>
          <Field label="Tonalidad" required>
            {canEditKey ? (
              <select value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} style={inputStyle}>
                <option value="">Selecciona tonalidad</option>
                {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            ) : (
              <div style={{ ...inputStyle, color: "#64707F", background: "#EEF1F6" }}>
                {draft.key || "Sin definir"}
                <span style={{ display: "block", fontSize: 11, color: "#8996A6", marginTop: 4 }}>Solo un administrador puede cambiar la tonalidad definitiva de la canción.</span>
              </div>
            )}
          </Field>
          <Field label="Artista" required><input value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} placeholder="Elegir artista" style={inputStyle} /></Field>
          <Field label="Temas"><input value={draft.themes} onChange={(e) => setDraft({ ...draft, themes: e.target.value })} placeholder="Ej. Adoración, Fe" style={inputStyle} /></Field>
          <Field label="Clasificación" required>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(SONG_CATEGORIES).map(([key, c]) => (
                <button key={key} type="button" onClick={() => setDraft({ ...draft, category: key })} style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, border: draft.category === key ? "2px solid #E8821E" : "1px solid #C7D0DD", background: draft.category === key ? "#FFF4E8" : "#fff", color: "#16233A", cursor: "pointer" }}>{c.label}</button>
              ))}
            </div>
            <span style={{ display: "block", fontSize: 11, color: "#8996A6", marginTop: 4 }}>Define a qué bloque del Setlist se manda esta canción al agregarla (Himno/Corito/Canto especial → Alabanza, Adoración → Adoración).</span>
          </Field>
        </div>
      )}

      {subTab === "contenido" && (
        <div>
          <div style={{ fontSize: 12, color: "#64707F", marginBottom: 10 }}>Escribe la letra con los acordes en formato <code style={{ color: "#1F8A73" }}>[Acorde]</code> justo antes de la sílaba, o toca un acorde de abajo para insertarlo donde esté el cursor. Esto es lo que ve el músico.</div>

          {draft.key ? (
            <div style={{ background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>ACORDES DE {draft.key.toUpperCase()} — toca uno para insertarlo</div>
                <div style={{ display: "flex", gap: 3, background: "#EEF1F6", padding: 2, borderRadius: 6 }}>
                  {[["triadas", "Triadas"], ["septimas", "Con séptima"]].map(([val, label]) => (
                    <button key={val} onClick={() => setChordMode(val)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 5, border: "none", cursor: "pointer", background: chordMode === val ? "#1F8A73" : "transparent", color: chordMode === val ? "#0D1410" : "#64707F" }}>{label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {diatonicChords(draft.key).map((c) => {
                  const label = chordMode === "septimas" ? c.chord7 : c.chord;
                  return (
                    <button key={c.roman} onClick={() => insertChord(label)} className="hoverable" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
                      <span style={{ fontSize: 10, color: "#8996A6" }}>{c.roman}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#8996A6", marginBottom: 14 }}>Elige una tonalidad en "Detalles" para ver aquí los acordes que puedes usar.</div>
          )}

          {blockKeys.map((key) => (
            <div key={key} style={{ background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <input value={draft.blocks[key].badge} onChange={(e) => setBlockField(key, "badge", e.target.value)} style={{ ...inputStyle, width: 46, textAlign: "center", padding: "6px 4px" }} />
                <input value={draft.blocks[key].label} onChange={(e) => setBlockField(key, "label", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <input type="number" min={1} value={draft.blocks[key].bars || 8} onChange={(e) => setBlockField(key, "bars", Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, width: 48, textAlign: "center", padding: "6px 4px" }} />
                  <span style={{ fontSize: 10, color: "#8996A6", whiteSpace: "nowrap" }}>compases</span>
                </div>
                <button onClick={() => removeBlock(key)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
              </div>
              <textarea
                ref={(el) => { textareaRefs.current[key] = el; }}
                onFocus={() => setActiveBlockKey(key)}
                value={draft.blocks[key].lines.join("\n")}
                onChange={(e) => setBlockLines(key, e.target.value)}
                rows={draft.blocks[key].lines.length + 1}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 8, border: activeBlockKey === key ? "1px solid #1F8A73" : "1px solid #C7D0DD" }}
              />
              <div style={{ marginTop: 4 }}>
                {draft.blocks[key].lines.map((l, i) => <ChordsAboveLyrics key={i} raw={l} />)}
              </div>
            </div>
          ))}
          <button onClick={addBlock} className="hoverable" style={addBtnStyle}><Plus size={14} /> Agregar sección</button>
        </div>
      )}

      {subTab === "letra" && (
        <div>
          <div style={{ fontSize: 12, color: "#64707F", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} color="#E8821E" /> Arma aquí las diapositivas exactas que se van a proyectar. Multimedia solo las va a ejecutar en vivo — no necesita escribir nada ese día.
          </div>
          {blockKeys.map((key) => {
            const slideGroup = draft.letra[key] || [[""]];
            return (
              <div key={key} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{draft.blocks[key].badge} · {draft.blocks[key].label} <span style={{ color: "#8996A6", fontWeight: 500 }}>({slideGroup.length} diapositiva{slideGroup.length !== 1 ? "s" : ""})</span></span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => autoSplit(key)} className="hoverable" style={miniBtnStyle}><Sparkles size={11} /> Dividir en pares de líneas</button>
                    <button onClick={() => syncLetraFromContenido(key)} className="hoverable" style={miniBtnStyle}><RefreshCw size={11} /> Reiniciar desde Contenido</button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                  {slideGroup.map((lines, si) => (
                    <div key={si} style={{ background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#8996A6" }}>DIAPOSITIVA {si + 1}</span>
                        <div style={{ display: "flex", gap: 2 }}>
                          <button onClick={() => moveSlide(key, si, -1)} style={iconGhost}><ChevronUp size={13} /></button>
                          <button onClick={() => moveSlide(key, si, 1)} style={iconGhost}><ChevronDown size={13} /></button>
                          <button onClick={() => removeSlide(key, si)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <SlideMiniPreview lines={lines} />
                      <textarea
                        value={lines.join("\n")}
                        onChange={(e) => setSlideText(key, si, e.target.value)}
                        rows={Math.max(lines.length, 2) + 1}
                        style={{ ...inputStyle, resize: "vertical", fontSize: 12, marginTop: 8 }}
                      />
                      <button onClick={() => addSlide(key, si)} className="hoverable" style={{ ...miniBtnStyle, width: "100%", justifyContent: "center", marginTop: 8 }}><Plus size={12} /> Diapositiva después</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === "estructura" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#64707F", marginBottom: 8 }}><ListMusic size={13} /> ESTRUCTURA ACTUAL</div>
            {entries.map((e, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                <GripVertical size={14} color="#C3CBD6" />
                <span style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #C3CBD6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{draft.blocks[e.key]?.badge}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{draft.blocks[e.key]?.label}</span>
                <button onClick={() => changeCount(idx, -1)} style={iconGhost}><Minus size={13} /></button>
                <span style={{ fontSize: 12, width: 22, textAlign: "center" }}>x{e.count}</span>
                <button onClick={() => changeCount(idx, 1)} style={iconGhost}><Plus size={13} /></button>
                <button onClick={() => moveEntry(idx, -1)} style={iconGhost}><ChevronUp size={13} /></button>
                <button onClick={() => moveEntry(idx, 1)} style={iconGhost}><ChevronDown size={13} /></button>
              </div>
            ))}
            {entries.length === 0 && <div style={{ color: "#8996A6", fontSize: 12 }}>Agrega bloques desde la derecha.</div>}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#64707F", marginBottom: 8 }}><ListMusic size={13} /> ESTRUCTURAS DISPONIBLES</div>
            {blockKeys.map((key) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 8, padding: "8px 10px", marginBottom: 6 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #C3CBD6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{draft.blocks[key].badge}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{draft.blocks[key].label}</span>
                <button onClick={() => addEntry(key)} style={iconGhost}><Plus size={15} color="#E8821E" /></button>
              </div>
            ))}
            {blockKeys.length === 0 && <div style={{ color: "#8996A6", fontSize: 12 }}>Primero agrega secciones en la pestaña Contenido.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label} {required && <span style={{ color: "#C23B32" }}>*</span>}</div>
      {children}
    </div>
  );
}

// ---------------- LISTA DE EVENTOS ----------------
// Todo el calendario se calcula desde `event.date` (fecha real, "YYYY-MM-DD") — nunca desde `dateLabel`
// (texto libre, ej. "10:00 am"), que solo es una nota para mostrar — ver src/lib/dates.js.

function MiniTicket({ ev, isLive, onClick }) {
  const time = (ev.dateLabel.split("·")[1] || "").trim();
  const shortTitle = ev.title.split("–")[0].trim();
  return (
    <button onClick={onClick} className="hoverable" style={{ width: "100%", textAlign: "left", border: isLive ? "2px solid #E8821E" : "none", cursor: "pointer", borderRadius: 8, padding: "5px 6px", background: ev.cover || DEFAULT_COVERS[0], color: "#fff", lineHeight: 1.25 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortTitle}</div>
      <div style={{ fontSize: 8.5, opacity: 0.85 }}>{time}</div>
    </button>
  );
}

function EventList({ events, plantillas, isAdminViewer, liveEventId, onSelect, onCreate }) {
  const [viewMode, setViewMode] = useState("eventos"); // eventos | plantillas (solo administradores alternan)
  const [step, setStep] = useState(null); // null | 'template' | 'details'
  const [templateId, setTemplateId] = useState("blank");
  const [form, setForm] = useState({ title: "", dateLabel: "", date: "", hora: "", location: "" });
  const [monthFilter, setMonthFilter] = useState("proximos"); // 'proximos' | mes (para revisar eventos pasados)

  const isPlantillaMode = isAdminViewer && viewMode === "plantillas";
  // Crear una plantilla no pasa por "seleccionar plantilla" (sería plantilla-de-plantilla) — va directo
  // al formulario de detalles, y se guarda con esPlantilla: true.
  const openCreate = () => {
    setTemplateId("blank");
    setForm({ title: "", dateLabel: "", date: "", hora: "", location: "" });
    setStep(isPlantillaMode ? "details" : "template");
  };
  const confirmTemplate = () => setStep("details");
  const confirmCreate = () => {
    if (!form.title.trim() || (!isPlantillaMode && !form.date)) return;
    onCreate({ templateId: templateId === "blank" ? null : templateId, title: form.title, dateLabel: form.dateLabel || "", date: form.date || null, hora: form.hora || null, location: form.location || "Por definir", esPlantilla: isPlantillaMode });
    setStep(null);
  };

  const today = todayLocal();
  // Ventana fija de ±6 meses alrededor de hoy, para poder planear meses futuros aunque todavía no
  // tengan eventos — más cualquier mes que sí tenga eventos reales aunque caiga fuera de la ventana.
  const monthOptions = useMemo(() => {
    const map = new Map();
    for (let offset = -6; offset <= 6; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const key = monthKey(d.getFullYear(), d.getMonth());
      map.set(key, monthLabelFromKey(key));
    }
    events.forEach((ev) => {
      const d = parseIsoDateLocal(ev.date);
      if (!d) return;
      const key = monthKey(d.getFullYear(), d.getMonth());
      if (!map.has(key)) map.set(key, monthLabelFromKey(key));
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.value.localeCompare(b.value));
  }, [events, today]);

  const isProximos = monthFilter === "proximos";
  const visibleEvents = useMemo(() => {
    const list = isProximos
      ? events.filter(isUpcoming)
      : events.filter((ev) => {
          const d = parseIsoDateLocal(ev.date);
          return d && monthKey(d.getFullYear(), d.getMonth()) === monthFilter;
        });
    return list.slice().sort(compareByDay);
  }, [events, monthFilter, isProximos]);

  const hero = isProximos ? visibleEvents[0] : null;
  const rest = isProximos ? visibleEvents.slice(1) : visibleEvents;
  const heroDate = hero ? parseIsoDateLocal(hero.date) : null;

  if (isPlantillaMode) {
    return (
      <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 12 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>Plantillas</h2>
          <button onClick={() => setViewMode("eventos")} style={ghostToggleBtn}>← Ver eventos</button>
        </div>
        <div style={{ fontSize: 12, color: "#64707F", marginBottom: 16 }}>Arma aquí bloques ya establecidos (orden del culto) que cualquier administrador podrá usar como base al crear un evento nuevo.</div>
        {plantillas.length === 0 && <div style={{ textAlign: "center", color: "#8996A6", fontSize: 13, padding: "40px 0" }}>Todavía no hay plantillas — crea la primera con el botón +.</div>}
        {plantillas.map((pl) => (
          <button key={pl.id} onClick={() => onSelect(pl.id)} className="hoverable" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 16, padding: 14, marginBottom: 10, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ListMusic size={16} color="#5661B3" /></div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{pl.title}</div>
            </div>
            <span style={{ fontSize: 11, color: "#8996A6" }}>{pl.serviceOrder.length} elementos</span>
          </button>
        ))}
        <button onClick={openCreate} style={{ position: "fixed", right: 20, bottom: 92, width: 54, height: 54, borderRadius: "50%", background: "#5661B3", border: "none", boxShadow: "0 8px 18px rgba(86,97,179,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 41 }}>
          <Plus size={24} color="#fff" />
        </button>
        {step === "details" && (
          <ModalShell title="Nueva plantilla" icon={ListMusic} color="#5661B3" onClose={() => setStep(null)}>
            <Field label="Nombre de la plantilla" required><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Domingo AM — estructura estándar" style={inputStyle} autoFocus /></Field>
            <button onClick={confirmCreate} disabled={!form.title.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: form.title.trim() ? 1 : 0.4 }}>Crear plantilla</button>
          </ModalShell>
        )}
      </div>
    );
  }

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>Eventos</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdminViewer && <button onClick={() => setViewMode("plantillas")} style={ghostToggleBtn}>Plantillas</button>}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ fontSize: 12, fontWeight: 700, padding: "8px 10px", borderRadius: 8, border: "1px solid #DDE3ED", background: "#EEF1F6", color: "#16324F", cursor: "pointer" }}
          >
            <option value="proximos">Próximos</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {hero && (
        <div style={{ position: "relative", marginBottom: 26 }}>
          <div style={{ position: "absolute", inset: "12px -8px 0 8px", background: "#FFFFFF", borderRadius: 22, transform: "rotate(-3deg)", boxShadow: "0 4px 10px rgba(22,50,79,0.05)" }} />
          <div style={{ position: "absolute", inset: "6px -4px 0 4px", background: "#FFFFFF", borderRadius: 22, transform: "rotate(2deg)", boxShadow: "0 4px 10px rgba(22,50,79,0.07)" }} />
          <button onClick={() => onSelect(hero.id)} className="hoverable" style={{ position: "relative", width: "100%", textAlign: "left", border: "none", cursor: "pointer", borderRadius: 22, padding: 0, overflow: "hidden", display: "block", boxShadow: "0 12px 26px rgba(22,50,79,0.2)" }}>
            <div style={{ background: hero.cover || DEFAULT_COVERS[0], padding: 20, minHeight: 130, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "3px 9px", textAlign: "center", minWidth: 38 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#16324F", lineHeight: 1.1 }}>{heroDate ? heroDate.getDate() : "–"}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#E8821E" }}>{heroDate ? MONTH_ABBR[heroDate.getMonth()] : ""}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.85)" }}>PRÓXIMO EVENTO</span>
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: "#fff" }}>{hero.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{hero.location}</div>
            </div>
          </button>
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#64707F", marginBottom: 10 }}>
          {isProximos ? "MÁS ADELANTE" : `${monthOptions.find((m) => m.value === monthFilter)?.label.toUpperCase()} · ${rest.length} EVENTOS`}
        </div>
      )}
      {rest.length === 0 && (
        <div style={{ textAlign: "center", color: "#8996A6", fontSize: 13, padding: "40px 0" }}>
          {isProximos ? "No hay eventos próximos." : "No hay eventos en este mes."}
        </div>
      )}
      {rest.map((ev) => {
        const totalMembers = ev.serviceOrder.reduce((acc, item) => acc + (item.encargados?.length || 0), 0);
        const isLive = ev.id === liveEventId;
        const isPast = !isProximos && !isUpcoming(ev);
        const d = parseIsoDateLocal(ev.date);
        return (
          <button key={ev.id} onClick={() => onSelect(ev.id)} className="hoverable" style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left", background: "#FFFFFF", border: isLive ? "2px solid #C23B32" : "none", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 16, padding: 14, marginBottom: 10, cursor: "pointer", opacity: isPast ? 0.7 : 1 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#EEF1F6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#16324F", lineHeight: 1.1 }}>{d ? d.getDate() : "–"}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#2F5FA8" }}>{d ? MONTH_ABBR[d.getMonth()] : ""}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                {isLive && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#B5342C", flexShrink: 0 }}><span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#C23B32" }} /> EN VIVO</span>}
                {isPast && <span style={{ fontSize: 10, fontWeight: 700, color: "#8996A6", flexShrink: 0 }}>PASADO</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64707F", fontSize: 12 }}>
                <MapPin size={11} /> {ev.location}
                <span style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 4 }}><Users size={11} /> {totalMembers}</span>
              </div>
            </div>
          </button>
        );
      })}

      {/* Botón flotante circular para crear evento — solo administradores */}
      {isAdminViewer && (
        <button onClick={openCreate} style={{ position: "fixed", right: 20, bottom: 92, width: 54, height: 54, borderRadius: "50%", background: "#E8821E", border: "none", boxShadow: "0 8px 18px rgba(232,130,30,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 41 }}>
          <Plus size={24} color="#16324F" />
        </button>
      )}

      {step === "template" && (
        <ModalShell title="Selecciona plantilla" icon={ListMusic} color="#5661B3" onClose={() => setStep(null)}>
          <div style={{ fontSize: 12, color: "#64707F", marginBottom: 12 }}>Copia el orden del culto de una plantilla ya armada por un administrador, o empieza en blanco.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {plantillas.length === 0 && <div style={{ fontSize: 12, color: "#8996A6", fontStyle: "italic", marginBottom: 4 }}>Todavía no hay plantillas creadas.</div>}
            {plantillas.map((pl) => (
              <label key={pl.id} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: templateId === pl.id ? "1px solid #5661B3" : "1px solid #DDE3ED", cursor: "pointer" }}>
                <input type="radio" name="template" checked={templateId === pl.id} onChange={() => setTemplateId(pl.id)} />
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{pl.title}</div><div style={{ fontSize: 11, color: "#8996A6" }}>{pl.serviceOrder.length} elementos en el setlist</div></div>
              </label>
            ))}
            <label className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: templateId === "blank" ? "1px solid #5661B3" : "1px solid #DDE3ED", cursor: "pointer" }}>
              <input type="radio" name="template" checked={templateId === "blank"} onChange={() => setTemplateId("blank")} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#33415A" }}>Evento en blanco</div>
            </label>
          </div>
          <button onClick={confirmTemplate} style={primaryBtn}>Continuar</button>
        </ModalShell>
      )}

      {step === "details" && (
        <ModalShell title="Detalles del evento" icon={Calendar} color="#E8821E" onClose={() => setStep(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Título" required><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Domingo AM – 19 Jul" style={inputStyle} /></Field>
            <Field label="Fecha del calendario" required>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              <span style={{ display: "block", fontSize: 11, color: "#8996A6", marginTop: 4 }}>Es la fecha real del evento — de aquí sale su lugar en Inicio y en el filtro de mes, y también trae sola la planificación de Ministerios de esa semana.</span>
            </Field>
            <Field label="Hora o nota (opcional)"><input value={form.dateLabel} onChange={(e) => setForm({ ...form, dateLabel: e.target.value })} placeholder="Ej. 10:00 am" style={inputStyle} /></Field>
            <Field label="Hora exacta (opcional)">
              <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} style={inputStyle} />
              <span style={{ display: "block", fontSize: 11, color: "#8996A6", marginTop: 4 }}>Solo se usa para calcular recordatorios "por horas" — no reemplaza la nota de arriba.</span>
            </Field>
            <Field label="Ubicación"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ej. Pastores, Sacatepéquez" style={inputStyle} /></Field>
          </div>
          <button onClick={confirmCreate} disabled={!form.title.trim() || !form.date} style={{ ...primaryBtn, marginTop: 14, opacity: form.title.trim() && form.date ? 1 : 0.4, cursor: form.title.trim() && form.date ? "pointer" : "not-allowed" }}>Crear evento</button>
        </ModalShell>
      )}
    </div>
  );
}

// ---------------- DETALLE DE EVENTO ----------------
function EventDetail({
  event, library, ministries, isCompact, isLive, canStartLive, isAdminViewer, userId, usuariosReales, onBack, onStart, onGoLive, onDelete,
  onAddSong, onAddSeccion, onAddBibleClick, onAddSlideClick, onRemove, onMove, onDuplicate, onReorder,
  onLinkMinistry, onUpdateSeccionText, onSetSongKey, canAddBibleReading, canAddSermonPoints,
  onAddEncargado, onSetEncargadoStatus, onSetEncargadoLead, onRemoveEncargado,
  onAddWorshipRole, onRemoveWorshipRole, onAddWorshipRoleMember, onSetWorshipRoleMemberStatus, onSetWorshipRoleMemberLead, onRemoveWorshipRoleMember,
  onViewMinistry, onOpenSong, onAddReminder, onRemoveReminder, onSetHora,
  showBibleForm, setShowBibleForm, addBible, showSlideForm, setShowSlideForm, slideDraft, setSlideDraft, addSlide,
  showSermonForm, setShowSermonForm, sermonPointText, setSermonPointText, addSermonPoint,
}) {
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDraft, setReminderDraft] = useState({ cantidad: 1, unidad: "dias" });
  const confirmAddReminder = () => {
    onAddReminder(Math.max(1, Number(reminderDraft.cantidad) || 1), reminderDraft.unidad);
    setReminderDraft({ cantidad: 1, unidad: "dias" });
    setShowReminderForm(false);
  };
  return (
    <div className="screen-enter" style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 0", maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
          {isAdminViewer && (
            <button onClick={() => onDelete(event)} title="Eliminar evento" style={iconGhost}>
              <Trash2 size={16} color="#C23B32" />
            </button>
          )}
        </div>
        <div style={{ borderRadius: 12, background: "linear-gradient(135deg, #2A3B4D, #EEF1F6)", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "inline-block", background: event.esPlantilla ? "#5661B3" : "rgba(0,0,0,0.35)", borderRadius: 20, padding: "4px 12px", fontSize: 12, marginBottom: 10 }}>
            {event.esPlantilla ? "PLANTILLA" : (formatFullDate(event.date) || "Sin fecha") + (event.dateLabel ? ` · ${event.dateLabel}` : "")}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{event.title}</div>
          {!event.esPlantilla && <div style={{ fontSize: 13, color: "#C8CDD6" }}>{event.location}</div>}
        </div>

        {isAdminViewer && (
          <div style={{ background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><Bell size={14} color="#E8821E" /> Recordatorios</div>
              <button onClick={() => setShowReminderForm(true)} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {(event.reminders || []).length === 0 && <div style={{ color: "#8996A6", fontSize: 12 }}>Sin recordatorios configurados{event.esPlantilla ? " en esta plantilla" : ""}.</div>}
              {(event.reminders || []).map((r) => (
                <span key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 12, fontWeight: 600 }}>
                  {r.cantidad} {r.unidad === "horas" ? (r.cantidad === 1 ? "hora" : "horas") : (r.cantidad === 1 ? "día" : "días")} antes
                  <button onClick={() => onRemoveReminder(r.id)} style={{ ...iconGhost, width: 18, height: 18 }}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>HORA DEL EVENTO</span>
              <input type="time" value={event.hora || ""} onChange={(e) => onSetHora(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12 }} />
            </div>
            {!event.hora && <div style={{ fontSize: 11, color: "#8996A6", marginTop: 6 }}>Sin hora definida, los recordatorios "por horas" no se pueden calcular con precisión.</div>}
          </div>
        )}

        {event.esPlantilla ? (
          <div style={{ fontSize: 12, color: "#8996A6", marginBottom: 14 }}>Esta es una plantilla — no se transmite en vivo, solo sirve como base para nuevos eventos ("Selecciona plantilla" al crear uno).</div>
        ) : canStartLive ? (
          <>
            <button onClick={isLive ? onGoLive : onStart} style={{ ...primaryBtn, width: "100%", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: isLive ? "#C23B32" : "#E8821E", color: isLive ? "#fff" : "#16233A" }}>
              <Play size={15} /> {isLive ? "Ya en vivo · Ir al control" : "Iniciar evento"}
            </button>
            <div style={{ marginBottom: 20 }} />
          </>
        ) : (
          isLive && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#E8821E", marginBottom: 14 }}><span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#E8821E" }} /> Este evento está en vivo ahora mismo.</div>
        )}
      </div>
      <SetlistPane
        event={event} library={library} ministries={ministries} isCompact={isCompact} isAdminViewer={isAdminViewer} userId={userId} usuariosReales={usuariosReales}
        onAddSong={onAddSong} onAddSeccion={onAddSeccion}
        onAddBibleClick={onAddBibleClick} onAddSlideClick={onAddSlideClick}
        onRemove={onRemove} onMove={onMove} onDuplicate={onDuplicate} onReorder={onReorder}
        onLinkMinistry={onLinkMinistry} onUpdateSeccionText={onUpdateSeccionText}
        onSetSongKey={onSetSongKey}
        canAddBibleReading={canAddBibleReading} canAddSermonPoints={canAddSermonPoints}
        onAddEncargado={onAddEncargado} onSetEncargadoStatus={onSetEncargadoStatus} onSetEncargadoLead={onSetEncargadoLead} onRemoveEncargado={onRemoveEncargado}
        onAddWorshipRole={onAddWorshipRole} onRemoveWorshipRole={onRemoveWorshipRole} onAddWorshipRoleMember={onAddWorshipRoleMember} onSetWorshipRoleMemberStatus={onSetWorshipRoleMemberStatus} onSetWorshipRoleMemberLead={onSetWorshipRoleMemberLead} onRemoveWorshipRoleMember={onRemoveWorshipRoleMember}
        onViewMinistry={onViewMinistry} onOpenSong={onOpenSong}
        showBibleForm={showBibleForm} setShowBibleForm={setShowBibleForm} addBible={addBible}
        showSlideForm={showSlideForm} setShowSlideForm={setShowSlideForm} slideDraft={slideDraft} setSlideDraft={setSlideDraft} addSlide={addSlide}
        showSermonForm={showSermonForm} setShowSermonForm={setShowSermonForm} sermonPointText={sermonPointText} setSermonPointText={setSermonPointText} addSermonPoint={addSermonPoint}
      />
      {showReminderForm && (
        <ModalShell title="Agregar recordatorio" icon={Bell} color="#E8821E" onClose={() => setShowReminderForm(false)}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <Field label="Cantidad">
              <input type="number" min={1} value={reminderDraft.cantidad} onChange={(e) => setReminderDraft({ ...reminderDraft, cantidad: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="Unidad">
              <select value={reminderDraft.unidad} onChange={(e) => setReminderDraft({ ...reminderDraft, unidad: e.target.value })} style={inputStyle}>
                <option value="dias">Días antes</option>
                <option value="horas">Horas antes</option>
              </select>
            </Field>
          </div>
          {reminderDraft.unidad === "horas" && !event.hora && (
            <div style={{ fontSize: 11, color: "#C23B32", marginTop: 8 }}>Este evento todavía no tiene hora definida — este recordatorio no se enviará hasta que se le asigne una.</div>
          )}
          <button onClick={confirmAddReminder} style={{ ...primaryBtn, marginTop: 14 }}>Agregar recordatorio</button>
        </ModalShell>
      )}
    </div>
  );
}

const NEXT_STATUS = { pendiente: "confirmado", confirmado: "rechazado", rechazado: "pendiente" };
const STATUS_STYLE = {
  confirmado: { border: "none", background: "#3FA772", icon: Check },
  rechazado: { border: "none", background: "#C23B32", icon: X },
  pendiente: { border: "1px solid #C3CBD6", background: "transparent", icon: null },
};
// Encargados de un ítem del Setlist: chips con estado (pendiente/confirmado/rechazado), estrella de
// "encargado principal" y selector para agregar de entre los usuarios ya registrados en la app (no
// texto libre). Solo quien tiene permiso sobre este bloque (admin, o el líder del ministerio vinculado)
// puede editar la lista — para los demás se muestra de solo lectura.
function EncargadosList({ encargados, canEdit, allUsuarios, onSetStatus, onSetLead, onAddEncargado, onRemove }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const disponibles = allUsuarios.filter((u) => !encargados.some((m) => m.usuarioId === u.id));
  return (
    <div>
      {encargados.map((m, i) => {
        const style = STATUS_STYLE[m.status || "pendiente"];
        const StatusIcon = style.icon;
        return (
          <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #DDE3ED" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, color: "#fff" }}>{m.n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
            <span style={{ fontSize: 13, flex: 1 }}>{m.n}{m.lead && <span style={{ fontSize: 10, color: "#E8821E", fontWeight: 700 }}> · Encargado</span>}</span>
            {canEdit && (
              <button onClick={() => onSetLead(i)} title={m.lead ? "Quitar como encargado principal" : "Marcar como encargado principal"} style={{ ...iconGhost, color: m.lead ? "#E8821E" : "#C3CBD6" }}>
                <Star size={14} fill={m.lead ? "#E8821E" : "none"} />
              </button>
            )}
            {canEdit ? (
              <button onClick={() => onSetStatus(i, NEXT_STATUS[m.status || "pendiente"])} title={m.status === "rechazado" ? "No puede asistir — click para cambiar" : undefined} style={{ width: 22, height: 22, borderRadius: "50%", border: style.border, background: style.background, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {StatusIcon && <StatusIcon size={13} color="#fff" />}
              </button>
            ) : (
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: style.border, background: style.background, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {StatusIcon && <StatusIcon size={13} color="#fff" />}
              </div>
            )}
            {canEdit && <button onClick={() => onRemove(i)} title="Quitar" style={{ ...iconGhost, color: "#C23B32" }}><X size={13} /></button>}
          </div>
        );
      })}
      {encargados.length === 0 && <div style={{ color: "#8996A6", fontSize: 12, padding: "6px 0" }}>Nadie asignado todavía.</div>}
      {canEdit && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">Elegir persona...</option>
            {disponibles.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
          <button
            onClick={() => { const u = disponibles.find((d) => d.id === selectedUserId); if (u) { onAddEncargado(u); setSelectedUserId(""); } }}
            disabled={!selectedUserId}
            style={{ ...addBtnStyle, width: "auto", padding: "0 12px", color: "#2F5FA8", opacity: selectedUserId ? 1 : 0.5 }}
          >
            <UserPlus size={14} color="#2F5FA8" /> Añadir
          </button>
        </div>
      )}
    </div>
  );
}

// Equipo de alabanza: roles con nombre fijo (Guitarra, Batería, Voz...) en vez de una lista libre de
// encargados — el mismo roster se muestra y se edita igual desde el bloque de Alabanza que desde el de
// Adoración (es un solo array compartido a nivel de evento, no una copia por bloque).
function WorshipRolesEditor({ roles, canEdit, allUsuarios, onAddRole, onRemoveRole, onAddMember, onSetStatus, onSetLead, onRemoveMember }) {
  const [newRoleName, setNewRoleName] = useState("");
  return (
    <div>
      {roles.map((r) => (
        <div key={r.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #DDE3ED" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#33415A" }}>{r.name}</span>
            {canEdit && <button onClick={() => onRemoveRole(r.id)} title="Quitar rol" style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={13} /></button>}
          </div>
          <EncargadosList
            encargados={r.members}
            canEdit={canEdit}
            allUsuarios={allUsuarios}
            onAddEncargado={(usuario) => onAddMember(r.id, usuario)}
            onSetStatus={(mi, status) => onSetStatus(r.id, mi, status)}
            onSetLead={(mi) => onSetLead(r.id, mi)}
            onRemove={(mi) => onRemoveMember(r.id, mi)}
          />
        </div>
      ))}
      {roles.length === 0 && <div style={{ color: "#8996A6", fontSize: 12, marginBottom: 10 }}>Aún no hay roles definidos para el equipo de alabanza.</div>}
      {canEdit && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Nuevo rol (ej. Guitarra)"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter" && newRoleName.trim()) { onAddRole(newRoleName); setNewRoleName(""); } }}
          />
          <button
            onClick={() => { if (newRoleName.trim()) { onAddRole(newRoleName); setNewRoleName(""); } }}
            style={{ ...addBtnStyle, width: "auto", padding: "0 12px", color: "#5661B3" }}
          >
            <Plus size={14} color="#5661B3" /> Agregar rol
          </button>
        </div>
      )}
    </div>
  );
}

// Encabezado de la sección de encargados/roles dentro de un bloque expandido: de solo lectura hasta
// que se toque "Editar"; "Guardar" solo regresa a la vista de solo lectura (ya se guardó solo).
function EncargadosSectionHeader({ label, canEdit, isEditing, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>{label}</div>
      {canEdit && (
        isEditing ? (
          <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 4, background: "#E9F7EF", border: "1px solid #1F8A73", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#1F8A73", cursor: "pointer" }}>
            <Check size={12} /> Guardar
          </button>
        ) : (
          <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 4, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: "#33415A", cursor: "pointer" }}>
            <Pencil size={11} /> Editar
          </button>
        )
      )}
    </div>
  );
}

// Botón "Encargados": ícono de personas con una insignia del conteo actual — es el punto de entrada
// para agregar/gestionar a los encargados de este ítem del Setlist, sin necesitar una pantalla aparte.
function EncargadosToggleButton({ count, onClick }) {
  return (
    <button onClick={onClick} title="Encargados" style={{ ...iconGhost, position: "relative" }}>
      <Users size={14} color={count > 0 ? "#E8821E" : undefined} />
      {count > 0 && (
        <span style={{ position: "absolute", top: -2, right: -2, background: "#E8821E", color: "#16324F", fontSize: 8, fontWeight: 800, borderRadius: 8, minWidth: 12, height: 12, lineHeight: "12px", textAlign: "center", padding: "0 2px" }}>{count}</span>
      )}
    </button>
  );
}

// ---------------- SETLIST (orden del culto) ----------------
function SetlistPane({ event, library, ministries, isCompact, isAdminViewer, userId, usuariosReales, onAddSong, onAddSeccion, onAddBibleClick, onAddSlideClick, onRemove, onMove, onDuplicate, onReorder, onLinkMinistry, onUpdateSeccionText, onViewMinistry, onOpenSong, onSetSongKey, canAddBibleReading, canAddSermonPoints, onAddEncargado, onSetEncargadoStatus, onSetEncargadoLead, onRemoveEncargado, onAddWorshipRole, onRemoveWorshipRole, onAddWorshipRoleMember, onSetWorshipRoleMemberStatus, onSetWorshipRoleMemberLead, onRemoveWorshipRoleMember, showBibleForm, setShowBibleForm, addBible, showSlideForm, setShowSlideForm, slideDraft, setSlideDraft, addSlide, showSermonForm, setShowSermonForm, sermonPointText, setSermonPointText, addSermonPoint }) {
  // Editar el Setlist (estructura, encargados, equipo de alabanza) es solo de administradores — la
  // única excepción a "solo admin" en todo el Setlist es agregar un versículo, que puede hacerlo además
  // el encargado de ese bloque de Lectura bíblica/Oración (ver canAddBibleReading más arriba).
  const canEditItem = () => isAdminViewer;
  const canEditWorshipRoles = isAdminViewer;
  const [query, setQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({});
  // Encargados/roles quedan de solo lectura hasta que se toque "Editar" — "Guardar" solo regresa a esa
  // vista de solo lectura (los cambios ya se guardaron solos en cuanto se hicieron).
  const [editingAssignments, setEditingAssignments] = useState({});
  const toggleEditingAssignments = (itemId) => setEditingAssignments((e) => ({ ...e, [itemId]: !e[itemId] }));
  const [showLibrary, setShowLibrary] = useState(!isCompact);
  const [showSeccionForm, setShowSeccionForm] = useState(false);
  const [seccionDraft, setSeccionDraft] = useState({ title: "", description: "" });
  const confirmAddSeccion = () => {
    if (!seccionDraft.title.trim()) return;
    onAddSeccion(seccionDraft.title, seccionDraft.description);
    setSeccionDraft({ title: "", description: "" });
    setShowSeccionForm(false);
  };
  // Reordenar arrastrando desde el ícono de 6 puntos: se arrastra la fila completa, pero el "asa" (handle)
  // es el ícono para no interferir con selects/botones dentro de la fila.
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  // Limpieza es un privilegio aparte: quien está asignado a un bloque de Limpieza en este evento (y no
  // es administrador) solo ve ESE bloque — nada del resto del Setlist (canciones, otros bloques). Va
  // DESPUÉS de todos los hooks de arriba: un return anticipado antes de un useState rompe las reglas de
  // hooks en cuanto ese mismo componente vuelva a renderizar con myCleaningBlock en falso.
  const myCleaningBlock = !isAdminViewer ? event.serviceOrder.find((it) => isCleaningBlock(it) && (it.encargados || []).some((m) => m.usuarioId === userId)) : null;
  if (myCleaningBlock) {
    return <CleaningOnlyPanel block={myCleaningBlock} />;
  }
  const dragHandleProps = (idx) => ({
    draggable: true,
    onDragStart: (e) => {
      // Firefox (y algunos navegadores) cancelan el arrastre en silencio si no se llama a setData —
      // sin esto, el drag ni siquiera empieza a verse aunque el resto del código esté bien.
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
      setDragIndex(idx);
    },
    onDragEnd: () => { setDragIndex(null); setOverIndex(null); },
    style: { cursor: "grab", flexShrink: 0, touchAction: "none" },
  });
  const dragRowProps = (idx) => ({
    onDragEnter: (e) => e.preventDefault(),
    onDragOver: (e) => { if (dragIndex === null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overIndex !== idx) setOverIndex(idx); },
    onDrop: (e) => { e.preventDefault(); if (dragIndex !== null && dragIndex !== idx) onReorder(dragIndex, idx); setDragIndex(null); setOverIndex(null); },
  });
  const filtered = library.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", flex: 1, minHeight: 0 }}>
      {isCompact && (
        <button onClick={() => setShowLibrary((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#EEF1F6", border: "none", borderBottom: "1px solid #DDE3ED", padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "#16233A", cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ListMusic size={14} /> Biblioteca y agregar elementos</span>
          {showLibrary ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      )}
      {(showLibrary || !isCompact) && (
      <div style={{ width: isCompact ? "100%" : 270, borderRight: isCompact ? "none" : "1px solid #DDE3ED", borderBottom: isCompact ? "1px solid #DDE3ED" : "none", padding: 14, flexShrink: 0, overflowY: "auto", maxHeight: isCompact ? 320 : "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64707F", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 10 }}><ListMusic size={13} /> BIBLIOTECA DE CANCIONES</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
          <Search size={13} color="#8996A6" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 12, width: "100%" }} />
        </div>
        {filtered.map((s) => (
          <button key={s.id} onClick={() => onAddSong(s.id)} className="hoverable" style={{ width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, borderRadius: 8, background: "transparent", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{s.key} · {s.tempo} bpm</div></div>
            <Plus size={15} color="#E8821E" />
          </button>
        ))}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {isAdminViewer ? (
            <button onClick={() => setShowSeccionForm(true)} className="hoverable" style={addBtnStyle}><ListMusic size={14} color="#5661B3" /> Agregar bloque del culto</button>
          ) : (
            <div title="Solo administradores generales pueden agregar bloques" style={{ ...addBtnStyle, opacity: 0.5, cursor: "not-allowed", boxShadow: "none", border: "1px dashed #C7D0DD" }}><ListMusic size={14} color="#8996A6" /> Agregar bloque (solo Admin)</div>
          )}
          {canAddBibleReading ? (
            <button onClick={onAddBibleClick} className="hoverable" style={addBtnStyle}><BookOpen size={14} color="#2F5FA8" /> Agregar versículo</button>
          ) : (
            <div title="Solo administradores pueden agregar versículos" style={{ ...addBtnStyle, opacity: 0.5, cursor: "not-allowed", boxShadow: "none", border: "1px dashed #C7D0DD" }}><BookOpen size={14} color="#8996A6" /> Agregar versículo (solo Admin)</div>
          )}
          <button onClick={onAddSlideClick} className="hoverable" style={addBtnStyle}><ImgIcon size={14} color="#B15EA0" /> Agregar slide personalizada</button>
          {canAddSermonPoints && (
            <button onClick={() => setShowSermonForm(true)} className="hoverable" style={addBtnStyle}><Mic2 size={14} color="#16324F" /> Agregar punto del bosquejo</button>
          )}
        </div>
      </div>
      )}

      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Setlist</h2>
          <span style={{ fontSize: 12, color: "#8996A6" }}>{formatFullDate(event.date) || event.dateLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: "#64707F", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={13} color="#E8821E" /> Solo se agrega en orden — las canciones ya traen su letra lista para proyectar.
        </div>
        {event.serviceOrder.map((item, idx) => {
          const meta = TYPE_META[item.type];
          const handleProps = dragHandleProps(idx);
          if (item.type === "seccion") {
            const linkedMinistry = item.ministryId ? ministries.find((m) => m.id === item.ministryId) : null;
            // La planificación que aparece es la que tiene la MISMA fecha que este evento (no siempre la
            // primera de la lista) — así, por ejemplo, la Escuelita bíblica trae sola el tema de ese domingo.
            const currentPlan = linkedMinistry && event.date ? linkedMinistry.plan.find((p) => p.date === event.date) : null;
            const planStatusText = !linkedMinistry ? null : !event.date ? "Este evento no tiene fecha de calendario — asígnale una para traer la planificación sola." : currentPlan ? null : "Sin planificación cargada para esta fecha.";
            const isExpanded = !!expandedSections[item.id];
            const canEdit = canEditItem(idx);
            return (
              <div
                key={item.id} {...dragRowProps(idx)}
                style={{ background: "rgba(124,140,216,0.16)", border: overIndex === idx && dragIndex !== null && dragIndex !== idx ? "2px solid #E8821E" : "1px solid #5661B3", borderRadius: 10, padding: "12px 14px", marginBottom: 8, opacity: dragIndex === idx ? 0.4 : 1 }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <GripVertical size={14} color="#5661B3" {...handleProps} style={{ ...handleProps.style, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      value={item.title} onChange={(e) => onUpdateSeccionText(item.id, "title", e.target.value)} readOnly={!canEdit}
                      style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 700, color: "#16233A", width: "100%", padding: 0, fontFamily: "inherit" }}
                    />
                    {linkedMinistry ? (
                      <div style={{ fontSize: 12, color: "#33415A", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isExpanded ? "normal" : "nowrap" }}>
                        {currentPlan ? `${currentPlan.title} — ${currentPlan.detail}` : planStatusText}
                      </div>
                    ) : (
                      <input
                        value={item.description} onChange={(e) => onUpdateSeccionText(item.id, "description", e.target.value)} readOnly={!canEdit}
                        placeholder="Descripción del bloque..."
                        style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "#33415A", marginTop: 2, width: "100%", padding: 0, fontFamily: "inherit" }}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    <EncargadosToggleButton
                      count={isWorshipBlock(item) ? (event.worshipRoles || []).reduce((acc, r) => acc + r.members.length, 0) : (item.encargados || []).length}
                      onClick={() => setExpandedSections((e) => ({ ...e, [item.id]: !e[item.id] }))}
                    />
                    {isAdminViewer && (
                      <>
                        <button onClick={() => onMove(idx, -1)} style={iconGhost}><ChevronUp size={14} /></button>
                        <button onClick={() => onMove(idx, 1)} style={iconGhost}><ChevronDown size={14} /></button>
                        <button onClick={() => onDuplicate(item.id)} title="Duplicar" style={iconGhost}><Copy size={14} /></button>
                        <button onClick={() => onRemove(item.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(124,140,216,0.3)" }}>
                    {isAdminViewer && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>VINCULAR A UN MINISTERIO</div>
                        <select value={item.ministryId || ""} onChange={(e) => onLinkMinistry(item.id, e.target.value)} style={{ ...inputStyle, marginBottom: linkedMinistry ? 10 : 0 }}>
                          <option value="">Sin vincular (usar descripción escrita arriba)</option>
                          {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </>
                    )}
                    {linkedMinistry && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${linkedMinistry.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Users size={14} color={linkedMinistry.color} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{linkedMinistry.name}</div>
                          <div style={{ fontSize: 11, color: "#64707F" }}>Líder: {linkedMinistry.leaderName || "Sin asignar"}</div>
                        </div>
                        <button onClick={() => onViewMinistry(linkedMinistry.id)} style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>Ver ministerio <ExternalLink size={12} /></button>
                      </div>
                    )}
                    {isWorshipBlock(item) ? (
                      <>
                        <EncargadosSectionHeader
                          label="EQUIPO DE ALABANZA (compartido con Alabanza/Adoración)"
                          canEdit={canEditWorshipRoles}
                          isEditing={!!editingAssignments[item.id]}
                          onToggle={() => toggleEditingAssignments(item.id)}
                        />
                        <WorshipRolesEditor
                          roles={event.worshipRoles || []}
                          canEdit={canEditWorshipRoles && !!editingAssignments[item.id]}
                          allUsuarios={usuariosReales}
                          onAddRole={onAddWorshipRole}
                          onRemoveRole={onRemoveWorshipRole}
                          onAddMember={onAddWorshipRoleMember}
                          onSetStatus={onSetWorshipRoleMemberStatus}
                          onSetLead={onSetWorshipRoleMemberLead}
                          onRemoveMember={onRemoveWorshipRoleMember}
                        />
                      </>
                    ) : (
                      <>
                        <EncargadosSectionHeader
                          label="ENCARGADOS DE ESTE BLOQUE"
                          canEdit={canEdit}
                          isEditing={!!editingAssignments[item.id]}
                          onToggle={() => toggleEditingAssignments(item.id)}
                        />
                        <EncargadosList
                          encargados={item.encargados || []}
                          canEdit={canEdit && !!editingAssignments[item.id]}
                          allUsuarios={usuariosReales}
                          onAddEncargado={(usuario) => onAddEncargado(item.id, usuario)}
                          onSetStatus={(mi, status) => onSetEncargadoStatus(item.id, mi, status)}
                          onSetLead={(mi) => onSetEncargadoLead(item.id, mi)}
                          onRemove={(mi) => onRemoveEncargado(item.id, mi)}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }
          const song = item.type === "cancion" ? library.find((s) => s.id === item.songId) : null;
          const effectiveKey = song ? item.keyOverride || song.key : null;
          const Icon = meta.icon;
          const isExpanded = !!expandedSections[item.id];
          const canEdit = canEditItem(idx);
          return (
            <div key={item.id} style={{ marginBottom: 8 }}>
              <div
                {...dragRowProps(idx)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "#FFFFFF", border: overIndex === idx && dragIndex !== null && dragIndex !== idx ? "2px solid #E8821E" : "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", opacity: dragIndex === idx ? 0.4 : 1 }}
              >
                <GripVertical size={14} color="#C3CBD6" {...handleProps} />
                {item.type === "cancion" && song ? (
                  <>
                    {canEdit ? (
                      <select
                        value={effectiveKey}
                        onChange={(e) => onSetSongKey(item.id, e.target.value, song.key)}
                        title="Tonalidad para este evento"
                        style={{ width: 46, borderRadius: 6, border: `1px solid ${item.keyOverride ? "#E8821E" : "#C3CBD6"}`, fontSize: 10, fontWeight: 700, padding: "3px 2px", color: item.keyOverride ? "#E8821E" : "#33415A", background: "#FFFFFF", flexShrink: 0 }}
                      >
                        {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    ) : (
                      <span style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #C3CBD6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{effectiveKey}</span>
                    )}
                    <span style={{ fontSize: 11, color: "#64707F", background: "#EEF1F6", borderRadius: 12, padding: "3px 8px", flexShrink: 0 }}>{song.tempo} bpm</span>
                    <span onClick={() => onOpenSong(song.id, item.id)} title="Abrir para tocar en vivo" style={{ fontSize: 13, fontWeight: 600, flex: 1, cursor: "pointer" }}>{song.title}</span>
                    {song.hasAttachment && <Paperclip size={14} color="#8996A6" />}
                  </>
                ) : (
                  <>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: `${meta.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} color={meta.color} /></div>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.type === "biblia" ? item.reference : item.title}</span>
                    {item.isSermonPoint && <span style={{ fontSize: 9, fontWeight: 700, color: "#16324F", background: "#EEF1F6", borderRadius: 10, padding: "2px 8px", flexShrink: 0 }}>BOSQUEJO</span>}
                  </>
                )}
                <div style={{ display: "flex", gap: 2 }}>
                  <EncargadosToggleButton count={(item.encargados || []).length} onClick={() => setExpandedSections((e) => ({ ...e, [item.id]: !e[item.id] }))} />
                  {isAdminViewer && (
                    <>
                      <button onClick={() => onMove(idx, -1)} style={iconGhost}><ChevronUp size={14} /></button>
                      <button onClick={() => onMove(idx, 1)} style={iconGhost}><ChevronDown size={14} /></button>
                      <button onClick={() => onDuplicate(item.id)} title="Duplicar" style={iconGhost}><Copy size={14} /></button>
                      <button onClick={() => onRemove(item.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
              {isExpanded && (
                <div style={{ background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 8, padding: "10px 12px", marginTop: -2 }}>
                  <EncargadosSectionHeader
                    label="ENCARGADOS"
                    canEdit={canEdit}
                    isEditing={!!editingAssignments[item.id]}
                    onToggle={() => toggleEditingAssignments(item.id)}
                  />
                  <EncargadosList
                    encargados={item.encargados || []}
                    canEdit={canEdit && !!editingAssignments[item.id]}
                    allUsuarios={usuariosReales}
                    onAddEncargado={(usuario) => onAddEncargado(item.id, usuario)}
                    onSetStatus={(mi, status) => onSetEncargadoStatus(item.id, mi, status)}
                    onSetLead={(mi) => onSetEncargadoLead(item.id, mi)}
                    onRemove={(mi) => onRemoveEncargado(item.id, mi)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showBibleForm && <BibleModal onClose={() => setShowBibleForm(false)} onAdd={addBible} splitVersesIndividually />}
      {showSlideForm && <SlideModal draft={slideDraft} setDraft={setSlideDraft} onClose={() => setShowSlideForm(false)} onAdd={addSlide} />}
      {showSermonForm && (
        <ModalShell title="Agregar punto del bosquejo" icon={Mic2} color="#16324F" onClose={() => setShowSermonForm(false)}>
          <div style={{ fontSize: 11, color: "#64707F", marginBottom: 10 }}>Cada punto se agrega como su propia diapositiva, en el orden en que los escribas — así Multimedia los proyecta uno por uno mientras predicas.</div>
          <textarea value={sermonPointText} onChange={(e) => setSermonPointText(e.target.value)} placeholder="Ej. Dios cumple sus promesas a su tiempo" style={{ ...inputStyle, height: 80, resize: "none" }} autoFocus />
          <button onClick={addSermonPoint} style={{ ...primaryBtn, marginTop: 10 }}>Agregar punto</button>
        </ModalShell>
      )}
      {showSeccionForm && (
        <ModalShell title="Agregar bloque del culto" icon={ListMusic} color="#5661B3" onClose={() => setShowSeccionForm(false)}>
          <Field label="Título" required><input value={seccionDraft.title} onChange={(e) => setSeccionDraft({ ...seccionDraft, title: e.target.value })} placeholder="Ej. Bloque de Alabanza" style={inputStyle} autoFocus /></Field>
          <div style={{ height: 10 }} />
          <Field label="Descripción"><textarea value={seccionDraft.description} onChange={(e) => setSeccionDraft({ ...seccionDraft, description: e.target.value })} placeholder="Ej. Guiar a la congregación a una expresión activa de gozo y gratitud." style={{ ...inputStyle, height: 80, resize: "none" }} /></Field>
          <button onClick={confirmAddSeccion} disabled={!seccionDraft.title.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: seccionDraft.title.trim() ? 1 : 0.4, cursor: seccionDraft.title.trim() ? "pointer" : "not-allowed" }}>Agregar bloque</button>
        </ModalShell>
      )}
    </div>
  );
}

// ---------- Biblia completa y buscable: se consulta en vivo (fetch) a la API pública bolls.life, así el
// operador navega Libro → Capítulo → Versículo(s) sin tener que escribir ni copiar/pegar el texto. Se
// cachea por versión a nivel de módulo para no repetir la descarga de la lista de libros en cada apertura. ----------
const bibleBooksCache = {};
async function fetchBibleBooks(version) {
  if (bibleBooksCache[version]) return bibleBooksCache[version];
  const res = await fetch(`https://bolls.life/get-books/${version}/`);
  if (!res.ok) throw new Error("No se pudo cargar la lista de libros.");
  const data = await res.json();
  bibleBooksCache[version] = data;
  return data;
}
async function fetchBibleChapter(version, bookId, chapter) {
  const res = await fetch(`https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`);
  if (!res.ok) throw new Error("No se pudo cargar el capítulo.");
  return res.json();
}
// Para "Siguiente/Anterior versículo" en vivo: busca el versículo justo después (direction=1) o antes
// (direction=-1) de fromVerse, cruzando al capítulo siguiente/anterior del mismo libro si hace falta.
// Devuelve null cuando ya no hay más (por ejemplo, se llegó al final del libro).
async function fetchAdjacentBibleVerse(version, bookId, chapter, fromVerse, direction) {
  const chapterVerses = await fetchBibleChapter(version, bookId, chapter);
  const idx = chapterVerses.findIndex((v) => v.verse === fromVerse);
  const nextIdx = (idx === -1 ? (direction > 0 ? -1 : chapterVerses.length) : idx) + direction;
  if (nextIdx >= 0 && nextIdx < chapterVerses.length) {
    const v = chapterVerses[nextIdx];
    return { chapter, verse: v.verse, text: v.text.replace(/\s+/g, " ").trim() };
  }
  const books = await fetchBibleBooks(version);
  const book = books.find((b) => b.bookid === bookId);
  const targetChapter = chapter + direction;
  if (!book || targetChapter < 1 || targetChapter > book.chapters) return null;
  const targetVerses = await fetchBibleChapter(version, bookId, targetChapter);
  if (!targetVerses.length) return null;
  const v = direction > 0 ? targetVerses[0] : targetVerses[targetVerses.length - 1];
  return { chapter: targetChapter, verse: v.verse, text: v.text.replace(/\s+/g, " ").trim(), bookName: book.name };
}

function BibleModal({ onClose, onAdd, title = "Agregar versículo", submitLabel = "Agregar al servicio", splitVersesIndividually = false }) {
  const [mode, setMode] = useState("browse"); // browse: biblia completa en vivo · manual: escribir a mano
  const [version, setVersion] = useState(BIBLE_VERSIONS[0].code);
  const [books, setBooks] = useState(null);
  const [bookFilter, setBookFilter] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState(null);
  const [range, setRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [custom, setCustom] = useState({ ref: "", version: BIBLE_VERSIONS[0].code, text: "" });

  useEffect(() => {
    if (mode !== "browse") return;
    setLoading(true); setLoadError("");
    fetchBibleBooks(version).then(setBooks).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  }, [mode, version]);

  const backToBooks = () => { setSelectedBook(null); setSelectedChapter(null); setVerses(null); setRange(null); };
  const backToChapters = () => { setSelectedChapter(null); setVerses(null); setRange(null); };
  const openChapter = (book, chapter) => {
    setSelectedBook(book); setSelectedChapter(chapter); setRange(null); setVerses(null);
    setLoading(true); setLoadError("");
    fetchBibleChapter(version, book.bookid, chapter).then(setVerses).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  const pickVerse = (v) => {
    setRange((r) => {
      if (!r || r.start !== r.end) return { start: v, end: v }; // sin selección, o el rango anterior ya estaba cerrado: empieza uno nuevo
      return { start: Math.min(r.start, v), end: Math.max(r.start, v) }; // había un solo versículo elegido: lo convierte en rango
    });
  };
  const confirmRange = () => {
    if (!range || !verses) return;
    const picked = verses.filter((v) => v.verse >= range.start && v.verse <= range.end);
    // bookId/chapter/verseStart/verseEnd quedan guardados para poder usar "Siguiente versículo" y cambiar de
    // versión en vivo más adelante sin tener que volver a abrir este buscador (ver MultimediaControl).
    if (splitVersesIndividually && picked.length > 1) {
      // Cada versículo del rango se agrega como su propia diapositiva — así quien lee puede avanzar
      // versículo por versículo en vivo, en vez de tener un solo bloque con todos juntos.
      picked.forEach((v) => {
        onAdd({ ref: `${selectedBook.name} ${selectedChapter}:${v.verse}`, version, text: v.text.replace(/\s+/g, " ").trim(), bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: v.verse, verseEnd: v.verse });
      });
      return;
    }
    const text = picked.map((v) => v.text.replace(/\s+/g, " ").trim()).join(" ");
    const ref = range.start === range.end ? `${selectedBook.name} ${selectedChapter}:${range.start}` : `${selectedBook.name} ${selectedChapter}:${range.start}-${range.end}`;
    onAdd({ ref, version, text, bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: range.start, verseEnd: range.end });
  };
  const filteredBooks = books ? books.filter((b) => b.name.toLowerCase().includes(bookFilter.toLowerCase())) : [];

  return (
    <ModalShell title={title} icon={BookOpen} color="#2F5FA8" onClose={onClose}>
      <div style={{ display: "flex", gap: 3, background: "#EEF1F6", padding: 3, borderRadius: 8, marginBottom: 12, width: "fit-content" }}>
        {[["browse", "Buscar en la Biblia"], ["manual", "Escribir manualmente"]].map(([val, label]) => (
          <button key={val} onClick={() => setMode(val)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === val ? "#2F5FA8" : "transparent", color: mode === val ? "#fff" : "#64707F" }}>{label}</button>
        ))}
      </div>

      {mode === "manual" && (
        <>
          <div style={{ fontSize: 11, color: "#64707F", fontWeight: 700, marginBottom: 8 }}>ACCESO RÁPIDO</div>
          {BIBLE_QUICK.map((b) => (
            <button key={b.ref} onClick={() => onAdd(b)} className="hoverable" style={{ ...addBtnStyle, textAlign: "left", marginBottom: 6 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{b.ref}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#2F5FA8", background: "#EAF0FA", borderRadius: 6, padding: "1px 5px" }}>{b.version}</span>
                </div>
                <div style={{ fontSize: 12, color: "#64707F" }}>{b.text}</div>
              </div>
            </button>
          ))}
          <div style={{ fontSize: 11, color: "#64707F", fontWeight: 700, margin: "14px 0 8px" }}>O ESCRIBE UNO NUEVO</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Referencia (ej. Juan 3:16)" value={custom.ref} onChange={(e) => setCustom({ ...custom, ref: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <select value={custom.version} onChange={(e) => setCustom({ ...custom, version: e.target.value })} style={{ ...inputStyle, width: 100 }}>
              {BIBLE_VERSIONS.map((v) => <option key={v.code} value={v.code}>{v.code}</option>)}
            </select>
          </div>
          <textarea placeholder="Texto a proyectar..." value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} style={{ ...inputStyle, height: 70, marginTop: 8, resize: "none" }} />
          <button onClick={() => custom.ref && custom.text && onAdd(custom)} style={{ ...primaryBtn, marginTop: 10 }}>{submitLabel}</button>
        </>
      )}

      {mode === "browse" && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {BIBLE_VERSIONS.map((v) => (
              <button key={v.code} onClick={() => setVersion(v.code)} title={v.label} style={{ fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: 8, border: version === v.code ? "2px solid #2F5FA8" : "1px solid #C7D0DD", background: version === v.code ? "#EAF0FA" : "#fff", color: "#16233A", cursor: "pointer" }}>{v.code}</button>
            ))}
          </div>

          {(selectedBook || selectedChapter) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2F5FA8", fontWeight: 700, marginBottom: 10 }}>
              <span onClick={backToBooks} style={{ cursor: "pointer" }}>Libros</span>
              {selectedBook && <><ChevronRight size={12} /><span onClick={backToChapters} style={{ cursor: "pointer" }}>{selectedBook.name}</span></>}
              {selectedChapter && <><ChevronRight size={12} /><span>Cap. {selectedChapter}</span></>}
            </div>
          )}

          {loading && <div style={{ fontSize: 12, color: "#8996A6", padding: "20px 0", textAlign: "center" }}>Cargando…</div>}
          {loadError && <div style={{ fontSize: 12, color: "#C23B32", padding: "10px 0" }}>{loadError} Revisa tu conexión a internet e intenta de nuevo.</div>}

          {!loading && !loadError && !selectedBook && books && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
                <Search size={13} color="#8996A6" />
                <input value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} placeholder="Buscar libro (ej. Juan, Salmos)…" style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 12, width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {filteredBooks.map((b) => (
                  <button key={b.bookid} onClick={() => setSelectedBook(b)} className="hoverable" style={{ ...addBtnStyle, textAlign: "left" }}>{b.name}</button>
                ))}
              </div>
            </>
          )}

          {!loading && !loadError && selectedBook && !selectedChapter && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((c) => (
                <button key={c} onClick={() => openChapter(selectedBook, c)} style={{ padding: "8px 0", borderRadius: 8, border: "1px solid #C7D0DD", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
          )}

          {!loading && !loadError && selectedBook && selectedChapter && verses && (
            <>
              <div style={{ fontSize: 11, color: "#64707F", marginBottom: 8 }}>
                Toca un versículo para empezar, y otro para armar un rango.
                {splitVersesIndividually && " Cada versículo del rango se agrega como su propia diapositiva."}
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {verses.map((v) => {
                  const inRange = range && v.verse >= range.start && v.verse <= range.end;
                  return (
                    <button key={v.verse} onClick={() => pickVerse(v.verse)} style={{ textAlign: "left", padding: "6px 8px", borderRadius: 8, border: inRange ? "1px solid #2F5FA8" : "1px solid transparent", background: inRange ? "#EAF0FA" : "transparent", cursor: "pointer", fontSize: 12.5, color: "#16233A", lineHeight: 1.45 }}>
                      <b style={{ color: "#2F5FA8" }}>{v.verse}</b> {v.text}
                    </button>
                  );
                })}
              </div>
              {range && (
                <button onClick={confirmRange} style={{ ...primaryBtn, marginTop: 12 }}>
                  {submitLabel} · {selectedBook.name} {selectedChapter}:{range.start === range.end ? range.start : `${range.start}-${range.end}`}
                  {splitVersesIndividually && range.end > range.start ? ` (${range.end - range.start + 1} diapositivas)` : ""}
                </button>
              )}
            </>
          )}
        </>
      )}
    </ModalShell>
  );
}
function SlideModal({ draft, setDraft, onClose, onAdd, title = "Slide personalizada", submitLabel = "Agregar al servicio" }) {
  const bgOptions = ["#1B2029", "#2A1F33", "#1F2A2C", "#332420"];
  const bgType = draft.bgType || "color";
  const videoFileInputRef = useRef(null);
  const uploadVideoFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, videoUrl: reader.result }));
    reader.readAsDataURL(file);
  };
  return (
    <ModalShell title={title} icon={ImgIcon} color="#B15EA0" onClose={onClose}>
      <input placeholder="Título (opcional si es solo video)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={inputStyle} />
      <input placeholder="Subtítulo (opcional)" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} style={{ ...inputStyle, marginTop: 8 }} />
      <div style={{ fontSize: 11, color: "#64707F", fontWeight: 700, margin: "14px 0 8px" }}>FONDO</div>
      <div style={{ display: "flex", gap: 3, background: "#EEF1F6", padding: 3, borderRadius: 8, marginBottom: 10, width: "fit-content" }}>
        {[["color", "Color"], ["video", "Video"]].map(([val, label]) => (
          <button key={val} onClick={() => setDraft({ ...draft, bgType: val })} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: bgType === val ? "#B15EA0" : "transparent", color: bgType === val ? "#fff" : "#64707F" }}>{label}</button>
        ))}
      </div>
      {bgType === "color" ? (
        <div style={{ display: "flex", gap: 8 }}>
          {bgOptions.map((c) => (<button key={c} onClick={() => setDraft({ ...draft, bg: c })} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: draft.bg === c ? "2px solid #E8821E" : "1px solid #C7D0DD", cursor: "pointer" }} />))}
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="https://... (mp4 de fondo)" value={draft.videoUrl || ""} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => videoFileInputRef.current?.click()} style={{ ...addBtnStyle, width: "auto", padding: "0 12px", whiteSpace: "nowrap" }}><Paperclip size={14} color="#B15EA0" /> Subir video</button>
            <input ref={videoFileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => { uploadVideoFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {draft.videoUrl && draft.videoUrl.startsWith("data:") && <div style={{ fontSize: 11, color: "#1F8A73", marginTop: 6 }}>Video propio cargado ✓</div>}
          <div style={{ fontSize: 11, color: "#8996A6", marginTop: 6 }}>Se reproduce en bucle y sin sonido. Si dejas el título vacío, se proyecta a pantalla completa sin texto encima.</div>
        </div>
      )}
      <button onClick={onAdd} style={{ ...primaryBtn, marginTop: 14 }}>{submitLabel}</button>
    </ModalShell>
  );
}
// ---------------- CONTENIDO IMPROVISADO EN VIVO (no toca el setlist) ----------------
function AdHocSongModal({ library, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const filtered = library.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <ModalShell title="Proyectar canción improvisada" icon={Music} color="#5661B3" onClose={onClose}>
      <div style={{ fontSize: 11, color: "#64707F", marginBottom: 10 }}>Busca cualquier canción de la biblioteca, aunque no esté en el setlist de hoy.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
        <Search size={13} color="#8996A6" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 12, width: "100%" }} />
      </div>
      {filtered.map((s) => (
        <button key={s.id} onClick={() => onPick(s)} className="hoverable" style={{ ...addBtnStyle, textAlign: "left", marginBottom: 6 }}>
          <div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{s.key} · {s.tempo} bpm</div></div>
        </button>
      ))}
      {filtered.length === 0 && <div style={{ color: "#8996A6", fontSize: 13 }}>No hay canciones que coincidan.</div>}
    </ModalShell>
  );
}
function AdHocVideoModal({ onClose, onPlay }) {
  const [url, setUrl] = useState("");
  const fileInputRef = useRef(null);
  const uploadVideoFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPlay(reader.result);
    reader.readAsDataURL(file);
  };
  return (
    <ModalShell title="Proyectar video improvisado" icon={ImgIcon} color="#C23B32" onClose={onClose}>
      <div style={{ fontSize: 11, color: "#64707F", marginBottom: 10 }}>Se proyecta a pantalla completa de inmediato, sin agregarse al setlist.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="https://... (mp4)" value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => fileInputRef.current?.click()} style={{ ...addBtnStyle, width: "auto", padding: "0 12px", whiteSpace: "nowrap" }}><Paperclip size={14} color="#C23B32" /> Subir video</button>
        <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => { uploadVideoFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <button onClick={() => url && onPlay(url)} style={{ ...primaryBtn, marginTop: 14 }}>Proyectar ahora</button>
    </ModalShell>
  );
}
function ModalShell({ title, icon: Icon, color, onClose, children }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 12, padding: 20, width: 360, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={16} color={color} /><span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span></div>
          <button onClick={onClose} style={iconGhost}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------- CONTROL MULTIMEDIA (EN VIVO) ----------------

function MultimediaControl({ eventTitle, library, slides, activeIdx, adHocIdx, goto, gotoPlanSlide, blanked, setBlanked, current, next, onEnd, canEnd, liveOwner, liveStyle, setLiveStyle, isCompact, adHoc, onExitAdHoc, onStartAdHocBible, onStartAdHocSong, onStartAdHocVideo, onOpenPublicScreen, onNavigateBibleVerse, onChangeBibleVersion, onAddLiveSlide, onEditLiveSlide }) {
  const [showStyle, setShowStyle] = useState(false);
  const [showAdHocBible, setShowAdHocBible] = useState(false);
  const [showAdHocSong, setShowAdHocSong] = useState(false);
  const [showAdHocVideo, setShowAdHocVideo] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [newSlideDraft, setNewSlideDraft] = useState({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "" });
  // Editar una diapositiva ya agregada (versículo/slide/punto del bosquejo) por si algo se escribió mal.
  const [editingSlide, setEditingSlide] = useState(null); // la slide original que se está editando, o null
  const [editDraft, setEditDraft] = useState(null);
  const startEditingSlide = (s) => {
    setEditingSlide(s);
    setEditDraft(s.type === "biblia" ? { reference: s.reference, text: s.text } : { title: s.title, subtitle: s.subtitle || "", bg: s.bg || "#1B2029", bgType: s.bgType || "color", videoUrl: s.videoUrl || "" });
  };
  const saveSlideEdit = () => {
    if (!editingSlide) return;
    onEditLiveSlide(editingSlide.slideId, editDraft);
    setEditingSlide(null); setEditDraft(null);
  };
  const bgFileInputRef = useRef(null);
  const bgVideoFileInputRef = useRef(null);
  const uploadBgImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "imagen", customImage: reader.result }));
    reader.readAsDataURL(file);
  };
  const uploadBgVideo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "video", customVideo: reader.result }));
    reader.readAsDataURL(file);
  };
  const customBgType = liveStyle.customBgType || "imagen";
  const fontScale = liveStyle.fontScale ?? 1;
  const navIdx = adHoc ? adHocIdx : activeIdx;

  // Saltar a una sección (Coro/Puente/Estrofa…) de la canción que está sonando ahora — como el panel "Current" de FreeShow.
  // Funciona igual para el plan y para una canción improvisada (fuera del plan): busca en la lista que
  // esté activa en cada caso, para poder saltar entre Coro/Puente/Estrofa sin salir del modo improvisado.
  const activeSongSlides = adHoc ? adHoc.slides : slides;
  const jumpToLabel = (label) => {
    const from = adHoc ? adHocIdx : activeIdx;
    const upcoming = activeSongSlides.findIndex((s, i) => i > from && s.blockLabel === label);
    const idx = upcoming !== -1 ? upcoming : activeSongSlides.findIndex((s) => s.blockLabel === label);
    if (idx === -1) return;
    if (adHoc) goto(idx); else gotoPlanSlide(idx);
  };
  const currentSongSections = useMemo(() => {
    if (!current || current.type !== "cancion") return [];
    const seen = new Map();
    activeSongSlides.forEach((s) => {
      if (s.type === "cancion" && s.songTitle === current.songTitle && !seen.has(s.blockLabel)) seen.set(s.blockLabel, sectionColorFor(s));
    });
    return [...seen.entries()];
  }, [activeSongSlides, current]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, flex: 1 }}>
      <div style={{ padding: "14px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64707F", fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}><Radio size={13} /> MULTIMEDIA</div>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventTitle}</div>
        </div>
        <button onClick={onEnd} disabled={!canEnd} title={canEnd ? undefined : `Solo ${liveOwner} puede finalizar esta transmisión`} style={{ fontSize: 11, fontWeight: 700, color: canEnd ? "#C23B32" : "#B7BEC9", background: "transparent", border: `1px solid ${canEnd ? "#C23B32" : "#C7D0DD"}`, borderRadius: 20, padding: "3px 10px", cursor: canEnd ? "pointer" : "not-allowed", flexShrink: 0 }}>Finalizar evento</button>
      </div>
      {!canEnd && <div style={{ padding: "0 16px 6px", fontSize: 10, color: "#8996A6" }}>Solo {liveOwner} puede finalizar esta transmisión.</div>}

      {/* Barra de herramientas: pantalla 2, negro, estilo */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 10px", flexWrap: "wrap" }}>
        <button onClick={onOpenPublicScreen} style={{ ...ctrlBtn, background: "#16324F", color: "#fff" }}><Radio size={14} /> Reabrir proyección</button>
        <button onClick={() => setBlanked((b) => !b)} style={{ ...ctrlBtn, background: blanked ? "#C23B32" : "#EEF1F6", color: blanked ? "#fff" : "#16233A" }}><MonitorOff size={14} /> {blanked ? "Reanudar" : "Pantalla en negro"}</button>
        <button onClick={() => setShowStyle((s) => !s)} style={{ ...ctrlBtn, background: showStyle ? "#B15EA0" : "#EEF1F6", color: showStyle ? "#fff" : "#16233A" }}>🎨 Estilo</button>
      </div>

      {adHoc && (
        <div style={{ margin: "0 16px 10px", background: "#FFF4E8", border: "1px solid #E8821E", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8A4F0E" }}>● {adHoc.label}</span>
          <button onClick={onExitAdHoc} style={{ fontSize: 11, fontWeight: 700, color: "#8A4F0E", background: "transparent", border: "1px solid #E8821E", borderRadius: 14, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}>Volver al plan</button>
        </div>
      )}

      {showStyle && (
        <div style={{ margin: "0 16px 14px", background: "#F4F6FA", border: "1px solid #DDE3ED", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>FONDO DE LA PROYECCIÓN</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {Object.entries(LIVE_THEMES).map(([key, t]) => (
              <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, theme: key }))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 8, border: liveStyle.theme === key ? "2px solid #B15EA0" : "1px solid #C7D0DD", cursor: "pointer", background: "#fff" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: t.bg }} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 3, background: "#EEF1F6", padding: 3, borderRadius: 8, marginBottom: 8, width: "fit-content" }}>
            <button onClick={() => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "imagen" }))} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: liveStyle.theme === "custom" && customBgType === "imagen" ? "#B15EA0" : "transparent", color: liveStyle.theme === "custom" && customBgType === "imagen" ? "#fff" : "#64707F" }}><ImgIcon size={12} /> Imagen</button>
            <button onClick={() => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "video" }))} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: liveStyle.theme === "custom" && customBgType === "video" ? "#B15EA0" : "transparent", color: liveStyle.theme === "custom" && customBgType === "video" ? "#fff" : "#64707F" }}><Play size={12} /> Video (movimiento)</button>
          </div>
          {customBgType === "imagen" ? (
            <button onClick={() => bgFileInputRef.current?.click()} className="hoverable" style={{ ...addBtnStyle, marginBottom: 12 }}>
              {liveStyle.customImage ? (
                <span style={{ width: 16, height: 16, borderRadius: 4, backgroundImage: `url(${liveStyle.customImage})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
              ) : (
                <ImgIcon size={13} color="#8996A6" />
              )}
              <span>{liveStyle.customImage ? "Imagen cargada — tocar para cambiar" : "Subir imagen de fondo"}</span>
            </button>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  placeholder="https://... (mp4 de fondo con movimiento)"
                  value={liveStyle.customVideo && !liveStyle.customVideo.startsWith("data:") ? liveStyle.customVideo : ""}
                  onChange={(e) => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "video", customVideo: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => bgVideoFileInputRef.current?.click()} style={{ ...addBtnStyle, width: "auto", padding: "0 12px", whiteSpace: "nowrap" }}><Paperclip size={13} color="#B15EA0" /> Subir</button>
                <input ref={bgVideoFileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => { uploadBgVideo(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              {liveStyle.customVideo && (
                <div style={{ fontSize: 11, color: "#1F8A73", marginTop: 6 }}>{liveStyle.customVideo.startsWith("data:") ? "Video propio cargado ✓" : "Video de fondo configurado ✓"} — se reproduce en bucle detrás de toda la letra/versículos.</div>
              )}
            </div>
          )}
          <input ref={bgFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { uploadBgImage(e.target.files?.[0]); e.target.value = ""; }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>TIPOGRAFÍA</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(LIVE_FONTS).map(([key, f]) => (
              <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, font: key }))} style={{ padding: "5px 10px", borderRadius: 8, border: liveStyle.font === key ? "2px solid #B15EA0" : "1px solid #C7D0DD", cursor: "pointer", background: "#fff", fontFamily: f.family, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", textTransform: f.transform, fontSize: 12 }}>{f.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Cuerpo: grid de diapositivas (izquierda) + panel de vista previa y controles (derecha), como FreeShow */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16, padding: "0 16px 16px" }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#64707F", fontWeight: 700 }}>TODAS LAS SLIDES</span>
            <button
              onClick={() => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "" }); setShowAddSlide(true); }}
              title="Agregar una diapositiva al plan en vivo (ej. un anuncio que se quedó fuera)"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "#EAF0FA", border: "none", borderRadius: 14, padding: "4px 10px", cursor: "pointer" }}
            ><Plus size={13} /> Agregar diapositiva</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {slides.map((s, i) => {
              const color = sectionColorFor(s);
              const label = s.type === "cancion" ? s.blockLabel : s.type === "biblia" ? s.reference : s.title;
              const preview = s.type === "cancion" ? s.lines.join(" ") : s.type === "biblia" ? s.text : s.subtitle;
              const isActive = !adHoc && i === activeIdx;
              const isEditable = s.type === "biblia" || s.type === "slide";
              return (
                <div
                  key={s.slideId} onClick={() => gotoPlanSlide(i)} className="thumb" role="button" tabIndex={0}
                  style={{ textAlign: "left", padding: 0, borderRadius: 10, cursor: "pointer", border: isActive ? "2px solid #E8821E" : "1px solid transparent", background: "transparent", overflow: "hidden", boxShadow: isActive ? "0 4px 14px rgba(232,130,30,0.3)" : "0 1px 5px rgba(22,50,79,0.12)" }}
                >
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#0a0e14", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                    <span style={{ position: "absolute", top: 4, left: 6, fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>{i + 1}</span>
                    <span style={{ fontSize: 9, lineHeight: 1.35, textAlign: "center", color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{preview}</span>
                    {isEditable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditingSlide(s); }}
                        title="Editar esta diapositiva (corregir texto)"
                        style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 5, padding: 3, cursor: "pointer", display: "flex" }}
                      ><Pencil size={10} color="#fff" /></button>
                    )}
                  </div>
                  <div style={{ background: color, color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ width: 250, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Fija arriba (no se va con el scroll): así siempre puedes ver cuánto estás agrandando la letra
              aunque tengas que bajar para llegar al slider u otros controles del panel. */}
          <div style={{ position: "sticky", top: 0, zIndex: 3, background: "#F4F6FA", paddingBottom: 10, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#64707F", letterSpacing: 0.4, marginBottom: 6 }}><Radio size={11} /> VISTA PREVIA</div>
            <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 12px rgba(22,50,79,0.18)" }}>
              <ProjectionPanel slide={current} blanked={blanked} split={false} liveStyle={liveStyle} adHocLabel={adHoc?.label} thumbnail />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => goto(0)} style={{ ...ctrlBtn, width: 38, justifyContent: "center", padding: "9px 0" }}><SkipBack size={15} /></button>
            <button onClick={() => goto(navIdx - 1)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}><ChevronLeft size={16} /></button>
            <button onClick={() => goto(navIdx + 1)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}><ChevronRight size={16} /></button>
            <button onClick={() => goto(Infinity)} style={{ ...ctrlBtn, width: 38, justifyContent: "center", padding: "9px 0" }}><SkipForward size={15} /></button>
          </div>

          {/* Solo aparece cuando lo que está en vivo es un versículo elegido con el buscador de la Biblia
              (trae bookId/chapter) — permite seguir leyendo versículo por versículo y cambiar de versión
              sin volver a abrir el buscador, para cuando el pastor lee varios versículos seguidos. */}
          {current?.type === "biblia" && current.bookId && (
            <div style={{ background: "#F4F6FA", border: "1px solid #DDE3ED", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", letterSpacing: 0.4, marginBottom: 8 }}>LECTURA BÍBLICA EN VIVO</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => onNavigateBibleVerse(-1)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}><ChevronLeft size={14} /> Anterior</button>
                <button onClick={() => onNavigateBibleVerse(1)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}>Siguiente <ChevronRight size={14} /></button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {BIBLE_VERSIONS.map((v) => (
                  <button key={v.code} onClick={() => onChangeBibleVersion(v.code)} title={v.label} style={{ fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 8, border: current.version === v.code ? "2px solid #2F5FA8" : "1px solid #C7D0DD", background: current.version === v.code ? "#EAF0FA" : "#fff", color: "#16233A", cursor: "pointer" }}>{v.code}</button>
                ))}
              </div>
            </div>
          )}

          {/* Control de tamaño de letra: un solo slider para arrastrar, aplica de una vez en la pantalla real */}
          <div style={{ background: "#F4F6FA", border: "1px solid #DDE3ED", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64707F", letterSpacing: 0.4 }}>TAMAÑO DE LETRA</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#16233A" }}>{Math.round(fontScale * 100)}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8996A6" }}>A</span>
              <input
                type="range" min={0.6} max={1.8} step={0.05}
                value={fontScale}
                onChange={(e) => setLiveStyle((s) => ({ ...s, fontScale: parseFloat(e.target.value) }))}
                style={{ flex: 1, accentColor: "#E8821E", cursor: "pointer" }}
              />
              <span style={{ fontSize: 19, fontWeight: 700, color: "#8996A6" }}>A</span>
            </div>
          </div>

          {currentSongSections.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>SECCIONES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {currentSongSections.map(([label, color]) => (
                  <button key={label} onClick={() => jumpToLabel(label)} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, border: "none", borderRadius: 14, padding: "4px 10px", cursor: "pointer" }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {current && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: TYPE_META[current.type].color, letterSpacing: 0.5, marginBottom: 4 }}>AHORA · {TYPE_META[current.type].label.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: "#8996A6" }}>{next ? `Siguiente: ${next.type === "cancion" ? next.blockLabel : next.type === "biblia" ? next.reference : next.title}` : adHoc ? "Fin del contenido improvisado" : "Última slide del servicio"}</div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: "#64707F", fontWeight: 700, marginBottom: 6 }}>IMPROVISAR</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowAdHocBible(true)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}><BookOpen size={13} /></button>
              <button onClick={() => setShowAdHocSong(true)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}><Music size={13} /></button>
              <button onClick={() => setShowAdHocVideo(true)} style={{ ...ctrlBtn, flex: 1, justifyContent: "center" }}><ImgIcon size={13} /></button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {showAdHocBible && (
        <BibleModal
          title="Proyectar versículo improvisado"
          submitLabel="Proyectar ahora"
          onClose={() => setShowAdHocBible(false)}
          onAdd={(b) => { onStartAdHocBible(b); setShowAdHocBible(false); }}
        />
      )}
      {showAdHocSong && <AdHocSongModal library={library} onClose={() => setShowAdHocSong(false)} onPick={(song) => { onStartAdHocSong(song); setShowAdHocSong(false); }} />}
      {showAdHocVideo && <AdHocVideoModal onClose={() => setShowAdHocVideo(false)} onPlay={(url) => { onStartAdHocVideo(url); setShowAdHocVideo(false); }} />}
      {showAddSlide && (
        <SlideModal
          draft={newSlideDraft} setDraft={setNewSlideDraft}
          onClose={() => setShowAddSlide(false)}
          onAdd={() => { if (!newSlideDraft.title && !(newSlideDraft.bgType === "video" && newSlideDraft.videoUrl)) return; onAddLiveSlide(newSlideDraft); setShowAddSlide(false); }}
        />
      )}
      {editingSlide && editingSlide.type === "biblia" && (
        <ModalShell title="Editar versículo" icon={BookOpen} color="#2F5FA8" onClose={() => setEditingSlide(null)}>
          <Field label="Referencia"><input value={editDraft.reference} onChange={(e) => setEditDraft({ ...editDraft, reference: e.target.value })} style={inputStyle} /></Field>
          <div style={{ height: 10 }} />
          <Field label="Texto"><textarea value={editDraft.text} onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })} style={{ ...inputStyle, height: 100, resize: "none" }} /></Field>
          <button onClick={saveSlideEdit} style={{ ...primaryBtn, marginTop: 14 }}>Guardar cambios</button>
        </ModalShell>
      )}
      {editingSlide && editingSlide.type === "slide" && (
        <SlideModal title="Editar diapositiva" submitLabel="Guardar cambios" draft={editDraft} setDraft={setEditDraft} onClose={() => setEditingSlide(null)} onAdd={saveSlideEdit} />
      )}
    </div>
  );
}

// ---------------- PROYECCIÓN ----------------
// Ajusta el tamaño de letra automáticamente (como el autofit de PowerPoint): el slider de tamaño en
// Multimedia define el tamaño DESEADO, pero este componente lo mide contra el espacio real disponible y
// lo va reduciendo hasta que quepa entero — así, sin importar cuántas líneas tenga la diapositiva ni qué
// tan arriba se suba el slider, el texto nunca se corta ni se sale de la pantalla.
function AutoFitText({ lines, targetRatio, minPx = 14, style, maxWidth }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [fontPx, setFontPx] = useState(minPx);
  const fitKey = Array.isArray(lines) ? lines.join("\n") : lines;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    const fit = () => {
      // El tamaño de arranque es proporcional al alto REAL del contenedor (no un px fijo) — así se ve
      // igual de grande tanto en la mini-preview del panel de control como en la pantalla de verdad del
      // proyector, sin importar que una sea una cajita chica y la otra un TV de 1920px. El límite de
      // nunca desbordarse sigue siendo el achicado automático de abajo.
      let size = Math.max(minPx, container.clientHeight * targetRatio);
      const fits = () => text.scrollHeight <= container.clientHeight + 1 && text.scrollWidth <= container.clientWidth + 1;
      text.style.fontSize = `${size}px`;
      let guard = 0;
      while (!fits() && size > minPx && guard < 60) {
        size -= Math.max(1, Math.round(size * 0.05));
        text.style.fontSize = `${size}px`;
        guard++;
      }
      setFontPx(size);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [targetRatio, fitKey, minPx]);

  return (
    <div ref={containerRef} style={{ width: "100%", maxWidth: maxWidth || "100%", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div ref={textRef} style={{ ...style, fontSize: fontPx }}>
        {Array.isArray(lines) ? lines.map((l, i) => <div key={i}>{l}</div>) : lines}
      </div>
    </div>
  );
}

export function ProjectionPanel({ slide, blanked, split, liveStyle, compactHeight, adHocLabel, thumbnail }) {
  const font = LIVE_FONTS[liveStyle?.font || "elegante"];
  const scale = liveStyle?.fontScale ?? 1;
  // Prioridad de fondo: video propio de esta slide > video de fondo global (Estilo > Video) > imagen > tema de color.
  const slideVideoBg = slide?.type === "slide" && slide.bgType === "video" && slide.videoUrl;
  const globalVideoBg = !slideVideoBg && liveStyle?.theme === "custom" && liveStyle.customVideo;
  const videoSrc = slideVideoBg ? slide.videoUrl : globalVideoBg ? liveStyle.customVideo : null;
  const isCustomImage = !videoSrc && liveStyle?.theme === "custom" && liveStyle.customImage;
  const theme = videoSrc || isCustomImage ? null : LIVE_THEMES[liveStyle?.theme || "stage"];
  const bg = videoSrc ? "#000" : isCustomImage ? `center / cover no-repeat url(${liveStyle.customImage})` : theme.bg;
  // El tamaño de letra "deseado" viene del slider (liveStyle.fontScale) multiplicando una proporción del
  // alto del contenedor (ver AutoFitText) en vez de un px fijo — así se ve igual de grande en la
  // mini-preview y en la pantalla real, y ese mismo % sigue aplicando de una diapositiva a la siguiente
  // (liveStyle.fontScale es un solo valor compartido, no por diapositiva) sin nunca desbordarse, porque
  // AutoFitText siempre lo achica más si hace falta para esa diapositiva en particular.
  const cancionRatio = 0.16 * scale;
  const bibliaRatio = 0.12 * scale;
  const slideRatio = 0.18 * scale;
  return (
    <div style={{ flex: thumbnail ? "none" : compactHeight ? "none" : split ? 1.3 : 1, width: thumbnail ? "100%" : "auto", height: thumbnail ? "100%" : compactHeight || "auto", minHeight: thumbnail ? "auto" : compactHeight || "auto", background: bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", padding: thumbnail ? 10 : 32, minWidth: thumbnail ? 0 : 320, overflow: "hidden" }}>
      {!thumbnail && <div style={{ position: "absolute", top: 18, left: 22, display: "flex", alignItems: "center", gap: 6, color: "#5B6472", fontSize: 11, fontWeight: 700, letterSpacing: 1, zIndex: 2 }}><Radio size={12} /> PANTALLA DE PROYECCIÓN</div>}
      {/* Solo visible en la vista previa del operador (no se pasa esta prop en la pantalla real del público) */}
      {adHocLabel && <div style={{ position: "absolute", top: thumbnail ? 6 : 18, right: thumbnail ? 8 : 22, background: "rgba(232,130,30,0.9)", color: "#16233A", fontSize: thumbnail ? 8 : 10, fontWeight: 700, letterSpacing: 0.5, borderRadius: 20, padding: thumbnail ? "2px 6px" : "4px 10px", zIndex: 2 }}>● IMPROVISADO</div>}
      {blanked || !slide ? (
        <div style={{ color: "#2A3140" }}><Mic2 size={thumbnail ? 20 : 40} /></div>
      ) : (
        <>
          {videoSrc && (
            <>
              <video src={videoSrc} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 0 }} />
            </>
          )}
          {isCustomImage && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 0 }} />}
          {!videoSrc && <div className="spotlight-glow" style={{ position: "absolute", width: thumbnail ? 140 : 420, height: thumbnail ? 140 : 420, borderRadius: "50%", background: `radial-gradient(circle, ${TYPE_META[slide.type].color}22 0%, transparent 70%)` }} />}
          {slide.type === "cancion" && (
            <>
              <div style={{ fontSize: thumbnail ? 9 : 12, fontWeight: 700, letterSpacing: thumbnail ? 1 : 2, color: "#E8821E", marginBottom: thumbnail ? 6 : 14, zIndex: 1 }}>{slide.blockLabel.toUpperCase()}</div>
              <AutoFitText
                lines={slide.lines} targetRatio={cancionRatio} minPx={thumbnail ? 7 : 15} maxWidth="90%"
                style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: font.tracking, fontStyle: font.italic ? "italic" : "normal", textAlign: "center", zIndex: 1, lineHeight: 1.35, color: "#fff" }}
              />
              {!thumbnail && <div style={{ position: "absolute", bottom: 18, display: "flex", alignItems: "center", gap: 8, color: "#5B6472", fontSize: 12, zIndex: 1 }}><Music size={12} /> {slide.songTitle}</div>}
            </>
          )}
          {slide.type === "biblia" && (
            <>
              <AutoFitText
                lines={`"${slide.text}"`} targetRatio={bibliaRatio} minPx={thumbnail ? 7 : 14} maxWidth="90%"
                style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: font.tracking, textAlign: "center", zIndex: 1, lineHeight: 1.4, fontStyle: font.italic || font.family.includes("Fraunces") ? "italic" : "normal", color: "#fff" }}
              />
              <div style={{ marginTop: thumbnail ? 6 : 16, fontSize: thumbnail ? 10 : 14, color: "#6E9BD1", fontWeight: 700, zIndex: 1, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {slide.reference}
                {!thumbnail && slide.version && <span style={{ fontSize: 11, background: "rgba(110,155,209,0.2)", borderRadius: 6, padding: "2px 7px" }}>{slide.version}</span>}
              </div>
            </>
          )}
          {slide.type === "slide" && (
            <div style={{ textAlign: "center", zIndex: 1, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <AutoFitText
                lines={slide.title} targetRatio={slideRatio} minPx={thumbnail ? 8 : 16} maxWidth="90%"
                style={{ fontFamily: font.family, fontWeight: Math.max(font.weight, 600), textTransform: font.transform, letterSpacing: font.tracking, fontStyle: font.italic ? "italic" : "normal", color: "#fff" }}
              />
              {slide.subtitle && !thumbnail && <div style={{ fontSize: 15, color: "#B7BEC9", marginTop: 8, flexShrink: 0 }}>{slide.subtitle}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- estilos compartidos ----------------
const iconGhost = { background: "transparent", border: "none", color: "#64707F", cursor: "pointer", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 };
const miniBtnStyle = { display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px solid #C7D0DD", borderRadius: 6, padding: "4px 8px", fontSize: 10, color: "#2F5FA8", cursor: "pointer" };
const ctrlBtn = { display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", color: "#16233A", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostToggleBtn = { fontSize: 12, fontWeight: 700, padding: "8px 12px", borderRadius: 8, border: "1px solid #C7D0DD", background: "#EEF1F6", color: "#16324F", cursor: "pointer" };
const addBtnStyle = { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 8, padding: "9px 10px", fontSize: 12, fontWeight: 600, color: "#16233A", cursor: "pointer" };
const inputStyle = { width: "100%", background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "#16233A", outline: "none", boxSizing: "border-box" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, color: "#16324F", cursor: "pointer" };
