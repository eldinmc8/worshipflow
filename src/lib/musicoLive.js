import { supabase } from "./supabaseClient.js";

// Estado de "líder/seguidor" de Modo Músico durante una transmisión en vivo — quién lo lleva, qué
// canción/sección/tempo tiene ahora, y si el auto-avance está prendido. Vive en su PROPIA tabla (una
// fila por iglesia, llave iglesia_id — ver migración 20260930000300_sesion_en_vivo_por_iglesia.sql,
// mismo patrón que sesiones_en_vivo) en vez de agregarse a sesiones_en_vivo a propósito: esa tabla
// solo puede escribirla el rol Multimedia (para que nadie apague la proyección real por accidente),
// pero cualquier músico necesita poder tomar el mando de Modo Músico — así que esta tabla tiene su propia
// política de escritura, más abierta, sin tocar la protección de la proyección.
//
// Todas las funciones de acá piden iglesiaId explícito (igual que liveSession.js) — a diferencia de
// sesiones_en_vivo, esta tabla solo la usan dispositivos con sesión iniciada (la pantalla de
// Proyección no toca Modo Músico), pero se mantiene el mismo patrón explícito por simetría y para no
// depender de auth.uid() dentro de cada llamada.

// Una iglesia nueva no tiene fila hasta el primer Modo Músico — null, no error: los llamadores ya
// tratan "sin líder" como estado normal (ver filaAMusicoState en PrototipoWorshipFlow.jsx).
export async function getMusicoLive(iglesiaId) {
  const { data, error } = await supabase.from("musico_en_vivo").select("*").eq("iglesia_id", iglesiaId).maybeSingle();
  if (error) throw error;
  return data;
}

// Dos escrituras seguidas a esta misma fila (ej. tocar "Modo Músico" y de inmediato deslizar a la
// siguiente canción) son dos peticiones HTTP independientes — sin ponerlas en fila, la segunda podía
// llegar a Postgres ANTES que la primera terminara. Como cada UPDATE solo toca las columnas que manda
// (no reescribe la fila entera), eso no perdía datos en la base — pero el eco por Realtime de una
// escritura vieja llegando DESPUÉS de una más nueva sí podía pisarle a alguien el estado que ya tenía
// aplicado localmente (ej. "acabo de ser el líder" desapareciendo al cambiar de canción). Mismo patrón
// que encolar() en src/lib/eventos.js: cada escritura espera a que la anterior termine antes de salir.
let cola = Promise.resolve();
function encolar(tarea) {
  cola = cola.then(tarea, tarea);
  return cola;
}

// Upsert (no update): la primera vez que alguien de ESTA iglesia usa Modo Músico, todavía no existe
// su fila. onConflict en iglesia_id, llave primaria desde la Fase 2b.
export function updateMusicoLive(iglesiaId, patch) {
  return encolar(async () => {
    const { error } = await supabase.from("musico_en_vivo").upsert({ iglesia_id: iglesiaId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "iglesia_id" });
    if (error) throw error;
  });
}

export function clearMusicoLive(iglesiaId) {
  return updateMusicoLive(iglesiaId, { lider_id: null, lider_nombre: null, song_item_id: null, section_idx: null, bpm: null, auto: null, heartbeat: null });
}

export function subscribeMusicoLive(iglesiaId, onChange) {
  const channel = supabase
    .channel(`musico_en_vivo_changes_${iglesiaId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "musico_en_vivo", filter: `iglesia_id=eq.${iglesiaId}` }, (payload) => onChange(payload.new || null))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
