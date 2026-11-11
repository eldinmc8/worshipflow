import ConPlan from "./components/ConPlan.jsx";
import { lazy, useState, useEffect, useRef, useMemo, Suspense } from "react";
import { esGrupoDiapositivas, slidesDeGrupo, itemConDiapositivas, tituloBase, diapositivasDeItem, nuevaDiapositiva, moverDiapositiva, quitarDiapositiva as quitarDiapositivaDeGrupo, reordenarEnGrupo } from "./lib/diapositivas.js";
import { usePreferencias } from "./lib/preferencias.js";
import { delegarPantallaCompleta, esperarListaYDelegar } from "./lib/delegarPantallaCompleta.js";
import { pausarActualizacion } from "./lib/pausaActualizacion.js";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { showToast, notifyError, esFalloDeConexion } from "./lib/toast.js";
import { ordenarPor } from "./lib/orden.js";
import { registrarLineaBaseEventos, listEventosCompletos, sincronizarServiceOrder, sincronizarWorshipRoles, crearEventoCompleto, deleteEvento, updateEvento, marcarAsignacionVista } from "./lib/eventos.js";
import { registrarLineaBaseMinisterios, listMinisteriosCompletos, sincronizarPlan, sincronizarRecursos, crearMinisterio, actualizarLiderMinisterio, actualizarNombreMinisterio, actualizarPermisosLider, actualizarColorMinisterio, eliminarMinisterio } from "./lib/ministerios.js";
import { listCancionesCompletas, updateCancion, guardarLetraCancion, guardarCancionDesdeEditor, deleteCancion } from "./lib/canciones.js";
import { saveCache, loadCache } from "./lib/offlineCache.js";
import { subscribeTableChanges } from "./lib/realtime.js";
import { palabrasPorParteSegun, expandirVersiculosLargos, reorganizarLetra } from "./lib/dividirTexto.js";
import { insertarEnBloque } from "./lib/ordenCulto.js";
import { esBloquePredicacion, guardarBosquejo, aplicarBosquejoAlOrden, bosquejoAItems, eliminarBosquejo, quitarBosquejoDelOrden } from "./lib/bosquejos.js";
import { animacionEfectiva, estiloDeParte } from "./lib/animacionCancion.js";
import { esCuentaRegresiva, slideCuentaRegresiva, conHoraFinal, arrancarSiHaceFalta, slideCuentaAlMomento, normalizarCuenta, itemCuentaRegresiva } from "./lib/cuentaRegresiva.js";
import { confirmDialog } from "./lib/confirm.js";
import { updateMusicoLive, clearMusicoLive, getMusicoLive, subscribeMusicoLive } from "./lib/musicoLive.js";
import { escucharEstadoVideo } from "./lib/liveSession.js";
import { elegirOtraPantalla, medidasVentana, motivoSinSegundaPantalla } from "./lib/segundaPantalla.js";
import { controlInicial, aplicarAccion } from "./lib/videoControl.js";
import { esVideoSolo } from "./lib/videoEnlace.js";
import { broadcastLiveSession, enviarAPantallas, clearLiveSession, obtenerCodigoPantalla, updateLiveSession, responderPedidosDeEstado, getLiveSession, subscribeLiveSession, pedirCerrarProyeccion } from "./lib/liveSession.js";
import { aplicarCambioLetra, rearmarSeccion, letraEfectiva } from "./lib/letraEnVivo.js";
import { textoALetra } from "./lib/textoCancion.js";
import { sincronizarRecordatorios } from "./lib/recordatorios.js";
import { listMisNotificaciones, subscribeNotificaciones, marcarLeida, marcarTodasLeidas, estadoPermisoNotificacion, tieneAlgunaSuscripcionPush, decidirAccionPush, suscribirPush } from "./lib/notificaciones.js";
import { estaEnPredicacion, perteneceA, temporizadorActivo, iniciarTemporizador, armarEscenario } from "./lib/escenario.js";
import { isUpcoming, compareByDay, formatFullDate } from "./lib/dates.js";
import { CLAVES_TUTORIAL, pasosBienvenida, pasosEventos, pasosEvento, pasosCanciones, pasosEditorCancion, pasosEnVivo, marcarTutorialVisto, reiniciarTutoriales } from "./lib/tutoriales.js";
import { Eye, WifiOff, EyeOff, ChevronRight, Bell, Pencil, Check, LayoutGrid, Home, Music, Calendar, MessageCircle, Radio, Image as ImgIcon, Settings, X } from "lucide-react";
import AppLogo from "./AppLogo.jsx";
import Tour from "./components/Tour.jsx";
import ImportarCancionesPdf from "./components/ImportarCancionesPdf.jsx";
import BosquejoWizard from "./components/BosquejoWizard.jsx";
import { stripBibleSearchMarkup } from "./lib/textoBiblia.js";
import { semitoneShift, transposeLine, CLASIFICACIONES_DEFAULT, fijarClasificacionesActuales, EVENTO_LIBRE, isWorshipBlock, serviceItemLabel, DEFAULT_COVERS, lideraBloque, nextMinistryChildId, misAsignacionesEnEvento, ModalShell, ghostToggleBtn, primaryBtn, fetchBibleChapter, fetchBibleBooks } from "./pantallas/compartido.jsx";
import { InicioView } from "./pantallas/inicio.jsx";
import { SettingsView } from "./pantallas/ajustes.jsx";
import { MinistriesList, MinistryDetail } from "./pantallas/ministerios.jsx";
import { AsistenteChatScreen } from "./pantallas/asistente.jsx";
import { CancionesList, SongView, SongEditor } from "./pantallas/canciones.jsx";
import { EventList, EventDetail, puedeVerDiapositivasEvento } from "./pantallas/eventos.jsx";
import { BibleBrowserBody } from "./pantallas/biblia.jsx";
import { MultimediaControl } from "./pantallas/envivo.jsx";
import { ProjectionPanel } from "./pantallas/proyeccion.jsx";
export { ProjectionPanel } from "./pantallas/proyeccion.jsx";

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

