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

// Incluye el líder de una (join) directo acá -- antes vivía en getMinisterioCompleto, una consulta
// APARTE por cada ministerio solo para traer ese dato (ver nota en listMinisteriosCompletos).
export async function listMinisterios() {
  const { data, error } = await supabase
    .from("ministerios").select("*, lider:usuarios!ministerios_lider_id_fkey(id, nombre)").order("nombre", { ascending: true });
  if (error) throw error;
  return data;
}

function agruparPor(filas, campo) {
  const out = {};
  (filas || []).forEach((f) => { (out[f[campo]] ||= []).push(f); });
  return out;
}

function ministerioCompletoAFormatoEditor({ ministerio, plan, recursos }) {
  return {
    id: ministerio.id, name: ministerio.nombre, color: ministerio.color,
    leaderId: ministerio.lider_id || null, leaderName: ministerio.lider?.nombre || "", memberCount: 0,
    plan: plan.map((p) => ({ id: p.id, date: p.fecha || "", title: p.titulo || "", detail: p.detalle || "" })),
    resources: recursos.map((r) => ({ id: r.id, title: r.titulo, link: r.enlace || "", month: r.mes })),
  };
}

// Antes pedía la lista y después UNA fila completa POR MINISTERIO (3 consultas cada una) -- mismo
// patrón (y mismo arreglo final) que listCancionesCompletas/listEventosCompletos: ninguna consulta
// filtra por una lista de ids (ver la nota larga en canciones.js sobre por qué esa lista también
// terminó siendo un problema) -- RLS ya limita todo a esta iglesia. Siempre 2 consultas en total.
export async function listMinisteriosCompletos() {
  const filas = await listMinisterios();
  if (filas.length === 0) return [];
  const [planRes, recursosRes] = await Promise.all([
    supabase.from("planificacion_ministerio").select("*").order("orden", { ascending: true }),
    supabase.from("recursos_ministerio").select("*").order("orden", { ascending: true }),
  ]);
  if (planRes.error) throw planRes.error;
  if (recursosRes.error) throw recursosRes.error;
  const planPorMinisterio = agruparPor(planRes.data, "ministerio_id");
  const recursosPorMinisterio = agruparPor(recursosRes.data, "ministerio_id");
  return filas.map((ministerio) => ministerioCompletoAFormatoEditor({
    ministerio,
    plan: planPorMinisterio[ministerio.id] || [],
    recursos: recursosPorMinisterio[ministerio.id] || [],
  }));
}

// Igual que registrarLineaBaseEventos (src/lib/eventos.js): la app lo llama cada vez que adopta
// ministerios traídos de la base, para que el guardado solo borre lo que este dispositivo conocía.
export function registrarLineaBaseMinisterios(ministerios) {
  (ministerios || []).forEach((m) => {
    fijarLineaBase(`plan:${m.id}`, (m.plan || []).map((p) => p.id));
    fijarLineaBase(`recursos:${m.id}`, (m.resources || []).map((r) => r.id));
  });
}

// Resumen mensual (texto libre) de un ministerio — se carga/guarda por mes bajo demanda desde la
// pantalla del ministerio, NUNCA como parte de listMinisteriosCompletos: meterlo ahí reintroduciría el
// mismo problema de fondo (N consultas extra en el arranque, una por ministerio) que ese refactor
// buscaba eliminar, para un dato que solo se usa de a un mes a la vez.
export async function getResumenMensual(ministerioId, mes) {
  const { data, error } = await supabase
    .from("resumen_mensual_ministerio").select("texto").eq("ministerio_id", ministerioId).eq("mes", mes).maybeSingle();
  if (error) throw error;
  return data?.texto || "";
}

export async function guardarResumenMensual(ministerioId, mes, texto) {
  const { error } = await supabase.from("resumen_mensual_ministerio").upsert(
    { ministerio_id: ministerioId, mes, texto, updated_at: new Date().toISOString() },
    { onConflict: "ministerio_id,mes" }
  );
  if (error) throw error;
}

// Archivo adjunto para un recurso de ministerio (ademas de poder pegar un enlace) — ver la migración
// 20261004000200_recursos_ministerio_storage.sql. Sin restricción de tipo (puede ser cualquier cosa:
// PDF, audio, imagen, presentación), solo de tamaño. Devuelve la URL pública, que se guarda tal cual
// en recursos_ministerio.enlace -- funciona exactamente igual que un enlace pegado a mano.
const RECURSO_MAX_BYTES = 20 * 1024 * 1024;
export async function subirArchivoRecurso(iglesiaId, file) {
  if (file.size > RECURSO_MAX_BYTES) throw new Error(`No puede pesar más de ${Math.round(RECURSO_MAX_BYTES / (1024 * 1024))} MB.`);
  const nombreLimpio = (file.name || "archivo").replace(/[^a-zA-Z0-9.\-]/g, "_").slice(-100);
  const ruta = `${iglesiaId}/${Date.now()}-${nombreLimpio}`;
  const { error } = await supabase.storage.from("recursos-ministerio").upload(ruta, file, { contentType: file.type || undefined });
  if (error) throw error;
  return supabase.storage.from("recursos-ministerio").getPublicUrl(ruta).data.publicUrl;
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
