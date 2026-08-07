import { supabase } from "./supabaseClient.js";
import { esperarCreacionEvento } from "./eventos.js";

export async function listRecordatorios(eventoId) {
  const { data, error } = await supabase
    .from("recordatorios_evento")
    .select("*")
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map((r) => ({ id: r.id, cantidad: r.cantidad, unidad: r.unidad, enviado: r.enviado }));
}

// Reemplaza TODOS los recordatorios de un evento — mismo patrón "borrar todo y reinsertar" que
// sincronizarServiceOrder/sincronizarWorshipRoles en src/lib/eventos.js: simple y confiable para el
// puñado de recordatorios que tiene un evento. OJO: hay que mandar "enviado" tal cual venía (no
// como false siempre) — si no, cada vez que se agrega/edita un recordatorio se reescribirían TODOS
// como "no enviado" y procesar-recordatorios los volvería a mandar aunque ya se hubieran enviado.
export async function sincronizarRecordatorios(eventoId, reminders) {
  await esperarCreacionEvento(eventoId);
  const { error: delErr } = await supabase.from("recordatorios_evento").delete().eq("evento_id", eventoId);
  if (delErr) throw delErr;
  if (!reminders.length) return;
  const filas = reminders.map((r) => ({
    id: r.id, evento_id: eventoId, cantidad: r.cantidad, unidad: r.unidad, enviado: !!r.enviado,
  }));
  const { error } = await supabase.from("recordatorios_evento").insert(filas);
  if (error) throw error;
}
