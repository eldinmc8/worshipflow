import { supabase } from "./supabaseClient.js";

// Catálogo fijo de permisos que un rol puede tener activado/desactivado — cada uno corresponde a
// una acción real que ya existe en la app (ver PrototipoWorshipFlow.jsx: canControlLive, canStartLive,
// esSupervisorViewer, isAdminViewer). Agregar un permiso nuevo aquí no hace nada por sí solo: hay que
// además wirearlo en el punto del código que hoy decide esa acción.
export const PERMISOS_APP = [
  { clave: "iniciar_finalizar_vivo", etiqueta: "Iniciar y finalizar el culto en vivo", detalle: "Puede empezar y terminar la transmisión de un evento." },
  { clave: "controlar_estilo_vivo", etiqueta: "Controlar el estilo de la proyección en vivo", detalle: "Puede cambiar fondo, tipografía y tamaño mientras se transmite." },
  { clave: "ver_canciones", etiqueta: "Ver canciones y acordes", detalle: "Tiene la pestaña Canciones para repasar el cancionero cuando quiera, aunque esa semana no esté asignado. (Si está en Alabanza en un evento, ve esas canciones desde el evento de todas formas.)" },
  { clave: "ver_todos_eventos", etiqueta: "Ver todos los eventos", detalle: "Ve todos los cultos aunque no esté asignado a ellos — no puede editarlos si no tiene además algún permiso de editar." },
  // editar_eventos_setlist sigue siendo el interruptor "todo en uno" (lo sigue usando isAdminViewer
  // directo en el código) — los 3 de abajo son más finos: cada uno amplía isAdminViewer SOLO en su
  // propia área, así un rol puede, por ejemplo, editar el Setlist sin poder tocar la lista de
  // usuarios ni crear eventos nuevos. Tenerlos activos a los 3 equivale a tener el de arriba.
  { clave: "editar_eventos_setlist", etiqueta: "Todo lo de abajo junto (eventos, setlist, canciones y ministerios)", detalle: "Crear eventos nuevos, editar el setlist de cualquier evento, gestionar el cancionero y los ministerios — los 3 permisos de abajo juntos en uno solo." },
  { clave: "editar_setlist", etiqueta: "Editar el Setlist de los eventos", detalle: "Agregar/quitar canciones, versículos, slides y bloques; reordenar; cambiar la tonalidad de una canción solo para ese evento; agregar encargados y equipo de alabanza. No crea eventos nuevos por sí solo." },
  { clave: "gestionar_canciones", etiqueta: "Gestionar el cancionero", detalle: "Crear, editar, transportar de tonalidad (de forma permanente) y borrar canciones de la biblioteca." },
  { clave: "gestionar_ministerios", etiqueta: "Gestionar ministerios", detalle: "Crear ministerios, editar su planificación mensual, sus recursos y asignarles líder." },
  // Fuera de la lista a propósito hasta que se wireen de verdad (mostrarlos sin efecto confundía):
  // usar_asistente_ia (la Edge Function asistente-chat exige Administrador real), gestionar_usuarios y
  // gestionar_roles (esas pantallas son solo del Administrador real, y la RLS de roles_app solo deja
  // escribir a rol = 'admin'). El rol Administrador en la base todavía los tiene en true — no estorba.
];

export async function listarRoles() {
  const { data, error } = await supabase.from("roles_app").select("*").order("orden");
  if (error) throw error;
  return data;
}

export async function crearRol({ nombre, permisos }) {
  const { count } = await supabase.from("roles_app").select("id", { count: "exact", head: true });
  const { data, error } = await supabase.from("roles_app").insert({ nombre: nombre.trim(), permisos: permisos || {}, orden: count ?? 0 }).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarRol(id, patch) {
  const { error } = await supabase.from("roles_app").update(patch).eq("id", id);
  if (error) throw error;
}

// No deja borrar el rol protegido, ni un rol que todavía tiene gente asignada — evita que alguien
// se quede sin rol de un momento a otro sin darse cuenta.
export async function eliminarRol(id) {
  const { data: rol } = await supabase.from("roles_app").select("protegido").eq("id", id).single();
  if (rol?.protegido) throw new Error("Este rol está protegido y no se puede eliminar.");
  const { count } = await supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("rol_id", id);
  if ((count ?? 0) > 0) throw new Error(`Todavía hay ${count} persona(s) con este rol — cámbialas de rol primero.`);
  const { error } = await supabase.from("roles_app").delete().eq("id", id);
  if (error) throw error;
}
