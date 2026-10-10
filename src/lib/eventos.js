import { supabase } from "./supabaseClient.js";
import { traerTodas } from "./traerTodas.js";
import { sincronizarRecordatorios } from "./recordatorios.js";
import { fijarLineaBase, idsABorrar, actualizarTrasGuardar } from "./lineaBase.js";

// Algunas acciones (ej. agregar varios versículos de un rango, uno por diapositiva) pueden disparar
// varios guardados del mismo evento casi al mismo tiempo. Si corrieran en paralelo el más lento podría
// pisar al más reciente, y además cada guardado actualiza la línea base que usa el siguiente. Esta
// cola los fuerza a correr uno por uno, por clave (evento + tipo de dato). Exportada para que
// recordatorios.js use la misma.
const colas = new Map();
export function encolar(key, tarea) {
  const anterior = colas.get(key) || Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  colas.set(key, siguiente.catch(() => {}));
  return siguiente;
}

// Un evento recién creado navega a su pantalla de inmediato (para que se sienta instantáneo), pero el
// INSERT de la fila en `eventos` sigue en vuelo — si el admin agrega un bloque/canción o cambia algo en
// Ajustes en ese primer instante, esa escritura puede llegar a Supabase ANTES que la fila del evento:
// un INSERT en items_servicio con una FK inexistente falla, y un UPDATE sobre una fila que no existe
// simplemente no hace nada — en ambos casos el cambio se pierde en silencio ("se borra de la nada").
// Este mapa deja que cualquier operación sobre un evento espere a que termine de crearse primero.
const creacionesPendientes = new Map();
export async function esperarCreacionEvento(eventoId) {
  const p = creacionesPendientes.get(eventoId);
  if (p) await p.catch(() => {});
}

export async function listEventos() {
  const { data, error } = await traerTodas(() => supabase.from("eventos").select("*").order("fecha", { ascending: true, nullsFirst: false }).order("id"));
  if (error) throw error;
  return data;
}

