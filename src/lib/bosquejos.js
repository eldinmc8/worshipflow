import { supabase } from "./supabaseClient.js";
import { finDeBloque } from "./ordenCulto.js";

// Bosquejo del predicador (pedido de Eldin, 2026-11-01). Quien está ASIGNADO a un bloque de Predicación
// arma su bosquejo paso a paso: título del sermón → cita base → introducción/idea central → puntos con
// versículos. Se guarda como borrador en la tabla bosquejos (aparte del Setlist, así el guardado del
// Setlist completo nunca lo pisa) y, al "Enviar a Multimedia", se convierte en diapositivas reales del
// Setlist justo después del bloque, marcadas con bosquejoDe = id del bloque (la base solo deja al
// predicador tocar las diapositivas con SU marca — ver migración 20261103000000_bosquejo_predicador.sql).

// Mismo criterio (por título) que wf_es_titulo_predicacion en la base (ver predicacion.js).
export { REGEX_PREDICACION, esBloquePredicacion } from "./predicacion.js";

export function bosquejoVacio() {
  return { titulo: "", citaBase: null, ideaCentral: "", mostrarIdea: false, puntos: [], conclusiones: [], enviadoAt: null, updatedAt: null };
}

export function nuevoPunto(id = crypto.randomUUID()) {
  return { id, titulo: "", nota: "", versiculos: [], subpuntos: [] };
}

// Subpuntos (pedido de Eldin, 2026-11-06): cada punto puede tener A, B, C… con su título, sus ideas
// (una por línea, sin formato que aprender — solo las ve el predicador) y sus versículos.
export function nuevoSubpunto(id = crypto.randomUUID()) {
  return { id, titulo: "", ideas: "", versiculos: [] };
}
export const letraSubpunto = (k) => String.fromCharCode(65 + (k % 26)); // 0 → A, 1 → B…
export const ideasDe = (texto) => String(texto || "").split("\n").map((l) => l.replace(/^\s*[•·\-*]\s*/, "").trim()).filter(Boolean);

// Lo mínimo para enviarlo: un título.
export function bosquejoListoParaEnviar(b) {
  return !!(b && b.titulo && b.titulo.trim());
}

// ¿Cambió algo desde la última vez que se mandó a Multimedia?
export function bosquejoTieneCambiosSinEnviar(b) {
  if (!b || !b.enviadoAt) return false;
  return !!b.updatedAt && new Date(b.updatedAt).getTime() > new Date(b.enviadoAt).getTime() + 1000;
}

function filaABosquejo(row) {
  return {
    titulo: row.titulo || "",
    citaBase: row.cita_base || null,
    ideaCentral: row.idea_central || "",
    mostrarIdea: !!row.mostrar_idea,
    puntos: Array.isArray(row.puntos) ? row.puntos : [],
    conclusiones: Array.isArray(row.conclusiones) ? row.conclusiones : [],
    enviadoAt: row.enviado_at || null,
    updatedAt: row.updated_at || null,
  };
}

// Todos los bosquejos de la iglesia (RLS ya limita a esta iglesia), agrupados por evento y bloque:
// { [eventoId]: { [bloqueId]: bosquejo } }. Si la tabla todavía no existe (la app se publicó antes de
// correr la migración), no tumba la carga de eventos: simplemente no hay bosquejos.
export async function listBosquejosPorEvento() {
  try {
    const { data, error } = await supabase.from("bosquejos").select("*");
    if (error) return {};
    const out = {};
    (data || []).forEach((row) => { (out[row.evento_id] ||= {})[row.item_servicio_id] = filaABosquejo(row); });
    return out;
  } catch {
    return {};
  }
}

export async function guardarBosquejo(eventoId, bloqueId, bosquejo, { enviado = false } = {}) {
  const ahora = new Date().toISOString();
  const fila = {
    item_servicio_id: bloqueId,
    evento_id: eventoId,
    titulo: (bosquejo.titulo || "").trim(),
    cita_base: bosquejo.citaBase || null,
    idea_central: bosquejo.ideaCentral || "",
    mostrar_idea: !!bosquejo.mostrarIdea,
    puntos: bosquejo.puntos || [],
    conclusiones: (bosquejo.conclusiones || []).map((c) => String(c || "").trim()).filter(Boolean),
    updated_at: ahora,
    ...(enviado ? { enviado_at: ahora } : {}),
  };
  const { data, error } = await supabase.from("bosquejos").upsert(fila).select().single();
  if (error) throw error;
  return filaABosquejo(data);
}

