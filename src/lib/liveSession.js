import { supabase } from "./supabaseClient.js";

// Sesión en vivo — UNA por iglesia (fila con iglesia_id como llave, ver migración
// 20260930000300_sesion_en_vivo_por_iglesia.sql), no una sola para toda la base. Reemplaza el
// BroadcastChannel: ahora el panel de control (Multimedia) y la pantalla de proyección pueden estar
// en dispositivos/computadoras distintas de verdad, sincronizados por Supabase Realtime en vez de
// solo dentro del mismo navegador.
//
// Todas las funciones de acá piden iglesiaId explícito — nunca lo adivinan solas — porque la
// pantalla de Proyección (PublicScreen.jsx) no tiene sesión iniciada y no puede resolverlo por su
// cuenta vía auth.uid(); lo trae de la URL (?igl=<slug>, ver iglesia_id_por_slug). El panel de
// control sí tiene sesión iniciada, pero usa el mismo camino explícito por simplicidad y simetría.

function filaVacia(iglesiaId) {
  return { iglesia_id: iglesiaId, evento_id: null, liderado_por: null, slide_actual: null, blanked: false, estilo_en_vivo: null, ad_hoc_label: null, libre: false, updated_at: null };
}

// Una iglesia nueva no tiene fila hasta su primera transmisión — no es un error, es "nada en vivo
// todavía". maybeSingle() + un valor por defecto en vez de .single() + throw, a propósito.
export async function getLiveSession(iglesiaId) {
  const { data, error } = await supabase.from("sesiones_en_vivo").select("*").eq("iglesia_id", iglesiaId).maybeSingle();
  if (error) throw error;
  return data || filaVacia(iglesiaId);
}

// El panel de control llama esto cada vez que cambia lo que se está proyectando (diapositiva,
// pantalla en negro, estilo). Upsert (no update): la primera vez que ESTA iglesia transmite algo,
// todavía no existe su fila. onConflict en iglesia_id, que es la llave primaria desde la Fase 2b.
export async function updateLiveSession(iglesiaId, patch) {
  const { error } = await supabase.from("sesiones_en_vivo").upsert({ iglesia_id: iglesiaId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "iglesia_id" });
  if (error) throw error;
}

// estilo_en_vivo NO se borra a propósito (pedido de Eldin, 2026-10-08): la tipografía, el diseño de
// la letra, el fondo, el tamaño... se quedan guardados en la fila de la iglesia para la siguiente
// transmisión, desde cualquier computadora — no hay que volver a configurarlos cada culto.
export function clearLiveSession(iglesiaId) {
  return updateLiveSession(iglesiaId, { evento_id: null, liderado_por: null, slide_actual: null, blanked: false, ad_hoc_label: null, libre: false });
}

