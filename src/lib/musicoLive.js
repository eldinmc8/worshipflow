import { supabase } from "./supabaseClient.js";

// Estado de "líder/seguidor" de Modo Músico durante una transmisión en vivo — quién lo lleva, qué
// canción/sección/tempo tiene ahora, y si el auto-avance está prendido. Vive en su PROPIA tabla (fila
// fija id=1, mismo patrón que sesiones_en_vivo) en vez de agregarse a sesiones_en_vivo a propósito: esa
// tabla solo puede escribirla el rol Multimedia (para que nadie apague la proyección real por accidente),
// pero cualquier músico necesita poder tomar el mando de Modo Músico — así que esta tabla tiene su propia
// política de escritura, más abierta, sin tocar la protección de la proyección.

export async function getMusicoLive() {
  const { data, error } = await supabase.from("musico_en_vivo").select("*").eq("id", 1).single();
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

export function updateMusicoLive(patch) {
  return encolar(async () => {
    const { error } = await supabase.from("musico_en_vivo").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw error;
  });
}

export function clearMusicoLive() {
  return updateMusicoLive({ lider_id: null, song_item_id: null, section_idx: null, bpm: null, auto: null, heartbeat: null });
}

export function subscribeMusicoLive(onChange) {
  const channel = supabase
    .channel("musico_en_vivo_changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "musico_en_vivo", filter: "id=eq.1" }, (payload) => onChange(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
