import { supabase } from "./supabaseClient.js";

// Repertorios (2026-11-26, migración 20261128000000_repertorios.sql): listas fijas de canciones con
// nombre propio ("Lista 1 Alabanza"…), sin evento ni fecha. Los músicos los abren para ensayar cuando
// quieran y, al armar un culto, "Agregar repertorio" mete todas sus canciones de un solo.
// Fila: { id, nombre, descripcion, canciones: [idCanción, …] } (el orden del arreglo es el del repertorio).

const comparar = (a, b) => (a || "").localeCompare(b || "", "es", { sensitivity: "base", numeric: true });

// En orden alfabético ("Lista 2" antes que "Lista 10").
export function ordenarRepertorios(lista) {
  return (lista || []).slice().sort((a, b) => comparar(a.nombre, b.nombre));
}

export function idsDe(rep) {
  return Array.isArray(rep?.canciones) ? rep.canciones.filter((x) => typeof x === "string" && x) : [];
}

// Las canciones del repertorio que siguen en la biblioteca, en su orden.
export function cancionesDeRepertorio(rep, library) {
  const porId = new Map((library || []).map((s) => [s.id, s]));
  return idsDe(rep).map((id) => porId.get(id)).filter(Boolean);
}

// Agrega al final las que no estaban (sin repetir).
export function agregarCanciones(ids, nuevas) {
  const ya = new Set(ids);
  const res = ids.slice();
  (nuevas || []).forEach((id) => { if (id && !ya.has(id)) { ya.add(id); res.push(id); } });
  return res;
}

export function quitarCancion(ids, id) {
  return ids.filter((x) => x !== id);
}

// Sube (-1) o baja (+1) una canción un lugar.
export function moverCancion(ids, id, dir) {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const res = ids.slice();
  [res[i], res[j]] = [res[j], res[i]];
  return res;
}

export function limpiarNombre(nombre) {
  return (nombre || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

// Enlace para compartir (solo lo abre quien ya es de la iglesia: la base no deja verlo a nadie más).
export function enlaceRepertorio(id, origen = (typeof window !== "undefined" ? window.location.origin : "https://app.worshipflowapp.com")) {
  return `${origen}/?repertorio=${encodeURIComponent(id)}`;
}

export function textoWhatsApp(rep, enlace) {
  return `Repertorio "${rep.nombre}" para ensayar en WorshipFlow: ${enlace}`;
}

// Lee ?repertorio=<id> de la dirección (o null).
export function repertorioDeLaUrl(search = (typeof window !== "undefined" ? window.location.search : "")) {
  try {
    const id = new URLSearchParams(search).get("repertorio");
    return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

// ---- Base de datos ----

// Si la tabla todavía no existe o falla, devuelve [] (nunca tumba la carga de Canciones).
export async function listarRepertorios() {
  try {
    const { data, error } = await supabase.from("repertorios").select("id, nombre, descripcion, canciones, updated_at");
    if (error) return [];
    return ordenarRepertorios((data || []).map((r) => ({ ...r, canciones: idsDe(r) })));
  } catch {
    return [];
  }
}

export async function crearRepertorio({ nombre, descripcion = "", canciones = [] }) {
  const limpio = limpiarNombre(nombre);
  if (!limpio) throw new Error("Escribe un nombre para el repertorio.");
  const { data, error } = await supabase.from("repertorios")
    .insert({ nombre: limpio, descripcion: (descripcion || "").trim().slice(0, 300), canciones })
    .select("id, nombre, descripcion, canciones, updated_at").single();
  if (error) throw error;
  return { ...data, canciones: idsDe(data) };
}

export async function guardarRepertorio(id, cambios) {
  const fila = { updated_at: new Date().toISOString() };
  if (cambios.nombre != null) {
    fila.nombre = limpiarNombre(cambios.nombre);
    if (!fila.nombre) throw new Error("Escribe un nombre para el repertorio.");
  }
  if (cambios.descripcion != null) fila.descripcion = cambios.descripcion.trim().slice(0, 300);
  if (cambios.canciones != null) fila.canciones = cambios.canciones;
  const { data, error } = await supabase.from("repertorios").update(fila).eq("id", id)
    .select("id, nombre, descripcion, canciones, updated_at").single();
  if (error) throw error;
  return { ...data, canciones: idsDe(data) };
}

export async function borrarRepertorio(id) {
  const { error } = await supabase.from("repertorios").delete().eq("id", id);
  if (error) throw error;
}

// Pone en la lista lo que acaba de guardarse (nuevo, cambiado o { id, borrado: true }), sin recargar.
export function aplicarCambio(lista, r) {
  if (!r?.id) return lista;
  const sin = (lista || []).filter((x) => x.id !== r.id);
  return r.borrado ? sin : ordenarRepertorios([...sin, r]);
}
