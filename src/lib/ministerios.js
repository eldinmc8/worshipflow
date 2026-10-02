import { supabase } from "./supabaseClient.js";
import { fijarLineaBase, idsABorrar, actualizarTrasGuardar } from "./lineaBase.js";

// Misma cola por-clave que en lib/eventos.js: evita que dos sincronizaciones del mismo ministerio
// (ej. dos clics rápidos en "Agregar semana") se pisen entre sí, y que cada una use la línea base
// que dejó la anterior.
const colas = new Map();
function encolar(key, tarea) {
  const anterior = colas.get(key) || Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  colas.set(key, siguiente.catch(() => {}));
  return siguiente;
}

export async function listMinisterios() {
  const { data, error } = await supabase.from("ministerios").select("*").order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

async function getMinisterioCompleto(id) {
  const [ministerioRes, planRes, recursosRes] = await Promise.all([
    supabase.from("ministerios").select("*, lider:usuarios!ministerios_lider_id_fkey(id, nombre)").eq("id", id).single(),
    supabase.from("planificacion_ministerio").select("*").eq("ministerio_id", id).order("orden", { ascending: true }),
    supabase.from("recursos_ministerio").select("*").eq("ministerio_id", id).order("orden", { ascending: true }),
  ]);
  if (ministerioRes.error) throw ministerioRes.error;
  if (planRes.error) throw planRes.error;
  if (recursosRes.error) throw recursosRes.error;
  return { ministerio: ministerioRes.data, plan: planRes.data, recursos: recursosRes.data };
}

function ministerioCompletoAFormatoEditor({ ministerio, plan, recursos }) {
  return {
    id: ministerio.id, name: ministerio.nombre, color: ministerio.color,
    leaderId: ministerio.lider_id || null, leaderName: ministerio.lider?.nombre || "", memberCount: 0,
    plan: plan.map((p) => ({ id: p.id, date: p.fecha || "", title: p.titulo || "", detail: p.detalle || "" })),
    resources: recursos.map((r) => ({ id: r.id, title: r.titulo, link: r.enlace || "", month: r.mes })),
  };
}

export async function listMinisteriosCompletos() {
  const filas = await listMinisterios();
  const completos = await Promise.all(filas.map((f) => getMinisterioCompleto(f.id)));
  return completos.map(ministerioCompletoAFormatoEditor);
}

// Igual que registrarLineaBaseEventos (src/lib/eventos.js): la app lo llama cada vez que adopta
// ministerios traídos de la base, para que el guardado solo borre lo que este dispositivo conocía.
export function registrarLineaBaseMinisterios(ministerios) {
  (ministerios || []).forEach((m) => {
    fijarLineaBase(`plan:${m.id}`, (m.plan || []).map((p) => p.id));
    fijarLineaBase(`recursos:${m.id}`, (m.resources || []).map((r) => r.id));
  });
}

export async function crearMinisterio({ id, name, leaderId, color }, userId) {
  const { error } = await supabase.from("ministerios").insert({ id, nombre: name, lider_id: leaderId || null, color, creado_por: userId });
  if (error) throw error;
}

export async function actualizarLiderMinisterio(id, leaderId) {
  const { error } = await supabase.from("ministerios").update({ lider_id: leaderId || null }).eq("id", id);
  if (error) throw error;
}

export async function actualizarNombreMinisterio(id, nombre) {
  const { error } = await supabase.from("ministerios").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function actualizarColorMinisterio(id, color) {
  const { error } = await supabase.from("ministerios").update({ color }).eq("id", id);
  if (error) throw error;
}

export async function eliminarMinisterio(id) {
  const { error } = await supabase.from("ministerios").delete().eq("id", id);
  if (error) throw error;
}

// Planificación y recursos se guardan por diferencias (ver src/lib/lineaBase.js): antes se borraba
// TODO lo del ministerio y se reinsertaba lo de este dispositivo, así que lo que un líder agregaba
// desde su teléfono se perdía si otro dispositivo con datos viejos guardaba después (y si el insert
// fallaba tras el borrado, el ministerio quedaba vacío).
async function sincronizarHijosMinisterio(tabla, clave, ministerioId, filas) {
  const idsLocales = filas.map((f) => f.id);
  if (filas.length) {
    const { error } = await supabase.from(tabla).upsert(filas);
    if (error) throw error;
  }
  const quitados = idsABorrar(clave, idsLocales);
  if (quitados.length) {
    const { error: delErr } = await supabase.from(tabla).delete().eq("ministerio_id", ministerioId).in("id", quitados);
    if (delErr) throw delErr;
  }
  const { data: enBase, error: selErr } = await supabase.from(tabla).select("id").eq("ministerio_id", ministerioId);
  if (selErr) throw selErr;
  actualizarTrasGuardar(clave, (enBase ?? []).map((r) => r.id), idsLocales);
}

async function sincronizarPlanInterno(ministerioId, plan) {
  const filas = plan.map((p, i) => ({ id: p.id, ministerio_id: ministerioId, fecha: p.date || null, titulo: p.title || null, detalle: p.detail || null, orden: i }));
  await sincronizarHijosMinisterio("planificacion_ministerio", `plan:${ministerioId}`, ministerioId, filas);
}
export function sincronizarPlan(ministerioId, plan) {
  return encolar(`plan:${ministerioId}`, () => sincronizarPlanInterno(ministerioId, plan));
}

async function sincronizarRecursosInterno(ministerioId, resources) {
  const filas = resources.map((r, i) => ({ id: r.id, ministerio_id: ministerioId, titulo: r.title, enlace: r.link || null, mes: r.month, orden: i }));
  await sincronizarHijosMinisterio("recursos_ministerio", `recursos:${ministerioId}`, ministerioId, filas);
}
export function sincronizarRecursos(ministerioId, resources) {
  return encolar(`recursos:${ministerioId}`, () => sincronizarRecursosInterno(ministerioId, resources));
}
