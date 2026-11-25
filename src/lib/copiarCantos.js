// "Copiar de otro culto" (pedido de Eldin, 2026-11-25): en "Agregar canciones" del setlist se elige un
// culto anterior, salen sus cantos ya marcados, se desmarcan los que no van y se copian con su tono y
// su "Orden para este culto" (y lo que la canción traiga solo para ese culto). Las plantillas siguen
// siendo para cultos fijos; esto es para "los cantos del domingo pasado".
import { parseIsoDateLocal, todayLocal, compareByDay } from "./dates.js";

// Cultos de donde se puede copiar: los que tienen al menos un canto, sin el culto abierto ni plantillas.
// Primero los que ya pasaron (el más reciente arriba), luego los próximos (el más cercano arriba).
export function cultosParaCopiar(eventos, eventoActualId, hoy = todayLocal()) {
  const conCantos = (eventos || []).filter((e) => e && e.id !== eventoActualId && !e.esPlantilla && cantosDeCulto(e).length > 0);
  const pasados = [], proximos = [];
  conCantos.forEach((e) => {
    const d = parseIsoDateLocal(e.date);
    if (d && d.getTime() <= hoy.getTime()) pasados.push(e); else proximos.push(e);
  });
  pasados.sort((a, b) => compareByDay(b, a));
  proximos.sort(compareByDay);
  return { pasados, proximos };
}

export function cantosDeCulto(evento) {
  return (evento?.serviceOrder || []).filter((it) => it?.type === "cancion" && it.songId != null);
}

// Lo que se pasa de cada canto al culto nuevo: todo lo que tenía en ese culto (tono, orden especial,
// letra animada del evento, cambios de tono…) menos su id y los encargados (es otra semana, otra gente).
// Las canciones que ya no están en la biblioteca se saltan.
export function cantosACopiar(cantos, library) {
  const existe = new Set((library || []).map((s) => s.id));
  return (cantos || [])
    .filter((it) => existe.has(it.songId))
    .map(({ id: _id, encargados: _enc, ...resto }) => JSON.parse(JSON.stringify(resto)));
}
