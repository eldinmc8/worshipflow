import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import {
  Music, Mic2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus,
  Radio, ListMusic, BookOpen, Image as ImgIcon, Trash2, GripVertical,
  MonitorOff, X, Search, Sparkles, Calendar, MapPin, Users, Check,
  UserPlus, Paperclip, Play, ArrowLeft, Home, Heart, RefreshCw, Pencil,
  Star, LogOut, Settings, Download, Eye, EyeOff,
  ClipboardList, FolderOpen, ExternalLink, LayoutGrid, SkipBack, SkipForward, Copy, KeyRound, Bell, Palette,
  Type,
} from "lucide-react";
import { listCancionesCompletas, guardarCancionDesdeEditor, deleteCancion } from "./lib/canciones.js";
import {
  listEventosCompletos, crearEventoCompleto, sincronizarServiceOrder, sincronizarWorshipRoles, deleteEvento, updateEvento, marcarAsignacionVista,
} from "./lib/eventos.js";
import { listMinisteriosCompletos, crearMinisterio, actualizarLiderMinisterio, actualizarNombreMinisterio, actualizarColorMinisterio, eliminarMinisterio, sincronizarPlan, sincronizarRecursos } from "./lib/ministerios.js";
import { updateLiveSession, clearLiveSession, getLiveSession, subscribeLiveSession, broadcastLiveSession } from "./lib/liveSession.js";
import { getMusicoLive, updateMusicoLive, clearMusicoLive, subscribeMusicoLive } from "./lib/musicoLive.js";
import { subscribeTableChanges } from "./lib/realtime.js";
import { sincronizarRecordatorios } from "./lib/recordatorios.js";
import { listMisNotificaciones, marcarLeida, marcarTodasLeidas, subscribeNotificaciones, suscribirPush, desuscribirPush, estaSuscritoPush } from "./lib/notificaciones.js";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { getInstallState, subscribeInstallState, isIosSafari, promptInstall } from "./lib/pwaInstall.js";
import { parseIsoDateLocal, todayLocal, isUpcoming, compareByDay, MONTH_NAMES_FULL, MONTH_ABBR, DOW_LABELS, monthKey, monthLabelFromKey, formatFullDate, buildMonthWeeks } from "./lib/dates.js";
import { saveCache, loadCache } from "./lib/offlineCache.js";

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
// (ver addSong) — todas las categorías van al mismo "Bloque de Alabanza" (antes Adoración creaba su
// propio bloque aparte; se unificó a pedido para que cualquier canción caiga siempre en uno solo).
const SONG_CATEGORIES = {
  himno: { label: "Himno", block: "Alabanza" },
  corito: { label: "Corito", block: "Alabanza" },
  especial: { label: "Canto especial", block: "Alabanza" },
  adoracion: { label: "Adoración", block: "Alabanza" },
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

// Umbral para dar por abandonada una sesión en vivo que nadie finalizó — ver el useEffect que llama a getLiveSession().
const LIVE_SESSION_STALE_MS = 24 * 60 * 60 * 1000;

// ---- Modo Músico líder/seguidor durante una transmisión en vivo (ver SongView, tabla musico_en_vivo) ----
// Identifica esta pestaña/dispositivo para saber si el líder que aparece en musico_en_vivo soy yo o
// alguien más — se genera una sola vez por carga de página, no hace falta que sobreviva a un refresh.
const DEVICE_ID = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Math.random().toString(36).slice(2)}`;
// Si el líder no manda un "sigo aquí" (heartbeat, o cualquier acción — ambos tocan la columna heartbeat)
// en más de esto, se da por perdido: el siguiente que toque "Modo Músico" puede tomar el mando sin
// quedar nadie bloqueado a mitad de un culto.
const MUSICO_LEADER_STALE_MS = 10000;
function filaAMusicoState(fila) {
  if (!fila) return null;
  return {
    liderId: fila.lider_id || null,
    songItemId: fila.song_item_id || null,
    sectionIdx: fila.section_idx ?? 0,
    bpm: fila.bpm || null,
    auto: !!fila.auto,
    heartbeat: fila.heartbeat || null,
  };
}
function isMusicoLeaderFresh(musicoState) {
  return !!(musicoState?.liderId && musicoState?.heartbeat && Date.now() - new Date(musicoState.heartbeat).getTime() < MUSICO_LEADER_STALE_MS);
}

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
// Color del texto principal en pantalla (letra de canción, cita bíblica, título de slide) — todos
// pensados para buen contraste sobre los fondos oscuros de LIVE_THEMES/imágenes/video.
const LIVE_TEXT_COLORS = {
  blanco: { label: "Blanco", value: "#FFFFFF" },
  crema: { label: "Crema", value: "#F5EFE0" },
  amarillo: { label: "Amarillo suave", value: "#F5D67B" },
  celeste: { label: "Celeste", value: "#BFE3FF" },
  dorado: { label: "Dorado", value: "#E8C77E" },
};
// Objeto "evento" liviano para cuando se transmite sin un evento del calendario detrás (ver
// startFreeEvent) — referencia estable a nivel de módulo para no invalidar el useMemo de `slides` en
// cada render con un objeto nuevo. serviceOrder vacío: no hay plan, todo el contenido es improvisado.
const EVENTO_LIBRE = { id: null, title: "Transmisión libre", serviceOrder: [] };

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
  // song.defaultStructure (la pestaña Estructura de la canción, la fuente de verdad actual) manda
  // SIEMPRE que tenga contenido. "structure" es una foto fija del Estructura que se tomó el día que
  // esta canción se agregó a ESTE Setlist — no hay ninguna pantalla para editarla aparte, así que si
  // luego se ajusta la Estructura de la canción (agregar repeticiones, reordenar...), esa foto vieja se
  // queda desactualizada para siempre y terminaba ganándole a la Estructura real. Solo se usa esa foto
  // como respaldo si la canción HOY no tiene ninguna Estructura propia; y si ninguna de las dos existe,
  // se usan todas las secciones que la canción tenga (en el orden en que existen) — mejor un orden
  // razonable por defecto que una canción muda en la proyección.
  const order = song.defaultStructure && song.defaultStructure.length > 0
    ? song.defaultStructure
    : structure && structure.length > 0
      ? structure
      : Object.keys(song.blocks || {});
  order.forEach((blockKey, i) => {
    const block = song.blocks[blockKey];
    if (!block) return;
    // song.letra[blockKey] puede venir como [] a propósito (el usuario borró todas las diapositivas de
    // esa sección, ej. un instrumental que no debe proyectar nada) — el "||" NO debe caer al respaldo en
    // ese caso ([] es verdadero en JS), así que solo se usa cuando la clave no existe en absoluto.
    const slideGroups = song.letra && blockKey in song.letra ? song.letra[blockKey] : [block.lines.map(stripChords)];
    // Además, cualquier diapositiva que haya quedado en blanco (todas sus líneas vacías) nunca se
    // proyecta — así una diapositiva vacía olvidada no interrumpe la presentación en vivo.
    const nonBlankGroups = slideGroups.filter((lines) => lines.some((l) => l && l.trim()));
    nonBlankGroups.forEach((lines, si) => {
      out.push({
        slideId: `${idPrefix}-${i}-${si}`, type: "cancion", songTitle: song.title,
        blockLabel: nonBlankGroups.length > 1 ? `${block.label} (${si + 1}/${nonBlankGroups.length})` : block.label,
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
      slides.push({ slideId: item.id, type: "slide", title: item.title, subtitle: item.subtitle, bg: item.bg, bgType: item.bgType, videoUrl: item.videoUrl, imageUrl: item.imageUrl });
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
// Nombre legible de un ítem del Setlist para notificaciones y para "qué me toca" en la miniatura de un
// evento — alguien puede tener varios cargos distintos en el mismo evento (ej. Multimedia Y una
// canción), así que cada uno necesita decir CUÁL es, no solo "tienes un encargo".
function serviceItemLabel(item, library) {
  if (item.type === "seccion") return item.title || "Bloque";
  if (item.type === "cancion") return library.find((s) => s.id === item.songId)?.title || "Canción";
  if (item.type === "biblia") return `Lectura: ${item.reference}`;
  if (item.type === "slide") return item.title ? `Diapositiva: ${item.title}` : "Diapositiva";
  return "Ítem del Setlist";
}
// Lista de TODOS los cargos que una persona tiene en un evento (puede ser más de uno — ej. Multimedia Y
// además una canción) para mostrar "Te toca: ..." en su miniatura, en vez de solo un ícono de personas
// que no dice nada de qué le toca a ELLA específicamente.
function misAsignacionesEnEvento(event, uid, library) {
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
  // Publica el alto REAL de la nav flotante inferior como variable CSS (--bottom-nav-height) — así una
  // pantalla distinta con un elemento position:fixed que necesite quedar arriba de la nav (ej. la barra
  // de acordes del editor de canciones) puede apoyarse en el alto medido de verdad en ESTE dispositivo,
  // en vez de un número fijo adivinado que en celulares con gesture bar (safe-area-inset-bottom más
  // alto) dejaba ese elemento tapado detrás de la nav o fuera de la pantalla.
  const bottomNavRef = useRef(null);
  useEffect(() => {
    const el = bottomNavRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--bottom-nav-height", `${el.getBoundingClientRect().height}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isCompact]);
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
  // El guardado del Setlist/roles queda en vuelo un rato (fetch de fondo) mientras la pantalla ya se ve
  // actualizada al instante — si alguien asigna a una persona y cierra la pestaña/app de inmediato (muy
  // común en celular, apurados a mitad de un culto), esa escritura puede quedar cortada antes de llegar
  // a Supabase y la asignación "desaparece" la próxima vez que se entra, aunque en pantalla sí se vio
  // agregada un instante. Este contador + el aviso nativo de "salir sin guardar" (ver más abajo) le dan
  // al menos una oportunidad de notar que todavía hay algo guardándose antes de cerrar.
  const pendingSavesRef = useRef(0);
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (pendingSavesRef.current > 0) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  const [openSong, setOpenSong] = useState(null); // null = lista; { id, mode: 'view' | 'edit' }
  const [events, setEvents] = useState([]);
  const [datosListos, setDatosListos] = useState(false);
  // Red de seguridad si no hay internet al cargar (o se cae justo en ese momento): en vez de dejar la
  // app en blanco, se usa la última copia que sí se guardó localmente la vez que hubo conexión. Es de
  // solo lectura — los intentos de guardar algo mientras no hay señal van a fallar igual (ya lo avisan
  // las alertas de "No se pudo guardar..." que ya existían), esto solo evita la pantalla vacía.
  const [usingCachedData, setUsingCachedData] = useState(false);
  const reloadLibrary = () => listCancionesCompletas().then(setLibrary).catch((e) => window.alert("No se pudo cargar el cancionero: " + e.message));
  useEffect(() => {
    Promise.all([
      listCancionesCompletas().then((data) => { setLibrary(data); saveCache("canciones", data); }),
      listEventosCompletos().then((data) => { setEvents(data); saveCache("eventos", data); }),
      listMinisteriosCompletos().then((data) => { setMinistries(data); saveCache("ministerios", data); }),
    ])
      .catch((e) => {
        const cachedLibrary = loadCache("canciones");
        const cachedEvents = loadCache("eventos");
        const cachedMinistries = loadCache("ministerios");
        if (cachedLibrary || cachedEvents) {
          setLibrary(cachedLibrary || []);
          setEvents(cachedEvents || []);
          setMinistries(cachedMinistries || []);
          setUsingCachedData(true);
        } else {
          window.alert("No se pudieron cargar los datos: " + e.message);
        }
      })
      .finally(() => setDatosListos(true));
  }, []);
  // Sincroniza Canciones/Eventos/Ministerios EN TIEMPO REAL entre dispositivos — antes cada uno se
  // cargaba una sola vez al abrir la app y quien lo tuviera abierto no se enteraba de cambios hechos
  // desde otro celular/computadora hasta recargar la página a mano. Cada dominio se re-lee completo
  // (mismo listXCompletos que ya usa la carga inicial) apenas Supabase avisa que algo cambió — ver
  // subscribeTableChanges para el debounce y la pausa mientras alguien está escribiendo.
  useEffect(() => {
    const unsubCanciones = subscribeTableChanges(
      "rt-canciones", ["canciones", "secciones_cancion", "diapositivas_letra", "estructura_cancion"],
      () => listCancionesCompletas().then((data) => { setLibrary(data); saveCache("canciones", data); }).catch(() => {})
    );
    const unsubEventos = subscribeTableChanges(
      "rt-eventos", ["eventos", "items_servicio", "roles_evento", "miembros_rol", "recordatorios_evento", "asignaciones_vistas"],
      () => listEventosCompletos().then((data) => { setEvents(data); saveCache("eventos", data); }).catch(() => {}),
      2500, () => pendingSavesRef.current > 0
    );
    const unsubMinisterios = subscribeTableChanges(
      "rt-ministerios", ["ministerios", "planificacion_ministerio", "recursos_ministerio"],
      () => listMinisteriosCompletos().then((data) => { setMinistries(data); saveCache("ministerios", data); }).catch(() => {})
    );
    return () => { unsubCanciones(); unsubEventos(); unsubMinisterios(); };
  }, []);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [blanked, setBlanked] = useState(false);
  // Contenido improvisado en vivo (versículo/canción/video que no están en el setlist): reemplaza al plan mientras esté activo.
  const [adHoc, setAdHoc] = useState(null); // { label, slides } | null
  const [adHocIdx, setAdHocIdx] = useState(0);
  const [showBibleForm, setShowBibleForm] = useState(false);
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [slideDraft, setSlideDraft] = useState({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" });
  const [showSermonForm, setShowSermonForm] = useState(false);
  const [sermonPointText, setSermonPointText] = useState("");

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const [liveEventId, setLiveEventId] = useState(null);
  const [liveOwnerId, setLiveOwnerId] = useState(null); // usuario que inició la transmisión; solo esa persona puede finalizarla
  // Estado de Modo Músico líder/seguidor de la sesión en vivo (ver columnas musico_* en sesiones_en_vivo
  // y el useEffect de subscribeLiveSession más abajo, que lo llena junto con liveEventId/liveOwnerId).
  const [musicoState, setMusicoState] = useState(null);
  // "En vivo sin evento": transmisión libre, sin ningún plan/setlist detrás — solo contenido improvisado
  // (Biblia/canción/video/slide). liveEventId se queda en null en este caso, igual que cuando no hay nada
  // en vivo, así que se necesita esta bandera aparte para distinguir ambos casos.
  const [liveLibre, setLiveLibre] = useState(false);
  // Diapositivas agregadas a mano durante una transmisión libre (ej. el título de la predica) — no hay
  // ningún evento real al que guardarlas en Supabase, así que viven solo en memoria mientras dura esta
  // transmisión (se limpian al iniciar/terminar una), pero SÍ quedan fijas ahí (reseleccionables) en vez
  // de proyectarse una sola vez y desaparecer, igual que cualquier diapositiva agregada a un evento real.
  const [libreServiceOrder, setLibreServiceOrder] = useState([]);
  const liveEvent = liveLibre ? { ...EVENTO_LIBRE, serviceOrder: libreServiceOrder } : events.find((e) => e.id === liveEventId);
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
    if (liveLibre) { setLibreServiceOrder((o) => fn(o)); return; } // sin evento real, no hay nada que guardar en Supabase
    let nuevoOrden = null;
    setEvents((evs) => evs.map((e) => {
      if (e.id !== liveEventId) return e;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) {
      pendingSavesRef.current++;
      sincronizarServiceOrder(liveEventId, nuevoOrden).catch((err) => window.alert("No se pudo guardar el setlist: " + err.message)).finally(() => pendingSavesRef.current--);
    }
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
  // Borrar una diapositiva agregada a mano por error — si era la que estaba en pantalla, activeIdx se
  // recorta para no quedar apuntando más allá del final del plan (pantalla en negro hasta elegir otra).
  const removeLiveSlide = (slideId) => {
    let nuevaLongitud = 0;
    updateLiveOrder((o) => { const filtrado = o.filter((item) => item.id !== slideId); nuevaLongitud = filtrado.length; return filtrado; });
    setActiveIdx((i) => Math.min(i, Math.max(0, nuevaLongitud - 1)));
  };
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

  const updateOrder = (fn) => {
    let nuevoOrden = null;
    setEvents((evs) => evs.map((e) => {
      if (e.id !== selectedEventId) return e;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) {
      pendingSavesRef.current++;
      sincronizarServiceOrder(selectedEventId, nuevoOrden).catch((err) => window.alert("No se pudo guardar el setlist: " + err.message)).finally(() => pendingSavesRef.current--);
    }
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
    if (!slideDraft.title && !(slideDraft.bgType === "video" && slideDraft.videoUrl) && !(slideDraft.bgType === "imagen" && slideDraft.imageUrl)) return; // se permite solo-video/solo-imagen sin texto
    updateOrder((o) => [...o, { id: nextId(), type: "slide", ...slideDraft }]);
    setSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" });
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
    const item = selectedEvent?.serviceOrder.find((i) => i.id === itemId);
    const label = item ? serviceItemLabel(item, library) : "un encargo";
    notificarAsignacion(usuario.id, { titulo: `Te asignaron: ${label}`, cuerpo: `Quedaste a cargo de "${label}" en "${selectedEvent?.title}".`, eventoId: selectedEventId });
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
    if (nuevo) {
      pendingSavesRef.current++;
      sincronizarWorshipRoles(selectedEventId, nuevo).catch((err) => window.alert("No se pudo guardar el equipo de alabanza: " + err.message)).finally(() => pendingSavesRef.current--);
    }
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
    const role = (selectedEvent?.worshipRoles || []).find((r) => r.id === roleId);
    const label = role?.name || "el equipo de alabanza";
    notificarAsignacion(usuario.id, { titulo: `Te asignaron: ${label}`, cuerpo: `Quedaste como "${label}" en "${selectedEvent?.title}".`, eventoId: selectedEventId });
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
  // Si ya hay algo en vivo (un evento real o una transmisión libre) y se va a reemplazar por otra cosa,
  // confirma antes — mismo diálogo para las tres combinaciones (evento→evento, evento→libre, libre→evento).
  const confirmReplaceLive = (excludeEventId) => {
    if (!liveEventId && !liveLibre) return true;
    if (liveEventId && liveEventId === excludeEventId) return true;
    const otherTitle = liveLibre ? "Transmisión libre" : events.find((e) => e.id === liveEventId)?.title;
    return window.confirm(`"${otherTitle}" ya está en vivo. ¿Finalizarlo e iniciar esto en su lugar?`);
  };
  // Escribe el estado de Modo Músico (líder, canción/sección/tempo/auto-avance actuales) para que se
  // vea igual en todos los dispositivos de la banda — ver SongView, que es quien de verdad decide CUÁNDO
  // llamar esto (solo el líder escribe; los seguidores solo leen vía musicoState). Silencioso a propósito:
  // es una señal de sincronización en vivo frecuente, no algo que merezca una alerta si falla una vez.
  const updateMusicoState = (patch) => {
    setMusicoState((s) => ({ ...(s || {}), ...patch }));
    const dbPatch = {};
    if ("liderId" in patch) dbPatch.lider_id = patch.liderId;
    if ("songItemId" in patch) dbPatch.song_item_id = patch.songItemId;
    if ("sectionIdx" in patch) dbPatch.section_idx = patch.sectionIdx;
    if ("bpm" in patch) dbPatch.bpm = patch.bpm;
    if ("auto" in patch) dbPatch.auto = patch.auto;
    if ("heartbeat" in patch) dbPatch.heartbeat = patch.heartbeat;
    updateMusicoLive(dbPatch).catch(() => {});
  };
  // Nadie hereda como "líder" de Modo Músico al culto de hoy solo porque lo fue en el anterior — se
  // limpia al arrancar una transmisión nueva Y al finalizar una (ver endEvent), así que ni "reemplazar"
  // una en vivo por otra sin pasar por Finalizar (confirmReplaceLive arriba) deja un líder colgado.
  const resetMusicoLive = () => {
    setMusicoState(null);
    clearMusicoLive().catch(() => {});
  };
  const startEvent = (eventId) => {
    if (!confirmReplaceLive(eventId)) return;
    setLiveEventId(eventId); setLiveLibre(false); setLiveOwnerId(userId); setActiveIdx(0); setBlanked(false); setAdHoc(null); setAdHocIdx(0); resetMusicoLive(); setTab("envivo");
    startPresentation(); // abre/enfoca la pantalla de proyección de una vez, sin paso manual extra
  };
  // Transmitir sin un evento del calendario detrás — para anuncios, oración u otro contenido suelto que
  // no amerita crear/usar un evento planificado. Todo el contenido sale de "Improvisar" (Biblia/canción/
  // video) o de diapositivas agregadas a mano (ver libreServiceOrder) — nunca de un setlist real.
  const startFreeEvent = () => {
    if (!confirmReplaceLive(null)) return;
    setLiveEventId(null); setLiveLibre(true); setLiveOwnerId(userId); setActiveIdx(0); setBlanked(false); setAdHoc(null); setAdHocIdx(0); setLibreServiceOrder([]); resetMusicoLive(); setTab("envivo");
    startPresentation();
  };
  const endEvent = () => {
    setLiveEventId(null); setLiveLibre(false); setLiveOwnerId(null); setBlanked(false); setAdHoc(null); setAdHocIdx(0); setLibreServiceOrder([]); setTab("eventos");
    clearLiveSession().catch((e) => window.alert("No se pudo cerrar la sesión en vivo: " + e.message));
    resetMusicoLive();
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
    return persistSongDraft(draft)
      .then((idReal) => setOpenSong({ id: idReal, mode: "view" }))
      .catch((e) => { window.alert("No se pudo guardar la canción: " + e.message); throw e; });
  };
  const deleteSong = (song) => {
    if (!window.confirm(`¿Eliminar "${song.title}"? Esto no se puede deshacer.`)) return;
    setLibrary((lib) => lib.filter((s) => s.id !== song.id));
    setOpenSong(null);
    deleteCancion(song.id).catch((e) => window.alert("No se pudo eliminar la canción: " + e.message));
  };
  // Cuando un evento nace clonado de una plantilla, se marca como "recién armado" (solo en memoria,
  // nada nuevo en la base de datos) para que EventDetail le muestre el botón "Publicar evento" — un
  // simple "ya terminé de configurar esto" que regresa a la lista, ya que el evento se fue guardando
  // solo desde el instante en que se creó (mismo patrón de autoguardado que ya usa toda la app).
  const [draftFromTemplateId, setDraftFromTemplateId] = useState(null);
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
      vistas: [],
      esPlantilla: !!esPlantilla,
    };
    setEvents((evs) => [...evs, newEvent]);
    crearEventoCompleto(newEvent, userId).catch((e) => window.alert("No se pudo guardar el evento: " + e.message));
    setSelectedEventId(newEvent.id);
    if (template && !esPlantilla) setDraftFromTemplateId(newEvent.id);
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
  // Edita los datos propios del evento/plantilla (título, fecha, hora, ubicación) DESPUÉS de creado —
  // antes solo se podían fijar una vez, al crearlo, y no había forma de corregirlos ni de renombrar
  // una plantilla ya armada.
  const updateEventDetails = (eventId, { title, dateLabel, date, hora, location }) => {
    setEvents((evs) => evs.map((e) => (e.id === eventId ? { ...e, title, dateLabel: dateLabel || "", date: date || null, hora: hora || null, location: location || "" } : e)));
    updateEvento(eventId, { titulo: title, fecha_label: dateLabel || null, fecha: date || null, hora: hora || null, ubicacion: location || null })
      .catch((e) => window.alert("No se pudo guardar el evento: " + e.message));
  };

  const favoritesCount = library.filter((s) => s.favorite).length;

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
    supabase.from("usuarios").select("id, nombre, rol, foto_url").order("nombre").then(({ data }) => setUsuariosReales(data || []));
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
  // Iniciar la transmisión es más delicado que solo controlarla ya en marcha: Multimedia y Administrador
  // ven el botón "Iniciar evento", y únicamente desde un escritorio — nunca desde un teléfono, para que
  // solo se inicie desde el equipo conectado de verdad.
  const canStartLive = (myRole === "Multimedia" || myRole === "Administrador") && !isCompact;
  const myName = realIsAdmin && nameOverride ? nameOverride : realName;
  const isAdminViewer = realIsAdmin && nameOverride ? usuariosReales.find((u) => u.nombre === nameOverride)?.rol === "admin" : realIsAdmin;
  // Al simular otra identidad (ver "Simular identidad" en Ajustes) los eventos visibles también deben
  // ser los de ESA persona, no los del admin real — si no, probar "¿ve Miembro X solo lo suyo?" no
  // serviría de nada.
  const myUserId = realIsAdmin && nameOverride ? usuariosReales.find((u) => u.nombre === nameOverride)?.id : userId;
  // Un evento está "asignado a mí" si me pusieron como encargado de algún bloque/canción/versículo del
  // Setlist, o si estoy en el roster del equipo de alabanza de ese evento (ej. "Guitarra").
  const isEventAssignedToMe = (event, uid) =>
    (event.serviceOrder || []).some((item) => (item.encargados || []).some((m) => m.usuarioId === uid)) ||
    (event.worshipRoles || []).some((r) => (r.members || []).some((m) => m.usuarioId === uid));
  // Las plantillas son eventos normales marcados con esPlantilla: no aparecen en el feed de cultos
  // reales (Inicio, Eventos, Mi Horario), solo en el selector "crear desde plantilla" y en la vista
  // de administración de plantillas — ambas armadas por administradores generales. Además, solo
  // administradores ven TODOS los eventos reales sin filtro — todos los demás (Multimedia, Músico,
  // Miembro) solo ven aquellos a los que efectivamente se les asignó algo.
  const realEvents = events.filter((e) => !e.esPlantilla && (isAdminViewer || isEventAssignedToMe(e, myUserId)));
  const plantillas = events.filter((e) => e.esPlantilla);
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
    if ((!liveEventId && !liveLibre) || userId !== liveOwnerId) return;
    const fila = { evento_id: liveEventId, liderado_por: userId, slide_actual: current || null, blanked, estilo_en_vivo: liveStyle, ad_hoc_label: adHoc?.label || null, libre: liveLibre };
    // Se manda por las dos vías a la vez: BroadcastChannel llega al instante si la pantalla de
    // proyección está en la MISMA computadora (caso típico: TV por HDMI como segunda pantalla) — así el
    // cambio de diapositiva no depende del internet del lugar, igual que un presentador local. Supabase
    // sigue siendo el camino real cuando la proyección de verdad está en otro dispositivo aparte.
    broadcastLiveSession(fila);
    updateLiveSession(fila).catch((e) => window.alert("No se pudo actualizar la proyección: " + e.message));
  }, [current, blanked, liveStyle, liveEventId, liveLibre, liveOwnerId, adHoc, userId]);

  // ---- Sincroniza EN TIEMPO REAL, en todos los dispositivos, si hay un evento en vivo ahora mismo y
  // quién lo está llevando — así el indicador "En vivo" (pestaña, franja de Inicio, tarjeta del evento)
  // se enciende para músicos/miembros apenas Multimedia inicia la transmisión, sin que cada quien tenga
  // que haberlo iniciado desde su propio teléfono. Antes esto era solo estado local: cada dispositivo
  // solo se enteraba de un evento en vivo si ÉL MISMO lo había iniciado.
  useEffect(() => {
    getLiveSession()
      .then((fila) => {
        // Si a alguien se le olvidó tocar "Finalizar evento" (ej. se cerró la compu al terminar el
        // culto), la sesión se queda marcada en vivo para SIEMPRE — cualquiera que abra la app un día
        // después (o meses después) la hereda como si el culto siguiera transmitiendo. Un día entero sin
        // ningún cambio (updateLiveSession se llama en cada diapositiva/estilo mientras alguien la está
        // usando de verdad) es buena señal de que quedó abandonada, así que el primer dispositivo que
        // abre la app después de eso la cierra sola, sin pedirle nada a nadie.
        const abandonada = (fila?.evento_id || fila?.libre) && fila?.updated_at && (Date.now() - new Date(fila.updated_at).getTime() > LIVE_SESSION_STALE_MS);
        if (abandonada) {
          clearLiveSession().catch(() => {});
          setLiveEventId(null); setLiveOwnerId(null); setLiveLibre(false);
          return;
        }
        setLiveEventId(fila?.evento_id || null); setLiveOwnerId(fila?.liderado_por || null); setLiveLibre(!!fila?.libre);
      })
      .catch(() => {});
    const unsubscribe = subscribeLiveSession((fila) => {
      setLiveEventId(fila.evento_id || null);
      setLiveOwnerId(fila.liderado_por || null);
      setLiveLibre(!!fila.libre);
    });
    return unsubscribe;
  }, []);

  // ---- Modo Músico líder/seguidor: estado propio (tabla musico_en_vivo, no sesiones_en_vivo — ver
  // src/lib/musicoLive.js) para que cualquier músico pueda tomar el mando sin necesitar el permiso de
  // escritura restringido a Multimedia. Se sincroniza siempre (no solo mientras hay un evento en vivo):
  // el "active" real por evento lo decide cada SongView con isLiveNow, esto solo mantiene musicoState al día.
  useEffect(() => {
    getMusicoLive().then((fila) => setMusicoState(filaAMusicoState(fila))).catch(() => {});
    const unsubscribe = subscribeMusicoLive((fila) => setMusicoState(filaAMusicoState(fila)));
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
  // La planificación se edita como borrador local dentro de MinistryDetail (ver planDraft ahí) y solo
  // llega hasta acá cuando se toca "Guardar planificación" — un solo guardado con todo el arreglo final,
  // no uno por cada tecla, para no chocar con el refresco de sincronizarTableChanges (ver realtime.js).
  const savePlanForMinistry = async (id, plan) => {
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, plan } : m)));
    await sincronizarPlan(id, plan);
  };
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
  const setMinistryName = (id, name) => {
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, name } : m)));
    actualizarNombreMinisterio(id, name).catch((e) => window.alert("No se pudo actualizar el nombre: " + e.message));
  };
  const setMinistryColor = (id, color) => {
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, color } : m)));
    actualizarColorMinisterio(id, color).catch((e) => window.alert("No se pudo actualizar el color: " + e.message));
  };
  // Borrar un ministerio deja sin vincular (no borra) cualquier bloque del Setlist que lo usaba —
  // items_servicio.ministerio_id tiene ON DELETE SET NULL — así que ningún evento pasado se rompe,
  // solo deja de traer la planificación automática y vuelve a mostrar su descripción escrita a mano.
  const deleteMinistry = (ministry) => {
    if (!window.confirm(`¿Eliminar el grupo "${ministry.name}"? Esto no se puede deshacer. Los bloques del Setlist que lo tenían vinculado dejarán de traer su planificación sola.`)) return;
    setMinistries((ms) => ms.filter((m) => m.id !== ministry.id));
    setSelectedMinistryId(null);
    eliminarMinisterio(ministry.id).catch((e) => window.alert("No se pudo eliminar el grupo: " + e.message));
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

  // Eventos próximos donde esta persona tiene algún cargo y TODAVÍA no ha confirmado que lo vio (ver
  // "Te toca..." en EventDetail) — mientras esta lista no esté vacía, se le tapa la app con un aviso
  // que no puede cerrar sin confirmar (ver el overlay más abajo). A propósito no depende de qué pestaña
  // esté viendo: si entra por Inicio, por una notificación, por donde sea, se le sigue plantando encima
  // hasta que confirme, en vez de depender de que ella misma entre a Eventos por su cuenta.
  const pendingConfirmations = useMemo(() => {
    if (!userId) return [];
    return events
      .filter((e) => !e.esPlantilla && isUpcoming(e))
      .map((e) => ({ event: e, cargos: misAsignacionesEnEvento(e, userId, library) }))
      .filter(({ event: e, cargos }) => cargos.length > 0 && !(e.vistas || []).some((v) => v.usuarioId === userId))
      .sort((a, b) => compareByDay(a.event, b.event));
  }, [events, userId, library]);
  const confirmarAsignacionVista = (eventId) => {
    setEvents((evs) => evs.map((e) => (e.id === eventId ? { ...e, vistas: [...(e.vistas || []).filter((v) => v.usuarioId !== userId), { usuarioId: userId, vistoAt: new Date().toISOString() }] } : e)));
    marcarAsignacionVista(eventId, userId).catch(() => {});
  };

  if (!datosListos) {
    return <div className="app-shell-height" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", color: "#8996A6", fontFamily: "'Poppins', sans-serif", fontSize: 14 }}>Cargando…</div>;
  }

  return (
    <div className="app-shell-height" style={{ fontFamily: "'Poppins', sans-serif", background: "#F4F6FA", color: "#16233A", display: "flex", flexDirection: "column", position: "relative", overflowX: "hidden" }}>
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

      {usingCachedData && (
        <div style={{ background: "#E8821E", color: "#16233A", fontSize: 12, fontWeight: 700, textAlign: "center", padding: "6px 10px", flexShrink: 0 }}>
          Sin conexión — mostrando la última versión guardada en este dispositivo. Los cambios no se guardarán hasta que vuelva el internet.
        </div>
      )}

      {/* A propósito SIN botón de cerrar/X ni click-fuera-para-cerrar — la única forma de que
          desaparezca es tocando "Ya vi mi participación" en cada evento listado. Ver
          pendingConfirmations más arriba. */}
      {pendingConfirmations.length > 0 && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 20 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 22, width: 380, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFF4E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EyeOff size={20} color="#E8821E" />
              </div>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
              Tienes {pendingConfirmations.length === 1 ? "un cargo" : `${pendingConfirmations.length} cargos`} sin confirmar
            </div>
            <div style={{ fontSize: 12.5, color: "#64707F", textAlign: "center", marginBottom: 16 }}>
              Toca cada uno para avisar que ya lo viste.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingConfirmations.map(({ event: ev, cargos }) => (
                <button
                  key={ev.id}
                  onClick={() => confirmarAsignacionVista(ev.id)}
                  className="hoverable"
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "#FFF4E8", border: "1.5px solid #E8821E", borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}
                >
                  <EyeOff size={18} color="#8A4F0E" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#16233A" }}>{ev.title}</div>
                    <div style={{ fontSize: 11.5, color: "#8A4F0E", marginTop: 1 }}>{formatFullDate(ev.date) || ev.dateLabel} · Te toca: {cargos.join(", ")}</div>
                  </span>
                  <ChevronRight size={16} color="#E8821E" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header: borde inferior curvo, sin pestañas — la navegación vive abajo, flotante */}
      {/* paddingTop extendido con el área segura de arriba: el body ya no reserva ese espacio (ver
          index.css) — así el navy del header llega hasta el borde físico de la pantalla, detrás del
          notch/la muesca, en vez de dejar una franja sin pintar ahí (que en modo oscuro de iOS se veía
          negra en vez de fundirse con la app). */}
      <div style={{ background: "#16324F", padding: "calc(16px + env(safe-area-inset-top)) 20px 26px", borderRadius: "0 0 28px 28px", position: "relative", overflow: "hidden" }}>
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

      {/* overflowX oculto a propósito: la animación de deslizar entre canciones (song-slide-in-right/
          left, ver index.css) arranca el contenido FUERA de pantalla con translateX(±100%) — sin este
          corte, el navegador cuenta ese ancho "de más" como parte de la página y el celular (sobre
          todo iPhone) dejaba que todo se corriera/rebotara de lado, incluyendo cosas fijas como el
          badge "EN VIVO" del header, que terminaba saliéndose del borde visible. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      {!["envivo", "proyeccion"].includes(tab) && (
      <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", flex: tab === "inicio" ? 1 : "none", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {tab === "inicio" && (
        <InicioView events={realEvents} library={library} myUserId={myUserId} favoritesCount={favoritesCount} memberCount={usuariosReales.length} liveEventId={liveEventId} liveLibre={liveLibre} isCompact={isCompact} onSelectEvent={goToEvent} onGoLive={() => setTab("envivo")} onGoToTeam={realIsAdmin && onGoToUsuarios ? onGoToUsuarios : () => setTab("ajustes")} onOpenSong={(id) => { setTab("canciones"); setOpenSong({ id, mode: "view" }); }} />
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
          onSavePlan={(plan) => savePlanForMinistry(selectedMinistryId, plan)}
          onAddResource={(resource) => addResource(selectedMinistryId, resource)}
          onRemoveResource={(resourceId) => removeResource(selectedMinistryId, resourceId)}
          onSetLeader={(leaderId) => setMinistryLeader(selectedMinistryId, leaderId)}
          onSetName={(name) => setMinistryName(selectedMinistryId, name)}
          onSetColor={(color) => setMinistryColor(selectedMinistryId, color)}
          onDelete={() => deleteMinistry(ministries.find((m) => m.id === selectedMinistryId))}
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
        <EventList events={realEvents} plantillas={plantillas} isAdminViewer={isAdminViewer} liveEventId={liveEventId} liveLibre={liveLibre} onSelect={setSelectedEventId} onCreate={createEvent} canStartLive={canStartLive} onStartFree={startFreeEvent} library={library} myUserId={myUserId} />
      )}

      {tab === "eventos" && selectedEvent && !openSong && (
        <EventDetail
          event={selectedEvent} library={library} ministries={ministries} isCompact={isCompact}
          isLive={selectedEvent.id === liveEventId} canStartLive={canStartLive} isAdminViewer={isAdminViewer}
          userId={userId} usuariosReales={usuariosReales}
          onBack={() => window.history.back()}
          isDraftFromTemplate={selectedEvent.id === draftFromTemplateId}
          onPublish={() => { setDraftFromTemplateId(null); window.history.back(); }}
          onStart={() => startEvent(selectedEvent.id)} onGoLive={() => setTab("envivo")} onDelete={deleteEvent}
          onAddSong={addSong} onAddSeccion={addSeccion}
          onAddBibleClick={() => setShowBibleForm(true)} onAddSlideClick={() => setShowSlideForm(true)}
          onRemove={removeItem} onDuplicate={duplicateItem} onReorder={reorderItem}
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
          onUpdateEventDetails={(details) => updateEventDetails(selectedEvent.id, details)}
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
        // Modo Músico líder/seguidor solo tiene sentido mientras ESTE evento es de verdad el que está en
        // vivo ahora mismo — repasar/planear un evento futuro no debe intentar tomar el mando de nada.
        const isLiveNow = selectedEvent.id === liveEventId;
        // Si YO soy el líder ahora mismo y cambio de canción (‹ ›/swipe), el resto tiene que enterarse —
        // se manda ANTES de navegar localmente, con el id del ítem del Setlist al que voy (no el de la
        // canción sola: la misma canción puede repetirse varias veces en el Setlist).
        const goToItem = (item, enterDir) => {
          if (isLiveNow && musicoState?.liderId === DEVICE_ID) {
            updateMusicoState({ songItemId: item.id, sectionIdx: 0, heartbeat: new Date().toISOString() });
          }
          setOpenSong({ id: item.songId, mode: "view", itemId: item.id, enterDir });
        };
        return (
          <SongView
            key={currentItem?.id ?? openSong.id}
            song={displaySong} isAdminViewer={isAdminViewer} positionLabel={positionLabel}
            structureOverride={currentItem?.structure}
            enterDirection={openSong.enterDir}
            onBack={() => window.history.back()}
            onEdit={() => { setTab("canciones"); setOpenSong({ id: openSong.id, mode: "edit" }); }}
            onTranspose={transposeSong} onDelete={deleteSong}
            onPrev={prevItem ? () => goToItem(prevItem, "prev") : null}
            onNext={nextItem ? () => goToItem(nextItem, "next") : null}
            liveSync={{
              active: isLiveNow,
              deviceId: DEVICE_ID,
              itemId: currentItem?.id ?? null,
              state: musicoState,
              onUpdate: updateMusicoState,
              onFollowItem: (itemId) => {
                const item = songItems.find((it) => it.id === itemId);
                if (item) setOpenSong({ id: item.songId, mode: "view", itemId: item.id });
              },
            }}
          />
        );
      })()}
      </div>
      )}

      {tab === "envivo" && liveEvent && (
        <div style={{ width: "100%", flex: 1, minHeight: 0, display: "flex" }}>
          <MultimediaControl
            eventTitle={liveEvent.title} isFreeSession={liveLibre} library={library} slides={slides} activeIdx={activeIdx} adHocIdx={adHocIdx}
            goto={goto} gotoPlanSlide={gotoPlanSlide} blanked={blanked} setBlanked={setBlanked} current={current} next={next}
            onEnd={endEvent} canEnd={userId === liveOwnerId} liveOwner={usuariosReales.find((u) => u.id === liveOwnerId)?.nombre || "otro dispositivo"} liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={isCompact}
            adHoc={adHoc} onExitAdHoc={exitAdHoc} onStartAdHocBible={startAdHocBible} onStartAdHocSong={startAdHocSong} onStartAdHocVideo={startAdHocVideo}
            onOpenPublicScreen={startPresentation}
            onNavigateBibleVerse={navigateBibleVerse}
            onAddLiveSlide={addLiveSlide} onEditLiveSlide={editLiveSlide} onRemoveLiveSlide={removeLiveSlide}
          />
        </div>
      )}

      {tab === "proyeccion" && liveEvent && (
        <div style={{ flex: 1, display: "flex" }}><ProjectionPanel slide={current} blanked={blanked} split={false} liveStyle={liveStyle} /></div>
      )}

      </div>

      {/* Nav flotante inferior: isla redondeada con burbuja activa. Vive como hermano normal del área
          con scroll (no position: fixed/sticky) para que el layout le reserve su propio espacio siempre
          y el contenido nunca pueda quedar tapado detrás de ella, tenga o no scroll la pantalla.
          Se mide su alto real (varía por dispositivo: notch/gesture bar vía safe-area-inset-bottom) y se
          publica como variable CSS — así cualquier elemento position:fixed en otra pantalla (ej. la
          barra de acordes del editor de canciones) puede apoyarse en el alto REAL de esta nav en vez de
          un número fijo adivinado, que en un celular con gesture bar dejaba la barra de acordes tapada
          detrás de la nav (o directamente fuera de la pantalla) en vez de arriba de ella. */}
      {/* paddingBottom extendido con el área segura de abajo, mismo motivo que el header: el body ya no
          la reserva, así que esta franja (detrás de la barra de gestos del iPhone) queda pintada con el
          fondo claro de la app en vez de negro por defecto — y de paso la nav flotante queda de verdad
          fija arriba de esa barra, no flotando "a medias" sobre ella. */}
      <div ref={bottomNavRef} style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "10px 0 calc(14px + env(safe-area-inset-bottom))", zIndex: 40 }}>
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
  // Con dos servicios el mismo día (ej. domingo AM/PM), que el más temprano salga primero en el
  // selector — no en el orden en que hayan llegado de la base de datos.
  Object.values(map).forEach((list) => list.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")));
  return map;
}
function nextUpcomingEvent(events, liveEventId) {
  if (liveEventId) return events.find((e) => e.id === liveEventId);
  return events
    .filter((ev) => isUpcoming(ev))
    .slice()
    .sort(compareByDay)[0];
}

function InicioView({ events, library, myUserId, favoritesCount, memberCount, liveEventId, liveLibre, onSelectEvent, onGoLive, onGoToTeam, onOpenSong, isCompact }) {
  const liveEvent = liveLibre ? EVENTO_LIBRE : events.find((e) => e.id === liveEventId);
  const [showFavorites, setShowFavorites] = useState(false);
  const favoriteSongs = library.filter((s) => s.favorite);
  // Tocar un día del calendario con un solo evento entra directo a él (atajo rápido, el caso normal).
  // Con 2+ (ej. domingo con culto AM y PM) ya no hay forma de adivinar cuál quiso abrir, así que se
  // muestra esta lista chiquita para que elija — antes entraba siempre al primero programado.
  const [dayEventsPicker, setDayEventsPicker] = useState(null);
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
          <button onClick={() => (liveLibre ? onGoLive() : onSelectEvent(liveEvent.id))} style={{ display: "flex", alignItems: "center", gap: 8, background: "#16324F", borderRadius: 20, padding: "9px 16px", border: "none", cursor: "pointer", flexShrink: 0 }}>
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
                      onClick={() => { if (dayEvents.length === 1) onSelectEvent(dayEvents[0].id); else if (dayEvents.length > 1) setDayEventsPicker(dayEvents); }}
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
          {nextEvent ? (() => {
            const misCargos = misAsignacionesEnEvento(nextEvent, myUserId, library);
            return (
            <button onClick={() => onSelectEvent(nextEvent.id)} className="hoverable" style={{ flex: isCompact ? "none" : 1, minHeight: isCompact ? 150 : 0, textAlign: "left", border: "none", cursor: "pointer", borderRadius: 20, padding: 0, overflow: "hidden", background: nextEvent.cover || DEFAULT_COVERS[0], color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: nextIsLive ? "0 10px 24px rgba(232,130,30,0.45)" : "0 10px 22px rgba(22,50,79,0.2)" }}>
              <div style={{ padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, opacity: 0.85 }}>{nextIsLive ? "● EN VIVO AHORA" : "PRÓXIMO EVENTO"}</div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, margin: "6px 0 4px", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{nextEvent.title}</div>
                <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 5 }}><MapPin size={12} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextEvent.location}</span></div>
                {misCargos.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 6, background: "rgba(255,255,255,0.18)", borderRadius: 8, padding: "4px 8px", display: "inline-block" }}>
                    Te toca: {misCargos.join(", ")}
                  </div>
                )}
              </div>
              <div style={{ padding: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", background: "rgba(0,0,0,0.12)" }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{nextDate ? nextDate.getDate() : "–"}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>{nextDate ? MONTH_ABBR[nextDate.getMonth()] : ""}{nextEvent.dateLabel ? ` · ${nextEvent.dateLabel}` : ""}</div>
                </div>
                <AvatarStack initials={eventAvatars(nextEvent)} max={3} />
              </div>
            </button>
            );
          })() : (
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

      {dayEventsPicker && (
        <ModalShell title="Eventos de ese día" icon={Calendar} color="#2F5FA8" onClose={() => setDayEventsPicker(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayEventsPicker.map((ev) => (
              <button key={ev.id} onClick={() => { setDayEventsPicker(null); onSelectEvent(ev.id); }} className="hoverable" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: "#EEF1F6", border: "none", borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: "#64707F" }}>{ev.hora ? `${ev.hora} · ` : ""}{ev.location}</div>
                </div>
                <ChevronRight size={14} color="#8996A6" />
              </button>
            ))}
          </div>
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
  // "Continuar con Google" en Ajustes: vincula/desvincula Google como método alterno de inicio de
  // sesión para ESTA cuenta ya invitada — no reemplaza la invitación, solo evita tener que escribir la
  // contraseña la próxima vez. Ver AuthGate.jsx para el resguardo de que nadie sin invitación entre así.
  const [googleLinked, setGoogleLinked] = useState(null); // null: cargando · true/false
  const [googleBusy, setGoogleBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getUserIdentities()
      .then(({ data }) => setGoogleLinked(!!data?.identities?.some((i) => i.provider === "google")))
      .catch(() => setGoogleLinked(false));
  }, []);
  const vincularGoogle = async () => {
    setGoogleBusy(true);
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { window.alert("No se pudo vincular Google: " + error.message); setGoogleBusy(false); }
    // si no hay error, el navegador redirige a Google — vuelve solo a esta pantalla ya vinculada
  };
  const desvincularGoogle = async () => {
    if (!window.confirm("¿Dejar de poder entrar con Google? Vas a seguir pudiendo entrar con tu correo y contraseña.")) return;
    setGoogleBusy(true);
    try {
      const { data } = await supabase.auth.getUserIdentities();
      const identidad = data?.identities?.find((i) => i.provider === "google");
      if (identidad) { await supabase.auth.unlinkIdentity(identidad); setGoogleLinked(false); }
    } catch (e) {
      window.alert("No se pudo desvincular: " + e.message);
    } finally {
      setGoogleBusy(false);
    }
  };
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
        {perfil?.foto_url ? (
          <img src={perfil.foto_url} alt="" style={{ width: 66, height: 66, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0, color: "#fff" }}>{initials}</div>
        )}
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
                {u.foto_url ? (
                  <img src={u.foto_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {u.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                )}
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
      {googleLinked === true ? (
        <NavRow
          icon={Check} label="Puedes entrar con Google"
          right={googleBusy ? null : <span onClick={(e) => { e.stopPropagation(); desvincularGoogle(); }} style={{ fontSize: 11, color: "#8996A6", fontWeight: 600, cursor: "pointer" }}>Desvincular</span>}
        />
      ) : googleLinked === false ? (
        <NavRow icon={KeyRound} label="Entrar con Google" onClick={googleBusy ? undefined : vincularGoogle} right={googleBusy ? null : <ChevronRight size={16} color="#8996A6" />} />
      ) : null}
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

function MinistryDetail({ ministry, usuariosReales, isAdminViewer, canEdit, onBack, onSavePlan, onAddResource, onRemoveResource, onSetLeader, onSetName, onSetColor, onDelete }) {
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceDraft, setResourceDraft] = useState({ title: "", link: "" });

  // La planificación se edita en un borrador LOCAL, no letra por letra contra Supabase — antes cada
  // tecla disparaba un guardado (borra-todo-y-reinserta) que la sincronización en tiempo real podía
  // llegar a pisar a mitad de camino (llega un refresco de otro dispositivo mientras el guardado de ESTE
  // todavía va de salida, y agarra la base de datos en el instante en que ya se borró lo viejo pero
  // todavía no se insertó lo nuevo). Ahora nada se manda hasta tocar "Guardar planificación".
  const [planDraft, setPlanDraft] = useState(ministry?.plan || []);
  const [planDirty, setPlanDirty] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  useEffect(() => {
    if (!planDirty) setPlanDraft(ministry?.plan || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministry?.id, ministry?.plan]);

  if (!ministry) return null;

  const addDraftPlanItem = () => { setPlanDraft((plan) => [...plan, { id: nextMinistryChildId(), date: "", title: "", detail: "" }]); setPlanDirty(true); };
  const updateDraftPlanItem = (itemId, field, value) => { setPlanDraft((plan) => plan.map((p) => (p.id === itemId ? { ...p, [field]: value } : p))); setPlanDirty(true); };
  const removeDraftPlanItem = (itemId) => { setPlanDraft((plan) => plan.filter((p) => p.id !== itemId)); setPlanDirty(true); };
  const savePlan = async () => {
    setSavingPlan(true);
    try {
      await onSavePlan(planDraft);
      setPlanDirty(false);
    } catch (e) {
      window.alert("No se pudo guardar la planificación: " + e.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const submitResource = () => {
    if (!resourceDraft.title.trim()) return;
    onAddResource(resourceDraft);
    setResourceDraft({ title: "", link: "" });
    setShowResourceForm(false);
  };

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
        {/* Borrar un grupo es más consecuente que editarlo (afecta a los bloques del Setlist vinculados
            en cualquier evento), así que se restringe a administradores — el líder puede editar nombre/
            color/líder pero no borrar el grupo entero. */}
        {isAdminViewer && <button onClick={onDelete} title="Eliminar grupo" style={iconGhost}><Trash2 size={16} color="#C23B32" /></button>}
      </div>
      <div style={{ borderRadius: 12, background: `linear-gradient(135deg, ${ministry.color}33, #EEF1F6)`, padding: 20, marginBottom: 20 }}>
        {isAdminViewer ? (
          <input
            value={ministry.name} onChange={(e) => onSetName(e.target.value)}
            style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 8, border: "none", background: "transparent", outline: "none", width: "100%", padding: 0 }}
          />
        ) : (
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{ministry.name}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#33415A", marginBottom: isAdminViewer ? 10 : 0 }}>
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
        {isAdminViewer && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {MINISTRY_COLORS.map((c) => (
              <button key={c} onClick={() => onSetColor(c)} title="Color del grupo" style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: ministry.color === c ? "2px solid #16233A" : "1px solid rgba(0,0,0,0.15)", cursor: "pointer" }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><ClipboardList size={15} color={ministry.color} /> Planificación del mes</div>
        {canEdit && <button onClick={addDraftPlanItem} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar fecha</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {planDraft.map((p) => (
          <div key={p.id} style={{ background: "#FFFFFF", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input type="date" disabled={!canEdit} title="Fecha del domingo (o día) al que corresponde esta planificación" value={p.date || ""} onChange={(e) => updateDraftPlanItem(p.id, "date", e.target.value)} style={{ ...inputStyle, width: 150, fontSize: 12, fontWeight: 700, flexShrink: 0 }} />
              <input disabled={!canEdit} value={p.title} onChange={(e) => updateDraftPlanItem(p.id, "title", e.target.value)} placeholder="Título de la semana" style={{ ...inputStyle, flex: 1, fontWeight: 700 }} />
              {canEdit && <button onClick={() => removeDraftPlanItem(p.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>}
            </div>
            <textarea disabled={!canEdit} value={p.detail} onChange={(e) => updateDraftPlanItem(p.id, "detail", e.target.value)} placeholder="Detalle, recursos necesarios, responsables..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        ))}
        {planDraft.length === 0 && <div style={{ color: "#8996A6", fontSize: 13 }}>Aún no hay planificación este mes.</div>}
      </div>
      {/* Nada de lo de arriba se guarda solo — a propósito, para no disparar un guardado por cada tecla
          (ver el comentario junto al estado planDraft). Este botón es el único momento en que se manda
          todo a Supabase de una vez. */}
      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <button onClick={savePlan} disabled={!planDirty || savingPlan} className="hoverable" style={{ ...primaryBtn, width: "auto", padding: "9px 18px", opacity: planDirty && !savingPlan ? 1 : 0.5, cursor: planDirty && !savingPlan ? "pointer" : "default" }}>
            {savingPlan ? "Guardando…" : "Guardar planificación"}
          </button>
          {planDirty && !savingPlan && <span style={{ fontSize: 11, color: "#E8821E", fontWeight: 700 }}>● Cambios sin guardar</span>}
        </div>
      )}

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
  // "todos" + las 4 clasificaciones reales de SONG_CATEGORIES — así si el día de mañana se agrega una
  // clasificación nueva ahí, aparece sola acá también, sin tener que acordarse de tocar dos lugares.
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const filtered = library
    .filter((s) => categoryFilter === "todos" || s.category === categoryFilter)
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>{library.length} Canciones</h2>
        {isAdminViewer && <button onClick={onNew} style={{ ...iconGhost, width: 30, height: 30, background: "#EEF1F6", border: "1px solid #C7D0DD" }}><Plus size={16} /></button>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
        <Search size={15} color="#8996A6" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título o letra" style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 13, width: "100%" }} />
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
        {[["todos", "Todos"], ...Object.entries(SONG_CATEGORIES).map(([key, c]) => [key, c.label])].map(([key, label]) => (
          <button key={key} onClick={() => setCategoryFilter(key)} style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 20, border: categoryFilter === key ? "2px solid #E8821E" : "1px solid #C7D0DD", background: categoryFilter === key ? "#FFF4E8" : "#FFFFFF", color: "#16233A", cursor: "pointer" }}>{label}</button>
        ))}
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
// Antes esto armaba UNA sola l\u00EDnea monoespaciada por rengl\u00F3n (acordes arriba, letra abajo, alineados
// por car\u00E1cter con espacios de relleno) \u2014 perfecto para alinear, pero una l\u00EDnea larga nunca se
// achicaba: en el celular se sal\u00EDa del cuadro y quedaba cortada. Tocando en vivo (guitarra/bajo/piano)
// nadie puede estar arrastrando el dedo para ver el resto de cada l\u00EDnea. La soluci\u00F3n real es la que
// usan las apps de acordes (OnSong, Ultimate Guitar): partir la l\u00EDnea en PALABRAS, cada una con su
// propio acorde encima como una unidad chica independiente, y dejar que esas unidades se acomoden en
// varios renglones (flexWrap) seg\u00FAn el ancho real de la pantalla \u2014 el acorde nunca se separa de su
// palabra aunque el conjunto salte de l\u00EDnea, y no hace falta deslizar nada.
function ChordsAboveLyrics({ raw, semitones = 0 }) {
  const transposed = transposeLine(raw, semitones);
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
            <span style={{ color: "#16233A" }}>{plain || "\u00A0"}</span>
          </span>
        );
      })}
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

function SongView({ song, isAdminViewer, onBack, onEdit, onTranspose, onDelete, onPrev, onNext, positionLabel, enterDirection, structureOverride, liveSync }) {
  const sectionRefs = useRef({});
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

  // ---- Capo: sube/baja medio tono a la vez SOLO en lo que ve este dispositivo — a diferencia de
  // "Transportar" (arriba, solo administradores, cambia la tonalidad guardada de la canción para
  // TODOS), esto es del músico. Como un capo FÍSICO: nadie se lo quita de la guitarra al pasar a la
  // siguiente canción del set, así que antes de esto se guardaba solo en memoria (useState) y se
  // perdía cada vez que este componente se desmontaba — al cambiar de canción en Modo Músico, o al
  // salir de la canción y volver a entrar. Ahora se guarda en este dispositivo (mismo mecanismo que
  // el idioma de la Biblia en vivo) y sigue puesto hasta que el músico mismo lo quite.
  const [capoSemitones, setCapoSemitones] = useState(() => loadCache("capo_semitones") || 0);
  useEffect(() => { saveCache("capo_semitones", capoSemitones); }, [capoSemitones]);
  const capoResultKey = song && capoSemitones ? transposeChordToken(song.key, capoSemitones) : null;

  // ---- Fuera de una transmisión en vivo (repaso/ensayo): sigue igual que siempre — cualquiera que
  // tenga la MISMA canción abierta se sincroniza por un canal ad-hoc (song.id), sin un líder fijo,
  // "cualquiera que ajuste algo se transmite a los demás". ----
  const musicoChannelRef = useRef(null);
  useEffect(() => {
    if (!song || liveSync?.active) return; // en vivo usa musico_en_vivo (líder/seguidor), no este canal
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
  }, [song?.id, liveSync?.active]);
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
  const isFollowingNow = otherLeaderFresh && liveSync.state.songItemId === liveSync.itemId;

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
    if (!otherLeaderFresh) return;
    const state = liveSync.state;
    if (state.songItemId !== liveSync.itemId) { liveSync.onFollowItem(state.songItemId); return; }
    setCurrentSectionIdx(state.sectionIdx || 0);
    indexRefs.current[state.sectionIdx || 0]?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherLeaderFresh, liveSync?.state?.sectionIdx, liveSync?.state?.songItemId]);

  const goToSectionIdx = (i) => {
    const clamped = Math.max(0, Math.min(order.length - 1, i));
    setCurrentSectionIdx(clamped);
    indexRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (isLeaderMe) liveSync.onUpdate({ sectionIdx: clamped, heartbeat: new Date().toISOString() });
    else if (!isLive) broadcastMusico({ currentSectionIdx: clamped }); // seguidor: solo local, no transmite nada
  };
  const toggleAutoMode = () => {
    if (isFollowingNow) return; // ya estoy siguiendo esta misma canción del líder: nada que alternar
    if (isLive && otherLeaderFresh) {
      // Hay un líder activo, pero en OTRA canción (no la que tengo abierta ahora): unirme como seguidor
      // y saltar a la suya — si no, "isLeaderMe" seguiría en falso y este botón terminaría robándole el
      // mando a quien ya está liderando, solo por estar viendo una canción distinta en ese momento.
      setCurrentSectionIdx(liveSync.state.sectionIdx || 0);
      liveSync.onFollowItem(liveSync.state.songItemId);
      return;
    }
    if (isLive && !isLeaderMe) {
      // Nadie es líder ahora mismo (o quedó viejo/caído): este dispositivo toma el mando. Sin BPM/auto:
      // en vivo el avance es 100% manual, "espejo" de lo que el líder toque.
      liveSync.onUpdate({ liderId: liveSync.deviceId, songItemId: liveSync.itemId, sectionIdx: currentSectionIdx, heartbeat: new Date().toISOString() });
      return;
    }
    if (isLeaderMe) return; // ya soy el líder — no hay on/off que alternar, solo se avanza con ‹›/pills
    // Fuera de vivo: comportamiento clásico (auto-avance por BPM/compases).
    const next = !autoMode;
    setAutoMode(next);
    broadcastMusico({ autoMode: next });
  };
  const handleTap = () => {
    if (isLive) return; // TAP tempo ya no aplica en vivo — ahí todo es manual/espejo, sin BPM
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
    if (!autoMode || !song || isLive) return; // en vivo no hay avance por tiempo — todo es manual (líder) o reflejo (seguidor)
    const key = order[currentSectionIdx];
    const block = song.blocks[key];
    if (!block) return;
    const beatsPerBar = 4;
    const durationMs = Math.max(1500, ((block.bars || 8) * beatsPerBar / liveBpm) * 60000);
    const timer = setTimeout(() => {
      if (currentSectionIdx >= order.length - 1) { setAutoMode(false); broadcastMusico({ autoMode: false }); return; } // se acabó la canción
      goToSectionIdx(currentSectionIdx + 1);
    }, durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, currentSectionIdx, liveBpm, order, song, isLive]);
  if (!song) return null;
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, background: (autoMode || isLeaderMe) ? "#FFF4E8" : "#F4F6FA", border: `1px solid ${(autoMode || isLeaderMe) ? "#E8821E" : "#DDE3ED"}`, borderRadius: 12, padding: "8px 10px", marginBottom: 16, flexWrap: "wrap" }}>
        {isFollowingNow ? (
          // Seguidor: la sección la decide el líder — acá solo se avisa que se está siguiendo, en vez de
          // un botón que de todos modos no haría nada.
          <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8821E", color: "#16233A", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
            <Radio size={13} /> Siguiendo al líder
          </span>
        ) : isLeaderMe ? (
          // Líder en vivo: no hay on/off que alternar — se avanza a mano con ‹›/pills, cada toque se
          // refleja al instante en todos los seguidores (espejo, sin BPM/compases de por medio).
          <span style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8821E", color: "#16233A", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>
            <Radio size={13} /> Eres el líder
          </span>
        ) : (
          <button onClick={toggleAutoMode} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 6, background: autoMode ? "#E8821E" : "#FFFFFF", color: autoMode ? "#16233A" : "#16233A", border: "1px solid #C7D0DD", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {autoMode ? <><Radio size={13} /> Modo Músico: ON</> : <><Play size={13} /> Modo Músico</>}
          </button>
        )}
        <button onClick={() => goToSectionIdx(currentSectionIdx - 1)} disabled={currentSectionIdx === 0} style={{ ...iconGhost, opacity: currentSectionIdx === 0 ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
        <button onClick={() => goToSectionIdx(currentSectionIdx + 1)} disabled={currentSectionIdx >= order.length - 1} style={{ ...iconGhost, opacity: currentSectionIdx >= order.length - 1 ? 0.4 : 1 }}><ChevronRight size={16} /></button>
        {/* TAP tempo y el bpm ya no aplican en vivo — ahí no hay compases/BPM, solo el líder avanzando a
            mano y todos reflejándolo. */}
        {!isLive && (
          <>
            <button onClick={handleTap} className="hoverable" style={{ background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "#16233A", cursor: "pointer" }}>TAP</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64707F" }}>{liveBpm} bpm</span>
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "3px 4px", marginLeft: "auto" }} title="Sube o baja medio tono a la vez, como mover un capo — no cambia la tonalidad guardada de la canción, solo cómo la ves en este dispositivo.">
          <button onClick={() => setCapoSemitones((s) => s - 1)} className="hoverable" style={{ ...iconGhost, width: 22, height: 22 }}><Minus size={12} /></button>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#16233A", minWidth: 74, textAlign: "center" }}>
            Capo {capoSemitones > 0 ? `+${capoSemitones}` : capoSemitones}{capoResultKey ? ` (${capoResultKey})` : ""}
          </span>
          <button onClick={() => setCapoSemitones((s) => s + 1)} className="hoverable" style={{ ...iconGhost, width: 22, height: 22 }}><Plus size={12} /></button>
          {capoSemitones !== 0 && (
            <button onClick={() => setCapoSemitones(0)} title="Quitar capo" className="hoverable" style={{ ...iconGhost, width: 22, height: 22 }}><RefreshCw size={11} /></button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {blockKeys.map((key) => {
          const b = song.blocks[key];
          const color = badgeColor(b.badge);
          return (
            <button key={key} onClick={() => { scrollTo(key); goToSectionIdx(order.indexOf(key)); }} className="hoverable" style={{ width: 40, height: 40, borderRadius: "50%", border: `1.5px solid ${color}`, background: "transparent", color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {b.badge}
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
            style={{ marginBottom: 16, borderRadius: 10, outline: isActive ? "2px solid #E8821E" : "none", outlineOffset: 3, cursor: "pointer" }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${color}22`, borderRadius: 20, padding: "5px 12px", marginBottom: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.badge}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{b.label}</span>
            </div>
            <div style={{ background: isActive ? "#FFF4E8" : "#EEF1F6", borderRadius: 10, padding: 16 }}>
              {b.lines.map((l, i2) => <ChordsAboveLyrics key={i2} raw={l} semitones={capoSemitones} />)}
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
      {/* TEMPORAL — diagnóstico del bug "el seguidor no cambia de canción con el líder": se quita apenas
          esté resuelto. Muestra en pantalla lo que este dispositivo tiene guardado de musico_en_vivo. */}
      {isLive && (
        <div style={{ marginTop: 16, padding: 8, background: "#F4F6FA", borderRadius: 8, fontSize: 9, color: "#8996A6", fontFamily: "monospace", wordBreak: "break-all" }}>
          DEBUG rol={isLeaderMe ? "líder" : isFollowingNow ? "seguidor" : otherLeaderFresh ? "seguidor(canción distinta)" : "sin rol"} · miItem={liveSync?.itemId} · liderId={liveSync?.state?.liderId || "ninguno"} · liderCancion={liveSync?.state?.songItemId || "—"} · heartbeat={liveSync?.state?.heartbeat || "—"}
        </div>
      )}
    </div>
  );
}

// Catálogo estilo OnStage para agregar varias secciones de una — la lista de tipos (Estrofa, Coro...)
// se muestra sin numerar hasta que se marca la primera; a partir de ahí cada tipo va "creciendo" de a
// una repetición por vez (marcar Estrofa 1 revela Estrofa 2, marcar esa revela Estrofa 3...), en vez de
// mostrar de entrada un número fijo de repeticiones que probablemente no coincida con la canción real.
function AddSectionsModal({ onClose, onAdd }) {
  const [query, setQuery] = useState("");
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
      for (let n = 1; n <= count; n++) toAdd.push({ badge: `${t.prefix}${n}`, label: `${t.label} ${n}` });
    });
    if (toAdd.length === 0) return;
    submittedRef.current = true;
    onAdd(toAdd);
    onClose();
  };
  return (
    <ModalShell title="Añadir nuevas secciones" icon={ListMusic} color="#2F5FA8" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
        <Search size={13} color="#8996A6" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar una nueva sección" style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 12, width: "100%" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflowY: "auto", marginBottom: 12 }}>
        {filteredTypes.map((t) => {
          const count = checkedCounts[t.id] || 0;
          const color = badgeColor(t.prefix);
          const revealed = Math.min(count + 1, 12); // tope generoso — ninguna canción real necesita más
          return Array.from({ length: revealed }, (_, i) => {
            const n = i + 1;
            const isChecked = n <= count;
            const showNumber = revealed > 1; // con una sola instancia a la vista, se ve "Estrofa" pelado
            return (
              <button
                key={`${t.id}-${n}`}
                onClick={() => toggleInstance(t.id, n)}
                className="hoverable"
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: isChecked ? `${color}18` : "#FFFFFF", border: isChecked ? `1.5px solid ${color}` : "1px solid #DDE3ED", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
              >
                <span style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {showNumber ? `${t.prefix}${n}` : t.prefix}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#16233A" }}>{showNumber ? `${t.label} ${n}` : t.label}</span>
                {isChecked ? <Check size={16} color={color} /> : <span style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid #C7D0DD" }} />}
              </button>
            );
          });
        })}
        {filteredTypes.length === 0 && <div style={{ color: "#8996A6", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No hay secciones que coincidan.</div>}
      </div>
      <button onClick={confirm} disabled={totalChecked === 0} style={{ ...primaryBtn, opacity: totalChecked === 0 ? 0.4 : 1, cursor: totalChecked === 0 ? "not-allowed" : "pointer" }}>
        Agregar{totalChecked > 0 ? ` (${totalChecked})` : ""}
      </button>
    </ModalShell>
  );
}

function SongEditor({ song, isAdminViewer, onCancel, onSave, onDirtyChange, draftGetterRef }) {
  const canEditKey = isAdminViewer || !song;
  const initialSnapshotRef = useRef(song ? JSON.stringify(song) : JSON.stringify(blankSong()));
  const [draft, setDraft] = useState(() => JSON.parse(initialSnapshotRef.current));
  const [subTab, setSubTab] = useState("detalles"); // detalles | contenido | letra | estructura
  const [activeBlockKey, setActiveBlockKey] = useState(null);
  const [chordMode, setChordMode] = useState("triadas"); // triadas | septimas
  const [showAddSections, setShowAddSections] = useState(false);
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
  // Se permite borrar incluso la última diapositiva de una sección (queda con 0) — por ejemplo,
  // secciones que no llevan letra en pantalla (instrumental, respiro) y no deben proyectar nada.
  const removeSlide = (key, slideIdx) => setDraft((d) => {
    const group = [...d.letra[key]];
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
    <div style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      {/* Fijo al hacer scroll: así "Guardar" queda siempre a mano después de agregar bloques, acordes
          o diapositivas más abajo, sin tener que volver a subir hasta el principio. */}
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#F4F6FA", paddingBottom: 10, marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onCancel} style={iconGhost}><ArrowLeft size={16} /></button>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 }}>{song ? "Editar canción" : "Nueva canción"}</span>
          </div>
          <button disabled={!canSave || isSaving} onClick={handleSaveClick} style={{ ...primaryBtn, width: "auto", padding: "8px 18px", opacity: canSave && !isSaving ? 1 : 0.4, cursor: canSave && !isSaving ? "pointer" : "not-allowed" }}>{isSaving ? "Guardando…" : "Guardar"}</button>
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
        <div style={{ paddingBottom: draft.key ? 166 : 0 }}>
          <div style={{ fontSize: 12, color: "#64707F", marginBottom: 14 }}>Escribe la letra con los acordes en formato <code style={{ color: "#1F8A73" }}>[Acorde]</code> justo antes de la sílaba, o toca un acorde de la barra de abajo para insertarlo donde esté el cursor. Esto es lo que ve el músico.</div>

          {!draft.key && (
            <div style={{ fontSize: 12, color: "#8996A6", marginBottom: 14 }}>Elige una tonalidad en "Detalles" para ver aquí los acordes que puedes usar.</div>
          )}

          {blockKeys.length === 0 && (
            <div style={{ textAlign: "center", color: "#8996A6", fontSize: 13, padding: "40px 0" }}>
              No se añadieron secciones,{" "}
              <button onClick={() => setShowAddSections(true)} style={{ background: "none", border: "none", color: "#2F5FA8", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>añadir secciones</button>
            </div>
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
          {blockKeys.length > 0 && (
            <button onClick={() => setShowAddSections(true)} className="hoverable" style={addBtnStyle}><Plus size={14} /> Agregar secciones</button>
          )}
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
                  {slideGroup.length === 0 && (
                    <button onClick={() => addSlide(key, -1)} className="hoverable" style={{ ...addBtnStyle, justifyContent: "center" }}><Plus size={13} /> Agregar diapositiva</button>
                  )}
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

      {/* Barra de acordes: fija arriba de la nav, como una barra de accesorios de teclado (estilo
          OnStage). No vive en el flujo normal a propósito — así el scroll de las secciones de la
          canción nunca la arrastra, y siempre queda lista para tocar un acorde. Se desliza en
          horizontal con el dedo (overflowX) en vez de envolver en varias líneas. */}
      {subTab === "contenido" && draft.key && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "var(--bottom-nav-height, 78px)", background: "#FFFFFF", borderTop: "1px solid #DDE3ED", boxShadow: "0 -4px 14px rgba(22,50,79,0.1)", padding: "8px 0 10px", zIndex: 45 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64707F" }}>ACORDES DE {draft.key.toUpperCase()}</div>
              <div style={{ display: "flex", gap: 3, background: "#EEF1F6", padding: 2, borderRadius: 6 }}>
                {[["triadas", "Triadas"], ["septimas", "Con séptima"]].map(([val, label]) => (
                  <button key={val} onClick={() => setChordMode(val)} style={{ fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 5, border: "none", cursor: "pointer", background: chordMode === val ? "#1F8A73" : "transparent", color: chordMode === val ? "#0D1410" : "#64707F" }}>{label}</button>
                ))}
              </div>
            </div>
            <div className="chordbar-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
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
        </div>
      )}
      {showAddSections && <AddSectionsModal onClose={() => setShowAddSections(false)} onAdd={addSections} />}
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

function EventList({ events, plantillas, isAdminViewer, liveEventId, liveLibre, onSelect, onCreate, canStartLive, onStartFree, library, myUserId }) {
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
  // Tocar una plantilla en la lista NO debe abrirla como si fuera un evento ya decidido, ni pasar por
  // un formulario/modal intermedio — clona la plantilla de una vez como evento real (autoguardado,
  // igual que cualquier otro cambio en esta app) y navega directo a su pantalla completa: Setlist ya
  // cargado y editable ahí mismo, título/fecha/hora editables en Ajustes sin ventanas emergentes.
  // Editar el contenido propio de la plantilla (su Setlist base) sigue siendo el lápiz aparte en cada fila.
  const useTemplate = (pl) => {
    onCreate({ templateId: pl.id, title: pl.title, dateLabel: "", date: null, hora: null, location: pl.location || "Por definir", esPlantilla: false });
  };
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
          <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 16, padding: 10, marginBottom: 10 }}>
            <button onClick={() => useTemplate(pl)} className="hoverable" title="Crear un evento con esta base" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", borderRadius: 10, padding: 4, cursor: "pointer" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "#EEF1F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ListMusic size={16} color="#5661B3" /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.title}</div>
                <div style={{ fontSize: 11, color: "#8996A6" }}>{pl.serviceOrder.length} elementos · toca para crear un evento</div>
              </div>
            </button>
            <button onClick={() => onSelect(pl.id)} className="hoverable" title="Editar el contenido de la plantilla" style={{ ...iconGhost, flexShrink: 0 }}>
              <Pencil size={15} color="#5661B3" />
            </button>
          </div>
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

      {canStartLive && (
        <button onClick={onStartFree} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: liveLibre ? "#FFF4E8" : "#FFFFFF", border: liveLibre ? "1px solid #E8821E" : "none", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 14, padding: "12px 14px", marginBottom: 16, cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: liveLibre ? "#E8821E" : "#EEF1F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Radio size={16} color={liveLibre ? "#fff" : "#C23B32"} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{liveLibre ? "Transmisión libre en vivo" : "Transmitir sin evento"}</div>
            <div style={{ fontSize: 11, color: "#8996A6" }}>{liveLibre ? 'Toca "En vivo" abajo para controlarla' : "Para anuncios, oración u otro contenido suelto sin un evento planificado"}</div>
          </div>
        </button>
      )}

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
              {(() => {
                const misCargos = misAsignacionesEnEvento(hero, myUserId, library);
                return misCargos.length > 0 ? (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 8, background: "rgba(255,255,255,0.18)", borderRadius: 8, padding: "4px 8px", display: "inline-block" }}>
                    Te toca: {misCargos.join(", ")}
                  </div>
                ) : null;
              })()}
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
        const misCargos = misAsignacionesEnEvento(ev, myUserId, library);
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
              {misCargos.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#E8821E", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Te toca: {misCargos.join(", ")}
                </div>
              )}
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
  isDraftFromTemplate, onPublish,
  onAddSong, onAddSeccion, onAddBibleClick, onAddSlideClick, onRemove, onDuplicate, onReorder,
  onLinkMinistry, onUpdateSeccionText, onSetSongKey, canAddBibleReading, canAddSermonPoints,
  onAddEncargado, onSetEncargadoStatus, onSetEncargadoLead, onRemoveEncargado,
  onAddWorshipRole, onRemoveWorshipRole, onAddWorshipRoleMember, onSetWorshipRoleMemberStatus, onSetWorshipRoleMemberLead, onRemoveWorshipRoleMember,
  onViewMinistry, onOpenSong, onAddReminder, onRemoveReminder, onSetHora, onUpdateEventDetails,
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
  // Editar título/fecha/hora/ubicación DESPUÉS de creado — antes solo se fijaban una vez al crear el
  // evento/la plantilla y no había forma de corregirlos. Pantalla completa "Ajustes del evento"
  // (separada del Setlist), guarda en vivo campo por campo — mismo patrón que ya usa el título de
  // cada bloque del Setlist (onChange directo, sin botón "Guardar" ni validación bloqueante).
  const [showEventSettings, setShowEventSettings] = useState(false);
  const patchEvent = (patch) => onUpdateEventDetails({ title: event.title, dateLabel: event.dateLabel || "", date: event.date || null, hora: event.hora || null, location: event.location || "", ...patch });

  // "Ya vi mis asignaciones de este evento" — a propósito NO se marca solo con abrir el evento (eso
  // marcaba a alguien como "visto" aunque hubiera entrado por otra razón y nunca se hubiera fijado en
  // qué le tocaba a ella). Se marca cuando la persona misma toca el aviso "Te toca: ..." de abajo — un
  // gesto que sí implica que se fijó en su propio cargo. Distinto de "confirmado/pendiente/rechazado"
  // (eso lo cambia el admin a mano); esto lo dispara la propia persona, y es lo que le deja al admin ver
  // quién de verdad se enteró de lo que le toca.
  const misCargos = misAsignacionesEnEvento(event, userId, library);
  const yaVistoPorMi = (event.vistas || []).some((v) => v.usuarioId === userId);
  const [justMarkedVisto, setJustMarkedVisto] = useState(false);
  const marcarMisAsignacionesVistas = () => {
    if (yaVistoPorMi || justMarkedVisto) return;
    setJustMarkedVisto(true);
    marcarAsignacionVista(event.id, userId).catch(() => setJustMarkedVisto(false));
  };

  if (showEventSettings) {
    return (
      <div className="screen-enter" style={{ width: "100%", flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: 20, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => setShowEventSettings(false)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "4px 6px 4px 0", borderRadius: 8 }}>
              <ArrowLeft size={18} color="#16233A" />
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#16233A" }}>Ajustes del evento</span>
            </button>
            {isAdminViewer && (
              <button onClick={() => onDelete(event)} title="Eliminar evento" style={iconGhost}>
                <Trash2 size={16} color="#C23B32" />
              </button>
            )}
          </div>

          <Field label={event.esPlantilla ? "Nombre de la plantilla" : "Nombre del evento"}>
            <input value={event.title} onChange={(e) => patchEvent({ title: e.target.value })} style={inputStyle} />
          </Field>

          {!event.esPlantilla && (
            <>
              <div style={{ marginTop: 14 }}>
                <Field label="Ubicación del evento">
                  <input value={event.location || ""} onChange={(e) => patchEvent({ location: e.target.value })} placeholder="Ej. Pastores, Sacatepéquez" style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Fecha">
                    <input type="date" value={event.date || ""} onChange={(e) => patchEvent({ date: e.target.value || null })} style={inputStyle} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Hora">
                    <input type="time" value={event.hora || ""} onChange={(e) => patchEvent({ hora: e.target.value || null })} style={inputStyle} />
                  </Field>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Field label="Hora o nota (opcional)">
                  <input value={event.dateLabel || ""} onChange={(e) => patchEvent({ dateLabel: e.target.value })} placeholder="Ej. 10:00 am" style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {isAdminViewer && (
            <div style={{ marginTop: 22, background: "#FFFFFF", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><Bell size={14} color="#E8821E" /> Recordatorios</div>
                <button onClick={() => setShowReminderForm(true)} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: event.esPlantilla ? 0 : 10 }}>
                {(event.reminders || []).length === 0 && <div style={{ color: "#8996A6", fontSize: 12 }}>Sin recordatorios configurados{event.esPlantilla ? " en esta plantilla" : ""}.</div>}
                {(event.reminders || []).map((r) => (
                  <span key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 12, fontWeight: 600 }}>
                    {r.cantidad} {r.unidad === "horas" ? (r.cantidad === 1 ? "hora" : "horas") : (r.cantidad === 1 ? "día" : "días")} antes
                    <button onClick={() => onRemoveReminder(r.id)} style={{ ...iconGhost, width: 18, height: 18 }}><X size={11} /></button>
                  </span>
                ))}
              </div>
              {!event.esPlantilla && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>HORA DEL EVENTO</span>
                    <input type="time" value={event.hora || ""} onChange={(e) => onSetHora(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12 }} />
                  </div>
                  {!event.hora && <div style={{ fontSize: 11, color: "#8996A6", marginTop: 6 }}>Sin hora definida, los recordatorios "por horas" no se pueden calcular con precisión.</div>}
                </>
              )}
            </div>
          )}
        </div>

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

  return (
    <div className="screen-enter" style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 0", maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
          {isAdminViewer && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowEventSettings(true)} title={event.esPlantilla ? "Ajustes de la plantilla" : "Ajustes del evento"} style={iconGhost}>
                <Settings size={16} color="#16324F" />
              </button>
              <button onClick={() => onDelete(event)} title="Eliminar evento" style={iconGhost}>
                <Trash2 size={16} color="#C23B32" />
              </button>
            </div>
          )}
        </div>
        <div style={{ borderRadius: 12, background: "linear-gradient(135deg, #2A3B4D, #EEF1F6)", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "inline-block", background: event.esPlantilla ? "#5661B3" : "rgba(0,0,0,0.35)", borderRadius: 20, padding: "4px 12px", fontSize: 12, marginBottom: 10 }}>
            {event.esPlantilla ? "PLANTILLA" : (formatFullDate(event.date) || "Sin fecha") + (event.dateLabel ? ` · ${event.dateLabel}` : "")}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{event.title}</div>
          {!event.esPlantilla && <div style={{ fontSize: 13, color: "#C8CDD6" }}>{event.location}</div>}
        </div>

        {/* Solo para quien tiene algo asignado en este evento — tocarlo (no basta con solo abrir el
            evento) es lo que le avisa al admin que la persona de verdad se fijó en su propio cargo, no
            solo que entró por curiosidad o por otra razón. Ver marcarMisAsignacionesVistas arriba.
            Antes decía solo "Te toca: X" sin más — para gente que recién está aprendiendo a usar una
            app, eso no se lee como "hay que tocar esto", parece solo un letrero informativo. Ahora,
            mientras no lo haya tocado, el texto GRANDE es una instrucción directa ("Toca aquí..."), con
            el detalle de qué le toca como texto más chico debajo — y una flecha, como cualquier botón
            de "siguiente" que ya conocen de otras pantallas. Una vez tocado, cambia a una confirmación
            clara en vez de repetir la misma instrucción. */}
        {misCargos.length > 0 && (
          <button
            onClick={marcarMisAsignacionesVistas}
            className="hoverable"
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: (yaVistoPorMi || justMarkedVisto) ? "#EAF6F1" : "#FFF4E8", border: `1.5px solid ${(yaVistoPorMi || justMarkedVisto) ? "#1F8A73" : "#E8821E"}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, cursor: "pointer" }}
          >
            {(yaVistoPorMi || justMarkedVisto) ? <Eye size={20} color="#1F8A73" style={{ flexShrink: 0 }} /> : <EyeOff size={20} color="#8A4F0E" style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1, minWidth: 0 }}>
              {(yaVistoPorMi || justMarkedVisto) ? (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1F8A73" }}>Ya viste tu participación ✓</div>
                  <div style={{ fontSize: 12, color: "#33415A", marginTop: 2 }}>Te toca: {misCargos.join(", ")}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#8A4F0E" }}>Toca aquí para ver tu participación</div>
                  <div style={{ fontSize: 12, color: "#8A4F0E", marginTop: 2 }}>Te toca: {misCargos.join(", ")}</div>
                </>
              )}
            </span>
            {!(yaVistoPorMi || justMarkedVisto) && <ChevronRight size={18} color="#E8821E" style={{ flexShrink: 0 }} />}
          </button>
        )}

        <button onClick={() => window.print()} className="hoverable" style={{ ...addBtnStyle, marginBottom: 16, justifyContent: "center" }}>
          <Download size={14} color="#16324F" /> Exportar Setlist a PDF
        </button>

        {/* Oculta en pantalla (ver .print-only en index.css) — solo aparece al imprimir/"Guardar como
            PDF", como respaldo en papel del Setlist si algún día falla la app o el internet en pleno culto. */}
        <div className="print-only" style={{ padding: 28, fontFamily: "'Poppins', sans-serif", color: "#111" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 2 }}>{event.title}</div>
          <div style={{ fontSize: 12, color: "#444", marginBottom: 20 }}>
            {(formatFullDate(event.date) || event.dateLabel || "")}{event.hora ? ` · ${event.hora}` : ""}
          </div>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {event.serviceOrder.map((item) => {
              if (item.type === "seccion") {
                const names = isWorshipBlock(item)
                  ? (event.worshipRoles || []).flatMap((r) => r.members.map((m) => `${m.n} (${r.name})`)).join(", ")
                  : (item.encargados || []).map((m) => m.n).join(", ");
                return (
                  <li key={item.id} style={{ marginBottom: 10, fontSize: 14 }}>
                    <strong>{item.title}</strong>{item.description ? ` — ${item.description}` : ""}
                    {names && <div style={{ fontSize: 12, color: "#444" }}>Encargado(s): {names}</div>}
                  </li>
                );
              }
              if (item.type === "cancion") {
                const song = library.find((s) => s.id === item.songId);
                return (
                  <li key={item.id} style={{ marginBottom: 6, fontSize: 14 }}>
                    {song ? `${song.title} — ${item.keyOverride || song.key}, ${song.tempo} bpm` : "Canción"}
                  </li>
                );
              }
              if (item.type === "biblia") {
                return <li key={item.id} style={{ marginBottom: 6, fontSize: 14 }}>{item.reference} ({item.version})</li>;
              }
              return <li key={item.id} style={{ marginBottom: 6, fontSize: 14 }}>{item.title || "Slide"}{item.subtitle ? ` — ${item.subtitle}` : ""}</li>;
            })}
          </ol>
        </div>

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
      {isDraftFromTemplate && isAdminViewer && (
        <div style={{ padding: "0 20px", maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box", flexShrink: 0 }}>
          <button onClick={onPublish} className="hoverable" style={{ ...primaryBtn, width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#1F8A73", color: "#fff" }}>
            <Check size={15} /> Publicar evento
          </button>
        </div>
      )}
      <SetlistPane
        event={event} library={library} ministries={ministries} isCompact={isCompact} isAdminViewer={isAdminViewer} userId={userId} usuariosReales={usuariosReales}
        onAddSong={onAddSong} onAddSeccion={onAddSeccion}
        onAddBibleClick={onAddBibleClick} onAddSlideClick={onAddSlideClick}
        onRemove={onRemove} onDuplicate={onDuplicate} onReorder={onReorder}
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
function EncargadosList({ encargados, canEdit, allUsuarios, onSetStatus, onSetLead, onAddEncargado, onRemove, vistasPorUsuario, showVistas }) {
  const [addQuery, setAddQuery] = useState("");
  const disponibles = allUsuarios
    .filter((u) => !encargados.some((m) => m.usuarioId === u.id))
    .filter((u) => u.nombre.toLowerCase().includes(addQuery.toLowerCase()));
  return (
    <div>
      {encargados.map((m, i) => {
        const style = STATUS_STYLE[m.status || "pendiente"];
        const StatusIcon = style.icon;
        const vistoAt = m.usuarioId && vistasPorUsuario ? vistasPorUsuario.get(m.usuarioId) : null;
        return (
          <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #DDE3ED" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, color: "#fff" }}>{m.n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
            <span style={{ fontSize: 13, flex: 1 }}>{m.n}{m.lead && <span style={{ fontSize: 10, color: "#E8821E", fontWeight: 700 }}> · Encargado</span>}</span>
            {/* Solo visible para administradores — le dice si la persona siquiera abrió el evento a ver
                qué le toca, algo que "confirmado/pendiente" no puede responder porque ESE estado lo
                cambia el admin a mano, no la persona misma. A propósito NO depende de "canEdit": el
                admin necesita poder chequear esto viendo el Setlist normal, sin tener que entrar al
                modo "Editar" primero solo para consultarlo. */}
            {showVistas && vistasPorUsuario && m.usuarioId && (
              vistoAt
                ? <Eye size={14} color="#1F8A73" title={`Vio sus asignaciones el ${new Date(vistoAt).toLocaleString("es")}`} />
                : <EyeOff size={14} color="#C3CBD6" title="Todavía no ha abierto el evento para ver qué le toca" />
            )}
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
      {/* Tocar el nombre agrega a esa persona de una vez — sin un segundo botón "Añadir" aparte, que
          antes se prestaba a elegir a alguien del selector y no darle a añadir, dejando la impresión
          de que la asignación "no se guardó". */}
      {canEdit && (
        <div style={{ marginTop: 10 }}>
          {allUsuarios.length > 6 && (
            <input value={addQuery} onChange={(e) => setAddQuery(e.target.value)} placeholder="Buscar persona..." style={{ ...inputStyle, marginBottom: 6 }} />
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {disponibles.map((u) => (
              <button key={u.id} onClick={() => { onAddEncargado(u); setAddQuery(""); }} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 5, background: "#EAF0FA", border: "1px solid #C7D0DD", borderRadius: 20, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "#2F5FA8", cursor: "pointer" }}>
                <UserPlus size={12} /> {u.nombre}
              </button>
            ))}
            {disponibles.length === 0 && <div style={{ color: "#8996A6", fontSize: 12 }}>{addQuery ? "Nadie coincide con esa búsqueda." : "No hay más personas disponibles para agregar."}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// Equipo de alabanza: roles con nombre fijo (Guitarra, Batería, Voz...) en vez de una lista libre de
// encargados — el mismo roster se muestra y se edita igual desde el bloque de Alabanza que desde el de
// Adoración (es un solo array compartido a nivel de evento, no una copia por bloque).
function WorshipRolesEditor({ roles, canEdit, allUsuarios, onAddRole, onRemoveRole, onAddMember, onSetStatus, onSetLead, onRemoveMember, vistasPorUsuario, showVistas }) {
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
            vistasPorUsuario={vistasPorUsuario}
            showVistas={showVistas}
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
function SetlistPane({ event, library, ministries, isCompact, isAdminViewer, userId, usuariosReales, onAddSong, onAddSeccion, onAddBibleClick, onAddSlideClick, onRemove, onDuplicate, onReorder, onLinkMinistry, onUpdateSeccionText, onViewMinistry, onOpenSong, onSetSongKey, canAddBibleReading, canAddSermonPoints, onAddEncargado, onSetEncargadoStatus, onSetEncargadoLead, onRemoveEncargado, onAddWorshipRole, onRemoveWorshipRole, onAddWorshipRoleMember, onSetWorshipRoleMemberStatus, onSetWorshipRoleMemberLead, onRemoveWorshipRoleMember, showBibleForm, setShowBibleForm, addBible, showSlideForm, setShowSlideForm, slideDraft, setSlideDraft, addSlide, showSermonForm, setShowSermonForm, sermonPointText, setSermonPointText, addSermonPoint }) {
  // Editar el Setlist (estructura, encargados, equipo de alabanza) es solo de administradores — la
  // única excepción a "solo admin" en todo el Setlist es agregar un versículo, que puede hacerlo además
  // el encargado de ese bloque de Lectura bíblica/Oración (ver canAddBibleReading más arriba).
  // Además de eso, el Setlist se ve de solo lectura (sin agregar/quitar/mover nada) hasta tocar "Editar"
  // — UN SOLO candado para todo (antes Encargados/equipo de alabanza tenían su propio candado por
  // bloque además de este, y era fácil elegir a alguien del selector sin haber destrabado ESE candado
  // aparte, o creer que ya había quedado asignado sin haber tocado "Añadir" — de ahí que pareciera que
  // las asignaciones "se perdían"). Los cambios se siguen guardando solos apenas se hacen; "Guardar"
  // solo regresa a la vista de solo lectura.
  const [editingSetlist, setEditingSetlist] = useState(false);
  const canEditNow = isAdminViewer && editingSetlist;
  const canEditItem = () => canEditNow;
  // usuarioId -> cuándo vio sus asignaciones de ESTE evento (ver marcarAsignacionVista) — se le pasa a
  // cada EncargadosList (bloques, equipo de alabanza) para el ícono de ojo junto a cada persona.
  const vistasPorUsuario = useMemo(() => new Map((event.vistas || []).map((v) => [v.usuarioId, v.vistoAt])), [event.vistas]);
  // La fila de una canción en el buscador se queda ahí, tocable de nuevo, después de agregarla (no
  // desaparece ni se deshabilita) — sin este freno, un doble toque rápido (dedo apurado, sin feedback
  // inmediato de que ya se agregó) la duplicaba o triplicaba en el Setlist. Medio segundo alcanza para
  // frenar un toque accidental sin bloquear a alguien que de verdad quiera repetir la misma canción más
  // adelante en el Setlist (ej. un coro que se canta dos veces).
  const lastAddSongRef = useRef({ id: null, at: 0 });
  const handleAddSong = (songId) => {
    const now = Date.now();
    if (lastAddSongRef.current.id === songId && now - lastAddSongRef.current.at < 600) return;
    lastAddSongRef.current = { id: songId, at: now };
    onAddSong(songId);
  };
  const [query, setQuery] = useState("");
  // Igual que en Canciones: poder ver solo los coros (para armar una cadena de coros seguidos), o solo
  // los himnos disponibles, etc., en vez de buscar a ojo en toda la biblioteca mezclada.
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState("todos");
  const [expandedSections, setExpandedSections] = useState({});
  const [showLibrary, setShowLibrary] = useState(!isCompact);
  const [showSeccionForm, setShowSeccionForm] = useState(false);
  const [seccionDraft, setSeccionDraft] = useState({ title: "", description: "" });
  const confirmAddSeccion = () => {
    if (!seccionDraft.title.trim()) return;
    onAddSeccion(seccionDraft.title, seccionDraft.description);
    setSeccionDraft({ title: "", description: "" });
    setShowSeccionForm(false);
  };
  // Reordenar presionando y arrastrando el ícono de 6 puntos. Antes esto usaba drag-and-drop nativo de
  // HTML5 (draggable + dragstart/dragover/drop) — que los navegadores NO disparan con el dedo en un
  // celular, solo con mouse, así que en el teléfono el arrastre simplemente no hacía nada. Ahora usa
  // Pointer Events (mouse/touch/lápiz unificado, mismo enfoque que el swipe del lector de canciones):
  // se captura el puntero en el ícono al presionar, así se sigue recibiendo el movimiento aunque el
  // dedo se salga de la fila, y se calcula sobre qué fila está el dedo midiendo su posición real en
  // pantalla en vez de depender de eventos de "arrastre" que el navegador no siempre entrega.
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [dragTranslateY, setDragTranslateY] = useState(0);
  const rowRefs = useRef({});
  const dragStartYRef = useRef(0);
  // Limpieza es un privilegio aparte: quien está asignado a un bloque de Limpieza en este evento (y no
  // es administrador) solo ve ESE bloque — nada del resto del Setlist (canciones, otros bloques). Va
  // DESPUÉS de todos los hooks de arriba: un return anticipado antes de un useState rompe las reglas de
  // hooks en cuanto ese mismo componente vuelva a renderizar con myCleaningBlock en falso.
  const myCleaningBlock = !isAdminViewer ? event.serviceOrder.find((it) => isCleaningBlock(it) && (it.encargados || []).some((m) => m.usuarioId === userId)) : null;
  if (myCleaningBlock) {
    return <CleaningOnlyPanel block={myCleaningBlock} />;
  }
  const findRowIndexAtY = (y) => {
    const indices = Object.keys(rowRefs.current).map(Number).sort((a, b) => a - b);
    for (const idx of indices) {
      const el = rowRefs.current[idx];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return idx;
    }
    return indices.length ? indices[indices.length - 1] : 0;
  };
  const dragHandleProps = (idx) => ({
    onPointerDown: (e) => {
      if (!canEditNow) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragStartYRef.current = e.clientY;
      setDragIndex(idx);
      setOverIndex(idx);
      setDragTranslateY(0);
    },
    onPointerMove: (e) => {
      if (dragIndex === null) return;
      setDragTranslateY(e.clientY - dragStartYRef.current);
      setOverIndex(findRowIndexAtY(e.clientY));
    },
    onPointerUp: () => {
      if (dragIndex !== null && overIndex !== null && overIndex !== dragIndex) onReorder(dragIndex, overIndex);
      setDragIndex(null); setOverIndex(null); setDragTranslateY(0);
    },
    onPointerCancel: () => { setDragIndex(null); setOverIndex(null); setDragTranslateY(0); },
    style: { cursor: canEditNow ? "grab" : "default", flexShrink: 0, touchAction: "none" },
  });
  const rowRefProp = (idx) => (el) => { rowRefs.current[idx] = el; };
  const filtered = library
    .filter((s) => libraryCategoryFilter === "todos" || s.category === libraryCategoryFilter)
    .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", flex: 1, minHeight: 0 }}>
      {/* La única excepción que puede seguir agregando sin tocar "Editar" (que ni ve, es de admin): quien
          esté asignado como encargado de un bloque de Lectura bíblica/Oración, agregando su propio
          versículo — igual que ya funcionaba antes de este candado. */}
      {isCompact && (editingSetlist || (!isAdminViewer && canAddBibleReading)) && (
        <button onClick={() => setShowLibrary((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#EEF1F6", border: "none", borderBottom: "1px solid #DDE3ED", padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "#16233A", cursor: "pointer" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><ListMusic size={14} /> Biblioteca y agregar elementos</span>
          {showLibrary ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      )}
      {(showLibrary || !isCompact) && (editingSetlist || (!isAdminViewer && canAddBibleReading)) && (
      <div style={{ width: isCompact ? "100%" : 270, margin: isCompact ? 0 : "14px 0 14px 14px", background: isCompact ? "transparent" : "#fff", boxShadow: isCompact ? "none" : "0 3px 14px rgba(22,50,79,0.09)", borderRadius: isCompact ? 0 : 16, borderBottom: isCompact ? "1px solid #DDE3ED" : "none", padding: 14, boxSizing: "border-box", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", maxHeight: isCompact ? 260 : "55vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64707F", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 10 }}><ListMusic size={13} /> BIBLIOTECA DE CANCIONES</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "7px 10px", marginBottom: 10 }}>
            <Search size={13} color="#8996A6" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 12, width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
            {[["todos", "Todos"], ...Object.entries(SONG_CATEGORIES).map(([key, c]) => [key, c.label])].map(([key, label]) => (
              <button key={key} onClick={() => setLibraryCategoryFilter(key)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 16, border: libraryCategoryFilter === key ? "1.5px solid #E8821E" : "1px solid #C7D0DD", background: libraryCategoryFilter === key ? "#FFF4E8" : "#FFFFFF", color: "#16233A", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {filtered.map((s) => (
            <button key={s.id} onClick={() => handleAddSong(s.id)} className="hoverable" style={{ width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, borderRadius: 8, background: "transparent", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{s.key} · {s.tempo} bpm</div></div>
              <Plus size={15} color="#E8821E" />
            </button>
          ))}
          {filtered.length === 0 && <div style={{ color: "#8996A6", fontSize: 12, padding: "6px 0" }}>Ninguna canción coincide.</div>}
        </div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Setlist</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "#8996A6" }}>{formatFullDate(event.date) || event.dateLabel}</span>
            {isAdminViewer && (
              <button
                onClick={() => setEditingSetlist((v) => !v)}
                className="hoverable"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 14, border: "none", cursor: "pointer", background: editingSetlist ? "#1F8A73" : "#EEF1F6", color: editingSetlist ? "#fff" : "#16233A" }}
              >
                {editingSetlist ? <><Check size={12} /> Guardar</> : <><Pencil size={12} /> Editar</>}
              </button>
            )}
          </div>
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
                key={item.id} ref={rowRefProp(idx)}
                style={{
                  background: "rgba(124,140,216,0.16)", border: overIndex === idx && dragIndex !== null && dragIndex !== idx ? "2px solid #E8821E" : "1px solid #5661B3", borderRadius: 10, padding: "12px 14px", marginBottom: 8,
                  transform: dragIndex === idx ? `translateY(${dragTranslateY}px)` : undefined,
                  position: dragIndex === idx ? "relative" : undefined, zIndex: dragIndex === idx ? 5 : undefined,
                  boxShadow: dragIndex === idx ? "0 10px 24px rgba(22,50,79,0.35)" : undefined,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <GripVertical size={14} color="#5661B3" {...handleProps} style={{ ...handleProps.style, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      value={item.title} onChange={(e) => onUpdateSeccionText(item.id, "title", e.target.value)} readOnly={!canEdit}
                      style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 700, color: "#16233A", width: "100%", padding: 0, fontFamily: "inherit" }}
                    />
                    {linkedMinistry ? (
                      // Solo el título de la planificación acá (no el detalle completo, que sería
                      // ilegible en una sola línea) — tocarlo despliega el bosquejo completo y los
                      // recursos del ministerio abajo, mismo interruptor que el botón de encargados.
                      <div
                        onClick={() => setExpandedSections((e) => ({ ...e, [item.id]: !e[item.id] }))}
                        title={isExpanded ? "Ocultar planificación" : "Ver planificación"}
                        style={{ fontSize: 12, color: "#33415A", marginTop: 2, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{currentPlan ? currentPlan.title : planStatusText}</span>
                        {isExpanded ? <ChevronUp size={12} style={{ flexShrink: 0 }} /> : <ChevronDown size={12} style={{ flexShrink: 0 }} />}
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
                    {canEditNow && (
                      <>
                        <button onClick={() => onDuplicate(item.id)} title="Duplicar" style={iconGhost}><Copy size={14} /></button>
                        <button onClick={() => onRemove(item.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(124,140,216,0.3)" }}>
                    {canEditNow && (
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
                    {/* Bosquejo completo de la semana — el título ya se ve arriba sin desplegar, acá va
                        el detalle completo para quien esté encargado de este bloque. */}
                    {linkedMinistry && currentPlan?.detail && (
                      <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "10px 12px", marginBottom: 10, boxShadow: "0 3px 14px rgba(22,50,79,0.09)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 4 }}>PLANIFICACIÓN DE ESTA SEMANA</div>
                        <div style={{ fontSize: 12.5, color: "#33415A", whiteSpace: "pre-line", lineHeight: 1.5 }}>{currentPlan.detail}</div>
                      </div>
                    )}
                    {/* Recursos del ministerio (enlaces a documentos, videos, etc.) — antes solo se veían
                        entrando al ministerio; ahora quien lleva este bloque los tiene aquí mismo. */}
                    {linkedMinistry && linkedMinistry.resources.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>RECURSOS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {linkedMinistry.resources.map((r) => (
                            <a key={r.id} href={r.link || undefined} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", borderRadius: 8, padding: "8px 10px", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", textDecoration: "none", color: "#16233A", fontSize: 12, fontWeight: 600 }}>
                              <FolderOpen size={13} color="#8996A6" />
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                              {r.link && <ExternalLink size={12} color="#2F5FA8" style={{ flexShrink: 0 }} />}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {isWorshipBlock(item) ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>EQUIPO DE ALABANZA (compartido con Alabanza/Adoración)</div>
                        <WorshipRolesEditor
                          roles={event.worshipRoles || []}
                          canEdit={canEditNow}
                          allUsuarios={usuariosReales}
                          onAddRole={onAddWorshipRole}
                          onRemoveRole={onRemoveWorshipRole}
                          onAddMember={onAddWorshipRoleMember}
                          onSetStatus={onSetWorshipRoleMemberStatus}
                          onSetLead={onSetWorshipRoleMemberLead}
                          onRemoveMember={onRemoveWorshipRoleMember}
                          vistasPorUsuario={vistasPorUsuario}
                          showVistas={isAdminViewer}
                        />
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>ENCARGADOS DE ESTE BLOQUE</div>
                        <EncargadosList
                          encargados={item.encargados || []}
                          canEdit={canEdit}
                          allUsuarios={usuariosReales}
                          onAddEncargado={(usuario) => onAddEncargado(item.id, usuario)}
                          onSetStatus={(mi, status) => onSetEncargadoStatus(item.id, mi, status)}
                          onSetLead={(mi) => onSetEncargadoLead(item.id, mi)}
                          onRemove={(mi) => onRemoveEncargado(item.id, mi)}
                          vistasPorUsuario={vistasPorUsuario}
                          showVistas={isAdminViewer}
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
          const canEdit = canEditItem(idx);
          return (
            <div key={item.id} style={{ marginBottom: 8 }}>
              <div
                ref={rowRefProp(idx)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "#FFFFFF", border: overIndex === idx && dragIndex !== null && dragIndex !== idx ? "2px solid #E8821E" : "none", boxShadow: dragIndex === idx ? "0 10px 24px rgba(22,50,79,0.35)" : "0 3px 14px rgba(22,50,79,0.09)",
                  transform: dragIndex === idx ? `translateY(${dragTranslateY}px)` : undefined,
                  position: dragIndex === idx ? "relative" : undefined, zIndex: dragIndex === idx ? 5 : undefined,
                }}
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
                {/* Asignar encargados (Encargados) es solo de bloques — una canción/versículo/slide
                    individual ya no lo ofrece, no tiene sentido asignar una persona "responsable" de
                    proyectar una diapositiva puntual. */}
                {canEditNow && (
                  <div style={{ display: "flex", gap: 2 }}>
                    <button onClick={() => onDuplicate(item.id)} title="Duplicar" style={iconGhost}><Copy size={14} /></button>
                    <button onClick={() => onRemove(item.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
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
// La API devuelve <mark> alrededor de las palabras encontradas y a veces <br> dentro del texto (saltos de
// línea de poesía) — se limpia para mostrarlo como texto plano, igual que el resto de la app.
const stripBibleSearchMarkup = (text) => text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// Quita tildes/diacríticos para comparar sin importar si se escribieron o no (ej. "oracion" debe
// encontrar "oración"). NFD separa la tilde como marca combinante aparte y este regex la descarta.
const foldAccents = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Busca la FRASE (no palabras sueltas) dentro del texto de los versículos de una versión — para cuando
// el operador solo recuerda un pedazo de una cita y necesita encontrarla rápido en vivo, sin saber en qué
// libro/capítulo está. La API (bolls.life) solo ignora tildes en su modo "por palabra" (sin match_whole);
// su modo de frase exacta (match_whole=true) SÍ distingue tildes, así que se pide en modo por palabra
// (más resultados, pero cualquier verso con la frase exacta queda adentro sí o sí) y la frase exacta —
// sin importar tildes de ningún lado — se filtra acá mismo, sobre esos resultados.
async function searchBibleVerses(version, query) {
  const res = await fetch(`https://bolls.life/v2/find/${version}?search=${encodeURIComponent(query)}&match_case=false`);
  if (!res.ok) throw new Error("No se pudo buscar en la Biblia.");
  const data = await res.json();
  const needle = foldAccents(query);
  return (data.results || []).filter((r) => foldAccents(stripBibleSearchMarkup(r.text)).includes(needle));
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
    return { chapter, verse: v.verse, text: stripBibleSearchMarkup(v.text) };
  }
  const books = await fetchBibleBooks(version);
  const book = books.find((b) => b.bookid === bookId);
  const targetChapter = chapter + direction;
  if (!book || targetChapter < 1 || targetChapter > book.chapters) return null;
  const targetVerses = await fetchBibleChapter(version, bookId, targetChapter);
  if (!targetVerses.length) return null;
  const v = direction > 0 ? targetVerses[0] : targetVerses[targetVerses.length - 1];
  return { chapter: targetChapter, verse: v.verse, text: stripBibleSearchMarkup(v.text), bookName: book.name };
}

// Cuerpo del buscador de Biblia, sin el modal alrededor — se reutiliza tal cual dentro de un <ModalShell>
// (Setlist: "Agregar versículo") y también suelto dentro de un panel lateral angosto (En vivo: versículo
// improvisado), que es justo la manera compacta en la que se quería ver esto en el dashboard en vivo.
function BibleBrowserBody({ onAdd, submitLabel = "Agregar al servicio", splitVersesIndividually = false }) {
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
        onAdd({ ref: `${selectedBook.name} ${selectedChapter}:${v.verse}`, version, text: stripBibleSearchMarkup(v.text), bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: v.verse, verseEnd: v.verse });
      });
      return;
    }
    const text = picked.map((v) => stripBibleSearchMarkup(v.text)).join(" ");
    const ref = range.start === range.end ? `${selectedBook.name} ${selectedChapter}:${range.start}` : `${selectedBook.name} ${selectedChapter}:${range.start}-${range.end}`;
    onAdd({ ref, version, text, bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: range.start, verseEnd: range.end });
  };
  const filteredBooks = books ? books.filter((b) => b.name.toLowerCase().includes(bookFilter.toLowerCase())) : [];

  return (
    <>
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
                      <b style={{ color: "#2F5FA8" }}>{v.verse}</b> {stripBibleSearchMarkup(v.text)}
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
    </>
  );
}
function BibleModal({ onClose, onAdd, title = "Agregar versículo", submitLabel = "Agregar al servicio", splitVersesIndividually = false }) {
  return (
    <ModalShell title={title} icon={BookOpen} color="#2F5FA8" onClose={onClose}>
      <BibleBrowserBody onAdd={onAdd} submitLabel={submitLabel} splitVersesIndividually={splitVersesIndividually} />
    </ModalShell>
  );
}
function SlideModal({ draft, setDraft, onClose, onAdd, title = "Slide personalizada", submitLabel = "Agregar al servicio" }) {
  const bgOptions = ["#1B2029", "#2A1F33", "#1F2A2C", "#332420"];
  const bgType = draft.bgType || "color";
  const videoFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const uploadVideoFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, videoUrl: reader.result }));
    reader.readAsDataURL(file);
  };
  const uploadImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  };
  return (
    <ModalShell title={title} icon={ImgIcon} color="#B15EA0" onClose={onClose}>
      {/* Textarea, no input: para un texto largo se puede tocar Enter y armar el salto de línea a mano
          (dónde se corta cada línea en la proyección), en vez de dejarlo todo al ajuste automático. */}
      <textarea placeholder="Título (opcional si es solo video/imagen) — Enter para salto de línea" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inputStyle, height: 70, resize: "none" }} />
      <textarea placeholder="Subtítulo (opcional)" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} style={{ ...inputStyle, height: 44, resize: "none", marginTop: 8 }} />
      <div style={{ fontSize: 11, color: "#64707F", fontWeight: 700, margin: "14px 0 8px" }}>FONDO</div>
      <div style={{ display: "flex", gap: 3, background: "#EEF1F6", padding: 3, borderRadius: 8, marginBottom: 10, width: "fit-content" }}>
        {[["color", "Color"], ["imagen", "Imagen"], ["video", "Video"]].map(([val, label]) => (
          <button key={val} onClick={() => setDraft({ ...draft, bgType: val })} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: bgType === val ? "#B15EA0" : "transparent", color: bgType === val ? "#fff" : "#64707F" }}>{label}</button>
        ))}
      </div>
      {bgType === "color" && (
        <div style={{ display: "flex", gap: 8 }}>
          {bgOptions.map((c) => (<button key={c} onClick={() => setDraft({ ...draft, bg: c })} style={{ width: 34, height: 34, borderRadius: 8, background: c, border: draft.bg === c ? "2px solid #E8821E" : "1px solid #C7D0DD", cursor: "pointer" }} />))}
        </div>
      )}
      {bgType === "imagen" && (
        <div>
          <button onClick={() => imageFileInputRef.current?.click()} className="hoverable" style={addBtnStyle}>
            {draft.imageUrl ? (
              <span style={{ width: 16, height: 16, borderRadius: 4, backgroundImage: `url(${draft.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
            ) : (
              <ImgIcon size={13} color="#8996A6" />
            )}
            <span>{draft.imageUrl ? "Imagen cargada — tocar para cambiar" : "Subir imagen desde este dispositivo"}</span>
          </button>
          <input ref={imageFileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { uploadImageFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div style={{ fontSize: 11, color: "#8996A6", marginTop: 6 }}>Se estira para cubrir toda la pantalla. Si dejas el título vacío, se proyecta a pantalla completa sin texto encima.</div>
        </div>
      )}
      {bgType === "video" && (
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

// ---------------- BIBLIA EN VIVO (estilo Proyektor: 3 columnas, clic en un versículo proyecta al instante) ----------------
// Columna 1: libros divididos en Antiguo/Nuevo Testamento (bookid 1-39 = AT, 40-66 = NT en bolls.life).
// Columna 2: versión arriba, capítulos del libro elegido, e historial de versículos ya proyectados esta
// sesión — así el operador vuelve rápido a un pasaje que el pastor ya citó antes, sin tener que buscarlo
// de nuevo. Columna 3: el capítulo completo; tocar un versículo lo proyecta de inmediato, sin botón de
// confirmación (a diferencia del buscador del Setlist, aquí no se arma un rango: es lectura en vivo).
function BibleLivePanel({ version, setVersion, history, setHistory, onProject, liveVerse }) {
  const [books, setBooks] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [bookFilter, setBookFilter] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [verses, setVerses] = useState(null);
  const [loadingChapter, setLoadingChapter] = useState(false);
  // Búsqueda de frase dentro del texto (no solo nombre de libro): mientras hay una búsqueda activa, la
  // columna 3 muestra los versículos encontrados en TODA la Biblia en vez del capítulo seleccionado.
  const [searchResults, setSearchResults] = useState(null); // null = sin búsqueda activa; [] = sin resultados
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    setLoadError("");
    fetchBibleBooks(version).then(setBooks).catch((e) => setLoadError(e.message));
  }, [version]);

  // Con al menos 3 caracteres busca la frase completa en el texto de los versículos — con menos, se
  // asume que todavía está escribiendo el nombre de un libro y no vale la pena golpear la API.
  // Debounce de 400ms: no dispara una búsqueda por cada tecla mientras escribe.
  useEffect(() => {
    const query = bookFilter.trim();
    if (query.length < 3) { setSearchResults(null); setSearchError(""); return; }
    setSearching(true); setSearchError("");
    const timer = setTimeout(() => {
      searchBibleVerses(version, query)
        .then((results) => setSearchResults(results.slice(0, 60)))
        .catch((e) => { setSearchError(e.message); setSearchResults([]); })
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [bookFilter, version]);

  const loadChapter = (bookId, chapter, v) => {
    setLoadingChapter(true); setLoadError("");
    fetchBibleChapter(v || version, bookId, chapter).then(setVerses).catch((e) => setLoadError(e.message)).finally(() => setLoadingChapter(false));
  };
  // Elegir un libro/capítulo a mano siempre gana sobre una búsqueda de frase que haya quedado pendiente.
  const openBook = (book) => { setSearchResults(null); setSelectedBook(book); setSelectedChapter(1); loadChapter(book.bookid, 1); };
  const openChapter = (chapter) => { setSearchResults(null); setSelectedChapter(chapter); loadChapter(selectedBook.bookid, chapter); };
  const changeVersion = (v) => { setVersion(v); if (selectedBook) loadChapter(selectedBook.bookid, selectedChapter, v); };

  const rememberAndProject = (entry) => {
    onProject(entry);
    setHistory((h) => [entry, ...h.filter((x) => x.ref !== entry.ref || x.version !== entry.version)].slice(0, 25));
  };
  const pickVerse = (v) => {
    rememberAndProject({
      ref: `${selectedBook.name} ${selectedChapter}:${v.verse}`, version, text: stripBibleSearchMarkup(v.text),
      bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: v.verse, verseEnd: v.verse,
    });
  };
  const openHistoryEntry = (entry) => {
    rememberAndProject(entry);
    // Igual que abrir un libro/capítulo a mano: si había quedado una búsqueda de frase activa, se
    // limpia — si no, la columna 3 se quedaba mostrando esos resultados viejos en vez del capítulo
    // completo del versículo que se acaba de elegir del historial.
    setBookFilter(""); setSearchResults(null);
    const book = books?.find((b) => b.bookid === entry.bookId);
    if (book) setSelectedBook(book);
    setSelectedChapter(entry.chapter);
    if (entry.version !== version) setVersion(entry.version);
    loadChapter(entry.bookId, entry.chapter, entry.version);
  };
  // Elegir un resultado de búsqueda: proyecta ese versículo Y salta a su capítulo completo (limpiando la
  // búsqueda), para poder seguir leyendo alrededor de ese versículo con la vista normal de capítulo.
  const pickSearchResult = (r) => {
    const book = books?.find((b) => b.bookid === r.book);
    const bookName = book?.name || `Libro ${r.book}`;
    rememberAndProject({
      ref: `${bookName} ${r.chapter}:${r.verse}`, version, text: stripBibleSearchMarkup(r.text),
      bookId: r.book, bookName, chapter: r.chapter, verseStart: r.verse, verseEnd: r.verse,
    });
    if (book) setSelectedBook(book);
    setSelectedChapter(r.chapter);
    loadChapter(r.book, r.chapter);
    setBookFilter(""); setSearchResults(null);
  };

  const matchesFilter = (name) => !bookFilter || name.toLowerCase().includes(bookFilter.toLowerCase());
  const oldTestament = books ? books.filter((b) => b.bookid <= 39 && matchesFilter(b.name)) : [];
  const newTestament = books ? books.filter((b) => b.bookid >= 40 && matchesFilter(b.name)) : [];
  const bookListStyle = (b) => ({ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "3px 4px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: selectedBook?.bookid === b.bookid ? 700 : 500, color: selectedBook?.bookid === b.bookid ? "#E8821E" : "#2F5FA8" });

  return (
    <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
      {/* Columna 1: libros AT/NT */}
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "6px 9px", marginBottom: 8, flexShrink: 0 }}>
          <Search size={12} color="#8996A6" />
          <input value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} placeholder="Libro, o una frase del versículo…" style={{ background: "transparent", border: "none", outline: "none", color: "#16233A", fontSize: 11.5, width: "100%" }} />
          {bookFilter && <button onClick={() => { setBookFilter(""); setSearchResults(null); }} style={iconGhost}><X size={12} /></button>}
        </div>
        {loadError && <div style={{ fontSize: 11, color: "#C23B32", marginBottom: 8 }}>{loadError}</div>}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: "sticky", top: 0, background: "#F4F6FA", fontSize: 10, fontWeight: 700, color: "#64707F", padding: "2px 0 6px" }}>ANTIGUO TESTAMENTO</div>
              {oldTestament.map((b) => (<button key={b.bookid} onClick={() => openBook(b)} style={bookListStyle(b)}>{b.name}</button>))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: "sticky", top: 0, background: "#F4F6FA", fontSize: 10, fontWeight: 700, color: "#64707F", padding: "2px 0 6px" }}>NUEVO TESTAMENTO</div>
              {newTestament.map((b) => (<button key={b.bookid} onClick={() => openBook(b)} style={bookListStyle(b)}>{b.name}</button>))}
            </div>
          </div>
        </div>
      </div>

      {/* Columna 2: versión, capítulos, historial */}
      <div style={{ width: 210, flexShrink: 0, minHeight: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>VERSIÓN</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
          {BIBLE_VERSIONS.map((v) => (
            <button key={v.code} onClick={() => changeVersion(v.code)} title={v.label} style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 7px", borderRadius: 6, border: version === v.code ? "2px solid #2F5FA8" : "1px solid #C7D0DD", background: version === v.code ? "#EAF0FA" : "#fff", color: "#16233A", cursor: "pointer" }}>{v.code}</button>
          ))}
        </div>

        {selectedBook ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>CAPÍTULOS DE {selectedBook.name.toUpperCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 14 }}>
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((c) => (
                <button key={c} onClick={() => openChapter(c)} style={{ padding: "6px 0", borderRadius: 6, border: "none", background: selectedChapter === c ? "#16324F" : "#EEF1F6", color: selectedChapter === c ? "#fff" : "#16233A", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "#8996A6", marginBottom: 14 }}>Elige un libro para ver sus capítulos.</div>
        )}

        <div style={{ fontSize: 10, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>HISTORIAL</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 11, color: "#8996A6" }}>Los versículos que proyectes van a aparecer aquí para volver rápido a ellos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history.map((h) => {
              const isLive = liveVerse && liveVerse.ref === h.ref && liveVerse.version === h.version;
              return (
                <button key={`${h.ref}-${h.version}`} onClick={() => openHistoryEntry(h)} style={{ textAlign: "left", background: isLive ? "#FFF4E8" : "#fff", border: isLive ? "1px solid #E8821E" : "1px solid transparent", borderRadius: 6, padding: "5px 7px", cursor: "pointer", boxShadow: "0 1px 4px rgba(22,50,79,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#16233A" }}>{h.ref} <span style={{ color: "#2F5FA8", fontWeight: 700 }}>· {h.version}</span></div>
                  <div style={{ fontSize: 10.5, color: "#64707F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.text}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Columna 3: resultados de búsqueda de frase (si hay una activa), si no el capítulo completo —
          en ambos casos, clic en un versículo proyecta al instante */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto" }}>
        {searchResults !== null ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#16233A", marginBottom: 8 }}>
              {searching ? "Buscando…" : `"${bookFilter.trim()}" · ${searchResults.length} versículo${searchResults.length === 1 ? "" : "s"}`}
            </div>
            {searchError && <div style={{ fontSize: 12, color: "#C23B32", padding: "10px 0" }}>{searchError} Revisa tu conexión a internet e intenta de nuevo.</div>}
            {!searching && !searchError && searchResults.length === 0 && (
              <div style={{ fontSize: 12, color: "#8996A6", padding: "20px 0", textAlign: "center" }}>No se encontró ningún versículo con esa frase en {version}.</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {searchResults.map((r) => {
                const bookName = books?.find((b) => b.bookid === r.book)?.name || `Libro ${r.book}`;
                const isLive = liveVerse && liveVerse.bookId === r.book && liveVerse.chapter === r.chapter && liveVerse.verseStart === r.verse && liveVerse.version === version;
                return (
                  <button key={r.pk} onClick={() => pickSearchResult(r)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: 8, border: "none", background: isLive ? "#DDE3ED" : "transparent", cursor: "pointer", fontSize: 13, color: "#16233A", lineHeight: 1.5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", marginBottom: 2 }}>{bookName} {r.chapter}:{r.verse}</div>
                    {stripBibleSearchMarkup(r.text)}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {!selectedBook && <div style={{ fontSize: 12, color: "#8996A6", padding: "20px 0", textAlign: "center" }}>Elige un libro y capítulo para ver los versículos.</div>}
            {selectedBook && <div style={{ fontSize: 13, fontWeight: 700, color: "#16233A", marginBottom: 8 }}>{selectedBook.name} {selectedChapter}</div>}
            {loadingChapter && <div style={{ fontSize: 12, color: "#8996A6", padding: "20px 0", textAlign: "center" }}>Cargando…</div>}
            {!loadingChapter && verses && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {verses.map((v) => {
                  const isLive = liveVerse && liveVerse.bookId === selectedBook.bookid && liveVerse.chapter === selectedChapter && liveVerse.verseStart === v.verse && liveVerse.version === version;
                  return (
                    <button key={v.verse} onClick={() => pickVerse(v)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: 8, border: "none", background: isLive ? "#DDE3ED" : "transparent", cursor: "pointer", fontSize: 13, color: "#16233A", lineHeight: 1.5 }}>
                      <b style={{ color: "#2F5FA8" }}>{v.verse}</b> {stripBibleSearchMarkup(v.text)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- CONTROL MULTIMEDIA (EN VIVO) ----------------

function MultimediaControl({ eventTitle, isFreeSession, library, slides, activeIdx, adHocIdx, goto, gotoPlanSlide, blanked, setBlanked, current, next, onEnd, canEnd, liveOwner, liveStyle, setLiveStyle, isCompact, adHoc, onExitAdHoc, onStartAdHocBible, onStartAdHocSong, onStartAdHocVideo, onOpenPublicScreen, onNavigateBibleVerse, onAddLiveSlide, onEditLiveSlide, onRemoveLiveSlide }) {
  // Riel de íconos a la izquierda (estilo Proyektor): qué panel se muestra en la columna principal.
  // "transmision" es el que ya existía (grid de diapositivas); "biblia" y "estilo" antes eran cajones
  // que tapaban la pantalla — ahora son pestañas fijas para no perder de vista la vista previa de al lado.
  const [mmPanel, setMmPanel] = useState("transmision"); // "biblia" | "transmision" | "estilo"
  // Versión e historial de la Biblia en vivo: se guardan aquí (no dentro de BibleLivePanel) para que
  // sobrevivan al cambiar de pestaña e ir a Estilo/Transmisión y volver a Biblia — y también en
  // localStorage (mismo mecanismo que offlineCache) para que sobrevivan a salir de "En vivo" del todo
  // (MultimediaControl se desmonta con la pestaña) o recargar la app a medio culto.
  const [bibleVersion, setBibleVersion] = useState(() => loadCache("bible_version") || BIBLE_VERSIONS[0].code);
  const [bibleHistory, setBibleHistory] = useState(() => loadCache("bible_historial") || []);
  useEffect(() => { saveCache("bible_version", bibleVersion); }, [bibleVersion]);
  useEffect(() => { saveCache("bible_historial", bibleHistory); }, [bibleHistory]);
  const [showAdHocSong, setShowAdHocSong] = useState(false);
  const [showAdHocVideo, setShowAdHocVideo] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [newSlideDraft, setNewSlideDraft] = useState({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" });
  // Editar una diapositiva ya agregada (versículo/slide/punto del bosquejo) por si algo se escribió mal.
  const [editingSlide, setEditingSlide] = useState(null); // la slide original que se está editando, o null
  const [editDraft, setEditDraft] = useState(null);
  const startEditingSlide = (s) => {
    setEditingSlide(s);
    setEditDraft(s.type === "biblia" ? { reference: s.reference, text: s.text } : { title: s.title, subtitle: s.subtitle || "", bg: s.bg || "#1B2029", bgType: s.bgType || "color", videoUrl: s.videoUrl || "", imageUrl: s.imageUrl || "" });
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

  // Flechas del teclado para cambiar de diapositiva sin soltar el mouse — como en PowerPoint. Arriba/
  // abajo SIEMPRE avanzan versículo por versículo cuando lo que está en vivo es una lectura bíblica
  // navegable (viene de "Buscar en la Biblia", no escrita a mano). Izquierda/derecha avanzan por el plan
  // — EXCEPTO en modo improvisado con un versículo navegable y sin otra diapositiva a la que ir (el caso
  // típico: "Proyectar ahora" desde el buscador, fuera de la planificación), donde también avanzan
  // versículo por versículo — así cualquiera de las dos flechas funciona ahí, no solo arriba/abajo.
  // Se ignora si el foco está en un campo de texto, para no pisar lo que se esté escribiendo.
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const isNavigableBible = current?.type === "biblia" && current.bookId;
      const noOtherSlideToGo = adHoc && adHoc.slides.length === 1;
      if (e.key === "ArrowRight") { e.preventDefault(); if (isNavigableBible && noOtherSlideToGo) onNavigateBibleVerse(1); else goto(navIdx + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (isNavigableBible && noOtherSlideToGo) onNavigateBibleVerse(-1); else goto(navIdx - 1); }
      else if (e.key === "ArrowDown" && isNavigableBible) { e.preventDefault(); onNavigateBibleVerse(1); }
      else if (e.key === "ArrowUp" && isNavigableBible) { e.preventDefault(); onNavigateBibleVerse(-1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navIdx, current, adHoc, goto, onNavigateBibleVerse]);

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
  // Diapositivas agregadas a mano vía "Improvisar" (ver DIAPOSITIVAS más abajo) — se identifican solo
  // por ser type "slide" dentro del plan en vivo, ya sea el de un evento real o el de una libre.
  const customSlides = slides.filter((s) => s.type === "slide");

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

      {/* Barra de herramientas: pantalla 2, negro */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 10px", flexWrap: "wrap" }}>
        <button onClick={onOpenPublicScreen} style={{ ...ctrlBtn, background: "#16324F", color: "#fff" }}><Radio size={14} /> Reabrir proyección</button>
        <button onClick={() => setBlanked((b) => !b)} style={{ ...ctrlBtn, background: blanked ? "#C23B32" : "#EEF1F6", color: blanked ? "#fff" : "#16233A" }}><MonitorOff size={14} /> {blanked ? "Reanudar" : "Pantalla en negro"}</button>
      </div>

      {/* "Volver al plan" solo tiene sentido para una canción improvisada (existe un plan real de
          canciones al que volver). Biblia/Texto/Video nunca fueron parte del plan del Setlist — no hay
          "plan" al que regresar, así que ahí se deja solo el indicador de qué está en vivo. */}
      {adHoc && (
        <div style={{ margin: "0 16px 10px", background: "#FFF4E8", border: "1px solid #E8821E", borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8A4F0E" }}>● {adHoc.label}</span>
          {adHoc.slides[0]?.type === "cancion" && (
            <button onClick={onExitAdHoc} style={{ fontSize: 11, fontWeight: 700, color: "#8A4F0E", background: "transparent", border: "1px solid #E8821E", borderRadius: 14, padding: "3px 8px", cursor: "pointer", flexShrink: 0 }}>Volver al plan</button>
          )}
        </div>
      )}

      {/* Cuerpo: riel de íconos + panel principal (izquierda) + vista previa y controles (derecha), estilo Proyektor */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16, padding: "0 16px 16px" }}>
        {/* Riel de íconos: cambia qué panel se ve a la izquierda sin tocar la vista previa/controles de la derecha */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
          {[
            { key: "biblia", icon: BookOpen, title: "Biblia" },
            { key: "transmision", icon: ListMusic, title: "Transmisión" },
            { key: "estilo", icon: Palette, title: "Estilo" },
          ].map(({ key, icon: Icon, title }) => (
            <button
              key={key} onClick={() => setMmPanel(key)} title={title}
              style={{ width: 40, height: 40, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: mmPanel === key ? "#E8821E" : "#EEF1F6", color: mmPanel === key ? "#fff" : "#64707F", boxShadow: mmPanel === key ? "0 3px 10px rgba(232,130,30,0.35)" : "none" }}
            ><Icon size={18} /></button>
          ))}
        </div>

        {mmPanel === "biblia" && (
          <BibleLivePanel
            version={bibleVersion} setVersion={setBibleVersion}
            history={bibleHistory} setHistory={setBibleHistory}
            onProject={(b) => onStartAdHocBible(b)}
            liveVerse={current?.type === "biblia" && current.bookId ? { ref: current.reference, version: current.version, bookId: current.bookId, chapter: current.chapter, verseStart: current.verseStart } : null}
          />
        )}

        {mmPanel === "estilo" && (
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {Object.entries(LIVE_FONTS).map(([key, f]) => (
                <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, font: key }))} style={{ padding: "5px 10px", borderRadius: 8, border: liveStyle.font === key ? "2px solid #B15EA0" : "1px solid #C7D0DD", cursor: "pointer", background: "#fff", fontFamily: f.family, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", textTransform: f.transform, fontSize: 12 }}>{f.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>COLOR DE LETRA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(LIVE_TEXT_COLORS).map(([key, c]) => (
                <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, textColor: c.value }))} title={c.label} style={{ width: 28, height: 28, borderRadius: "50%", background: c.value, border: (liveStyle.textColor || "#FFFFFF") === c.value ? "2px solid #B15EA0" : "1px solid #C7D0DD", cursor: "pointer", padding: 0 }} />
              ))}
              <label title="Elegir otro color" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #C7D0DD", cursor: "pointer", padding: 0, position: "relative", overflow: "hidden", background: !Object.values(LIVE_TEXT_COLORS).some((c) => c.value === (liveStyle.textColor || "#FFFFFF")) ? (liveStyle.textColor || "#FFFFFF") : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)", display: "flex" }}>
                <input type="color" value={liveStyle.textColor || "#FFFFFF"} onChange={(e) => setLiveStyle((s) => ({ ...s, textColor: e.target.value }))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
              </label>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64707F", marginBottom: 6 }}>TAMAÑO DE LETRA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8996A6" }}>A</span>
              <input
                type="range" min={0.6} max={1.8} step={0.05}
                value={fontScale}
                onChange={(e) => setLiveStyle((s) => ({ ...s, fontScale: parseFloat(e.target.value) }))}
                style={{ flex: 1, accentColor: "#E8821E", cursor: "pointer" }}
              />
              <span style={{ fontSize: 19, fontWeight: 700, color: "#8996A6" }}>A</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#16233A", width: 34, textAlign: "right" }}>{Math.round(fontScale * 100)}%</span>
            </div>
          </div>
        )}

        {mmPanel === "transmision" && (
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#64707F", fontWeight: 700 }}>TODAS LAS SLIDES</span>
            <button
              onClick={() => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" }); setShowAddSlide(true); }}
              title="Agregar una diapositiva (ej. el título de la predica o un anuncio) — queda aquí para poder volver a proyectarla"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "#EAF0FA", border: "none", borderRadius: 14, padding: "4px 10px", cursor: "pointer" }}
            ><Plus size={13} /> Agregar diapositiva</button>
          </div>
          {isFreeSession && slides.length === 0 && (
            <div style={{ fontSize: 12, color: "#8996A6", padding: "20px 10px", textAlign: "center" }}>Esta es una transmisión sin evento — usa "Agregar diapositiva" arriba para un título/aviso, o Biblia/Improvisar (abajo, a la derecha) para versículos, canciones o videos.</div>
          )}
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
                      // Antes 10px de ícono en 3px de relleno — un blanco casi imposible de acertar en un
                      // celular real, sobre todo con una miniatura tan chica; de ahí que pareciera que la
                      // diapositiva "no se podía editar" cuando en realidad el botón sí estaba, solo que
                      // nadie lograba tocarlo bien.
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditingSlide(s); }}
                        title="Editar esta diapositiva (corregir texto)"
                        style={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      ><Pencil size={13} color="#fff" /></button>
                    )}
                  </div>
                  <div style={{ background: color, color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
        )}

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
            {/* Grid en vez de una sola fila: "Diapositiva" no cabía junto a Canción/Video sin desbordar
                el ancho fijo de esta columna y obligar a hacer scroll horizontal para verla completa. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button onClick={() => setShowAdHocSong(true)} style={{ ...ctrlBtn, justifyContent: "center" }}><Music size={13} /> Canción</button>
              <button onClick={() => setShowAdHocVideo(true)} style={{ ...ctrlBtn, justifyContent: "center" }}><ImgIcon size={13} /> Video</button>
              {/* A diferencia de Canción/Video (que se proyectan una vez y no quedan en ningún lado),
                  "Diapositiva" usa el mismo "Agregar diapositiva" de la pestaña Transmisión — queda fija
                  aquí mismo (ver DIAPOSITIVAS abajo) para poder volver a mandarla a proyección. */}
              <button onClick={() => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" }); setShowAddSlide(true); }} style={{ ...ctrlBtn, justifyContent: "center", gridColumn: "1 / -1" }}><Type size={13} /> Diapositiva</button>
            </div>
          </div>

          {/* Diapositivas agregadas a mano (título de la predica, avisos...) — se quedan listadas aquí
              mismo, en el mismo panel donde se crean (Biblia/Improvisar), sin tener que ir a la pestaña
              Transmisión a buscarlas. Tocar el nombre la vuelve a mandar a proyección; la X la borra. */}
          {customSlides.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#64707F", fontWeight: 700, marginBottom: 6 }}>DIAPOSITIVAS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {customSlides.map((s) => {
                  const isLive = !adHoc && current?.slideId === s.slideId;
                  return (
                    <div key={s.slideId} style={{ display: "flex", alignItems: "center", gap: 6, background: isLive ? "#FFF4E8" : "#fff", border: isLive ? "1px solid #E8821E" : "1px solid transparent", borderRadius: 8, padding: "5px 6px", boxShadow: "0 1px 4px rgba(22,50,79,0.08)" }}>
                      <button onClick={() => gotoPlanSlide(slides.findIndex((x) => x.slideId === s.slideId))} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#16233A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.title || "(sin título)"}
                      </button>
                      <button onClick={() => startEditingSlide(s)} title="Editar esta diapositiva (corregir texto)" style={{ ...iconGhost, color: "#2F5FA8", flexShrink: 0 }}><Pencil size={13} /></button>
                      <button onClick={() => onRemoveLiveSlide(s.slideId)} title="Borrar esta diapositiva" style={{ ...iconGhost, color: "#C23B32", flexShrink: 0 }}><X size={13} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {showAdHocSong && <AdHocSongModal library={library} onClose={() => setShowAdHocSong(false)} onPick={(song) => { onStartAdHocSong(song); setShowAdHocSong(false); }} />}
      {showAdHocVideo && <AdHocVideoModal onClose={() => setShowAdHocVideo(false)} onPlay={(url) => { onStartAdHocVideo(url); setShowAdHocVideo(false); }} />}
      {showAddSlide && (
        <SlideModal
          draft={newSlideDraft} setDraft={setNewSlideDraft}
          onClose={() => setShowAddSlide(false)}
          onAdd={() => { if (!newSlideDraft.title && !(newSlideDraft.bgType === "video" && newSlideDraft.videoUrl) && !(newSlideDraft.bgType === "imagen" && newSlideDraft.imageUrl)) return; onAddLiveSlide(newSlideDraft); setShowAddSlide(false); }}
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
function AutoFitText({ lines, targetRatio, minPx = 14, style, maxWidth, onFontSize }) {
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
      if (onFontSize) onFontSize(size);
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
  // Tamaño real (medido, en px) al que AutoFitText terminó dejando el texto del versículo después de
  // achicarlo para que quepa — puede ser bastante menor que el "deseado" (bibliaRatio) si el versículo
  // es largo. La cita se calcula a partir de ESTE valor medido (no del tamaño deseado) para que nunca
  // pueda verse más grande que el propio versículo, sin importar cuánto se haya tenido que achicar.
  const [bibliaFontPx, setBibliaFontPx] = useState(null);
  // Prioridad de fondo: video propio de esta slide > video de fondo global (Estilo > Video) > imagen
  // propia de esta slide > imagen de fondo global (Estilo > Imagen) > tema de color.
  const slideVideoBg = slide?.type === "slide" && slide.bgType === "video" && slide.videoUrl;
  const globalVideoBg = !slideVideoBg && liveStyle?.theme === "custom" && liveStyle.customVideo;
  const videoSrc = slideVideoBg ? slide.videoUrl : globalVideoBg ? liveStyle.customVideo : null;
  const slideImageBg = !videoSrc && slide?.type === "slide" && slide.bgType === "imagen" && slide.imageUrl;
  const globalImageBg = !videoSrc && !slideImageBg && liveStyle?.theme === "custom" && liveStyle.customImage;
  const imageSrc = slideImageBg || globalImageBg || null;
  const theme = videoSrc || imageSrc ? null : LIVE_THEMES[liveStyle?.theme || "stage"];
  const bg = videoSrc ? "#000" : imageSrc ? `center / cover no-repeat url(${imageSrc})` : theme.bg;
  // El tamaño de letra "deseado" viene del slider (liveStyle.fontScale) multiplicando una proporción del
  // alto del contenedor (ver AutoFitText) en vez de un px fijo — así se ve igual de grande en la
  // mini-preview y en la pantalla real, y ese mismo % sigue aplicando de una diapositiva a la siguiente
  // (liveStyle.fontScale es un solo valor compartido, no por diapositiva) sin nunca desbordarse, porque
  // AutoFitText siempre lo achica más si hace falta para esa diapositiva en particular.
  const cancionRatio = 0.16 * scale;
  // Antes 0.12 — bastante más chica que la letra de canción (0.16), lo que la hacía difícil de leer
  // desde lejos en la pantalla real, incluso para quienes siguen con su propia Biblia en mano.
  const bibliaRatio = 0.155 * scale;
  const slideRatio = 0.18 * scale;
  const textColor = liveStyle?.textColor || "#FFFFFF";
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
          {imageSrc && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 0 }} />}
          {!videoSrc && <div className="spotlight-glow" style={{ position: "absolute", width: thumbnail ? 140 : 420, height: thumbnail ? 140 : 420, borderRadius: "50%", background: `radial-gradient(circle, ${TYPE_META[slide.type].color}22 0%, transparent 70%)` }} />}
          {slide.type === "cancion" && (
            <>
              <div style={{ fontSize: thumbnail ? 9 : 12, fontWeight: 700, letterSpacing: thumbnail ? 1 : 2, color: "#E8821E", marginBottom: thumbnail ? 6 : 14, zIndex: 1 }}>{slide.blockLabel.toUpperCase()}</div>
              <AutoFitText
                lines={slide.lines} targetRatio={cancionRatio} minPx={thumbnail ? 7 : 15} maxWidth="90%"
                style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: font.tracking, fontStyle: font.italic ? "italic" : "normal", textAlign: "center", zIndex: 1, lineHeight: 1.35, color: textColor }}
              />
              {!thumbnail && <div style={{ position: "absolute", bottom: 18, display: "flex", alignItems: "center", gap: 8, color: "#5B6472", fontSize: 12, zIndex: 1 }}><Music size={12} /> {slide.songTitle}</div>}
            </>
          )}
          {slide.type === "biblia" && (
            <>
              {/* Antes la cita vivía como hermana de AutoFitText dentro del mismo flex column: al medir
                  su tamaño DESDE bibliaFontPx (ver abajo) y compartir el mismo alto disponible, cambiar
                  su tamaño encogía/agrandaba el espacio que le quedaba al versículo, lo que disparaba el
                  ResizeObserver de AutoFitText de nuevo, que volvía a medir, volvía a cambiar bibliaFontPx,
                  volvía a cambiar el tamaño de la cita... un ciclo sin fin que se veía como parpadeo/
                  "el texto se agranda y achica solo" en algunos versículos (los que quedaban cerca del
                  punto donde ese vaivén no se estabilizaba). Reservando aquí un espacio FIJO (no depende
                  de bibliaFontPx) y sacando la cita del flujo con position:absolute, el alto que mide
                  AutoFitText deja de depender de su propio resultado anterior — se rompe el ciclo. */}
              <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: (thumbnail ? 22 : 76) * scale }}>
                <AutoFitText
                  lines={`"${slide.text}"`} targetRatio={bibliaRatio} minPx={thumbnail ? 7 : 14} maxWidth="90%"
                  onFontSize={setBibliaFontPx}
                  style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: font.tracking, textAlign: "center", zIndex: 1, lineHeight: 1.4, fontStyle: font.italic || font.family.includes("Fraunces") ? "italic" : "normal", color: textColor }}
                />
              </div>
              {/* La cita ("Génesis 6:6") tiene que leerse desde lejos SIN necesidad de escuchar — hay gente
                  que sigue con su propia Biblia en mano y solo mira la pantalla para ubicar el pasaje.
                  Pero nunca debe verse MÁS grande que el propio versículo: en vez de un tamaño calculado
                  aparte (que no sabía cuánto se había achicado el versículo para caber), se deriva del
                  tamaño ya medido de arriba (bibliaFontPx) — así siempre queda un porcentaje fijo de él,
                  se achique lo que se achique el versículo. */}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: thumbnail ? 6 : 28, textAlign: "center", fontSize: thumbnail ? 10 : Math.round((bibliaFontPx || 20) * 0.62), color: "#6E9BD1", fontWeight: 800, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3em" }}>
                {slide.reference}
                {!thumbnail && slide.version && <span style={{ fontSize: "0.4em", background: "rgba(110,155,209,0.2)", borderRadius: 6, padding: "0.2em 0.6em" }}>{slide.version}</span>}
              </div>
            </>
          )}
          {slide.type === "slide" && (
            <div style={{ textAlign: "center", zIndex: 1, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <AutoFitText
                lines={(slide.title || "").split("\n")} targetRatio={slideRatio} minPx={thumbnail ? 8 : 16} maxWidth="90%"
                style={{ fontFamily: font.family, fontWeight: Math.max(font.weight, 600), textTransform: font.transform, letterSpacing: font.tracking, fontStyle: font.italic ? "italic" : "normal", color: textColor }}
              />
              {slide.subtitle && !thumbnail && <div style={{ fontSize: 15, color: "#B7BEC9", marginTop: 8, flexShrink: 0, whiteSpace: "pre-line" }}>{slide.subtitle}</div>}
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
