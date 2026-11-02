import { lazy, useState, useEffect, useRef, useMemo, Suspense } from "react";
import { esGrupoDiapositivas, slidesDeGrupo, itemConDiapositivas, tituloBase, diapositivasDeItem, nuevaDiapositiva, moverDiapositiva, quitarDiapositiva as quitarDiapositivaDeGrupo, reordenarEnGrupo } from "./lib/diapositivas.js";
import { usePreferencias, acordeEn } from "./lib/preferencias.js";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { showToast, notifyError, esFalloDeConexion } from "./lib/toast.js";
import { ordenarPor } from "./lib/orden.js";
import { registrarLineaBaseEventos, listEventosCompletos, sincronizarServiceOrder, sincronizarWorshipRoles, crearEventoCompleto, deleteEvento, updateEvento, marcarAsignacionVista } from "./lib/eventos.js";
import { registrarLineaBaseMinisterios, listMinisteriosCompletos, sincronizarPlan, sincronizarRecursos, crearMinisterio, actualizarLiderMinisterio, actualizarNombreMinisterio, actualizarPermisosLider, actualizarColorMinisterio, eliminarMinisterio } from "./lib/ministerios.js";
import { listCancionesCompletas, updateCancion, guardarLetraCancion, guardarCancionDesdeEditor, deleteCancion } from "./lib/canciones.js";
import { saveCache, loadCache } from "./lib/offlineCache.js";
import { subscribeTableChanges } from "./lib/realtime.js";
import { palabrasPorParteSegun, expandirVersiculosLargos, reorganizarLetra } from "./lib/dividirTexto.js";
import { insertarEnBloque, anclaDeBloque } from "./lib/ordenCulto.js";
import { esBloquePredicacion, guardarBosquejo, aplicarBosquejoAlOrden, bosquejoAItems } from "./lib/bosquejos.js";
import { confirmDialog, promptDialog } from "./lib/confirm.js";
import { updateMusicoLive, clearMusicoLive, getMusicoLive, subscribeMusicoLive } from "./lib/musicoLive.js";
import { broadcastLiveSession, enviarAPantallas, clearLiveSession, obtenerCodigoPantalla, updateLiveSession, responderPedidosDeEstado, getLiveSession, subscribeLiveSession, escucharProyeccion } from "./lib/liveSession.js";
import { aplicarCambioLetra, rearmarSeccion, letraEfectiva } from "./lib/letraEnVivo.js";
import { textoALetra, letraATexto } from "./lib/textoCancion.js";
import { sincronizarRecordatorios } from "./lib/recordatorios.js";
import { listMisNotificaciones, subscribeNotificaciones, marcarLeida, marcarTodasLeidas, estadoPermisoNotificacion, tieneAlgunaSuscripcionPush, decidirAccionPush, suscribirPush } from "./lib/notificaciones.js";
import { estaEnPredicacion, perteneceA, temporizadorActivo, iniciarTemporizador, armarEscenario } from "./lib/escenario.js";
import { isUpcoming, compareByDay, formatFullDate } from "./lib/dates.js";
import { CLAVES_TUTORIAL, pasosBienvenida, pasosEventos, pasosEvento, pasosCanciones, pasosEditorCancion, pasosEnVivo, marcarTutorialVisto, reiniciarTutoriales } from "./lib/tutoriales.js";
import { Eye, WifiOff, EyeOff, ChevronRight, Bell, Pencil, Check, LayoutGrid, Home, Music, Calendar, MessageCircle, Radio, Image as ImgIcon, Settings, X, Search, Paperclip, ChevronLeft, MonitorOff, BookOpen, Type, PenTool, FileUp, Plus, MoreHorizontal, Trash2, GraduationCap, Pin, MessageSquare, AlertTriangle, PinOff, ListMusic, Palette, Play, SkipBack, SkipForward, SlidersHorizontal, Sparkles, ChevronUp, Tv, ArrowRightLeft, CopyPlus, Ungroup, Mic2 } from "lucide-react";
import AppLogo from "./AppLogo.jsx";
import Tour from "./components/Tour.jsx";
import ImportarCancionesPdf from "./components/ImportarCancionesPdf.jsx";
import BosquejoWizard from "./components/BosquejoWizard.jsx";
import { stripBibleSearchMarkup } from "./lib/textoBiblia.js";
import { buscarCanciones } from "./lib/busqueda.js";
import { animacionActiva, precargarFuentesAnimacion, nombreAnimacion, definicionAnimacion, armarLineasAnimadas, velocidadLetra, FondoAnimado, claseAnimacion } from "./components/LetrasAnimadas.jsx";
import { pasosDeDiapositiva } from "./lib/animaciones.js";
import { useArrastreLista } from "./lib/arrastreLista.js";
import { useArrastreGrid } from "./lib/arrastreGrid.js";
import { esPaginaPresentacion } from "./lib/importarPresentacion.js";
import DiapositivaDisenada from "./components/DiapositivaDisenada.jsx";
import SelectorAnimacion from "./components/SelectorAnimacion.jsx";
import CintaAdaptable from "./components/CintaAdaptable.jsx";
import PantallaOtroEquipo from "./components/PantallaOtroEquipo.jsx";
import PanelEscenario from "./components/PanelEscenario.jsx";
import ImportarPresentacion from "./components/ImportarPresentacion.jsx";
import AutoFitText from "./components/AutoFitText.jsx";
import { semitoneShift, transposeLine, TYPE_META, CLASIFICACIONES_DEFAULT, fijarClasificacionesActuales, EVENTO_LIBRE, isWorshipBlock, serviceItemLabel, DEFAULT_COVERS, lideraBloque, nextMinistryChildId, misAsignacionesEnEvento, ModalShell, ghostToggleBtn, primaryBtn, fetchBibleChapter, fetchBibleBooks, addBtnStyle, inputStyle, BIBLE_VERSIONS, iconGhost, ElegirParteDelCulto, Field } from "./pantallas/compartido.jsx";
import { InicioView } from "./pantallas/inicio.jsx";
import { SettingsView } from "./pantallas/ajustes.jsx";
import { MinistriesList, MinistryDetail } from "./pantallas/ministerios.jsx";
import { AsistenteChatScreen } from "./pantallas/asistente.jsx";
import { CancionesList, SongView, SongEditor } from "./pantallas/canciones.jsx";
import { EventList, EventDetail } from "./pantallas/eventos.jsx";
import { BibleBrowserBody, BibleLivePanel } from "./pantallas/biblia.jsx";
import { MediaPicker, SlideModal } from "./pantallas/ventanas.jsx";

// El editor de diapositivas (solo escritorio) se descarga recién la primera vez que se abre.
const EditorDiapositivas = lazy(() => import("./components/EditorDiapositivas.jsx"));

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

// Devuelve una COPIA transportada de la canción para mostrarla en la tonalidad que se eligió para
// ese ítem del Setlist en particular (tonalidad_override), sin tocar la canción real de la
// biblioteca — a diferencia de transposeSong (que sí muta y guarda), esto es solo para lectura.
function songWithKeyOverride(song, overrideKey) {
  if (!song || !overrideKey || overrideKey === song.key) return song;
  const semitones = semitoneShift(song.key, overrideKey);
  const blocks = Object.fromEntries(Object.entries(song.blocks).map(([key, b]) => [key, { ...b, lines: b.lines.map((l) => transposeLine(l, semitones)) }]));
  return { ...song, key: overrideKey, blocks };
}

// Umbral para dar por abandonada una sesión en vivo que nadie finalizó — ver el useEffect que llama a getLiveSession().
const LIVE_SESSION_STALE_MS = 24 * 60 * 60 * 1000;

// ---- Modo Músico líder/seguidor durante una transmisión en vivo (ver SongView, tabla musico_en_vivo) ----
// Identifica esta pestaña/dispositivo para saber si el líder que aparece en musico_en_vivo soy yo o
// alguien más — se genera una sola vez por carga de página, no hace falta que sobreviva a un refresh.
const DEVICE_ID = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Math.random().toString(36).slice(2)}`;

function filaAMusicoState(fila) {
  if (!fila) return null;
  return {
    liderId: fila.lider_id || null,
    liderNombre: fila.lider_nombre || null,
    songItemId: fila.song_item_id || null,
    sectionIdx: fila.section_idx ?? 0,
    bpm: fila.bpm || null,
    auto: !!fila.auto,
    heartbeat: fila.heartbeat || null,
  };
}

// ---------- Color por sección para el grid de diapositivas del panel Multimedia (estilo "grid de shows" tipo FreeShow) ----------
const sectionColorFor = (s) => {
  if (s.type !== "cancion") return TYPE_META[s.type]?.color || "#5B6472";
  const label = (s.blockLabel || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Orden importa: pre-coro y post-coro ANTES que coro (los dos también contienen "coro"), e
  // "instrumental" antes que "intro" (empieza igual). Acepta también los nombres en inglés.
  if (/pre[\s-]?(coro|chorus)/.test(label)) return "#C2508F"; // rosado
  if (/pos(t)?[\s-]?(coro|chorus)/.test(label)) return "#7B4FB8"; // morado
  if (/coro|estribillo|refran|chorus/.test(label)) return "#B15EA0"; // orquídea
  if (/puente|bridge/.test(label)) return "#3F6FC4"; // azul
  if (/estrofa|verso|verse/.test(label)) return "#1F8A73"; // teal
  if (/instrumental|interludio|solo|riff/.test(label)) return "#8A6D1E"; // ocre
  if (/intro/.test(label)) return "#A85A26"; // durazno oscuro
  if (/vamp|espontane|ministracion|adoracion|declaracion|clamor/.test(label)) return "#2E86AB"; // celeste
  if (/final|outro|coda|cierre|ending|tag/.test(label)) return "#3E5C76"; // azul pizarra
  return "#5B6472";
};

// ---------- Estilo en vivo de la proyección: fondo y tipografía, ajustables por multimedia mientras transmite ----------
// Letra animada sobre fondo propio: mínimo de oscurecido, sombra extra y colores casi transparentes más
// visibles (ej. las palabras que esperan en "Karaoke") — ver ProjectionPanel.
const OSCURECER_MINIMO_ANIMADA = 0.4;

export function reforzarSombraAnimada(sombra) {
  const extra = "0 0.05em 0.3em rgba(0,0,0,.8)";
  return !sombra || sombra === "none" ? extra : `${sombra}, ${extra}`;
}

export function colorLegibleAnimada(color) {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color || "");
  if (!m || Number(m[4]) >= 0.55) return color;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.55)`;
}

