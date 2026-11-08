// Consola En vivo de Multimedia: orden del culto, diapositivas, Biblia en vivo, estilo, escenario. Separada de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState, useRef, useEffect, useMemo } from "react";
import { buscarCanciones } from "../lib/busqueda.js";
import { Pause, Square, Volume2, VolumeX } from "lucide-react";
import { Music, Search, Image as ImgIcon, ChevronLeft, ChevronRight, MonitorOff, Radio, BookOpen, Type, PenTool, FileUp, Plus, Pencil, MoreHorizontal, Trash2, GraduationCap, Pin, MessageSquare, AlertTriangle, PinOff, ListMusic, Palette, Play, SkipBack, SkipForward, X, SlidersHorizontal, Sparkles, ChevronUp, Tv, EyeOff, Eye, ArrowRightLeft, CopyPlus, Ungroup, Timer, RotateCcw } from "lucide-react";
import { acordeEn } from "../lib/preferencias.js";
import { loadCache, saveCache } from "../lib/offlineCache.js";
import { escucharProyeccion } from "../lib/liveSession.js";
import { confirmDialog, promptDialog } from "../lib/confirm.js";
import { animacionActiva, precargarFuentesAnimacion, nombreAnimacion, fondoEnMovimiento } from "../components/LetrasAnimadas.jsx";
import { showToast } from "../lib/toast.js";
import { letraATexto } from "../lib/textoCancion.js";
import { letraEfectiva } from "../lib/letraEnVivo.js";
import { pasosDeDiapositiva } from "../lib/animaciones.js";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { anclaDeBloque } from "../lib/ordenCulto.js";
import { tituloBase } from "../lib/diapositivas.js";
import { useArrastreGrid } from "../lib/arrastreGrid.js";
import { esPaginaPresentacion } from "../lib/importarPresentacion.js";
import DiapositivaDisenada from "../components/DiapositivaDisenada.jsx";
import { temporizadorActivo } from "../lib/escenario.js";
import SelectorAnimacion, { SelectorFondoMovimiento } from "../components/SelectorAnimacion.jsx";
import CintaAdaptable from "../components/CintaAdaptable.jsx";
import PantallaOtroEquipo from "../components/PantallaOtroEquipo.jsx";
import PanelEscenario from "../components/PanelEscenario.jsx";
import ImportarPresentacion from "../components/ImportarPresentacion.jsx";
import CuentaRegresivaModal from "../components/CuentaRegresivaModal.jsx";
import { cuentaPorMinutos } from "../lib/cuentaRegresiva.js";
import { TYPE_META, ModalShell, addBtnStyle, inputStyle, primaryBtn, BIBLE_VERSIONS, LIVE_FONTS, LIVE_THEMES, iconGhost, LIVE_SOMBRAS, LIVE_POSICIONES, LIVE_ALINEACIONES, ElegirParteDelCulto, Field } from "./compartido.jsx";
import { BibleLivePanel } from "./biblia.jsx";
import { MediaPicker, SlideModal, AvisoEnlaceVideo, VideoModal } from "./ventanas.jsx";
import { avisoDeEnlace } from "../lib/videoEnlace.js";
import { posicionActual, textoTiempo } from "../lib/videoControl.js";
import { ProjectionPanel } from "./proyeccion.jsx";

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

// Videos (2026-11-08, pedido de Eldin): ya no hay "proyectar un video ahora" — todo video entra al orden
// del culto (VideoModal) y se proyecta al tocarlo, como cualquier otro elemento.

