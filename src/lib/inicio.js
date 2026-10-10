// Pantalla de inicio personal (pedido de Eldin, 2026-10-09): en vez de un calendario de la iglesia,
// "lo que me toca a mí". Toda la lógica de qué mostrar vive aquí, sin React, para poder probarla.
//
// Una persona puede tener cargos de dos tipos en un evento (ambos son filas de miembros_rol):
// - "rol": del equipo de alabanza (Piano, Voz, Batería...), que vive en event.worshipRoles.
// - "bloque": encargado de un ítem del Setlist (Limpieza, Multimedia, Lectura...), en item.encargados.
import { parseIsoDateLocal, todayLocal, isUpcoming, compareByDay } from "./dates.js";

const etiquetaItem = (item, library) => {
  if (item.type === "seccion") return item.title || "Bloque";
  if (item.type === "cancion") return library.find((s) => s.id === item.songId)?.title || "Canción";
  if (item.type === "biblia") return `Lectura: ${item.reference}`;
  return item.title || "Diapositiva";
};

// Todos MIS cargos en un evento, con el id de la fila (para confirmarlos) y su estado.
export function misCargos(event, uid, library = []) {
  if (!event || !uid) return [];
  const out = [];
  (event.worshipRoles || []).forEach((r) => {
    (r.members || []).forEach((m) => {
      if (m.usuarioId === uid) out.push({ tipo: "rol", miembroId: m.id, nombre: r.name, estado: m.status || "pendiente", lead: !!m.lead, rolId: r.id });
    });
  });
  (event.serviceOrder || []).forEach((item) => {
    (item.encargados || []).forEach((m) => {
      if (m.usuarioId === uid) out.push({ tipo: "bloque", miembroId: m.id, nombre: etiquetaItem(item, library), estado: m.status || "pendiente", lead: !!m.lead, itemId: item.id });
    });
  });
  return out;
}

// Estado resumido de varios cargos: si alguno no puede → "rechazado"; si todos confirmados →
// "confirmado"; si no → "pendiente".
export function estadoGeneral(cargos) {
  if (!cargos.length) return null;
  if (cargos.some((c) => c.estado === "rechazado")) return "rechazado";
  if (cargos.every((c) => c.estado === "confirmado")) return "confirmado";
  return "pendiente";
}

// Mis próximos servicios (eventos que todavía no pasan donde tengo al menos un cargo), en orden.
export function misProximosServicios(events, uid, library = []) {
  return (events || [])
    .filter((e) => !e.esPlantilla && isUpcoming(e))
    .map((e) => ({ event: e, cargos: misCargos(e, uid, library) }))
    .filter((x) => x.cargos.length > 0)
    .sort((a, b) => compareByDay(a.event, b.event));
}

// "hoy", "mañana", "en 3 días"... para la tarjeta del próximo servicio.
export function cuandoEs(fechaIso, hoy = todayLocal()) {
  const d = parseIsoDateLocal(fechaIso);
  if (!d) return null;
  const dias = Math.round((d - hoy) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias < 7) return `en ${dias} días`;
  const semanas = Math.round(dias / 7);
  return semanas === 1 ? "en 1 semana" : `en ${semanas} semanas`;
}

// Con quién me toca: si estoy en el equipo de alabanza, todo el equipo; si soy encargado de un
// bloque, los demás encargados de ese bloque. Sin repetir personas y sin incluirme.
export function companeros(event, uid, library = []) {
  if (!event || !uid) return [];
  const yo = misCargos(event, uid, library);
  const vistos = new Map();
  const agregar = (m, cargo) => {
    if (!m || m.usuarioId === uid) return;
    const clave = m.usuarioId || `${m.n}|${cargo}`;
    const previo = vistos.get(clave);
    if (previo) {
      if (!previo.cargos.includes(cargo)) previo.cargos.push(cargo);
      previo.lead = previo.lead || !!m.lead;
      return;
    }
    vistos.set(clave, { nombre: m.n || "Sin nombre", cargos: [cargo], estado: m.status || "pendiente", lead: !!m.lead });
  };
  if (yo.some((c) => c.tipo === "rol")) {
    (event.worshipRoles || []).forEach((r) => (r.members || []).forEach((m) => agregar(m, r.name)));
  }
  yo.filter((c) => c.tipo === "bloque").forEach((c) => {
    const item = (event.serviceOrder || []).find((i) => i.id === c.itemId);
    (item?.encargados || []).forEach((m) => agregar(m, c.nombre));
  });
  // Quien dirige primero, después por nombre.
  return [...vistos.values()].sort((a, b) => (b.lead - a.lead) || a.nombre.localeCompare(b.nombre, "es"));
}

