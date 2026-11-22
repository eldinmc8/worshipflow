import { supabase } from "./supabaseClient.js";

// Biblioteca de fondos (imágenes/videos) para Proyección en vivo — ver la migración
// 20261004000000_fondos_en_vivo_storage.sql. Un archivo subido una vez queda disponible para elegirlo
// de nuevo sin volver a subirlo, en cualquier diapositiva o en el fondo global de Estilo.
const BUCKET = "fondos-en-vivo";
// Video: 50 MB es el máximo por archivo del plan gratis de Supabase (2026-11-15). Antes decía 100 MB y un video de
// 50-100 MB fallaba con el error en inglés "The object exceeded the maximum allowed size".
export const FONDO_MAX_BYTES = { imagen: 8 * 1024 * 1024, video: 50 * 1024 * 1024, audio: 30 * 1024 * 1024 };
const mb = (bytes) => Math.round(bytes / (1024 * 1024));
const mensajeMuyPesado = (tipo, size) => tipo === "audio"
  ? `Este audio pesa ${mb(size)} MB y el máximo es ${mb(FONDO_MAX_BYTES.audio)} MB. Prueba guardarlo como MP3.`
  : tipo === "video"
  ? `Este video pesa ${mb(size)} MB y el máximo es ${mb(FONDO_MAX_BYTES.video)} MB. Súbelo a YouTube (como «No listado») o a Google Drive y pega el enlace aquí.`
  : `Esta imagen pesa ${mb(size)} MB y el máximo es ${mb(FONDO_MAX_BYTES.imagen)} MB.`;
const MIME_POR_TIPO = {
  imagen: ["image/png", "image/jpeg", "image/webp"],
  video: ["video/mp4", "video/webm"],
  // Audio (2026-11-22, diapositiva de audio y música de los botones rápidos). Necesita que el bucket
  // acepte estos tipos: migración 20261125000000_audio_en_fondos.sql.
  audio: ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg", "audio/webm"],
};
const MENSAJE_TIPO = { imagen: "Debe ser una imagen (PNG, JPG o WEBP).", video: "Debe ser un video (MP4 o WEBM).", audio: "Debe ser un audio (MP3, M4A, WAV u OGG)." };

function sanitizarNombre(nombre) {
  return (nombre || "fondo").replace(/[^a-zA-Z0-9.\-]/g, "_").slice(-80);
}

function urlPublica(ruta) {
  return supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
}

// Todo lo ya subido de este tipo ("imagen" o "video") para esta iglesia, más reciente primero.
export async function listarFondos(iglesiaId, tipo) {
  const carpeta = `${iglesiaId}/${tipo}`;
  const { data, error } = await supabase.storage.from(BUCKET).list(carpeta, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  return (data || [])
    .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
    .map((f) => ({ ruta: `${carpeta}/${f.name}`, nombre: f.name, url: urlPublica(`${carpeta}/${f.name}`), creadoEn: f.created_at }));
}

export async function subirFondo(iglesiaId, tipo, file) {
  // Windows a veces no le da tipo a un .mp3/.m4a: se deduce por la extensión.
  const EXT_AUDIO = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg" };
  const tipoArchivo = file.type || (tipo === "audio" ? EXT_AUDIO[String(file.name || "").split(".").pop().toLowerCase()] || "" : "");
  if (!MIME_POR_TIPO[tipo].includes(tipoArchivo)) {
    throw new Error(MENSAJE_TIPO[tipo] || MENSAJE_TIPO.video);
  }
  if (file.size > FONDO_MAX_BYTES[tipo]) throw new Error(mensajeMuyPesado(tipo, file.size));
  const ruta = `${iglesiaId}/${tipo}/${Date.now()}-${sanitizarNombre(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: tipoArchivo });
  if (error) {
    // Si el servidor igual lo rechaza por tamaño, el aviso en español (nunca el de Supabase en inglés).
    if (/maximum allowed size|exceeded|payload too large|413/i.test(`${error.message} ${error.statusCode ?? ""}`)) throw new Error(mensajeMuyPesado(tipo, file.size));
    // El bucket todavía no acepta audio (falta correr el SQL): aviso claro en vez del error en inglés.
    if (tipo === "audio" && /mime|not supported|invalid.*type/i.test(String(error.message))) throw new Error("Todavía no se pueden subir audios: falta un ajuste en la base de datos. Mientras tanto pega el enlace del audio.");
    throw error;
  }
  return urlPublica(ruta);
}

// Páginas de una presentación importada (PDF, Canva, PowerPoint exportado...) — ver
// importarPresentacion.js. Van en su propia carpeta "<iglesia>/presentaciones/..." para no mezclarse con
// la biblioteca de fondos (listarFondos solo mira ".../imagen" y ".../video"); mismo bucket y mismas
// reglas de acceso (el primer segmento de la ruta es la iglesia).
export async function subirPaginaPresentacion(iglesiaId, blob, nombre) {
  const ruta = `${iglesiaId}/presentaciones/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizarNombre(nombre)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw error;
  return urlPublica(ruta);
}

export async function borrarFondo(ruta) {
  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) throw error;
}