// Umbral para dar por abandonada una sesión en vivo que nadie finalizó (pedido de Eldin, 2026-11-07:
// antes era un día entero y solo se revisaba al abrir la app) — 2 horas sin cambiar de diapositiva ni
// tocar la consola. Ver el useEffect que llama a getLiveSession() y el de "Cierre por inactividad".
const LIVE_SESSION_STALE_MS = 2 * 60 * 60 * 1000;
// Cada cuánto se revisa, y cada cuánto quien transmite avisa a la base que sigue ahí aunque esté en la
// misma diapositiva (así otro dispositivo no le cierra la transmisión durante una prédica larga).
const LIVE_SESSION_CHECK_MS = 60 * 1000;
const LIVE_SESSION_TOUCH_MS = 10 * 60 * 1000;

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

// UUIDs reales (no ids falsos tipo "it301"): así cualquier fila creada en el cliente ya sirve
// directo como primary key real en Supabase, sin tener que "reconciliar" un id falso con el real
// que devolvería el servidor después de guardar.
const nextId = () => crypto.randomUUID();

// ---------- Equipo / iglesia ----------
// El nombre de la iglesia ya NO está fijo acá (Fase 3) — InicioView y SettingsView lo reciben como
// prop `teamName`, leído de iglesias.nombre (ver myIglesia en WorshipFlowPrototype).

