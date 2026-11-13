import { supabase } from "./supabaseClient.js";
import { perteneceA } from "./escenario.js";

// Control remoto de las diapositivas desde el celular (pedido de Eldin, 2026-11-13).
//
// El celular manda ÓRDENES (tabla comandos_en_vivo, ver la migración 20261118000000_control_remoto.sql)
// y la computadora que lleva la transmisión las recibe por Realtime y las ejecuta como si hubieran tocado
// su teclado. Dos formas de usarlo:
//  * Multimedia desde su celular: siguiente, anterior, pantalla en negro, ir a una parte del culto y
//    proyectar un versículo de la Biblia buscado en el celular (orden "biblia", 2026-11-13).
//  * El predicador desde el Modo Predicar: siguiente y anterior, solo dentro de SU bosquejo mientras
//    está al aire (la base revisa que predique en ese bloque; la computadora, que esté al aire).
// Nunca se inicia ni se termina la transmisión desde aquí.

export const ACCIONES = ["siguiente", "anterior", "negro", "ir_item", "biblia"];

// Versículo que viaja en una orden "biblia": solo lo que la consola necesita, y con tope de tamaño
// (lo escribe un celular; la computadora no confía en lo que llega).
const recorte = (v, max) => String(v ?? "").slice(0, max);
export function limpiarVersiculo(d) {
  if (!d || typeof d !== "object") return null;
  const ref = recorte(d.ref, 120).trim();
  const text = recorte(d.text, 6000).trim();
  if (!ref || !text) return null;
  const num = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : null);
  const bookId = num(d.bookId); const chapter = num(d.chapter); const verseStart = num(d.verseStart);
  const navegable = bookId && chapter && verseStart;
  return {
    ref, text, version: recorte(d.version, 20) || "RVR1960",
    ...(navegable ? { bookId, bookName: recorte(d.bookName, 60), chapter, verseStart, verseEnd: num(d.verseEnd) || verseStart } : {}),
  };
}

// Celular → orden. bloqueId solo lo manda el predicador (su bloque de Predicación); datos, el versículo
// de una orden "biblia".
export async function mandarComando({ accion, itemId = null, bloqueId = null, datos = null }) {
  if (!ACCIONES.includes(accion)) throw new Error("Orden desconocida.");
  const { error } = await supabase.from("comandos_en_vivo").insert({ accion, item_id: itemId, bloque_id: bloqueId, ...(datos ? { datos } : {}) });
  if (error) {
    const e = new Error(/row-level security|42501/i.test(`${error.code} ${error.message}`)
      ? "No tienes permiso para mover las diapositivas ahora."
      : "No se pudo mandar. Revisa tu conexión.");
    e.causa = error;
    throw e;
  }
}

// Computadora que transmite: escucha las órdenes nuevas de su iglesia.
//
// Dos caminos a la vez (2026-11-13: Eldin tocó "Siguiente" 20 veces desde el celular, las órdenes
// llegaron a la base y la computadora no ejecutó ninguna): Realtime, que es el rápido, y una revisión de
// la tabla cada REVISAR_MS por si Realtime no entrega (conexión que se cayó y volvió, pestaña en segundo
// plano, aviso perdido). Cada orden se ejecuta una sola vez, por el camino que llegue primero. Las que
// ya estaban en la tabla al empezar a escuchar no se ejecutan: una orden vieja no debe mover nada.
export const REVISAR_MS = 1500;
export function suscribirComandos(iglesiaId, onComando) {
  const vistos = new Set();
  let desde = null; // creado_at de la última orden conocida
  let listo = false; let vivo = true; let revisando = false;
  const entregar = (cmd) => {
    if (!vivo || !cmd?.id || vistos.has(cmd.id)) return;
    vistos.add(cmd.id);
    if (!desde || cmd.creado_at > desde) desde = cmd.creado_at;
    onComando(cmd);
  };
  const revisar = async () => {
    if (!vivo || revisando) return;
    revisando = true;
    try {
      if (!listo) {
        // Punto de partida: la orden más reciente que ya existía (no se ejecuta).
        const { data, error } = await supabase.from("comandos_en_vivo").select("id, creado_at").eq("iglesia_id", iglesiaId).order("creado_at", { ascending: false }).limit(1);
        if (!error) { listo = true; if (data?.[0]) { vistos.add(data[0].id); if (!desde || data[0].creado_at > desde) desde = data[0].creado_at; } }
      } else {
        let q = supabase.from("comandos_en_vivo").select("*").eq("iglesia_id", iglesiaId).order("creado_at", { ascending: true }).limit(20);
        if (desde) q = q.gte("creado_at", desde);
        const { data, error } = await q;
        if (!error) (data || []).forEach(entregar);
      }
    } catch { /* sin internet: se vuelve a intentar en la siguiente revisión */ }
    revisando = false;
  };
  const canal = supabase
    .channel(`comandos_en_vivo_${iglesiaId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comandos_en_vivo", filter: `iglesia_id=eq.${iglesiaId}` }, (payload) => payload.new && entregar(payload.new))
    .subscribe();
  revisar();
  const reloj = setInterval(revisar, REVISAR_MS);
  return () => { vivo = false; clearInterval(reloj); supabase.removeChannel(canal); };
}

// ¿De qué ítem del Setlist es esta diapositiva?
export function itemDeDiapositiva(serviceOrder, slide) {
  if (!slide) return null;
  return (serviceOrder || []).find((it) => it.type !== "seccion" && perteneceA(slide, it.id)) || null;
}
const delBosquejo = (serviceOrder, slide, bloqueId) => itemDeDiapositiva(serviceOrder, slide)?.bosquejoDe === bloqueId;

// Qué hace la computadora con una orden. Devuelve:
//   { tipo: "avanzar", dir: 1 | -1, soltar } · { tipo: "negro" } · { tipo: "ir", indice } ·
//   { tipo: "biblia", versiculo } · { tipo: "ignorar", motivo }
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
  if (cmd.accion === "biblia") {
    const versiculo = limpiarVersiculo(cmd.datos);
    return versiculo ? { tipo: "biblia", versiculo } : { tipo: "ignorar", motivo: "versículo incompleto" };
  }
  if (cmd.accion === "ir_item") {
    const indice = slides.findIndex((s) => perteneceA(s, cmd.item_id));
    return indice === -1 ? { tipo: "ignorar", motivo: "esa parte no está en la consola" } : { tipo: "ir", indice };
  }
  return { tipo: "avanzar", dir: cmd.accion === "siguiente" ? 1 : -1, soltar: !!fijada };
}

export const TEXTO_ACCION = { siguiente: "Siguiente", anterior: "Anterior", negro: "Pantalla en negro", ir_item: "Ir a una parte", biblia: "Versículo de la Biblia" };