// Controles del video al aire (2026-11-08): se maneja desde la consola, sin tocar la pantalla de
// proyección (Smart TV, otra computadora). El avance viene de lo que reporta la pantalla; si todavía no
// reporta nada, se calcula con las órdenes que se mandaron.
export function ControlesVideo({ control, estado, onAccion }) {
  const [, tic] = useState(0);
  useEffect(() => { const t = setInterval(() => tic((x) => x + 1), 500); return () => clearInterval(t); }, []);
  if (!control) return null;
  const ahora = Date.now();
  const reciente = estado && ahora - (estado.recibido || 0) < 4000;
  const pos = reciente ? (estado.pos || 0) + (estado.reproduciendo ? (ahora - estado.recibido) / 1000 : 0) : posicionActual(control, ahora);
  const duracion = estado?.duracion || null;
  const enPlay = control.estado === "play";
  const boton = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", height: 36, borderRadius: 10, border: "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)", cursor: "pointer", padding: 0 };
  const irA = (e) => {
    if (!duracion) return;
    const r = e.currentTarget.getBoundingClientRect();
    onAccion({ ir: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duracion });
  };
  return (
    <div aria-label="Controles del video" style={{ marginTop: 6, background: "var(--wf-hover)", borderRadius: 12, padding: 8 }}>
      <div onClick={irA} title={duracion ? "Toca para ir a ese punto" : undefined} style={{ height: 6, borderRadius: 3, background: "var(--wf-border)", overflow: "hidden", cursor: duracion ? "pointer" : "default" }}>
        <div style={{ height: "100%", width: duracion ? `${Math.min(100, (pos / duracion) * 100)}%` : "0%", background: "#C23B32" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--wf-muted)", margin: "4px 2px 6px", fontVariantNumeric: "tabular-nums" }}>
        <span>{control.estado === "stop" ? "Detenido" : textoTiempo(pos)}</span>
        <span>{duracion ? textoTiempo(duracion) : reciente ? "" : "Esperando a la pantalla…"}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onAccion("reiniciar")} title="Desde el inicio" aria-label="Desde el inicio" style={boton}><SkipBack size={15} /></button>
        <button onClick={() => onAccion({ saltar: -10 })} title="Atrás 10 segundos" aria-label="Atrás 10 segundos" style={{ ...boton, fontSize: 11, fontWeight: 700 }}>-10</button>
        <button onClick={() => onAccion("alternar")} title={enPlay ? "Pausa" : "Reproducir"} aria-label={enPlay ? "Pausa" : "Reproducir"} style={{ ...boton, flex: 1.4, background: "#C23B32", border: "none", color: "#fff" }}>{enPlay ? <Pause size={17} /> : <Play size={17} />}</button>
        <button onClick={() => onAccion({ saltar: 10 })} title="Adelante 10 segundos" aria-label="Adelante 10 segundos" style={{ ...boton, fontSize: 11, fontWeight: 700 }}>+10</button>
        <button onClick={() => onAccion("stop")} title="Detener" aria-label="Detener" style={boton}><Square size={14} /></button>
        <button onClick={() => onAccion("sonido")} title={control.sonido ? "Silenciar" : "Activar sonido"} aria-label={control.sonido ? "Silenciar" : "Activar sonido"} style={boton}>{control.sonido ? <Volume2 size={15} /> : <VolumeX size={15} />}</button>
      </div>
      {reciente && estado.sonidoBloqueado && control.sonido && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 8, fontSize: 11.5, color: "#C23B32", fontWeight: 600, lineHeight: 1.35 }}>
          <VolumeX size={14} style={{ flexShrink: 0, marginTop: 1 }} /> La pantalla de proyección no deja el sonido hasta que alguien la toque una vez (o presione OK en el control de la TV). Después ya suena sola todo el culto.
        </div>
      )}
    </div>
  );
}

// ---------------- CONTROL MULTIMEDIA (EN VIVO) ----------------