// Borra el bosquejo de un bloque (pedido de Eldin, 2026-11-06). Las diapositivas que ya se habían
// enviado al Setlist las quita quien llama (ver quitarBosquejoDelOrden).
export async function eliminarBosquejo(bloqueId) {
  const { error } = await supabase.from("bosquejos").delete().eq("item_servicio_id", bloqueId);
  if (error) throw error;
}

export function quitarBosquejoDelOrden(orden, bloqueId) {
  return (orden || []).filter((it) => it.bosquejoDe !== bloqueId);
}

// Un versículo elegido en el selector de Biblia → ítem "biblia" del Setlist.
// bosquejoPunto (1, 2, 3…): de qué punto del bosquejo es; la pantalla de escenario lo usa para mostrarle
// al predicador su nota privada y "Punto 2 de 4".
// marcas extra: { bosquejoSub: 1, 2… (subpunto A, B…) } o { bosquejoConclusion: 1, 2… }.
function versiculoAItem(v, bloqueId, nuevoId, punto = null, marcas = {}) {
  return {
    id: nuevoId(), type: "biblia", reference: v.ref, version: v.version, text: v.text,
    bookId: v.bookId, bookName: v.bookName, chapter: v.chapter, verseStart: v.verseStart, verseEnd: v.verseEnd,
    bosquejoDe: bloqueId, ...(punto ? { bosquejoPunto: punto } : {}), ...marcas,
  };
}

function textoAItem(titulo, subtitulo, bloqueId, nuevoId, punto = null, marcas = {}) {
  return { id: nuevoId(), type: "slide", title: titulo, subtitle: subtitulo || "", bg: "#1B2029", bgType: "color", isSermonPoint: true, bosquejoDe: bloqueId, ...(punto ? { bosquejoPunto: punto } : {}), ...marcas };
}

// El bosquejo → diapositivas, en el orden en que se predica:
// título (con la cita de subtítulo) → cita base → idea central (si se pidió mostrarla) → cada punto → sus
// versículos → cada subpunto ("Punto 1 · A") → sus versículos → las conclusiones.
// La nota de cada punto y las ideas de cada subpunto son solo para el predicador: nunca se proyectan.
export function bosquejoAItems(bosquejo, bloqueId, nuevoId = () => crypto.randomUUID()) {
  if (!bosquejoListoParaEnviar(bosquejo)) return [];
  const items = [textoAItem(bosquejo.titulo.trim(), bosquejo.citaBase?.ref || "", bloqueId, nuevoId)];
  if (bosquejo.citaBase?.text) items.push(versiculoAItem(bosquejo.citaBase, bloqueId, nuevoId));
  if (bosquejo.mostrarIdea && bosquejo.ideaCentral?.trim()) items.push(textoAItem(bosquejo.ideaCentral.trim(), "", bloqueId, nuevoId));
  (bosquejo.puntos || []).forEach((p, i) => {
    const titulo = (p.titulo || "").trim();
    if (titulo) items.push(textoAItem(titulo, `Punto ${i + 1}`, bloqueId, nuevoId, i + 1));
    (p.versiculos || []).forEach((v) => { if (v?.text) items.push(versiculoAItem(v, bloqueId, nuevoId, i + 1)); });
    (p.subpuntos || []).forEach((s, k) => {
      const marcas = { bosquejoSub: k + 1 };
      const tituloSub = (s.titulo || "").trim();
      if (tituloSub) items.push(textoAItem(tituloSub, `Punto ${i + 1} · ${letraSubpunto(k)}`, bloqueId, nuevoId, i + 1, marcas));
      (s.versiculos || []).forEach((v) => { if (v?.text) items.push(versiculoAItem(v, bloqueId, nuevoId, i + 1, marcas)); });
    });
  });
  const conclusiones = (bosquejo.conclusiones || []).map((c) => String(c || "").trim()).filter(Boolean);
  conclusiones.forEach((c, k) => {
    items.push(textoAItem(c, conclusiones.length > 1 ? `Conclusión ${k + 1}` : "Conclusión", bloqueId, nuevoId, null, { bosquejoConclusion: k + 1 }));
  });
  return items;
}

