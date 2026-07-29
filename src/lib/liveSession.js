import { supabase } from "./supabaseClient.js";

// Sesión en vivo única (fila fija id=1) — reemplaza el BroadcastChannel: ahora el panel de control
// (Multimedia) y la pantalla de proyección pueden estar en dispositivos/computadoras distintas de
// verdad, sincronizados por Supabase Realtime en vez de solo dentro del mismo navegador.

export async function getLiveSession() {
  const { data, error } = await supabase.from("sesiones_en_vivo").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

// El panel de control llama esto cada vez que cambia lo que se está proyectando (diapositiva,
// pantalla en negro, estilo). Es un upsert simple sobre la única fila — sin cola: cada cambio ya
// trae el estado completo más reciente, así que si dos llegan casi juntos no importa cuál "gane".
export async function updateLiveSession(patch) {
  const { error } = await supabase.from("sesiones_en_vivo").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw error;
}

export function clearLiveSession() {
  return updateLiveSession({ evento_id: null, liderado_por: null, slide_actual: null, blanked: false, estilo_en_vivo: null, ad_hoc_label: null });
}

// Se suscribe a los cambios de la sesión en vivo; llama a onChange(fila) cada vez que se actualiza.
// Devuelve una función para cancelar la suscripción (llamarla al desmontar el componente).
export function subscribeLiveSession(onChange) {
  const channel = supabase
    .channel("sesiones_en_vivo_changes")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sesiones_en_vivo", filter: "id=eq.1" }, (payload) => onChange(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
