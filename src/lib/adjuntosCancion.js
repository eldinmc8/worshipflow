import { supabase } from "./supabaseClient.js";

// Adjuntos por canción: PDFs, imágenes y enlaces — ver la migración 20261017000000_adjuntos_cancion.sql.
const BUCKET = "adjuntos-canciones";
export const ADJUNTO_MAX_BYTES = 20 * 1024 * 1024;
const MIME_IMAGEN = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif"];

// Qué tipo de adjunto es un archivo elegido ("pdf" | "imagen"), o null si no se acepta.
export function tipoDeArchivo(file) {
  const tipo = (file?.type || "").toLowerCase();
  const nombre = (file?.name || "").toLowerCase();
  if (tipo === "application/pdf" || nombre.endsWith(".pdf")) return "pdf";
  if (MIME_IMAGEN.includes(tipo) || /\.(png|jpe?g|webp|gif|heic|heif)$/.test(nombre)) return "imagen";
  return null;
}

// Arregla lo que la gente pega: sin "https://", con espacios, etc. Devuelve null si no parece un enlace.
export function normalizarEnlace(texto) {
  let t = (texto || "").trim();
  if (!t || /\s/.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  try {
    const u = new URL(t);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Nombre corto que se muestra si no le pusieron título: el sitio para enlaces, el archivo sin extensión.
export function tituloPorDefecto(tipo, { url, nombreArchivo } = {}) {
  if (tipo === "enlace") {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
      if (/youtube\.com$|youtu\.be$/.test(host)) return "YouTube";
      if (/spotify\.com$/.test(host)) return "Spotify";
      if (/drive\.google\.com$|docs\.google\.com$/.test(host)) return "Google Drive";
      return host;
    } catch {
      return "Enlace";
    }
  }
  const base = (nombreArchivo || "").replace(/\.[^.]+$/, "").trim();
  return base || (tipo === "pdf" ? "PDF" : "Imagen");
}

// Nombres de un toque para lo que más suben los músicos (pedido de un músico, 2026-11-25).
export const SUGERENCIAS_ENLACE = ["Versión original", "Tutorial piano", "Tutorial guitarra", "Tutorial bajo", "Tutorial batería", "Tutorial trompeta", "Tutorial voces", "Pista"];
export const SUGERENCIAS_ARCHIVO = ["Partitura", "Cifrado", "Trompeta en Si bemol", "Saxofón en Mi bemol", "Piano", "Voces"];

// ¿Es un video (YouTube / Vimeo)? Para ponerle el ícono de video.
export function esVideo(adjunto) {
  if (adjunto?.tipo !== "enlace") return false;
  try {
    const host = new URL(adjunto.url).hostname.replace(/^www\./, "").replace(/^m\./, "");
    return /(^|\.)youtube\.com$|^youtu\.be$|(^|\.)vimeo\.com$/.test(host);
  } catch {
    return false;
  }
}

// Separa la lista en enlaces (videos, tutoriales) y archivos (partituras, fotos), cada una en orden alfabético.
export function agruparAdjuntos(lista) {
  const orden = (a, b) => (a.titulo || "").localeCompare(b.titulo || "", "es", { sensitivity: "base", numeric: true });
  const enlaces = (lista || []).filter((a) => a.tipo === "enlace").sort(orden);
  const archivos = (lista || []).filter((a) => a.tipo !== "enlace").sort(orden);
  return { enlaces, archivos };
}

// Título para cada archivo cuando suben varios a la vez con un mismo nombre: "Voces 1", "Voces 2"...
export function tituloParaArchivo(titulo, indice, total, nombreArchivo, tipo) {
  const t = (titulo || "").trim();
  if (!t) return tituloPorDefecto(tipo, { nombreArchivo });
  return total > 1 ? `${t} ${indice + 1}` : t;
}

function sanitizarNombre(nombre) {
  return (nombre || "archivo").replace(/[^a-zA-Z0-9.\-]/g, "_").slice(-80);
}

export async function listarAdjuntos(cancionId) {
  const { data, error } = await supabase.from("adjuntos_cancion").select("*").eq("cancion_id", cancionId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Ids de las canciones que tienen al menos un adjunto (para mostrar el clip en la lista). Si la tabla
// todavía no existe o falla, devuelve un Set vacío: nunca debe tumbar la carga de la biblioteca.
export async function cancionesConAdjuntos() {
  try {
    const { data, error } = await supabase.from("adjuntos_cancion").select("cancion_id");
    if (error) return new Set();
    return new Set((data || []).map((f) => f.cancion_id));
  } catch {
    return new Set();
  }
}

export async function subirAdjunto({ iglesiaId, cancionId, file, titulo }) {
  const tipo = tipoDeArchivo(file);
  if (!tipo) throw new Error("Solo se pueden adjuntar PDFs o imágenes.");
  if (file.size > ADJUNTO_MAX_BYTES) throw new Error(`No puede pesar más de ${ADJUNTO_MAX_BYTES / (1024 * 1024)} MB.`);
  const ruta = `${iglesiaId}/${cancionId}/${Date.now()}-${sanitizarNombre(file.name)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: file.type || (tipo === "pdf" ? "application/pdf" : "image/jpeg") });
  if (upErr) throw upErr;
  const url = supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  const fila = { cancion_id: cancionId, tipo, titulo: (titulo || "").trim() || tituloPorDefecto(tipo, { nombreArchivo: file.name }), url, ruta };
  const { data, error } = await supabase.from("adjuntos_cancion").insert(fila).select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
    throw error;
  }
  return data;
}

export async function agregarEnlace({ cancionId, url, titulo }) {
  const limpio = normalizarEnlace(url);
  if (!limpio) throw new Error("Ese enlace no se ve bien. Cópialo completo y vuelve a pegarlo.");
  const fila = { cancion_id: cancionId, tipo: "enlace", titulo: (titulo || "").trim() || tituloPorDefecto("enlace", { url: limpio }), url: limpio, ruta: null };
  const { data, error } = await supabase.from("adjuntos_cancion").insert(fila).select().single();
  if (error) throw error;
  return data;
}

export async function borrarAdjunto(adjunto) {
  const { error } = await supabase.from("adjuntos_cancion").delete().eq("id", adjunto.id);
  if (error) throw error;
  if (adjunto.ruta) await supabase.storage.from(BUCKET).remove([adjunto.ruta]).catch(() => {});
}

export async function renombrarAdjunto(adjunto, titulo) {
  const limpio = (titulo || "").trim().slice(0, 80);
  if (!limpio) throw new Error("Escribe un nombre.");
  const { data, error } = await supabase.from("adjuntos_cancion").update({ titulo: limpio }).eq("id", adjunto.id).select().single();
  if (error) throw error;
  return data;
}
