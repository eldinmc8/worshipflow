import { supabase } from "./supabaseClient.js";

// Notas por parte de la canción (ver migración 20261015000000_notas_seccion.sql).
export const DUENO_EQUIPO = "00000000-0000-0000-0000-000000000000";

// → { disponible, equipo: {clave: nota}, mias: {clave: nota} }. Si la tabla todavía no existe (falta
// correr la migración), disponible = false y la app simplemente no muestra el botón de notas.
export async function cargarNotas(cancionId, usuarioId) {
  const { data, error } = await supabase.from("notas_seccion").select("*").eq("cancion_id", cancionId);
  if (error) return { disponible: false, equipo: {}, mias: {} };
  const equipo = {};
  const mias = {};
  (data || []).forEach((n) => {
    if (!n.texto?.trim()) return;
    if (n.dueno_id === DUENO_EQUIPO) equipo[n.seccion_clave] = n;
    else if (n.dueno_id === usuarioId) mias[n.seccion_clave] = n;
  });
  return { disponible: true, equipo, mias };
}

// Guarda (o borra, si el texto queda vacío) una nota.
export async function guardarNota({ cancionId, seccionClave, duenoId, texto, nombre }) {
  const limpio = String(texto || "").trim();
  if (!limpio) {
    const { error } = await supabase.from("notas_seccion").delete().eq("cancion_id", cancionId).eq("seccion_clave", seccionClave).eq("dueno_id", duenoId);
    if (error) throw error;
    return null;
  }
  const fila = { cancion_id: cancionId, seccion_clave: seccionClave, dueno_id: duenoId, texto: limpio, editado_nombre: nombre || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("notas_seccion").upsert(fila, { onConflict: "cancion_id,seccion_clave,dueno_id" }).select().single();
  if (error) throw error;
  return data;
}
