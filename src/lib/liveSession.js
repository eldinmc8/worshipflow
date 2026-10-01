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

export function clearLiveSession(iglesiaId) {
  return updateLiveSession(iglesiaId, { evento_id: null, liderado_por: null, slide_actual: null, blanked: false, estilo_en_vivo: null, ad_hoc_label: null, libre: false });
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
  const listener = (e) => onChange(e.data);
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
}
