// "Publicar en varias fechas" (pedido de Eldin, 2026-11-20): una plantilla se publica de una vez en
// todas las fechas de un rango (máximo un año), por ejemplo todos los miércoles. Aquí solo va la
// cuenta de fechas, títulos y repetidos; la pantalla está en src/components/PublicarVariasFechas.jsx
// y la creación de los eventos en createEventsBatch (PrototipoWorshipFlow.jsx).
import { parseIsoDateLocal, MONTH_NAMES_FULL, tituloAutomatico, formatHora } from "./dates.js";

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const FRECUENCIAS = [
  ["semanal", "Cada semana"],
  ["quincenal", "Cada 2 semanas"],
  ["mensual", "Una vez al mes"],
];
// Para "una vez al mes": qué semana del mes (5 = la última, haya 4 o 5 en ese mes).
export const SEMANAS_MES = [[1, "Primer"], [2, "Segundo"], [3, "Tercer"], [4, "Cuarto"], [5, "Último"]];
export const MAX_FECHAS = 400; // red de seguridad: 7 días × 53 semanas = 371

export function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// El día más lejano que se puede elegir como "hasta": un año después de "desde", menos un día
// (del 20 nov 2026 hasta el 19 nov 2027 incluido).
export function hastaMaximo(desdeIso) {
  const d = parseIsoDateLocal(desdeIso);
  if (!d) return null;
  return isoLocal(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate() - 1));
}

export function sumarMeses(desdeIso, meses) {
  const d = parseIsoDateLocal(desdeIso);
  if (!d) return null;
  const tope = hastaMaximo(desdeIso);
  const r = isoLocal(new Date(d.getFullYear(), d.getMonth() + meses, d.getDate() - 1));
  return r > tope ? tope : r;
}

export function finDeMes(desdeIso) {
  const d = parseIsoDateLocal(desdeIso);
  if (!d) return null;
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

// ¿Está bien el rango? Devuelve el problema en palabras sencillas, o null si está bien.
export function problemaDelRango(desdeIso, hastaIso) {
  if (!parseIsoDateLocal(desdeIso)) return "Elige desde qué fecha.";
  if (!parseIsoDateLocal(hastaIso)) return "Elige hasta qué fecha.";
  if (hastaIso < desdeIso) return "La fecha final es antes de la inicial.";
  if (hastaIso > hastaMaximo(desdeIso)) return "El rango no puede ser mayor a un año.";
  return null;
}

// Todas las fechas (YYYY-MM-DD, en orden) del rango que caen en los días elegidos.
// dias: números 0 (domingo) a 6 (sábado). Quincenal cuenta las semanas desde la primera fecha que
// coincide con cada día, así "cada 2 semanas" arranca justo en "desde".
export function generarFechas({ desde, hasta, dias = [], frecuencia = "semanal", semanaDelMes = 1 }) {
  if (problemaDelRango(desde, hasta) || !dias.length) return [];
  const inicio = parseIsoDateLocal(desde);
  const fin = parseIsoDateLocal(hasta);
  const fechas = [];
  const primera = {};
  for (let d = new Date(inicio); d <= fin && fechas.length < MAX_FECHAS; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (!dias.includes(dow)) continue;
    if (frecuencia === "quincenal") {
      if (primera[dow] == null) primera[dow] = d.getTime();
      const semanas = Math.round((d.getTime() - primera[dow]) / (7 * 86400000));
      if (semanas % 2 !== 0) continue;
    } else if (frecuencia === "mensual") {
      const n = Math.ceil(d.getDate() / 7);
      const ultima = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (semanaDelMes === 5 ? !ultima : n !== semanaDelMes) continue;
    }
    fechas.push(isoLocal(d));
  }
  return fechas;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fechaCorta(iso) {
  const d = parseIsoDateLocal(iso);
  return d ? `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}` : "";
}

// "Miércoles 3 de diciembre" para la lista de revisión.
export function fechaLarga(iso) {
  const d = parseIsoDateLocal(iso);
  return d ? `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES_FULL[d.getMonth()].toLowerCase()}` : "";
}

// Nombre de cada servicio publicado. modo "fecha" (predeterminado, pedido de Eldin): "Miércoles 2 de
// diciembre · 7:00 pm"; modo "plantilla": "Culto de oración – 2 dic".
export function tituloParaFecha(base, iso, modo = "plantilla", hora = null) {
  if (modo === "fecha") return tituloAutomatico(iso, hora);
  const h = formatHora(hora);
  return `${(base || "").trim()} – ${fechaCorta(iso)}${h ? ` · ${h}` : ""}`;
}

const normal = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// ¿Ya hay un evento (no plantilla) ese día con ese nombre? Se compara el nombre sin la fecha que se
// le agrega al final, para reconocer también los que se publicaron antes con este mismo asistente.
// tituloDe (opcional): el nombre que llevaría cada fecha; si ya hay un evento ese día con ese mismo
// nombre (ej. "Miércoles 2 de diciembre · 7:00 pm") también cuenta como repetido.
// hora (opcional): si el evento que ya existe tiene otra hora, NO es repetido (dos servicios el mismo día).
export function fechasRepetidas(eventos, base, fechas, tituloDe = null, hora = null) {
  const b = normal(base);
  const set = new Set(fechas);
  const rep = new Set();
  (eventos || []).forEach((ev) => {
    if (ev.esPlantilla || !set.has(ev.date)) return;
    if (hora && ev.hora && String(ev.hora).slice(0, 5) !== String(hora).slice(0, 5)) return;
    const t = normal(ev.title);
    if ((b && (t === b || t.startsWith(`${b} –`) || t.startsWith(`${b} -`))) || (tituloDe && t === normal(tituloDe(ev.date)))) rep.add(ev.date);
  });
  return rep;
}

// Personas asignadas en la plantilla (encargados de cada momento y equipo de alabanza), sin repetir:
// a cada una le llega UN solo aviso con todas sus fechas, no uno por servicio.
export function personasDePlantilla(plantilla) {
  const ids = new Set();
  (plantilla?.serviceOrder || []).forEach((it) => (it.encargados || []).forEach((m) => m.usuarioId && ids.add(m.usuarioId)));
  (plantilla?.worshipRoles || []).forEach((r) => (r.members || []).forEach((m) => m.usuarioId && ids.add(m.usuarioId)));
  return [...ids];
}

export function resumenRango(fechas) {
  if (!fechas.length) return "";
  if (fechas.length === 1) return `el ${fechaCorta(fechas[0])}`;
  return `del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[fechas.length - 1])}`;
}