export function MultimediaControl({ eventTitle, serviceOrder = [], isFreeSession, library, slides, activeIdx, adHocIdx, goto, gotoPlanSlide, blanked, setBlanked, current, next, onEnd, canEnd, liveOwner, liveStyle, setLiveStyle, isCompact, adHoc, onExitAdHoc, onStartAdHocBible, onStartAdHocSong, onStartAdHocVideo, onStartAdHocCuenta = null, onReiniciarCuenta = null, eventoInfo = null, onOpenPublicScreen, onNavigateBibleVerse, onAddLiveSlide, onEditLiveSlide, onRemoveLiveSlide, onEditSongSlide, onAddSongSlide, onRearmarSeccion, onAgregarCancion, onReordenarOrden, onQuitarDelOrden, onInsertarItems, myIglesiaId , palabrasPorParte = 40, onAbrirEditor, onDisenarNueva, onMoverDiapositiva, onQuitarDiapositivaGrupo, onReordenarEnGrupo, enPractica = false, onAyuda, ocultos = null, onOcultar, onMostrarOcultos, fijada = null, onFijar, onSoltar, eventoId = null, iglesiaNombre = "", usuarioId = null, pasoDiseno = 0, setPasoDiseno = () => {}, onEditarLetraCompleta, mensajeEscenario = "", onMensajeEscenario = null, iglesiaSlug = null, temporizador = null, onTemporizador = null, autoTemporizador = null, onAutoTemporizador = null, controlVideo = null, estadoVideo = null, onControlVideo = null }) {
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
  // Celular/tablet o navegador sin segunda pantalla (2026-11-08): "Proyección" abre "Pantallas y TV"
  // (conectar una Smart TV con número, o abrir en otro equipo con QR) en vez de un aviso sin salida.
  const abrirProyeccion = () => (!isCompact && typeof window !== "undefined" && "getScreenDetails" in window ? onOpenPublicScreen() : setShowOtroEquipo(true));
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
  // "+ Agregar → Video" (2026-11-08): entra al orden del culto como cualquier otro elemento.
  const [showVideoOrden, setShowVideoOrden] = useState(false);
  const [showCuenta, setShowCuenta] = useState(false);
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
  const agregandoConsola = showAgregarConsola || showAdHocSong || showImportar || showAddSlide || showVideoOrden;
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
    { clave: "video", Icon: Play, color: "#C23B32", titulo: "Video de YouTube", detalle: "Queda en el orden del culto. Al tocarlo se reproduce con sonido y lo controlas desde aquí", accion: () => setShowVideoOrden(true) },
    onStartAdHocCuenta && { clave: "cuenta", Icon: Timer, color: "#5661B3", titulo: "Cuenta regresiva", detalle: "Un reloj antes del culto o de un receso (20 estilos)", accion: () => setShowCuenta(true) },
  ].filter(Boolean);
  // Debajo de la vista previa cuando lo que está al aire es una cuenta regresiva.
  const controlesVideo = controlVideo && onControlVideo ? <ControlesVideo control={controlVideo} estado={estadoVideo} onAccion={onControlVideo} /> : null;
  const botonReiniciarCuenta = current?.cuenta && onReiniciarCuenta && cuentaPorMinutos(current.cuenta, eventoInfo) ? (
    <button onClick={onReiniciarCuenta} title="Vuelve a empezar la cuenta (por minutos)" style={{ ...ctrlBtn, justifyContent: "center", width: "100%", marginTop: 6 }}><RotateCcw size={13} /> Reiniciar cuenta regresiva</button>
  ) : null;
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
        {botonFranja("Abrir proyección", abrirProyeccion, { background: "#16324F", color: "#fff" })}
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
          absolutamente todos, incluido el admin, hasta que pasara el cierre automático por
          abandono (ver LIVE_SESSION_STALE_MS) -- un admin necesita poder cortarla al instante. */}
      {!canEnd && <div style={{ padding: "0 16px 6px", fontSize: 10, color: "var(--wf-faint)" }}>Solo {liveOwner} o un administrador puede finalizar esta transmisión.</div>}

      {isCompact ? (
      <>
      {/* Barra de herramientas: pantalla 2, negro */}
      <div style={{ display: "flex", gap: 8, padding: "8px 16px 10px", flexWrap: "wrap" }}>
        <button data-tour="envivo-proyeccion" onClick={abrirProyeccion} style={{ ...ctrlBtn, background: "var(--wf-brand-primary)", color: "var(--wf-on-brand-primary)" }}><Tv size={14} /> Pantallas y TV</button>
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
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", margin: "4px 0 6px" }}>FONDOS EN MOVIMIENTO</div>
            <div style={{ marginBottom: 12 }}>
              <SelectorFondoMovimiento valor={fondoEditado.theme} columnas={3} onElegir={(t) => { avisarFondoPropioAnimada(); aplicarFondo({ theme: t }); }} />
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
            {botonReiniciarCuenta}
            {controlesVideo}
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
              <button onClick={() => setShowVideoOrden(true)} style={{ ...ctrlBtn, justifyContent: "center" }}><Play size={13} /> Video</button>
              {onStartAdHocCuenta && <button onClick={() => setShowCuenta(true)} style={{ ...ctrlBtn, justifyContent: "center", gridColumn: "1 / -1" }}><Timer size={13} /> Cuenta regresiva</button>}
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
              {botonCinta({ icon: Sparkles, label: "En movimiento", title: "Fondos animados (arcos de luz, aura, vitral, nubes…)", onClick: () => { setAnimMenu(false); setEstiloMas(true); }, activo: !!fondoEnMovimiento(fondoEditado.theme), ancho: 78 })}
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
              {botonCinta({ icon: Play, label: "Video", title: "Agregar un video de YouTube al orden del culto", onClick: () => setShowVideoOrden(true) })}
              {onStartAdHocCuenta && botonCinta({ icon: Timer, label: "Reloj", title: "Cuenta regresiva", onClick: () => setShowCuenta(true) })}
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
              {botonCinta({ icon: Radio, label: "Proyección", onClick: abrirProyeccion, title: "Reabrir la pantalla de proyección", tour: "envivo-proyeccion" })}
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
          <div style={{ flex: "1 1 100%", minWidth: 0, paddingBottom: 12, borderBottom: "1px solid var(--wf-divider)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6, paddingRight: 28 }}>FONDOS EN MOVIMIENTO</div>
            <SelectorFondoMovimiento valor={fondoEditado.theme} columnas={6} onElegir={(t) => { avisarFondoPropioAnimada(); aplicarFondo({ theme: t }); }} />
          </div>
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
          {botonReiniciarCuenta}
            {controlesVideo}
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
      {showCuenta && <CuentaRegresivaModal enConsola evento={eventoInfo} onClose={() => setShowCuenta(false)} onGuardar={(c) => { onStartAdHocCuenta(c); setShowCuenta(false); }} />}
      {showVideoOrden && (
        <VideoModal iglesiaId={myIglesiaId} onClose={() => setShowVideoOrden(false)}
          destino={anclaParaAgregar() ? `Entra después de "${tituloItem(anclaParaAgregar())}".` : "Entra al final del orden del culto."}
          onAdd={({ videoUrl, name }) => {
            const id = crypto.randomUUID();
            onInsertarItems([{ id, type: "slide", title: "", subtitle: "", name, bg: "#000000", bgType: "video", videoUrl, imageUrl: "" }], anclaParaAgregar()?.id || null);
            setShowVideoOrden(false);
            setItemVisto(id); setVerTodas(false);
            if (mmPanel === "biblia") setMmPanel("transmision");
            showToast(`"${name}" quedó en el orden del culto. Tócalo para proyectarlo.`, "info");
          }} />
      )}
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

const ctrlBtn = { display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", color: "var(--wf-text)", borderRadius: 12, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
