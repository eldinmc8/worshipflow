import { supabase } from "./supabaseClient.js";
import { recetaCompleta } from "./animaciones.js";

// Animaciones propias de la iglesia y galería compartida (ver la migración 20261018000000_animaciones_iglesia.sql).
// Si la tabla todavía no existe (migración sin aplicar), listar devuelve null y la app esconde esa parte en
// vez de fallar — igual que las plantillas de diapositivas.
const sinTabla = (error) => error && (error.code === "42P01" || error.code === "PGRST205" || /animaciones_iglesia/.test(error.message || ""));

export async function listarAnimaciones(iglesiaId) {
  const { data, error } = await supabase
    .from("animaciones_iglesia")
    .select("id, iglesia_id, nombre, receta, compartida, autor_iglesia, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) { if (sinTabla(error)) return null; throw error; }
  const filas = (data || []).map((f) => ({ ...f, receta: recetaCompleta(f.receta) }));
  return {
    mias: filas.filter((f) => f.iglesia_id === iglesiaId),
    galeria: filas.filter((f) => f.iglesia_id !== iglesiaId && f.compartida),
  };
}

export async function guardarAnimacion({ id, iglesiaId, nombre, receta, compartida, autorIglesia, usuarioId }) {
  const fila = { iglesia_id: iglesiaId, nombre: nombre.trim().slice(0, 60) || "Mi animación", receta: recetaCompleta(receta), compartida: !!compartida, autor_iglesia: autorIglesia || null, updated_at: new Date().toISOString() };
  if (id) {
    const { data, error } = await supabase.from("animaciones_iglesia").update(fila).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("animaciones_iglesia").insert({ ...fila, creado_por: usuarioId || null }).select().single();
  if (error) throw error;
  return data;
}

export async function borrarAnimacion(id) {
  const { error } = await supabase.from("animaciones_iglesia").delete().eq("id", id);
  if (error) throw error;
}