const LIVE_THEMES = {
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
const LIVE_SOMBRAS = {
  ninguna: { label: "Ninguna", css: "none" },
  suave: { label: "Suave", css: "0 0.06em 0.25em rgba(0,0,0,0.55)" },
  fuerte: { label: "Fuerte", css: "0 0.08em 0.4em rgba(0,0,0,0.9), 0 0.03em 0.08em rgba(0,0,0,0.9)" },
  contorno: { label: "Contorno", css: "-0.035em -0.035em 0 #000, 0.035em -0.035em 0 #000, -0.035em 0.035em 0 #000, 0.035em 0.035em 0 #000, 0 0.06em 0.2em rgba(0,0,0,0.6)" },
};

const LIVE_POSICIONES = { arriba: { label: "Arriba", flex: "flex-start" }, centro: { label: "Centro", flex: "center" }, abajo: { label: "Abajo", flex: "flex-end" } };

const LIVE_ALINEACIONES = { izquierda: { label: "Izquierda", flex: "flex-start", text: "left" }, centro: { label: "Centro", flex: "center", text: "center" }, derecha: { label: "Derecha", flex: "flex-end", text: "right" } };

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

// Color del texto principal en pantalla (letra de canción, cita bíblica, título de slide) — todos
// pensados para buen contraste sobre los fondos oscuros de LIVE_THEMES/imágenes/video.
const LIVE_TEXT_COLORS = {
  blanco: { label: "Blanco", value: "#FFFFFF" },
  crema: { label: "Crema", value: "#F5EFE0" },
  amarillo: { label: "Amarillo suave", value: "#F5D67B" },
  celeste: { label: "Celeste", value: "#BFE3FF" },
  dorado: { label: "Dorado", value: "#E8C77E" },
};

// Paleta para la cita bíblica (ej. "Mateo 5:25") -- separada de LIVE_TEXT_COLORS porque antes su color
// vivía fijo en el código (#6E9BD1, el primero de acá) y nunca fue configurable como el del versículo.
const LIVE_REFERENCE_COLORS = {
  celeste: { label: "Celeste (por defecto)", value: "#6E9BD1" },
  blanco: { label: "Blanco", value: "#FFFFFF" },
  dorado: { label: "Dorado", value: "#E8C77E" },
  naranja: { label: "Naranja", value: "#E8821E" },
};

// Estilo de transmisión para la letra de canciones (pedido de Eldin, 2026-10-05, inspirado en un video
// de ejemplo) -- primeros 3 de una lista más larga de diseños sugeridos. Solo aplica a slides tipo
// "cancion" (lines[1], la segunda línea) -- las diapositivas de canción ahora son de máximo 2 líneas
// cada una (ver la regeneración de diapositivas_letra del mismo día), así que "segunda línea" siempre
// es la que cierra la frase de esa diapositiva.
const LINE_STYLES = {
  tradicional: { label: "Tradicional" },
  mayuscula: { label: "Énfasis en mayúscula" },
  acento: { label: "Línea de acento" },
  editorial: { label: "Contraste editorial" },
  descendente: { label: "Tamaño descendente" },
  revista: { label: "Alineación tipo revista" },
  cita: { label: "Cita destacada" },
  fundido: { label: "Entrada con fundido" },
  deslizante: { label: "Entrada deslizante" },
  franja: { label: "Franja inferior" },
};

// UUIDs reales (no ids falsos tipo "it301"): así cualquier fila creada en el cliente ya sirve
// directo como primary key real en Supabase, sin tener que "reconciliar" un id falso con el real
// que devolvería el servidor después de guardar.
const nextId = () => crypto.randomUUID();

// ---------- Equipo / iglesia ----------
// El nombre de la iglesia ya NO está fijo acá (Fase 3) — InicioView y SettingsView lo reciben como
// prop `teamName`, leído de iglesias.nombre (ver myIglesia en WorshipFlowPrototype).

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
    const hasRealSlides = !!(song.letra && blockKey in song.letra);
    const slideGroups = hasRealSlides ? song.letra[blockKey] : [block.lines.map(stripChords)];
    // Además, cualquier diapositiva que haya quedado en blanco (todas sus líneas vacías) nunca se
    // proyecta — así una diapositiva vacía olvidada no interrumpe la presentación en vivo. Se guarda el
    // índice ORIGINAL (antes de filtrar en blanco) — es el mismo con el que se arma song.letra[clave] en
    // cancionCompletaAFormatoEditor, así que es el que hace falta para corregir la fila correcta en
    // Supabase si Multimedia la edita en vivo (ver corregirDiapositivaCancion).
    const slideEntries = slideGroups
      .map((lines, originalIndex) => ({ lines, originalIndex }))
      .filter((e) => e.lines.some((l) => l && l.trim()));
    slideEntries.forEach(({ lines, originalIndex }, si) => {
      out.push({
        slideId: `${idPrefix}-${i}-${si}`, type: "cancion", songTitle: song.title,
        blockLabel: slideEntries.length > 1 ? `${block.label} (${si + 1}/${slideEntries.length})` : block.label,
        sectionLabel: block.label,
        lines,
        songId: song.id, blockKey, slideIndexInBlock: originalIndex, hasRealSlides,
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
    } else if (item.type === "slide" && esGrupoDiapositivas(item)) {
      // Presentación agrupada o diapositiva diseñada en el editor: cada diapositiva con su diseño.
      slides.push(...slidesDeGrupo(item));
    } else if (item.type === "slide") {
      slides.push({ slideId: item.id, type: "slide", title: item.title, nombre: item.name || "", subtitle: item.subtitle, escalaSubtitulo: item.escalaSubtitulo, bg: item.bg, bgType: item.bgType, videoUrl: item.videoUrl, imageUrl: item.imageUrl });
    }
  });
  return slides;
}

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

// Un bloque "pertenece" a lectura bíblica/oración por el mismo criterio (título) — el encargado de
// ESE bloque en el evento puede agregar su propio versículo, aunque no sea administrador.
function isBibleReadingBlock(item) {
  return item.type === "seccion" && /lectura|oraci[oó]n/i.test(item.title || "");
}

// ¿Tiene esta persona el permiso de líder `clave` (ver PERMISOS_LIDER) en este evento? Es decir: el
// evento tiene un bloque vinculado a un grupo que ella lidera y ese grupo le da ese permiso a su líder.
function permisoLiderEnEvento(event, ministries, userId, clave) {
  if (!event || !userId) return false;
  return (event.serviceOrder || []).some((it) => {
    if (it.type !== "seccion" || !it.ministryId) return false;
    const m = (ministries || []).find((x) => x.id === it.ministryId);
    return !!(m && m.leaderId === userId && m.permisosLider?.[clave]);
  });
}

export default function WorshipFlowPrototype({ userId, perfil, myIglesia, onIglesiaActualizada, onGoToUsuarios, onGoToRoles, onGoToPlataforma }) {
  // Al cambiar "Cómo ver los tonos" en Ajustes, toda la app se vuelve a pintar con la nueva notación.
  usePreferencias();
  // Clasificaciones de canción de ESTA iglesia (ver CLASIFICACIONES_DEFAULT).
  const clasificaciones = myIglesia.categoriasCanciones?.length ? myIglesia.categoriasCanciones : CLASIFICACIONES_DEFAULT;
  fijarClasificacionesActuales(clasificaciones);
  // Solo el Administrador real puede guardarlas (la RLS de iglesias exige usuarios.rol = 'admin').
  const guardarClasificaciones = async (lista) => {
    const { error } = await supabase.from("iglesias").update({ categorias_canciones: lista }).eq("id", perfil?.iglesia_id);
    if (error) throw new Error("No se pudieron guardar las clasificaciones: " + error.message);
    onIglesiaActualizada?.({ categorias_canciones: lista });
    showToast("Clasificaciones guardadas.", "info");
  };
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
    // offsetHeight (no getBoundingClientRect): con el tamaño de letra "Grande" (zoom en <html>) el rect
    // viene ya agrandado y al usarlo como CSS se agrandaba otra vez — la barra quedaba mal puesta.
    const publish = () => document.documentElement.style.setProperty("--bottom-nav-height", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isCompact]);
  // Canciones y Eventos arrancan vacíos y se cargan de verdad desde Supabase — ya no hay datos de
  // ejemplo del prototipo. Ministerios sigue siendo local por ahora (todavía no tiene tabla real).
  const [librarySinOrden, setLibrary] = useState([]);
  // Siempre en orden alfabético (2026-10-30) — también las que se crean o renombran en este dispositivo,
  // que antes quedaban al final hasta recargar.
  const library = useMemo(() => ordenarPor(librarySinOrden, (s) => s.title), [librarySinOrden]);
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
  // Espejo síncrono de `events`, escrito a mano en vez de leído del valor de retorno de setEvents(fn) —
  // updateOrder/updateWorshipRoles/etc. necesitan el arreglo YA actualizado ANTES de llamar a
  // sincronizarServiceOrder, en el mismo instante en que se llama. React solo ejecuta el updater de
  // setEvents(fn) de forma síncrona cuando no hay otra actualización de este mismo estado ya pendiente
  // (su optimización interna de "eager state"); si el usuario dispara varios cambios seguidos (ej. la
  // tonalidad de 5 canciones, una detrás de otra, antes de que React alcance a renderizar entre medio),
  // solo el primero cae en ese camino rápido — en los siguientes React solo encola la actualización sin
  // correr el updater todavía, así que la variable que se esperaba llenar (nuevoOrden/nuevo) se queda en
  // null y el guardado correspondiente NUNCA se dispara, en silencio. Por eso pasaba que de 5 cambios de
  // tonalidad solo se guardaban 2, y de los 3 restantes solo 1, etc. — dependía de cuántos alcanzaran a
  // pisar esa ventana. Con este espejo, cada llamada calcula el nuevo valor a mano a partir del último
  // valor ya calculado (no del estado de React, que puede ir un paso atrás), así que siempre es fresco
  // sin importar qué tan rápido se disparen los cambios.
  const eventsRef = useRef([]);
  // Un arreglo completo (no una función) solo llega cuando la app ADOPTA datos traídos de la base
  // (carga inicial, refresco en tiempo real, copia sin conexión): ahí se fija la línea base que usan
  // los guardados por diferencias (ver src/lib/lineaBase.js). Las ediciones locales pasan una función.
  const setEventsSynced = (next) => {
    if (typeof next !== "function") registrarLineaBaseEventos(next);
    eventsRef.current = typeof next === "function" ? next(eventsRef.current) : next;
    setEvents(eventsRef.current);
  };
  // Mismo criterio que setEventsSynced con un arreglo: ministerios traídos de la base fijan su línea base.
  const adoptarMinisterios = (data) => {
    registrarLineaBaseMinisterios(data);
    setMinistries(data);
  };
  const [datosListos, setDatosListos] = useState(false);
  // Red de seguridad si no hay internet al cargar (o se cae justo en ese momento): en vez de dejar la
  // app en blanco, se usa la última copia que sí se guardó localmente la vez que hubo conexión. Es de
  // solo lectura — los intentos de guardar algo mientras no hay señal van a fallar igual (ya lo avisan
  // las alertas de "No se pudo guardar..." que ya existían), esto solo evita la pantalla vacía.
  const [usingCachedData, setUsingCachedData] = useState(false);
  // Refleja el estado real de conexión del navegador (no solo "falló la última carga") — así se puede
  // avisar apenas se corta la señal, aunque los datos ya estuvieran cargados de antes.
  const [importandoPdf, setImportandoPdf] = useState(false); // ver components/ImportarCancionesPdf.jsx
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const filaAlAireRef = useRef(null); // lo último que se mandó a la proyección (ver sincronización en vivo)
  const sincroPendienteRef = useRef(false); // true = Supabase no recibió el último cambio por falta de internet
  const reloadLibrary = () => listCancionesCompletas().then(setLibrary).catch((e) => notifyError("No se pudo cargar el cancionero", e));
  // Se reutiliza tanto en la carga inicial como al recuperar la señal (ver el efecto de "online" más
  // abajo) — mismo Promise.all de siempre, solo que ahora tiene nombre para no repetirlo dos veces.
  const cargarTodo = () => Promise.all([
    listCancionesCompletas().then((data) => { setLibrary(data); saveCache("canciones", data); }),
    listEventosCompletos().then((data) => { setEventsSynced(data); saveCache("eventos", data); }),
    listMinisteriosCompletos().then((data) => { adoptarMinisterios(data); saveCache("ministerios", data); }),
  ]);
  useEffect(() => {
    cargarTodo()
      .catch((e) => {
        const cachedLibrary = loadCache("canciones");
        const cachedEvents = loadCache("eventos");
        const cachedMinistries = loadCache("ministerios");
        if (cachedLibrary || cachedEvents) {
          setLibrary(cachedLibrary || []);
          setEventsSynced(cachedEvents || []);
          adoptarMinisterios(cachedMinistries || []);
          setUsingCachedData(true);
        } else {
          notifyError("No se pudieron cargar los datos", e);
        }
      })
      .finally(() => setDatosListos(true));
  }, []);
  // Si el teléfono compartido se queda sin señal a medio culto y luego vuelve (algo que ya le ha
  // pasado a esta iglesia), esto lo detecta solo — sin tener que recargar la página a mano — y
  // resincroniza todo de una vez apenas vuelve el internet.
  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => {
      setIsOffline(false);
      cargarTodo()
        .then(() => { setUsingCachedData(false); showToast("Conexión recuperada — todo actualizado.", "info"); })
        .catch(() => {});
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => { window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); };
  }, []);
  // Sincroniza Canciones/Eventos/Ministerios EN TIEMPO REAL entre dispositivos — antes cada uno se
  // cargaba una sola vez al abrir la app y quien lo tuviera abierto no se enteraba de cambios hechos
  // desde otro celular/computadora hasta recargar la página a mano. Cada dominio se re-lee completo
  // (mismo listXCompletos que ya usa la carga inicial) apenas Supabase avisa que algo cambió — ver
  // subscribeTableChanges para el debounce y la pausa mientras alguien está escribiendo.
  useEffect(() => {
    const unsubCanciones = subscribeTableChanges(
      "rt-canciones", ["canciones", "secciones_cancion", "diapositivas_letra", "estructura_cancion"],
      // "shouldWait" solo evita EMPEZAR el refresco mientras hay un guardado en vuelo — pero listar
      // todo de nuevo es una operación en sí misma (varias canciones, cada una con 4 consultas), que
      // puede tardar más que un guardado corto que arranca DESPUÉS de que este refresco ya empezó. Sin
      // este segundo chequeo, ese refresco (que arrancó cuando no había nada pendiente) terminaba
      // igual y pisaba con datos viejos lo que se acababa de guardar mientras tanto — el guardado en sí
      // había salido bien, pero la pantalla volvía a mostrar la versión de antes. Por eso se vuelve a
      // comprobar pendingSavesRef justo antes de aplicar el resultado, no solo antes de pedirlo.
      () => listCancionesCompletas().then((data) => { if (pendingSavesRef.current === 0) { setLibrary(data); saveCache("canciones", data); } }).catch(() => {}),
      2500, () => pendingSavesRef.current > 0
    );
    const unsubEventos = subscribeTableChanges(
      "rt-eventos", ["eventos", "items_servicio", "roles_evento", "miembros_rol", "recordatorios_evento", "asignaciones_vistas"],
      // Mismo chequeo doble que rt-canciones — acá es más grave todavía: agregar varias canciones
      // seguidas al Setlist es exactamente el patrón que más fácil dispara esto (cada canción agregada
      // es un guardado nuevo, y listar TODOS los eventos de nuevo tarda bastante con varios eventos
      // cargados), así que sin este segundo chequeo era fácil que una tanda de canciones agregadas se
      // "esfumara" de la pantalla apenas terminaba de cargar un refresco que había arrancado antes.
      () => listEventosCompletos().then((data) => { if (pendingSavesRef.current === 0) { setEventsSynced(data); saveCache("eventos", data); } }).catch(() => {}),
      2500, () => pendingSavesRef.current > 0
    );
    const unsubMinisterios = subscribeTableChanges(
      "rt-ministerios", ["ministerios", "planificacion_ministerio", "recursos_ministerio"],
      () => listMinisteriosCompletos().then((data) => { if (pendingSavesRef.current === 0) { adoptarMinisterios(data); saveCache("ministerios", data); } }).catch(() => {}),
      2500, () => pendingSavesRef.current > 0
    );
    return () => { unsubCanciones(); unsubEventos(); unsubMinisterios(); };
  }, []);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [blanked, setBlanked] = useState(false);
  // Pantalla FIJADA (pedido de Eldin, 2026-10-11): la proyección se queda en esta diapositiva mientras
  // Multimedia se mueve por la consola sin que nada salga. null = normal. "Soltar" proyecta lo actual.
  const [fijada, setFijada] = useState(null);
  // Contenido improvisado en vivo (versículo/canción/video que no están en el setlist): reemplaza al plan mientras esté activo.
  const [adHoc, setAdHoc] = useState(null); // { label, slides } | null
  const [adHocIdx, setAdHocIdx] = useState(0);
  const [showBibleForm, setShowBibleForm] = useState(false);
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [slideDraft, setSlideDraft] = useState({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" });
  const [showSermonForm, setShowSermonForm] = useState(false);
  const [sermonPointText, setSermonPointText] = useState("");
  const [bosquejoAbierto, setBosquejoAbierto] = useState(null); // id del bloque de Predicación (ver BosquejoWizard)

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const [liveEventId, setLiveEventId] = useState(null);
  // Código secreto de las pantallas sin sesión (enlace que vence, 2026-11-02): va en el enlace/QR y en el
  // nombre del canal por el que la consola les manda lo que está al aire. La base lo cambia sola al
  // finalizar la transmisión, así que se vuelve a pedir al empezar y al terminar.
  const [codigoPantalla, setCodigoPantalla] = useState(null);
  const [liveOwnerId, setLiveOwnerId] = useState(null); // usuario que inició la transmisión; solo esa persona puede finalizarla
  // Estado de Modo Músico líder/seguidor de la sesión en vivo (ver columnas musico_* en sesiones_en_vivo
  // y el useEffect de subscribeLiveSession más abajo, que lo llena junto con liveEventId/liveOwnerId).
  const [musicoState, setMusicoState] = useState(null);
  // Modo Músico en vivo es VOLUNTARIO: este dispositivo solo sigue a quien dirige si tocó "Unirme".
  // Vive aquí (no en SongView) para que siga unido al pasar de canción. Se suelta al terminar el culto.
  const [unidoAlLider, setUnidoAlLider] = useState(false);
  // "En vivo sin evento": transmisión libre, sin ningún plan/setlist detrás — solo contenido improvisado
  // (Biblia/canción/video/slide). liveEventId se queda en null en este caso, igual que cuando no hay nada
  // en vivo, así que se necesita esta bandera aparte para distinguir ambos casos.
  const [liveLibre, setLiveLibre] = useState(false);
  // Diapositivas agregadas a mano durante una transmisión libre (ej. el título de la predica) — no hay
  // ningún evento real al que guardarlas en Supabase, así que viven solo en memoria mientras dura esta
  // transmisión (se limpian al iniciar/terminar una), pero SÍ quedan fijas ahí (reseleccionables) en vez
  // de proyectarse una sola vez y desaparecer, igual que cualquier diapositiva agregada a un evento real.
  const [libreServiceOrder, setLibreServiceOrder] = useState([]);
  // Modo práctica (pedido de Eldin, 2026-10-11): la consola con un culto real, pero SIN tocar la sesión
  // en vivo — nada sale a la pantalla de la iglesia, no se escribe nada en Supabase y los cambios al
  // orden quedan solo en esta copia. Para que alguien nuevo aprenda sin miedo antes del culto.
  const [practica, setPractica] = useState(null); // null | { eventId, title, serviceOrder }
  const enPractica = !!practica;
  const liveEvent = practica ? { id: practica.eventId, title: practica.title, serviceOrder: practica.serviceOrder }
    : liveLibre ? { ...EVENTO_LIBRE, serviceOrder: libreServiceOrder } : events.find((e) => e.id === liveEventId);
  const navFlotante = tab === "envivo" && !!liveEvent && !isCompact; // ver la nav inferior
  // En la consola la barra se encoge a un botón redondo en la esquina (pedido de Eldin, 2026-10-21:
  // "la barra de navegación estorba en los textos, los últimos ya no se pueden ver"). Se abre al tocarlo
  // y se vuelve a encoger al elegir una pestaña.
  const [navAbierta, setNavAbierta] = useState(false);
  useEffect(() => { setNavAbierta(false); }, [tab]);
  const navEncogida = navFlotante && !navAbierta;
  // ---- Estilo en vivo de la proyección (fondo/tipografía/tamaño), editable solo por Multimedia mientras transmite ----
  // Se queda guardado entre transmisiones (pedido de Eldin, 2026-10-08): copia en este dispositivo
  // para arrancar al instante, y la de la iglesia (sesiones_en_vivo.estilo_en_vivo, que ya no se borra
  // al finalizar — ver clearLiveSession) manda en cuanto llega, para que cualquier computadora que
  // transmita use el mismo estilo. Es uno solo para todas las canciones.
  const [liveStyle, setLiveStyle] = useState(() => loadCache("estilo_en_vivo") || { theme: "stage", font: "elegante", fontScale: 1 });
  useEffect(() => { saveCache("estilo_en_vivo", liveStyle); }, [liveStyle]);
  const adoptarEstiloGuardado = (estilo) => {
    if (!estilo || typeof estilo !== "object") return;
    setLiveStyle((actual) => (JSON.stringify(actual) === JSON.stringify(estilo) ? actual : estilo));
  };
  // Versículos largos → 2 o 3 diapositivas (ver dividirTexto.js). Con la letra en vivo más grande,
  // caben menos palabras por diapositiva y divide antes.
  // Dividir versículos largos: ajuste de cada iglesia (Ajustes → Pantalla de proyección).
  const palabrasPorParte = palabrasPorParteSegun(liveStyle.fontScale, !!myIglesia.dividirVersiculos);
  // Cómo se reparte la letra de canciones en pantalla — ajuste de cada iglesia (Identidad de la iglesia).
  const formatoLetra = myIglesia.formatoLetra || "dos_lineas";
  // Ocultos en la consola (pedido de Eldin, 2026-10-11): la ✕ de la consola ya NO borra del setlist —
  // solo esconde ese elemento en la consola de ESTA computadora y no lo proyecta. El setlist general
  // queda intacto. Se guarda por evento (y sobrevive a recargar); "Mostrar ocultos" los regresa.
  const [ocultosConsola, setOcultosConsola] = useState(() => loadCache("consola_ocultos") || {});
  useEffect(() => { saveCache("consola_ocultos", ocultosConsola); }, [ocultosConsola]);
  const claveOcultos = liveEvent?.id || null;
  const idsOcultosConsola = useMemo(() => new Set((claveOcultos && ocultosConsola[claveOcultos]) || []), [ocultosConsola, claveOcultos]);
  const slides = useMemo(
    () => (liveEvent ? expandirVersiculosLargos(reorganizarLetra(buildSlides(liveEvent.serviceOrder.filter((it) => !idsOcultosConsola.has(it.id)), library), formatoLetra), palabrasPorParte) : []),
    [liveEvent, library, palabrasPorParte, formatoLetra, idsOcultosConsola]
  );
  const adHocSlides = useMemo(
    () => (adHoc ? expandirVersiculosLargos(reorganizarLetra(adHoc.slides, formatoLetra), palabrasPorParte) : []),
    [adHoc, palabrasPorParte, formatoLetra]
  );
  const adHocVista = useMemo(() => (adHoc ? { ...adHoc, slides: adHocSlides } : null), [adHoc, adHocSlides]);
  const currentBase = adHoc ? adHocSlides[adHocIdx] : slides[activeIdx];
  // Diapositivas diseñadas con animación "al clic" (editor de diapositivas, 2026-10-18): cada "Siguiente"
  // revela el próximo elemento antes de pasar a la otra diapositiva. El paso viaja dentro de la
  // diapositiva al aire (slide.paso) para que la proyección muestre exactamente lo mismo.
  // Se guarda junto al id de la diapositiva: al cambiar de diapositiva vuelve a 0 en el MISMO render (sin un
  // cuadro intermedio mostrando de más).
  const [pasoGuardado, setPasoGuardado] = useState({ id: null, paso: 0 });
  const idDiapositivaActual = currentBase?.slideId ?? null;
  const pasoDiseno = pasoGuardado.id === idDiapositivaActual ? pasoGuardado.paso : 0;
  const setPasoDiseno = (n) => setPasoGuardado({ id: idDiapositivaActual, paso: typeof n === "function" ? n(pasoDiseno) : n });
  const current = useMemo(() => (currentBase?.diseno ? { ...currentBase, paso: pasoDiseno } : currentBase), [currentBase, pasoDiseno]);
  const next = adHoc ? adHocSlides[adHocIdx + 1] : slides[activeIdx + 1];

  // ---- Lectura bíblica en vivo: "Siguiente/Anterior versículo" y cambio de versión sin reabrir el buscador.
  // Solo funciona para versículos elegidos con el buscador de la Biblia (traen bookId/chapter) — los que se
  // escribieron a mano o son de "acceso rápido" no tienen cómo saber cuál es el próximo versículo. ----
  // Guarda en Supabase en segundo plano cada vez que cambia el setlist de un evento — el estado local
  // se actualiza al instante (para que la operación en vivo se sienta rápida) y la persistencia real
  // pasa por detrás, sin bloquear la interacción.
  const updateLiveOrder = (fn) => {
    if (practica) { setPractica((p) => (p ? { ...p, serviceOrder: fn(p.serviceOrder) } : p)); return; } // práctica: nada se guarda
    if (liveLibre) { setLibreServiceOrder((o) => fn(o)); return; } // sin evento real, no hay nada que guardar en Supabase
    let nuevoOrden = null;
    setEventsSynced((evs) => evs.map((e) => {
      if (e.id !== liveEventId) return e;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) {
      pendingSavesRef.current++;
      sincronizarServiceOrder(liveEventId, nuevoOrden).catch((err) => notifyError("No se pudo guardar el setlist", err)).finally(() => pendingSavesRef.current--);
    }
  };
  // Para cuando a Multimedia se le olvidó agregar algo en el Setlist (un anuncio, etc.): agrega una slide
  // directo al plan en vivo (no al overlay "improvisado" temporal) y salta a proyectarla de inmediato.
  // `slides.length` (antes de agregar) es exactamente el índice donde queda la nueva, ya que se agrega al final.
  // despuesDe (opcional): id del elemento tras el cual entra — igual que una canción agregada en vivo,
  // va junto a lo que se está viendo, no al final. Se proyecta de inmediato (mantenerAlAireRef apunta
  // a ella apenas se recalculan las diapositivas).
  const addLiveSlide = (draft, despuesDe) => {
    const nuevo = { id: nextId(), type: "slide", ...draft };
    updateLiveOrder((o) => {
      const i = despuesDe ? o.findIndex((it) => it.id === despuesDe) : -1;
      return i === -1 ? [...o, nuevo] : [...o.slice(0, i + 1), nuevo, ...o.slice(i + 1)];
    });
    setAdHoc(null); setAdHocIdx(0); setBlanked(false);
    mantenerAlAireRef.current = nuevo.id;
  };
  // ---- Editar el orden del culto desde la consola En vivo (pedido de Eldin, 2026-10-08: "el líder de
  // alabanza le pide a Multimedia que agregue una canción y la ponga en tal orden"). Igual que el
  // Setlist: agregar, quitar y arrastrar. Lo que está AL AIRE no se mueve: activeIdx es un índice en
  // la lista de diapositivas, y al cambiar el orden esa misma diapositiva queda en otro índice — se
  // recuerda su slideId y, apenas se recalculan las diapositivas, se vuelve a apuntar a ella.
  const mantenerAlAireRef = useRef(null);
  const cambiarOrdenEnVivo = (fn) => {
    if (!adHoc && slides[activeIdx]) mantenerAlAireRef.current = slides[activeIdx].slideId;
    updateLiveOrder(fn);
  };
  useEffect(() => {
    const id = mantenerAlAireRef.current;
    if (!id) return;
    mantenerAlAireRef.current = null;
    const nuevo = slides.findIndex((s) => s.slideId === id);
    if (nuevo !== -1) setActiveIdx(nuevo);
  }, [slides]);
  // despuesDe: id del elemento tras el cual va (null = al final).
  const agregarCancionEnVivo = (songId, despuesDe) => {
    const song = library.find((s) => s.id === songId);
    if (!song) return;
    const nuevo = { id: nextId(), type: "cancion", songId, structure: song.defaultStructure };
    cambiarOrdenEnVivo((o) => {
      const i = despuesDe ? o.findIndex((it) => it.id === despuesDe) : -1;
      return i === -1 ? [...o, nuevo] : [...o.slice(0, i + 1), nuevo, ...o.slice(i + 1)];
    });
    return nuevo.id;
  };
  // Varios elementos de una vez (una presentación importada, ver ImportarPresentacion), en el mismo lugar.
  const insertarItemsEnVivo = (items, despuesDe) => cambiarOrdenEnVivo((o) => {
    const i = despuesDe ? o.findIndex((it) => it.id === despuesDe) : -1;
    return i === -1 ? [...o, ...items] : [...o.slice(0, i + 1), ...items, ...o.slice(i + 1)];
  });
  const reordenarOrdenEnVivo = (desde, hacia) => cambiarOrdenEnVivo((o) => {
    if (desde === hacia) return o;
    const arr = [...o];
    const [movido] = arr.splice(desde, 1);
    arr.splice(hacia, 0, movido);
    return arr;
  });
  const ocultarEnConsola = (ids) => {
    if (!claveOcultos || !ids.length) return;
    // Lo que está al aire se queda al aire si no es lo que se oculta (mismo truco que al reordenar).
    if (!adHoc && slides[activeIdx] && !ids.some((id) => slides[activeIdx].slideId === id || String(slides[activeIdx].slideId).startsWith(`${id}-`) || String(slides[activeIdx].slideId).startsWith(`${id}~`))) mantenerAlAireRef.current = slides[activeIdx].slideId;
    setOcultosConsola((m) => {
      // Solo se guardan los últimos 30 eventos para no acumular basura en esta computadora.
      const otros = Object.entries(m).filter(([k]) => k !== claveOcultos).slice(-29);
      return { ...Object.fromEntries(otros), [claveOcultos]: [...new Set([...(m[claveOcultos] || []), ...ids])] };
    });
  };
  const mostrarOcultosConsola = (ids = null) => {
    if (!claveOcultos) return;
    if (!adHoc && slides[activeIdx]) mantenerAlAireRef.current = slides[activeIdx].slideId;
    setOcultosConsola((m) => {
      const quedan = ids ? (m[claveOcultos] || []).filter((x) => !ids.includes(x)) : [];
      const { [claveOcultos]: _fuera, ...resto } = m;
      return quedan.length ? { ...resto, [claveOcultos]: quedan } : resto;
    });
  };
  const quitarDelOrdenEnVivo = (itemId) => {
    const alAireEsDeEste = !adHoc && slides[activeIdx] && (slides[activeIdx].slideId === itemId || String(slides[activeIdx].slideId).startsWith(`${itemId}-`) || String(slides[activeIdx].slideId).startsWith(`${itemId}~`));
    if (alAireEsDeEste) { removeLiveSlide(itemId); return; } // lo que estaba al aire se va: se queda en el mismo lugar
    cambiarOrdenEnVivo((o) => o.filter((it) => it.id !== itemId));
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
  // Siempre sobre el versículo COMPLETO (baseSlideId), aunque en pantalla esté una de sus partes — y
  // después se salta a la primera parte del versículo nuevo (que puede tener otra cantidad de partes).
  const applyBibleSlidePatch = (patch) => {
    if (!current) return;
    const baseId = current.baseSlideId || current.slideId;
    const primeraParte = (adHoc ? adHocIdx : activeIdx) - (current.parte || 0);
    if (adHoc) {
      setAdHoc((a) => ({ ...a, slides: a.slides.map((s) => (s.slideId === baseId ? { ...s, ...patch } : s)) }));
      setAdHocIdx(Math.max(0, primeraParte));
    } else {
      updateLiveOrder((o) => o.map((item) => (item.id === baseId ? { ...item, ...patch } : item)));
      setActiveIdx(Math.max(0, primeraParte));
    }
  };
  const navigateBibleVerse = async (direction) => {
    if (!current || current.type !== "biblia" || !current.bookId) return;
    // Con un versículo partido en varias diapositivas, avanzar entre SUS partes es "Siguiente" normal;
    // estas flechas (arriba/abajo) siempre saltan al versículo de al lado completo.
    const fromVerse = direction > 0 ? current.verseEnd : current.verseStart;
    try {
      const result = await fetchAdjacentBibleVerse(current.version, current.bookId, current.chapter, fromVerse, direction);
      if (!result) { showToast(direction > 0 ? "Ya no hay más versículos después de este en el libro." : "Este ya es el primer versículo del libro."); return; }
      const bookName = result.bookName || current.bookName;
      applyBibleSlidePatch({ reference: `${bookName} ${result.chapter}:${result.verse}`, text: result.text, chapter: result.chapter, verseStart: result.verse, verseEnd: result.verse, bookName });
    } catch {
      showToast("No se pudo cargar el versículo. Revisa tu conexión a internet.", "offline");
    }
  };

  const updateOrder = (fn) => {
    let nuevoOrden = null, anterior = null;
    setEventsSynced((evs) => evs.map((e) => {
      if (e.id !== selectedEventId) return e;
      anterior = e.serviceOrder;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) {
      // Quien no edita el Setlist completo (líder de un grupo con lo básico, encargado de una lectura)
      // manda solo lo que cambió — ver soloIds en sincronizarServiceOrder.
      let soloIds = null;
      if (!puedeEditarSetlistEvento) {
        // También las que solo cambiaron de LUGAR: al insertar algo a mitad del culto (un versículo de la
        // Lectura, las diapositivas del bosquejo) todo lo de abajo se recorre y su "orden" en la base
        // tiene que recorrerse igual, o lo nuevo quedaría con el mismo número que lo que ya estaba ahí.
        const antes = new Map((anterior || []).map((it, i) => [it.id, `${i}|${JSON.stringify(it)}`]));
        soloIds = new Set(nuevoOrden.filter((it, i) => antes.get(it.id) !== `${i}|${JSON.stringify(it)}`).map((it) => it.id));
      }
      pendingSavesRef.current++;
      sincronizarServiceOrder(selectedEventId, nuevoOrden, { soloIds }).catch((err) => notifyError("No se pudo guardar el setlist", err)).finally(() => pendingSavesRef.current--);
    }
  };
  // ---- Editor de diapositivas (escritorio, ver EditorDiapositivas.jsx) ----
  // origen: "vivo" (consola En vivo, sobre el orden del culto al aire) o el id del evento (Setlist).
  const [editorDiap, setEditorDiap] = useState(null); // { origen, itemId, indice }
  const ordenDeOrigen = (origen) => (origen === "vivo" ? liveEvent?.serviceOrder : events.find((e) => e.id === origen)?.serviceOrder) || [];
  const cambiarOrdenDeOrigen = (origen, fn) => {
    if (origen === "vivo") { cambiarOrdenEnVivo(fn); return; }
    let nuevoOrden = null;
    setEventsSynced((evs) => evs.map((e) => {
      if (e.id !== origen) return e;
      nuevoOrden = fn(e.serviceOrder);
      return { ...e, serviceOrder: nuevoOrden };
    }));
    if (nuevoOrden) {
      pendingSavesRef.current++;
      sincronizarServiceOrder(origen, nuevoOrden).catch((err) => notifyError("No se pudo guardar el setlist", err)).finally(() => pendingSavesRef.current--);
    }
  };
  const guardarEditorDiap = (diapositivas, titulo) => {
    const { itemId, eventoId } = editorDiap;
    // Si la transmisión terminó mientras se editaba, se guarda igual en el evento.
    const origen = editorDiap.origen === "vivo" && !(liveEvent && (liveLibre ? eventoId === null : liveEventId === eventoId)) ? eventoId : editorDiap.origen;
    // Diapositiva nueva diseñada desde cero ("Diseñar diapositiva"): entra como elemento nuevo.
    if (editorDiap.nuevo) {
      if (!origen || !diapositivas.length) { setEditorDiap(null); return; }
      const nuevo = itemConDiapositivas({ id: nextId(), type: "slide", title: titulo, subtitle: "" }, diapositivas);
      const despuesDe = editorDiap.despuesDe;
      cambiarOrdenDeOrigen(origen, (o) => {
        const i = despuesDe ? o.findIndex((it) => it.id === despuesDe) : -1;
        return i === -1 ? [...o, nuevo] : [...o.slice(0, i + 1), nuevo, ...o.slice(i + 1)];
      });
      setEditorDiap(null);
      showToast(`"${titulo}" se agregó al orden del culto.`, "info");
      return;
    }
    if (!origen || !ordenDeOrigen(origen).some((it) => it.id === itemId)) {
      showToast("No se pudo guardar: ese elemento ya no está en el orden del culto.");
      setEditorDiap(null);
      return;
    }
    cambiarOrdenDeOrigen(origen, (o) => (diapositivas.length
      ? o.map((it) => (it.id === itemId ? itemConDiapositivas({ ...it, title: titulo }, diapositivas) : it))
      : o.filter((it) => it.id !== itemId)));
    setEditorDiap(null);
    showToast("Diapositivas guardadas.", "info");
  };
  // Al abrir se toma una foto de las diapositivas (las viejas se convierten aquí, una sola vez).
  const abrirEditorDiap = (origen, itemId, indice = 0) => {
    const it = ordenDeOrigen(origen).find((x) => x.id === itemId);
    if (!it) return;
    setEditorDiap({ origen, eventoId: origen === "vivo" ? (liveLibre ? null : liveEventId) : origen, itemId, indice, titulo: tituloBase(it.title) || "Diapositivas", diapositivas: diapositivasDeItem(it) });
  };
  // Diseñar una diapositiva desde cero: el editor abre en blanco con las plantillas a la vista y, al
  // tocar Listo, entra al orden del culto (después de despuesDe, o al final).
  const abrirEditorNuevo = (origen, despuesDe = null) => {
    setEditorDiap({ origen, nuevo: true, despuesDe, eventoId: origen === "vivo" ? (liveLibre ? null : liveEventId) : origen, itemId: null, indice: 0, titulo: "Diapositiva", diapositivas: [nuevaDiapositiva()] });
  };
  const editorAlAire = !!(editorDiap && editorDiap.origen === "vivo" && !adHoc && current && (current.grupoId === editorDiap.itemId || current.slideId === editorDiap.itemId));
  // Mover / copiar / sacar diapositivas entre grupos (menú de clic derecho en la consola En vivo).
  const moverDiapositivaEnVivo = (args) => cambiarOrdenEnVivo((o) => moverDiapositiva(o, args));
  const quitarDiapositivaEnVivo = (itemId, indice) => cambiarOrdenEnVivo((o) => quitarDiapositivaDeGrupo(o, itemId, indice));

  // Cada canción se manda sola al bloque que le corresponde según su clasificación — a qué bloque
  // exactamente lo decide CADA iglesia (Canciones → Clasificaciones, iglesias.categorias_canciones),
  // ya no está fijo en el código ("Alabanza" para las 4 antes). Se
  // agrega al final de ese bloque, o se crea el bloque si el evento todavía no lo tiene. Los bloques
  // son simples marcadores de posición (no hay anidado real en los datos), así que "pertenecer a un
  // bloque" es estar entre ese marcador y el siguiente.
  // "¿En qué parte del culto va?" — el bloque elegido en "+ Agregar" del Setlist (null = al final).
  // Se usa para lo que se agregue mientras esa elección está abierta (ver SetlistPane).
  const [destinoSetlist, setDestinoSetlist] = useState(null);
  const colocar = (o, items) => insertarEnBloque(o, items, destinoSetlist);
  // Un bloque de alabanza nuevo queda vinculado solo al grupo de Alabanza (pedido de Eldin,
  // 2026-10-30), si la iglesia tiene exactamente un grupo con "alabanza"/"adoración" en el nombre.
  const ministerioParaBloque = (title) => {
    if (!isWorshipBlock({ type: "seccion", title })) return null;
    const candidatos = ministries.filter((m) => /alabanza|adoraci/i.test(m.name || ""));
    return candidatos.length === 1 ? candidatos[0].id : null;
  };
  const addSong = (songId) => {
    const song = library.find((s) => s.id === songId);
    const newItem = { id: nextId(), type: "cancion", songId, structure: song.defaultStructure };
    if (destinoSetlist) { updateOrder((o) => colocar(o, newItem)); return; } // eligió el bloque a mano
    const targetBlock = clasificaciones.find((c) => c.clave === song.category)?.bloque?.trim();
    updateOrder((o) => {
      if (!targetBlock) return [...o, newItem]; // sin clasificación: al final, como antes
      let blockIdx = -1;
      o.forEach((item, i) => { if (item.type === "seccion" && item.title.toLowerCase().includes(targetBlock.toLowerCase())) blockIdx = i; });
      if (blockIdx === -1) {
        return [...o, { id: nextId(), type: "seccion", title: `Bloque de ${targetBlock}`, description: `Bloque de ${targetBlock.toLowerCase()}.`, ministryId: ministerioParaBloque(`Bloque de ${targetBlock}`) }, newItem];
      }
      let insertAt = o.length;
      for (let i = blockIdx + 1; i < o.length; i++) { if (o[i].type === "seccion") { insertAt = i; break; } }
      return [...o.slice(0, insertAt), newItem, ...o.slice(insertAt)];
    });
  };
  const addBible = (b) => { updateOrder((o) => colocar(o, { id: nextId(), type: "biblia", reference: b.ref, version: b.version, text: b.text, bookId: b.bookId, bookName: b.bookName, chapter: b.chapter, verseStart: b.verseStart, verseEnd: b.verseEnd })); setShowBibleForm(false); };
  const addSlide = () => {
    if (!slideDraft.title && !(slideDraft.bgType === "video" && slideDraft.videoUrl) && !(slideDraft.bgType === "imagen" && slideDraft.imageUrl)) return; // se permite solo-video/solo-imagen sin texto
    updateOrder((o) => colocar(o, { id: nextId(), type: "slide", ...slideDraft }));
    setSlideDraft({ title: "", subtitle: "", name: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" });
    setShowSlideForm(false);
  };
  const addSeccion = (title, description) => updateOrder((o) => [...o, { id: nextId(), type: "seccion", title: title.trim() || "Nuevo bloque", description: description.trim(), ministryId: ministerioParaBloque(title.trim()) }]);
  // Punto del bosquejo del predicador: se guarda como una "slide" más (así Multimedia la proyecta igual que
  // cualquier otra), marcada con isSermonPoint para distinguirla visualmente en el Setlist y en el grid en vivo.
  const addSermonPoint = () => {
    if (!sermonPointText.trim()) return;
    updateOrder((o) => colocar(o, { id: nextId(), type: "slide", title: sermonPointText.trim(), subtitle: "", bg: "var(--wf-brand-primary)", bgType: "color", isSermonPoint: true }));
    setSermonPointText("");
    setShowSermonForm(false);
  };
  const linkMinistry = (itemId, ministryId) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, ministryId: ministryId || null } : i)));
  const updateSeccionText = (itemId, field, value) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)));
  const setSongKey = (itemId, key, defaultKey) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, keyOverride: key === defaultKey ? null : key } : i)));
  const removeItem = (id) => updateOrder((o) => o.filter((i) => i.id !== id));
  // "Deshacer" tras quitar algo del Setlist: vuelve a ponerlo en el mismo lugar (mismo id y encargados).
  const restaurarItem = (item, indice) => updateOrder((o) => (o.some((i) => i.id === item.id) ? o : [...o.slice(0, indice), item, ...o.slice(indice)]));
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
    // Al predicador se le invita de una a preparar su bosquejo (ver BosquejoWizard).
    const extra = esBloquePredicacion(item) ? " Entra al evento y toca \"Agregar bosquejo\" para preparar tu mensaje." : "";
    notificarAsignacion(usuario.id, { titulo: "Se te ha asignado", cuerpo: `Para "${label}" en "${selectedEvent?.title}".${extra}`, eventoId: selectedEventId });
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
    setEventsSynced((evs) => evs.map((e) => {
      if (e.id !== selectedEventId) return e;
      nuevo = fn(e.worshipRoles || []);
      return { ...e, worshipRoles: nuevo };
    }));
    if (nuevo) {
      pendingSavesRef.current++;
      sincronizarWorshipRoles(selectedEventId, nuevo).catch((err) => notifyError("No se pudo guardar el equipo de alabanza", err)).finally(() => pendingSavesRef.current--);
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
    notificarAsignacion(usuario.id, { titulo: "Se te ha asignado", cuerpo: `Para "${label}" en "${selectedEvent?.title}".`, eventoId: selectedEventId });
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
    if (adHoc) { setAdHocIdx(Math.min(Math.max(i, 0), adHocSlides.length - 1)); return; }
    setActiveIdx(Math.min(Math.max(i, 0), slides.length - 1));
  };
  const gotoPlanSlide = (i) => { setAdHoc(null); setAdHocIdx(0); setBlanked(false); setActiveIdx(Math.min(Math.max(i, 0), slides.length - 1)); };
  const exitAdHoc = () => { setAdHoc(null); setAdHocIdx(0); };
  const startAdHocBible = (b) => { setAdHoc({ label: `Versículo: ${b.ref}`, slides: [{ slideId: "adhoc-biblia", type: "biblia", reference: b.ref, version: b.version, text: b.text, bookId: b.bookId, bookName: b.bookName, chapter: b.chapter, verseStart: b.verseStart, verseEnd: b.verseEnd }] }); setAdHocIdx(b.parte || 0); setBlanked(false); }; // b.parte: arrancar en esa parte de un versículo largo
  const startAdHocSong = (song) => { setAdHoc({ label: `Canción: ${song.title}`, slides: songToSlides("adhoc-cancion", song, song.defaultStructure) }); setAdHocIdx(0); setBlanked(false); };
  const startAdHocVideo = (url) => { setAdHoc({ label: "Video", slides: [{ slideId: "adhoc-video", type: "slide", title: "", subtitle: "", bg: "#000", bgType: "video", videoUrl: url }] }); setAdHocIdx(0); setBlanked(false); };
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
  // Respaldo real (reportado por Eldin: el primer "Iniciar evento" del día salía sin pantalla completa
  // -- con la barra del navegador visible -- y recién el segundo o tercero entraba limpio): en algunos
  // navegadores, getScreenDetails() sin NINGÚN gesto todavía en esta carga de página no se resuelve a
  // tiempo aunque el permiso ya esté concedido de antes -- hace falta al menos un clic/toque real en
  // esta navegación, no necesariamente el de "Iniciar evento" mismo. Este reintenta en el PRIMER
  // toque de cualquier parte de la app (una vez, se desactiva solo), para que screenDetailsRef ya esté
  // listo bastante antes de que el operador llegue navegando hasta el botón de verdad.
  useEffect(() => {
    if (!("getScreenDetails" in window) || screenDetailsRef.current) return;
    const reintentar = () => {
      if (screenDetailsRef.current) return;
      window.getScreenDetails().then((sd) => { screenDetailsRef.current = sd; }).catch(() => {});
    };
    document.addEventListener("pointerdown", reintentar, { once: true });
    return () => document.removeEventListener("pointerdown", reintentar);
  }, []);
  const openOnOtherScreen = (screenDetails) => {
    // ?igl=<slug> le dice a PublicScreen (que no tiene sesión iniciada) de qué iglesia leer la sesión
    // en vivo — ver iglesia_id_por_slug en la migración 20260930000300 y PublicScreen.jsx. Si el slug
    // todavía no cargó (carrera rara al abrir muy rápido), PublicScreen cae a iglesia_id_por_defecto(),
    // que sigue siendo correcto mientras exista una sola iglesia.
    const url = `${window.location.origin}${window.location.pathname}?screen=publico${myIglesia.slug ? `&igl=${encodeURIComponent(myIglesia.slug)}` : ""}${myIglesiaId ? `&iid=${myIglesiaId}` : ""}${codigoPantalla ? `&k=${encodeURIComponent(codigoPantalla)}` : ""}`;
    const otherScreen = screenDetails.screens.find((s) => s !== screenDetails.currentScreen);
    if (!otherScreen) {
      showToast("No se detectó una segunda pantalla conectada. Conecta el proyector/monitor y vuelve a intentar para que se abra ahí solo.");
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
      showToast("Este navegador no permite detectar una segunda pantalla automáticamente. Usa Chrome o Edge para que la proyección se abra sola ahí.");
      return;
    }
    if (screenDetailsRef.current) { openOnOtherScreen(screenDetailsRef.current); return; }
    try {
      const screenDetails = await window.getScreenDetails();
      screenDetailsRef.current = screenDetails;
      openOnOtherScreen(screenDetails);
    } catch {
      showToast("No se pudo detectar las pantallas conectadas (permiso denegado). Conecta el proyector/monitor y vuelve a intentar.");
    }
  };
  // Si ya hay algo en vivo (un evento real o una transmisión libre) y se va a reemplazar por otra cosa,
  // confirma antes — mismo diálogo para las tres combinaciones (evento→evento, evento→libre, libre→evento).
  const confirmReplaceLive = async (excludeEventId) => {
    if (!liveEventId && !liveLibre) return true;
    if (liveEventId && liveEventId === excludeEventId) return true;
    const otherTitle = liveLibre ? "Transmisión libre" : events.find((e) => e.id === liveEventId)?.title;
    return confirmDialog(`"${otherTitle}" ya está en vivo. ¿Finalizarlo e iniciar esto en su lugar?`, { textoConfirmar: "Finalizar e iniciar" });
  };
  // Escribe el estado de Modo Músico (líder, canción/sección/tempo/auto-avance actuales) para que se
  // vea igual en todos los dispositivos de la banda — ver SongView, que es quien de verdad decide CUÁNDO
  // llamar esto (solo el líder escribe; los seguidores solo leen vía musicoState). Silencioso a propósito:
  // es una señal de sincronización en vivo frecuente, no algo que merezca una alerta si falla una vez.
  const updateMusicoState = (patch) => {
    setMusicoState((s) => ({ ...(s || {}), ...patch }));
    const dbPatch = {};
    if ("liderId" in patch) dbPatch.lider_id = patch.liderId;
    if ("liderNombre" in patch) dbPatch.lider_nombre = patch.liderNombre;
    if ("songItemId" in patch) dbPatch.song_item_id = patch.songItemId;
    if ("sectionIdx" in patch) dbPatch.section_idx = patch.sectionIdx;
    if ("bpm" in patch) dbPatch.bpm = patch.bpm;
    if ("auto" in patch) dbPatch.auto = patch.auto;
    if ("heartbeat" in patch) dbPatch.heartbeat = patch.heartbeat;
    updateMusicoLive(myIglesiaId, dbPatch).catch(() => {});
  };
  // Nadie hereda como "líder" de Modo Músico al culto de hoy solo porque lo fue en el anterior — se
  // limpia al arrancar una transmisión nueva Y al finalizar una (ver endEvent), así que ni "reemplazar"
  // una en vivo por otra sin pasar por Finalizar (confirmReplaceLive arriba) deja un líder colgado.
  const resetMusicoLive = () => {
    setMusicoState(null);
    setUnidoAlLider(false);
    clearMusicoLive(myIglesiaId).catch(() => {});
  };
  const empezarPractica = (eventId) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    if (userId === liveOwnerId && (liveEventId || liveLibre)) {
      showToast("Estás transmitiendo en vivo desde esta computadora. Finaliza el culto antes de practicar.");
      return;
    }
    setPractica({ eventId: ev.id, title: ev.title, serviceOrder: JSON.parse(JSON.stringify(ev.serviceOrder || [])) });
    setActiveIdx(0); setBlanked(false); setFijada(null); setAdHoc(null); setAdHocIdx(0); setTab("envivo");
  };
  const salirPractica = () => {
    const eventId = practica?.eventId;
    setPractica(null); setActiveIdx(0); setBlanked(false); setFijada(null); setAdHoc(null); setAdHocIdx(0);
    if (eventId) { setSelectedEventId(eventId); setTab("eventos"); } else setTab("eventos");
  };
  const avisoPractica = (que) => showToast(`En la práctica no se ${que}. Sal de la práctica para hacerlo de verdad.`);
  const startEvent = async (eventId) => {
    if (!(await confirmReplaceLive(eventId))) return;
    setPractica(null);
    setLiveEventId(eventId); setLiveLibre(false); setLiveOwnerId(userId); setActiveIdx(0); setBlanked(false); setFijada(null); setAdHoc(null); setAdHocIdx(0); resetMusicoLive(); setTab("envivo");
    startPresentation(); // abre/enfoca la pantalla de proyección de una vez, sin paso manual extra
  };
  // Transmitir sin un evento del calendario detrás — para anuncios, oración u otro contenido suelto que
  // no amerita crear/usar un evento planificado. Todo el contenido sale de "Improvisar" (Biblia/canción/
  // video) o de diapositivas agregadas a mano (ver libreServiceOrder) — nunca de un setlist real.
  const startFreeEvent = async () => {
    if (!(await confirmReplaceLive(null))) return;
    setPractica(null);
    setLiveEventId(null); setLiveLibre(true); setLiveOwnerId(userId); setActiveIdx(0); setBlanked(false); setFijada(null); setAdHoc(null); setAdHocIdx(0); setLibreServiceOrder([]); resetMusicoLive(); setTab("envivo");
    startPresentation();
  };
  const endEvent = () => {
    setLiveEventId(null); setLiveLibre(false); setLiveOwnerId(null); setBlanked(false); setFijada(null); setAdHoc(null); setAdHocIdx(0); setLibreServiceOrder([]); setTab("eventos");
    // También por el canal local: si no hay internet, la pantalla de esta computadora igual se apaga.
    filaAlAireRef.current = null;
    const filaFin = { evento_id: null, liderado_por: null, slide_actual: null, blanked: false, estilo_en_vivo: liveStyle, ad_hoc_label: null, libre: false };
    if (myIglesiaId) { broadcastLiveSession(myIglesiaId, filaFin); enviarAPantallas(myIglesiaId, codigoPantalla, filaFin); }
    // Al cerrar la sesión, la base cambia el código de las pantallas: el enlace de este culto vence.
    clearLiveSession(myIglesiaId)
      .then(() => obtenerCodigoPantalla().then((c) => { if (c) setCodigoPantalla(c); }))
      .catch((e) => { if (!esFalloDeConexion(e)) notifyError("No se pudo cerrar la sesión en vivo", e); });
    resetMusicoLive();
  };

  const toggleFavorite = (songId) => {
    const song = library.find((s) => s.id === songId);
    if (!song) return;
    const nuevoValor = !song.favorite;
    setLibrary((lib) => lib.map((s) => (s.id === songId ? { ...s, favorite: nuevoValor } : s)));
    pendingSavesRef.current++;
    // Solo la marca de favorita (antes reescribía la canción entera: letra, partes y estructura) — así
    // cualquiera puede marcarla sin tener permiso de editar el cancionero (ver permisos en la base).
    updateCancion(songId, { favorito: nuevoValor }).catch((e) => notifyError("No se pudo guardar", e)).finally(() => pendingSavesRef.current--);
  };
  // Corregir/agregar letra de una canción DESDE la pantalla en vivo de Multimedia (ver MultimediaControl)
  // — a diferencia de editar la canción desde Canciones (solo administradores), esto lo puede hacer
  // cualquiera que controle la transmisión (Multimedia también), porque el caso de uso es exactamente
  // "nos dimos cuenta en pleno culto de que esta letra está mal" y no hay tiempo de ir a buscar a un
  // administrador. El cambio queda guardado en la canción de una — no es solo para esta transmisión — así
  // que la próxima vez que se use esta canción (en este evento o en cualquier otro) ya sale bien.
  // Se aplica sobre la letra COMPLETA tal como se está proyectando y se guarda la canción entera —
  // ver letraEnVivo.js: tocar una sola fila borraba la canción entera en las que nunca pasaron por
  // la pestaña Letra.
  const cambiarLetraEnVivo = (songId, cambio, mensajeError) => {
    const song = library.find((s) => s.id === songId);
    if (!song) return false;
    let nuevaLetra;
    try {
      nuevaLetra = typeof cambio === "function" ? cambio(song) : aplicarCambioLetra(song, cambio);
    } catch (e) {
      notifyError(mensajeError, e);
      return false;
    }
    setLibrary((lib) => lib.map((s) => (s.id === songId ? { ...s, letra: nuevaLetra } : s)));
    pendingSavesRef.current++;
    guardarLetraCancion(songId, nuevaLetra)
      .catch((e) => notifyError(mensajeError, e))
      .finally(() => pendingSavesRef.current--);
    return true;
  };
  const editSongSlideLive = (songId, blockKey, slideIndexInBlock, nuevoTexto) =>
    cambiarLetraEnVivo(songId, { tipo: "editar", blockKey, indice: slideIndexInBlock, texto: nuevoTexto }, "No se pudo guardar la corrección en la canción");
  // La diapositiva nueva entra justo DESPUÉS de la que se estaba viendo (no al final de la sección), y
  // solo si trae texto — una vacía nunca se proyecta y antes quedaba "invisible".
  const addSongSlideLive = (songId, blockKey, afterIndex, texto, cortarDespuesDeLinea) =>
    cambiarLetraEnVivo(songId, { tipo: "agregar", blockKey, indice: afterIndex, texto, cortarDespuesDeLinea }, "No se pudo agregar la diapositiva");
  // Borrar o mover diapositivas de una sección desde la consola: la sección se rearma con los pedazos
  // que quedan, en el orden nuevo (ver rearmarSeccion). También queda guardado en la canción.
  const rearmarSeccionLive = (songId, blockKey, segmentos, mensajeError) =>
    cambiarLetraEnVivo(songId, (song) => rearmarSeccion(song, blockKey, segmentos), mensajeError);
  // Corregir la letra COMPLETA de una canción desde la consola (pedido de Eldin, 2026-10-18): en vez de
  // diapositiva por diapositiva, se abre todo el texto (cada parte con su nombre, una línea en blanco =
  // diapositiva nueva) y se guarda de una. Mismo convertidor que la pestaña Escribir del editor de
  // canciones (textoALetra): las partes que no estén en el texto no se borran. Devuelve los avisos.
  const editarLetraCompletaLive = (songId, texto) => {
    const song = library.find((s) => s.id === songId);
    if (!song) return null;
    const base = { ...song, letra: letraEfectiva(song) };
    const r = textoALetra(texto, base);
    const cambiaronPartes = JSON.stringify(Object.keys(r.blocks)) !== JSON.stringify(Object.keys(song.blocks || {})) || JSON.stringify(r.defaultStructure) !== JSON.stringify(song.defaultStructure || []);
    if (cambiaronPartes || JSON.stringify(r.blocks) !== JSON.stringify(song.blocks)) {
      persistSongDraft({ ...song, blocks: r.blocks, letra: r.letra, defaultStructure: r.defaultStructure }).catch((e) => notifyError("No se pudo guardar la letra", e));
    } else {
      cambiarLetraEnVivo(songId, () => r.letra, "No se pudo guardar la letra");
    }
    return r.avisos || [];
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
    if (transposed) {
      pendingSavesRef.current++;
      guardarCancionDesdeEditor(transposed, true, userId).catch((e) => notifyError("No se pudo guardar la transposición", e)).finally(() => pendingSavesRef.current--);
    }
  };
  // Guarda el borrador en Supabase y refleja el resultado en la librería en memoria, sin decidir qué
  // pantalla mostrar después — lo reutilizan tanto "Guardar" (que sí navega a la vista de la canción)
  // como la confirmación de "Guardar y salir" al presionar atrás con cambios sin guardar (que navega
  // a donde el usuario iba, no de vuelta a la canción).
  const persistSongDraft = (draft) => {
    const existeEnDb = library.some((s) => s.id === draft.id);
    pendingSavesRef.current++;
    return guardarCancionDesdeEditor(draft, existeEnDb, userId).then((idReal) => {
      const guardado = { ...draft, id: idReal };
      setLibrary((lib) => (existeEnDb ? lib.map((s) => (s.id === draft.id ? guardado : s)) : [...lib, guardado]));
      return idReal;
    }).finally(() => pendingSavesRef.current--);
  };
  const saveSong = (draft) => {
    return persistSongDraft(draft)
      .then((idReal) => setOpenSong({ id: idReal, mode: "view" }))
      .catch((e) => { notifyError("No se pudo guardar la canción", e); throw e; });
  };
  const deleteSong = async (song) => {
    if (!(await confirmDialog(`¿Eliminar "${song.title}"? Esto no se puede deshacer.`, { danger: true, textoConfirmar: "Eliminar" }))) return;
    setLibrary((lib) => lib.filter((s) => s.id !== song.id));
    setOpenSong(null);
    deleteCancion(song.id).catch((e) => notifyError("No se pudo eliminar la canción", e));
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
    setEventsSynced((evs) => [...evs, newEvent]);
    crearEventoCompleto(newEvent, userId).catch((e) => notifyError("No se pudo guardar el evento", e));
    setSelectedEventId(newEvent.id);
    if (template && !esPlantilla) setDraftFromTemplateId(newEvent.id);
  };
  const deleteEvent = async (event) => {
    if (event.id === liveEventId) { showToast("No puedes eliminar un evento que está en vivo — finalízalo primero."); return; }
    if (!(await confirmDialog(`¿Eliminar "${event.title}"? Esto borra también su Setlist y sus encargados. No se puede deshacer.`, { danger: true, textoConfirmar: "Eliminar" }))) return;
    setEventsSynced((evs) => evs.filter((e) => e.id !== event.id));
    setSelectedEventId(null);
    deleteEvento(event.id).catch((e) => notifyError("No se pudo eliminar el evento", e));
  };

  // Recordatorios: mismo patrón que updateMinistry — calcula el nuevo valor dentro del setter y
  // sincroniza con ESE valor (no con el estado viejo que todavía tendría el closure).
  const updateEventReminders = (eventId, fn) => {
    let nuevo = null;
    setEventsSynced((evs) => evs.map((e) => {
      if (e.id !== eventId) return e;
      nuevo = fn(e);
      return nuevo;
    }));
    if (nuevo) {
      pendingSavesRef.current++;
      sincronizarRecordatorios(eventId, nuevo.reminders).catch((e) => notifyError("No se pudo guardar el recordatorio", e)).finally(() => pendingSavesRef.current--);
    }
  };
  const addReminder = (eventId, cantidad, unidad) => updateEventReminders(eventId, (e) => ({ ...e, reminders: [...(e.reminders || []), { id: nextId(), cantidad, unidad, enviado: false }] }));
  const removeReminder = (eventId, reminderId) => updateEventReminders(eventId, (e) => ({ ...e, reminders: (e.reminders || []).filter((r) => r.id !== reminderId) }));
  const setEventHora = (eventId, hora) => {
    setEventsSynced((evs) => evs.map((e) => (e.id === eventId ? { ...e, hora: hora || null } : e)));
    updateEvento(eventId, { hora: hora || null }).catch((e) => notifyError("No se pudo guardar la hora", e));
  };
  // Ensayo y nota de quien dirige (ver InicioView y EnsayoAlabanzaCard). Se guarda al terminar de editar.
  const setEventEnsayo = (eventId, { ensayoFecha, ensayoHora, notaAlabanza }) => {
    setEventsSynced((evs) => evs.map((e) => (e.id === eventId ? { ...e, ensayoFecha: ensayoFecha || null, ensayoHora: ensayoHora || null, notaAlabanza: notaAlabanza || "" } : e)));
    return updateEvento(eventId, { ensayo_fecha: ensayoFecha || null, ensayo_hora: ensayoHora || null, nota_alabanza: (notaAlabanza || "").trim() || null })
      .catch((e) => { notifyError("No se pudo guardar el ensayo", e); throw e; });
  };
  // Edita los datos propios del evento/plantilla (título, fecha, hora, ubicación) DESPUÉS de creado —
  // antes solo se podían fijar una vez, al crearlo, y no había forma de corregirlos ni de renombrar
  // una plantilla ya armada.
  const updateEventDetails = (eventId, { title, dateLabel, date, hora, location }) => {
    setEventsSynced((evs) => evs.map((e) => (e.id === eventId ? { ...e, title, dateLabel: dateLabel || "", date: date || null, hora: hora || null, location: location || "" } : e)));
    updateEvento(eventId, { titulo: title, fecha_label: dateLabel || null, fecha: date || null, hora: hora || null, ubicacion: location || null })
      .catch((e) => notifyError("No se pudo guardar el evento", e));
  };

  const favoritesCount = library.filter((s) => s.favorite).length;

  // ---- Identidad y control de acceso REALES: vienen de la cuenta con la que iniciaste sesión (perfil,
  // desde AuthGate) — ya no un selector que cualquiera podía cambiarse solo. Un rol lo asigna un
  // administrador desde Usuarios. Solo un administrador puede "probar" cómo se ve la app con otro
  // rol/persona (ver Ajustes) — para todos los demás su acceso queda fijo a su cuenta real.
  const ROLE_DB_TO_LABEL = { admin: "Administrador", multimedia: "Multimedia", musico: "Músico", miembro: "Miembro", supervisor: "Supervisor" };
  const realIsAdmin = perfil?.rol === "admin";
  const realRoleLabel = ROLE_DB_TO_LABEL[perfil?.rol] || "Miembro";
  const realName = perfil?.nombre || "";
  // Fase 2b (multi-iglesia): sesiones_en_vivo/musico_en_vivo son una fila POR IGLESIA, no una sola
  // para toda la base — ver src/lib/liveSession.js y src/lib/musicoLive.js. Todo lo que las toca en
  // este componente necesita saber la iglesia del usuario actual; perfil ya la trae (columna
  // iglesia_id agregada en la Fase 2a).
  const myIglesiaId = perfil?.iglesia_id;
  // myIglesia (slug/nombre/logo/colores) y el useEffect que aplica --wf-brand-primary/accent ya NO
  // viven acá — se movieron a AuthGate.jsx (que los pasa como prop) porque este componente se
  // DESMONTA por completo al entrar a Usuarios/Roles/Consola general (son vistas hermanas, no hijas,
  // ver AuthGate.jsx) — el useEffect de acá limpiaba las variables de color apenas se desmontaba,
  // así que el color personalizado "se perdía" (volvía al de Buen Pastor) justo al entrar a esas
  // pantallas. AuthGate SÍ se queda montado siempre que haya sesión, sin importar la vista.
  const [roleOverride, setRoleOverride] = useState(null); // solo un admin lo puede poner (ver Ajustes)
  const [nameOverride, setNameOverride] = useState(null);
  const [usuariosRealesSinOrden, setUsuariosReales] = useState([]); // miembros de ESTA iglesia
  const usuariosReales = useMemo(() => ordenarPor(usuariosRealesSinOrden, (u) => u.nombre), [usuariosRealesSinOrden]); // alfabético
  // Filtro explícito por iglesia: la RLS ya limita a la propia iglesia a casi todos, pero un super
  // administrador de la plataforma (Consola general) tiene además permiso de ver usuarios de TODAS
  // las iglesias, y sin este filtro le aparecían mezclados con los suyos en toda la app.
  useEffect(() => {
    if (!perfil?.iglesia_id) return;
    supabase.from("usuarios").select("id, nombre, rol, rol_id, foto_url").eq("iglesia_id", perfil.iglesia_id).order("nombre").then(({ data }) => setUsuariosReales(data || []));
  }, [perfil?.iglesia_id]);
  // ---- Roles configurables (Ajustes → Roles): además de los 5 roles de fábrica (admin/multimedia/
  // musico/miembro/supervisor, chequeados por texto en todo el código de abajo), un administrador
  // puede crear roles nuevos con permisos a la medida — ver src/lib/roles.js. Los permisos de un rol
  // configurable se SUMAN (con OR) a los chequeos de texto existentes, nunca los reemplazan: así
  // ningún rol de fábrica pierde nada, y un rol nuevo solo gana exactamente lo que el administrador
  // le activó.
  const [rolesApp, setRolesApp] = useState([]);
  useEffect(() => {
    supabase.from("roles_app").select("id, nombre, permisos, protegido").then(({ data }) => setRolesApp(data || []));
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
  // ---- Permisos de un rol CONFIGURABLE (Ajustes → Roles) para la identidad actualmente activa —
  // la real, o la que se esté simulando si es un administrador probando "Simular identidad". Se
  // resuelve aquí (antes de myUserId, que no existe todavía en este punto) para poder usarlo abajo
  // en canControlLive/canStartLive/isAdminViewer/esSupervisorViewer.
  const identidadActivaRow = realIsAdmin && nameOverride ? usuariosReales.find((u) => u.nombre === nameOverride) : usuariosReales.find((u) => u.id === userId);
  const rolPersonalizadoActivo = identidadActivaRow?.rol_id ? rolesApp.find((r) => r.id === identidadActivaRow.rol_id) : null;
  const tienePermiso = (clave) => !!rolPersonalizadoActivo?.permisos?.[clave];
  // Administrador y Multimedia controlan la transmisión en vivo — así ningún músico o miembro puede
  // detenerla por accidente desde su teléfono (ver Ajustes → "Rol de este dispositivo"). Un rol
  // configurable con el permiso "iniciar_finalizar_vivo"/"controlar_estilo_vivo" también puede.
  const canControlLive = myRole === "Administrador" || myRole === "Multimedia" || tienePermiso("iniciar_finalizar_vivo") || tienePermiso("controlar_estilo_vivo");
  // Iniciar la transmisión es más delicado que solo controlarla ya en marcha: Multimedia y Administrador
  // ven el botón "Iniciar evento", y únicamente desde un escritorio — nunca desde un teléfono, para que
  // solo se inicie desde el equipo conectado de verdad. Mismo criterio para un rol configurable.
  const canStartLive = (myRole === "Multimedia" || myRole === "Administrador" || tienePermiso("iniciar_finalizar_vivo")) && !isCompact;
  // Biblioteca de Canciones (pestaña + favoritas de Inicio): solo Administrador, Músico o un rol
  // configurable con "ver_canciones" — es lo que distingue a Músico de Miembro. OJO: no afecta el
  // Setlist de un evento — quien está asignado a Alabanza esa semana sigue viendo sus canciones y
  // acordes desde el evento (ver decidirVisibilidadSetlist), tenga el rol que tenga.
  const canSeeCanciones = myRole === "Administrador" || myRole === "Músico" || tienePermiso("ver_canciones") || tienePermiso("gestionar_canciones");
  useEffect(() => {
    if (!canSeeCanciones && tab === "canciones") { setTab("inicio"); setOpenSong(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSeeCanciones, tab]);
  const myName = realIsAdmin && nameOverride ? nameOverride : realName;
  const isAdminViewer = (realIsAdmin && nameOverride ? usuariosReales.find((u) => u.nombre === nameOverride)?.rol === "admin" : realIsAdmin) || tienePermiso("editar_eventos_setlist");
  // Permisos más finos que "editar_eventos_setlist" (que sigue existiendo, sin tocar, para quien ya
  // lo usa): cada uno amplía isAdminViewer SOLO en su propia área, en vez de dar acceso de admin a
  // todo. Se aplican en el único sitio donde cada componente recibe isAdminViewer como prop (ver más
  // abajo) — no reemplazan isAdminViewer en general, que sigue gobernando lo demás (simular
  // identidad, asistente, etc.). Usuarios, roles e identidad de la iglesia son solo del
  // Administrador real (además lo exige la RLS de usuarios/roles_app/iglesias).
  // "Organizar eventos" incluye ver todos los eventos y editar su Setlist (ver PERMISOS_APP.incluye).
  // OJO: myUserId tiene que ir ANTES de lideroGrupoCon/puedeGestionarCanciones, que lo usan al
  // renderizar — declarado más abajo dejaba la app en blanco para todo el que no es administrador
  // (bug 2026-10-31: "Cannot access before initialization").
  const myUserId = realIsAdmin && nameOverride ? usuariosReales.find((u) => u.nombre === nameOverride)?.id : userId;
  const [ministriesSinOrden, setMinistries] = useState([]);
  const ministries = useMemo(() => ordenarPor(ministriesSinOrden, (m) => m.name), [ministriesSinOrden]); // alfabético
  // ¿Lidero algún grupo que le da a su líder este permiso? (permisos por grupo, ver PERMISOS_LIDER)
  const lideroGrupoCon = (clave) => ministries.some((m) => m.leaderId === myUserId && m.permisosLider?.[clave]);
  const puedeGestionarEventos = isAdminViewer || tienePermiso("gestionar_eventos"); // Crear eventos y plantillas, ajustes del evento, recordatorios, publicar y eliminar
  const puedeEditarSetlist = puedeGestionarEventos || tienePermiso("editar_setlist"); // Setlist de un evento: agregar/quitar/reordenar, versículos, slides, tonalidades por evento, encargados y equipo de alabanza
  const puedeGestionarCanciones = isAdminViewer || tienePermiso("gestionar_canciones") || lideroGrupoCon("gestionar_canciones"); // Biblioteca: crear/editar/transportar/borrar canciones
  const puedeGestionarMinisterios = isAdminViewer || tienePermiso("gestionar_ministerios"); // Crear ministerios, su planificación, recursos y líder
  // Al simular otra identidad (ver "Simular identidad" en Ajustes) los eventos visibles también deben
  // ser los de ESA persona, no los del admin real — si no, probar "¿ve Miembro X solo lo suyo?" no
  // serviría de nada.
  // Notas por parte de la canción: las "del líder" las escriben quienes arman el setlist o las canciones.
  // El clip de una canción se enciende/apaga al momento al agregar/quitar su último adjunto.
  const marcarAdjuntos = (songId, tiene) => setLibrary((prev) => prev.map((s) => (s.id === songId && s.hasAttachment !== tiene ? { ...s, hasAttachment: tiene } : s)));
  const notasCtx = useMemo(() => ({ usuarioId: myUserId, nombre: myName, puedeEquipo: puedeEditarSetlist || puedeGestionarCanciones }), [myUserId, myName, puedeEditarSetlist, puedeGestionarCanciones]);
  // Un evento está "asignado a mí" si me pusieron como encargado de algún bloque/canción/versículo del
  // Setlist, o si estoy en el roster del equipo de alabanza de ese evento (ej. "Guitarra").
  // Grupos que lidero — el líder de un grupo ve los eventos donde ese grupo está vinculado a un bloque.
  const gruposQueLideroYo = useMemo(() => new Set(ministries.filter((m) => m.leaderId === myUserId).map((m) => m.id)), [ministries, myUserId]);
  const isEventAssignedToMe = (event, uid) =>
    (event.serviceOrder || []).some((item) => (item.encargados || []).some((m) => m.usuarioId === uid)) ||
    (event.worshipRoles || []).some((r) => (r.members || []).some((m) => m.usuarioId === uid));
  // Las plantillas son eventos normales marcados con esPlantilla: no aparecen en el feed de cultos
  // reales (Inicio, Eventos, Mi Horario), solo en el selector "crear desde plantilla" y en la vista
  // de administración de plantillas — ambas armadas por administradores generales. Además, solo
  // administradores y Supervisor ven TODOS los eventos reales sin filtro — todos los demás
  // (Multimedia, Músico, Miembro) solo ven aquellos a los que efectivamente se les asignó algo. Sin
  // esto, un Supervisor sin ninguna asignación en un evento puntual (ej. el pastor, que no figura en
  // ningún bloque del Setlist) ni siquiera veía que ese evento existiera — no alcanzaba con que
  // decidirVisibilidadSetlist lo dejara ver todo POR DENTRO del evento, si la lista de Eventos ya lo
  // filtraba afuera antes de poder entrar.
  const esSupervisorViewer = usuariosReales.find((u) => u.id === myUserId)?.rol === "supervisor" || tienePermiso("ver_todos_eventos");
  const realEvents = events.filter((e) => !e.esPlantilla && (puedeEditarSetlist || esSupervisorViewer || isEventAssignedToMe(e, myUserId) || (e.serviceOrder || []).some((it) => lideraBloque(it, gruposQueLideroYo))));
  const plantillas = events.filter((e) => e.esPlantilla);
  // Agregar versículos al Setlist es de administradores, con una sola excepción: quien esté asignado
  // como encargado de un bloque de Lectura bíblica/Oración EN ESTE EVENTO puede agregar su propio
  // versículo para esa lectura, aunque no sea administrador.
  // Setlist del evento abierto: además del permiso general (rol), el líder de un grupo vinculado a este
  // evento si su grupo le da "Editar el Setlist".
  const puedeEditarSetlistEvento = puedeEditarSetlist || permisoLiderEnEvento(selectedEvent, ministries, myUserId, "editar_setlist");
  const canAddBibleReading = () => puedeEditarSetlistEvento || !!(selectedEvent?.serviceOrder || []).find(
    (it) => isBibleReadingBlock(it) && (it.encargados || []).some((m) => m.usuarioId === myUserId)
  );
  const canAddSermonPoints = () => puedeEditarSetlistEvento;
  // ---- Bosquejo del predicador (2026-11-01): quien está asignado a un bloque de Predicación (o quien
  // edita el Setlist) lo arma paso a paso; al enviarlo se vuelve diapositivas del Setlist (ver bosquejos.js).
  const puedeBosquejo = (block) => esBloquePredicacion(block) && (puedeEditarSetlistEvento || (block.encargados || []).some((m) => m.usuarioId === myUserId));
  const bloqueBosquejo = bosquejoAbierto ? (selectedEvent?.serviceOrder || []).find((it) => it.id === bosquejoAbierto) : null;
  // En vivo, el predicador ya no lo cambia (Multimedia sí puede corregir desde la consola).
  const bosquejoBloqueado = !!bloqueBosquejo && liveEventId === selectedEventId && !puedeEditarSetlistEvento;
  const ponerBosquejoLocal = (eventoId, bloqueId, guardado) => setEventsSynced((evs) => evs.map((e) => (
    e.id === eventoId ? { ...e, bosquejos: { ...(e.bosquejos || {}), [bloqueId]: guardado } } : e
  )));
  const guardarBorradorBosquejo = async (b) => {
    const eventoId = selectedEventId, bloqueId = bosquejoAbierto;
    try {
      const guardado = await guardarBosquejo(eventoId, bloqueId, b);
      ponerBosquejoLocal(eventoId, bloqueId, guardado);
      return guardado;
    } catch (err) {
      notifyError("No se pudo guardar el bosquejo", err);
      throw err;
    }
  };
  const enviarBosquejo = async (b) => {
    const eventoId = selectedEventId, bloqueId = bosquejoAbierto;
    try {
      const guardado = await guardarBosquejo(eventoId, bloqueId, b, { enviado: true });
      ponerBosquejoLocal(eventoId, bloqueId, guardado);
      updateOrder((o) => aplicarBosquejoAlOrden(o, bloqueId, bosquejoAItems(b, bloqueId, nextId)));
      // Aviso a Multimedia (los destinatarios los decide el servidor). Si falla, el bosquejo ya quedó enviado igual.
      callUsersFunction("notificar-asignacion", { accion: "bosquejo_enviado", bloque_id: bloqueId })
        .catch((e) => console.warn("No se pudo avisar a Multimedia del bosquejo:", e.message));
      showToast("Bosquejo enviado. Multimedia ya tiene tus diapositivas.", "info");
      return guardado;
    } catch (err) {
      notifyError("No se pudo enviar el bosquejo", err);
      throw err;
    }
  };
  const bosquejoInfo = { puede: puedeBosquejo, abrir: setBosquejoAbierto, bosquejos: selectedEvent?.bosquejos || {} };

  // ---- Estilo en vivo de la proyección: declarado más arriba (antes de `slides`), porque el tamaño de
  // letra decide en cuántas partes se dividen los versículos largos ----

  // ---- Sincroniza la pantalla pública (ventana/dispositivo aparte) vía Supabase Realtime — ya no
  // BroadcastChannel, que solo funcionaba dentro del mismo navegador: ahora el panel de control y la
  // proyección pueden estar en computadoras distintas de verdad. Solo transmite mientras hay un
  // evento en vivo Y este dispositivo es quien lo está llevando (si no, un músico que solo está
  // observando "En vivo" encendido en su teléfono pisaría por accidente lo que Multimedia proyecta).
  // ---- Pantalla de escenario (stage display, 2026-11-01): lo que sigue, la parte de la canción, la
  // siguiente canción, el mensaje de Multimedia y la hora de inicio viajan junto con la diapositiva al
  // aire (slide_actual.escenario) — ver lib/escenario.js y PantallaEscenario.jsx. ----
  const [mensajeEscenario, setMensajeEscenario] = useState("");
  const [inicioVivo, setInicioVivo] = useState(null);
  const llevoLaTransmision = !practica && !!(liveEventId || liveLibre) && userId === liveOwnerId;
  // Temporizador del mensaje (2026-11-02): lo maneja Multimedia desde el panel Escenario; se ve grande en
  // la pantalla de escenario. Puede arrancar solo al empezar la predicación (autoTemporizador).
  const [temporizador, setTemporizador] = useState(null);
  const [autoTemporizador, setAutoTemporizador] = useState(() => loadCache("escenario_auto_temporizador") || { activo: false, duracionSeg: 30 * 60 });
  useEffect(() => { saveCache("escenario_auto_temporizador", autoTemporizador); }, [autoTemporizador]);
  useEffect(() => {
    if (!llevoLaTransmision) { setInicioVivo(null); setMensajeEscenario(""); setTemporizador(null); return; }
    // Si la consola se recarga a mitad del culto, el tiempo sigue contando desde el inicio real (y el temporizador también).
    const clave = liveEventId || "libre";
    const guardado = loadCache("escenario_inicio");
    const inicio = guardado?.clave === clave && guardado?.inicio ? guardado.inicio : new Date().toISOString();
    saveCache("escenario_inicio", { clave, inicio });
    setInicioVivo(inicio);
    const tGuardado = loadCache("escenario_temporizador");
    setTemporizador(tGuardado?.clave === clave ? tGuardado.t || null : null);
  }, [llevoLaTransmision, liveEventId]);
  useEffect(() => {
    if (llevoLaTransmision) saveCache("escenario_temporizador", { clave: liveEventId || "libre", t: temporizador });
  }, [temporizador, llevoLaTransmision, liveEventId]);
  // ¿Lo que está al aire es de la predicación? Al entrar, el temporizador arranca solo (si está activado).
  const enPredicacion = useMemo(() => {
    const alAire = fijada || current;
    if (!llevoLaTransmision || !alAire || adHoc) return false;
    const orden = liveEvent?.serviceOrder || [];
    return estaEnPredicacion(orden, orden.find((it) => it.type !== "seccion" && perteneceA(alAire, it.id)) || null);
  }, [llevoLaTransmision, fijada, current, adHoc, liveEvent]);
  const enPredicacionAntesRef = useRef(false);
  useEffect(() => {
    if (enPredicacion && !enPredicacionAntesRef.current && autoTemporizador.activo && !temporizadorActivo(temporizador)) {
      setTemporizador(iniciarTemporizador(autoTemporizador.duracionSeg));
    }
    enPredicacionAntesRef.current = enPredicacion;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enPredicacion]);
  const escenario = useMemo(() => {
    if (!llevoLaTransmision) return null;
    const alAire = fijada || current || null;
    const indice = adHoc ? -1 : fijada ? slides.findIndex((x) => x.slideId === fijada.slideId) : activeIdx;
    return armarEscenario({ slides, indice, alAire, serviceOrder: liveEvent?.serviceOrder || [], library, mensaje: mensajeEscenario, inicio: inicioVivo, bosquejos: liveEvent?.bosquejos || {}, temporizador });
  }, [llevoLaTransmision, fijada, current, adHoc, slides, activeIdx, liveEvent, library, mensajeEscenario, inicioVivo, temporizador]);
  const escenarioClave = escenario ? JSON.stringify(escenario) : "";

  useEffect(() => {
    if (practica || (!liveEventId && !liveLibre) || userId !== liveOwnerId) return;
    const alAire = (fijada || current) || null;
    const fila = { evento_id: liveEventId, liderado_por: userId, slide_actual: alAire ? (escenario ? { ...alAire, escenario } : alAire) : null, blanked, estilo_en_vivo: liveStyle, ad_hoc_label: adHoc?.label || null, libre: liveLibre };
    // Se manda por las dos vías a la vez: BroadcastChannel llega al instante si la pantalla de
    // proyección está en la MISMA computadora (caso típico: TV por HDMI como segunda pantalla) — así el
    // cambio de diapositiva no depende del internet del lugar, igual que un presentador local. Supabase
    // sigue siendo el camino real cuando la proyección de verdad está en otro dispositivo aparte.
    if (!myIglesiaId) return;
    filaAlAireRef.current = fila;
    broadcastLiveSession(myIglesiaId, fila);
    enviarAPantallas(myIglesiaId, codigoPantalla, fila);
    // Sin internet (2026-10-17): la pantalla en ESTA computadora ya recibió el cambio por el canal local,
    // así que la falla de internet no se avisa en cada diapositiva (asustaba sin razón). Se anota como
    // pendiente y se manda solo apenas vuelve la señal (ver el efecto de "online" justo abajo).
    updateLiveSession(myIglesiaId, fila)
      .then(() => { sincroPendienteRef.current = false; })
      .catch((e) => { if (esFalloDeConexion(e)) sincroPendienteRef.current = true; else notifyError("No se pudo actualizar la proyección", e); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, blanked, liveStyle, liveEventId, liveLibre, liveOwnerId, adHoc, userId, myIglesiaId, practica, fijada, escenarioClave, codigoPantalla]);
  // Código vigente de las pantallas: al abrir la app y cada vez que empieza una transmisión (al terminar
  // lo pide endEvent, DESPUÉS de cerrar la sesión, para no quedarse con el código que acaba de vencer).
  const codigoPedidoRef = useRef(false);
  useEffect(() => {
    if (!myIglesiaId) return;
    if (codigoPedidoRef.current && !liveEventId && !liveLibre) return;
    codigoPedidoRef.current = true;
    let vivo = true;
    obtenerCodigoPantalla().then((c) => { if (vivo && c) setCodigoPantalla(c); });
    return () => { vivo = false; };
  }, [myIglesiaId, liveEventId, liveLibre]);
  // Lo que está al aire ahora: para responderle a una pantalla de proyección que se abre o se recarga
  // sin internet, y para mandarlo a Supabase cuando vuelve la señal.
  useEffect(() => {
    if (!myIglesiaId) return;
    const quitarRespuesta = responderPedidosDeEstado(myIglesiaId, () => filaAlAireRef.current);
    const alVolver = () => {
      if (!sincroPendienteRef.current || !filaAlAireRef.current) return;
      updateLiveSession(myIglesiaId, filaAlAireRef.current).then(() => { sincroPendienteRef.current = false; }).catch(() => {});
    };
    window.addEventListener("online", alVolver);
    return () => { quitarRespuesta(); window.removeEventListener("online", alVolver); };
  }, [myIglesiaId]);

  // ---- Sincroniza EN TIEMPO REAL, en todos los dispositivos, si hay un evento en vivo ahora mismo y
  // quién lo está llevando — así el indicador "En vivo" (pestaña, franja de Inicio, tarjeta del evento)
  // se enciende para músicos/miembros apenas Multimedia inicia la transmisión, sin que cada quien tenga
  // que haberlo iniciado desde su propio teléfono. Antes esto era solo estado local: cada dispositivo
  // solo se enteraba de un evento en vivo si ÉL MISMO lo había iniciado.
  useEffect(() => {
    if (!myIglesiaId) return;
    getLiveSession(myIglesiaId)
      .then((fila) => {
        // Si a alguien se le olvidó tocar "Finalizar evento" (ej. se cerró la compu al terminar el
        // culto), la sesión se queda marcada en vivo para SIEMPRE — cualquiera que abra la app un día
        // después (o meses después) la hereda como si el culto siguiera transmitiendo. Un día entero sin
        // ningún cambio (updateLiveSession se llama en cada diapositiva/estilo mientras alguien la está
        // usando de verdad) es buena señal de que quedó abandonada, así que el primer dispositivo que
        // abre la app después de eso la cierra sola, sin pedirle nada a nadie.
        const abandonada = (fila?.evento_id || fila?.libre) && fila?.updated_at && (Date.now() - new Date(fila.updated_at).getTime() > LIVE_SESSION_STALE_MS);
        if (abandonada) {
          clearLiveSession(myIglesiaId).catch(() => {});
          setLiveEventId(null); setLiveOwnerId(null); setLiveLibre(false);
          return;
        }
        setLiveEventId(fila?.evento_id || null); setLiveOwnerId(fila?.liderado_por || null); setLiveLibre(!!fila?.libre);
        adoptarEstiloGuardado(fila?.estilo_en_vivo);
      })
      .catch(() => {});
    const unsubscribe = subscribeLiveSession(myIglesiaId, (fila) => {
      setLiveEventId(fila.evento_id || null);
      setLiveOwnerId(fila.liderado_por || null);
      setLiveLibre(!!fila.libre);
      // Solo si lo cambió OTRO dispositivo: quien transmite ya tiene su estilo, y adoptar su propio eco
      // volvería a disparar el envío de la sesión.
      if (fila.liderado_por !== userIdRef.current) adoptarEstiloGuardado(fila.estilo_en_vivo);
    });
    return unsubscribe;
  }, [myIglesiaId]);

  // ---- Modo Músico líder/seguidor: estado propio (tabla musico_en_vivo, no sesiones_en_vivo — ver
  // src/lib/musicoLive.js) para que cualquier músico pueda tomar el mando sin necesitar el permiso de
  // escritura restringido a Multimedia. Se sincroniza siempre (no solo mientras hay un evento en vivo):
  // el "active" real por evento lo decide cada SongView con isLiveNow, esto solo mantiene musicoState al día.
  useEffect(() => {
    if (!myIglesiaId) return;
    const refrescar = () => getMusicoLive(myIglesiaId).then((fila) => setMusicoState(filaAMusicoState(fila))).catch(() => {});
    refrescar();
    const unsubscribe = subscribeMusicoLive(myIglesiaId, (fila) => setMusicoState(filaAMusicoState(fila)));
    // Si ESTE dispositivo (el líder, por ejemplo) es el que se quedó sin internet, no solo deja de
    // avisar que sigue vivo — también deja de ENTERARSE de lo que pasó mientras estuvo desconectado
    // (ej. que alguien más tomó el mando con el botón de "reiniciar"). Realtime no reenvía los
    // cambios perdidos durante el corte, así que sin este refresco al volver la señal, el líder
    // original podría reaparecer todavía creyéndose líder y pisarle el mando a quien lo tomó de
    // verdad. "online" fuerza a traer el estado real de una en cuanto vuelve la conexión.
    window.addEventListener("online", refrescar);
    return () => { unsubscribe(); window.removeEventListener("online", refrescar); };
  }, [myIglesiaId]);

  // ---- Ministerios ----
  // (ministries se declara más arriba, junto a isEventAssignedToMe — la lista de eventos lo necesita)
  const [selectedMinistryId, setSelectedMinistryId] = useState(null);
  // Grupos: solo administradores ven todos; quien lidera uno o más grupos ve la pestaña pero solo SUS
  // propios grupos (no los de los demás), aunque tenga dos o más asignados. Quien solo está a cargo de
  // un bloque del Setlist vinculado a un ministerio NO necesita entrar a Grupos para nada de eso — ya
  // ve la planificación y los recursos completos directamente en su bloque del Setlist (ver
  // RestrictedGroupPanel), sin exponerle una pestaña aparte.
  const myMinistries = ministries.filter((m) => m.leaderId === myUserId);
  const canSeeGrupos = puedeGestionarMinisterios || myMinistries.length > 0;
  const visibleMinistries = puedeGestionarMinisterios ? ministries : myMinistries;
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
    // pendingSavesRef: mientras el guardado está en vuelo, el refresco en tiempo real no adopta datos
    // (ni cambia la línea base que este guardado está usando).
    if (nuevo.plan !== anterior.plan) {
      pendingSavesRef.current++;
      sincronizarPlan(id, nuevo.plan).catch((e) => notifyError("No se pudo guardar la planificación", e)).finally(() => pendingSavesRef.current--);
    }
    if (nuevo.resources !== anterior.resources) {
      pendingSavesRef.current++;
      sincronizarRecursos(id, nuevo.resources).catch((e) => notifyError("No se pudo guardar el recurso", e)).finally(() => pendingSavesRef.current--);
    }
  };
  // La planificación se edita como borrador local dentro de MinistryDetail (ver planDraft ahí) y solo
  // llega hasta acá cuando se toca "Guardar planificación" — un solo guardado con todo el arreglo final,
  // no uno por cada tecla, para no chocar con el refresco de sincronizarTableChanges (ver realtime.js).
  const savePlanForMinistry = async (id, plan) => {
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, plan } : m)));
    pendingSavesRef.current++;
    try { await sincronizarPlan(id, plan); } finally { pendingSavesRef.current--; }
  };
  const addResource = (id, resource) => updateMinistry(id, (m) => ({ ...m, resources: [...m.resources, { id: nextMinistryChildId(), ...resource }] }));
  const editResource = (id, resourceId, patch) => updateMinistry(id, (m) => ({ ...m, resources: m.resources.map((r) => (r.id === resourceId ? { ...r, ...patch } : r)) }));
  const removeResource = (id, resourceId) => updateMinistry(id, (m) => ({ ...m, resources: m.resources.filter((r) => r.id !== resourceId) }));
  const createMinistry = ({ name, leaderId, color }) => {
    const leaderName = usuariosReales.find((u) => u.id === leaderId)?.nombre || "";
    const newM = { id: nextId(), name, leaderId: leaderId || null, leaderName, color, memberCount: 0, plan: [], resources: [] };
    setMinistries((ms) => [...ms, newM]);
    crearMinisterio(newM, userId).catch((e) => notifyError("No se pudo guardar el ministerio", e));
    setSelectedMinistryId(newM.id);
  };
  const setMinistryLeader = (id, leaderId) => {
    const previousLeaderId = ministries.find((m) => m.id === id)?.leaderId || null;
    const leaderName = usuariosReales.find((u) => u.id === leaderId)?.nombre || "";
    const ministryName = ministries.find((m) => m.id === id)?.name || "un grupo";
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, leaderId: leaderId || null, leaderName } : m)));
    actualizarLiderMinisterio(id, leaderId || null).catch((e) => notifyError("No se pudo actualizar el líder", e));
    if (leaderId) notificarAsignacion(leaderId, { titulo: "Se te ha asignado", cuerpo: `Como líder del grupo "${ministryName}". Podrás asignar encargados en los bloques del Setlist vinculados a este grupo.` });
    if (previousLeaderId && previousLeaderId !== leaderId) notificarAsignacion(previousLeaderId, { titulo: "Ya no eres líder", cuerpo: `Dejaste de ser líder del grupo "${ministryName}".` });
  };
  const setMinistryName = (id, name) => {
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, name } : m)));
    actualizarNombreMinisterio(id, name).catch((e) => notifyError("No se pudo actualizar el nombre", e));
  };
  const setMinistryPermisosLider = (id, permisosLider) => {
    const anteriores = ministries.find((m) => m.id === id)?.permisosLider || {};
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, permisosLider } : m)));
    actualizarPermisosLider(id, permisosLider).catch((e) => {
      setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, permisosLider: anteriores } : m)));
      notifyError("No se pudo guardar lo que puede hacer el líder", e);
    });
  };
  const setMinistryColor = (id, color) => {
    setMinistries((ms) => ms.map((m) => (m.id === id ? { ...m, color } : m)));
    actualizarColorMinisterio(id, color).catch((e) => notifyError("No se pudo actualizar el color", e));
  };
  // Borrar un ministerio deja sin vincular (no borra) cualquier bloque del Setlist que lo usaba —
  // items_servicio.ministerio_id tiene ON DELETE SET NULL — así que ningún evento pasado se rompe,
  // solo deja de traer la planificación automática y vuelve a mostrar su descripción escrita a mano.
  const deleteMinistry = async (ministry) => {
    if (!(await confirmDialog(`¿Eliminar el grupo "${ministry.name}"? Esto no se puede deshacer. Los bloques del Setlist que lo tenían vinculado dejarán de traer su planificación sola.`, { danger: true, textoConfirmar: "Eliminar" }))) return;
    setMinistries((ms) => ms.filter((m) => m.id !== ministry.id));
    setSelectedMinistryId(null);
    eliminarMinisterio(ministry.id).catch((e) => notifyError("No se pudo eliminar el grupo", e));
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
          pendingSavesRef.current++;
          guardarCancionDesdeEditor(draft, existeEnDb, userIdRef.current)
            .then((idReal) => {
              const guardado = { ...draft, id: idReal };
              setLibrary((lib) => (existeEnDb ? lib.map((s) => (s.id === draft.id ? guardado : s)) : [...lib, guardado]));
              clearTimeout(songAutoSaveToastTimeoutRef.current);
              setSongAutoSaveToast(true);
              songAutoSaveToastTimeoutRef.current = setTimeout(() => setSongAutoSaveToast(false), 2200);
            })
            .catch((e2) => notifyError("No se pudo guardar la canción", e2))
            .finally(() => pendingSavesRef.current--);
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
    if (draft) persistSongDraft(draft).catch((e) => notifyError("No se pudo guardar la canción", e));
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
  // Respaldo en este dispositivo de los eventos que ya marqué como vistos (2026-10-09): si un día la
  // lista de "vistos" no carga del servidor (sin señal, error momentáneo), el aviso NO debe volver a
  // salirle a quien ya lo vio. El servidor sigue siendo lo que ve el administrador.
  const claveVistos = userId ? `worshipflow_vistos_${userId}` : null;
  const [vistosLocales, setVistosLocales] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(claveVistos) || "[]")); } catch { return new Set(); }
  });
  const guardarVistoLocal = (eventId, visto) => setVistosLocales((prev) => {
    const sig = new Set(prev);
    if (visto) sig.add(eventId); else sig.delete(eventId);
    try { localStorage.setItem(claveVistos, JSON.stringify([...sig].slice(-300))); } catch { /* sin almacenamiento local */ }
    return sig;
  });
  const pendingConfirmations = useMemo(() => {
    if (!userId) return [];
    return events
      .filter((e) => !e.esPlantilla && isUpcoming(e))
      .map((e) => ({ event: e, cargos: misAsignacionesEnEvento(e, userId, library) }))
      .filter(({ event: e, cargos }) => cargos.length > 0 && !(e.vistas || []).some((v) => v.usuarioId === userId) && !vistosLocales.has(e.id))
      .sort((a, b) => compareByDay(a.event, b.event));
  }, [events, userId, library, vistosLocales]);
  const confirmarAsignacionVista = (eventId) => {
    // Optimista: se refleja de una vez en pantalla, pero si el guardado real falla (red, permisos,
    // lo que sea) se revierte y se avisa — antes el error se tragaba en silencio y la persona (y el
    // admin viéndolo desde otro dispositivo) se quedaban creyendo que sí quedó marcado como visto.
    setEventsSynced((evs) => evs.map((e) => (e.id === eventId ? { ...e, vistas: [...(e.vistas || []).filter((v) => v.usuarioId !== userId), { usuarioId: userId, vistoAt: new Date().toISOString() }] } : e)));
    guardarVistoLocal(eventId, true);
    marcarAsignacionVista(eventId, userId).catch((err) => {
      guardarVistoLocal(eventId, false);
      setEventsSynced((evs) => evs.map((e) => (e.id === eventId ? { ...e, vistas: (e.vistas || []).filter((v) => v.usuarioId !== userId) } : e)));
      notifyError("No se pudo confirmar que viste este evento", err);
    });
  };

  // ---------------- Tutorial / recorridos guiados ----------------
  // "bienvenida" sale la primera vez que alguien nuevo entra (miembro invitado o administrador de una
  // iglesia recién creada); los demás son mini recorridos que salen la primera vez que se abre esa
  // pantalla. Lo ya visto vive en usuarios.tutoriales_vistos (ver migración 20261002000000) — a los
  // usuarios que ya existían se les marcó todo como visto. Se guarda optimista: aunque falle la red,
  // no se le repite en esta sesión.
  const [tutorialesVistos, setTutorialesVistos] = useState(() => new Set(perfil?.tutoriales_vistos || []));
  // AuthGate monta este componente con perfil todavía en null (la consulta a "usuarios" es asíncrona,
  // ver AuthGate.jsx) — el useState de arriba solo lee perfil en ESE primer instante, así que sin esto
  // el tutorial "ya visto" se perdía en cada apertura nueva de la app (useState no se vuelve a evaluar
  // cuando perfil llega después). Se MEZCLA con lo que ya había en vez de reemplazarlo, para no pisar un
  // "recién marcado como visto" de esta misma sesión que todavía no volvió desde el servidor.
  useEffect(() => {
    if (!perfil?.tutoriales_vistos?.length) return;
    setTutorialesVistos((prev) => new Set([...prev, ...perfil.tutoriales_vistos]));
  }, [perfil?.tutoriales_vistos]);
  const [tourActivo, setTourActivo] = useState(null); // null | clave del recorrido abierto
  // Claves con versión (ver CLAVES_TUTORIAL): un recorrido que cambió mucho se le vuelve a mostrar a
  // todos, no solo a los nuevos.
  const claveTourParaPantalla = (() => {
    const C = CLAVES_TUTORIAL;
    if (!tutorialesVistos.has(C.bienvenida)) return tab === "inicio" ? C.bienvenida : null;
    if (tab === "eventos" && !selectedEventId && !openSong) return C.eventos;
    if (tab === "eventos" && selectedEvent && !openSong) return C.evento;
    if (tab === "canciones" && !openSong) return C.canciones;
    if (tab === "canciones" && openSong?.mode === "edit") return C.editorCancion;
    if (tab === "envivo" && liveEvent && !isCompact) return C.envivo;
    return null;
  })();
  const tourPendiente = claveTourParaPantalla && !tutorialesVistos.has(claveTourParaPantalla) ? claveTourParaPantalla : null;
  // Espera a que la pantalla termine de entrar (animación screen-enter), y a que no esté encima el
  // aviso obligatorio de "cargos sin confirmar", ni la simulación de identidad de Ajustes.
  useEffect(() => {
    if (!datosListos || !tourPendiente || tourActivo || pendingConfirmations.length > 0 || nameOverride) return;
    const t = setTimeout(() => setTourActivo(tourPendiente), 700);
    return () => clearTimeout(t);
  }, [datosListos, tourPendiente, tourActivo, pendingConfirmations.length, nameOverride]);
  const pasosTour = (() => {
    const ctx = { esAdmin: realIsAdmin, puedeGestionarEventos, puedeGestionarCanciones };
    switch (tourActivo) {
      case CLAVES_TUTORIAL.bienvenida: return pasosBienvenida(ctx);
      case CLAVES_TUTORIAL.eventos: return pasosEventos(ctx);
      case CLAVES_TUTORIAL.evento: return pasosEvento(ctx);
      case CLAVES_TUTORIAL.canciones: return pasosCanciones(ctx);
      case CLAVES_TUTORIAL.editorCancion: return pasosEditorCancion(ctx);
      case CLAVES_TUTORIAL.envivo: return pasosEnVivo(ctx);
      default: return null;
    }
  })();
  const terminarTour = () => {
    const clave = tourActivo;
    setTourActivo(null);
    if (!clave) return;
    setTutorialesVistos((prev) => new Set(prev).add(clave));
    marcarTutorialVisto(clave).catch((err) => console.warn("No se pudo guardar el tutorial visto:", err));
  };
  const verTutorialDeNuevo = () => {
    setTutorialesVistos(new Set());
    setTourActivo(null);
    setTab("inicio"); setSelectedEventId(null); setOpenSong(null); setSelectedMinistryId(null);
    reiniciarTutoriales().catch((err) => notifyError("No se pudo reiniciar el tutorial", err));
  };

  // ---------------- Aviso para activar notificaciones push ----------------
  // Mucha gente nunca llegó a activarlas (se les invitó antes de que existiera el paso de Ajustes, o
  // lo saltaron ahí) y por eso no les llegan avisos de asignaciones ni recordatorios. A diferencia de
  // PushPrompt (AuthGate.jsx, solo al crear la cuenta por primera vez), este aviso vive en Inicio y
  // puede volver a aparecer más adelante — pero sin bloquear nada: se puede cerrar, y si se cierra no
  // insiste de nuevo hasta dentro de unos días (fecha guardada en localStorage, por dispositivo —
  // conveniencia del aparato, no estado que haga falta recordar entre dispositivos). Se fija si tiene
  // alguna suscripción en CUALQUIER dispositivo (no solo este) para no insistirle a alguien que ya las
  // activó en su celular solo porque hoy entró desde la computadora.
  const PUSH_NAG_KEY = "wf_push_aviso_oculto_hasta";
  const PUSH_NAG_DIAS = 4;
  const [avisoPush, setAvisoPush] = useState(null); // null = no aplica | { permiso }
  useEffect(() => {
    if (!datosListos || !userId) return;
    const permiso = estadoPermisoNotificacion();
    if (permiso === "sin-soporte") return; // este navegador nunca va a poder — no insistir
    tieneAlgunaSuscripcionPush(userId)
      .then((tiene) => {
        const accion = decidirAccionPush({ tieneSuscripcion: tiene, permiso });
        if (accion === "nada") return;
        if (accion === "reinscribir-en-silencio") {
          // Si falla (sin red, etc.) se reintenta solo la próxima vez que abra la app — no hace
          // falta mostrarle nada por un fallo en algo que de entrada no le pedía nada.
          suscribirPush(userId).catch(() => {});
          return;
        }
        // "mostrar-aviso" — respetando que lo haya cerrado hace poco.
        let ocultoHasta = 0;
        try { ocultoHasta = Number(localStorage.getItem(PUSH_NAG_KEY) || 0); } catch { /* localStorage no disponible (incógnito estricto) — se muestra igual */ }
        if (Date.now() < ocultoHasta) return;
        setAvisoPush({ permiso });
      })
      .catch(() => {}); // sin red, etc. — simplemente no se muestra esta vez, no hay nada más que avisar
  }, [datosListos, userId]);
  const ocultarAvisoPush = () => {
    setAvisoPush(null);
    try { localStorage.setItem(PUSH_NAG_KEY, String(Date.now() + PUSH_NAG_DIAS * 86_400_000)); } catch { /* ídem */ }
  };
  const activarPushDesdeAviso = async () => {
    try {
      await suscribirPush(userId);
      setAvisoPush(null);
    } catch {
      // Lo más probable es que el navegador acabe de bloquearlo al pedir permiso — se refleja el
      // estado real (puede haber pasado de "default" a "denied") para mostrar las instrucciones de
      // desbloqueo en vez de dejar el mismo botón que acaba de fallar.
      setAvisoPush({ permiso: estadoPermisoNotificacion() });
    }
  };

  if (!datosListos) {
    return <div className="app-shell-height" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", color: "var(--wf-faint)", fontFamily: "'Poppins', sans-serif", fontSize: 14 }}>Cargando…</div>;
  }

  return (
    <div className="app-shell-height" style={{ fontFamily: "'Poppins', sans-serif", background: "var(--wf-bg)", color: "var(--wf-text)", display: "flex", flexDirection: "column", position: "relative", overflowX: "hidden" }}>
      <style>{`
        /* El @import de Google Fonts que vivía acá se movió a index.css -- esta pantalla nunca
           llegaba a la pantalla real de Proyección (PublicScreen.jsx es una entrada HTML aparte),
           así que la mitad de las fuentes de LIVE_FONTS nunca cargaban ahí. Ver la nota en index.css. */
        @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:.35; } }
        .live-dot { animation: pulseDot 1.6s ease-in-out infinite; }
        @keyframes glowPulse { 0%,100% { opacity:.55; transform: scale(1); } 50% { opacity:.85; transform: scale(1.04); } }
        .spotlight-glow { animation: glowPulse 3.2s ease-in-out infinite; }
        @keyframes brilloEnVivo { 0%,100% { box-shadow: 0 8px 22px rgba(232,130,30,.35), 0 0 0 0 rgba(232,130,30,.35); } 50% { box-shadow: 0 10px 34px rgba(232,130,30,.6), 0 0 0 6px rgba(232,130,30,.12); } }
        .tarjeta-en-vivo { animation: brilloEnVivo 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .tarjeta-en-vivo { animation: none; box-shadow: 0 10px 30px rgba(232,130,30,.5); } }
        .hoverable:hover { background:var(--wf-hover) !important; }
        .thumb:hover { transform: translateY(-2px); }
        .thumb { transition: transform .15s; }
        .orden-fila .orden-quitar { opacity: 0; transition: opacity .12s; }
        .orden-fila:hover .orden-quitar, .orden-fila:focus-within .orden-quitar { opacity: 1; }
        .navitem { transition: transform .15s, background .15s; }
        .navitem:active { transform: scale(0.92); }
        input, textarea, select { font-family: inherit; }
      `}</style>

      {editorDiap && (
        <Suspense fallback={null}>
          <EditorDiapositivas
            key={`${editorDiap.origen}-${editorDiap.itemId}`}
            titulo={editorDiap.titulo}
            diapositivas={editorDiap.diapositivas}
            indiceInicial={editorDiap.indice || 0}
            alAire={editorAlAire}
            iglesiaId={myIglesiaId}
            nueva={!!editorDiap.nuevo}
            onGuardar={guardarEditorDiap}
            onCerrar={() => setEditorDiap(null)}
          />
        </Suspense>
      )}

      {/* Mientras un administrador ve la app como otra persona/rol (Ajustes → Mi iglesia), una franja
          arriba se lo recuerda y le deja volver a sí mismo con un toque. */}
      {realIsAdmin && (nameOverride || roleOverride) && (
        <div style={{ background: "#5661B3", color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "6px 12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Eye size={14} />
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Viendo como {nameOverride || roleOverride}{nameOverride && roleOverride ? ` · ${roleOverride}` : ""}</span>
          <button onClick={() => { setNameOverride(null); setRoleOverride(null); }} style={{ background: "#fff", color: "#5661B3", border: "none", borderRadius: 10, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>Volver a mí</button>
        </div>
      )}
      {(usingCachedData || isOffline) && (
        <div style={{ background: "var(--wf-brand-accent)", color: "var(--wf-text)", fontSize: 12, fontWeight: 700, textAlign: "center", padding: "6px 10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <WifiOff size={13} />
          {usingCachedData
            ? "Sin conexión — mostrando la última versión guardada en este dispositivo. Los cambios no se guardarán hasta que vuelva el internet."
            : (liveEventId || liveLibre) && userId === liveOwnerId
              ? "Sin internet — la proyección en esta computadora sigue funcionando. Se sincroniza sola cuando vuelva la señal."
              : "Sin conexión a internet — sigue usando la app con normalidad, se sincronizará sola apenas vuelva la señal."}
        </div>
      )}

      {/* A propósito SIN botón de cerrar/X ni click-fuera-para-cerrar — la única forma de que
          desaparezca es tocando "Ya vi mi participación" en cada evento listado. Ver
          pendingConfirmations más arriba. */}
      {pendingConfirmations.length > 0 && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,10,14,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 20 }}>
          <div style={{ background: "var(--wf-card)", borderRadius: 20, padding: 22, width: 380, maxWidth: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--wf-active-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <EyeOff size={20} color="var(--wf-brand-accent)" />
              </div>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
              Tienes {pendingConfirmations.length === 1 ? "un cargo" : `${pendingConfirmations.length} cargos`} sin confirmar
            </div>
            <div style={{ fontSize: 12.5, color: "var(--wf-muted)", textAlign: "center", marginBottom: 16 }}>
              Toca cada uno para avisar que ya lo viste.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pendingConfirmations.map(({ event: ev, cargos }) => (
                <button
                  key={ev.id}
                  onClick={() => confirmarAsignacionVista(ev.id)}
                  className="hoverable"
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--wf-active-bg)", border: "1.5px solid var(--wf-brand-accent)", borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}
                >
                  <EyeOff size={18} color="var(--wf-active-text)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{ev.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--wf-active-text)", marginTop: 1 }}>{formatFullDate(ev.date) || ev.dateLabel} · Te toca: {cargos.join(", ")}</div>
                  </span>
                  <ChevronRight size={16} color="var(--wf-brand-accent)" style={{ flexShrink: 0 }} />
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
      <div style={{ background: "var(--wf-brand-primary)", padding: "calc(16px + env(safe-area-inset-top)) 20px 26px", borderRadius: "0 0 28px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(232,130,30,0.15)" }} />
        <div style={{ position: "absolute", bottom: -40, left: 40, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {/* Fondo blanco detrás del logo (el ícono ya trae su propio fondo blanco, pero el círculo
                asegura que se vea igual sobre el header azul marino) — sin zoom (contain, no cover) para
                que se vea el logo COMPLETO (antes se recortaba la "J" de "Jesús" al hacerle zoom). El
                logo de ESTA iglesia (Fase 5) — ver AppLogo.jsx: sin logoUrl cae al trazo genérico, no
                al de Jesús El Buen Pastor, para que una iglesia nueva no vea un logo que no es el suyo. */}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--wf-card)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
              <AppLogo width={32} logoUrl={myIglesia.logoUrl} />
            </div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--wf-on-brand-primary)" }}>WorshipFlow</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {liveEvent && (
              <button onClick={() => setTab("envivo")} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "4px 10px", cursor: "pointer" }}>
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#F0704A" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#FFD9C7" }}>EN VIVO</span>
              </button>
            )}
            <button data-tour="campana" onClick={() => setShowNotifications(true)} title="Notificaciones" style={{ position: "relative", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <Bell size={15} color="#fff" />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -3, right: -3, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", fontSize: 9, fontWeight: 800, borderRadius: 12, minWidth: 14, height: 14, lineHeight: "14px", textAlign: "center", padding: "0 2px" }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {tourActivo && pasosTour && <Tour key={tourActivo} pasos={pasosTour} onTerminar={terminarTour} />}

      {showNotifications && (
        <ModalShell title="Notificaciones" icon={Bell} color="var(--wf-brand-accent)" onClose={() => setShowNotifications(false)}>
          {unreadCount > 0 && (
            <button onClick={markAllNotificationsRead} style={{ ...ghostToggleBtn, marginBottom: 10 }}>Marcar todas como leídas</button>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
            {notifications.length === 0 && <div style={{ fontSize: 13, color: "var(--wf-faint)", textAlign: "center", padding: "20px 0" }}>No tienes notificaciones todavía.</div>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className="hoverable"
                style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", textAlign: "left", background: n.leido ? "var(--wf-card)" : "var(--wf-active-bg)", border: n.leido ? "1px solid var(--wf-hover)" : "1px solid var(--wf-active-text)", borderRadius: 14, padding: "10px 12px", cursor: n.evento_id ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!n.leido && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--wf-brand-accent)", flexShrink: 0 }} />}
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{n.titulo}</span>
                </div>
                {n.cuerpo && <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>{n.cuerpo}</div>}
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
        <InicioView events={realEvents} library={library} ministries={ministries} myUserId={myUserId} myName={myName} puedeVerPendientes={puedeEditarSetlist} favoritesCount={favoritesCount} memberCount={usuariosReales.length} liveEventId={liveEventId} liveLibre={liveLibre} isCompact={isCompact} canSeeCanciones={canSeeCanciones} teamName={myIglesia.nombre} onSelectEvent={goToEvent} onGoLive={() => setTab("envivo")} onGoToTeam={realIsAdmin && onGoToUsuarios ? onGoToUsuarios : () => setTab("ajustes")} onOpenSong={(id) => { setTab("canciones"); setOpenSong({ id, mode: "view" }); }} avisoPush={avisoPush} onActivarPush={activarPushDesdeAviso} onOcultarPush={ocultarAvisoPush} />
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
          onGoToRoles={onGoToRoles}
          onGoToPlataforma={onGoToPlataforma}
          userId={userId}
          myIglesiaId={myIglesiaId}
          teamName={myIglesia.nombre}
          isCompact={isCompact}
          onVerTutorial={verTutorialDeNuevo}
        />
      )}

      {tab === "ministerios" && !selectedMinistryId && (
        <MinistriesList ministries={visibleMinistries} usuariosReales={usuariosReales} isAdminViewer={puedeGestionarMinisterios} onSelect={setSelectedMinistryId} onCreate={createMinistry} />
      )}
      {tab === "ministerios" && selectedMinistryId && (
        <MinistryDetail
          myIglesiaId={myIglesiaId}
          ministry={ministries.find((m) => m.id === selectedMinistryId)}
          usuariosReales={usuariosReales}
          isAdminViewer={puedeGestionarMinisterios}
          canEdit={puedeGestionarMinisterios || ministries.find((m) => m.id === selectedMinistryId)?.leaderId === myUserId}
          onBack={() => window.history.back()}
          onSavePlan={(plan) => savePlanForMinistry(selectedMinistryId, plan)}
          onAddResource={(resource) => addResource(selectedMinistryId, resource)}
          onEditResource={(resourceId, patch) => editResource(selectedMinistryId, resourceId, patch)}
          onRemoveResource={(resourceId) => removeResource(selectedMinistryId, resourceId)}
          onSetLeader={(leaderId) => setMinistryLeader(selectedMinistryId, leaderId)}
          onSetName={(name) => setMinistryName(selectedMinistryId, name)}
          onSetColor={(color) => setMinistryColor(selectedMinistryId, color)}
          onSetPermisosLider={(permisos) => setMinistryPermisosLider(selectedMinistryId, permisos)}
          onDelete={() => deleteMinistry(ministries.find((m) => m.id === selectedMinistryId))}
        />
      )}

      {realIsAdmin && (
        // A diferencia del resto de las pantallas (que se desmontan al cambiar de pestaña), esta se
        // mantiene montada siempre y solo se oculta con CSS — así la conversación con el asistente
        // (y un plan pendiente de confirmar) sobrevive si el admin va a mirar Eventos/Canciones/etc.
        // y vuelve, en vez de perderse cada vez que sale de esta pestaña. Sigue sin sobrevivir a
        // cerrar la app del todo o recargar la página — eso sería guardar el historial en Supabase,
        // que a propósito no se hace (ver AsistenteChatScreen).
        <div style={{ display: tab === "asistente" ? "contents" : "none" }}>
          <AsistenteChatScreen />
        </div>
      )}

      {tab === "canciones" && openSong === null && (
        <CancionesList library={library} clasificaciones={clasificaciones} puedeConfigurarClasificaciones={realIsAdmin && isAdminViewer} onGuardarClasificaciones={guardarClasificaciones} isAdminViewer={puedeGestionarCanciones} onToggleFavorite={toggleFavorite} onOpen={(id) => setOpenSong({ id, mode: "view" })} onNew={() => setOpenSong({ id: null, mode: "edit" })} onImportarPdf={() => setImportandoPdf(true)} onDelete={deleteSong} />
      )}
      {importandoPdf && (
        <ImportarCancionesPdf library={library} clasificaciones={clasificaciones} iglesiaId={myIglesiaId} userId={userId}
          onCerrar={() => setImportandoPdf(false)} onImportadas={() => reloadLibrary()} />
      )}
      {tab === "canciones" && openSong && openSong.mode === "view" && (
        <SongView song={library.find((s) => s.id === openSong.id)} notasCtx={notasCtx} iglesiaId={myIglesiaId} onAdjuntosChange={marcarAdjuntos} isAdminViewer={puedeGestionarCanciones} mode="biblioteca" onBack={() => window.history.back()} onEdit={() => setOpenSong({ id: openSong.id, mode: "edit" })} onTranspose={transposeSong} onDelete={deleteSong} />
      )}
      {tab === "canciones" && openSong && openSong.mode === "edit" && (
        <SongEditor
          song={openSong.id ? library.find((s) => s.id === openSong.id) : null}
          isAdminViewer={puedeGestionarCanciones}
          onCancel={() => requestLeaveSongEditor(() => window.history.back())}
          onSave={saveSong}
          onDirtyChange={(d) => { songEditDirtyRef.current = d; }}
          draftGetterRef={songDraftGetterRef}
        />
      )}
      {songExitPrompt && (
        <ModalShell title="Cambios sin guardar" icon={Pencil} color="var(--wf-brand-accent)" onClose={handleKeepEditingSong}>
          <div style={{ fontSize: 13, color: "var(--wf-text-2)", marginBottom: 16 }}>Esta canción tiene cambios sin guardar. ¿Qué quieres hacer antes de salir?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={handleSaveSongEdit} style={primaryBtn}>Guardar y salir</button>
            <button onClick={handleDiscardSongEdit} style={{ ...primaryBtn, background: "var(--wf-hover)", color: "#C23B32" }}>Descartar cambios y salir</button>
            <button onClick={handleKeepEditingSong} style={{ ...primaryBtn, background: "none", boxShadow: "none" }}>Seguir editando</button>
          </div>
        </ModalShell>
      )}
      {songAutoSaveToast && (
        <div style={{ position: "fixed", left: "50%", bottom: 88, transform: "translateX(-50%)", background: "var(--wf-brand-primary)", color: "var(--wf-on-brand-primary)", fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 999, boxShadow: "0 8px 24px rgba(22,50,79,0.3)", zIndex: 200, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={16} color="#5CD6A9" /> Cambios guardados
        </div>
      )}

      {tab === "eventos" && !selectedEvent && (
        <EventList events={realEvents} plantillas={plantillas} isAdminViewer={puedeGestionarEventos} liveEventId={liveEventId} liveLibre={liveLibre} onSelect={setSelectedEventId} onCreate={createEvent} canStartLive={canStartLive} onStartFree={startFreeEvent} library={library} myUserId={myUserId} />
      )}

      {tab === "eventos" && selectedEvent && !openSong && (
        <EventDetail
          onAbrirEditor={(itemId) => abrirEditorDiap(selectedEvent.id, itemId, 0)}
          onDisenarNueva={(despuesDe) => abrirEditorNuevo(selectedEvent.id, typeof despuesDe === "string" ? despuesDe : null)}
          myIglesiaId={myIglesiaId}
          event={selectedEvent} library={library} ministries={ministries} isCompact={isCompact}
          isLive={selectedEvent.id === liveEventId} canStartLive={canStartLive} isAdminViewer={puedeGestionarEventos}
          puedeEditarSetlist={puedeEditarSetlistEvento}
          userId={myUserId} usuariosReales={usuariosReales}
          onBack={() => window.history.back()}
          isDraftFromTemplate={selectedEvent.id === draftFromTemplateId}
          onPublish={() => { setDraftFromTemplateId(null); window.history.back(); }}
          onStart={() => startEvent(selectedEvent.id)} onPracticar={() => empezarPractica(selectedEvent.id)} onGoLive={() => setTab("envivo")} onDelete={deleteEvent}
          onAddSong={addSong} onAddSeccion={addSeccion}
          onAddBibleClick={() => setShowBibleForm(true)} onAddSlideClick={() => setShowSlideForm(true)} onAddItems={(items) => updateOrder((o) => colocar(o, items))}
          destinoAgregar={destinoSetlist} onDestinoAgregar={setDestinoSetlist}
          onEditarItem={(itemId, patch) => updateOrder((o) => o.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))}
          onRemove={removeItem} onRestaurar={restaurarItem} onDuplicate={duplicateItem} onReorder={reorderItem}
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
          onSetEnsayo={(datos) => setEventEnsayo(selectedEvent.id, datos)}
          onUpdateEventDetails={(details) => updateEventDetails(selectedEvent.id, details)}
          onMarkVisto={confirmarAsignacionVista}
          showBibleForm={showBibleForm} setShowBibleForm={setShowBibleForm} addBible={addBible}
          showSlideForm={showSlideForm} setShowSlideForm={setShowSlideForm} slideDraft={slideDraft} setSlideDraft={setSlideDraft} addSlide={addSlide}
          showSermonForm={showSermonForm} setShowSermonForm={setShowSermonForm} sermonPointText={sermonPointText} setSermonPointText={setSermonPointText} addSermonPoint={addSermonPoint}
          bosquejoInfo={bosquejoInfo}
        />
      )}
      {tab === "eventos" && selectedEvent && bloqueBosquejo && (
        <BosquejoWizard
          key={bloqueBosquejo.id}
          inicial={selectedEvent.bosquejos?.[bloqueBosquejo.id]}
          tituloBloque={bloqueBosquejo.title} tituloEvento={selectedEvent.title}
          bloqueado={bosquejoBloqueado}
          onGuardar={guardarBorradorBosquejo} onEnviar={enviarBosquejo}
          onClose={() => setBosquejoAbierto(null)}
          BibliaSelector={BibleBrowserBody}
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
        const prevTitle = prevItem ? library.find((s) => s.id === prevItem.songId)?.title : null;
        const nextTitle = nextItem ? library.find((s) => s.id === nextItem.songId)?.title : null;
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
            notasCtx={notasCtx}
            iglesiaId={myIglesiaId}
            onAdjuntosChange={marcarAdjuntos}
            song={displaySong} isAdminViewer={puedeGestionarCanciones} mode="setlist" positionLabel={positionLabel}
            structureOverride={currentItem?.structure}
            enterDirection={openSong.enterDir}
            onBack={() => window.history.back()}
            onEdit={() => { setTab("canciones"); setOpenSong({ id: openSong.id, mode: "edit" }); }}
            onTranspose={transposeSong} onDelete={deleteSong}
            onPrev={prevItem ? () => goToItem(prevItem, "prev") : null}
            onNext={nextItem ? () => goToItem(nextItem, "next") : null}
            prevTitle={prevTitle} nextTitle={nextTitle}
            liveSync={{
              active: isLiveNow,
              deviceId: DEVICE_ID,
              itemId: currentItem?.id ?? null,
              state: musicoState,
              onUpdate: updateMusicoState,
              unido: unidoAlLider,
              setUnido: setUnidoAlLider,
              myName,
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
            key={liveEvent.id || "libre"} eventoId={liveEvent.id || null}
            myIglesiaId={myIglesiaId} palabrasPorParte={palabrasPorParte} iglesiaNombre={myIglesia.nombre} usuarioId={userId}
            pasoDiseno={pasoDiseno} setPasoDiseno={setPasoDiseno}
            eventTitle={liveEvent.title} serviceOrder={liveEvent.serviceOrder || []} isFreeSession={liveLibre} library={library} slides={slides} activeIdx={activeIdx} adHocIdx={adHocIdx}
            goto={goto} gotoPlanSlide={gotoPlanSlide} blanked={blanked} setBlanked={setBlanked} current={current} next={next}
            onEnd={enPractica ? salirPractica : endEvent} canEnd={enPractica || isAdminViewer || userId === liveOwnerId}
            enPractica={enPractica} onAyuda={() => setTourActivo(CLAVES_TUTORIAL.envivo)}
            fijada={fijada} onFijar={() => setFijada(current ? { ...current } : null)} onSoltar={() => setFijada(null)} liveOwner={usuariosReales.find((u) => u.id === liveOwnerId)?.nombre || "otro dispositivo"} liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={isCompact}
            adHoc={adHocVista} onExitAdHoc={exitAdHoc} onStartAdHocBible={startAdHocBible} onStartAdHocSong={startAdHocSong} onStartAdHocVideo={startAdHocVideo}
            onOpenPublicScreen={enPractica ? () => avisoPractica("abre el proyector") : startPresentation}
            mensajeEscenario={mensajeEscenario} onMensajeEscenario={setMensajeEscenario} iglesiaSlug={myIglesia?.slug || null}
            temporizador={temporizador} onTemporizador={setTemporizador} autoTemporizador={autoTemporizador} onAutoTemporizador={setAutoTemporizador}
            onNavigateBibleVerse={navigateBibleVerse}
            onAddLiveSlide={addLiveSlide} onEditLiveSlide={editLiveSlide} onRemoveLiveSlide={removeLiveSlide}
            onEditSongSlide={enPractica ? () => avisoPractica("cambian las canciones") : editSongSlideLive}
            onAddSongSlide={enPractica ? () => avisoPractica("cambian las canciones") : addSongSlideLive}
            onRearmarSeccion={enPractica ? () => avisoPractica("cambian las canciones") : rearmarSeccionLive}
            onEditarLetraCompleta={enPractica ? () => { avisoPractica("cambian las canciones"); return null; } : editarLetraCompletaLive}
            onAgregarCancion={agregarCancionEnVivo} onReordenarOrden={reordenarOrdenEnVivo} onQuitarDelOrden={quitarDelOrdenEnVivo} onInsertarItems={insertarItemsEnVivo}
            ocultos={idsOcultosConsola} onOcultar={ocultarEnConsola} onMostrarOcultos={mostrarOcultosConsola}
            onAbrirEditor={enPractica ? undefined : (itemId, indice) => abrirEditorDiap("vivo", itemId, indice)}
            onDisenarNueva={enPractica ? undefined : (despuesDe) => abrirEditorNuevo("vivo", despuesDe)}
            onMoverDiapositiva={moverDiapositivaEnVivo} onQuitarDiapositivaGrupo={quitarDiapositivaEnVivo}
            onReordenarEnGrupo={(itemId, desde, hacia) => cambiarOrdenEnVivo((o) => reordenarEnGrupo(o, itemId, desde, hacia))}
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
      {/* Excepción: en la consola En vivo de escritorio la nav FLOTA encima (pedido de Eldin, 2026-10-08)
          — solo la isla tapa el fondo y a los lados siguen viéndose el orden del culto y la vista
          previa hasta abajo, como en una app de Office. La consola deja su propio espacio abajo
          (ver paddingBottom en MultimediaControl) para que ninguna diapositiva quede tapada. */}
      <div ref={bottomNavRef} style={navEncogida
        ? { position: "absolute", right: 14, bottom: 0, display: "flex", padding: "0 0 calc(12px + env(safe-area-inset-bottom))", zIndex: 40, pointerEvents: "none" }
        : navFlotante
        ? { position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "0 0 calc(12px + env(safe-area-inset-bottom))", zIndex: 40, pointerEvents: "none" }
        : { flexShrink: 0, display: "flex", justifyContent: "center", padding: "10px 0 calc(14px + env(safe-area-inset-bottom))", zIndex: 40 }}>
        {navEncogida ? (
          <button data-tour="nav-menu" onClick={() => setNavAbierta(true)} aria-label="Abrir el menú (Inicio, Canciones, Eventos…)" title="Menú: Inicio, Canciones, Eventos…"
            style={{ pointerEvents: "auto", width: 46, height: 46, borderRadius: 23, border: "none", cursor: "pointer", background: "var(--wf-brand-primary)", color: "var(--wf-on-brand-primary)", boxShadow: "0 6px 18px rgba(22,50,79,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LayoutGrid size={20} />
          </button>
        ) : (<>
        <div data-tour="nav" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 2, background: "var(--wf-brand-primary)", borderRadius: 24, padding: 6, boxShadow: "0 8px 24px rgba(22,50,79,0.35)", maxWidth: "94vw", overflowX: "auto" }}>
          {[["inicio", "Inicio", Home], ["canciones", "Canciones", Music], ["eventos", "Eventos", Calendar], ["ministerios", "Grupos", LayoutGrid], ["asistente", "Asistente", MessageCircle], ["envivo", "En vivo", Radio], ["proyeccion", "Pantalla", ImgIcon], ["ajustes", "Ajustes", Settings]]
            .filter(([val]) => !isCompact || (val !== "envivo" && val !== "proyeccion")) // Control en vivo/Proyección son de escritorio: en celular no aparecen
            .filter(([val]) => val !== "ministerios" || canSeeGrupos) // Grupos: solo admins o quien lidera al menos uno
            .filter(([val]) => val !== "canciones" || canSeeCanciones) // Canciones: solo admins, músicos o rol con "ver_canciones"
            .filter(([val]) => val !== "asistente") // Escondido a propósito (2026-09-30, pedido de Eldin: no convence todavía) — el código y la
            // Edge Function siguen intactos para retomarlo más adelante; para reactivarlo, volver a
            // `val !== "asistente" || realIsAdmin`.
            .map(([val, label, Icon]) => {
            const needsLive = val === "envivo" || val === "proyeccion";
            const needsLiveControlRole = (val === "envivo" || val === "proyeccion") && !canControlLive;
            const isDisabled = (needsLive && !liveEvent) || needsLiveControlRole;
            const active = tab === val;
            return (
              <button
                key={val}
                data-tour={`nav-${val}`}
                onClick={() => requestLeaveSongEditor(() => {
                  // Cambiar de pestaña siempre lleva a la RAÍZ de esa pestaña — si no se limpian estos
                  // tres, quedaban "pegados" (ej. abrir una canción desde un evento y luego, sin volver
                  // antes, tocar otra pestaña dejaba esa canción/evento fantasma abierto por debajo).
                  setTab(val); setSelectedEventId(null); setOpenSong(null); setSelectedMinistryId(null); setNavAbierta(false);
                })}
                disabled={isDisabled}
                className="navitem"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: active ? "var(--wf-brand-accent)" : "transparent", border: "none", borderRadius: 18, padding: "8px 12px", cursor: isDisabled ? "not-allowed" : "pointer", opacity: isDisabled ? 0.35 : 1, flexShrink: 0 }}
              >
                <Icon size={17} color={active ? "var(--wf-on-brand-accent)" : "color-mix(in srgb, var(--wf-on-brand-primary) 80%, transparent)"} />
                <span style={{ fontSize: 9, fontWeight: 700, color: active ? "var(--wf-on-brand-accent)" : "color-mix(in srgb, var(--wf-on-brand-primary) 60%, transparent)" }}>{label}</span>
              </button>
            );
          })}
        </div>
        {navFlotante && (
          <button onClick={() => setNavAbierta(false)} aria-label="Encoger el menú" title="Encoger el menú"
            style={{ pointerEvents: "auto", width: 40, height: 40, borderRadius: 20, border: "none", cursor: "pointer", background: "var(--wf-card)", color: "var(--wf-text)", boxShadow: "0 6px 18px rgba(22,50,79,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        )}
        </>)}
      </div>
    </div>
  );
}

function eventAvatars(event) {
  const names = new Set();
  event.serviceOrder.forEach((item) => (item.encargados || []).forEach((m) => names.add(m.n)));
  return Array.from(names).map((n) => n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase());
}

// ---------------- AJUSTES ----------------
function ToggleSwitch({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ width: 44, height: 26, borderRadius: 20, background: checked ? "var(--wf-brand-accent)" : "var(--wf-border)", border: "none", position: "relative", cursor: "pointer", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "var(--wf-card)", transition: "left .15s" }} />
    </button>
  );
}

function SlideMiniPreview({ lines }) {
  return (
    <div style={{ background: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)", borderRadius: 12, padding: "16px 10px", minHeight: 70, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 12, lineHeight: 1.4, color: "#F3F1EC" }}>
        {lines.filter((l) => l.trim()).length ? lines.map((l, i) => <div key={i}>{l || "\u00A0"}</div>) : <span style={{ color: "#3A4150" }}>Diapositiva vacía</span>}
      </div>
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
    <button onClick={onClick} className="hoverable" style={{ width: "100%", textAlign: "left", border: isLive ? "2px solid var(--wf-brand-accent)" : "none", cursor: "pointer", borderRadius: 12, padding: "5px 6px", background: ev.cover || DEFAULT_COVERS[0], color: "#fff", lineHeight: 1.25 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortTitle}</div>
      <div style={{ fontSize: 8.5, opacity: 0.85 }}>{time}</div>
    </button>
  );
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

// ---------------- CONTENIDO IMPROVISADO EN VIVO (no toca el setlist) ----------------
function AdHocSongModal({ library, onClose, onPick, Icono = null, color = "#5661B3", titulo = "Proyectar una canción", ayuda = "Busca cualquier canción de la biblioteca, aunque no esté en el setlist de hoy." }) {
  const [query, setQuery] = useState("");
  const filtered = buscarCanciones(library, query);
  return (
    <ModalShell title={titulo} icon={Icono || Music} color={color} onClose={onClose}>
      <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 10 }}>{ayuda}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 10px", marginBottom: 10 }}>
        <Search size={13} color="var(--wf-faint)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Buscar canción (aunque esté mal escrita)…" style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 12, width: "100%" }} />
      </div>
      {filtered.map((s) => (
        <button key={s.id} onClick={() => onPick(s)} className="hoverable" style={{ ...addBtnStyle, textAlign: "left", marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(s.key)} · {s.tempo} bpm</div></div>
          {Icono && <Icono size={16} color={color} style={{ flexShrink: 0 }} />}
        </button>
      ))}
      {filtered.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>No hay canciones que coincidan.</div>}
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
    <ModalShell title="Proyectar un video" icon={ImgIcon} color="#C23B32" onClose={onClose}>
      <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 10 }}>Se proyecta a pantalla completa de inmediato, sin agregarse al setlist.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="https://... (mp4)" value={url} onChange={(e) => setUrl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => fileInputRef.current?.click()} style={{ ...addBtnStyle, width: "auto", padding: "0 12px", whiteSpace: "nowrap" }}><Paperclip size={14} color="#C23B32" /> Subir video</button>
        <input ref={fileInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => { uploadVideoFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <button onClick={() => url && onPlay(url)} style={{ ...primaryBtn, marginTop: 14 }}>Proyectar ahora</button>
    </ModalShell>
  );
}

// ---------------- CONTROL MULTIMEDIA (EN VIVO) ----------------

function MultimediaControl({ eventTitle, serviceOrder = [], isFreeSession, library, slides, activeIdx, adHocIdx, goto, gotoPlanSlide, blanked, setBlanked, current, next, onEnd, canEnd, liveOwner, liveStyle, setLiveStyle, isCompact, adHoc, onExitAdHoc, onStartAdHocBible, onStartAdHocSong, onStartAdHocVideo, onOpenPublicScreen, onNavigateBibleVerse, onAddLiveSlide, onEditLiveSlide, onRemoveLiveSlide, onEditSongSlide, onAddSongSlide, onRearmarSeccion, onAgregarCancion, onReordenarOrden, onQuitarDelOrden, onInsertarItems, myIglesiaId , palabrasPorParte = 40, onAbrirEditor, onDisenarNueva, onMoverDiapositiva, onQuitarDiapositivaGrupo, onReordenarEnGrupo, enPractica = false, onAyuda, ocultos = null, onOcultar, onMostrarOcultos, fijada = null, onFijar, onSoltar, eventoId = null, iglesiaNombre = "", usuarioId = null, pasoDiseno = 0, setPasoDiseno = () => {}, onEditarLetraCompleta, mensajeEscenario = "", onMensajeEscenario = null, iglesiaSlug = null, temporizador = null, onTemporizador = null, autoTemporizador = null, onAutoTemporizador = null }) {
  // Riel de íconos a la izquierda (estilo Proyektor): qué panel se muestra en la columna principal.
  // "transmision" es el que ya existía (grid de diapositivas); "biblia" y "estilo" antes eran cajones
  // que tapaban la pantalla — ahora son pestañas fijas para no perder de vista la vista previa de al lado.
  const [mmPanel, setMmPanel] = useState("transmision"); // "biblia" | "transmision" | "estilo" | "insertar" (este último solo en escritorio)
  // La Biblia se monta la primera vez que se abre y ya no se desmonta (solo se esconde) mientras dure la consola.
  const [bibliaAbierta, setBibliaAbierta] = useState(false);
  useEffect(() => { if (mmPanel === "biblia") setBibliaAbierta(true); }, [mmPanel]);
  // ---- Consola fácil (pedido de Eldin, 2026-10-11: "que alguien que nunca la haya usado la pueda usar
  // en 5 minutos") ----
  // Modo sencillo (escritorio): sin cinta de pestañas — solo una barra de botones grandes (Anterior,
  // Siguiente, Negro, + Agregar, Biblia) sobre orden | diapositivas | al aire. Estilo, Insertar y lo
  // demás quedan en "Modo completo". Se recuerda por computadora; empieza en sencillo.
  const [sencillo, setSencillo] = useState(() => { const v = loadCache("consola_sencilla"); return v === null ? true : !!v; });
  useEffect(() => { saveCache("consola_sencilla", sencillo); }, [sencillo]);
  useEffect(() => { if (sencillo && (mmPanel === "estilo" || mmPanel === "insertar")) setMmPanel("transmision"); }, [sencillo, mmPanel]);
  // ¿Hay una pantalla de proyección abierta? (ver escucharProyeccion). null = todavía no se sabe: los
  // primeros segundos no se avisa nada, la ventana de proyección tarda en abrir.
  const [hayProyeccion, setHayProyeccion] = useState(null);
  const [avisoProyeccionOculto, setAvisoProyeccionOculto] = useState(false);
  useEffect(() => {
    if (!myIglesiaId || enPractica) return;
    const inicio = Date.now();
    return escucharProyeccion(myIglesiaId, (hay) => { if (hay || Date.now() - inicio > 8000) setHayProyeccion(hay); });
  }, [myIglesiaId, enPractica]);
  const mostrarAvisoProyeccion = !enPractica && hayProyeccion === false && !avisoProyeccionOculto;
  // Finalizar siempre pide confirmar: un clic de más no debe cortar la proyección a mitad del culto.
  const finalizarConConfirmacion = async () => {
    if (enPractica) { onEnd(); return; }
    if (await confirmDialog("La pantalla de proyección se va a apagar y el culto deja de estar en vivo.", { titulo: "¿Finalizar el culto en vivo?", danger: true, textoConfirmar: "Sí, finalizar" })) onEnd();
  };
  // Escritorio: qué elemento del orden del culto se está viendo al centro (null = el que está al aire),
  // si se ven todas las diapositivas juntas, y si la cinta de Estilo muestra sus opciones extra.
  const [itemVisto, setItemVisto] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  const [estiloMas, setEstiloMas] = useState(false);
  // Menú flotante de "Letra animada" en la cinta de Estilo (computadora).
  const [animMenu, setAnimMenu] = useState(false);
  // "Pantalla en otro equipo": enlace corto + QR para abrir la proyección en un TV/tablet/otra computadora.
  const [showOtroEquipo, setShowOtroEquipo] = useState(false);
  const [showEscenario, setShowEscenario] = useState(false); // Pantalla de escenario: mensaje + enlace (ver PanelEscenario)
  // Al poner un fondo propio con letras animadas, se avisa una vez que la letra irá sobre ese fondo (oscurecido para que se lea).
  const avisarFondoPropioAnimada = () => {
    if (animacionActiva(liveStyle) && liveStyle.animFondo !== "propio") showToast("La letra animada ahora va sobre tu fondo, un poco oscurecido para que se lea. Para volver al fondo del estilo: Letras animadas → Fondo animado del estilo.", "info");
  };
  // Letra completa de la canción del centro, para corregirla toda de una vez: { songId, titulo, texto }.
  const [letraCompleta, setLetraCompleta] = useState(null);
  const abrirLetraCompleta = (songId) => {
    const song = library.find((x) => x.id === songId);
    if (!song) return;
    setLetraCompleta({ songId, titulo: song.title, texto: letraATexto({ ...song, letra: letraEfectiva(song) }) });
  };
  const guardarLetraCompleta = () => {
    const avisos = onEditarLetraCompleta?.(letraCompleta.songId, letraCompleta.texto);
    if (avisos === null) return;
    setLetraCompleta(null);
    const importantes = (avisos || []).filter((a) => a.tipo === "aviso");
    showToast(importantes.length ? importantes[0].texto : "Letra guardada: ya se ve así en la proyección y en la canción.", "info");
  };
  // Las letras de los estilos animados se piden apenas se abre la consola, no en pleno culto.
  useEffect(() => { precargarFuentesAnimacion(); }, []);
  const [fondoDestino, setFondoDestino] = useState("todo"); // "todo" | "cancion" — ver "Fondo por canción"
  // Versión e historial de la Biblia en vivo: se guardan aquí (no dentro de BibleLivePanel) para que
  // sobrevivan al cambiar de pestaña e ir a Estilo/Transmisión y volver a Biblia — y también en
  // localStorage (mismo mecanismo que offlineCache) para que sobrevivan a salir de "En vivo" del todo
  // (MultimediaControl se desmonta con la pestaña) o recargar la app a medio culto.
  const [bibleVersion, setBibleVersion] = useState(() => { const v = loadCache("bible_version"); return BIBLE_VERSIONS.some((x) => x.code === v) ? v : BIBLE_VERSIONS[0].code; });
  // Historial de versículos POR EVENTO (pedido de Eldin, 2026-10-11): solo los que se usaron en este
  // culto, no todos los de siempre. La consola se vuelve a montar al cambiar de evento (key).
  const claveHistorial = `bible_historial_${eventoId || "libre"}`;
  const [bibleHistory, setBibleHistory] = useState(() => loadCache(claveHistorial) || []);
  useEffect(() => { saveCache("bible_version", bibleVersion); }, [bibleVersion]);
  useEffect(() => { saveCache(claveHistorial, bibleHistory); }, [bibleHistory, claveHistorial]);
  const [showAdHocSong, setShowAdHocSong] = useState(false);
  const [showAdHocVideo, setShowAdHocVideo] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  const [showAddSlide, setShowAddSlide] = useState(false);
  const [showAgregarConsola, setShowAgregarConsola] = useState(false); // "+ Agregar" (igual que en el Setlist)
  const [newSlideDraft, setNewSlideDraft] = useState({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" });
  // Editar una diapositiva ya agregada (versículo/slide/punto del bosquejo) por si algo se escribió mal.
  const [editingSlide, setEditingSlide] = useState(null); // la slide original que se está editando, o null
  const [editDraft, setEditDraft] = useState(null);
  const startEditingSlide = (s) => {
    setEditingSlide(s);
    setEditDraft(
      s.type === "biblia" ? { reference: s.baseReference ?? s.reference, text: s.baseText ?? s.text }
      : s.type === "cancion" ? { text: (s.baseLines || s.lines).join("\n") }
      : { title: s.title, subtitle: s.subtitle || "", name: s.nombre || "", escalaSubtitulo: s.escalaSubtitulo, bg: s.bg || "#1B2029", bgType: s.bgType || "color", videoUrl: s.videoUrl || "", imageUrl: s.imageUrl || "" }
    );
  };
  const saveSlideEdit = () => {
    if (!editingSlide) return;
    // Canción: el cambio queda guardado en la CANCIÓN (permanente, ver editSongSlideLive), no en el
    // plan de este evento — las demás (versículo/diapositiva suelta) siguen igual que antes, viven en
    // el propio ítem del Setlist.
    if (editingSlide.type === "cancion") {
      if (editingSlide.nueva) {
        // Sin texto no se crea nada (una diapositiva vacía nunca se proyecta): se queda el cuadro abierto.
        if (!editDraft.text.trim()) return;
        onAddSongSlide(editingSlide.songId, editingSlide.blockKey, editingSlide.slideIndexInBlock, editDraft.text, editingSlide.cortarDespuesDeLinea);
      } else {
        onEditSongSlide(editingSlide.songId, editingSlide.blockKey, editingSlide.slideIndexInBlock, editDraft.text);
      }
    } else {
      onEditLiveSlide(editingSlide.baseSlideId || editingSlide.slideId, editDraft);
    }
    setEditingSlide(null); setEditDraft(null);
  };
  const customBgType = liveStyle.customBgType || "imagen";
  const font = LIVE_FONTS[liveStyle.font || "elegante"];
  const fontScale = liveStyle.fontScale ?? 1;
  const navIdx = adHoc ? adHocIdx : activeIdx;

  // Flechas del teclado para cambiar de diapositiva sin soltar el mouse — como en PowerPoint. Arriba/
  // abajo SIEMPRE avanzan versículo por versículo cuando lo que está en vivo es una lectura bíblica
  // navegable (viene de "Buscar en la Biblia", no escrita a mano). Izquierda/derecha avanzan por el plan
  // — EXCEPTO en modo improvisado con un versículo navegable y sin otra diapositiva a la que ir (el caso
  // típico: "Proyectar ahora" desde el buscador, fuera de la planificación), donde también avanzan
  // versículo por versículo — así cualquiera de las dos flechas funciona ahí, no solo arriba/abajo.
  // Se ignora si el foco está en un campo de texto, para no pisar lo que se esté escribiendo.
  // Siguiente/Anterior — lo mismo con las flechas del teclado que con los botones de la cinta. Un
  // versículo de la Biblia partido en varias partes: primero recorre sus partes y, ya en la última (o la
  // primera), salta al versículo de al lado.
  const avanzar = (dir) => {
    // Diapositiva diseñada con elementos "al clic": primero se revelan (o se esconden al volver) sus pasos.
    const pasosTotales = current?.diseno ? pasosDeDiapositiva(current.diseno) : 0;
    if (dir > 0 && pasosTotales > 0 && pasoDiseno < pasosTotales) { setPasoDiseno(pasoDiseno + 1); return; }
    if (dir < 0 && pasosTotales > 0 && pasoDiseno > 0) { setPasoDiseno(pasoDiseno - 1); return; }
    const isNavigableBible = current?.type === "biblia" && current.bookId;
    const sinMasAdelante = adHoc && navIdx >= adHoc.slides.length - 1;
    const sinMasAtras = adHoc && navIdx <= 0;
    if (dir > 0) { if (isNavigableBible && sinMasAdelante) onNavigateBibleVerse(1); else goto(navIdx + 1); }
    else { if (isNavigableBible && sinMasAtras) onNavigateBibleVerse(-1); else goto(navIdx - 1); }
  };
  useEffect(() => {
    const onKeyDown = (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const isNavigableBible = current?.type === "biblia" && current.bookId;
      // Espacio y AvPág/RePág también: los clickers de presentación mandan esas teclas.
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); avanzar(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); avanzar(-1); }
      else if ((e.key === "b" || e.key === "B" || e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setBlanked((x) => !x); }
      else if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey && !e.altKey && onFijar) { e.preventDefault(); if (fijada) onSoltar(); else onFijar(); }
      else if (e.key === "ArrowDown" && isNavigableBible) { e.preventDefault(); onNavigateBibleVerse(1); }
      else if (e.key === "ArrowUp" && isNavigableBible) { e.preventDefault(); onNavigateBibleVerse(-1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navIdx, current, adHoc, goto, onNavigateBibleVerse, setBlanked, fijada, onFijar, onSoltar]);

  // Saltar a una sección (Coro/Puente/Estrofa…) de la canción que está sonando ahora — como el panel "Current" de FreeShow.
  // Funciona igual para el plan y para una canción improvisada (fuera del plan): busca en la lista que
  // esté activa en cada caso, para poder saltar entre Coro/Puente/Estrofa sin salir del modo improvisado.
  const activeSongSlides = adHoc ? adHoc.slides : slides;
  // Una sola entrada por sección: "Coro (1/3)", "Coro (2/3)"... son la misma sección "Coro" — al tocarla
  // se salta a su PRIMERA parte (la siguiente aparición, si la canción la repite).
  const seccionBase = (s) => String(s.blockLabel || "").replace(/\s*\(\d+\/\d+\)$/, "");
  const esInicioDeSeccion = (s, i) => i === 0 || seccionBase(activeSongSlides[i - 1]) !== seccionBase(s) || activeSongSlides[i - 1].songTitle !== s.songTitle;
  const jumpToLabel = (label) => {
    const from = adHoc ? adHocIdx : activeIdx;
    const coincide = (s, i) => s.type === "cancion" && seccionBase(s) === label && esInicioDeSeccion(s, i);
    const upcoming = activeSongSlides.findIndex((s, i) => i > from && coincide(s, i));
    const idx = upcoming !== -1 ? upcoming : activeSongSlides.findIndex((s, i) => coincide(s, i));
    if (idx === -1) return;
    if (adHoc) goto(idx); else gotoPlanSlide(idx);
  };
  const currentSongSections = useMemo(() => {
    if (!current || current.type !== "cancion") return [];
    const seen = new Map();
    activeSongSlides.forEach((s) => {
      if (s.type === "cancion" && s.songTitle === current.songTitle && !seen.has(seccionBase(s))) seen.set(seccionBase(s), sectionColorFor(s));
    });
    return [...seen.entries()];
  }, [activeSongSlides, current]);
  // Diapositivas agregadas a mano vía "Improvisar" (ver DIAPOSITIVAS más abajo) — se identifican solo
  // por ser type "slide" dentro del plan en vivo, ya sea el de un evento real o el de una libre.
  const customSlides = slides.filter((s) => s.type === "slide");
  // ---- Diapositivas con diseño / presentaciones agrupadas (2026-10-10) ----
  // De qué elemento del orden del culto es una diapositiva, y cuál es dentro de su grupo.
  const refDiap = (s) => ({ itemId: s.grupoId || s.baseSlideId || s.slideId, indice: s.indiceEnGrupo ?? 0 });
  // El editor de diseño y el menú de clic derecho: solo en escritorio y sobre el orden del culto (no improvisado).
  const puedeDisenar = !isCompact && !adHoc && !!onAbrirEditor;
  const abrirEditor = (s) => { const r = refDiap(s); onAbrirEditor(r.itemId, r.indice); };
  const [menuDiap, setMenuDiap] = useState(null); // { x, y, s, sub: null | "mover" | "copiar" }
  useEffect(() => {
    if (!menuDiap) return;
    const cerrar = () => setMenuDiap(null);
    window.addEventListener("pointerdown", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => { window.removeEventListener("pointerdown", cerrar); window.removeEventListener("scroll", cerrar, true); };
  }, [menuDiap]);
  // Una fila por elemento en "Diapositivas agregadas": un grupo es UNA fila, no una por página.
  const customItems = [];
  customSlides.forEach((s) => {
    const r = refDiap(s);
    if (!customItems.some((x) => x.itemId === r.itemId)) customItems.push({ itemId: r.itemId, s, total: s.totalGrupo || 1 });
  });
  const enviarDiapositiva = async (s, destino, copiar) => {
    const r = refDiap(s);
    let nombreNuevo;
    if (destino === "nuevo") {
      nombreNuevo = await promptDialog("Nombre del grupo nuevo", { titulo: copiar ? "Copiar a un grupo nuevo" : "Mover a un grupo nuevo", placeholder: "Ej. Anuncios", textoConfirmar: copiar ? "Copiar" : "Mover" });
      if (!nombreNuevo) return;
    }
    onMoverDiapositiva({ itemId: r.itemId, indice: r.indice, destino, copiar, nombreNuevo });
    showToast(copiar ? "Diapositiva copiada." : destino === "suelta" ? "La diapositiva quedó fuera del grupo." : "Diapositiva movida.", "info");
  };

  // ---- Escritorio (cinta tipo Office): orden del culto por bloques y diapositivas por elemento ----
  const perteneceA = (s, itemId) => !!s && (s.slideId === itemId || String(s.slideId).startsWith(`${itemId}-`) || String(s.slideId).startsWith(`${itemId}~`));
  const itemDeDiapositiva = (s) => (s ? serviceOrder.find((it) => it.type !== "seccion" && perteneceA(s, it.id)) || null : null);
  const indicePrimeraDiapositiva = (itemId) => slides.findIndex((s) => perteneceA(s, itemId));
  const tituloItem = (it) => (it.type === "cancion" ? library.find((x) => x.id === it.songId)?.title || "Canción"
    : it.type === "biblia" ? it.reference || "Versículo"
    : it.name || it.title || (it.bgType === "video" ? "Video" : it.bgType === "imagen" ? "Imagen" : "Diapositiva"));
  const bloquesOrden = [];
  serviceOrder.forEach((it) => {
    if (it.type === "seccion") { bloquesOrden.push({ id: it.id, titulo: it.title || "Bloque", items: [] }); return; }
    if (bloquesOrden.length === 0) bloquesOrden.push({ id: "_inicio", titulo: null, items: [] });
    bloquesOrden[bloquesOrden.length - 1].items.push(it);
  });
  // Con la pantalla fijada, "al aire" es la diapositiva fijada (no a donde se mueva el operador).
  const itemAlAire = fijada ? itemDeDiapositiva(fijada) : adHoc ? null : itemDeDiapositiva(current);
  const alAire = fijada || current;
  // ---- Editar el orden del culto desde la consola, igual que el Setlist (ver agregarCancionEnVivo y
  // compañía en el componente principal: lo que está al aire no se mueve al reordenar) ----
  const arrastreOrden = useArrastreLista({ habilitado: true, onReorder: (desde, hacia) => onReordenarOrden(desde, hacia) });
  // ---- Ocultar en la consola (no borra del setlist; ver ocultarEnConsola en el componente principal) ----
  const estaOculto = (it) => !!ocultos?.has(it.id);
  const visiblesDeBloque = (bloqueId) => (bloquesOrden.find((b) => b.id === bloqueId)?.items || []).filter((x) => !estaOculto(x));
  const cuantosOcultos = ocultos ? serviceOrder.filter((it) => ocultos.has(it.id)).length : 0;
  const ocultar = (it) => {
    if (!onOcultar) return;
    const ids = it.type === "seccion" ? [it.id, ...(bloquesOrden.find((b) => b.id === it.id)?.items || []).map((x) => x.id)] : [it.id];
    if (ids.includes(itemVisto)) setItemVisto(null);
    onOcultar(ids);
    const nombre = it.type === "seccion" ? (it.title || "Bloque") : tituloItem(it);
    showToast(`"${nombre}" ya no se ve en la consola. Sigue en el setlist.`, "info", { label: "Deshacer", onClick: () => onMostrarOcultos?.(ids) });
  };
  const quitarDelOrden = async (it) => {
    const nombre = it.type === "seccion" ? `el bloque "${it.title || "Bloque"}"` : `"${tituloItem(it)}"`;
    const ok = await confirmDialog(
      `¿Quitar ${nombre} del orden de este culto? Se quitará permanentemente del evento.${it.type === "seccion" ? " Lo que tenía adentro se queda en el orden, solo se quita el título del bloque." : it.type === "cancion" ? " La canción sigue en la biblioteca." : ""}`,
      { titulo: "Quitar del orden del culto", danger: true, textoConfirmar: "Quitar" }
    );
    if (!ok) return;
    if (itemVisto === it.id) setItemVisto(null);
    onQuitarDelOrden(it.id);
  };
  // La canción nueva entra justo DESPUÉS de lo que se está viendo al centro (o de lo que está al aire);
  // si no hay nada, al final. Luego se puede arrastrar a donde se quiera.
  // Si en "+ Agregar" se eligió una parte del culto, entra al final de ese bloque.
  const [destinoConsola, setDestinoConsola] = useState(null);
  const anclaParaAgregar = () => (destinoConsola && anclaDeBloque(serviceOrder, destinoConsola)) || itemCentro || itemAlAire || null; // función: itemCentro se declara más abajo
  const agregandoConsola = showAgregarConsola || showAdHocSong || showImportar || showAddSlide;
  useEffect(() => { if (!agregandoConsola && destinoConsola) setDestinoConsola(null); }, [agregandoConsola, destinoConsola]);
  // "Proyectar ya" (pedido de Eldin, 2026-10-21: "si cantamos algo que no está, que la pueda buscar y
  // transmitir"): se agrega después de lo que está al aire y, apenas aparecen sus diapositivas, sale la
  // primera en pantalla.
  const [proyectarAlAparecer, setProyectarAlAparecer] = useState(null);
  useEffect(() => {
    if (!proyectarAlAparecer) return;
    const idx = slides.findIndex((sl) => perteneceA(sl, proyectarAlAparecer));
    if (idx === -1) return;
    setProyectarAlAparecer(null);
    // Después del ajuste que mantiene "lo que está al aire" al cambiar el orden (efecto del padre, que
    // corre después de este): si no, ese ajuste devolvía la pantalla a lo que estaba antes.
    setTimeout(() => { setItemVisto(null); gotoPlanSlide(idx); }, 0);
  }, [slides, proyectarAlAparecer]);
  const proyectarCancionYa = (song) => {
    const ancla = itemAlAire || anclaParaAgregar();
    const nuevoId = onAgregarCancion(song.id, ancla?.id || null);
    setShowAdHocSong(false);
    if (mmPanel === "biblia") setMmPanel("transmision");
    if (nuevoId) { setItemVisto(nuevoId); setVerTodas(false); setProyectarAlAparecer(nuevoId); }
    showToast(`"${song.title}" está en pantalla y quedó en el orden del culto.`, "info");
  };
  const agregarCancionAqui = (song) => {
    const ancla = anclaParaAgregar();
    const nuevoId = onAgregarCancion(song.id, ancla?.id || null);
    setShowAdHocSong(false);
    if (nuevoId) { setItemVisto(nuevoId); setVerTodas(false); }
    if (mmPanel === "biblia") setMmPanel("transmision");
    showToast(ancla ? `"${song.title}" se agregó después de "${tituloItem(ancla)}".` : `"${song.title}" se agregó al final del culto.`, "info");
  };
  // Las flechas recorren TODO el culto: al pasar de la última diapositiva de una canción a la
  // siguiente, el centro se va solo a la canción nueva — antes se quedaba fijado en la que se había
  // tocado en el orden del culto y parecía que no avanzaba (reportado por Eldin, 2026-10-08).
  const idAlAire = itemAlAire?.id ?? null;
  useEffect(() => { setItemVisto(null); }, [idAlAire]);
  const itemCentro = verTodas ? null : (itemVisto && serviceOrder.find((it) => it.id === itemVisto)) || itemAlAire;
  const indicesCentro = slides.map((_, i) => i).filter((i) => !itemCentro || perteneceA(slides[i], itemCentro.id));
  // Lo que viene después de lo que está al aire, cuando al avanzar se cambia de elemento (otro canto,
  // la despedida...) — para avisarlo: "Al avanzar pasas a: ¡Gloria a Dios!".
  const itemSiguiente = adHoc ? null : itemDeDiapositiva(next);
  const cambiaDeElemento = !!itemSiguiente && !!itemAlAire && itemSiguiente.id !== itemAlAire.id;
  const nombreSiguiente = itemSiguiente ? tituloItem(itemSiguiente) : null;

  // ---- Fondo por canción (pedido de Eldin, 2026-10-08) ----
  // Por defecto el fondo que se elige en Estilo es para TODO (canciones, Biblia, diapositivas). Solo si
  // quien transmite activa "Fondo por canción" (liveStyle.fondoPorCancion) se le puede dar a una canción
  // su propio fondo, guardado en liveStyle.fondosCanciones[songId]. Viaja dentro del mismo estilo en
  // vivo, así que la pantalla de proyección lo aplica sola (ver fondoEfectivo en ProjectionPanel).
  // "Esta canción" = la que se está viendo al centro (para dejarla lista antes de que salga al aire),
  // o la que está al aire si es improvisada.
  const cancionObjetivo = itemCentro?.type === "cancion" ? { id: itemCentro.songId, titulo: tituloItem(itemCentro) }
    : current?.type === "cancion" && current.songId ? { id: current.songId, titulo: current.songTitle } : null;
  const fondoPorCancion = !!liveStyle.fondoPorCancion;
  const editandoCancion = fondoPorCancion && fondoDestino === "cancion" && !!cancionObjetivo;
  const fondoCancionObjetivo = editandoCancion ? liveStyle.fondosCanciones?.[cancionObjetivo.id] : null;
  // Lo que se está editando ahora (para marcar el botón activo): el fondo de la canción si tiene, si no el general.
  const fondoEditado = fondoCancionObjetivo ? { ...liveStyle, ...fondoCancionObjetivo } : liveStyle;
  const fondoEditadoTipo = fondoEditado.customBgType || "imagen";
  const aplicarFondo = (cambios) => setLiveStyle((st) => {
    // Elegir un fondo de los de siempre con una letra animada puesta = "quiero mi fondo" (no el del estilo).
    if (!editandoCancion) return { ...st, ...cambios, ...(animacionActiva(st) ? { animFondo: "propio" } : {}) };
    const previo = st.fondosCanciones?.[cancionObjetivo.id] || { theme: st.theme, customBgType: st.customBgType, customImage: st.customImage, customVideo: st.customVideo };
    return { ...st, fondosCanciones: { ...(st.fondosCanciones || {}), [cancionObjetivo.id]: { ...previo, ...cambios } } };
  });
  const quitarFondoCancion = () => setLiveStyle((st) => {
    const resto = { ...(st.fondosCanciones || {}) };
    delete resto[cancionObjetivo.id];
    return { ...st, fondosCanciones: resto };
  });
  // Funciones que devuelven JSX (no componentes): así un <select> o el slider dentro de la cinta no se
  // desmontan en cada render y no pierden el foco mientras se usan.
  const grupoCinta = (titulo, contenido, ultimo = false) => (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 2, padding: "0 10px", borderRight: ultimo ? "none" : "1px solid var(--wf-divider)", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 2, alignItems: "center", flex: 1 }}>{contenido}</div>
      <span style={{ fontSize: 10, color: "var(--wf-faint)", textAlign: "center", whiteSpace: "nowrap" }}>{titulo}</span>
    </div>
  );
  // Anterior / Siguiente / Negro en TODAS las pestañas de la cinta (pedido de Eldin, 2026-10-08): las
  // diapositivas se manejan igual estando en Biblia, Estilo o Insertar, sin volver a Transmisión.
  const navegacionRapida = () => (<>
    {botonCinta({ icon: ChevronLeft, label: "Anterior", onClick: () => avanzar(-1), ancho: 54 })}
    {botonCinta({ icon: ChevronRight, label: "Siguiente", onClick: () => avanzar(1), acento: true, ancho: 58 })}
    {botonCinta({ icon: MonitorOff, label: "Negro", onClick: () => setBlanked((b) => !b), activo: blanked, ancho: 50 })}
  </>);
  // Grupo de la cinta como dato (CintaAdaptable decide si va a la vista o en "Más opciones").
  const grupoItem = (titulo, contenido, _ultimo, clave) => ({ clave: clave || titulo, titulo, contenido });
  // Botones de la cinta al estilo Office: sin relleno (solo se marcan al pasar el mouse), ícono arriba
  // y texto chico abajo — solo "Siguiente" (acento) y lo que está encendido (activo) llevan color.
  const botonCinta = ({ icon: Icon, label, onClick, activo, acento, title, tour, ancho = 58 }) => (
    <button
      onClick={onClick} title={title || label} data-tour={tour} className={activo || acento ? undefined : "hoverable"}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, minWidth: ancho, minHeight: 50, padding: "4px 6px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 500, lineHeight: 1.15, whiteSpace: "nowrap",
        background: activo ? "var(--wf-brand-primary)" : acento ? "var(--wf-brand-accent)" : "transparent",
        color: activo ? "var(--wf-on-brand-primary)" : acento ? "var(--wf-brand-primary)" : "var(--wf-text)" }}
    ><Icon size={20} strokeWidth={1.75} />{label}</button>
  );
  // ---- "+ Agregar" de la consola (pedido de Eldin, 2026-10-11): el mismo botón naranja y la misma
  // hoja del Setlist, para que alguien nuevo vea de una vez cómo meter algo al culto en vivo. ----
  const nuevaDiapositivaTexto = () => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" }); setShowAddSlide(true); };
  const opcionesAgregarConsola = [
    { clave: "proyectar", Icon: Radio, color: "var(--wf-brand-accent)", titulo: "Proyectar desde biblioteca", detalle: "Busca una canción y sale en pantalla de una vez", accion: () => setShowAdHocSong("proyectar") },
    { clave: "cancion", Icon: Music, color: "#1F8A73", titulo: "Canción", detalle: "De la biblioteca — queda en el orden del culto", accion: () => setShowAdHocSong(true) },
    { clave: "biblia", Icon: BookOpen, color: "#2F5FA8", titulo: "Versículo", detalle: "Búscalo en la Biblia y proyéctalo al momento", accion: () => setMmPanel("biblia") },
    { clave: "texto", Icon: Type, color: "#B15EA0", titulo: "Texto rápido", detalle: "Un aviso o el título de la prédica, en segundos", accion: nuevaDiapositivaTexto },
    !isCompact && onDisenarNueva && { clave: "disenar", Icon: PenTool, color: "#E8821E", titulo: "Diseñar diapositiva", detalle: "Con imágenes y plantillas", accion: () => onDisenarNueva(anclaParaAgregar()?.id || null) },
    { clave: "importar", Icon: FileUp, color: "#5B6472", titulo: "Importar PDF o imágenes", detalle: "De Canva, PowerPoint o del predicador", accion: () => setShowImportar(true) },
    { clave: "video", Icon: ImgIcon, color: "#C23B32", titulo: "Video", detalle: "Se proyecta una vez (no queda en el orden)", accion: () => setShowAdHocVideo(true) },
  ].filter(Boolean);
  const botonAgregarConsola = ({ ancho = false, tour } = {}) => (
    <button
      onClick={() => { setDestinoConsola(null); setShowAgregarConsola(true); }} data-tour={tour} className="hoverable"
      title="Agregar algo al culto: canción, versículo, diapositiva, presentación o video"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 18, border: "none", cursor: "pointer", background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", flexShrink: 0, width: ancho ? "100%" : undefined, boxSizing: "border-box", fontFamily: "inherit" }}
    ><Plus size={15} /> Agregar</button>
  );
  // ---- Borrar y mover diapositivas desde la consola (pedido de Eldin, 2026-10-08) ----
  // Una "sección" aquí = una aparición de una sección de la canción en el plan (mismo prefijo de
  // slideId: `${item}-${posición en la estructura}`), con todos sus pedazos. Moverlas solo se puede
  // dentro de la misma sección; cualquier cambio queda guardado en la canción (ver rearmarSeccion).
  const ocurrenciaDe = (s) => String(s.slideId).replace(/~l\d+$/, "").replace(/-\d+$/, "");
  const segmentoDe = (s) => ({ indice: s.slideIndexInBlock, desde: s.segmento?.desde ?? 0, hasta: s.segmento?.hasta ?? null });
  const seccionDe = (s) => slides.filter((x) => x.type === "cancion" && x.songId === s.songId && ocurrenciaDe(x) === ocurrenciaDe(s));
  const borrarDiapositiva = async (s) => {
    if (s.type === "cancion") {
      const ok = await confirmDialog(
        `¿Borrar esta diapositiva de "${s.songTitle}" (${s.blockLabel})? Se borrará permanentemente de la canción en la biblioteca — no solo de esta transmisión — y no se puede deshacer.`,
        { titulo: "Borrar diapositiva", danger: true, textoConfirmar: "Borrar para siempre" }
      );
      if (!ok) return;
      const quedan = seccionDe(s).filter((x) => x.slideId !== s.slideId).map(segmentoDe);
      onRearmarSeccion(s.songId, s.blockKey, quedan, "No se pudo borrar la diapositiva");
      return;
    }
    if (s.grupoId && s.totalGrupo > 1) {
      const okGrupo = await confirmDialog(`¿Borrar la diapositiva ${s.indiceEnGrupo + 1} de "${tituloBase(s.title)}"? Las demás del grupo se quedan.`, { titulo: "Borrar diapositiva", danger: true, textoConfirmar: "Borrar" });
      if (okGrupo) onQuitarDiapositivaGrupo(s.grupoId, s.indiceEnGrupo);
      return;
    }
    const ok = await confirmDialog(
      s.type === "biblia"
        ? `¿Quitar "${s.baseReference ?? s.reference}" del orden del culto? Se borrará permanentemente de este evento.`
        : `¿Borrar la diapositiva "${s.title || "(sin título)"}"? Se borrará permanentemente de este evento.`,
      { titulo: "Borrar diapositiva", danger: true, textoConfirmar: "Borrar para siempre" }
    );
    if (ok) onRemoveLiveSlide(s.baseSlideId || s.slideId);
  };
  // Mismo gesto que el Setlist, en cuadrícula (ver useArrastreGrid): grupo = una sección de una canción.
  const arrastreMini = useArrastreGrid({
    habilitado: !adHoc,
    grupoDe: (idx) => { const s = slides[idx]; return s && s.type === "cancion" ? `${s.songId}|${ocurrenciaDe(s)}` : s?.grupoId && s.totalGrupo > 1 && onReordenarEnGrupo ? `g|${s.grupoId}` : null; },
    onReorder: (desde, hacia) => moverDiapositiva(desde, hacia),
  });
  const moverDiapositiva = (desde, hacia) => {
    const a = slides[desde], b = slides[hacia];
    if (!a || !b || desde === hacia) return;
    if (a.grupoId && a.grupoId === b.grupoId) { onReordenarEnGrupo(a.grupoId, a.indiceEnGrupo, b.indiceEnGrupo); return; }
    if (a.type !== "cancion" || b.type !== "cancion" || a.songId !== b.songId || ocurrenciaDe(a) !== ocurrenciaDe(b)) {
      showToast("Solo se puede mover dentro de la misma sección de la canción.", "info");
      return;
    }
    const seccion = seccionDe(a);
    const i = seccion.findIndex((x) => x.slideId === a.slideId);
    const j = seccion.findIndex((x) => x.slideId === b.slideId);
    const orden = [...seccion];
    const [movida] = orden.splice(i, 1);
    orden.splice(j, 0, movida);
    onRearmarSeccion(a.songId, a.blockKey, orden.map(segmentoDe), "No se pudo mover la diapositiva");
  };
  const miniatura = (s, i) => {
    const color = sectionColorFor(s);
    const label = s.type === "cancion" ? s.blockLabel : s.type === "biblia" ? s.reference : s.nombre || s.title;
    const preview = s.type === "cancion" ? s.lines.join(" ") : s.type === "biblia" ? s.text : s.nombre ? [s.title, s.subtitle].filter(Boolean).join(" · ") : s.subtitle; // con nombre: el cuadro muestra el contenido
    const isActive = !adHoc && i === activeIdx;
    return (
      <div
        key={s.slideId} onClick={() => { setItemVisto(null); gotoPlanSlide(i); }} className="thumb" role="button" tabIndex={0}
        // Arrastrar para reordenar (solo letra de canciones, dentro de su misma sección) — ver arrastreMini.
        {...arrastreMini.itemProps(i)}
        // Escritorio: clic derecho abre el menú (editar diseño, mover/copiar...). Sin doble clic a
        // propósito: el primer clic ya proyecta la diapositiva.
        onContextMenu={puedeDisenar && s.type === "slide" ? (e) => { e.preventDefault(); setMenuDiap({ x: e.clientX, y: e.clientY, s, sub: null }); } : arrastreMini.itemProps(i).onContextMenu}
        style={{ textAlign: "left", padding: 0, borderRadius: 10, cursor: "pointer", outline: isActive ? "3px solid var(--wf-brand-accent)" : "none", outlineOffset: 2, background: "transparent", overflow: "hidden",
          boxShadow: isActive ? "0 4px 14px rgba(232,130,30,0.3)" : "0 1px 4px rgba(22,50,79,0.14)",
          ...arrastreMini.estiloItem(i) }}
      >
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: esPaginaPresentacion(s) ? `center / contain no-repeat url(${s.imageUrl}), #000` : "#0a0e14", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 10px", boxSizing: "border-box" }}>
          {s.diseno && <DiapositivaDisenada diapositiva={s.diseno} />}
          <span style={{ position: "absolute", top: 3, left: 6, fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.45)", zIndex: 1 }}>{i + 1}</span>
          {!esPaginaPresentacion(s) && !s.diseno && <span style={{ fontSize: 10.5, lineHeight: 1.3, textAlign: "center", color: "#fff", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{preview}</span>}
          {((!esPaginaPresentacion(s) && !s.diseno) || (puedeDisenar && s.type === "slide")) && <button
            onClick={(e) => { e.stopPropagation(); if (puedeDisenar && s.type === "slide" && s.diseno) abrirEditor(s); else startEditingSlide(s); }}
            title={puedeDisenar && s.type === "slide" ? "Editar el diseño de esta diapositiva" : "Editar esta diapositiva (corregir texto)"}
            style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          ><Pencil size={11} color="#fff" /></button>}
          {/* "⋯" visible: el mismo menú del clic derecho (mover, copiar, sacar del grupo...). */}
          {puedeDisenar && s.type === "slide" && (
            <button
              onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuDiap({ x: r.left, y: r.bottom + 4, s, sub: null }); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Más opciones: mover, copiar, sacar del grupo"
              style={{ position: "absolute", top: 4, right: 56, width: 22, height: 22, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}
            ><MoreHorizontal size={12} color="#fff" /></button>
          )}
          {!adHoc && (
            <button
              onClick={(e) => { e.stopPropagation(); borrarDiapositiva(s); }}
              title="Borrar esta diapositiva"
              style={{ position: "absolute", top: 4, right: 30, width: 22, height: 22, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            ><Trash2 size={11} color="#FF8A80" /></button>
          )}
        </div>
        <div style={{ background: color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    );
  };


  const botonFinalizar = (
    <button data-tour="envivo-finalizar" onClick={finalizarConConfirmacion} disabled={!canEnd && !enPractica} title={canEnd || enPractica ? undefined : `Solo ${liveOwner} o un administrador puede finalizar esta transmisión`} style={{ fontSize: 11, fontWeight: 700, color: canEnd || enPractica ? "#C23B32" : "#B7BEC9", background: "transparent", border: `1px solid ${canEnd || enPractica ? "#C23B32" : "var(--wf-border)"}`, borderRadius: 20, padding: "3px 10px", cursor: canEnd || enPractica ? "pointer" : "not-allowed", flexShrink: 0 }}>{enPractica ? "Salir de la práctica" : "Finalizar evento"}</button>
  );
  // Franjas de estado, arriba de todo y en cualquier modo: práctica, pantalla en negro y proyección
  // cerrada. Que la consola diga en grande cuando algo no está normal.
  const franja = (fondo, color, icono, texto, accion) => (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: isCompact ? "8px 16px" : "7px 16px", background: fondo, color, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {icono}<span style={{ flex: 1, minWidth: 0 }}>{texto}</span>{accion}
    </div>
  );
  const botonFranja = (label, onClick, extra = {}) => (
    <button onClick={onClick} style={{ fontSize: 12, fontWeight: 800, border: "none", borderRadius: 16, padding: "5px 12px", cursor: "pointer", background: "rgba(255,255,255,0.95)", color: "#16324F", flexShrink: 0, fontFamily: "inherit", ...extra }}>{label}</button>
  );
  const franjasDeEstado = (
    <>
      {enPractica && franja("#1F8A73", "#fff", <GraduationCap size={17} />, <>MODO PRÁCTICA · nada de esto sale en la pantalla de la iglesia. Toca, avanza y equivócate tranquilo.</>, botonFranja("Salir de la práctica", onEnd))}
      {fijada && franja("#7B3FA0", "#fff", <Pin size={17} />, <>Pantalla FIJADA en "{fijada.type === "cancion" ? `${fijada.songTitle} · ${fijada.blockLabel}` : fijada.type === "biblia" ? fijada.reference : fijada.nombre || fijada.title || "Diapositiva"}" · puedes tocar y moverte, nada sale en la pantalla</>, botonFranja("Soltar y proyectar lo que veo", onSoltar))}
      {mensajeEscenario && onMensajeEscenario && franja("#E8821E", "#16233A", <MessageSquare size={17} />, <>En el ESCENARIO: «{mensajeEscenario}» · el público no lo ve</>, botonFranja("Quitar", () => onMensajeEscenario("")))}
      {blanked && franja("#C23B32", "#fff", <MonitorOff size={17} />, <>La pantalla está en NEGRO · la iglesia no ve nada</>, botonFranja("Volver a mostrar", () => setBlanked(false)))}
      {mostrarAvisoProyeccion && franja("#F6C344", "#16324F", <AlertTriangle size={17} />, <>La pantalla de proyección no está abierta · lo que pases aquí no se ve en el proyector</>, <>
        {botonFranja("Abrir proyección", onOpenPublicScreen, { background: "#16324F", color: "#fff" })}
        {botonFranja("Conectar un TV", () => setShowOtroEquipo(true))}
        {botonFranja("Ya está abierta en otro equipo", () => setAvisoProyeccionOculto(true), { background: "transparent", color: "#16324F", textDecoration: "underline", padding: "5px 4px" })}
      </>)}
    </>
  );
  const tecla = { display: "inline-block", minWidth: 16, padding: "0 6px", borderRadius: 6, border: "1px solid var(--wf-border)", borderBottomWidth: 2, background: "var(--wf-card)", color: "var(--wf-text)", fontWeight: 700, fontSize: 11, lineHeight: "18px", textAlign: "center" };
  // Botones grandes del modo sencillo (escritorio).
  const botonGrande = ({ icon: Icon, label, sub, onClick, fondo = "var(--wf-hover)", color = "var(--wf-text)", tour, ancho = 120, titulo }) => (
    <button onClick={onClick} data-tour={tour} title={titulo || label} className="hoverable"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: ancho, height: 52, padding: "0 16px", border: "none", borderRadius: 14, cursor: "pointer", background: fondo, color, fontFamily: "inherit", flexShrink: 0, boxShadow: "0 2px 8px rgba(22,50,79,0.10)" }}>
      <Icon size={22} strokeWidth={2} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{label}</span>
        {sub && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
    </button>
  );
  const barraSencilla = (
    <div data-tour="envivo-paneles" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.06)", flexShrink: 0, flexWrap: "wrap", rowGap: 8 }}>
      {botonGrande({ icon: ChevronLeft, label: "Anterior", onClick: () => avanzar(-1), ancho: 130 })}
      {botonGrande({ icon: ChevronRight, label: "Siguiente", sub: cambiaDeElemento ? `Pasas a: ${nombreSiguiente}` : next ? null : "Es la última", onClick: () => avanzar(1), fondo: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", tour: "envivo-siguiente", ancho: 190 })}
      {botonGrande({ icon: MonitorOff, label: blanked ? "Volver a mostrar" : "Negro", sub: blanked ? null : "Esconde todo", onClick: () => setBlanked((b) => !b), fondo: blanked ? "#C23B32" : "var(--wf-hover)", color: blanked ? "#fff" : "var(--wf-text)", tour: "envivo-negro", ancho: 140 })}
      {onFijar && botonGrande({ icon: fijada ? PinOff : Pin, label: fijada ? "Soltar" : "Fijar", sub: fijada ? "Volver a transmitir" : "Congela la pantalla", onClick: () => (fijada ? onSoltar() : onFijar()), fondo: fijada ? "#7B3FA0" : "var(--wf-hover)", color: fijada ? "#fff" : "var(--wf-text)", tour: "envivo-fijar", ancho: 140, titulo: "Deja la pantalla quieta en lo que se ve ahora, para moverte por la consola sin que se proyecte (tecla F)" })}
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--wf-divider)", margin: "4px 4px" }} />
      {botonGrande({ icon: Plus, label: "Agregar", sub: "Canción, texto, video…", onClick: () => { setDestinoConsola(null); setShowAgregarConsola(true); }, tour: "envivo-agregar", ancho: 140 })}
      {botonGrande({ icon: BookOpen, label: mmPanel === "biblia" ? "Volver" : "Biblia", sub: mmPanel === "biblia" ? "a las diapositivas" : "Buscar un versículo", onClick: () => setMmPanel((p) => (p === "biblia" ? "transmision" : "biblia")), fondo: mmPanel === "biblia" ? "#2F5FA8" : "var(--wf-hover)", color: mmPanel === "biblia" ? "#fff" : "var(--wf-text)", tour: "envivo-biblia", ancho: 140 })}
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 11.5, color: "var(--wf-muted)", lineHeight: 1.9, textAlign: "right", flexShrink: 0 }}>
        <span style={tecla}>→</span> o <span style={tecla}>Espacio</span> avanza · <span style={tecla}>←</span> regresa<br /><span style={tecla}>B</span> negro · <span style={tecla}>F</span> fijar
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, flex: 1 }}>
      {/* En escritorio el título y "Finalizar" van en la misma fila de las pestañas (más abajo). */}
      {isCompact && (
      <div style={{ padding: "14px 16px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--wf-muted)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6 }}><Radio size={13} /> MULTIMEDIA</div>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventTitle}</div>
        </div>
        {botonFinalizar}
      </div>
      )}
      {/* canEnd ya incluye a los administradores (isAdminViewer) además de a quien inició la
          transmisión -- antes SOLO ese dispositivo podía finalizarla, así que si se cerraba sin tocar
          "Finalizar evento" (compu apagada, batería muerta) la transmisión quedaba bloqueada para
          absolutamente todos, incluido el admin, hasta que pasaran las 24h del cierre automático por
          abandono (ver LIVE_SESSION_STALE_MS) -- un admin necesita poder cortarla al instante. */}
      {!canEnd && <div style={{ padding: "0 16px 6px", fontSize: 10, color: "var(--wf-faint)" }}>Solo {liveOwner} o un administrador puede finalizar esta transmisión.</div>}

      {isCompact ? (
      <>
      {/* Barra de herramientas: pantalla 2, negro */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 10px", flexWrap: "wrap" }}>
        <button data-tour="envivo-proyeccion" onClick={onOpenPublicScreen} style={{ ...ctrlBtn, background: "var(--wf-brand-primary)", color: "var(--wf-on-brand-primary)" }}><Radio size={14} /> Reabrir proyección</button>
        {onMensajeEscenario && <button onClick={() => setShowEscenario(true)} style={{ ...ctrlBtn, ...(mensajeEscenario || temporizadorActivo(temporizador) ? { background: "#E8821E", color: "#16233A", border: "none" } : {}) }}><MessageSquare size={14} /> Escenario</button>}
        <button data-tour="envivo-negro" onClick={() => setBlanked((b) => !b)} style={{ ...ctrlBtn, background: blanked ? "#C23B32" : "var(--wf-hover)", color: blanked ? "#fff" : "var(--wf-text)" }}><MonitorOff size={14} /> {blanked ? "Reanudar" : "Pantalla en negro"}</button>
        <div style={{ flex: 1 }} />
        {botonAgregarConsola({ tour: "envivo-agregar" })}
      </div>
      {franjasDeEstado}

      {/* Sin letrero de "improvisado" (pedido de Eldin, 2026-10-08): para volver al plan basta tocar
          cualquier diapositiva o elemento del orden del culto (gotoPlanSlide). */}

      {/* Cuerpo: riel de íconos + panel principal (izquierda) + vista previa y controles (derecha), estilo Proyektor */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16, padding: "0 16px 16px" }}>
        {/* Riel de íconos: cambia qué panel se ve a la izquierda sin tocar la vista previa/controles de la derecha */}
        <div data-tour="envivo-paneles" style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
          {[
            { key: "biblia", icon: BookOpen, title: "Biblia" },
            { key: "transmision", icon: ListMusic, title: "Transmisión" },
            { key: "estilo", icon: Palette, title: "Estilo" },
          ].map(({ key, icon: Icon, title }) => (
            <button
              key={key} onClick={() => setMmPanel(key)} title={title}
              style={{ width: 40, height: 40, borderRadius: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: mmPanel === key ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: mmPanel === key ? "#fff" : "var(--wf-muted)", boxShadow: mmPanel === key ? "0 3px 10px rgba(232,130,30,0.35)" : "none" }}
            ><Icon size={18} /></button>
          ))}
        </div>

        {/* La Biblia se queda abierta (escondida) al cambiar de pestaña: así recuerda el libro, el
            capítulo y la búsqueda donde ibas (pedido de Eldin, 2026-10-18). */}
        {(bibliaAbierta || mmPanel === "biblia") && (
          <div style={{ display: mmPanel === "biblia" ? "contents" : "none" }}>
          <BibleLivePanel
              version={bibleVersion} setVersion={setBibleVersion}
              history={bibleHistory} setHistory={setBibleHistory}
              onProject={(b) => onStartAdHocBible(b)}
              liveVerse={current?.type === "biblia" && current.bookId ? { ref: current.baseReference ?? current.reference, version: current.version, bookId: current.bookId, chapter: current.chapter, verseStart: current.verseStart, parte: current.parte ?? 0 } : null}
              palabrasPorParte={palabrasPorParte}
            />
          </div>
        )}

        {mmPanel === "estilo" && (
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>LETRA ANIMADA</div>
            <div style={{ marginBottom: 16 }}>
              <SelectorAnimacion liveStyle={liveStyle} setLiveStyle={setLiveStyle} columnas={2} iglesiaId={myIglesiaId} iglesiaNombre={iglesiaNombre} usuarioId={usuarioId} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>FONDO DE LA PROYECCIÓN</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {Object.entries(LIVE_THEMES).map(([key, t]) => (
                <button key={key} onClick={() => { avisarFondoPropioAnimada(); setLiveStyle((s) => ({ ...s, theme: key, ...(animacionActiva(s) ? { animFondo: "propio" } : {}) })); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 12, border: liveStyle.theme === key && !(animacionActiva(liveStyle) && liveStyle.animFondo !== "propio") ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", background: "var(--wf-card)" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: t.bg }} />
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 3, background: "var(--wf-hover)", padding: 3, borderRadius: 12, marginBottom: 8, width: "fit-content" }}>
              <button onClick={() => { avisarFondoPropioAnimada(); setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "imagen", ...(animacionActiva(s) ? { animFondo: "propio" } : {}) })); }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: liveStyle.theme === "custom" && customBgType === "imagen" ? "#B15EA0" : "transparent", color: liveStyle.theme === "custom" && customBgType === "imagen" ? "#fff" : "var(--wf-muted)" }}><ImgIcon size={12} /> Imagen</button>
              <button onClick={() => { avisarFondoPropioAnimada(); setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "video", ...(animacionActiva(s) ? { animFondo: "propio" } : {}) })); }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: liveStyle.theme === "custom" && customBgType === "video" ? "#B15EA0" : "transparent", color: liveStyle.theme === "custom" && customBgType === "video" ? "#fff" : "var(--wf-muted)" }}><Play size={12} /> Video (movimiento)</button>
            </div>
            {customBgType === "imagen" ? (
              <div style={{ marginBottom: 12 }}>
                <MediaPicker iglesiaId={myIglesiaId} tipo="imagen" value={liveStyle.customImage} onChange={(url) => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "imagen", customImage: url }))} />
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {/* El filtro !startsWith("http") es solo para no mostrar un video base64 viejo (de antes
                    de este cambio) hecho ilegible acá -- uno nuevo siempre es una URL https:// real. */}
                <input
                  placeholder="o pega un enlace https://... (mp4 de fondo con movimiento)"
                  value={liveStyle.customVideo && !liveStyle.customVideo.startsWith("http") ? "" : liveStyle.customVideo || ""}
                  onChange={(e) => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "video", customVideo: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <MediaPicker iglesiaId={myIglesiaId} tipo="video" value={liveStyle.customVideo} onChange={(url) => setLiveStyle((s) => ({ ...s, theme: "custom", customBgType: "video", customVideo: url }))} />
                {liveStyle.customVideo && (
                  <div style={{ fontSize: 11, color: "#1F8A73", marginTop: 6 }}>Video de fondo configurado ✓ — se reproduce en bucle detrás de toda la letra/versículos.</div>
                )}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>TIPOGRAFÍA</div>
            {/* Desplegable en vez de fila de botones -- con 20 fuentes ya no cabían cómodas en una
                fila (pedido de Eldin, 2026-10-05). El propio <select> y cada <option> llevan la
                fuente real como estilo, así que al abrirlo cada opción ya se ve con su propia letra. */}
            <select
              value={liveStyle.font || "elegante"}
              onChange={(e) => setLiveStyle((s) => ({ ...s, font: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 16, fontFamily: font.family, fontWeight: font.weight, fontStyle: font.italic ? "italic" : "normal", textTransform: font.transform }}
            >
              {Object.entries(LIVE_FONTS).map(([key, f]) => (
                <option key={key} value={key} style={{ fontFamily: f.family, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", textTransform: f.transform }}>{f.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>COLOR DE LETRA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {Object.entries(LIVE_TEXT_COLORS).map(([key, c]) => (
                <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, textColor: c.value }))} title={c.label} style={{ width: 28, height: 28, borderRadius: "50%", background: c.value, border: (liveStyle.textColor || "#FFFFFF") === c.value ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0 }} />
              ))}
              <label title="Elegir otro color" style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--wf-border)", cursor: "pointer", padding: 0, position: "relative", overflow: "hidden", background: !Object.values(LIVE_TEXT_COLORS).some((c) => c.value === (liveStyle.textColor || "#FFFFFF")) ? (liveStyle.textColor || "#FFFFFF") : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)", display: "flex" }}>
                <input type="color" value={liveStyle.textColor || "#FFFFFF"} onChange={(e) => setLiveStyle((s) => ({ ...s, textColor: e.target.value }))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
              </label>
            </div>
            {/* Diseño de transmisión para canciones: cambia solo cómo se destaca la 2a línea de cada
                diapositiva (la que cierra la frase), no el contenido ni el tamaño. Primeros 3 de una
                lista más larga -- Eldin ya vio las otras 7+ opciones sugeridas y decidió empezar por
                estas. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>DISEÑO DE LAS LETRAS</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {Object.entries(LINE_STYLES).map(([key, s]) => (
                <button key={key} onClick={() => setLiveStyle((st) => ({ ...st, lineStyle: key }))} style={{ padding: "6px 11px", borderRadius: 12, border: (liveStyle.lineStyle || "tradicional") === key ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 12, fontWeight: 600 }}>{s.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>TAMAÑO DE LETRA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-faint)" }}>A</span>
              <input
                type="range" min={0.6} max={1.8} step={0.05}
                value={fontScale}
                onChange={(e) => setLiveStyle((s) => ({ ...s, fontScale: parseFloat(e.target.value) }))}
                style={{ flex: 1, accentColor: "var(--wf-brand-accent)", cursor: "pointer" }}
              />
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--wf-faint)" }}>A</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-text)", width: 34, textAlign: "right" }}>{Math.round(fontScale * 100)}%</span>
            </div>
            {/* Versículos: antes el texto usaba el mismo COLOR DE LETRA que canciones/slides (sigue
                siendo el valor por defecto si no se toca nada acá) y la cita ("Mateo 5:25") tenía un
                color fijo en el código -- ahora los dos son configurables por separado. */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", margin: "16px 0 6px" }}>VERSÍCULOS</div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginBottom: 6 }}>Color del texto del versículo</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {Object.entries(LIVE_TEXT_COLORS).map(([key, c]) => (
                <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, bibliaTextColor: c.value }))} title={c.label} style={{ width: 24, height: 24, borderRadius: "50%", background: c.value, border: (liveStyle.bibliaTextColor || liveStyle.textColor || "#FFFFFF") === c.value ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0 }} />
              ))}
              <label title="Elegir otro color" style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--wf-border)", cursor: "pointer", padding: 0, position: "relative", overflow: "hidden", background: liveStyle.bibliaTextColor || liveStyle.textColor || "#FFFFFF", display: "flex" }}>
                <input type="color" value={liveStyle.bibliaTextColor || liveStyle.textColor || "#FFFFFF"} onChange={(e) => setLiveStyle((s) => ({ ...s, bibliaTextColor: e.target.value }))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
              </label>
            </div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginBottom: 6 }}>Color de la cita (ej. "Mateo 5:25")</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(LIVE_REFERENCE_COLORS).map(([key, c]) => (
                <button key={key} onClick={() => setLiveStyle((s) => ({ ...s, bibliaReferenciaColor: c.value }))} title={c.label} style={{ width: 24, height: 24, borderRadius: "50%", background: c.value, border: (liveStyle.bibliaReferenciaColor || "#6E9BD1") === c.value ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0 }} />
              ))}
              <label title="Elegir otro color" style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--wf-border)", cursor: "pointer", padding: 0, position: "relative", overflow: "hidden", background: liveStyle.bibliaReferenciaColor || "#6E9BD1", display: "flex" }}>
                <input type="color" value={liveStyle.bibliaReferenciaColor || "#6E9BD1"} onChange={(e) => setLiveStyle((s) => ({ ...s, bibliaReferenciaColor: e.target.value }))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
              </label>
            </div>
          </div>
        )}

        {mmPanel === "transmision" && (
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700 }}>TODAS LAS SLIDES</span>
            <button
              onClick={() => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" }); setShowAddSlide(true); }}
              title="Agregar una diapositiva (ej. el título de la predica o un anuncio) — queda aquí para poder volver a proyectarla"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "#EAF0FA", border: "none", borderRadius: 18, padding: "4px 10px", cursor: "pointer" }}
            ><Plus size={13} /> Agregar diapositiva</button>
          </div>
          {isFreeSession && slides.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "20px 10px", textAlign: "center" }}>Esta es una transmisión sin evento — usa "Agregar diapositiva" arriba para un título/aviso, o Biblia/Improvisar (abajo, a la derecha) para versículos, canciones o videos.</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
            {slides.map((s, i) => {
              const color = sectionColorFor(s);
              const label = s.type === "cancion" ? s.blockLabel : s.type === "biblia" ? s.reference : s.nombre || s.title;
              const preview = s.type === "cancion" ? s.lines.join(" ") : s.type === "biblia" ? s.text : s.nombre ? [s.title, s.subtitle].filter(Boolean).join(" · ") : s.subtitle; // con nombre: el cuadro muestra el contenido
              const isActive = !adHoc && i === activeIdx;
              const isEditable = s.type === "biblia" || s.type === "slide" || s.type === "cancion";
              return (
                <div
                  key={s.slideId} onClick={() => gotoPlanSlide(i)} className="thumb" role="button" tabIndex={0}
                  style={{ textAlign: "left", padding: 0, borderRadius: 14, cursor: "pointer", border: isActive ? "2px solid var(--wf-brand-accent)" : "1px solid transparent", background: "transparent", overflow: "hidden", boxShadow: isActive ? "0 4px 14px rgba(232,130,30,0.3)" : "0 1px 5px rgba(22,50,79,0.12)" }}
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
                        style={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, background: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
          <div style={{ position: "sticky", top: 0, zIndex: 3, background: "var(--wf-bg)", paddingBottom: 10, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, marginBottom: 6 }}><Radio size={11} /> VISTA PREVIA</div>
            <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(22,50,79,0.18)" }}>
              <ProjectionPanel slide={current} blanked={blanked} split={false} liveStyle={liveStyle} thumbnail />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => goto(0)} style={{ ...ctrlBtn, width: 38, justifyContent: "center", padding: "9px 0" }}><SkipBack size={15} /></button>
            <button onClick={() => avanzar(-1)} aria-label="Anterior" style={{ ...ctrlBtn, flex: 1, justifyContent: "center", minHeight: 48 }}><ChevronLeft size={20} /></button>
            <button data-tour="envivo-siguiente" onClick={() => avanzar(1)} aria-label="Siguiente" style={{ ...ctrlBtn, flex: 2, justifyContent: "center", minHeight: 48, background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", border: "none", fontWeight: 800 }}>Siguiente <ChevronRight size={20} /></button>
            <button onClick={() => goto(Infinity)} style={{ ...ctrlBtn, width: 38, justifyContent: "center", padding: "9px 0" }}><SkipForward size={15} /></button>
          </div>

          {currentSongSections.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>SECCIONES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {currentSongSections.map(([label, color]) => (
                  <button key={label} onClick={() => jumpToLabel(label)} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: color, border: "none", borderRadius: 18, padding: "4px 10px", cursor: "pointer" }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {current && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: TYPE_META[current.type].color, letterSpacing: 0.5, marginBottom: 4 }}>AHORA · {TYPE_META[current.type].label.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>{next ? `Siguiente: ${next.type === "cancion" ? next.blockLabel : next.type === "biblia" ? next.reference : next.nombre || next.title}` : adHoc ? "No hay más diapositivas" : "Última slide del servicio"}</div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700, marginBottom: 6 }}>IMPROVISAR</div>
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
          {customItems.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700, marginBottom: 6 }}>DIAPOSITIVAS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {customItems.map(({ itemId, s, total }) => {
                  const isLive = !adHoc && !!current && current.type === "slide" && refDiap(current).itemId === itemId;
                  return (
                    <div key={itemId} style={{ display: "flex", alignItems: "center", gap: 6, background: isLive ? "var(--wf-active-bg)" : "var(--wf-card)", border: isLive ? "1px solid var(--wf-brand-accent)" : "1px solid transparent", borderRadius: 12, padding: "5px 6px", boxShadow: "0 1px 4px rgba(22,50,79,0.08)" }}>
                      <button onClick={() => gotoPlanSlide(slides.findIndex((x) => x.slideId === s.slideId))} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(total > 1 ? tituloBase(s.title) : s.title) || "(sin título)"}{total > 1 && <span style={{ fontWeight: 500, color: "var(--wf-muted)" }}> · {total}</span>}
                      </button>
                      {!s.diseno && <button onClick={() => startEditingSlide(s)} title="Editar esta diapositiva (corregir texto)" style={{ ...iconGhost, color: "#2F5FA8", flexShrink: 0 }}><Pencil size={13} /></button>}
                      <button onClick={() => onRemoveLiveSlide(itemId)} title={total > 1 ? "Quitar el grupo completo" : "Borrar esta diapositiva"} style={{ ...iconGhost, color: "#C23B32", flexShrink: 0 }}><X size={13} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      </>
      ) : (
      <>
      {/* ===== ESCRITORIO: cinta tipo Office arriba, orden del culto | diapositivas | vista previa =====
          (pedido de Eldin, 2026-10-07). La idea: cambiar el estilo, buscar en la Biblia o insertar algo
          SIN dejar de ver las diapositivas ni lo que está al aire. En celular se queda el riel de
          íconos de siempre (rama isCompact de arriba). */}
      <nav aria-label="Pestañas de En vivo" data-tour="envivo-pestanas" style={{ display: "flex", alignItems: "center", gap: 2, padding: "4px 16px 0", borderBottom: "1px solid var(--wf-divider)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, maxWidth: 300, marginRight: 14, flexShrink: 1 }} title={eventTitle}>
          <Radio size={13} color="#C23B32" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventTitle}</span>
        </div>
        {!sencillo && [["transmision", "Transmisión"], ["biblia", "Biblia"], ["estilo", "Estilo"], ["insertar", "Insertar"]].map(([key, label]) => (
          <button
            key={key} onClick={() => setMmPanel(key)}
            style={{ padding: "7px 12px 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontWeight: mmPanel === key ? 700 : 500, color: mmPanel === key ? "var(--wf-text)" : "var(--wf-muted)", borderBottom: `2px solid ${mmPanel === key ? "var(--wf-brand-accent)" : "transparent"}`, flexShrink: 0 }}
          >{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {!sencillo && <div style={{ marginRight: 10, padding: "3px 0" }}>{botonAgregarConsola({ tour: "envivo-agregar" })}</div>}
        <button
          data-tour="envivo-modo" onClick={() => setSencillo((v) => !v)} className="hoverable"
          title={sencillo ? "Ver todas las herramientas: Estilo, Insertar, secciones de la canción…" : "Volver a la vista sencilla, solo con lo esencial"}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 16, padding: "5px 11px", cursor: "pointer", marginRight: 8, flexShrink: 0, fontFamily: "inherit" }}
        >{sencillo ? <><SlidersHorizontal size={13} /> Más herramientas</> : <><Sparkles size={13} /> Vista sencilla</>}</button>
        {onAyuda && (
          <button data-tour="envivo-ayuda" onClick={onAyuda} title="¿Cómo se usa? Ver la guía otra vez" aria-label="Ayuda" className="hoverable"
            style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "var(--wf-hover)", color: "var(--wf-text)", cursor: "pointer", fontSize: 14, fontWeight: 800, marginRight: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>?</button>
        )}
        {botonFinalizar}
      </nav>
      {franjasDeEstado}
      {sencillo && barraSencilla}
      {!sencillo && (
        <CintaAdaptable
          tour="envivo-paneles" dibujarGrupo={grupoCinta}
          estilo={{ padding: "6px 8px 4px", minHeight: 76, boxSizing: "border-box", background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.06)" }}
          grupos={(mmPanel === "biblia" ? [
          grupoItem("Proyección", navegacionRapida()),
          grupoItem("", <div style={{ display: "flex", alignItems: "center", padding: "0 16px", maxWidth: 440 }}>
              <span style={{ fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.5 }}>Busca un libro, una cita (ej. stgo 4:1) o palabras del versículo, aunque no estén exactas. Toca el versículo para proyectarlo. Los versículos largos aparecen en partes (1/2, 2/2): toca la que quieras o avanza con la flecha →.</span>
            </div>, false, "ayuda-biblia"),
        ] : mmPanel === "estilo" ? [
          grupoItem("Proyección", navegacionRapida()),
          grupoItem("Letra animada", botonCinta({ icon: Sparkles, label: (() => { const n = nombreAnimacion(liveStyle) || "Animación"; return n.length > 12 ? n.slice(0, 11) + "…" : n; })(), onClick: () => { setEstiloMas(false); setAnimMenu((v) => !v); }, activo: !!animacionActiva(liveStyle) || animMenu, title: "Letras animadas: elegir un estilo con movimiento", ancho: 76 })),
          grupoItem(editandoCancion ? `Fondo de "${cancionObjetivo.titulo.length > 22 ? cancionObjetivo.titulo.slice(0, 21) + "…" : cancionObjetivo.titulo}"` : "Fondo", <>
              {Object.entries(LIVE_THEMES).map(([key, t]) => (
                <button key={key} onClick={() => aplicarFondo({ theme: key })} title={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 5px", borderRadius: 10, cursor: "pointer", background: "var(--wf-card)", border: fondoEditado.theme === key && !(animacionActiva(liveStyle) && liveStyle.animFondo !== "propio") ? "2px solid #B15EA0" : "1px solid var(--wf-border)" }}>
                  <span style={{ width: 34, height: 20, borderRadius: 5, background: t.bg }} />
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: "var(--wf-text)", whiteSpace: "nowrap" }}>{t.label}</span>
                </button>
              ))}
              {botonCinta({ icon: ImgIcon, label: "Imagen", onClick: () => { aplicarFondo({ theme: "custom", customBgType: "imagen" }); setEstiloMas(true); }, activo: fondoEditado.theme === "custom" && fondoEditadoTipo === "imagen", ancho: 62 })}
              {botonCinta({ icon: Play, label: "Video", onClick: () => { aplicarFondo({ theme: "custom", customBgType: "video" }); setEstiloMas(true); }, activo: fondoEditado.theme === "custom" && fondoEditadoTipo === "video", ancho: 62 })}
            </>, false, "fondo"),
          grupoItem("Fondo por canción", (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox" checked={fondoPorCancion}
                    onChange={(e) => { const on = e.target.checked; setLiveStyle((st) => ({ ...st, fondoPorCancion: on })); setFondoDestino(on ? "cancion" : "todo"); }}
                    style={{ accentColor: "var(--wf-brand-accent)", cursor: "pointer" }}
                  />
                  Cada canción con su fondo
                </label>
                {fondoPorCancion && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 8, padding: 2 }}>
                      {[["todo", "Todo"], ["cancion", "Esta canción"]].map(([k, l]) => (
                        <button
                          key={k} onClick={() => setFondoDestino(k)} disabled={k === "cancion" && !cancionObjetivo}
                          title={k === "cancion" ? (cancionObjetivo ? `Cambiar solo el fondo de "${cancionObjetivo.titulo}"` : "Elige una canción en el orden del culto") : "Cambiar el fondo general (Biblia, diapositivas y canciones sin fondo propio)"}
                          style={{ fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, padding: "3px 8px", cursor: k === "cancion" && !cancionObjetivo ? "not-allowed" : "pointer", opacity: k === "cancion" && !cancionObjetivo ? 0.45 : 1, whiteSpace: "nowrap",
                            background: (editandoCancion ? "cancion" : "todo") === k ? "var(--wf-card)" : "transparent", boxShadow: (editandoCancion ? "cancion" : "todo") === k ? "0 1px 3px rgba(22,50,79,0.15)" : "none", color: "var(--wf-text)" }}
                        >{l}</button>
                      ))}
                    </div>
                    {fondoCancionObjetivo && (
                      <button onClick={quitarFondoCancion} title="Esta canción vuelve a usar el fondo general" style={{ ...iconGhost, color: "#C23B32" }}><X size={13} /></button>
                    )}
                  </div>
                )}
              </div>
            )),
          grupoItem("Texto", <>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <select
                  aria-label="Tipografía" value={liveStyle.font || "elegante"}
                  onChange={(e) => setLiveStyle((st) => ({ ...st, font: e.target.value }))}
                  style={{ ...inputStyle, width: 160, padding: "5px 8px", fontSize: 12, fontFamily: font.family, fontWeight: font.weight, fontStyle: font.italic ? "italic" : "normal", textTransform: font.transform }}
                >
                  {Object.entries(LIVE_FONTS).map(([key, f]) => (
                    <option key={key} value={key} style={{ fontFamily: f.family, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", textTransform: f.transform }}>{f.label}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 4 }}>
                  {Object.entries(LIVE_TEXT_COLORS).map(([key, c]) => (
                    <button key={key} onClick={() => setLiveStyle((st) => ({ ...st, textColor: c.value }))} title={c.label} aria-label={`Letra ${c.label}`} style={{ width: 18, height: 18, borderRadius: "50%", background: c.value, border: (liveStyle.textColor || "#FFFFFF") === c.value ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0 }} />
                  ))}
                </div>
              </div>
            </>),
          grupoItem("Diseño de la letra", (
              <select
                aria-label="Diseño de la letra" value={liveStyle.lineStyle || "tradicional"}
                onChange={(e) => setLiveStyle((st) => ({ ...st, lineStyle: e.target.value }))}
                style={{ ...inputStyle, width: 190, padding: "6px 8px", fontSize: 12 }}
              >
                {Object.entries(LINE_STYLES).map(([key, ls]) => <option key={key} value={key}>{ls.label}</option>)}
              </select>
            )),
          grupoItem("Tamaño de letra", (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-faint)" }}>A</span>
                <input
                  type="range" min={0.6} max={1.8} step={0.05} value={fontScale} aria-label="Tamaño de letra"
                  onChange={(e) => setLiveStyle((st) => ({ ...st, fontScale: parseFloat(e.target.value) }))}
                  style={{ width: 120, accentColor: "var(--wf-brand-accent)", cursor: "pointer" }}
                />
                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--wf-faint)" }}>A</span>
                <span style={{ fontSize: 11, fontWeight: 700, width: 34, textAlign: "right" }}>{Math.round(fontScale * 100)}%</span>
              </div>
            )),
          grupoItem("Ajustes de la letra", botonCinta({ icon: estiloMas ? ChevronUp : SlidersHorizontal, label: estiloMas ? "Cerrar" : "Sombra y más", title: "Sombra, alineación, interlineado e imagen o video de fondo", onClick: () => { setAnimMenu(false); setEstiloMas((v) => !v); }, activo: estiloMas, ancho: 84 }), true),
        ] : mmPanel === "insertar" ? [
          grupoItem("Proyección", navegacionRapida()),
          grupoItem("Del culto", <>
              {botonCinta({ icon: Music, label: "Canción", onClick: () => setShowAdHocSong(true) })}
              {botonCinta({ icon: BookOpen, label: "Versículo", onClick: () => setMmPanel("biblia") })}
            </>),
          grupoItem("Presentación", botonCinta({ icon: FileUp, label: "Importar", onClick: () => setShowImportar(true), title: "Importar un PDF, imágenes de Canva, o un Word con el bosquejo", ancho: 64 })),
          grupoItem("De último momento", <>
              {onDisenarNueva && botonCinta({ icon: PenTool, label: "Diseñar", title: "Diseñar una diapositiva desde cero (con plantillas)", onClick: () => onDisenarNueva(anclaParaAgregar()?.id || null) })}
              {botonCinta({ icon: Type, label: "Diapositiva", onClick: () => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" }); setShowAddSlide(true); } })}
              {botonCinta({ icon: ImgIcon, label: "Video", onClick: () => setShowAdHocVideo(true) })}
            </>, true),
        ] : [
          grupoItem("Navegación", <>
              {botonCinta({ icon: SkipBack, label: "Inicio", onClick: () => goto(0) })}
              {botonCinta({ icon: ChevronLeft, label: "Anterior", onClick: () => avanzar(-1) })}
              {botonCinta({ icon: ChevronRight, label: "Siguiente", onClick: () => avanzar(1), acento: true, tour: "envivo-siguiente" })}
              {botonCinta({ icon: SkipForward, label: "Final", onClick: () => goto(Infinity) })}
            </>),
          grupoItem("Pantalla", <>
              {botonCinta({ icon: MonitorOff, label: "Negro", onClick: () => setBlanked((b) => !b), activo: blanked, tour: "envivo-negro" })}
              {onFijar && botonCinta({ icon: fijada ? PinOff : Pin, label: fijada ? "Soltar" : "Fijar", onClick: () => (fijada ? onSoltar() : onFijar()), activo: !!fijada, title: "Congelar la pantalla para moverte sin proyectar (tecla F)" })}
              {botonCinta({ icon: Radio, label: "Proyección", onClick: onOpenPublicScreen, title: "Reabrir la pantalla de proyección", tour: "envivo-proyeccion" })}
              {onMensajeEscenario && botonCinta({ icon: MessageSquare, label: "Escenario", onClick: () => setShowEscenario(true), activo: !!mensajeEscenario || temporizadorActivo(temporizador), title: "Pantalla de escenario: mensajes, temporizador del mensaje y enlace del monitor" })}
              {botonCinta({ icon: Tv, label: "Pantallas y TV", onClick: () => setShowOtroEquipo(true), title: "Conectar un Smart TV con número, o abrir en celular/tablet con QR", ancho: 76 })}
            </>),
          grupoItem("Proyectar", botonCinta({ icon: Music, label: "Desde biblioteca", onClick: () => setShowAdHocSong("proyectar"), title: "Buscar una canción de la biblioteca y ponerla en pantalla de una vez", ancho: 96 })),
          grupoItem("Secciones de la canción", currentSongSections.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 560, alignContent: "center" }}>
                {currentSongSections.map(([label, color]) => (
                  <button key={label} onClick={() => jumpToLabel(label)} style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: color, border: "none", borderRadius: 14, padding: "3px 9px", cursor: "pointer" }}>{label}</button>
                ))}
              </div>
            ) : <span style={{ fontSize: 11, color: "var(--wf-faint)", maxWidth: 200 }}>Aparecen cuando hay una canción al aire.</span>, true),
        ]).filter(Boolean)}
        />
      )}
      {/* "Más opciones" de Estilo: menú flotante encima de las diapositivas, como los desplegables
          de Office — antes empujaba todo hacia abajo y se comía media pantalla (pedido de Eldin,
          2026-10-08). Se cierra con la X, con "Menos" o con un clic afuera. */}
      {letraCompleta && (
        <ModalShell title={`Letra de "${letraCompleta.titulo}"`} icon={Pencil} color="#1F8A73" onClose={() => setLetraCompleta(null)}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 8 }}>
            Corrige lo que necesites. Cada parte empieza con su nombre entre corchetes (ej. <b>[Coro]</b>) y una <b>línea en blanco</b> separa una diapositiva de otra. Se guarda en la canción para siempre.
          </div>
          <textarea
            value={letraCompleta.texto} autoFocus spellCheck
            onChange={(e) => setLetraCompleta((l) => ({ ...l, texto: e.target.value }))}
            style={{ ...inputStyle, height: "min(56vh, 520px)", resize: "vertical", fontSize: 14, lineHeight: 1.5, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setLetraCompleta(null)} style={{ ...primaryBtn, background: "var(--wf-hover)", color: "var(--wf-text)" }}>Cancelar</button>
            <button onClick={guardarLetraCompleta} style={primaryBtn}>Guardar letra</button>
          </div>
        </ModalShell>
      )}
      {showOtroEquipo && <PantallaOtroEquipo iglesiaId={myIglesiaId} onCerrar={() => setShowOtroEquipo(false)} />}
      {showEscenario && onMensajeEscenario && <PanelEscenario mensaje={mensajeEscenario} onMensaje={onMensajeEscenario} iglesiaId={myIglesiaId} slug={iglesiaSlug} onCerrar={() => setShowEscenario(false)}
        temporizador={temporizador} onTemporizador={onTemporizador} autoTemporizador={autoTemporizador} onAutoTemporizador={onAutoTemporizador} />}
      {mmPanel === "estilo" && animMenu && (
        <div style={{ position: "relative", height: 0, zIndex: 36 }}>
          <div onClick={() => setAnimMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 6, left: 16, zIndex: 1, width: "min(760px, calc(100vw - 32px))", maxHeight: "min(560px, 70vh)", overflowY: "auto", padding: "12px 14px 14px", background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 12px 36px rgba(22,50,79,0.25)", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-heading)" }}>Letra animada</span>
              <button onClick={() => setAnimMenu(false)} title="Cerrar" aria-label="Cerrar" style={iconGhost}><X size={15} /></button>
            </div>
            <SelectorAnimacion liveStyle={liveStyle} setLiveStyle={setLiveStyle} columnas={5} iglesiaId={myIglesiaId} iglesiaNombre={iglesiaNombre} usuarioId={usuarioId} />
          </div>
        </div>
      )}
      {mmPanel === "estilo" && estiloMas && (
        <div style={{ position: "relative", height: 0, zIndex: 35 }}>
          <div onClick={() => setEstiloMas(false)} style={{ position: "fixed", inset: 0, zIndex: 0 }} />
          <div style={{ position: "absolute", top: 6, right: 16, zIndex: 1, width: "min(640px, calc(100vw - 32px))", maxHeight: "min(420px, 60vh)", overflowY: "auto", display: "flex", gap: 20, flexWrap: "wrap", padding: "12px 14px 14px", background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 12px 36px rgba(22,50,79,0.25)", boxSizing: "border-box" }}>
          <button onClick={() => setEstiloMas(false)} title="Cerrar" aria-label="Cerrar" style={{ ...iconGhost, position: "absolute", top: 8, right: 8 }}><X size={15} /></button>
          {/* Ajustes finos de la letra (ver LIVE_SOMBRAS y compañía): para canciones, versículos y
              diapositivas, en vivo y guardados para la próxima transmisión como el resto del estilo. */}
          <div style={{ flex: "1 1 100%", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px 18px", paddingBottom: 12, borderBottom: "1px solid var(--wf-divider)" }}>
            <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 28 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)" }}>LETRA</span>
              <button
                onClick={() => setLiveStyle((st) => { const { interlineado, espaciado, sombra, oscurecer, posicion, alineacion, ...resto } = st; return resto; })}
                className="hoverable" style={{ fontSize: 11, fontWeight: 600, color: "var(--wf-muted)", background: "transparent", border: "none", borderRadius: 8, padding: "2px 6px", cursor: "pointer" }}
              >Restablecer</button>
            </div>
            {[
              { clave: "interlineado", label: "Interlineado", min: 0.9, max: 2.2, paso: 0.05, defecto: 1.35, mostrar: (v) => v.toFixed(2) },
              { clave: "espaciado", label: "Espacio entre letras", min: -0.05, max: 0.3, paso: 0.01, defecto: 0, mostrar: (v) => (v === 0 ? "Normal" : `${v > 0 ? "+" : ""}${Math.round(v * 100)}`) },
              { clave: "oscurecer", label: "Oscurecer imagen o video", min: 0, max: 0.85, paso: 0.05, defecto: 0.45, mostrar: (v) => `${Math.round(v * 100)}%` },
            ].map((c) => {
              const valor = liveStyle[c.clave] ?? c.defecto;
              return (
                <label key={c.clave} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--wf-text)" }}>{c.label}<b style={{ fontSize: 11 }}>{c.mostrar(valor)}</b></span>
                  <input type="range" min={c.min} max={c.max} step={c.paso} value={valor} onChange={(e) => setLiveStyle((st) => ({ ...st, [c.clave]: parseFloat(e.target.value) }))} style={{ accentColor: "var(--wf-brand-accent)", cursor: "pointer" }} />
                </label>
              );
            })}
            {[
              { clave: "sombra", label: "Sombra de la letra", opciones: LIVE_SOMBRAS, defecto: "ninguna" },
              { clave: "posicion", label: "Posición", opciones: LIVE_POSICIONES, defecto: "centro" },
              { clave: "alineacion", label: "Alineación", opciones: LIVE_ALINEACIONES, defecto: "centro" },
            ].map((c) => (
              <div key={c.clave} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11.5, color: "var(--wf-text)" }}>{c.label}</span>
                <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 8, padding: 2, gap: 2 }}>
                  {Object.entries(c.opciones).map(([k, o]) => {
                    const activo = (liveStyle[c.clave] || c.defecto) === k;
                    return (
                      <button key={k} onClick={() => setLiveStyle((st) => ({ ...st, [c.clave]: k }))} style={{ flex: 1, fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, padding: "4px 4px", cursor: "pointer", whiteSpace: "nowrap", color: "var(--wf-text)", background: activo ? "var(--wf-card)" : "transparent", boxShadow: activo ? "0 1px 3px rgba(22,50,79,0.15)" : "none" }}>{o.label}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>{fondoEditadoTipo === "imagen" ? "IMAGEN DE FONDO" : "VIDEO DE FONDO"}{editandoCancion ? ` · SOLO "${cancionObjetivo.titulo.toUpperCase()}"` : ""}</div>
            {fondoEditadoTipo === "imagen" ? (
              <MediaPicker iglesiaId={myIglesiaId} tipo="imagen" value={fondoEditado.customImage} onChange={(url) => aplicarFondo({ theme: "custom", customBgType: "imagen", customImage: url })} />
            ) : (
              <>
                <input
                  placeholder="o pega un enlace https://... (mp4 de fondo con movimiento)"
                  value={fondoEditado.customVideo && !fondoEditado.customVideo.startsWith("http") ? "" : fondoEditado.customVideo || ""}
                  onChange={(e) => aplicarFondo({ theme: "custom", customBgType: "video", customVideo: e.target.value })}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <MediaPicker iglesiaId={myIglesiaId} tipo="video" value={fondoEditado.customVideo} onChange={(url) => aplicarFondo({ theme: "custom", customBgType: "video", customVideo: url })} />
              </>
            )}
          </div>
          <div style={{ flex: "0 1 300px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>VERSÍCULOS</div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginBottom: 4 }}>Color del texto</div>
            <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
              {Object.entries(LIVE_TEXT_COLORS).map(([key, c]) => (
                <button key={key} onClick={() => setLiveStyle((st) => ({ ...st, bibliaTextColor: c.value }))} title={c.label} aria-label={`Versículo ${c.label}`} style={{ width: 22, height: 22, borderRadius: "50%", background: c.value, border: (liveStyle.bibliaTextColor || liveStyle.textColor || "#FFFFFF") === c.value ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0 }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginBottom: 4 }}>Color de la cita</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {Object.entries(LIVE_REFERENCE_COLORS).map(([key, c]) => (
                <button key={key} onClick={() => setLiveStyle((st) => ({ ...st, bibliaReferenciaColor: c.value }))} title={c.label} aria-label={`Cita ${c.label}`} style={{ width: 22, height: 22, borderRadius: "50%", background: c.value, border: (liveStyle.bibliaReferenciaColor || "#6E9BD1") === c.value ? "2px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0 }} />
              ))}
            </div>
          </div>
          </div>
        </div>
      )}


      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, padding: "10px 12px 12px" }}>
        {/* Orden del culto, dividido por bloques igual que el Setlist */}
        <aside aria-label="Orden del culto" data-tour="envivo-orden" style={{ width: "clamp(200px, 17vw, 260px)", flexShrink: 0, overflowY: "auto", background: "var(--wf-card)", borderRadius: 12, boxShadow: "0 2px 10px rgba(22,50,79,0.08)", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 6, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "0 4px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5 }}>ORDEN DEL CULTO</span>
          </div>
          {!sencillo && <div style={{ padding: "0 2px 4px" }}>{botonAgregarConsola({ ancho: true })}</div>}
          {sencillo && serviceOrder.length > 0 && <div style={{ fontSize: 11, color: "var(--wf-faint)", padding: "0 4px 2px" }}>Toca cualquiera para proyectarlo.</div>}
          {serviceOrder.length === 0 && <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "8px 4px" }}>Todavía no hay nada en el orden de este culto.</div>}
          {/* Una fila por elemento, en el orden real del Setlist (los bloques son filas más), para poder
              arrastrar con el mismo gesto del Setlist — ver arrastreOrden. */}
          {serviceOrder.map((it, idx) => {
            const filaArrastre = arrastreOrden.filaProps(idx);
            const quitar = (
              <button
                className="orden-quitar" onClick={(e) => { e.stopPropagation(); if (onOcultar) ocultar(it); else quitarDelOrden(it); }}
                title={onOcultar ? (it.type === "seccion" ? "Ocultar este bloque en la consola (sigue en el setlist)" : "Ocultar en la consola (sigue en el setlist)") : it.type === "seccion" ? "Quitar este bloque" : "Quitar del orden del culto"}
                aria-label="Ocultar en la consola"
                style={{ ...iconGhost, padding: 2, color: "var(--wf-faint)", flexShrink: 0 }}
              >{onOcultar ? <EyeOff size={13} /> : <X size={12} />}</button>
            );
            if (estaOculto(it)) return null;
            if (it.type === "seccion") {
              const cuantos = visiblesDeBloque(it.id).length;
              // Un bloque sin nada que proyectar (Orden y limpieza, Multimedia...) no se muestra en la consola.
              if (cuantos === 0) return null;
              return (
                <div key={it.id} {...filaArrastre} className="orden-fila" style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 10, background: "rgba(124,140,216,0.16)", border: "1px solid #5661B3", marginTop: idx === 0 ? 0 : 4, ...arrastreOrden.estiloFila(idx) }}>
                  <ListMusic size={13} color="#5661B3" />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title || "Bloque"}</span>
                  {cuantos > 0 && <span style={{ fontSize: 10.5, color: "#5661B3", fontWeight: 700 }}>{cuantos}</span>}
                  {quitar}
                </div>
              );
            }
            const alAire = itemAlAire?.id === it.id;
            const visto = !verTodas && itemCentro?.id === it.id;
            const dentroDeBloque = serviceOrder.slice(0, idx).some((x) => x.type === "seccion");
            return (
              <div
                key={it.id} {...filaArrastre} className="orden-fila" role="button" tabIndex={0}
                // Un clic = proyectar su primera diapositiva (pedido de Eldin, 2026-10-11: antes eran dos
                // clics y quien no sabía se quedaba tocando). Si ya está AL AIRE no se reinicia — solo se
                // ven sus diapositivas — para no regresar un canto al inicio por accidente.
                onClick={() => {
                  // Desde la Biblia (en plena prédica) se proyecta sin salir de ella: el operador pone el
                  // título del mensaje y sigue con los versículos (pedido de Eldin, 2026-10-18).
                  setItemVisto(it.id); setVerTodas(false);
                  if (alAire) return;
                  const i = indicePrimeraDiapositiva(it.id);
                  if (i !== -1) gotoPlanSlide(i);
                }}
                title={alAire ? "Ya está al aire · Arrastra para cambiar el orden" : "Clic: proyectar · Arrastra para cambiar el orden"}
                style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: dentroDeBloque ? 12 : 0, padding: "7px 9px", borderRadius: 10, textAlign: "left", cursor: "pointer", fontSize: 12.5, color: "var(--wf-text)", fontWeight: alAire || visto ? 700 : 500, background: alAire ? "var(--wf-active-bg)" : visto ? "var(--wf-hover)" : "var(--wf-card)", border: visto ? "1px solid var(--wf-border)" : "1px solid transparent", ...arrastreOrden.estiloFila(idx) }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: TYPE_META[it.type]?.color || "#5B6472" }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloItem(it)}{it.diapositivas?.length > 1 && <span style={{ fontWeight: 500, color: "var(--wf-muted)" }}> · {it.diapositivas.length}</span>}</span>
                {fondoPorCancion && it.type === "cancion" && liveStyle.fondosCanciones?.[it.songId] && <span title="Tiene su propio fondo" style={{ display: "flex", flexShrink: 0 }}><ImgIcon size={11} color="#B15EA0" /></span>}
                {alAire && <span style={{ fontSize: 9, fontWeight: 800, color: "#C23B32" }}>●</span>}
                {quitar}
              </div>
            );
          })}
          {cuantosOcultos > 0 && onMostrarOcultos && (
            <button onClick={() => onMostrarOcultos()} className="hoverable"
              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11.5, fontWeight: 600, color: "var(--wf-muted)", background: "transparent", border: "1px dashed var(--wf-border)", borderRadius: 10, padding: "6px 9px", cursor: "pointer", fontFamily: "inherit" }}>
              <Eye size={13} /> Mostrar ocultos ({cuantosOcultos})
            </button>
          )}
        </aside>

        {(bibliaAbierta || mmPanel === "biblia") && (
          <div style={{ display: mmPanel === "biblia" ? "contents" : "none" }}>
          <BibleLivePanel
              version={bibleVersion} setVersion={setBibleVersion}
              history={bibleHistory} setHistory={setBibleHistory}
              onProject={(b) => onStartAdHocBible(b)}
              liveVerse={current?.type === "biblia" && current.bookId ? { ref: current.baseReference ?? current.reference, version: current.version, bookId: current.bookId, chapter: current.chapter, verseStart: current.verseStart, parte: current.parte ?? 0 } : null}
              palabrasPorParte={palabrasPorParte}
            />
          </div>
        )}
        {mmPanel !== "biblia" && (
          <section aria-label="Diapositivas" data-tour="envivo-diapositivas" style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "0 4px calc(var(--bottom-nav-height, 80px) + 8px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemCentro ? tituloItem(itemCentro) : "Todas las diapositivas"}</div>
                <div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>{indicesCentro.length} diapositiva{indicesCentro.length === 1 ? "" : "s"}{itemCentro && itemAlAire?.id !== itemCentro.id ? " · no está al aire" : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {itemCentro?.type === "cancion" && onEditarLetraCompleta && (
                  <button onClick={() => abrirLetraCompleta(itemCentro.songId)} title="Corregir toda la letra de esta canción de una vez" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 18, padding: "5px 10px", cursor: "pointer" }}><Pencil size={12} /> Editar letra</button>
                )}
                <button onClick={() => { setVerTodas((v) => !v); setItemVisto(null); }} style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 18, padding: "5px 10px", cursor: "pointer" }}>{verTodas ? "Ver por elemento" : "Ver todas"}</button>
              </div>
            </div>
            {isFreeSession && slides.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "20px 10px", textAlign: "center" }}>Transmisión sin evento — usa la pestaña Insertar para una diapositiva, canción o video, o Biblia para un versículo.</div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, padding: 3 }}>
              {indicesCentro.map((i) => miniatura(slides[i], i))}
            </div>
          </section>
        )}

        {/* Lo que está al aire y lo que sigue — siempre visibles, en cualquier pestaña */}
        <aside aria-label="Vista previa" data-tour="envivo-alaire" style={{ width: "clamp(260px, 25vw, 400px)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#C23B32", letterSpacing: 0.4 }}><Radio size={11} /> AL AIRE</span>
            {alAire && <span style={{ fontSize: 11, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{blanked ? "Pantalla en negro" : alAire.type === "cancion" ? `${alAire.songTitle} · ${alAire.blockLabel}` : alAire.type === "biblia" ? alAire.reference : alAire.nombre || alAire.title}</span>}
          </div>
          <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(22,50,79,0.18)", border: "2px solid #C23B32", flexShrink: 0 }}>
            <ProjectionPanel slide={alAire} blanked={blanked} split={false} liveStyle={liveStyle} thumbnail />
          </div>
          {fijada && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7B3FA0", letterSpacing: 0.4, marginTop: 4 }}>DONDE ESTÁS · SE PROYECTA AL SOLTAR</div>
              <div style={{ width: "62%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", border: "2px dashed #7B3FA0", flexShrink: 0 }}>
                <ProjectionPanel slide={current} blanked={false} split={false} liveStyle={liveStyle} thumbnail />
              </div>
            </>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, marginTop: 4 }}>SIGUIENTE</div>
          {cambiaDeElemento && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--wf-brand-primary)", background: "color-mix(in srgb, var(--wf-brand-accent) 22%, transparent)", borderRadius: 10, padding: "6px 9px" }}>
              <ChevronRight size={14} /> <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Termina esto · al avanzar pasas a <b>{nombreSiguiente}</b></span>
            </div>
          )}
          <div style={{ width: "62%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", opacity: next ? 1 : 0.4, flexShrink: 0 }}>
            <ProjectionPanel slide={next} blanked={false} split={false} liveStyle={liveStyle} thumbnail />
          </div>
          <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>{next ? (next.type === "cancion" ? `${next.songTitle} · ${next.blockLabel}` : next.type === "biblia" ? next.reference : next.nombre || next.title) : adHoc ? "No hay más diapositivas" : "Última diapositiva del servicio"}</div>
          {/* Lo agregado (textos, diapositivas, canciones) se ve solo en el ORDEN DEL CULTO de la
              izquierda (pedido de Eldin, 2026-10-11): aquí abajo ya no se repite. */}
        </aside>
      </div>
      </>
      )}
      {/* Clic derecho sobre una diapositiva (escritorio): editar diseño, mover/copiar a otro grupo,
          sacarla del grupo o borrarla. */}
      {menuDiap && (() => {
        const s = menuDiap.s;
        const r = refDiap(s);
        const grupos = serviceOrder.filter((it) => it.type === "slide" && (menuDiap.sub === "copiar" || it.id !== r.itemId));
        const nombreDe = (it) => tituloBase(it.title) || "Diapositiva";
        const fila = (Icon, label, accion, extra = {}) => (
          <button key={label} onClick={(e) => { e.stopPropagation(); accion(); }} onPointerDown={(e) => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", borderRadius: 7, padding: "7px 10px", cursor: "pointer", color: extra.peligro ? "#C23B32" : "var(--wf-text)", fontSize: 12.5, textAlign: "left" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--wf-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            {Icon && <Icon size={14} />}<span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>{extra.flecha && <ChevronRight size={13} />}
          </button>
        );
        const x = Math.min(menuDiap.x, window.innerWidth - 250);
        const y = Math.min(menuDiap.y, window.innerHeight - 280);
        return (
          <div onPointerDown={(e) => e.stopPropagation()} role="menu" style={{ position: "fixed", left: x, top: y, zIndex: 3000, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: 4, width: 240, maxHeight: 360, overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>
            {!menuDiap.sub ? (
              <>
                {!s.diseno && fila(Pencil, "Editar texto", () => { setMenuDiap(null); startEditingSlide(s); })}
                {fila(PenTool, s.diseno ? "Editar diseño" : "Diseñar (imágenes, plantillas)", () => { setMenuDiap(null); abrirEditor(s); })}
                {fila(ArrowRightLeft, "Mover a…", () => setMenuDiap({ ...menuDiap, sub: "mover" }), { flecha: true })}
                {fila(CopyPlus, "Copiar a…", () => setMenuDiap({ ...menuDiap, sub: "copiar" }), { flecha: true })}
                {s.totalGrupo > 1 && fila(Ungroup, "Sacar del grupo", () => { setMenuDiap(null); enviarDiapositiva(s, "suelta", false); })}
                <div style={{ height: 1, background: "var(--wf-border)", margin: "4px 6px" }} />
                {fila(Trash2, "Eliminar", () => { setMenuDiap(null); borrarDiapositiva(s); }, { peligro: true })}
              </>
            ) : (
              <>
                {fila(ChevronLeft, menuDiap.sub === "mover" ? "Mover a…" : "Copiar a…", () => setMenuDiap({ ...menuDiap, sub: null }))}
                <div style={{ height: 1, background: "var(--wf-border)", margin: "4px 6px" }} />
                {grupos.map((it) => fila(null, `${nombreDe(it)}${it.id === r.itemId ? " (este mismo)" : ""}`, () => { setMenuDiap(null); enviarDiapositiva(s, it.id, menuDiap.sub === "copiar"); }))}
                {fila(Plus, "Grupo nuevo…", () => { setMenuDiap(null); enviarDiapositiva(s, "nuevo", menuDiap.sub === "copiar"); })}
              </>
            )}
          </div>
        );
      })()}
      {/* Agregar una canción = queda en el orden del culto (ya no "improvisada"), después de lo que se
          está viendo; luego se arrastra a donde se quiera. */}
      {/* Dos funciones separadas (pedido de Eldin, 2026-10-21: "no le gusta que haya un montón de botones
          de proyectar"): "Proyectar desde biblioteca" pone la canción en pantalla con un toque; "Agregar →
          Canción" solo la mete al orden del culto. */}
      {showAdHocSong === "proyectar" && (
        <AdHocSongModal
          library={library} onClose={() => setShowAdHocSong(false)} onPick={proyectarCancionYa}
          titulo="Proyectar desde biblioteca" Icono={Radio} color="var(--wf-brand-accent)"
          ayuda="Toca una canción y sale en pantalla de una vez. También queda en el orden del culto, después de lo que está al aire."
        />
      )}
      {showAdHocSong === true && (
        <AdHocSongModal
          library={library} onClose={() => setShowAdHocSong(false)} onPick={agregarCancionAqui} Icono={Plus} color="#1F8A73"
          titulo="Agregar canción al culto"
          ayuda={`Toca una canción para agregarla ${anclaParaAgregar() ? `después de "${tituloItem(anclaParaAgregar())}"` : "al final del culto"}. No sale en pantalla hasta que la proyectes.`}
        />
      )}
      {showImportar && (
        <ImportarPresentacion
          iglesiaId={myIglesiaId}
          destino={anclaParaAgregar() ? `Entra después de "${tituloItem(anclaParaAgregar())}". Luego puedes arrastrarla a otro lugar.` : "Entra al final del orden del culto."}
          onClose={() => setShowImportar(false)}
          onImportar={(items) => {
            onInsertarItems(items, anclaParaAgregar()?.id || null);
            setShowImportar(false);
            const primero = items.find((it) => it.type !== "seccion");
            if (primero) { setItemVisto(primero.id); setVerTodas(false); }
            if (mmPanel === "biblia") setMmPanel("transmision");
            showToast(`Se agregaron ${items.filter((it) => it.type !== "seccion").length} diapositivas al orden del culto.`, "info");
          }}
        />
      )}
      {/* "+ Agregar" de la consola: las mismas opciones que el Setlist, con lo que pasa con cada una. */}
      {showAgregarConsola && (
        <ModalShell title="Agregar al culto" icon={Plus} color="var(--wf-brand-accent)" onClose={() => setShowAgregarConsola(false)}>
          {!isFreeSession && <ElegirParteDelCulto orden={serviceOrder} valor={destinoConsola} onCambiar={setDestinoConsola} textoSinElegir={itemCentro || itemAlAire ? `Después de "${tituloItem(itemCentro || itemAlAire)}"` : "Al final del culto"} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -6px" }}>
            {opcionesAgregarConsola.map((o) => (
              <button key={o.clave} onClick={() => { setShowAgregarConsola(false); o.accion(); }} className="hoverable"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 12, padding: "10px 8px", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in srgb, ${o.color} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><o.Icon size={19} color={o.color} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{o.titulo}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--wf-muted)" }}>{o.detalle}</span>
                </span>
                <ChevronRight size={16} color="var(--wf-faint)" />
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--wf-faint)", marginTop: 10 }}>
            {anclaParaAgregar() ? `Entra después de "${tituloItem(anclaParaAgregar())}". ` : "Entra al final del orden del culto. "}
            Nada sale a la pantalla hasta que tú lo proyectes. Luego lo puedes arrastrar a otro lugar del orden.
          </div>
        </ModalShell>
      )}
      {showAdHocVideo && <AdHocVideoModal onClose={() => setShowAdHocVideo(false)} onPlay={(url) => { onStartAdHocVideo(url); setShowAdHocVideo(false); }} />}
      {showAddSlide && (
        <SlideModal
          iglesiaId={myIglesiaId}
          draft={newSlideDraft} setDraft={setNewSlideDraft}
          onClose={() => setShowAddSlide(false)}
          onAdd={() => { if (!newSlideDraft.title && !(newSlideDraft.bgType === "video" && newSlideDraft.videoUrl) && !(newSlideDraft.bgType === "imagen" && newSlideDraft.imageUrl)) return; onAddLiveSlide(newSlideDraft, anclaParaAgregar()?.id); setShowAddSlide(false); }}
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
        <SlideModal iglesiaId={myIglesiaId} title="Editar diapositiva" submitLabel="Guardar cambios" draft={editDraft} setDraft={setEditDraft} onClose={() => setEditingSlide(null)} onAdd={saveSlideEdit} />
      )}
      {editingSlide && editingSlide.type === "cancion" && (
        <ModalShell title={editingSlide.nueva ? "Nueva diapositiva" : "Corregir letra"} icon={editingSlide.nueva ? Plus : Music} color="var(--wf-brand-accent)" onClose={() => setEditingSlide(null)}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 12 }}>
            {editingSlide.songTitle} · {editingSlide.nueva ? `después de ${editingSlide.blockLabel}` : editingSlide.blockLabel}
          </div>
          <Field label="Texto"><textarea key={editingSlide.nueva ? "nueva" : "editar"} autoFocus value={editDraft.text} onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })} placeholder={editingSlide.nueva ? "Escribe la letra de la diapositiva nueva" : undefined} style={{ ...inputStyle, height: 120, resize: "vertical" }} /></Field>
          <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Este cambio queda guardado en la canción de la biblioteca — no solo para esta transmisión.</div>
          <button onClick={saveSlideEdit} disabled={editingSlide.nueva && !editDraft.text.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: editingSlide.nueva && !editDraft.text.trim() ? 0.5 : 1 }}>{editingSlide.nueva ? "Agregar diapositiva" : "Guardar cambios"}</button>
          {!editingSlide.nueva && <button
            onClick={() => { setEditingSlide({ ...editingSlide, nueva: true }); setEditDraft({ text: "" }); }}
            className="hoverable"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", background: "var(--wf-hover)", border: "none", borderRadius: 12, padding: "9px 0", fontSize: 13, fontWeight: 700, color: "var(--wf-text)", cursor: "pointer", marginTop: 8 }}
          >
            <Plus size={14} /> Agregar otra diapositiva a "{editingSlide.sectionLabel}"
          </button>}
        </ModalShell>
      )}
    </div>
  );
}

// ---------------- PROYECCIÓN ----------------
// Ajusta el tamaño de letra automáticamente (como el autofit de PowerPoint): el slider de tamaño en
// Multimedia define el tamaño DESEADO, pero este componente lo mide contra el espacio real disponible y
// lo va reduciendo hasta que quepa entero — así, sin importar cuántas líneas tenga la diapositiva ni qué
// tan arriba se suba el slider, el texto nunca se corta ni se sale de la pantalla.

export function ProjectionPanel({ slide, blanked, split, liveStyle, compactHeight, thumbnail }) {
  const font = LIVE_FONTS[liveStyle?.font || "elegante"];
  const scale = liveStyle?.fontScale ?? 1;
  // Tamaño real (medido, en px) al que AutoFitText terminó dejando el texto del versículo después de
  // achicarlo para que quepa — puede ser bastante menor que el "deseado" (bibliaRatio) si el versículo
  // es largo. La cita se calcula a partir de ESTE valor medido (no del tamaño deseado) para que nunca
  // pueda verse más grande que el propio versículo, sin importar cuánto se haya tenido que achicar.
  const [bibliaFontPx, setBibliaFontPx] = useState(null);
  // Tamaño real al que quedó el contenido de una diapositiva de texto: el texto pequeño de abajo sigue
  // ese tamaño (escalaSubtitulo, 65% por defecto) en vez de un px fijo — pedido de Eldin, 2026-10-11.
  const [slideFontPx, setSlideFontPx] = useState(null);
  // Fondo por canción: solo si quien transmite lo activó y ESTA canción tiene uno propio — si no, el
  // fondo general de siempre (que también es el de la Biblia y las diapositivas).
  const fondoCancion = liveStyle?.fondoPorCancion && slide?.type === "cancion" && slide.songId ? liveStyle.fondosCanciones?.[slide.songId] : null;
  const fondo = fondoCancion ? { ...liveStyle, ...fondoCancion } : liveStyle;
  // Prioridad de fondo: video propio de esta slide > video de fondo global (Estilo > Video) > imagen
  // propia de esta slide > imagen de fondo global (Estilo > Imagen) > tema de color.
  const slideVideoBg = slide?.type === "slide" && slide.bgType === "video" && slide.videoUrl;
  // Bug real: antes esto no miraba customBgType -- con liveStyle.customVideo puesto alguna vez
  // (queda guardado aunque ya no se esté usando, por si se vuelve a esa pestaña), el video ganaba
  // SIEMPRE, sin importar que la pestaña activa fuera "Imagen" con una imagen ya elegida -- cambiar a
  // imagen no se veía nunca. customBgType (la pestaña que de verdad está activa en Estilo) es lo que
  // decide cuál de los dos usar, no solo cuál de los dos campos tiene algo guardado.
  // Letras animadas (ver components/LetrasAnimadas.jsx): el fondo animado del estilo reemplaza al fondo
  // general, salvo que se haya elegido "Mi fondo", o que la diapositiva o la canción traigan uno propio.
  const animDef = definicionAnimacion(liveStyle);
  const animKey = animDef?.clave || null;
  const anim = animDef?.def || null;
  const slideTraeFondo = slide?.type === "slide" && ((slide.bgType === "video" && slide.videoUrl) || (slide.bgType === "imagen" && slide.imageUrl));
  const fondoAnimado = anim && liveStyle?.animFondo !== "propio" && !fondoCancion && !slideTraeFondo ? anim.fondo : null;
  const customBgEsVideo = !fondoAnimado && fondo?.theme === "custom" && (fondo.customBgType || "imagen") === "video";
  const customBgEsImagen = !fondoAnimado && fondo?.theme === "custom" && (fondo.customBgType || "imagen") === "imagen";
  const globalVideoBg = !slideVideoBg && customBgEsVideo && fondo.customVideo;
  const videoSrc = slideVideoBg ? slide.videoUrl : globalVideoBg ? fondo.customVideo : null;
  const slideImageBg = !videoSrc && slide?.type === "slide" && slide.bgType === "imagen" && slide.imageUrl;
  const globalImageBg = !videoSrc && !slideImageBg && customBgEsImagen && fondo.customImage;
  const imageSrc = slideImageBg || globalImageBg || null;
  // Bug real (no de hoy, ya existía): al tocar la pestaña "Imagen" o "Video (movimiento)" del fondo
  // global, liveStyle.theme pasa a "custom" DE UNA -- antes incluso de subir o elegir algo -- pero
  // "custom" nunca fue una clave de LIVE_THEMES. Mientras no hubiera ni video ni imagen todavía (justo
  // el instante entre tocar la pestaña y terminar de subir el archivo), esto hacía LIVE_THEMES["custom"]
  // undefined y el siguiente .bg reventaba -- se caía TODA la app (sin pantalla de error, solo en
  // blanco/negro), tanto en la vista previa del panel de control como en la Proyección real, porque las
  // dos usan este mismo componente. El `|| LIVE_THEMES.stage` cubre ese y cualquier otro valor de tema
  // que no sea una clave real.
  const theme = videoSrc || imageSrc ? null : (LIVE_THEMES[fondo?.theme || "stage"] || LIVE_THEMES.stage);
  const bg = fondoAnimado && !videoSrc && !imageSrc ? "#000" : videoSrc ? "#000" : imageSrc ? `center / cover no-repeat url(${imageSrc})` : theme.bg;
  // El tamaño de letra "deseado" viene del slider (liveStyle.fontScale) multiplicando una proporción del
  // alto del contenedor (ver AutoFitText) en vez de un px fijo — así se ve igual de grande en la
  // mini-preview y en la pantalla real, y ese mismo % sigue aplicando de una diapositiva a la siguiente
  // (liveStyle.fontScale es un solo valor compartido, no por diapositiva) sin nunca desbordarse, porque
  // AutoFitText siempre lo achica más si hace falta para esa diapositiva en particular.
  // Piso en 94% de este tamaño (minRatio, ver AutoFitText) SOLO en los formatos de pantalla chica
  // (diapositivas reorganizadas: traen baseLines, ver reorganizarLetra): ahí todas quedan más o menos
  // del mismo tamaño y una línea larga se parte en dos renglones en vez de achicarse. En "2 líneas por
  // diapositiva" (pantallas grandes) no: cada línea debe verse completa en su renglón, así que se
  // achica lo necesario, como siempre.
  const cancionRatio = 0.16 * scale;
  // Antes 0.12 — bastante más chica que la letra de canción (0.16), lo que la hacía difícil de leer
  // desde lejos en la pantalla real, incluso para quienes siguen con su propia Biblia en mano.
  const bibliaRatio = 0.155 * scale;
  const slideRatio = 0.18 * scale;
  const textColor = liveStyle?.textColor || "#FFFFFF";
  // Ajustes finos (ver LIVE_SOMBRAS y compañía) — sin valor, como siempre.
  const espaciadoLetras = liveStyle?.espaciado != null ? `${liveStyle.espaciado}em` : font.tracking;
  const sombraTexto = (LIVE_SOMBRAS[liveStyle?.sombra] || LIVE_SOMBRAS.ninguna).css;
  const alineacion = LIVE_ALINEACIONES[liveStyle?.alineacion] || LIVE_ALINEACIONES.centro;
  const posicion = LIVE_POSICIONES[liveStyle?.posicion] || LIVE_POSICIONES.centro;
  // Letra animada sobre un fondo propio (imagen o video de Estilo, de la canción o de la diapositiva):
  // los colores del estilo están pensados para su fondo oscuro, así que se oscurece al menos un 40% y la
  // letra lleva sombra (2026-11-02, "que la letra animada siempre se lea").
  const animSobreFondoPropio = !!anim && !fondoAnimado;
  const oscurecerFondo = animSobreFondoPropio ? Math.max(liveStyle?.oscurecer ?? 0.45, OSCURECER_MINIMO_ANIMADA) : (liveStyle?.oscurecer ?? 0.45);
  const ubicacion = { alinearH: alineacion.flex, alinearV: posicion.flex };
  // Diseño de transmisión (solo canciones, ver LINE_STYLES): cambia cómo se destaca la 2a línea de la
  // diapositiva (la que cierra la frase) -- nunca la 1a, y nunca si la diapositiva es de una sola
  // línea (no hay "2a línea" que destacar). "tradicional" no toca nada (ambas líneas iguales, como
  // siempre fue).
  const lineStyleMode = liveStyle?.lineStyle || "tradicional";
  // Con letra animada el estilo ya decide cómo se ve cada línea: el "diseño de las letras" no aplica.
  const animarLetra = !!anim && slide?.type === "cancion" && Array.isArray(slide?.lines);
  const lineasAnimadas = animarLetra ? armarLineasAnimadas(anim, slide.lines, slide.slideId, velocidadLetra(liveStyle)) : null;
  const cancionLineStyles =
    slide?.type === "cancion" && lineStyleMode !== "tradicional" && !animarLetra
      ? slide.lines.map((_, i) => {
          // Más contraste (pedido de Eldin, 2026-10-05): antes la línea en minúscula no tenía ningún
          // estilo propio, así que heredaba el peso de la fuente elegida en TIPOGRAFÍA -- con una
          // fuente ya gruesa (ej. Audaz, Extra negrita) casi no se notaba diferencia contra la 2a
          // línea en mayúscula. Ahora la 1a línea fuerza un peso liviano sin importar la fuente, y la
          // 2a además de mayúscula/negrita queda más grande y con más espacio entre letras.
          if (lineStyleMode === "mayuscula") return i === 0 ? { fontWeight: 400 } : i === 1 ? { textTransform: "uppercase", fontWeight: 900, fontSize: "1.1em", letterSpacing: "0.03em" } : undefined;
          if (lineStyleMode === "acento") return i === 1 ? { color: "var(--wf-brand-accent)" } : undefined;
          if (lineStyleMode === "editorial") return i === 1 ? { fontStyle: "italic", fontFamily: "'Playfair Display', serif" } : undefined;
          // La línea principal más grande, la segunda (como un eco/aclaración) más chica -- al revés
          // de mayuscula/acento, que destacan la 2a línea; acá se destaca la 1a.
          if (lineStyleMode === "descendente") return i === 0 ? { fontSize: "1.15em" } : i === 1 ? { fontSize: "0.78em" } : undefined;
          // Asimétrico a propósito (no centrado) -- cada línea ocupa el ancho completo del bloque de
          // texto (ver nota en AutoFitText: los <div> hijos son block-level, heredan el ancho del
          // contenedor ya encogido a la línea más larga) así que left/right sí se nota.
          if (lineStyleMode === "revista") return i === 0 ? { textAlign: "left" } : i === 1 ? { textAlign: "right" } : undefined;
          // Fundido/deslizante: las DOS líneas animan (no solo la 2a, como mayuscula/acento) con un
          // pequeño desfase entre ellas -- "both" como fill-mode para que la línea se quede invisible
          // ANTES de que le toque su turno, en vez de destellar visible un instante y luego animar.
          if (lineStyleMode === "fundido") return { animation: `wfLyricFadeIn 0.6s ease ${i * 0.35}s both` };
          if (lineStyleMode === "deslizante") return { animation: `wfLyricSlideIn 0.55s ease ${i * 0.3}s both` };
          return undefined; // "cita" y "franja": no tocan el estilo de línea (ver más abajo)
        })
      : undefined;
  const estiloRaiz = { flex: thumbnail ? "none" : compactHeight ? "none" : split ? 1.3 : 1, width: thumbnail ? "100%" : "auto", height: thumbnail ? "100%" : compactHeight || "auto", minHeight: thumbnail ? "auto" : compactHeight || "auto", background: bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", padding: thumbnail ? 10 : 32, minWidth: thumbnail ? 0 : 320, overflow: "hidden" };
  // Página de una presentación importada (PDF, Canva...): se proyecta TAL CUAL, completa (sin recortar),
  // sobre negro, sin oscurecer ni letra encima — ya trae su propio diseño. "Pantalla en negro" sí la
  // esconde: aquí la imagen ES el contenido, no un fondo.
  // Diapositiva con diseño propio (editor de diapositivas / presentación agrupada): se dibuja tal cual.
  if (slide?.diseno) {
    return (
      <div style={{ ...estiloRaiz, background: "#000", padding: 0 }}>
        <DiapositivaDisenada diapositiva={slide.diseno} blanked={blanked} animar={!thumbnail} paso={slide.paso ?? 0} />
      </div>
    );
  }
  if (esPaginaPresentacion(slide)) {
    return (
      <div style={{ ...estiloRaiz, background: "#000", padding: 0 }}>
        {blanked ? <div style={{ color: "#2A3140" }}><Mic2 size={thumbnail ? 20 : 40} /></div>
          : <img src={slide.imageUrl} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
      </div>
    );
  }
  return (
    <div style={estiloRaiz}>
      {/* Etiquetas chicas (este letrero, la sección de la canción, el título abajo) solo en la vista
          previa del propio operador (thumbnail) -- útiles ahí para ubicarse entre los paneles del
          control, pero de la pantalla real que ve la congregación se quitan: solo debe verse el
          contenido en sí, sin nada de chrome encima (pedido de Eldin, 2026-10-04). */}
      {thumbnail && <div style={{ position: "absolute", top: 18, left: 22, display: "flex", alignItems: "center", gap: 6, color: "#5B6472", fontSize: 11, fontWeight: 700, letterSpacing: 1, zIndex: 2 }}><Radio size={12} /> PANTALLA DE PROYECCIÓN</div>}
      {/* El fondo (video/imagen propios, o el de la slide) se renderiza SIEMPRE, incluso con "Pantalla
          en negro" -- antes vivía adentro del bloque de abajo (solo cuando NO estaba en negro), así que
          "pantalla en negro" con un video de fondo se veía como negro sólido de verdad (el <video> ni
          se montaba) en vez de seguir el video andando sin la letra encima, que es lo que de verdad se
          quiere: ocultar SOLO la letra/texto que se está transmitiendo, no el fondo. */}
      {fondoAnimado && !videoSrc && !imageSrc && <FondoAnimado tipo={fondoAnimado} pulso={slide?.slideId ?? slide?.reference ?? slide?.title} chico={!!thumbnail} quieto={!!thumbnail} ajustes={anim?.ajustesFondo} />}
      {animarLetra && anim.flash && !blanked && <div key={`flash-${slide.slideId}`} className="wfa-flash" />}
      {videoSrc && (
        <>
          <video src={videoSrc} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${oscurecerFondo})`, zIndex: 0 }} />
        </>
      )}
      {imageSrc && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${oscurecerFondo})`, zIndex: 0 }} />}
      {blanked || !slide ? (
        <div style={{ color: "#2A3140", position: "relative", zIndex: 1 }}><Mic2 size={thumbnail ? 20 : 40} /></div>
      ) : (
        <>
          {!videoSrc && !fondoAnimado && <div className="spotlight-glow" style={{ position: "absolute", width: thumbnail ? 140 : 420, height: thumbnail ? 140 : 420, borderRadius: "50%", background: `radial-gradient(circle, ${TYPE_META[slide.type].color}22 0%, transparent 70%)` }} />}
          {slide.type === "cancion" && (
            <>
              {thumbnail && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "var(--wf-brand-accent)", marginBottom: 6, zIndex: 1 }}>{slide.blockLabel.toUpperCase()}</div>}
              {/* "Cita destacada": una comilla grande y translúcida detrás del texto -- a diferencia de
                  los demás diseños, este no cambia el estilo de ninguna línea (ver cancionLineStyles),
                  solo agrega este adorno detrás. */}
              {lineStyleMode === "cita" && !animarLetra && (
                <div aria-hidden style={{ position: "absolute", top: thumbnail ? 4 : 10, left: "50%", transform: "translateX(-50%)", fontFamily: "'Fraunces', serif", fontSize: thumbnail ? 50 : 160, lineHeight: 1, color: textColor, opacity: 0.18, zIndex: 1, pointerEvents: "none" }}>❝</div>
              )}
              {(() => {
                const cancionAutoFit = (
                  <AutoFitText
                    key={slide.slideId}
                    lines={slide.lines} targetRatio={cancionRatio} minRatio={slide.baseLines ? cancionRatio * 0.94 : undefined} minPx={thumbnail ? 7 : 15} maxWidth="90%" {...ubicacion}
                    // whiteSpace:nowrap es lo que de verdad garantiza "2 líneas nada más" (pedido de
                    // Eldin, 2026-10-05): sin esto, una sola línea larga podía ENVOLVER a una fila
                    // visual extra (el ajuste automático de tamaño permitía eso, porque envolver
                    // también baja el ancho usado) -- con nowrap, la única forma de caber es achicar
                    // la letra hasta que esa línea quepa completa en una sola fila, nunca partirla.
                    // key={slide.slideId}: fuerza a React a desmontar/montar de nuevo en cada
                    // diapositiva -- sin esto, "fundido"/"deslizante" solo se verían la PRIMERA vez
                    // (los mismos <div> de línea se reutilizan, así que la animación CSS no se repite
                    // sola con solo cambiar el texto adentro).
                    style={animarLetra
                      ? { fontFamily: anim.fuente.family, fontWeight: anim.fuente.weight, textTransform: anim.fuente.transform || "none", letterSpacing: anim.fuente.tracking || "normal", textAlign: alineacion.text, zIndex: 1, lineHeight: liveStyle?.interlineado ?? 1.25, textShadow: animSobreFondoPropio ? reforzarSombraAnimada(anim.sombra) : anim.sombra, color: animSobreFondoPropio ? colorLegibleAnimada(anim.color) : anim.color, whiteSpace: "nowrap", ...lineasAnimadas.vars }
                      : { fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: espaciadoLetras, fontStyle: font.italic ? "italic" : "normal", textAlign: alineacion.text, zIndex: 1, lineHeight: liveStyle?.interlineado ?? 1.35, textShadow: sombraTexto, color: textColor, whiteSpace: "nowrap", textWrap: "balance" }}
                    lineStyles={cancionLineStyles}
                    className={animarLetra ? claseAnimacion(animKey) : undefined}
                    contenidoLineas={lineasAnimadas?.lineas}
                  />
                );
                // "Franja inferior": en vez de centrada en toda la pantalla, la letra vive en una
                // barra angosta abajo con su propio fondo semitransparente -- deja ver mucho más del
                // fondo/video arriba, estilo noticiero. Necesita su propio contenedor flex con alto
                // definido (a diferencia del resto, que usa el alto completo del panel) para que
                // AutoFitText (flex:1 por dentro) tenga contra qué medirse.
                if (lineStyleMode !== "franja" || animarLetra) return cancionAutoFit;
                return (
                  <div style={{ position: "absolute", left: thumbnail ? 8 : 28, right: thumbnail ? 8 : 28, bottom: thumbnail ? 8 : 36, height: thumbnail ? "42%" : "30%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,10,14,0.55)", borderRadius: thumbnail ? 8 : 16, padding: thumbnail ? "4px 8px" : "10px 28px", zIndex: 1, boxSizing: "border-box" }}>
                    {cancionAutoFit}
                  </div>
                );
              })()}
              {thumbnail && <div style={{ position: "absolute", bottom: 18, display: "flex", alignItems: "center", gap: 8, color: "#5B6472", fontSize: 12, zIndex: 1 }}><Music size={12} /> {slide.songTitle}</div>}
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
              {/* paddingBottom fijo (NO depende de `scale`): antes crecía junto con el control de tamaño de
                  letra (`* scale`) — así que subir el tamaño del versículo al mismo tiempo le quitaba
                  espacio disponible para ese mismo versículo, compitiendo consigo mismo. En un versículo
                  largo (que ya necesita achicarse para caber) ese espacio perdido podía anular por
                  completo el aumento pedido, o incluso dejarlo más chico que antes — el control de tamaño
                  se sentía "roto" justo en los casos donde más hacía falta. */}
              {/* flexDirection:"column" es lo que de verdad arregla el tamaño de letra de los versículos:
                  sin esto (display:flex por defecto es "row"), align-items:center pasa a controlar el
                  eje vertical (cruzado en una fila) y este div, en vez de estirarse al alto real
                  disponible, se encoge al tamaño de SU PROPIO contenido -- que es circular con lo que
                  AutoFitText está midiendo. El resultado: container.clientHeight quedaba casi en 0/20px
                  sin importar la pantalla, así que el tamaño "deseado" (containerHeight * bibliaRatio)
                  siempre caía al piso mínimo (minPx) y el control de tamaño de letra no tenía ningún
                  efecto real -- por eso el versículo se seguía viendo chico pase lo que pase. */}
              <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: thumbnail ? 22 : 76 }}>
                <AutoFitText
                  lines={`"${slide.text}"`} targetRatio={bibliaRatio} minPx={thumbnail ? 7 : 14} maxWidth="90%" {...ubicacion}
                  onFontSize={setBibliaFontPx}
                  style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: espaciadoLetras, textAlign: alineacion.text, zIndex: 1, lineHeight: liveStyle?.interlineado ?? 1.4, textShadow: sombraTexto, fontStyle: font.italic || font.family.includes("Fraunces") ? "italic" : "normal", color: liveStyle?.bibliaTextColor || textColor }}
                />
              </div>
              {/* La cita ("Génesis 6:6") tiene que leerse desde lejos SIN necesidad de escuchar — hay gente
                  que sigue con su propia Biblia en mano y solo mira la pantalla para ubicar el pasaje.
                  Pero nunca debe verse MÁS grande que el propio versículo: en vez de un tamaño calculado
                  aparte (que no sabía cuánto se había achicado el versículo para caber), se deriva del
                  tamaño ya medido de arriba (bibliaFontPx) — así siempre queda un porcentaje fijo de él,
                  se achique lo que se achique el versículo. */}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: thumbnail ? 6 : 28, textAlign: "center", fontSize: thumbnail ? 10 : Math.round((bibliaFontPx || 20) * 0.62), color: liveStyle?.bibliaReferenciaColor || "#6E9BD1", fontWeight: 800, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3em" }}>
                {slide.reference}
                {!thumbnail && slide.version && <span style={{ fontSize: "0.4em", background: "rgba(110,155,209,0.2)", borderRadius: 10, padding: "0.2em 0.6em" }}>{slide.version}</span>}
              </div>
            </>
          )}
          {slide.type === "slide" && (
            <div style={{ textAlign: "center", zIndex: 1, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <AutoFitText
                // Un renglón vacío se proyecta como espacio (pedido de Eldin, 2026-10-11): una línea "" medía
                // 0 de alto y el texto quedaba junto. Solo se quitan los renglones vacíos de las orillas.
                lines={(slide.title || "").replace(/^\s*\n+|\n+\s*$/g, "").split("\n").map((l) => (l.trim() === "" ? "\u00A0" : l))} targetRatio={slideRatio} onFontSize={setSlideFontPx} minPx={thumbnail ? 8 : 16} maxPx={thumbnail ? 30 : 130} maxWidth="90%" {...ubicacion}
                // Con texto pequeño: el contenido se pega a él (abajo de su espacio) y un espacio debajo
                // los centra juntos como un solo bloque, en vez de quedar uno arriba y otro abajo.
                {...(slide.subtitle && slide.title && posicion.flex !== "flex-start" ? { alinearV: "flex-end" } : {})}
                style={{ fontFamily: font.family, fontWeight: Math.max(font.weight, 600), textTransform: font.transform, letterSpacing: espaciadoLetras, fontStyle: font.italic ? "italic" : "normal", textAlign: alineacion.text, lineHeight: liveStyle?.interlineado ?? undefined, textShadow: sombraTexto, color: textColor }}
              />
              {slide.subtitle && (
                <div style={{
                  fontSize: slide.title && slideFontPx ? Math.max(thumbnail ? 5 : 14, slideFontPx * (slide.escalaSubtitulo ?? 0.65)) : thumbnail ? 9 : 44,
                  fontFamily: font.family, fontWeight: 500, color: textColor, opacity: 0.85, textShadow: sombraTexto, textAlign: alineacion.text,
                  marginTop: "0.4em", flexShrink: 0, whiteSpace: "pre-line", maxWidth: "90%", lineHeight: 1.25, zIndex: 1,
                  display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>{slide.subtitle}</div>
              )}
              {slide.subtitle && slide.title && posicion.flex === "center" && <div style={{ flex: 0.55, minHeight: 0 }} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ctrlBtn = { display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", color: "var(--wf-text)", borderRadius: 12, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
