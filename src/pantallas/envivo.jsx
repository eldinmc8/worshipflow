// Consola En vivo de Multimedia: orden del culto, diapositivas, Biblia en vivo, estilo, escenario. Separada de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import ConPlan from "../components/ConPlan.jsx";
import { useState, useRef, useEffect, useMemo } from "react";
import { buscarCanciones } from "../lib/busqueda.js";
import { Pause, Square, Volume2, VolumeX, Speaker } from "lucide-react";
import { Music, Search, Image as ImgIcon, ChevronLeft, ChevronRight, MonitorOff, Radio, BookOpen, Type, PenTool, FileUp, Plus, Pencil, MoreHorizontal, Trash2, GraduationCap, Pin, MessageSquare, AlertTriangle, PinOff, ListMusic, Palette, Play, SkipBack, SkipForward, X, Sparkles, Tv, EyeOff, Eye, ArrowRightLeft, CopyPlus, Ungroup, Timer, RotateCcw } from "lucide-react";
import { acordeEn } from "../lib/preferencias.js";
import { loadCache, saveCache } from "../lib/offlineCache.js";
import { escucharProyeccion } from "../lib/liveSession.js";
import { confirmDialog, promptDialog } from "../lib/confirm.js";
import { animacionActiva, precargarFuentesAnimacion, nombreAnimacion, fondoEnMovimiento } from "../components/LetrasAnimadas.jsx";
import { showToast } from "../lib/toast.js";
import { usePlan, tiene, abrirPlanes } from "../lib/planes.js";
import { letraATexto } from "../lib/textoCancion.js";
import { letraEfectiva } from "../lib/letraEnVivo.js";
import { pasosDeDiapositiva } from "../lib/animaciones.js";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { anclaDeBloque, bloquesDelCulto, finDeBloque } from "../lib/ordenCulto.js";
import { fondoParaRecordar } from "../lib/fondoDiapositiva.js";
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
import { avisoDeEnlace, tipoDeVideo } from "../lib/videoEnlace.js";
import { posicionActual, textoTiempo } from "../lib/videoControl.js";
import { useSalidaAudioActual } from "../components/SalidaAudioVideos.jsx";
import { estiloDeBiblia, setterDeBiblia, setterDeCanciones, sinEfectosDeCanciones } from "../lib/estiloBiblia.js";
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
export function ControlesVideo({ control, estado, onAccion, url = "" }) {
  const [, tic] = useState(0);
  const salidaAudio = useSalidaAudioActual(); // Ajustes → Salida de audio de los videos (esta computadora)
  const tipo = tipoDeVideo(url).tipo;
  const incrustado = tipo === "youtube" ? "YouTube" : tipo === "vimeo" ? "Vimeo" : null;
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
      {salidaAudio && control.sonido && (
        <div title="Se cambia en Ajustes → Salida de audio de los videos" style={{ display: "flex", gap: 5, alignItems: "flex-start", marginTop: 6, fontSize: 11, color: "var(--wf-muted)", lineHeight: 1.35 }}>
          <Speaker size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {incrustado
            ? <span>{incrustado}: el sonido sale por la salida de Chrome/Edge en Windows (Mezclador de volumen), no por «{salidaAudio.label || "la elegida"}».</span>
            : <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>Sonido por: {salidaAudio.label || "salida elegida"}</span>}
        </div>
      )}
      {reciente && estado.sonidoBloqueado && control.sonido && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 8, fontSize: 11.5, color: "#C23B32", fontWeight: 600, lineHeight: 1.35 }}>
          <VolumeX size={14} style={{ flexShrink: 0, marginTop: 1 }} /> La pantalla de proyección no deja el sonido hasta que alguien la toque una vez (o presione OK en el control de la TV). Después ya suena sola todo el culto.
        </div>
      )}
    </div>
  );
}

// ---------------- CONTROL MULTIMEDIA (EN VIVO) ----------------