// Reemplaza en el orden del culto las diapositivas de una versión anterior del bosquejo de este bloque
// por las nuevas, al final del bloque de Predicación (después de lo que ya tenga, ej. un video que
// Multimedia agregó). No modifica `orden`.
export function aplicarBosquejoAlOrden(orden, bloqueId, items) {
  const sinViejas = (orden || []).filter((it) => it.bosquejoDe !== bloqueId);
  const fin = finDeBloque(sinViejas, bloqueId);
  if (fin === -1) return sinViejas;
  return [...sinViejas.slice(0, fin), ...items, ...sinViejas.slice(fin)];
}

// ---------- Modo predicar (pedido de Eldin, 2026-11-06) ----------
// Para cuando no hay pantalla de escenario: el predicador sigue su bosquejo en su celular, paso por paso.
// Pasos: inicio (título + cita base) → idea central (si la escribió; el predicador la ve aunque no se
// proyecte) → cada punto con algo escrito (título, nota o versículos).
// Cada subpunto es su propio paso (punto 1 → 1A → 1B → punto 2…) y las conclusiones van juntas al final.
export function pasosPredicar(b) {
  if (!b) return [];
  const pasos = [{ tipo: "inicio" }];
  if ((b.ideaCentral || "").trim()) pasos.push({ tipo: "idea" });
  (b.puntos || []).forEach((p, i) => {
    const subs = (p.subpuntos || []).map((s, k) => ({ s, k })).filter(({ s }) => (s.titulo || "").trim() || ideasDe(s.ideas).length || (s.versiculos || []).length);
    if ((p.titulo || "").trim() || (p.nota || "").trim() || (p.versiculos || []).length || subs.length) pasos.push({ tipo: "punto", i });
    subs.forEach(({ k }) => pasos.push({ tipo: "sub", i, k }));
  });
  if ((b.conclusiones || []).some((c) => String(c || "").trim())) pasos.push({ tipo: "conclusion" });
  return pasos;
}

// ¿En qué paso va lo que Multimedia tiene al aire? Mismo criterio de ids que la consola (perteneceA):
// "<id>", "<id>-…" o "<id>~…". -1 si lo que está al aire no es de este bosquejo.
export function pasoAlAire(pasos, serviceOrder, bloqueId, slide, bosquejo = null) {
  if (!slide || !bloqueId) return -1;
  const sid = String(slide.slideId || slide.id || "");
  const item = (serviceOrder || []).find((it) => it.bosquejoDe === bloqueId && (sid === it.id || sid.startsWith(`${it.id}-`) || sid.startsWith(`${it.id}~`)));
  if (!item) return -1;
  if (item.bosquejoConclusion) {
    const k = pasos.findIndex((p) => p.tipo === "conclusion");
    if (k >= 0) return k;
  }
  if (item.bosquejoPunto && item.bosquejoSub) {
    const k = pasos.findIndex((p) => p.tipo === "sub" && p.i === item.bosquejoPunto - 1 && p.k === item.bosquejoSub - 1);
    if (k >= 0) return k;
  }
  const punto = item.bosquejoPunto || Number(/^Punto (\d+)$/.exec(item.subtitle || "")?.[1]) || null;
  if (punto) {
    const k = pasos.findIndex((p) => p.tipo === "punto" && p.i === punto - 1);
    if (k >= 0) return k;
  }
  const idea = (bosquejo?.ideaCentral || "").trim();
  if (idea && item.type === "slide" && (item.title || "").trim() === idea) {
    const k = pasos.findIndex((p) => p.tipo === "idea");
    if (k >= 0) return k;
  }
  return 0;
}
