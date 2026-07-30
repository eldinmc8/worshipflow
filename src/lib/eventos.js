import { supabase } from "./supabaseClient.js";

// Algunas acciones (ej. agregar varios versículos de un rango, uno por diapositiva) pueden disparar
// varios guardados de "todo el setlist"/"todos los roles" del mismo evento casi al mismo tiempo. Como
// cada guardado borra y reinserta todo, si corrieran en paralelo el más lento podría pisar al más
// reciente. Esta cola los fuerza a correr uno por uno, por clave (evento + tipo de dato).
const colas = new Map();
function encolar(key, tarea) {
  const anterior = colas.get(key) || Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  colas.set(key, siguiente.catch(() => {}));
  return siguiente;
}

export async function listEventos() {
  const { data, error } = await supabase.from("eventos").select("*").order("fecha", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function createEvento(datos, creadoPor) {
  const { data, error } = await supabase.from("eventos").insert({ ...datos, creado_por: creadoPor }).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvento(id, datos) {
  const { error } = await supabase.from("eventos").update(datos).eq("id", id);
  if (error) throw error;
}

export async function deleteEvento(id) {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
}

export async function getEventoCompleto(id) {
  const [eventoRes, itemsRes, rolesRes] = await Promise.all([
    supabase.from("eventos").select("*").eq("id", id).single(),
    supabase.from("items_servicio").select("*, canciones(titulo, artista, tonalidad, tempo)").eq("evento_id", id).order("orden", { ascending: true }),
    supabase.from("roles_evento").select("*").eq("evento_id", id).order("orden", { ascending: true }),
  ]);
  if (eventoRes.error) throw eventoRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (rolesRes.error) throw rolesRes.error;

  const itemIds = itemsRes.data.map((it) => it.id);
  const roleIds = rolesRes.data.map((r) => r.id);
  const [encargadosRes, roleMembersRes] = await Promise.all([
    itemIds.length ? supabase.from("miembros_rol").select("*").in("item_servicio_id", itemIds).order("orden", { ascending: true }) : { data: [] },
    roleIds.length ? supabase.from("miembros_rol").select("*").in("rol_id", roleIds).order("orden", { ascending: true }) : { data: [] },
  ]);
  if (encargadosRes.error) throw encargadosRes.error;
  if (roleMembersRes.error) throw roleMembersRes.error;
  return { evento: eventoRes.data, items: itemsRes.data, encargados: encargadosRes.data, roles: rolesRes.data, roleMembers: roleMembersRes.data };
}

// ---- Setlist ----
export async function addItemServicio(eventoId, datos, orden) {
  const { error } = await supabase.from("items_servicio").insert({ evento_id: eventoId, orden, ...datos });
  if (error) throw error;
}
export async function updateItemServicio(id, patch) {
  const { error } = await supabase.from("items_servicio").update(patch).eq("id", id);
  if (error) throw error;
}
export async function removeItemServicio(id) {
  const { error } = await supabase.from("items_servicio").delete().eq("id", id);
  if (error) throw error;
}
export async function duplicateItemServicio(item, nuevoOrden) {
  const { id: _id, canciones: _rel, created_at: _c, ...resto } = item;
  const { error } = await supabase.from("items_servicio").insert({ ...resto, orden: nuevoOrden });
  if (error) throw error;
}
// Reordena moviendo un item de una posición a otra (0-based) y reescribe "orden" de todos los items.
export async function reordenarItems(items, fromIdx, toIdx) {
  const arr = [...items];
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  const updates = arr.map((it, i) => ({ id: it.id, orden: i }));
  await Promise.all(updates.map((u) => supabase.from("items_servicio").update({ orden: u.orden }).eq("id", u.id)));
}

// =====================================================================================
// Conversión entre el formato normalizado de Supabase y el formato en memoria del prototipo
// completo (events: [{id, title, dateLabel, date, location, serviceOrder}]) — así todo el
// prototipo (Setlist, En vivo, Modo Músico...) sigue funcionando igual, ahora sobre datos
// reales. La sincronización es "borrar todo lo del evento y reinsertar" (como en canciones):
// simple y confiable para el volumen de datos de un setlist/equipo de iglesia.
// =====================================================================================

function filaAItemServicio(row, encargadosPorItem) {
  const base = { id: row.id, encargados: (encargadosPorItem[row.id] || []).map(filaAEncargado) };
  if (row.tipo === "bloque") return { ...base, type: "seccion", title: row.titulo, description: row.descripcion || "", ministryId: row.ministerio_id || null };
  if (row.tipo === "cancion") return { ...base, type: "cancion", songId: row.cancion_id, structure: row.estructura && row.estructura.length ? row.estructura : undefined, keyOverride: row.tonalidad_override || null };
  if (row.tipo === "biblia") return { ...base, type: "biblia", reference: row.referencia, version: row.version_biblia, text: row.texto_biblia, bookId: row.libro_id || undefined, bookName: row.libro_nombre || undefined, chapter: row.capitulo || undefined, verseStart: row.versiculo_inicio || undefined, verseEnd: row.versiculo_fin || undefined };
  return { ...base, type: "slide", title: row.titulo || "", subtitle: row.subtitulo || "", bg: row.fondo_color || "#1B2029", bgType: row.fondo_tipo || "color", videoUrl: row.fondo_video_url || "", isSermonPoint: row.es_punto_bosquejo || undefined };
}

function itemServicioAFila(item, eventoId, orden) {
  // OJO: estas tres columnas son NOT NULL con default en la base de datos, pero solo tienen sentido
  // para un tipo de ítem (estructura: canción · fondo_tipo/es_punto_bosquejo: slide). Como el insert
  // de sincronizarServiceOrderInterno manda TODAS las filas del setlist en un solo array, si un tipo
  // de ítem no incluyera la clave, Postgres/PostgREST la manda como NULL explícito en vez de aplicar
  // el default (el default solo aplica cuando la columna se omite en un insert de una sola fila) —
  // eso violaba el NOT NULL y hacía fallar el insert completo. Por eso van las tres en "base": así
  // todas las filas del array tienen exactamente las mismas claves sin importar el tipo.
  const base = {
    id: item.id, evento_id: eventoId, orden,
    estructura: item.structure || [],
    fondo_tipo: item.bgType || "color",
    es_punto_bosquejo: !!item.isSermonPoint,
  };
  if (item.type === "seccion") return { ...base, tipo: "bloque", titulo: item.title, descripcion: item.description || "", ministerio_id: item.ministryId || null };
  if (item.type === "cancion") return { ...base, tipo: "cancion", cancion_id: item.songId, tonalidad_override: item.keyOverride || null };
  if (item.type === "biblia") return { ...base, tipo: "biblia", referencia: item.reference, version_biblia: item.version, texto_biblia: item.text, libro_id: item.bookId ?? null, libro_nombre: item.bookName ?? null, capitulo: item.chapter ?? null, versiculo_inicio: item.verseStart ?? null, versiculo_fin: item.verseEnd ?? null };
  return { ...base, tipo: "slide", titulo: item.title || "", subtitulo: item.subtitle || "", fondo_color: item.bg || "#1B2029", fondo_video_url: item.videoUrl || null };
}

// "Encargados" de un ítem del Setlist (bloque, canción, versículo o slide) — reemplaza el antiguo roster
// de "Roles/Participantes" separado: viven directo en miembros_rol, vinculados por item_servicio_id
// en vez de por rol_id, así cada burbuja del Setlist administra su propia gente asignada.
function filaAEncargado(m) {
  return { id: m.id, n: m.nombre, usuarioId: m.usuario_id || null, status: m.estado, lead: !!m.lead };
}

function encargadosPorItemAFilas(serviceOrder) {
  const filas = [];
  serviceOrder.forEach((item) => {
    (item.encargados || []).forEach((m, i) => {
      filas.push({ id: m.id, item_servicio_id: item.id, nombre: m.n, usuario_id: m.usuarioId || null, estado: m.status || "pendiente", lead: !!m.lead, orden: i });
    });
  });
  return filas;
}

// Roles del equipo de alabanza (ej. "Guitarra", "Batería", "Voz principal") — a diferencia de los
// encargados por ítem, viven a nivel de EVENTO (roles_evento + miembros_rol.rol_id) porque los bloques
// de Alabanza y Adoración comparten el mismo equipo: es un solo roster que ambos bloques leen/editan,
// no una copia por bloque.
function filaARolAlabanza(row, miembrosPorRol) {
  return { id: row.id, name: row.nombre, members: (miembrosPorRol[row.id] || []).map(filaAEncargado) };
}

export function eventoCompletoAFormatoEditor({ evento, items, encargados, roles, roleMembers }) {
  const encargadosPorItem = {};
  encargados.forEach((m) => {
    (encargadosPorItem[m.item_servicio_id] ||= []).push(m);
  });
  const miembrosPorRol = {};
  roleMembers.forEach((m) => {
    (miembrosPorRol[m.rol_id] ||= []).push(m);
  });
  return {
    id: evento.id, title: evento.titulo, dateLabel: evento.fecha_label || "", date: evento.fecha || null,
    location: evento.ubicacion || "", openPositions: 0, cover: null, esPlantilla: !!evento.es_plantilla,
    serviceOrder: items.map((row) => filaAItemServicio(row, encargadosPorItem)),
    worshipRoles: roles.map((row) => filaARolAlabanza(row, miembrosPorRol)),
  };
}

export async function listEventosCompletos() {
  const filas = await listEventos();
  const completos = await Promise.all(filas.map((f) => getEventoCompleto(f.id)));
  return completos.map(eventoCompletoAFormatoEditor);
}

// Reemplaza TODO el setlist (items_servicio + sus encargados) de un evento por el que viene del estado
// en memoria. Borrar items_servicio arrastra en cascada (on delete cascade) los miembros_rol que
// apuntaban a ellos por item_servicio_id, así que basta con reinsertar ambas tablas en orden.
async function sincronizarServiceOrderInterno(eventoId, serviceOrder) {
  const { error: delErr } = await supabase.from("items_servicio").delete().eq("evento_id", eventoId);
  if (delErr) throw delErr;
  if (!serviceOrder.length) return;
  const filas = serviceOrder.map((item, i) => itemServicioAFila(item, eventoId, i));
  const { error } = await supabase.from("items_servicio").insert(filas);
  if (error) throw error;

  const encargadosRows = encargadosPorItemAFilas(serviceOrder);
  if (encargadosRows.length) {
    const { error: encErr } = await supabase.from("miembros_rol").insert(encargadosRows);
    if (encErr) throw encErr;
  }
}
export function sincronizarServiceOrder(eventoId, serviceOrder) {
  return encolar(`items:${eventoId}`, () => sincronizarServiceOrderInterno(eventoId, serviceOrder));
}

// Reemplaza TODOS los roles del equipo de alabanza (roles_evento + miembros_rol por rol_id) de un evento.
async function sincronizarWorshipRolesInterno(eventoId, worshipRoles) {
  const { error: delErr } = await supabase.from("roles_evento").delete().eq("evento_id", eventoId);
  if (delErr) throw delErr;
  if (!worshipRoles.length) return;
  const rolesRows = worshipRoles.map((r, i) => ({ id: r.id, evento_id: eventoId, nombre: r.name, orden: i }));
  const { error: rolErr } = await supabase.from("roles_evento").insert(rolesRows);
  if (rolErr) throw rolErr;

  const miembrosRows = [];
  worshipRoles.forEach((r) => {
    r.members.forEach((m, i) => {
      miembrosRows.push({ id: m.id, rol_id: r.id, nombre: m.n, usuario_id: m.usuarioId || null, estado: m.status || "pendiente", lead: !!m.lead, orden: i });
    });
  });
  if (miembrosRows.length) {
    const { error: mErr } = await supabase.from("miembros_rol").insert(miembrosRows);
    if (mErr) throw mErr;
  }
}
export function sincronizarWorshipRoles(eventoId, worshipRoles) {
  return encolar(`worshiproles:${eventoId}`, () => sincronizarWorshipRolesInterno(eventoId, worshipRoles));
}

// Crea un evento nuevo completo (datos + setlist + roles de alabanza) desde el formato en memoria del prototipo.
export async function crearEventoCompleto(evento, userId) {
  const { error } = await supabase.from("eventos").insert({
    id: evento.id, titulo: evento.title, fecha: evento.date || null, fecha_label: evento.dateLabel || null,
    ubicacion: evento.location || null, creado_por: userId, es_plantilla: !!evento.esPlantilla,
  });
  if (error) throw error;
  await Promise.all([
    sincronizarServiceOrder(evento.id, evento.serviceOrder),
    sincronizarWorshipRoles(evento.id, evento.worshipRoles || []),
  ]);
}