// Se suscribe a los cambios de la sesión en vivo DE ESTA IGLESIA; llama a onChange(fila) cada vez que
// se actualiza. Devuelve una función para cancelar la suscripción (llamarla al desmontar el componente).
export function subscribeLiveSession(iglesiaId, onChange) {
  const channel = supabase
    .channel(`sesiones_en_vivo_changes_${iglesiaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "sesiones_en_vivo", filter: `iglesia_id=eq.${iglesiaId}` }, (payload) => onChange(payload.new || filaVacia(iglesiaId)))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ---- Canal directo dentro del MISMO navegador (control + proyección en la misma computadora — el
// caso típico: laptop del operador con el TV conectado por HDMI como segunda pantalla) — cambia la
// diapositiva al instante, sin pasar por internet, igual de rápido que un presentador local (tipo
// PowerPoint). Supabase Realtime arriba sigue siendo el camino real para cuando la proyección está en
// OTRO dispositivo de verdad (o si BroadcastChannel no está disponible) — ninguno de los dos casos se
// rompe, la pantalla aplica lo que le llegue primero por cualquiera de los dos caminos. El nombre del
// canal incluye la iglesia para que, si alguna vez dos iglesias comparten la misma computadora (poco
// probable, pero gratis de evitar), no se crucen sus proyecciones.
const liveBroadcastChannels = new Map();
function getLiveBroadcastChannel(iglesiaId) {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!liveBroadcastChannels.has(iglesiaId)) liveBroadcastChannels.set(iglesiaId, new BroadcastChannel(`worshipflow-live-broadcast-${iglesiaId}`));
  return liveBroadcastChannels.get(iglesiaId);
}

export function broadcastLiveSession(iglesiaId, fila) {
  getLiveBroadcastChannel(iglesiaId)?.postMessage(fila);
}

export function subscribeLiveBroadcast(iglesiaId, onChange) {
  const channel = getLiveBroadcastChannel(iglesiaId);
  if (!channel) return () => {};
  const listener = (e) => { if (e.data && !e.data.__pedirEstado) onChange(e.data); };
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}

// ---- Sin internet (pedido de Eldin, 2026-10-17) ----
// Una pantalla de proyección que se abre (o se recarga) cuando NO hay internet no puede leer la sesión
// en vivo de Supabase. Le pide a la consola de la misma computadora lo que está al aire ahora mismo,
// por el mismo canal local, y la consola le responde al instante (ver responderPedidosDeEstado).
export function pedirEstadoActual(iglesiaId) {
  getLiveBroadcastChannel(iglesiaId)?.postMessage({ __pedirEstado: true });
}
export function responderPedidosDeEstado(iglesiaId, obtenerFila) {
  const channel = getLiveBroadcastChannel(iglesiaId);
  if (!channel) return () => {};
  const listener = (e) => { if (e.data?.__pedirEstado) { const fila = obtenerFila(); if (fila) channel.postMessage(fila); } };
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}

// Lo último que mostró la pantalla de proyección, guardado en ESTE dispositivo: si se recarga sin
// internet, arranca mostrando eso en vez de quedar en negro.
const CLAVE_ULTIMA_FILA = (iglesiaId) => `worshipflow_proyeccion_ultima_${iglesiaId}`;
export function guardarUltimaFila(iglesiaId, fila) {
  try { localStorage.setItem(CLAVE_ULTIMA_FILA(iglesiaId), JSON.stringify(fila)); } catch { /* sin espacio: no pasa nada */ }
}
export function leerUltimaFila(iglesiaId) {
  try { return JSON.parse(localStorage.getItem(CLAVE_ULTIMA_FILA(iglesiaId)) || "null"); } catch { return null; }
}

// ---- ¿Está abierta la pantalla de proyección? (pedido de Eldin, 2026-10-11) ----
// La consola avisa "La pantalla de proyección no está abierta" para que nadie nuevo se quede pasando
// diapositivas que nadie ve. PublicScreen se anuncia por dos caminos: un latido por BroadcastChannel
// (misma computadora, el caso típico del TV por HDMI; funciona sin internet) y presencia de Supabase
// Realtime (cuando la proyección está en OTRO dispositivo). Canal aparte del de la sesión en vivo, para
// que ese latido nunca se confunda con una diapositiva.
const nombreCanalProyeccion = (iglesiaId) => `worshipflow-proyeccion-${iglesiaId}`;
const nombrePresenciaProyeccion = (iglesiaId) => `proyeccion_presencia_${iglesiaId}`;

export function anunciarProyeccion(iglesiaId) {
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(nombreCanalProyeccion(iglesiaId)) : null;
  const latir = () => { try { bc?.postMessage({ t: Date.now() }); } catch { /* canal cerrado */ } };
  latir();
  const intervalo = setInterval(latir, 2000);
  let canal = null;
  try {
    canal = supabase.channel(nombrePresenciaProyeccion(iglesiaId), { config: { presence: { key: `pantalla-${Math.random().toString(36).slice(2)}` } } });
    canal.subscribe((estado) => { if (estado === "SUBSCRIBED") canal.track({ pantalla: true }).catch(() => {}); });
  } catch { canal = null; }
  return () => { clearInterval(intervalo); try { bc?.close(); } catch { /* ya cerrado */ } if (canal) supabase.removeChannel(canal); };
}

// onCambio(true|false) cada ~2 segundos: true si hay al menos una pantalla de proyección viva.
export function escucharProyeccion(iglesiaId, onCambio) {
  let ultimoLatido = 0;
  let remotas = 0;
  const avisar = () => onCambio(Date.now() - ultimoLatido < 6000 || remotas > 0);
  const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(nombreCanalProyeccion(iglesiaId)) : null;
  const alLatir = () => { ultimoLatido = Date.now(); avisar(); };
  bc?.addEventListener("message", alLatir);
  const intervalo = setInterval(avisar, 2000);
  let canal = null;
  try {
    canal = supabase.channel(nombrePresenciaProyeccion(iglesiaId));
    canal.on("presence", { event: "sync" }, () => {
      remotas = Object.values(canal.presenceState() || {}).flat().filter((p) => p?.pantalla).length;
      avisar();
    }).subscribe();
  } catch { canal = null; }
  return () => {
    clearInterval(intervalo);
    bc?.removeEventListener("message", alLatir);
    try { bc?.close(); } catch { /* ya cerrado */ }
    if (canal) supabase.removeChannel(canal);
  };
}

// ---- Enlace que vence (2026-11-02) ----
// Las pantallas sin sesión (proyección /p/… y escenario /e/…) ya no leen la tabla directamente: piden lo
// que está al aire con el código secreto de la iglesia (sesion_en_vivo_publica) y escuchan los cambios en
// un canal de Realtime cuyo nombre lleva ese código. El código cambia solo al finalizar la transmisión,
// así que un enlace compartido en un culto deja de servir al terminar. Ver migración
// 20261104000000_enlace_pantalla_que_vence.sql.

// Código vigente de mi iglesia (con sesión). null si la base todavía no tiene esta función.
export async function obtenerCodigoPantalla() {
  try {
    const { data, error } = await supabase.rpc("codigo_pantalla_actual");
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function renovarCodigoPantalla() {
  const { data, error } = await supabase.rpc("renovar_codigo_pantalla");
  if (error) throw error;
  return data;
}

export function esFuncionInexistente(error) {
  return error?.code === "PGRST202" || error?.code === "42883" || /could not find the function/i.test(error?.message || "");
}

// Para pantallas sin sesión: { estado: "ok", fila } · { estado: "vencido" } · { estado: "antiguo", fila }
// ("antiguo" = la base todavía no tiene el código: se lee como siempre, para no dejar pantallas en negro
// entre que se publica la app y se corre la migración). Un fallo de red se lanza como error.
export async function leerSesionPublica(iglesiaId, codigo) {
  const { data, error } = await supabase.rpc("sesion_en_vivo_publica", { p_iglesia: iglesiaId, p_codigo: codigo || null });
  if (error) {
    if (esFuncionInexistente(error)) return { estado: "antiguo", fila: await getLiveSession(iglesiaId) };
    throw error;
  }
  if (!data) return { estado: "vencido" };
  return { estado: "ok", fila: { ...filaVacia(iglesiaId), ...data } };
}

const prefijoCanalPantallas = (iglesiaId) => `pantallas_${iglesiaId}_`;
const canalesEnvio = new Map();

// Consola (quien lleva la transmisión): manda cada cambio al canal de las pantallas con el código vigente.
export function enviarAPantallas(iglesiaId, codigo, fila) {
  if (!iglesiaId || !codigo) return;
  const nombre = `${prefijoCanalPantallas(iglesiaId)}${codigo}`;
  let c = canalesEnvio.get(nombre);
  if (!c) {
    // Un código nuevo reemplaza al anterior: el canal viejo se cierra.
    for (const [n, viejo] of canalesEnvio) {
      if (n.startsWith(prefijoCanalPantallas(iglesiaId))) { supabase.removeChannel(viejo.canal); canalesEnvio.delete(n); }
    }
    c = { canal: supabase.channel(nombre, { config: { broadcast: { self: false } } }), listo: false, pendiente: null };
    canalesEnvio.set(nombre, c);
    c.canal.subscribe((estado) => {
      if (estado !== "SUBSCRIBED") return;
      c.listo = true;
      if (c.pendiente) { Promise.resolve(c.canal.send({ type: "broadcast", event: "fila", payload: c.pendiente })).catch(() => {}); c.pendiente = null; }
    });
  }
  if (c.listo) Promise.resolve(c.canal.send({ type: "broadcast", event: "fila", payload: fila })).catch(() => {});
  else c.pendiente = fila;
}

// Pantalla sin sesión: escucha los cambios del canal con su código. Devuelve la función para dejar de escuchar.
export function escucharPantallas(iglesiaId, codigo, onFila) {
  const canal = supabase
    .channel(`${prefijoCanalPantallas(iglesiaId)}${codigo}`)
    .on("broadcast", { event: "fila" }, ({ payload }) => { if (payload) onFila(payload); })
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// ---- Estado del video, de la pantalla de proyección hacia la consola (2026-11-08) ----
// La pantalla cuenta en qué segundo va, cuánto dura y si el navegador le bloqueó el sonido, para que la
// consola muestre el avance y avise "toca una vez la pantalla". Mismos dos caminos que lo demás: canal
// local (misma computadora, sin internet) y Supabase Realtime con el código (Smart TV, otro equipo).
// Tema aparte del de las filas, para no mezclar mensajes.
const nombreCanalEstadoVideo = (iglesiaId) => `worshipflow-video-estado-${iglesiaId}`;
const temaEstadoVideo = (iglesiaId, codigo) => `pantallas_estado_${iglesiaId}_${codigo}`;
const canalesEstadoVideo = new Map();

export function enviarEstadoVideo(iglesiaId, codigo, estado) {
  if (!iglesiaId || !estado) return;
  try { if (typeof BroadcastChannel !== "undefined") { const bc = new BroadcastChannel(nombreCanalEstadoVideo(iglesiaId)); bc.postMessage(estado); bc.close(); } } catch { /* sin canal local */ }
  if (!codigo) return;
  const tema = temaEstadoVideo(iglesiaId, codigo);
  let c = canalesEstadoVideo.get(tema);
  if (!c) {
    c = { canal: supabase.channel(tema, { config: { broadcast: { self: false } } }), listo: false };
    canalesEstadoVideo.set(tema, c);
    c.canal.subscribe((s) => { if (s === "SUBSCRIBED") c.listo = true; });
  }
  if (c.listo) Promise.resolve(c.canal.send({ type: "broadcast", event: "estado", payload: estado })).catch(() => {});
}

export function escucharEstadoVideo(iglesiaId, codigo, onEstado) {
  if (!iglesiaId) return () => {};
  let bc = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(nombreCanalEstadoVideo(iglesiaId));
      bc.onmessage = (e) => { if (e.data) onEstado(e.data); };
    }
  } catch { bc = null; }
  const canal = codigo
    ? supabase.channel(temaEstadoVideo(iglesiaId, codigo)).on("broadcast", { event: "estado" }, ({ payload }) => { if (payload) onEstado(payload); }).subscribe()
    : null;
  return () => { bc?.close(); if (canal) supabase.removeChannel(canal); };
}
