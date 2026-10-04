import { supabase } from "./supabaseClient.js";

// Biblioteca de fondos (imágenes/videos) para Proyección en vivo — ver la migración
// 20261004000000_fondos_en_vivo_storage.sql. Un archivo subido una vez queda disponible para elegirlo
// de nuevo sin volver a subirlo, en cualquier diapositiva o en el fondo global de Estilo.
const BUCKET = "fondos-en-vivo";
export const FONDO_MAX_BYTES = { imagen: 8 * 1024 * 1024, video: 100 * 1024 * 1024 };
const MIME_POR_TIPO = {
  imagen: ["image/png", "image/jpeg", "image/webp"],
  video: ["video/mp4", "video/webm"],
};

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
  if (!MIME_POR_TIPO[tipo].includes(file.type)) {
    throw new Error(tipo === "imagen" ? "Debe ser una imagen (PNG, JPG o WEBP)." : "Debe ser un video (MP4 o WEBM).");
  }
  if (file.size > FONDO_MAX_BYTES[tipo]) {
    throw new Error(`No puede pesar más de ${Math.round(FONDO_MAX_BYTES[tipo] / (1024 * 1024))} MB.`);
  }
  const ruta = `${iglesiaId}/${tipo}/${Date.now()}-${sanitizarNombre(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: file.type });
  if (error) throw error;
  return urlPublica(ruta);
}

export async function borrarFondo(ruta) {
  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) throw error;
}
