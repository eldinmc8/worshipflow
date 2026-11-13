import { supabase } from "./supabaseClient.js";
import { perteneceA } from "./escenario.js";

// Control remoto de las diapositivas desde el celular (pedido de Eldin, 2026-11-13).
//
// El celular manda ÓRDENES (tabla comandos_en_vivo, ver la migración 20261118000000_control_remoto.sql)
// y la computadora que lleva la transmisión las recibe por Realtime y las ejecuta como si hubieran tocado
// su teclado. Dos formas de usarlo:
//  * Multimedia desde su celular: siguiente, anterior, pantalla en negro e ir a una parte del culto.
//  * El predicador desde el Modo Predicar: siguiente y anterior, solo dentro de SU bosquejo mientras
//    está al aire (la base revisa que predique en ese bloque; la computadora, que esté al aire).
// Nunca se inicia ni se termina la transmisión desde aquí.

export const ACCIONES = ["siguiente", "anterior", "negro", "ir_item"];

// Celular → orden. bloqueId solo lo manda el predicador (su bloque de Predicación).
export async function mandarComando({ accion, itemId = null, bloqueId = null }) {
  if (!ACCIONES.includes(accion)) throw new Error("Orden desconocida.");
  const { error } = await supabase.from("comandos_en_vivo").insert({ accion, item_id: itemId, bloque_id: bloqueId });
  if (error) {
    const e = new Error(/row-level security|42501/i.test(`${error.code} ${error.message}`)
      ? "No tienes permiso para mover las diapositivas ahora."
      : "No se pudo mandar. Revisa tu conexión.");
    e.causa = error;
    throw e;
  }
}

// Computadora que transmite: escucha las órdenes nuevas de su iglesia.
export function suscribirComandos(iglesiaId, onComando) {
  const canal = supabase
    .channel(`comandos_en_vivo_${iglesiaId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comandos_en_vivo", filter: `iglesia_id=eq.${iglesiaId}` }, (payload) => payload.new && onComando(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

// ¿De qué ítem del Setlist es esta diapositiva?
export function itemDeDiapositiva(serviceOrder, slide) {
  if (!slide) return null;
  return (serviceOrder || []).find((it) => it.type !== "seccion" && perteneceA(slide, it.id)) || null;
}
const delBosquejo = (serviceOrder, slide, bloqueId) => itemDeDiapositiva(serviceOrder, slide)?.bosquejoDe === bloqueId;

// Qué hace la computadora con una orden. Devuelve:
//   { tipo: "avanzar", dir: 1 | -1, soltar } · { tipo: "negro" } · { tipo: "ir", indice } · { tipo: "ignorar", motivo }
// ctx: { slides, activeIdx, adHoc, fijada, serviceOrder } — lo que la consola tiene en ese momento.
export function resolverComando(cmd, { slides = [], activeIdx = 0, adHoc = null, fijada = null, serviceOrder = [] } = {}) {
  if (!cmd || !ACCIONES.includes(cmd.accion)) return { tipo: "ignorar", motivo: "orden desconocida" };

  if (cmd.bloque_id) {
    // El predicador: solo dentro de su bosquejo, y no si Multimedia puso algo aparte o fijó la pantalla.
    if (cmd.accion !== "siguiente" && cmd.accion !== "anterior") return { tipo: "ignorar", motivo: "el predicador solo avanza o retrocede" };
    if (adHoc || fijada) return { tipo: "ignorar", motivo: "Multimedia tiene otra cosa al aire" };
    if (!delBosquejo(serviceOrder, slides[activeIdx], cmd.bloque_id)) return { tipo: "ignorar", motivo: "no está al aire su bosquejo" };
    const dir = cmd.accion === "siguiente" ? 1 : -1;
    // Dentro de una diapositiva diseñada con pasos "al clic", la consola revela el paso aunque la
    // siguiente diapositiva no sea del bosquejo: eso lo decide la consola (avanzar).
    const destino = slides[activeIdx + dir];
    if (!destino || !delBosquejo(serviceOrder, destino, cmd.bloque_id)) return { tipo: "avanzar", dir, soloPasos: true };
    return { tipo: "avanzar", dir };
  }

  if (cmd.accion === "negro") return { tipo: "negro" };
  if (cmd.accion === "ir_item") {
    const indice = slides.findIndex((s) => perteneceA(s, cmd.item_id));
    return indice === -1 ? { tipo: "ignorar", motivo: "esa parte no está en la consola" } : { tipo: "ir", indice };
  }
  return { tipo: "avanzar", dir: cmd.accion === "siguiente" ? 1 : -1, soltar: !!fijada };
}

export const TEXTO_ACCION = { siguiente: "Siguiente", anterior: "Anterior", negro: "Pantalla en negro", ir_item: "Ir a una parte" };
