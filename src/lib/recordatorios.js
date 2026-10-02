import { supabase } from "./supabaseClient.js";
import { esperarCreacionEvento, encolar } from "./eventos.js";
import { idsABorrar, actualizarTrasGuardar } from "./lineaBase.js";

export async function listRecordatorios(eventoId) {
  const { data, error } = await supabase
    .from("recordatorios_evento")
    .select("*")
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, cantidad: r.cantidad, unidad: r.unidad, enviado: r.enviado }));
}

// Guarda los recordatorios de un evento por diferencias (ver src/lib/lineaBase.js). Antes borraba
// TODOS los del evento y reinsertaba los de este dispositivo, con dos problemas:
// - se perdían los recordatorios agregados desde otro dispositivo o el Asistente después de cargar;
// - reescribía "enviado" con el valor viejo que tenía este dispositivo: si procesar-recordatorios ya
//   lo había marcado como enviado en el servidor, volvía a quedar en false y se mandaba otra vez.
// Ahora: los recordatorios nuevos se insertan con enviado=false; los que ya existían NO se tocan (la
// app solo permite agregar o quitar, nunca editar uno existente); y se borran solo los que este
// dispositivo conocía y el usuario quitó. Usa la misma cola por evento que eventos.js.
async function sincronizarRecordatoriosInterno(eventoId, reminders) {
  await esperarCreacionEvento(eventoId);
  const clave = `recordatorios:${eventoId}`;
  const idsLocales = reminders.map((r) => r.id);
  const { data: actuales, error: selErr } = await supabase.from("recordatorios_evento").select("id").eq("evento_id", eventoId);
  if (selErr) throw selErr;
  const existentes = new Set((actuales ?? []).map((r) => r.id));
  const nuevos = reminders
    .filter((r) => !existentes.has(r.id))
    .map((r) => ({ id: r.id, evento_id: eventoId, cantidad: r.cantidad, unidad: r.unidad, enviado: false }));
  if (nuevos.length) {
    const { error } = await supabase.from("recordatorios_evento").insert(nuevos);
    if (error) throw error;
  }
  const quitados = idsABorrar(clave, idsLocales);
  if (quitados.length) {
    const { error: delErr } = await supabase.from("recordatorios_evento").delete().eq("evento_id", eventoId).in("id", quitados);
    if (delErr) throw delErr;
  }
  const { data: enBase, error: finErr } = await supabase.from("recordatorios_evento").select("id").eq("evento_id", eventoId);
  if (finErr) throw finErr;
  actualizarTrasGuardar(clave, (enBase ?? []).map((r) => r.id), idsLocales);
}
export function sincronizarRecordatorios(eventoId, reminders) {
  return encolar(`recordatorios:${eventoId}`, () => sincronizarRecordatoriosInterno(eventoId, reminders));
}
