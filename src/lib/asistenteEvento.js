// Asistente por pasos para crear una plantilla o un evento especial (pedido de Eldin, 2026-11-20).
// Aquí va la parte sin pantalla: sugerencias de momentos y cómo se arma el orden del culto que se
// guarda (el mismo formato de siempre: bloques "seccion" seguidos de su contenido). Pantalla en
// src/components/AsistenteEvento.jsx.
import { itemCuentaRegresiva } from "./cuentaRegresiva.js";

export const SUGERENCIAS_MOMENTOS = ["Bienvenida", "Oración", "Alabanza", "Adoración", "Lectura de la Palabra", "Ofrenda", "Anuncios", "Predicación", "Santa Cena", "Despedida"];

// Cuenta regresiva antes de iniciar: null (sin) | "hora" (hasta la hora del culto) | número de minutos.
export function configCuenta(cuenta) {
  if (cuenta == null) return null;
  return cuenta === "hora" ? { modo: "hora" } : { modo: "minutos", minutos: Number(cuenta) || 5 };
}

// momentos: [{ id, title, contenido: [item del setlist sin id], encargados: [{ usuarioId, n }] }]
// Devuelve el serviceOrder: [cuenta regresiva?] + por cada momento su bloque y después su contenido.
// Los encargados quedan en el bloque del momento, "pendientes" de confirmar.
export function armarOrdenDelCulto({ momentos = [], cuenta = null }, nuevoId) {
  const orden = [];
  const cfg = configCuenta(cuenta);
  if (cfg) orden.push(itemCuentaRegresiva(nuevoId(), cfg));
  momentos.filter((m) => (m.title || "").trim()).forEach((m) => {
    orden.push({
      id: nuevoId(), type: "seccion", title: m.title.trim(), description: "", ministryId: null,
      encargados: (m.encargados || []).map((p) => ({ id: nuevoId(), n: p.n, usuarioId: p.usuarioId, status: "pendiente", lead: false })),
    });
    (m.contenido || []).forEach((c) => orden.push({ ...c, id: nuevoId(), encargados: [] }));
  });
  return orden;
}

export function resumenOrden({ momentos = [], cuenta = null }) {
  const validos = momentos.filter((m) => (m.title || "").trim());
  const canciones = validos.reduce((n, m) => n + (m.contenido || []).filter((c) => c.type === "cancion").length, 0);
  const encargados = new Set(validos.flatMap((m) => (m.encargados || []).map((p) => p.usuarioId)));
  return { momentos: validos.length, canciones, encargados: encargados.size, cuenta: cuenta != null };
}