export function MultimediaControl({ eventTitle, serviceOrder = [], isFreeSession, library, slides, activeIdx, adHocIdx, goto, gotoPlanSlide, blanked, setBlanked, current, next, onEnd, canEnd, liveOwner, liveStyle: estiloCompleto, setLiveStyle: setEstiloCompleto, isCompact, adHoc, onExitAdHoc, onStartAdHocBible, onStartAdHocSong, onStartAdHocVideo, onStartAdHocCuenta = null, onReiniciarCuenta = null, eventoInfo = null, onOpenPublicScreen, onNavigateBibleVerse, onAddLiveSlide, onEditLiveSlide, onRemoveLiveSlide, onEditSongSlide, onAddSongSlide, onRearmarSeccion, onAgregarCancion, onReordenarOrden, onQuitarDelOrden, onInsertarItems, myIglesiaId , palabrasPorParte = 40, onAbrirEditor, onDisenarNueva, onMoverDiapositiva, onQuitarDiapositivaGrupo, onReordenarEnGrupo, enPractica = false, onAyuda, ocultos = null, onOcultar, onMostrarOcultos, fijada = null, onFijar, onSoltar, eventoId = null, iglesiaNombre = "", usuarioId = null, pasoDiseno = 0, setPasoDiseno = () => {}, onEditarLetraCompleta, mensajeEscenario = "", onMensajeEscenario = null, iglesiaSlug = null, temporizador = null, onTemporizador = null, autoTemporizador = null, onAutoTemporizador = null, controlVideo = null, estadoVideo = null, onControlVideo = null, avanceRemotoRef = null }) {
  // Riel de íconos a la izquierda (estilo Proyektor): qué panel se muestra en la columna principal.
  // "transmision" es el que ya existía (grid de diapositivas); "biblia" y "estilo" antes eran cajones
  // que tapaban la pantalla — ahora son pestañas fijas para no perder de vista la vista previa de al lado.
  // Imagen o video propio de fondo: plan Crecimiento en adelante (ver lib/planes.js → FUNCIONES_PLAN).
  const fondoPropioOk = tiene(usePlan(), "fondo_propio");
  const [mmPanel, setMmPanel] = useState("transmision"); // "biblia" | "transmision" | "estilo" | "insertar" (este último solo en escritorio)
  // Estilo para Canciones o para la Biblia (pedido de Eldin, 2026-11-09, ver lib/estiloBiblia.js): el
  // mismo panel de Estilo de siempre, pero lo que se elige queda para lo que diga "Estilo para". Sigue
  // solo a lo que está al aire (versículo → Biblia; lo demás → Canciones) y se puede cambiar a mano para
  // dejar listo el otro. De aquí para abajo, liveStyle/setLiveStyle son SIEMPRE el estilo que se edita;
  // las vistas previas usan el completo (estiloCompleto) y cada diapositiva toma el suyo.
  const tipoEstiloAlAire = (fijada || current)?.type === "biblia" ? "biblia" : "canciones";
  // Lo que se elige a mano se respeta mientras la pestaña Estilo siga abierta (2026-11-12): antes, al
  // pasar de un versículo a una canción (o al revés) el selector se cambiaba solo y lo siguiente que se
  // tocaba caía en el otro sin que nadie lo notara. Al salir de Estilo vuelve a seguir a lo que está al aire.
  const [destinoManual, setDestinoManual] = useState(null);
  useEffect(() => { if (mmPanel !== "estilo") setDestinoManual(null); }, [mmPanel]);
  const destinoEstilo = destinoManual || tipoEstiloAlAire;
  const setDestinoEstilo = setDestinoManual;
  const editandoBiblia = destinoEstilo === "biblia";
  const liveStyle = useMemo(() => (editandoBiblia ? estiloDeBiblia(estiloCompleto) : estiloCompleto), [editandoBiblia, estiloCompleto]);
  const setLiveStyle = useMemo(() => (editandoBiblia ? setterDeBiblia(setEstiloCompleto) : setterDeCanciones(setEstiloCompleto)), [editandoBiblia, setEstiloCompleto]);
  // Colores de la letra de la Biblia desde la pestaña Biblia (pedido de Eldin, 2026-11-14): siempre el
  // estilo de la Biblia, sin importar qué diga "Estilo para".
  const estiloBiblia = useMemo(() => estiloDeBiblia(estiloCompleto), [estiloCompleto]);
  const setEstiloBiblia = useMemo(() => setterDeBiblia(setEstiloCompleto), [setEstiloCompleto]);
  const coloresBiblia = (paleta, valor, clave, nombre) => (
    <div role="group" aria-label={nombre} style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 4px" }}>
      {Object.values(paleta).map((c) => (
        <button key={c.value} onClick={() => setEstiloBiblia((st) => ({ ...st, [clave]: c.value }))} title={c.label} aria-label={`${nombre}: ${c.label}`} aria-pressed={valor.toLowerCase() === c.value.toLowerCase()}
          style={{ width: 24, height: 24, borderRadius: "50%", background: c.value, border: valor.toLowerCase() === c.value.toLowerCase() ? "3px solid #B15EA0" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0, boxSizing: "border-box", flexShrink: 0 }} />
      ))}
      <label title="Elegir otro color" style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--wf-border)", cursor: "pointer", position: "relative", overflow: "hidden", display: "flex", flexShrink: 0, boxSizing: "border-box", background: Object.values(paleta).some((c) => c.value.toLowerCase() === valor.toLowerCase()) ? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" : valor }}>
        <input type="color" aria-label={`${nombre}: otro color`} value={valor} onChange={(e) => setEstiloBiblia((st) => ({ ...st, [clave]: e.target.value }))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
      </label>
    </div>
  );
  // Muestra de lo que se está editando cuando NO es lo que está al aire (2026-11-12): con una canción al
  // aire, elegir un fondo para la Biblia no se veía en ningún lado y parecía que no hacía nada. Usa un
  // versículo (o una canción) del culto si hay; si no, uno de ejemplo. Nunca sale a la proyección.
  const muestraEstilo = () => {
    if (mmPanel !== "estilo" || destinoEstilo === tipoEstiloAlAire) return null;
    const slide = editandoBiblia
      ? slides.find((x) => x?.type === "biblia") || { slideId: "muestra-biblia", type: "biblia", reference: "Juan 3:16", version: "RVR1960", text: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna." }
      : slides.find((x) => x?.type === "cancion") || { slideId: "muestra-cancion", type: "cancion", songId: "muestra", songTitle: "Ejemplo", blockLabel: "Coro", blockKey: "C", lines: ["Cuán grande es Él", "Mi corazón entona la canción"] };
    const color = editandoBiblia ? "#2F5FA8" : "#1F8A73";
    return (
      <div data-testid="muestra-estilo" style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.4, margin: "8px 0 4px" }}>{editandoBiblia ? "ASÍ SE VERÁ LA BIBLIA" : "ASÍ SE VERÁN LAS CANCIONES"} <span style={{ fontWeight: 600, color: "var(--wf-faint)", letterSpacing: 0 }}>· muestra, no está al aire</span></div>
        <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", border: `2px dashed ${color}`, boxSizing: "border-box" }}>
          <ProjectionPanel slide={slide} blanked={false} split={false} liveStyle={estiloCompleto} thumbnail />
        </div>
      </div>
    );
  };
  const selectorDestinoEstilo = () => (
    <div role="radiogroup" aria-label="Estás cambiando" style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 13, padding: 3, gap: 3 }}>
      {[["canciones", "Canciones y textos", Music, "#1F8A73"], ["biblia", "Biblia", BookOpen, "#2F5FA8"]].map(([k, l, Icono, color]) => {
        const activo = destinoEstilo === k;
        return (
          <button key={k} role="radio" aria-checked={activo} onClick={() => setDestinoEstilo(k)}
            title={k === "biblia" ? "Fondo y letra de los versículos (sin letra animada)" : "Fondo, letra animada y letra de las canciones y los textos"}
            style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 38, fontSize: 13, fontWeight: 700, border: "none", borderRadius: 10, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap", color: activo ? "#fff" : "var(--wf-text-2)", background: activo ? color : "transparent", fontFamily: "inherit" }}>
            <Icono size={15} /> {l}
          </button>
        );
      })}
    </div>
  );
  // La Biblia se monta la primera vez que se abre y ya no se desmonta (solo se esconde) mientras dure la consola.
  const [bibliaAbierta, setBibliaAbierta] = useState(false);
  useEffect(() => { if (mmPanel === "biblia") setBibliaAbierta(true); }, [mmPanel]);
  // La "Vista sencilla" ya no existe (2026-11-14): las pestañas se ven siempre y lo esencial (Anterior,
  // Siguiente, Negro, Fijar) vive en la barra de mando de abajo — ver barraDeMando.
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
  // Lo que está desplegado dentro de la pestaña Estilo (una cosa a la vez): la biblioteca de
  // "imagen" | "video" | "movimiento" de fondo, o las letras "animada"s. null = nada.
  const [panelEstilo, setPanelEstilo] = useState(null);
  const alternarPanelEstilo = (k) => setPanelEstilo((p) => (p === k ? null : k));
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
  const font = LIVE_FONTS[liveStyle.font || "elegante"];
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
  // Control remoto (2026-11-13): las órdenes del celular usan este mismo "avanzar" (ver lib/controlRemoto.js).
  // soloPasos: el predicador al final de su bosquejo solo puede revelar los pasos de esta diapositiva.
  if (avanceRemotoRef) {
    avanceRemotoRef.current = (dir, { soloPasos = false } = {}) => {
      if (soloPasos) {
        const pasos = current?.diseno ? pasosDeDiapositiva(current.diseno) : 0;
        if (dir > 0 ? pasoDiseno < pasos : pasoDiseno > 0) avanzar(dir);
        return;
      }
      avanzar(dir);
    };
  }
  useEffect(() => () => { if (avanceRemotoRef) avanceRemotoRef.current = null; }, [avanceRemotoRef]);
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
  // "Mover a otra parte del culto" desde una fila del orden (2026-11-14): { x, y, id }.
  const [menuMover, setMenuMover] = useState(null);
  useEffect(() => {
    if (!menuMover) return;
    const cerrar = () => setMenuMover(null);
    window.addEventListener("pointerdown", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => { window.removeEventListener("pointerdown", cerrar); window.removeEventListener("scroll", cerrar, true); };
  }, [menuMover]);
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
  // Mover un elemento al final de otra parte del culto (aunque esté vacía), sin arrastrar.
  const partesDelCulto = bloquesDelCulto(serviceOrder);
  const parteDe = (itemId) => {
    let parte = null;
    for (const x of serviceOrder) { if (x.type === "seccion") parte = x.id; if (x.id === itemId) return parte; }
    return null;
  };
  const moverAParte = (itemId, parteId) => {
    const desde = serviceOrder.findIndex((x) => x.id === itemId);
    const fin = finDeBloque(serviceOrder, parteId);
    if (desde === -1 || fin === -1) return;
    const hacia = fin - (desde < fin ? 1 : 0);
    if (hacia !== desde) onReordenarOrden(desde, hacia);
    if (ocultos?.has(parteId)) onMostrarOcultos?.([parteId]);
    showToast(`"${tituloItem(serviceOrder[desde])}" ahora está en "${partesDelCulto.find((b) => b.id === parteId)?.titulo || "Bloque"}".`, "info");
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
  // Diapositiva de texto (o de imagen) que se está viendo al centro: lleva el botón "Texto y fondo".
  const textoCentro = itemCentro?.type === "slide" ? slides.find((x) => perteneceA(x, itemCentro.id) && !x.diseno && !x.cuenta && !esPaginaPresentacion(x) && !(x.totalGrupo > 1)) || null : null;
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
  // Grupo de la cinta como dato (CintaAdaptable decide si va a la vista o en "Más opciones").
  const grupoItem = (titulo, contenido, _ultimo, clave) => ({ clave: clave || titulo, titulo, contenido });
  // ===== Pestaña Estilo con TODO a la vista (rediseño de la consola, pedido de Eldin 2026-11-14: "me
  // costó encontrar funciones básicas como interlineado, está escondido; los fondos son complicados").
  // Un solo panel para computadora y celular, sin cuadros flotantes ni "Sombra y más": interlineado,
  // tamaño, color, sombra, posición y alineación siempre visibles. Lo único que se despliega (dentro
  // del mismo panel) son las bibliotecas: imágenes, videos, fondos en movimiento y letras animadas.
  const tituloEstilo = { fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5 };
  const pasoBtn = { width: 40, height: 40, flexShrink: 0, borderRadius: 12, border: "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 20, fontWeight: 700, lineHeight: 1, cursor: "pointer", fontFamily: "inherit" };
  const cajaEstilo = { background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 1px 3px rgba(22,50,79,0.08)", padding: isCompact ? 12 : 16, display: "flex", flexDirection: "column", gap: 12, boxSizing: "border-box" };
  // Un ajuste con número: − y + grandes a los lados (un toque = un paso) y la barra en medio.
  const ajusteConPasos = (c) => {
    const valor = liveStyle[c.clave] ?? c.defecto;
    const poner = (v) => setLiveStyle((st) => ({ ...st, [c.clave]: Math.min(c.max, Math.max(c.min, Math.round(v * 100) / 100)) }));
    return (
      <div key={c.clave} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={tituloEstilo}>{c.label.toUpperCase()}</span>
          <b style={{ fontSize: 12.5, color: "var(--wf-text)" }}>{c.mostrar(valor)}</b>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => poner(valor - c.paso)} disabled={valor <= c.min} aria-label={`Menos ${c.label.toLowerCase()}`} style={{ ...pasoBtn, opacity: valor <= c.min ? 0.4 : 1 }}>−</button>
          <input type="range" min={c.min} max={c.max} step={c.paso} value={valor} aria-label={c.label} onChange={(e) => poner(parseFloat(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: "var(--wf-brand-accent)", cursor: "pointer" }} />
          <button onClick={() => poner(valor + c.paso)} disabled={valor >= c.max} aria-label={`Más ${c.label.toLowerCase()}`} style={{ ...pasoBtn, opacity: valor >= c.max ? 0.4 : 1 }}>+</button>
        </div>
      </div>
    );
  };
  // Un ajuste de elegir una entre pocas (sombra, posición, alineación): botones a la vista.
  const ajusteDeOpciones = (c) => (
    <div key={c.clave} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={tituloEstilo}>{c.label.toUpperCase()}</span>
      <div role="group" aria-label={c.label} style={{ display: "flex", flexWrap: "wrap", background: "var(--wf-hover)", borderRadius: 12, padding: 3, gap: 3 }}>
        {Object.entries(c.opciones).map(([k, o]) => {
          const activo = (liveStyle[c.clave] || c.defecto) === k;
          return (
            <button key={k} onClick={() => setLiveStyle((st) => ({ ...st, [c.clave]: k }))} aria-pressed={activo}
              style={{ flex: "1 1 auto", minHeight: 34, fontSize: 12, fontWeight: 600, border: "none", borderRadius: 9, padding: "4px 8px", cursor: "pointer", whiteSpace: "nowrap", color: "var(--wf-text)", background: activo ? "var(--wf-card)" : "transparent", boxShadow: activo ? "0 1px 3px rgba(22,50,79,0.15)" : "none", fontFamily: "inherit" }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
  const fichaFondo = ({ clave, etiqueta, muestra, fondo, activo, onClick, title }) => (
    <button key={clave} onClick={onClick} title={title || etiqueta} aria-pressed={activo}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 5, borderRadius: 12, cursor: "pointer", background: "var(--wf-card)", border: activo ? "2px solid var(--wf-brand-accent)" : "2px solid var(--wf-border)", fontFamily: "inherit" }}>
      <span style={{ width: 62, height: 35, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: fondo || "var(--wf-hover)", color: "var(--wf-text)" }}>{muestra}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--wf-text)", whiteSpace: "nowrap" }}>{etiqueta}</span>
    </button>
  );
  // "Usar este mismo estilo en…": para no armar dos veces lo mismo (fondo y letra) en Canciones y Biblia.
  const copiarEstiloAlOtro = async () => {
    const ok = await confirmDialog(
      editandoBiblia ? "Las canciones y los textos van a usar el mismo fondo y la misma letra que tienen ahora los versículos. La letra animada no se toca." : "Los versículos van a usar el mismo fondo y la misma letra que tienen ahora las canciones (sin la letra animada).",
      { titulo: editandoBiblia ? "¿Usar este estilo en las canciones?" : "¿Usar este estilo en la Biblia?", textoConfirmar: "Sí, usar el mismo" },
    );
    if (!ok) return;
    setEstiloCompleto((st) => (editandoBiblia ? { ...st, ...estiloDeBiblia(st), biblia: estiloDeBiblia(st) } : { ...st, biblia: sinEfectosDeCanciones(st) }));
    showToast(editandoBiblia ? "Listo: las canciones ahora usan el estilo de la Biblia." : "Listo: la Biblia ahora usa el estilo de las canciones.", "info");
  };
  const temaConAnimacion = animacionActiva(liveStyle) && liveStyle.animFondo !== "propio";
  const panelEstiloCompleto = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
      {/* 1. Qué estoy cambiando */}
      <div style={cajaEstilo}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={tituloEstilo}>ESTÁS CAMBIANDO</span>
          {selectorDestinoEstilo()}
          <div style={{ flex: 1 }} />
          <button onClick={copiarEstiloAlOtro} className="hoverable" title="Copia el fondo y la letra, para no armarlo dos veces"
            style={{ minHeight: 38, fontSize: 12, fontWeight: 600, color: "var(--wf-text)", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            {editandoBiblia ? "Usar este mismo estilo en Canciones" : "Usar este mismo estilo en Biblia"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.45 }}>
          {destinoEstilo === tipoEstiloAlAire
            ? "Es lo que está al aire ahora: cada cambio se ve al instante en la pantalla."
            : editandoBiblia ? "Ahora no hay un versículo al aire: lo ves en la muestra, y sale así cuando proyectes uno." : "Ahora hay un versículo al aire: lo ves en la muestra, y sale así en la próxima canción o texto."}
          {editandoBiblia && " La letra animada es solo para canciones."}
        </div>
      </div>

      {/* 2. Fondo: colores, imagen, video y en movimiento en la misma fila */}
      <div style={cajaEstilo}>
        <span style={tituloEstilo}>{editandoCancion ? `FONDO DE "${cancionObjetivo.titulo.toUpperCase()}"` : editandoBiblia ? "FONDO DE LA BIBLIA" : "FONDO"}</span>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {Object.entries(LIVE_THEMES).map(([key, t]) => fichaFondo({ clave: key, etiqueta: t.label, fondo: t.bg, activo: fondoEditado.theme === key && !temaConAnimacion, onClick: () => { avisarFondoPropioAnimada(); aplicarFondo({ theme: key }); } }))}
          {fichaFondo({ clave: "imagen", etiqueta: "Imagen", muestra: <ImgIcon size={18} />, title: "Imagen de fondo: tu biblioteca de imágenes o subir una nueva", activo: panelEstilo === "imagen" || (fondoEditado.theme === "custom" && fondoEditadoTipo === "imagen"), onClick: () => { if (!fondoPropioOk) return abrirPlanes(); alternarPanelEstilo("imagen"); } })}
          {fichaFondo({ clave: "video", etiqueta: "Video", muestra: <Play size={18} />, title: "Video de fondo: tu biblioteca de videos, subir uno o pegar un enlace", activo: panelEstilo === "video" || (fondoEditado.theme === "custom" && fondoEditadoTipo === "video"), onClick: () => { if (!fondoPropioOk) return abrirPlanes(); alternarPanelEstilo("video"); } })}
          {fichaFondo({ clave: "movimiento", etiqueta: "En movimiento", muestra: <Sparkles size={18} />, title: "Fondos animados (arcos de luz, aura, vitral, nubes…)", activo: panelEstilo === "movimiento" || !!fondoEnMovimiento(fondoEditado.theme), onClick: () => alternarPanelEstilo("movimiento") })}
        </div>
        {["imagen", "video", "movimiento"].includes(panelEstilo) && (
          <div role="region" aria-label="Biblioteca de fondos" style={{ border: "1px solid var(--wf-border)", borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.45 }}>
                {panelEstilo === "imagen" ? "Toca una imagen y queda de fondo al instante." : panelEstilo === "video" ? "Toca un video y queda de fondo, en bucle y sin sonido. También puedes pegar el enlace de un .mp4." : "Toca un fondo en movimiento y queda puesto al instante."}
              </span>
              <button onClick={() => setPanelEstilo(null)} style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 10, padding: "7px 12px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Cerrar</button>
            </div>
            {panelEstilo === "movimiento" && (
              <SelectorFondoMovimiento valor={fondoEditado.theme} columnas={isCompact ? 3 : 6} onElegir={(t) => { avisarFondoPropioAnimada(); aplicarFondo({ theme: t }); }} />
            )}
            {panelEstilo === "imagen" && (
              <MediaPicker key="imagen" iglesiaId={myIglesiaId} tipo="imagen" galeriaAbierta grande={!isCompact}
                value={fondoEditado.theme === "custom" && fondoEditadoTipo === "imagen" ? fondoEditado.customImage : ""}
                onChange={(url) => { if (!fondoPropioOk) return abrirPlanes(); avisarFondoPropioAnimada(); aplicarFondo({ theme: "custom", customBgType: "imagen", customImage: url }); }} />
            )}
            {panelEstilo === "video" && (<>
              {/* El filtro !startsWith("http") es solo para no mostrar un video base64 viejo hecho
                  ilegible acá -- uno nuevo siempre es una URL https:// real. */}
              <input
                placeholder="Pega un enlace https://... (mp4 de fondo con movimiento)"
                value={fondoEditado.customVideo && !fondoEditado.customVideo.startsWith("http") ? "" : fondoEditado.customVideo || ""}
                onChange={(e) => !fondoPropioOk ? abrirPlanes() : aplicarFondo({ theme: "custom", customBgType: "video", customVideo: e.target.value })}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <MediaPicker key="video" iglesiaId={myIglesiaId} tipo="video" galeriaAbierta grande={!isCompact}
                value={fondoEditado.theme === "custom" && fondoEditadoTipo === "video" ? fondoEditado.customVideo : ""}
                onChange={(url) => { if (!fondoPropioOk) return abrirPlanes(); avisarFondoPropioAnimada(); aplicarFondo({ theme: "custom", customBgType: "video", customVideo: url }); }} />
            </>)}
          </div>
        )}
        {(fondoEditado.theme === "custom" || panelEstilo === "imagen" || panelEstilo === "video") && ajusteConPasos({ clave: "oscurecer", label: "Oscurecer la imagen o el video", min: 0, max: 0.85, paso: 0.05, defecto: 0.45, mostrar: (v) => `${Math.round(v * 100)}%` })}
        {!editandoBiblia && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 34 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox" checked={fondoPorCancion}
                onChange={(e) => { const on = e.target.checked; setLiveStyle((st) => ({ ...st, fondoPorCancion: on })); setFondoDestino(on ? "cancion" : "todo"); }}
                style={{ accentColor: "var(--wf-brand-accent)", cursor: "pointer", width: 16, height: 16 }}
              />
              Cada canción con su fondo
            </label>
            {fondoPorCancion && (<>
              <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 10, padding: 3, gap: 3 }}>
                {[["todo", "Todo"], ["cancion", cancionObjetivo ? `Solo "${cancionObjetivo.titulo.length > 22 ? cancionObjetivo.titulo.slice(0, 21) + "…" : cancionObjetivo.titulo}"` : "Solo una canción"]].map(([k, l]) => {
                  const activo = (editandoCancion ? "cancion" : "todo") === k;
                  const sinCancion = k === "cancion" && !cancionObjetivo;
                  return (
                    <button
                      key={k} onClick={() => setFondoDestino(k)} disabled={sinCancion} aria-pressed={activo}
                      title={k === "cancion" ? (cancionObjetivo ? `Cambiar solo el fondo de "${cancionObjetivo.titulo}"` : "Elige una canción en el orden del culto") : "Cambiar el fondo general (diapositivas y canciones sin fondo propio)"}
                      style={{ fontSize: 12, fontWeight: 600, border: "none", borderRadius: 8, padding: "6px 10px", cursor: sinCancion ? "not-allowed" : "pointer", opacity: sinCancion ? 0.45 : 1, whiteSpace: "nowrap", background: activo ? "var(--wf-card)" : "transparent", boxShadow: activo ? "0 1px 3px rgba(22,50,79,0.15)" : "none", color: "var(--wf-text)", fontFamily: "inherit" }}
                    >{l}</button>
                  );
                })}
              </div>
              {fondoCancionObjetivo && (
                <button onClick={quitarFondoCancion} style={{ fontSize: 12, fontWeight: 600, color: "#C23B32", background: "transparent", border: "none", cursor: "pointer", padding: "6px 4px", fontFamily: "inherit" }}>Quitarle su fondo</button>
              )}
            </>)}
          </div>
        )}
      </div>

      {/* 3. Letra: todo lo que antes vivía en "Sombra y más", a la vista */}
      <div style={cajaEstilo}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={tituloEstilo}>LETRA</span>
          <button
            onClick={() => setLiveStyle((st) => { const { interlineado: _i, espaciado: _e, sombra: _s, oscurecer: _o, posicion: _p, alineacion: _a, ...resto } = st; return resto; })}
            className="hoverable" title="Vuelve interlineado, espacio, sombra, posición y alineación a como venían"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--wf-muted)", background: "transparent", border: "none", borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}
          >Restablecer</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "16px 22px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <span style={tituloEstilo}>TIPOGRAFÍA</span>
            {/* El propio <select> y cada <option> llevan la fuente real, así cada opción se ve con su letra. */}
            <select
              aria-label="Tipografía" value={liveStyle.font || "elegante"}
              onChange={(e) => setLiveStyle((st) => ({ ...st, font: e.target.value }))}
              style={{ ...inputStyle, height: 40, padding: "6px 10px", fontSize: 14, fontFamily: font.family, fontWeight: font.weight, fontStyle: font.italic ? "italic" : "normal", textTransform: font.transform }}
            >
              {Object.entries(LIVE_FONTS).map(([key, f]) => (
                <option key={key} value={key} style={{ fontFamily: f.family, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", textTransform: f.transform }}>{f.label}</option>
              ))}
            </select>
          </div>
          {ajusteConPasos({ clave: "fontScale", label: "Tamaño de letra", min: 0.6, max: 1.8, paso: 0.05, defecto: 1, mostrar: (v) => `${Math.round(v * 100)}%` })}
          {ajusteConPasos({ clave: "interlineado", label: "Interlineado", min: 0.9, max: 2.2, paso: 0.05, defecto: 1.35, mostrar: (v) => v.toFixed(2) })}
          {ajusteConPasos({ clave: "espaciado", label: "Espacio entre letras", min: -0.05, max: 0.3, paso: 0.01, defecto: 0, mostrar: (v) => (v === 0 ? "Normal" : `${v > 0 ? "+" : ""}${Math.round(v * 100)}`) })}
          {!editandoBiblia && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={tituloEstilo}>COLOR DE LETRA</span>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", minHeight: 40 }}>
                {Object.entries(LIVE_TEXT_COLORS).map(([key, c]) => (
                  <button key={key} onClick={() => setLiveStyle((st) => ({ ...st, textColor: c.value }))} title={c.label} aria-label={`Letra ${c.label}`} aria-pressed={(liveStyle.textColor || "#FFFFFF") === c.value}
                    style={{ width: 30, height: 30, borderRadius: "50%", background: c.value, border: (liveStyle.textColor || "#FFFFFF") === c.value ? "3px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0, boxSizing: "border-box", flexShrink: 0 }} />
                ))}
                <label title="Elegir otro color" style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid var(--wf-border)", cursor: "pointer", position: "relative", overflow: "hidden", display: "flex", flexShrink: 0, boxSizing: "border-box", background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
                  <input type="color" aria-label="Letra: otro color" value={liveStyle.textColor || "#FFFFFF"} onChange={(e) => setLiveStyle((st) => ({ ...st, textColor: e.target.value }))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
                </label>
              </div>
            </div>
          )}
          {ajusteDeOpciones({ clave: "alineacion", label: "Alineación", opciones: LIVE_ALINEACIONES, defecto: "centro" })}
          {ajusteDeOpciones({ clave: "posicion", label: "Posición", opciones: LIVE_POSICIONES, defecto: "centro" })}
          {ajusteDeOpciones({ clave: "sombra", label: "Sombra de la letra", opciones: LIVE_SOMBRAS, defecto: "ninguna" })}
          {!editandoBiblia && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={tituloEstilo}>DISEÑO DE LAS LETRAS</span>
              <select
                aria-label="Diseño de la letra" value={liveStyle.lineStyle || "tradicional"}
                onChange={(e) => setLiveStyle((st) => ({ ...st, lineStyle: e.target.value }))}
                style={{ ...inputStyle, height: 40, padding: "6px 10px", fontSize: 13 }}
              >
                {Object.entries(LINE_STYLES).map(([key, ls]) => <option key={key} value={key}>{ls.label}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 4. Solo Biblia: colores del versículo y de la cita */}
      {editandoBiblia && (
        <div style={cajaEstilo}>
          <span style={tituloEstilo}>VERSÍCULOS</span>
          <div style={{ display: "flex", gap: "12px 28px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--wf-muted)" }}>Color del texto del versículo</span>
              {coloresBiblia(LIVE_TEXT_COLORS, estiloBiblia.bibliaTextColor || estiloBiblia.textColor || "#FFFFFF", "bibliaTextColor", "Color del versículo")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--wf-muted)" }}>Color de la cita (ej. "Mateo 5:25")</span>
              {coloresBiblia(LIVE_REFERENCE_COLORS, estiloBiblia.bibliaReferenciaColor || "#6E9BD1", "bibliaReferenciaColor", "Color de la cita")}
            </div>
          </div>
        </div>
      )}

      {/* 5. Solo canciones: letra animada */}
      {!editandoBiblia && (
        <div style={cajaEstilo}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={tituloEstilo}>LETRA ANIMADA</span>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--wf-text)" }}>{animacionActiva(liveStyle) ? nombreAnimacion(liveStyle) || "Puesta" : "Ninguna"}</span>
            <button onClick={() => alternarPanelEstilo("animada")} aria-expanded={panelEstilo === "animada"}
              style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 38, fontSize: 12.5, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 12, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
              <Sparkles size={14} /> {panelEstilo === "animada" ? "Cerrar" : "Elegir un estilo con movimiento"}
            </button>
          </div>
          {panelEstilo === "animada" && (
            <SelectorAnimacion liveStyle={liveStyle} setLiveStyle={setLiveStyle} columnas={isCompact ? 2 : 5} iglesiaId={myIglesiaId} iglesiaNombre={iglesiaNombre} usuarioId={usuarioId} />
          )}
        </div>
      )}
    </div>
  );
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
  // El texto rápido empieza con el fondo del último que se hizo en esta computadora (2026-11-14): si la
  // iglesia usa siempre un color liso o una imagen para los avisos, no hay que elegirlo cada vez.
  const nuevaDiapositivaTexto = () => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "", ...(loadCache("texto_rapido_fondo") || {}) }); setShowAddSlide(true); };
  // "Imagen": la misma ventana, ya en Imagen y con la biblioteca abierta.
  const nuevaDiapositivaImagen = () => { setNewSlideDraft({ title: "", subtitle: "", bg: "#1B2029", bgType: "imagen", videoUrl: "", imageUrl: "" }); setShowAddSlide("imagen"); };
  // Mini pantalla dentro de la ventana de la diapositiva: cómo se va a ver con el estilo de ahora.
  const vistaPreviaDiapositiva = (d) => {
    const soloFondo = (d.bgType === "imagen" && d.imageUrl) || (d.bgType === "video" && d.videoUrl);
    return <ProjectionPanel slide={{ slideId: "vista-previa", type: "slide", title: d.title || (soloFondo ? "" : "Tu texto aquí"), subtitle: d.subtitle || "", escalaSubtitulo: d.escalaSubtitulo, bg: d.bg, bgType: d.bgType, videoUrl: d.videoUrl, imageUrl: d.imageUrl }} blanked={false} split={false} liveStyle={estiloCompleto} thumbnail />;
  };
  const opcionesAgregarConsola = [
    { clave: "proyectar", Icon: Radio, color: "var(--wf-brand-accent)", titulo: "Proyectar desde biblioteca", detalle: "Busca una canción y sale en pantalla de una vez", accion: () => setShowAdHocSong("proyectar") },
    { clave: "cancion", Icon: Music, color: "#1F8A73", titulo: "Canción", detalle: "De la biblioteca — queda en el orden del culto", accion: () => setShowAdHocSong(true) },
    { clave: "biblia", Icon: BookOpen, color: "#2F5FA8", titulo: "Versículo", detalle: "Búscalo en la Biblia y proyéctalo al momento", accion: () => setMmPanel("biblia") },
    { clave: "texto", Icon: Type, color: "#B15EA0", titulo: "Texto rápido", detalle: "Un aviso o el título de la prédica, en segundos", accion: nuevaDiapositivaTexto },
    { clave: "imagen", Icon: ImgIcon, color: "#B15EA0", titulo: "Imagen", detalle: "De tu biblioteca de imágenes o una nueva, a pantalla completa", accion: nuevaDiapositivaImagen },
    !isCompact && onDisenarNueva && { clave: "disenar", Icon: PenTool, color: "#E8821E", titulo: "Diseñar diapositiva", detalle: "Con imágenes y plantillas", accion: () => onDisenarNueva(anclaParaAgregar()?.id || null) },
    { clave: "importar", Icon: FileUp, color: "#5B6472", titulo: "Importar PDF o imágenes", detalle: "De Canva, PowerPoint o del predicador", accion: () => setShowImportar(true) },
    { clave: "video", Icon: Play, color: "#C23B32", titulo: "Video de YouTube", detalle: "Queda en el orden del culto. Al tocarlo se reproduce con sonido y lo controlas desde aquí", accion: () => setShowVideoOrden(true) },
    onStartAdHocCuenta && { clave: "cuenta", Icon: Timer, color: "#5661B3", titulo: "Cuenta regresiva", detalle: "Un reloj antes del culto o de un receso (20 estilos)", accion: () => setShowCuenta(true) },
  ].filter(Boolean);
  // Debajo de la vista previa cuando lo que está al aire es una cuenta regresiva.
  const controlesVideo = controlVideo && onControlVideo ? <ControlesVideo control={controlVideo} estado={estadoVideo} onAccion={onControlVideo} url={(fijada || current)?.videoUrl || ""} /> : null;
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
  // Botones grandes de la barra de mando (escritorio).
  const botonGrande = ({ icon: Icon, label, sub, onClick, fondo = "var(--wf-hover)", color = "var(--wf-text)", tour, ancho = 120, titulo, crece = false }) => (
    <button onClick={onClick} data-tour={tour} title={titulo || label} className="hoverable"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: ancho, height: 56, padding: "0 16px", border: "none", borderRadius: 14, cursor: "pointer", background: fondo, color, fontFamily: "inherit", flexShrink: 0, boxShadow: "0 2px 8px rgba(22,50,79,0.10)", ...(crece ? { flex: "1 1 170px", maxWidth: 300 } : {}) }}>
      <Icon size={22} strokeWidth={2} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{label}</span>
        {sub && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
    </button>
  );
  // Barra de mando (rediseño 2026-11-14): Anterior, Siguiente, Negro y Fijar SIEMPRE abajo, en el mismo
  // lugar, en cualquier pestaña. Reemplaza al interruptor "Vista sencilla / Más herramientas": lo
  // esencial ya no se esconde y lo demás está en las pestañas. A la derecha queda libre la esquina del
  // botón redondo del menú de la app (ver navEncogida en PrototipoWorshipFlow).
  const barraDeMando = (
    <div data-tour="envivo-mando" role="toolbar" aria-label="Mando de la proyección" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 76px 12px 16px", background: "var(--wf-card)", boxShadow: "0 -1px 3px rgba(22,50,79,0.10)", flexShrink: 0, position: "relative", zIndex: 5 }}>
      {botonGrande({ icon: ChevronLeft, label: "Anterior", onClick: () => avanzar(-1), ancho: 130 })}
      {botonGrande({ icon: ChevronRight, label: "Siguiente", sub: cambiaDeElemento ? `Pasas a: ${nombreSiguiente}` : next ? null : "Es la última", onClick: () => avanzar(1), fondo: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)", tour: "envivo-siguiente", ancho: 170, crece: true })}
      {botonGrande({ icon: MonitorOff, label: blanked ? "Volver a mostrar" : "Negro", sub: blanked ? null : "Esconde todo", onClick: () => setBlanked((b) => !b), fondo: blanked ? "#C23B32" : "var(--wf-hover)", color: blanked ? "#fff" : "var(--wf-text)", tour: "envivo-negro", ancho: 140 })}
      {onFijar && botonGrande({ icon: fijada ? PinOff : Pin, label: fijada ? "Soltar" : "Fijar", sub: fijada ? "Volver a transmitir" : "Congela la pantalla", onClick: () => (fijada ? onSoltar() : onFijar()), fondo: fijada ? "#7B3FA0" : "var(--wf-hover)", color: fijada ? "#fff" : "var(--wf-text)", tour: "envivo-fijar", ancho: 140, titulo: "Deja la pantalla quieta en lo que se ve ahora, para moverte por la consola sin que se proyecte (tecla F)" })}
      <div style={{ width: 1, alignSelf: "stretch", background: "var(--wf-divider)", margin: "4px 4px" }} />
      {botonGrande({ icon: SkipBack, label: "Inicio", onClick: () => goto(0), ancho: 0, titulo: "Ir a la primera diapositiva" })}
      {botonGrande({ icon: SkipForward, label: "Final", onClick: () => goto(Infinity), ancho: 0, titulo: "Ir a la última diapositiva" })}
      <div style={{ flex: 1 }} />
      <div className="wf-mando-teclas" style={{ fontSize: 11.5, color: "var(--wf-muted)", lineHeight: 1.9, textAlign: "right", flexShrink: 0 }}>
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
            {panelEstiloCompleto()}
          </div>
        )}

        {mmPanel === "transmision" && (
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700 }}>TODAS LAS SLIDES</span>
            <button
              onClick={() => nuevaDiapositivaTexto()}
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
              <ProjectionPanel slide={current} blanked={blanked} split={false} liveStyle={estiloCompleto} thumbnail />
            </div>
            {muestraEstilo()}
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
              <button onClick={() => nuevaDiapositivaTexto()} style={{ ...ctrlBtn, justifyContent: "center", gridColumn: "1 / -1" }}><Type size={13} /> Diapositiva</button>
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
        {[["transmision", "Transmisión"], ["biblia", "Biblia"], ["estilo", "Estilo"], ["insertar", "Insertar"]].map(([key, label]) => (
          <button
            key={key} onClick={() => setMmPanel(key)}
            style={{ padding: "10px 14px 9px", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: mmPanel === key ? 700 : 500, color: mmPanel === key ? "var(--wf-heading)" : "var(--wf-muted)", borderBottom: `2px solid ${mmPanel === key ? "var(--wf-brand-accent)" : "transparent"}`, flexShrink: 0 }}
          >{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {/* Pantallas, a la mano y siempre en el mismo lugar (antes en la cinta de Transmisión). */}
        <button data-tour="envivo-proyeccion" onClick={abrirProyeccion} className="hoverable" title="Abrir o reabrir la pantalla de proyección" style={{ display: "flex", alignItems: "center", gap: 6, height: 32, fontSize: 12, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 16, padding: "0 12px", cursor: "pointer", marginRight: 6, flexShrink: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}><Radio size={14} /> Proyección</button>
        <button onClick={() => setShowOtroEquipo(true)} className="hoverable" title="Conectar un Smart TV con número, o abrir en celular/tablet con QR" style={{ display: "flex", alignItems: "center", gap: 6, height: 32, fontSize: 12, fontWeight: 700, color: "var(--wf-text)", background: "var(--wf-hover)", border: "none", borderRadius: 16, padding: "0 12px", cursor: "pointer", marginRight: 6, flexShrink: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}><Tv size={14} /> Pantallas y TV</button>
        {onMensajeEscenario && <button onClick={() => setShowEscenario(true)} className="hoverable" title="Pantalla de escenario: mensajes, temporizador del mensaje y enlace del monitor" style={{ display: "flex", alignItems: "center", gap: 6, height: 32, fontSize: 12, fontWeight: 700, color: "var(--wf-text)", background: mensajeEscenario || temporizadorActivo(temporizador) ? "#E8821E" : "var(--wf-hover)", border: "none", borderRadius: 16, padding: "0 12px", cursor: "pointer", marginRight: 6, flexShrink: 0, fontFamily: "inherit", whiteSpace: "nowrap" }}><MessageSquare size={14} /> Escenario</button>}
        <div style={{ width: 1, height: 22, background: "var(--wf-divider)", margin: "0 8px 0 2px", flexShrink: 0 }} />
        {onAyuda && (
          <button data-tour="envivo-ayuda" onClick={onAyuda} title="¿Cómo se usa? Ver la guía otra vez" aria-label="Ayuda" className="hoverable"
            style={{ width: 28, height: 28, borderRadius: 14, border: "none", background: "var(--wf-hover)", color: "var(--wf-text)", cursor: "pointer", fontSize: 14, fontWeight: 800, marginRight: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>?</button>
        )}
        {botonFinalizar}
      </nav>
      {franjasDeEstado}
      {/* La cinta ya no repite Anterior/Siguiente/Negro (viven en la barra de mando de abajo) y en
          Estilo no hay cinta: el panel del centro lo tiene todo. */}
      {mmPanel !== "estilo" && (
        <CintaAdaptable
          tour="envivo-paneles" dibujarGrupo={grupoCinta}
          estilo={{ padding: "6px 8px 4px", minHeight: 76, boxSizing: "border-box", background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)" }}
          grupos={(mmPanel === "biblia" ? [
          { ...grupoItem("Color del versículo", coloresBiblia(LIVE_TEXT_COLORS, estiloBiblia.bibliaTextColor || estiloBiblia.textColor || "#FFFFFF", "bibliaTextColor", "Color del versículo"), false, "biblia-color-texto"), mantenerAbierto: true },
          { ...grupoItem("Color de la cita", coloresBiblia(LIVE_REFERENCE_COLORS, estiloBiblia.bibliaReferenciaColor || "#6E9BD1", "bibliaReferenciaColor", "Color de la cita"), false, "biblia-color-cita"), mantenerAbierto: true },
          grupoItem("", <div style={{ display: "flex", alignItems: "center", padding: "0 16px", maxWidth: 440 }}>
              <span style={{ fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.5 }}>Busca un libro, una cita (ej. stgo 4:1) o palabras del versículo, aunque no estén exactas. Toca el versículo para proyectarlo. Los versículos largos aparecen en partes (1/2, 2/2): toca la que quieras o avanza con la flecha →.</span>
            </div>, false, "ayuda-biblia"),
        ] : mmPanel === "estilo" ? [
        ] : mmPanel === "insertar" ? [
          grupoItem("Del culto", <>
              {botonCinta({ icon: Music, label: "Canción", onClick: () => setShowAdHocSong(true) })}
              {botonCinta({ icon: BookOpen, label: "Versículo", onClick: () => setMmPanel("biblia") })}
            </>),
          grupoItem("Presentación", botonCinta({ icon: FileUp, label: "Importar", onClick: () => setShowImportar(true), title: "Importar un PDF, imágenes de Canva, o un Word con el bosquejo", ancho: 64 })),
          grupoItem("De último momento", <>
              {onDisenarNueva && botonCinta({ icon: PenTool, label: "Diseñar", title: "Diseñar una diapositiva desde cero (con plantillas)", onClick: () => onDisenarNueva(anclaParaAgregar()?.id || null) })}
              {botonCinta({ icon: Type, label: "Texto", title: "Texto rápido: un aviso o el título de la prédica", onClick: nuevaDiapositivaTexto })}
              {botonCinta({ icon: ImgIcon, label: "Imagen", title: "Una imagen a pantalla completa: de tu biblioteca o una nueva", onClick: nuevaDiapositivaImagen })}
              {botonCinta({ icon: Play, label: "Video", title: "Agregar un video de YouTube al orden del culto", onClick: () => setShowVideoOrden(true) })}
              {onStartAdHocCuenta && botonCinta({ icon: Timer, label: "Reloj", title: "Cuenta regresiva", onClick: () => setShowCuenta(true) })}
            </>, true),
        ] : [
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

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, padding: "10px 12px 12px" }}>
        {/* Orden del culto, dividido por bloques igual que el Setlist */}
        <aside aria-label="Orden del culto" data-tour="envivo-orden" style={{ width: "clamp(200px, 17vw, 260px)", flexShrink: 0, overflowY: "auto", background: "var(--wf-card)", borderRadius: 12, boxShadow: "0 2px 10px rgba(22,50,79,0.08)", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 6, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "0 4px" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5 }}>ORDEN DEL CULTO</span>
          </div>
          <div style={{ padding: "0 2px 4px" }}>{botonAgregarConsola({ ancho: true, tour: "envivo-agregar" })}</div>
          {serviceOrder.length > 0 && <div style={{ fontSize: 11, color: "var(--wf-faint)", padding: "0 4px 2px" }}>Toca cualquiera para proyectarlo.</div>}
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
            // El cursor de "mano que agarra" es blanco y sobre las filas claras no se veía (reportado por
            // Eldin, 2026-11-14): aquí la flecha/mano de siempre, y la de agarrar solo mientras se arrastra.
            const cursorFila = (normal) => (arrastreOrden.indiceArrastrado === idx ? "grabbing" : normal);
            if (estaOculto(it)) return null;
            if (it.type === "seccion") {
              const cuantos = visiblesDeBloque(it.id).length;
              const vacio = (bloquesOrden.find((b) => b.id === it.id)?.items || []).length === 0;
              // Con todo lo suyo oculto, el bloque tampoco se ve.
              if (cuantos === 0 && !vacio) return null;
              // Una parte del culto vacía SÍ se ve, apagada (2026-11-14): antes se escondía y no había
              // dónde soltar algo que se quería pasar a "Predicación" si no se había puesto ahí desde el inicio.
              return (
                <div key={it.id} {...filaArrastre} className="orden-fila" title={vacio ? "Esta parte del culto está vacía: arrastra algo aquí debajo o toca + para agregarle" : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: vacio ? "4px 9px" : "6px 9px", borderRadius: 10, background: vacio ? "transparent" : "rgba(124,140,216,0.16)", border: vacio ? "1px dashed var(--wf-border)" : "1px solid #5661B3", marginTop: idx === 0 ? 0 : 4, ...arrastreOrden.estiloFila(idx), cursor: cursorFila("default") }}>
                  <ListMusic size={13} color={vacio ? "var(--wf-faint)" : "#5661B3"} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: vacio ? 600 : 700, color: vacio ? "var(--wf-muted)" : "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title || "Bloque"}</span>
                  {cuantos > 0 && <span style={{ fontSize: 10.5, color: "#5661B3", fontWeight: 700 }}>{cuantos}</span>}
                  {vacio && <span style={{ fontSize: 10, color: "var(--wf-faint)" }}>vacío</span>}
                  {vacio && (
                    <button onClick={(e) => { e.stopPropagation(); setDestinoConsola(it.id); setShowAgregarConsola(true); }} title={`Agregar algo a "${it.title || "Bloque"}"`} aria-label={`Agregar a ${it.title || "Bloque"}`} style={{ ...iconGhost, padding: 2, color: "var(--wf-brand-accent)", flexShrink: 0 }}><Plus size={14} /></button>
                  )}
                  {quitar}
                </div>
              );
            }
            const mover = partesDelCulto.length > 0 && (
              <button
                className="orden-quitar" onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenuMover({ x: r.left, y: r.bottom + 4, id: it.id }); }}
                title="Mover a otra parte del culto" aria-label="Mover a otra parte del culto"
                style={{ ...iconGhost, padding: 2, color: "var(--wf-faint)", flexShrink: 0 }}
              ><ArrowRightLeft size={13} /></button>
            );
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
                style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: dentroDeBloque ? 12 : 0, padding: "7px 9px", borderRadius: 10, textAlign: "left", fontSize: 12.5, color: "var(--wf-text)", fontWeight: alAire || visto ? 700 : 500, background: alAire ? "var(--wf-active-bg)" : visto ? "var(--wf-hover)" : "var(--wf-card)", border: visto ? "1px solid var(--wf-border)" : "1px solid transparent", ...arrastreOrden.estiloFila(idx), cursor: cursorFila("pointer") }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: TYPE_META[it.type]?.color || "#5B6472" }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloItem(it)}{it.diapositivas?.length > 1 && <span style={{ fontWeight: 500, color: "var(--wf-muted)" }}> · {it.diapositivas.length}</span>}</span>
                {fondoPorCancion && it.type === "cancion" && liveStyle.fondosCanciones?.[it.songId] && <span title="Tiene su propio fondo" style={{ display: "flex", flexShrink: 0 }}><ImgIcon size={11} color="#B15EA0" /></span>}
                {alAire && <span style={{ fontSize: 9, fontWeight: 800, color: "#C23B32" }}>●</span>}
                {mover}
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
        {/* Estilo ocupa el centro (2026-11-14): todo a la vista, con "Al aire" siempre a la derecha. */}
        {mmPanel === "estilo" && (
          <section aria-label="Estilo" data-tour="envivo-estilo" style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "0 4px 8px" }}>
            {panelEstiloCompleto()}
          </section>
        )}
        {mmPanel !== "biblia" && mmPanel !== "estilo" && (
          <section aria-label="Diapositivas" data-tour="envivo-diapositivas" style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "0 4px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemCentro ? tituloItem(itemCentro) : "Todas las diapositivas"}</div>
                <div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>{indicesCentro.length} diapositiva{indicesCentro.length === 1 ? "" : "s"}{itemCentro && itemAlAire?.id !== itemCentro.id ? " · no está al aire" : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {textoCentro && (
                  <button onClick={() => startEditingSlide(textoCentro)} title="Cambiar el texto o el fondo de esta diapositiva (color liso, imagen de la biblioteca o video)" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--wf-brand-primary)", background: "var(--wf-brand-accent)", border: "none", borderRadius: 18, padding: "5px 10px", cursor: "pointer" }}><ImgIcon size={12} /> Texto y fondo</button>
                )}
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
        <aside aria-label="Vista previa" data-tour="envivo-alaire" style={{ width: "clamp(300px, 32vw, 480px)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#C23B32", letterSpacing: 0.4 }}><Radio size={11} /> AL AIRE</span>
            {alAire && <span style={{ fontSize: 11, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{blanked ? "Pantalla en negro" : alAire.type === "cancion" ? `${alAire.songTitle} · ${alAire.blockLabel}` : alAire.type === "biblia" ? alAire.reference : alAire.nombre || alAire.title}</span>}
          </div>
          <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(22,50,79,0.18)", border: "2px solid #C23B32", flexShrink: 0 }}>
            <ProjectionPanel slide={alAire} blanked={blanked} split={false} liveStyle={estiloCompleto} thumbnail />
          </div>
          {muestraEstilo()}
          {botonReiniciarCuenta}
            {controlesVideo}
          {fijada && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7B3FA0", letterSpacing: 0.4, marginTop: 4 }}>DONDE ESTÁS · SE PROYECTA AL SOLTAR</div>
              <div style={{ width: "62%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden", border: "2px dashed #7B3FA0", flexShrink: 0 }}>
                <ProjectionPanel slide={current} blanked={false} split={false} liveStyle={estiloCompleto} thumbnail />
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
            <ProjectionPanel slide={next} blanked={false} split={false} liveStyle={estiloCompleto} thumbnail />
          </div>
          <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>{next ? (next.type === "cancion" ? `${next.songTitle} · ${next.blockLabel}` : next.type === "biblia" ? next.reference : next.nombre || next.title) : adHoc ? "No hay más diapositivas" : "Última diapositiva del servicio"}</div>
          {/* Lo agregado (textos, diapositivas, canciones) se ve solo en el ORDEN DEL CULTO de la
              izquierda (pedido de Eldin, 2026-10-11): aquí abajo ya no se repite. */}
        </aside>
      </div>
      {barraDeMando}
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
      {menuMover && (() => {
        const actual = parteDe(menuMover.id);
        const x = Math.min(menuMover.x, window.innerWidth - 250);
        const y = Math.min(menuMover.y, window.innerHeight - Math.min(340, 60 + partesDelCulto.length * 34));
        return (
          <div onPointerDown={(e) => e.stopPropagation()} role="menu" aria-label="Mover a otra parte del culto" style={{ position: "fixed", left: x, top: y, zIndex: 3000, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: 4, width: 240, maxHeight: 340, overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.35)" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, padding: "6px 10px 4px" }}>MOVER A…</div>
            {partesDelCulto.map((b) => (
              <button key={b.id} role="menuitem" disabled={b.id === actual} onClick={() => { const id = menuMover.id; setMenuMover(null); moverAParte(id, b.id); }}
                className={b.id === actual ? undefined : "hoverable"}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", borderRadius: 7, padding: "7px 10px", cursor: b.id === actual ? "default" : "pointer", color: b.id === actual ? "var(--wf-faint)" : "var(--wf-text)", fontSize: 12.5, textAlign: "left", fontFamily: "inherit" }}>
                <ListMusic size={13} color="#5661B3" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.titulo}</span>
                <span style={{ fontSize: 10.5, color: "var(--wf-faint)", flexShrink: 0 }}>{b.id === actual ? "aquí está" : b.cuantos === 0 ? "vacío" : b.cuantos}</span>
              </button>
            ))}
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
        <ConPlan funcion="importar" onCerrar={() => setShowImportar(false)}>
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
        </ConPlan>
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
          iglesiaId={myIglesiaId} title={showAddSlide === "imagen" ? "Imagen" : "Texto rápido"} vistaPrevia={vistaPreviaDiapositiva}
          draft={newSlideDraft} setDraft={setNewSlideDraft}
          onClose={() => setShowAddSlide(false)}
          onAdd={() => {
            if (!newSlideDraft.title && !(newSlideDraft.bgType === "video" && newSlideDraft.videoUrl) && !(newSlideDraft.bgType === "imagen" && newSlideDraft.imageUrl)) { showToast(newSlideDraft.bgType === "imagen" ? "Elige una imagen o escribe un texto." : "Escribe el texto que se va a proyectar.", "info"); return; }
            if (showAddSlide !== "imagen") saveCache("texto_rapido_fondo", fondoParaRecordar(newSlideDraft));
            onAddLiveSlide(newSlideDraft, anclaParaAgregar()?.id); setShowAddSlide(false);
          }}
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
        <SlideModal iglesiaId={myIglesiaId} title="Editar diapositiva" submitLabel="Guardar cambios" vistaPrevia={vistaPreviaDiapositiva} draft={editDraft} setDraft={setEditDraft} onClose={() => setEditingSlide(null)} onAdd={saveSlideEdit} />
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
