import { supabase } from "./supabaseClient.js";

// Misma cola por-clave que en lib/eventos.js: evita que dos sincronizaciones del mismo ministerio
// (ej. dos clics rápidos en "Agregar semana") se pisen entre sí (cada una borra-todo-y-reinserta).
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
    resources: recursos.map((r) => ({ id: r.id, title: r.titulo, link: r.enlace || "" })),
  };
}

export async function listMinisteriosCompletos() {
  const filas = await listMinisterios();
  const completos = await Promise.all(filas.map((f) => getMinisterioCompleto(f.id)));
  return completos.map(ministerioCompletoAFormatoEditor);
}

export async function crearMinisterio({ id, name, leaderId, color }, userId) {
  const { error } = await supabase.from("ministerios").insert({ id, nombre: name, lider_id: leaderId || null, color, creado_por: userId });
  if (error) throw error;
}

export async function actualizarLiderMinisterio(id, leaderId) {
  const { error } = await supabase.from("ministerios").update({ lider_id: leaderId || null }).eq("id", id);
  if (error) throw error;
}

export async function eliminarMinisterio(id) {
  const { error } = await supabase.from("ministerios").delete().eq("id", id);
  if (error) throw error;
}

async function sincronizarPlanInterno(ministerioId, plan) {
  const { error: delErr } = await supabase.from("planificacion_ministerio").delete().eq("ministerio_id", ministerioId);
  if (delErr) throw delErr;
  if (!plan.length) return;
  const filas = plan.map((p, i) => ({ id: p.id, ministerio_id: ministerioId, fecha: p.date || null, titulo: p.title || null, detalle: p.detail || null, orden: i }));
  const { error } = await supabase.from("planificacion_ministerio").insert(filas);
  if (error) throw error;
}
export function sincronizarPlan(ministerioId, plan) {
  return encolar(`plan:${ministerioId}`, () => sincronizarPlanInterno(ministerioId, plan));
}

async function sincronizarRecursosInterno(ministerioId, resources) {
  const { error: delErr } = await supabase.from("recursos_ministerio").delete().eq("ministerio_id", ministerioId);
  if (delErr) throw delErr;
  if (!resources.length) return;
  const filas = resources.map((r, i) => ({ id: r.id, ministerio_id: ministerioId, titulo: r.title, enlace: r.link || null, orden: i }));
  const { error } = await supabase.from("recursos_ministerio").insert(filas);
  if (error) throw error;
}
export function sincronizarRecursos(ministerioId, resources) {
  return encolar(`recursos:${ministerioId}`, () => sincronizarRecursosInterno(ministerioId, resources));
}