// Indicaciones para mis bloques: la planificación del ministerio vinculado para la fecha del evento
// (lo que escribe el líder), o si no hay, la descripción del bloque en el Setlist.
export function indicaciones(event, uid, ministries = [], library = []) {
  if (!event || !uid) return [];
  const out = [];
  misCargos(event, uid, library).filter((c) => c.tipo === "bloque").forEach((c) => {
    const item = (event.serviceOrder || []).find((i) => i.id === c.itemId);
    if (!item) return;
    const ministerio = item.ministryId ? ministries.find((m) => m.id === item.ministryId) : null;
    const plan = ministerio && event.date ? (ministerio.plan || []).find((p) => p.date === event.date) : null;
    const texto = (plan && (plan.detail || plan.title)) || item.description || "";
    if (texto.trim()) out.push({ bloque: c.nombre, texto: texto.trim(), autor: plan ? ministerio.leaderName || "" : "" });
  });
  return out;
}

// Canciones del servicio, solo si estoy en el equipo de alabanza (los demás no las necesitan).
export function cancionesParaEnsayar(event, uid, library = []) {
  if (!misCargos(event, uid, library).some((c) => c.tipo === "rol")) return [];
  return (event.serviceOrder || [])
    .filter((i) => i.type === "cancion")
    .map((i) => {
      const s = library.find((x) => x.id === i.songId);
      if (!s) return null;
      return { itemId: i.id, songId: s.id, titulo: s.title, tono: i.keyOverride || s.key, tonoOriginal: s.key, cambiado: !!i.keyOverride && i.keyOverride !== s.key, tempo: s.tempo || "" };
    })
    .filter(Boolean);
}

// Para administradores: lo que está incompleto en los próximos `dias` días.
export function necesitaAtencion(events, library = [], dias = 14, hoy = todayLocal()) {
  const limite = new Date(hoy.getTime() + dias * 86400000);
  const out = [];
  (events || [])
    .filter((e) => !e.esPlantilla && isUpcoming(e))
    .filter((e) => { const d = parseIsoDateLocal(e.date); return d && d <= limite; })
    .sort(compareByDay)
    .forEach((e) => {
      const corto = e.title || "Evento";
      const tieneAlabanza = (e.serviceOrder || []).some((i) => i.type === "seccion" && /alabanza|adoraci/i.test(i.title || ""));
      const canciones = (e.serviceOrder || []).filter((i) => i.type === "cancion").length;
      if (tieneAlabanza && canciones === 0) out.push({ eventId: e.id, tipo: "setlist", texto: `${corto}: el setlist no tiene canciones` });
      (e.worshipRoles || []).forEach((r) => {
        if (!(r.members || []).length) out.push({ eventId: e.id, tipo: "rol", texto: `${corto}: falta ${r.name.toLowerCase()}` });
      });
      const rechazados = [];
      (e.worshipRoles || []).forEach((r) => (r.members || []).forEach((m) => { if (m.status === "rechazado") rechazados.push(`${m.n} (${r.name})`); }));
      (e.serviceOrder || []).forEach((i) => (i.encargados || []).forEach((m) => { if (m.status === "rechazado") rechazados.push(`${m.n} (${etiquetaItem(i, library)})`); }));
      if (rechazados.length) out.push({ eventId: e.id, tipo: "rechazo", texto: `${corto}: no puede${rechazados.length > 1 ? "n" : ""} ${rechazados.join(", ")}` });
    });
  return out;
}

// Los 7 días de la semana actual (lunes a domingo), con los eventos de cada uno y si me toca.
export function estaSemana(events, uid, library = [], hoy = todayLocal()) {
  const dow = (hoy.getDay() + 6) % 7; // 0 = lunes
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const delDia = (events || []).filter((e) => !e.esPlantilla && e.date === iso)
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    return {
      fecha: d, iso, esHoy: d.getTime() === hoy.getTime(),
      eventos: delDia,
      meToca: delDia.some((e) => misCargos(e, uid, library).length > 0),
    };
  });
}