// ---------- Convierte una canción + estructura en diapositivas proyectables (planeada o improvisada) ----------
function songToSlides(idPrefix, song, structure, item = null) {
  // Animación por canción (pestaña "Animación", 2026-11-06): cada diapositiva lleva el estilo de su parte.
  const anim = animacionEfectiva(song, item);
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
        // Tempo de la canción: marca el pulso de los efectos "al compás" de la letra animada (2026-11-06).
        tempo: Number(song.tempo) > 0 ? Number(song.tempo) : null,
        ...(anim ? { anim: estiloDeParte(anim, blockKey), momentos: anim.momentos, animCompas: anim.compas } : {}),
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
      slides.push(...songToSlides(item.id, song, item.structure, item));
    } else if (item.type === "biblia") {
      slides.push({ slideId: item.id, type: "biblia", reference: item.reference, version: item.version, text: item.text, bookId: item.bookId, bookName: item.bookName, chapter: item.chapter, verseStart: item.verseStart, verseEnd: item.verseEnd });
    } else if (esCuentaRegresiva(item)) {
      // Cuenta regresiva (2026-11-05): la hora final se le pone al proyectarla (ver conHoraFinal).
      slides.push(slideCuentaRegresiva(item));
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
  const actividadEnVivoRef = useRef(Date.now()); // último cambio de diapositiva o toque en la consola (quien transmite)
  const ultimoAvisoBaseRef = useRef(Date.now()); // última vez que quien transmite renovó updated_at en la base
  const endEventRef = useRef(null);
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
  // Lo que Multimedia tiene al aire ahora (slide_actual de la sesión en vivo) — lo usa el Modo predicar
  // del bosquejo para seguir solo al predicador por su bosquejo cuando no hay pantalla de escenario.
  const [slideAlAireRemoto, setSlideAlAireRemoto] = useState(null);
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
  // Cuentas regresivas por minutos: cuándo termina cada una (por id de diapositiva). Arrancan al ponerse al
  // aire y, si la consola se recarga, siguen donde iban.
  const [horasFinalesCuenta, setHorasFinalesCuenta] = useState(() => loadCache("cuentas_regresivas") || {});
  useEffect(() => { saveCache("cuentas_regresivas", horasFinalesCuenta); }, [horasFinalesCuenta]);
  const slidesBase = useMemo(
    () => (liveEvent ? expandirVersiculosLargos(reorganizarLetra(buildSlides(liveEvent.serviceOrder.filter((it) => !idsOcultosConsola.has(it.id)), library), formatoLetra), palabrasPorParte) : []),
    [liveEvent, library, palabrasPorParte, formatoLetra, idsOcultosConsola]
  );
  // Las cuentas regresivas con su hora final (así también las miniaturas de la consola van contando).
  const slides = useMemo(
    () => (slidesBase.some((x) => x.cuenta) ? slidesBase.map((x) => (x.cuenta ? conHoraFinal(x, { evento: liveEvent, horasFinales: horasFinalesCuenta, logoUrl: myIglesia?.logoUrl || null }) : x)) : slidesBase),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [slidesBase, horasFinalesCuenta, liveEvent?.date, liveEvent?.hora, myIglesia?.logoUrl]
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
  const current = useMemo(() => {
    const base = currentBase?.diseno ? { ...currentBase, paso: pasoDiseno } : currentBase;
    return base?.cuenta ? conHoraFinal(base, { evento: liveEvent, horasFinales: horasFinalesCuenta, logoUrl: myIglesia?.logoUrl || null }) : base;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBase, pasoDiseno, horasFinalesCuenta, liveEvent?.date, liveEvent?.hora, myIglesia?.logoUrl]);
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
  // Diapositiva a retomar tras recargar la consola en pleno culto (ver getLiveSession más abajo).
  const retomarSlideRef = useRef(null);
  useEffect(() => {
    const id = retomarSlideRef.current;
    if (!id || !slides.length) return;
    const i = slides.findIndex((s) => s.slideId === id);
    if (i === -1) { retomarSlideRef.current = null; return; } // ya no está en el orden: sigue normal
    setActiveIdx(i); // el envío a la proyección espera a que current sea esa (ver el efecto de envío)
  }, [slides]);
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
  // Arreglo (2026-11-09, "en vivo de repente se va a la primera diapositiva"): antes se recortaba
  // activeIdx con la cantidad de ELEMENTOS del orden (no de diapositivas), calculada dentro de un
  // setState que React puede correr después — quedaba en 0 o en una diapositiva anterior cualquiera.
  // Ahora se elige qué diapositiva queda al aire y se vuelve a apuntar a ella (mantenerAlAireRef):
  // la misma si lo borrado era otra cosa; si no, la que seguía (o la anterior, si era la última).
  const removeLiveSlide = (slideId) => {
    const esDeEste = (s) => !!s && (s.slideId === slideId || String(s.slideId).startsWith(`${slideId}-`) || String(s.slideId).startsWith(`${slideId}~`));
    const alAire = slides[activeIdx];
    const destino = !esDeEste(alAire) ? alAire
      : slides.slice(activeIdx + 1).find((s) => !esDeEste(s)) || slides.slice(0, activeIdx).reverse().find((s) => !esDeEste(s)) || null;
    mantenerAlAireRef.current = destino?.slideId || null;
    updateLiveOrder((o) => o.filter((item) => item.id !== slideId));
    if (!destino) setActiveIdx(0);
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
  // Cuenta regresiva al momento desde la consola (sin agregarla al Setlist).
  const startAdHocCuenta = (config) => { setAdHoc({ label: "Cuenta regresiva", slides: [slideCuentaAlMomento(config, liveEvent)] }); setAdHocIdx(0); setBlanked(false); };
  // "Reiniciar" la cuenta que está al aire (vuelve a empezar sus minutos).
  const reiniciarCuenta = () => {
    const s = current;
    if (!s?.cuenta) return;
    if (adHoc) { setAdHoc((a) => (a ? { ...a, slides: a.slides.map((x) => (x.slideId === s.slideId ? slideCuentaAlMomento({ ...x.cuenta, hasta: undefined, total: undefined }, liveEvent) : x)) } : a)); return; }
    setHorasFinalesCuenta((h) => ({ ...h, [s.slideId]: Date.now() + normalizarCuenta(s.cuenta).minutos * 60 * 1000 }));
  };
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
  const proyeccionRef = useRef(null); // la ventana de proyección abierta desde esta consola
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
  // Abre la proyección en el segundo monitor (ver lib/segundaPantalla.js, arreglo del 2026-11-08).
  // Devuelve true si la abrió. pantalla = la de destino (elegirOtraPantalla).
  const openOnOtherScreen = (pantalla) => {
    // ?igl=<slug> le dice a PublicScreen (que no tiene sesión iniciada) de qué iglesia leer la sesión
    // en vivo — ver iglesia_id_por_slug en la migración 20260930000300 y PublicScreen.jsx.
    const url = `${window.location.origin}${window.location.pathname}?screen=publico${myIglesia.slug ? `&igl=${encodeURIComponent(myIglesia.slug)}` : ""}${myIglesiaId ? `&iid=${myIglesiaId}` : ""}${codigoPantalla ? `&k=${encodeURIComponent(codigoPantalla)}` : ""}`;
    const m = medidasVentana(pantalla);
    const origen = window.location.origin;
    // Respaldo cuando no entró sola (2026-11-08): si la proyección ya está abierta con lo mismo, tocar
    // "Abrir proyección" en la CONSOLA la lleva al otro monitor y la pone en pantalla completa sin
    // recargarla — ya nadie tiene que ir a hacer clic en la pantalla del proyector.
    const abierta = proyeccionRef.current;
    let mismaUrl = false;
    try { mismaUrl = !!abierta && !abierta.closed && abierta.location.href === url; } catch { /* otra página */ }
    if (mismaUrl) {
      try { abierta.moveTo(m.x, m.y); abierta.resizeTo(m.ancho, m.alto); } catch { /* el navegador no lo deja */ }
      delegarPantallaCompleta(abierta, origen);
      abierta.focus?.();
      return true;
    }
    const popup = window.open(url, PROYECCION_WINDOW_NAME, `${PROYECCION_WINDOW_FEATURES},${m.features}`);
    if (!popup) {
      showToast("El navegador bloqueó la ventana de proyección. Permite las ventanas emergentes para esta página (ícono en la barra de direcciones) y vuelve a intentar.");
      return false;
    }
    proyeccionRef.current = popup;
    // Pantalla completa SIN tocar el proyector: la consola le pasa a la proyección el permiso del clic
    // apenas esta avisa que está lista (lib/delegarPantallaCompleta.js + el script de index.html). Si
    // igual no entró (navegador viejo, computadora muy lenta), se avisa aquí en la consola qué hacer.
    esperarListaYDelegar(popup, { origen }).then(() => {
      setTimeout(() => {
        try {
          if (popup.closed || popup.document.fullscreenElement || popup.document.webkitFullscreenElement) return;
          showToast("La proyección se abrió en la otra pantalla, pero sin pantalla completa. Toca «Abrir proyección» aquí en la consola y entra sola.", "info");
        } catch { /* ventana cerrada */ }
      }, 1500);
    });
    // Si la ventana ya estaba abierta (se reutiliza por su nombre), window.open no la mueve: se lleva al
    // segundo monitor a mano.
    try { popup.moveTo(m.x, m.y); popup.resizeTo(m.ancho, m.alto); } catch { /* el navegador no lo deja: sigue igual */ }
    // Pantalla completa pedida DESDE ACÁ (con el clic todavía activo) y EN la pantalla de destino: así
    // queda en el proyector aunque la ventana haya caído en la pantalla de la consola. Sin el parámetro
    // screen se iba a pantalla completa donde estuviera la ventana. PublicScreen mantiene su propio
    // botón de respaldo por si el navegador no lo permite.
    const requestFs = () => {
      const el = popup.document?.documentElement;
      if (!el?.requestFullscreen) return;
      el.requestFullscreen({ screen: pantalla }).catch(() => el.requestFullscreen().catch(() => {}));
    };
    try {
      if (popup.document?.readyState === "complete") requestFs();
      else popup.addEventListener("load", requestFs, { once: true });
    } catch { /* ventana de otro origen o cerrada */ }
    popup.focus?.();
    return true;
  };
  const startPresentation = async () => {
    if (!("getScreenDetails" in window)) {
      showToast(motivoSinSegundaPantalla({ soportado: false }));
      return;
    }
    let detalles = screenDetailsRef.current;
    let otra = elegirOtraPantalla(detalles);
    if (!otra) {
      // La lista guardada puede estar vieja (proyector conectado después de abrir la página, o el permiso
      // recién concedido): se vuelve a preguntar antes de decir que no hay segunda pantalla.
      try {
        detalles = await window.getScreenDetails();
        screenDetailsRef.current = detalles;
        otra = elegirOtraPantalla(detalles);
      } catch {
        showToast(motivoSinSegundaPantalla({ permisoDenegado: true }));
        return;
      }
    }
    if (!otra) {
      showToast(motivoSinSegundaPantalla({ extendido: typeof window.screen?.isExtended === "boolean" ? window.screen.isExtended : null }));
      return;
    }
    openOnOtherScreen(otra);
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
    // La ventana de proyección del segundo monitor desaparece sola (pedido de Eldin, 2026-11-08).
    if (myIglesiaId) pedirCerrarProyeccion(myIglesiaId);
    try { if (proyeccionRef.current && !proyeccionRef.current.closed) proyeccionRef.current.close(); } catch { /* ya cerrada */ }
    proyeccionRef.current = null;
    // Al cerrar la sesión, la base cambia el código de las pantallas: el enlace de este culto vence.
    clearLiveSession(myIglesiaId)
      .then(() => obtenerCodigoPantalla().then((c) => { if (c) setCodigoPantalla(c); }))
      .catch((e) => { if (!esFalloDeConexion(e)) notifyError("No se pudo cerrar la sesión en vivo", e); });
    resetMusicoLive();
  };
  endEventRef.current = endEvent;

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
  const createEvent = ({ templateId, title, dateLabel, date, hora, location, esPlantilla, ministryId = null }) => {
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
      ministryId: ministryId || null,
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
  const realEvents = events.filter((e) => !e.esPlantilla && (puedeEditarSetlist || esSupervisorViewer || isEventAssignedToMe(e, myUserId) || (e.ministryId && gruposQueLideroYo.has(e.ministryId)) || (e.serviceOrder || []).some((it) => lideraBloque(it, gruposQueLideroYo))));
  const plantillas = events.filter((e) => e.esPlantilla);
  // Agregar versículos al Setlist es de administradores, con una sola excepción: quien esté asignado
  // como encargado de un bloque de Lectura bíblica/Oración EN ESTE EVENTO puede agregar su propio
  // versículo para esa lectura, aunque no sea administrador.
  // Setlist del evento abierto: además del permiso general (rol), el líder de un grupo vinculado a este
  // evento si su grupo le da "Editar el Setlist".
  // Evento de un ministerio (Jóvenes, Damas…): su líder lo organiza como si tuviera "Organizar eventos"
  // (la base permite lo mismo: ver 20261117000000_eventos_por_ministerio.sql).
  const lideroMinisterioDelEvento = !!(selectedEvent?.ministryId && gruposQueLideroYo.has(selectedEvent.ministryId));
  const puedeGestionarEventoAbierto = puedeGestionarEventos || lideroMinisterioDelEvento;
  const puedeEditarSetlistEvento = puedeEditarSetlist || lideroMinisterioDelEvento || permisoLiderEnEvento(selectedEvent, ministries, myUserId, "editar_setlist");
  const canAddBibleReading = () => puedeEditarSetlistEvento || !!(selectedEvent?.serviceOrder || []).find(
    (it) => isBibleReadingBlock(it) && (it.encargados || []).some((m) => m.usuarioId === myUserId)
  );
  const canAddSermonPoints = () => puedeEditarSetlistEvento;
  // ---- Bosquejo del predicador (2026-11-01): quien está asignado a un bloque de Predicación (o quien
  // edita el Setlist) lo arma paso a paso; al enviarlo se vuelve diapositivas del Setlist (ver bosquejos.js).
  const puedeBosquejo = (block) => esBloquePredicacion(block) && (puedeEditarSetlistEvento || (block.encargados || []).some((m) => m.usuarioId === myUserId));
  // ---- Diapositivas del Setlist (pedido de Eldin, 2026-11-06): las slides y el bosquejo no son para
  // todos. Las ven Administrador, Supervisor, quien edita el Setlist, un rol con "ver_diapositivas" y,
  // en cada evento, quien está asignado al bloque de Multimedia o al de Predicación. Un músico no.
  const esSupervisorReal = usuariosReales.find((u) => u.id === myUserId)?.rol === "supervisor";
  const verDiapositivasSiempre = isAdminViewer || puedeEditarSetlistEvento || esSupervisorReal || tienePermiso("ver_diapositivas");
  const verDiapositivasEvento = puedeVerDiapositivasEvento(selectedEvent, myUserId, verDiapositivasSiempre);
  // Quien puede ver las diapositivas también puede abrir el bosquejo ya enviado, solo para leerlo.
  const puedeVerBosquejo = (block) => esBloquePredicacion(block) && verDiapositivasEvento && !!selectedEvent?.bosquejos?.[block.id]?.enviadoAt;
  const bloqueBosquejo = bosquejoAbierto ? (selectedEvent?.serviceOrder || []).find((it) => it.id === bosquejoAbierto) : null;
  const bosquejoSoloLectura = !!bloqueBosquejo && !puedeBosquejo(bloqueBosquejo);
  // En vivo, el predicador ya no lo cambia (Multimedia sí puede corregir desde la consola).
  const bosquejoBloqueado = bosquejoSoloLectura || (!!bloqueBosquejo && liveEventId === selectedEventId && !puedeEditarSetlistEvento);
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
  // Eliminar el bosquejo (pedido de Eldin, 2026-11-06): solo el predicador asignado a ese bloque o un
  // administrador. Con el culto en vivo, el predicador ya no puede (igual que para editarlo).
  const puedeEliminarBosquejo = (block) => !!block && esBloquePredicacion(block) && !!selectedEvent?.bosquejos?.[block.id]
    && (isAdminViewer || ((block.encargados || []).some((m) => m.usuarioId === myUserId) && liveEventId !== selectedEventId));
  const borrarBosquejo = async () => {
    const eventoId = selectedEventId, bloqueId = bosquejoAbierto;
    const enviado = !!selectedEvent?.bosquejos?.[bloqueId]?.enviadoAt;
    const aviso = enviado ? "¿Eliminar el bosquejo? También se quitan sus diapositivas del Setlist. Esto no se puede deshacer." : "¿Eliminar el bosquejo? Esto no se puede deshacer.";
    if (!(await confirmDialog(aviso, { danger: true, textoConfirmar: "Eliminar" }))) return;
    try {
      await eliminarBosquejo(bloqueId);
      setEventsSynced((evs) => evs.map((e) => {
        if (e.id !== eventoId) return e;
        const { [bloqueId]: _borrado, ...resto } = e.bosquejos || {}; // eslint-disable-line no-unused-vars
        return { ...e, bosquejos: resto };
      }));
      if (enviado) updateOrder((o) => quitarBosquejoDelOrden(o, bloqueId));
      setBosquejoAbierto(null);
      showToast("Bosquejo eliminado.", "info");
    } catch (err) {
      notifyError("No se pudo eliminar el bosquejo", err);
    }
  };
  const bosquejoInfo = { puede: puedeBosquejo, puedeVer: puedeVerBosquejo, abrir: setBosquejoAbierto, bosquejos: selectedEvent?.bosquejos || {} };

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

  // ---- Cuenta regresiva al aire (2026-11-05): la de minutos arranca al ponerse al aire; con "pasar sola a
  // lo que sigue", al llegar a cero la consola avanza. Solo en el dispositivo que lleva la transmisión. ----
  useEffect(() => {
    const alAire = fijada || currentBase;
    // Las lanzadas al momento (adHoc) ya traen su hora final; las del Setlist arrancan aquí (o vuelven a
    // empezar si ya habían terminado).
    if (!llevoLaTransmision || !alAire?.cuenta || adHoc) return;
    setHorasFinalesCuenta((h) => arrancarSiHaceFalta(h, { ...alAire, cuenta: { ...alAire.cuenta, hasta: undefined } }, liveEvent));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llevoLaTransmision, fijada?.slideId, currentBase?.slideId]);
  useEffect(() => {
    const alAire = fijada ? null : current;
    const hasta = alAire?.cuenta?.hasta;
    if (!llevoLaTransmision || !hasta || alAire.cuenta.alTerminar !== "avanzar") return;
    const id = alAire.slideId;
    const t = setTimeout(() => {
      if (adHoc) { if (adHocIdx >= adHocSlides.length - 1) exitAdHoc(); else goto(adHocIdx + 1); return; }
      if (slides[activeIdx]?.slideId === id && activeIdx < slides.length - 1) goto(activeIdx + 1);
    }, Math.max(0, hasta - Date.now()) + 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llevoLaTransmision, current?.slideId, current?.cuenta?.hasta, fijada, activeIdx, adHocIdx]);

  // ---- Control del video desde la consola (2026-11-08): play, pausa, detener, saltar y sonido sin tocar
  // la pantalla de proyección. Viaja en slide_actual.video (ver lib/videoControl.js); la pantalla reporta
  // en qué segundo va y si el navegador le bloqueó el sonido (escucharEstadoVideo). ----
  const alAireVideo = (() => { const a = fijada || current || null; return a && esVideoSolo(a) ? a : null; })();
  const [controlVideo, setControlVideo] = useState(null);
  const [estadoVideoPantalla, setEstadoVideoPantalla] = useState(null);
  const idVideoAlAire = alAireVideo ? `${alAireVideo.slideId}|${alAireVideo.videoUrl}` : null;
  // Cada video que sale al aire arranca solo, desde el inicio y con sonido.
  useEffect(() => { setControlVideo(idVideoAlAire ? controlInicial() : null); setEstadoVideoPantalla(null); }, [idVideoAlAire]);
  const controlarVideo = (accion) => setControlVideo((c) => aplicarAccion(c, accion, { duracion: estadoVideoPantalla?.duracion || null }));
  useEffect(() => {
    if (!myIglesiaId || !idVideoAlAire || practica) return undefined;
    const slideId = alAireVideo?.slideId;
    return escucharEstadoVideo(myIglesiaId, codigoPantalla, (e) => { if (!e.slideId || e.slideId === slideId) setEstadoVideoPantalla({ ...e, recibido: Date.now() }); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myIglesiaId, codigoPantalla, idVideoAlAire, practica]);

  useEffect(() => {
    if (practica || (!liveEventId && !liveLibre) || userId !== liveOwnerId) return;
    // Recién recargada: no manda nada hasta estar de vuelta en la diapositiva que estaba al aire (así la
    // proyección no muestra la primera ni un instante).
    if (retomarSlideRef.current) {
      if (!slides.length || (current?.slideId ?? null) !== retomarSlideRef.current) return;
      retomarSlideRef.current = null;
    }
    const alAireBase = (fijada || current) || null;
    const alAire = alAireBase && controlVideo && esVideoSolo(alAireBase) ? { ...alAireBase, video: controlVideo } : alAireBase;
    const fila = { evento_id: liveEventId, liderado_por: userId, slide_actual: alAire ? (escenario ? { ...alAire, escenario } : alAire) : null, blanked, estilo_en_vivo: liveStyle, ad_hoc_label: adHoc?.label || null, libre: liveLibre };
    // Se manda por las dos vías a la vez: BroadcastChannel llega al instante si la pantalla de
    // proyección está en la MISMA computadora (caso típico: TV por HDMI como segunda pantalla) — así el
    // cambio de diapositiva no depende del internet del lugar, igual que un presentador local. Supabase
    // sigue siendo el camino real cuando la proyección de verdad está en otro dispositivo aparte.
    if (!myIglesiaId) return;
    filaAlAireRef.current = fila;
    actividadEnVivoRef.current = Date.now(); ultimoAvisoBaseRef.current = Date.now();
    broadcastLiveSession(myIglesiaId, fila);
    enviarAPantallas(myIglesiaId, codigoPantalla, fila);
    // Sin internet (2026-10-17): la pantalla en ESTA computadora ya recibió el cambio por el canal local,
    // así que la falla de internet no se avisa en cada diapositiva (asustaba sin razón). Se anota como
    // pendiente y se manda solo apenas vuelve la señal (ver el efecto de "online" justo abajo).
    updateLiveSession(myIglesiaId, fila)
      .then(() => { sincroPendienteRef.current = false; })
      .catch((e) => { if (esFalloDeConexion(e) || e?.sinSesion) sincroPendienteRef.current = true; else notifyError("No se pudo actualizar la proyección", e); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, blanked, liveStyle, liveEventId, liveLibre, liveOwnerId, adHoc, userId, myIglesiaId, practica, fijada, escenarioClave, codigoPantalla, controlVideo]);
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
    // También cuando la sesión se renueva sola (la laptop se despertó con la sesión vencida y el cambio
    // quedó pendiente, ver updateLiveSession en lib/liveSession.js).
    // (setTimeout: supabase-js se traba si se le hace otra petición desde dentro de este aviso.)
    const subAuth = supabase.auth?.onAuthStateChange?.((evento) => {
      if (evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN") setTimeout(alVolver, 0);
    })?.data;
    return () => { quitarRespuesta(); window.removeEventListener("online", alVolver); subAuth?.subscription?.unsubscribe(); };
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
        // Si la consola se recargó en pleno culto (F5, el navegador se cerró…) y la transmisión era de
        // esta persona, vuelve a la diapositiva que estaba al aire en vez de a la primera (2026-11-09).
        if (fila?.liderado_por && fila.liderado_por === userIdRef.current && fila.evento_id && fila.slide_actual?.slideId) {
          const id = fila.slide_actual.slideId;
          retomarSlideRef.current = id;
          // Por si el evento no termina de cargar (sin internet, borrado): no frena la consola para siempre.
          setTimeout(() => { if (retomarSlideRef.current === id) retomarSlideRef.current = null; }, 15000);
        }
        setLiveEventId(fila?.evento_id || null); setLiveOwnerId(fila?.liderado_por || null); setLiveLibre(!!fila?.libre);
        setSlideAlAireRemoto(fila?.slide_actual || null);
        adoptarEstiloGuardado(fila?.estilo_en_vivo);
      })
      .catch(() => {});
    const unsubscribe = subscribeLiveSession(myIglesiaId, (fila) => {
      setLiveEventId(fila.evento_id || null);
      setLiveOwnerId(fila.liderado_por || null);
      setLiveLibre(!!fila.libre);
      setSlideAlAireRemoto(fila.slide_actual || null);
      // Solo si lo cambió OTRO dispositivo: quien transmite ya tiene su estilo, y adoptar su propio eco
      // volvería a disparar el envío de la sesión.
      if (fila.liderado_por !== userIdRef.current) adoptarEstiloGuardado(fila.estilo_en_vivo);
    });
    return unsubscribe;
  }, [myIglesiaId]);

  // ---- Cierre por inactividad (pedido de Eldin, 2026-11-07): si una iglesia no finaliza su en vivo,
  // se cierra solo después de LIVE_SESSION_STALE_MS sin actividad — revisando cada minuto mientras la
  // app esté abierta, no solo al abrirla (la compu del culto suele quedarse prendida con la consola).
  // - Quien transmite: cuenta como actividad cambiar de diapositiva/estilo o tocar la consola. Si alguien
  //   la está tocando sin cambiar de diapositiva, renueva updated_at en la base cada 10 min, para que
  //   ningún otro dispositivo la dé por abandonada.
  // - Los demás: si la fila en la base lleva 2 horas sin cambios (ej. la compu de Multimedia se apagó sin
  //   finalizar), la cierran. Solo Multimedia/admin puede escribir (RLS): para el resto falla en silencio.
  const transmitiendoAqui = (!!liveEventId || liveLibre) && !practica && !!userId && userId === liveOwnerId;
  // Mientras esta computadora transmite (o practica), una versión nueva de la app NO la recarga: antes
  // la consola volvía sola a la primera diapositiva en pleno culto. Se aplica al terminar (lib/swUpdate.js).
  useEffect(() => { pausarActualizacion(transmitiendoAqui || enPractica); }, [transmitiendoAqui, enPractica]);
  const hayEnVivo = !!liveEventId || liveLibre;
  useEffect(() => {
    if (!transmitiendoAqui) return undefined;
    actividadEnVivoRef.current = Date.now();
    const alTocar = () => {
      actividadEnVivoRef.current = Date.now();
      if (Date.now() - ultimoAvisoBaseRef.current < LIVE_SESSION_TOUCH_MS || !filaAlAireRef.current || !myIglesiaId) return;
      ultimoAvisoBaseRef.current = Date.now();
      updateLiveSession(myIglesiaId, filaAlAireRef.current).catch(() => {});
    };
    const revisar = () => {
      if (Date.now() - actividadEnVivoRef.current < LIVE_SESSION_STALE_MS) return;
      endEventRef.current?.();
      showToast("El en vivo se cerró solo después de 2 horas sin actividad.", "info");
    };
    window.addEventListener("pointerdown", alTocar);
    window.addEventListener("keydown", alTocar);
    const intervalo = setInterval(revisar, LIVE_SESSION_CHECK_MS);
    return () => { window.removeEventListener("pointerdown", alTocar); window.removeEventListener("keydown", alTocar); clearInterval(intervalo); };
  }, [transmitiendoAqui, myIglesiaId]);
  useEffect(() => {
    if (!hayEnVivo || transmitiendoAqui || !myIglesiaId) return undefined;
    const revisar = () => {
      getLiveSession(myIglesiaId).then((fila) => {
        const abandonada = (fila?.evento_id || fila?.libre) && fila?.updated_at && (Date.now() - new Date(fila.updated_at).getTime() > LIVE_SESSION_STALE_MS);
        if (abandonada) clearLiveSession(myIglesiaId).catch(() => {});
      }).catch(() => {});
    };
    const intervalo = setInterval(revisar, 5 * LIVE_SESSION_CHECK_MS);
    return () => clearInterval(intervalo);
  }, [hayEnVivo, transmitiendoAqui, myIglesiaId]);

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
    <div className="app-shell-height" style={{ fontFamily: "var(--wf-font-ui)", background: "var(--wf-bg)", color: "var(--wf-text)", display: "flex", flexDirection: "column", position: "relative", overflowX: "hidden" }}>
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
        @media (hover: hover) and (pointer: fine) { .thumb:hover { transform: translateY(-2px); } }
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
            <div style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 17, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
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
            <span style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 19, fontWeight: 600, color: "var(--wf-on-brand-primary)" }}>WorshipFlow</span>
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
          eventos={events.filter((e) => !e.esPlantilla && e.ministryId === selectedMinistryId)}
          puedeCrearEventos={puedeGestionarEventos || gruposQueLideroYo.has(selectedMinistryId)}
          onCrearEvento={(datos) => { createEvent(datos); setTab("eventos"); }}
          onAbrirEvento={(id) => { setTab("eventos"); setSelectedEventId(id); }}
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
        <ConPlan funcion="importar" onCerrar={() => setImportandoPdf(false)}>
        <ImportarCancionesPdf library={library} clasificaciones={clasificaciones} iglesiaId={myIglesiaId} userId={userId}
          onCerrar={() => setImportandoPdf(false)} onImportadas={() => reloadLibrary()} />
        </ConPlan>
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
        <EventList events={realEvents} plantillas={plantillas} isAdminViewer={puedeGestionarEventos} liveEventId={liveEventId} liveLibre={liveLibre} onSelect={setSelectedEventId} onCreate={createEvent} canStartLive={canStartLive} onStartFree={startFreeEvent} library={library} myUserId={myUserId} ministries={ministries} gruposQueLidero={gruposQueLideroYo} />
      )}

      {tab === "eventos" && selectedEvent && !openSong && (
        <EventDetail
          onAbrirEditor={(itemId) => abrirEditorDiap(selectedEvent.id, itemId, 0)}
          onDisenarNueva={(despuesDe) => abrirEditorNuevo(selectedEvent.id, typeof despuesDe === "string" ? despuesDe : null)}
          myIglesiaId={myIglesiaId}
          event={selectedEvent} library={library} ministries={ministries} isCompact={isCompact}
          isLive={selectedEvent.id === liveEventId} canStartLive={canStartLive} isAdminViewer={puedeGestionarEventoAbierto}
          puedeEditarSetlist={puedeEditarSetlistEvento}
          userId={myUserId} usuariosReales={usuariosReales}
          onBack={() => window.history.back()}
          isDraftFromTemplate={selectedEvent.id === draftFromTemplateId}
          onPublish={() => { setDraftFromTemplateId(null); window.history.back(); }}
          onStart={() => startEvent(selectedEvent.id)} onPracticar={() => empezarPractica(selectedEvent.id)} onGoLive={() => setTab("envivo")} onDelete={deleteEvent}
          onAddSong={addSong} onAddSeccion={addSeccion}
          onAddBibleClick={() => setShowBibleForm(true)} onAddSlideClick={() => setShowSlideForm(true)} onAddItems={(items) => updateOrder((o) => colocar(o, items))}
          onAddCuenta={(config) => updateOrder((o) => { const it = itemCuentaRegresiva(nextId(), config); return destinoSetlist ? colocar(o, [it]) : [it, ...o]; })}
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
          bosquejoInfo={bosquejoInfo} verDiapositivas={verDiapositivasEvento}
        />
      )}
      {tab === "eventos" && selectedEvent && bloqueBosquejo && (puedeBosquejo(bloqueBosquejo) || puedeVerBosquejo(bloqueBosquejo)) && (
        <ConPlan funcion="bosquejo" onCerrar={() => setBosquejoAbierto(null)}>
        <BosquejoWizard
          key={bloqueBosquejo.id}
          inicial={selectedEvent.bosquejos?.[bloqueBosquejo.id]}
          tituloBloque={bloqueBosquejo.title} tituloEvento={selectedEvent.title}
          bloqueado={bosquejoBloqueado} soloLectura={bosquejoSoloLectura}
          onEliminar={puedeEliminarBosquejo(bloqueBosquejo) ? borrarBosquejo : null}
          vivo={{ serviceOrder: selectedEvent.serviceOrder || [], bloqueId: bloqueBosquejo.id, enVivo: liveEventId === selectedEvent.id, slideAlAire: slideAlAireRemoto }}
          onGuardar={guardarBorradorBosquejo} onEnviar={enviarBosquejo}
          onClose={() => setBosquejoAbierto(null)}
          BibliaSelector={BibleBrowserBody}
        />
        </ConPlan>
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
            adHoc={adHocVista} onExitAdHoc={exitAdHoc} onStartAdHocBible={startAdHocBible} onStartAdHocSong={startAdHocSong} onStartAdHocVideo={startAdHocVideo} onStartAdHocCuenta={startAdHocCuenta} onReiniciarCuenta={reiniciarCuenta} eventoInfo={liveEvent}
            controlVideo={controlVideo} estadoVideo={estadoVideoPantalla} onControlVideo={controlarVideo}
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
        <div data-tour="nav" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 2, background: "var(--wf-brand-primary)", borderRadius: 24, padding: 6, boxShadow: "0 10px 30px rgba(22,50,79,0.28)", maxWidth: "94vw", overflowX: "auto" }}>
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
                <Icon size={19} color={active ? "var(--wf-on-brand-accent)" : "color-mix(in srgb, var(--wf-on-brand-primary) 80%, transparent)"} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 600, letterSpacing: 0, color: active ? "var(--wf-on-brand-accent)" : "color-mix(in srgb, var(--wf-on-brand-primary) 60%, transparent)" }}>{label}</span>
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
