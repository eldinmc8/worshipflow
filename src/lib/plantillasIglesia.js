import { supabase } from "./supabaseClient.js";

// "Guardar como mi plantilla" (editor de diapositivas, fase 2 — pedido de Eldin, 2026-10-11): cada
// iglesia guarda sus propios diseños (tabla plantillas_diapositivas, ver migración 20261011000000) y
// aparecen en Plantillas junto a las de fábrica. RLS: cada quien solo ve las de su iglesia.
// Si la tabla todavía no existe (migración sin aplicar), listar devuelve null y el editor esconde la
// sección en vez de fallar.

export async function listarPlantillasIglesia() {
  const { data, error } = await supabase.from("plantillas_diapositivas").select("id, nombre, diapositiva, created_at").order("created_at", { ascending: false });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || "")) return null;
    throw error;
  }
  return data || [];
}

export async function guardarPlantillaIglesia(nombre, diapositiva) {
  const { data, error } = await supabase.from("plantillas_diapositivas").insert({ nombre, diapositiva }).select("id, nombre, diapositiva, created_at").single();
  if (error) throw error;
  return data;
}

export async function borrarPlantillaIglesia(id) {
  const { error } = await supabase.from("plantillas_diapositivas").delete().eq("id", id);
  if (error) throw error;
}