export async function createEvento(datos, creadoPor) {
  const { data, error } = await supabase.from("eventos").insert({ ...datos, creado_por: creadoPor }).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvento(id, datos) {
  await esperarCreacionEvento(id);
  const { error } = await supabase.from("eventos").update(datos).eq("id", id);
  if (error) throw error;
}

export async function deleteEvento(id) {
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
}

// Un administrador (o líder de ministerio) necesita saber si alguien ya ABRIÓ el evento y vio qué le
// toca — distinto del "confirmado/pendiente/rechazado" de arriba, que lo marca el propio admin a mano
// por la persona, no dice si esa persona siquiera se enteró. Se marca a nivel de EVENTO (no por cada
// cargo suelto): quien tiene uno o más cargos en un evento y lo abre, marca de una vez que ya vio
// "sus asignaciones" ahí, sin depender de cuántos cargos distintos tenga.
export async function marcarAsignacionVista(eventoId, usuarioId) {
  const { error } = await supabase.from("asignaciones_vistas").upsert(
    { evento_id: eventoId, usuario_id: usuarioId, visto_at: new Date().toISOString() },
    { onConflict: "evento_id,usuario_id" }
  );
  if (error) throw error;
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
// reales. La sincronización es por diferencias: upsert de lo que hay en memoria y borrado SOLO de
// lo que este dispositivo conocía y el usuario quitó (ver src/lib/lineaBase.js).
// =====================================================================================

function filaAItemServicio(row, encargadosPorItem) {
  const base = { id: row.id, encargados: (encargadosPorItem[row.id] || []).map(filaAEncargado) };
  if (row.tipo === "bloque") return { ...base, type: "seccion", title: row.titulo, description: row.descripcion || "", ministryId: row.ministerio_id || null };
  if (row.tipo === "cancion") return { ...base, type: "cancion", songId: row.cancion_id, structure: row.estructura && row.estructura.length ? row.estructura : undefined, keyOverride: row.tonalidad_override || null };
  if (row.tipo === "biblia") return { ...base, type: "biblia", reference: row.referencia, version: row.version_biblia, text: row.texto_biblia, bookId: row.libro_id || undefined, bookName: row.libro_nombre || undefined, chapter: row.capitulo || undefined, verseStart: row.versiculo_inicio || undefined, verseEnd: row.versiculo_fin || undefined };
  return { ...base, type: "slide", title: row.titulo || "", subtitle: row.subtitulo || "", bg: row.fondo_color || "#1B2029", bgType: row.fondo_tipo || "color", videoUrl: row.fondo_video_url || "", imageUrl: row.fondo_imagen_url || "", isSermonPoint: row.es_punto_bosquejo || undefined };
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
  return { ...base, tipo: "slide", titulo: item.title || "", subtitulo: item.subtitle || "", fondo_color: item.bg || "#1B2029", fondo_video_url: item.videoUrl || null, fondo_imagen_url: item.imageUrl || null };
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

function filaARecordatorio(row) {
  return { id: row.id, cantidad: row.cantidad, unidad: row.unidad, enviado: row.enviado };
}

export function eventoCompletoAFormatoEditor({ evento, items, encargados, roles, roleMembers, recordatorios, vistas }) {
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
    hora: evento.hora || null,
    // Ensayo y nota de quien dirige la alabanza (Inicio del equipo de alabanza).
    ensayoFecha: evento.ensayo_fecha || null, ensayoHora: evento.ensayo_hora || null, notaAlabanza: evento.nota_alabanza || "",
    location: evento.ubicacion || "", openPositions: 0, cover: null, esPlantilla: !!evento.es_plantilla,
    serviceOrder: items.map((row) => filaAItemServicio(row, encargadosPorItem)),
    worshipRoles: roles.map((row) => filaARolAlabanza(row, miembrosPorRol)),
    reminders: (recordatorios || []).map(filaARecordatorio),
    vistas: (vistas || []).map((v) => ({ usuarioId: v.usuario_id, vistoAt: v.visto_at })),
  };
}

// Ids de cada tipo de fila que un evento en formato del editor contiene — lo que "conoce" el
// dispositivo que tiene ese evento en memoria.
function idsDeEvento(ev) {
  const serviceOrder = ev.serviceOrder || [];
  const worshipRoles = ev.worshipRoles || [];
  return {
    items: serviceOrder.map((it) => it.id),
    encargados: serviceOrder.flatMap((it) => (it.encargados || []).map((m) => m.id)),
    roles: worshipRoles.map((r) => r.id),
    miembrosRol: worshipRoles.flatMap((r) => (r.members || []).map((m) => m.id)),
    recordatorios: (ev.reminders || []).map((r) => r.id),
  };
}

// La app llama esto cada vez que ADOPTA eventos traídos de la base (carga inicial, refresco en
// tiempo real, copia sin conexión) — nunca con datos que no van a quedar en pantalla, porque
// entonces la línea base tendría filas que el estado local no tiene y el próximo guardado las
// borraría.
export function registrarLineaBaseEventos(eventos) {
  (eventos || []).forEach((ev) => {
    const ids = idsDeEvento(ev);
    fijarLineaBase(`items:${ev.id}`, ids.items);
    fijarLineaBase(`encargados:${ev.id}`, ids.encargados);
    fijarLineaBase(`roles:${ev.id}`, ids.roles);
    fijarLineaBase(`miembrosRol:${ev.id}`, ids.miembrosRol);
    fijarLineaBase(`recordatorios:${ev.id}`, ids.recordatorios);
  });
}

function agruparPor(filas, campo) {
  const out = {};
  (filas || []).forEach((f) => { (out[f[campo]] ||= []).push(f); });
  return out;
}

// Antes pedía la lista y después UNA fila completa POR EVENTO (hasta 6 consultas cada una) -- con
// pocos eventos cargados no se notaba, pero el número de viajes a Supabase crecía con el historial de
// la iglesia, así que entre más eventos se acumulaban más tardaba en abrir la app.
//
// Primer arreglo (2026-10-04, duró unas horas): traer cada tabla hija con un solo .in("evento_id", [
// todos los ids]) en vez de uno por evento -- mejor, pero con 693 ítems de Setlist acumulados ese
// .in() para miembros_rol armaba una URL de 27 mil caracteres que Supabase rechazaba con 400 ("Sin
// conexión" en los dos teléfonos de Eldin, porque listEventosCompletos entero fallaba). La lista de
// ids crecía con el contenido exactamente igual que antes crecía el número de consultas -- mismo
// problema de fondo, solo que escondido un nivel más abajo.
//
// Arreglo real: ninguna de estas consultas filtra por id. RLS (iglesia_id = mi_iglesia_id()) ya
// limita cada tabla a lo de ESTA iglesia nada más -- el mismo alcance que daba el .in() de la lista
// completa de ids, sin tener que mandar esa lista por la URL. Son siempre 6 consultas en total
// (ninguna con una lista de ids adentro), tenga la iglesia 10 eventos o 5000.
export async function listEventosCompletos() {
  const filas = await listEventos();
  if (filas.length === 0) return [];
  const [itemsRes, rolesRes, recordatoriosRes, vistasRes, miembrosRes] = await Promise.all([
    // Por páginas (ver traerTodas): con varios meses de eventos, items y encargados pasan de 1000 filas.
    traerTodas(() => supabase.from("items_servicio").select("*, canciones(titulo, artista, tonalidad, tempo)").order("orden", { ascending: true }).order("id")),
    traerTodas(() => supabase.from("roles_evento").select("*").order("orden", { ascending: true }).order("id")),
    traerTodas(() => supabase.from("recordatorios_evento").select("*").order("created_at", { ascending: true }).order("id")),
    // Mismo respaldo que antes: si asignaciones_vistas falla por el motivo que sea, no debe tumbar la
    // carga de TODOS los eventos (ver nota histórica de getEventoCompleto, reemplazada por esta función).
    traerTodas(() => supabase.from("asignaciones_vistas").select("*").order("evento_id").order("usuario_id")).then(
      (r) => (r.error ? { data: [] } : r),
      () => ({ data: [] })
    ),
    traerTodas(() => supabase.from("miembros_rol").select("*").order("orden", { ascending: true }).order("id")),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (rolesRes.error) throw rolesRes.error;
  if (recordatoriosRes.error) throw recordatoriosRes.error;
  if (miembrosRes.error) throw miembrosRes.error;

  const itemsPorEvento = agruparPor(itemsRes.data, "evento_id");
  const rolesPorEvento = agruparPor(rolesRes.data, "evento_id");
  const recordatoriosPorEvento = agruparPor(recordatoriosRes.data, "evento_id");
  const vistasPorEvento = agruparPor(vistasRes.data, "evento_id");

  // miembros_rol no tiene evento_id propio -- cada fila es encargado de un ítem (item_servicio_id) O
  // integrante de un rol de alabanza (rol_id), nunca los dos. Hay que ubicar a cuál evento pertenece
  // por el item/rol al que apunta (igual que antes hacía eventoCompletoAFormatoEditor con un solo
  // evento, solo que ahora con los de TODOS los eventos mezclados en una sola tabla).
  const itemIdAEvento = {};
  (itemsRes.data || []).forEach((it) => { itemIdAEvento[it.id] = it.evento_id; });
  const roleIdAEvento = {};
  (rolesRes.data || []).forEach((r) => { roleIdAEvento[r.id] = r.evento_id; });
  const encargadosPorEvento = {};
  const roleMembersPorEvento = {};
  (miembrosRes.data || []).forEach((m) => {
    if (m.item_servicio_id) {
      const eventoId = itemIdAEvento[m.item_servicio_id];
      if (eventoId) (encargadosPorEvento[eventoId] ||= []).push(m);
    } else if (m.rol_id) {
      const eventoId = roleIdAEvento[m.rol_id];
      if (eventoId) (roleMembersPorEvento[eventoId] ||= []).push(m);
    }
  });

  return filas.map((evento) => eventoCompletoAFormatoEditor({
    evento,
    items: itemsPorEvento[evento.id] || [],
    encargados: encargadosPorEvento[evento.id] || [],
    roles: rolesPorEvento[evento.id] || [],
    roleMembers: roleMembersPorEvento[evento.id] || [],
    recordatorios: recordatoriosPorEvento[evento.id] || [],
    vistas: vistasPorEvento[evento.id] || [],
  }));
}

// Guarda el setlist (items_servicio + sus encargados) de un evento a partir del estado en memoria.
//
// Historia: primero era "borrar todo e insertar" (un fallo a mitad de camino dejaba el setlist vacío
// de verdad). Luego pasó a "upsert de todo + borrar lo que sobre en la base", que evitaba eso pero
// tenía otro problema: "lo que sobra" incluía filas que OTRO dispositivo o el Asistente habían
// agregado después de que este cargó el evento, y se borraban sin que nadie lo pidiera (pasó en
// producción, octubre 2026). Ahora:
// 1. upsert de lo que hay en memoria (igual que antes: inserta lo nuevo, actualiza lo existente);
// 2. borra solo lo que este dispositivo conocía (línea base) y el usuario quitó;
// 3. vuelve a leer qué quedó y actualiza la línea base para el siguiente guardado.
// Una fila agregada por fuera nunca está en la línea base, así que nunca se borra desde aquí.
async function sincronizarServiceOrderInterno(eventoId, serviceOrder) {
  await esperarCreacionEvento(eventoId);
  const filas = serviceOrder.map((item, i) => itemServicioAFila(item, eventoId, i));
  const encargadosRows = encargadosPorItemAFilas(serviceOrder);
  const itemIdsLocales = filas.map((f) => f.id);
  const encargadoIdsLocales = encargadosRows.map((r) => r.id);

  if (filas.length) {
    const { error } = await supabase.from("items_servicio").upsert(filas);
    if (error) throw error;
  }
  if (encargadosRows.length) {
    const { error: encErr } = await supabase.from("miembros_rol").upsert(encargadosRows);
    if (encErr) throw encErr;
  }

  // Borrar un ítem arrastra en cascada sus encargados (on delete cascade); los encargados quitados de
  // ítems que siguen existiendo se borran aparte, también solo si estaban en la línea base.
  const itemsQuitados = idsABorrar(`items:${eventoId}`, itemIdsLocales);
  if (itemsQuitados.length) {
    const { error: delErr } = await supabase.from("items_servicio").delete().eq("evento_id", eventoId).in("id", itemsQuitados);
    if (delErr) throw delErr;
  }
  const encargadosQuitados = idsABorrar(`encargados:${eventoId}`, encargadoIdsLocales);
  if (encargadosQuitados.length) {
    const { error: encDelErr } = await supabase.from("miembros_rol").delete().in("id", encargadosQuitados).not("item_servicio_id", "is", null);
    if (encDelErr) throw encDelErr;
  }

  const { data: itemsEnBase, error: idsErr } = await supabase.from("items_servicio").select("id").eq("evento_id", eventoId);
  if (idsErr) throw idsErr;
  const itemIdsEnBase = (itemsEnBase ?? []).map((r) => r.id);
  const { data: encEnBase, error: encIdsErr } = itemIdsEnBase.length
    ? await supabase.from("miembros_rol").select("id").in("item_servicio_id", itemIdsEnBase)
    : { data: [] };
  if (encIdsErr) throw encIdsErr;
  actualizarTrasGuardar(`items:${eventoId}`, itemIdsEnBase, itemIdsLocales);
  actualizarTrasGuardar(`encargados:${eventoId}`, (encEnBase ?? []).map((r) => r.id), encargadoIdsLocales);
}
export function sincronizarServiceOrder(eventoId, serviceOrder) {
  return encolar(`items:${eventoId}`, () => sincronizarServiceOrderInterno(eventoId, serviceOrder));
}

// Guarda los roles del equipo de alabanza (roles_evento + miembros_rol por rol_id) de un evento —
// mismo guardado por diferencias que sincronizarServiceOrderInterno, por la misma razón: nunca borrar
// un rol ni un integrante que este dispositivo no conocía.
async function sincronizarWorshipRolesInterno(eventoId, worshipRoles) {
  await esperarCreacionEvento(eventoId);
  const rolesRows = worshipRoles.map((r, i) => ({ id: r.id, evento_id: eventoId, nombre: r.name, orden: i }));
  const miembrosRows = [];
  worshipRoles.forEach((r) => {
    r.members.forEach((m, i) => {
      miembrosRows.push({ id: m.id, rol_id: r.id, nombre: m.n, usuario_id: m.usuarioId || null, estado: m.status || "pendiente", lead: !!m.lead, orden: i });
    });
  });
  const rolIdsLocales = rolesRows.map((r) => r.id);
  const miembroIdsLocales = miembrosRows.map((m) => m.id);

  if (rolesRows.length) {
    const { error: rolErr } = await supabase.from("roles_evento").upsert(rolesRows);
    if (rolErr) throw rolErr;
  }
  if (miembrosRows.length) {
    const { error: mErr } = await supabase.from("miembros_rol").upsert(miembrosRows);
    if (mErr) throw mErr;
  }

  const rolesQuitados = idsABorrar(`roles:${eventoId}`, rolIdsLocales);
  if (rolesQuitados.length) {
    const { error: rolDelErr } = await supabase.from("roles_evento").delete().eq("evento_id", eventoId).in("id", rolesQuitados);
    if (rolDelErr) throw rolDelErr;
  }
  const miembrosQuitados = idsABorrar(`miembrosRol:${eventoId}`, miembroIdsLocales);
  if (miembrosQuitados.length) {
    const { error: mDelErr } = await supabase.from("miembros_rol").delete().in("id", miembrosQuitados).not("rol_id", "is", null);
    if (mDelErr) throw mDelErr;
  }

  const { data: rolesEnBase, error: rolIdsErr } = await supabase.from("roles_evento").select("id").eq("evento_id", eventoId);
  if (rolIdsErr) throw rolIdsErr;
  const rolIdsEnBase = (rolesEnBase ?? []).map((r) => r.id);
  const { data: miembrosEnBase, error: mIdsErr } = rolIdsEnBase.length
    ? await supabase.from("miembros_rol").select("id").in("rol_id", rolIdsEnBase)
    : { data: [] };
  if (mIdsErr) throw mIdsErr;
  actualizarTrasGuardar(`roles:${eventoId}`, rolIdsEnBase, rolIdsLocales);
  actualizarTrasGuardar(`miembrosRol:${eventoId}`, (miembrosEnBase ?? []).map((r) => r.id), miembroIdsLocales);
}
export function sincronizarWorshipRoles(eventoId, worshipRoles) {
  return encolar(`worshiproles:${eventoId}`, () => sincronizarWorshipRolesInterno(eventoId, worshipRoles));
}

// Crea un evento nuevo completo (datos + setlist + roles de alabanza + recordatorios) desde el
// formato en memoria del prototipo.
export async function crearEventoCompleto(evento, userId) {
  const insercion = supabase.from("eventos").insert({
    id: evento.id, titulo: evento.title, fecha: evento.date || null, fecha_label: evento.dateLabel || null,
    hora: evento.hora || null,
    ubicacion: evento.location || null, creado_por: userId, es_plantilla: !!evento.esPlantilla,
  }).then(({ error }) => { if (error) throw error; });
  // Registrado ANTES del await: la app navega a la pantalla del evento de inmediato tras llamar a esta
  // función, así que cualquier escritura que el admin dispare en ese mismo instante (agregar un bloque,
  // cambiar la hora en Ajustes...) debe poder encontrar esta promesa y esperarla — ver esperarCreacionEvento.
  creacionesPendientes.set(evento.id, insercion);
  try {
    await insercion;
  } finally {
    creacionesPendientes.delete(evento.id);
  }
  await Promise.all([
    sincronizarServiceOrder(evento.id, evento.serviceOrder),
    sincronizarWorshipRoles(evento.id, evento.worshipRoles || []),
    sincronizarRecordatorios(evento.id, evento.reminders || []),
  ]);
}

// Confirmar o avisar "no puedo" desde la pantalla de inicio: solo cambia el estado de MIS filas de
// miembros_rol (roles de alabanza o encargados de bloque), sin re-guardar el evento entero — así no
// pisa nada que un administrador esté editando al mismo tiempo en ese evento.
export async function responderMisCargos(miembroIds, estado) {
  if (!miembroIds?.length) return;
  const { error } = await supabase.from("miembros_rol").update({ estado }).in("id", miembroIds);
  if (error) throw error;
}
