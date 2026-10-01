import { supabase } from "./supabaseClient.js";

// Catálogo fijo de permisos que un rol puede tener activado/desactivado — cada uno corresponde a
// una acción real que ya existe en la app (ver PrototipoWorshipFlow.jsx: canControlLive, canStartLive,
// esSupervisorViewer, isAdminViewer). Agregar un permiso nuevo aquí no hace nada por sí solo: hay que
// además wirearlo en el punto del código que hoy decide esa acción.
// Agrupados por área de la iglesia (grupo) para que la pantalla de Roles se lea de un vistazo.
// "incluye": activar ese permiso ya da los otros (se muestran encendidos y bloqueados, y el código
// en PrototipoWorshipFlow.jsx aplica la misma regla), así el administrador no tiene que adivinar
// combinaciones.
//
// Fuera de la lista a propósito:
// - editar_eventos_setlist: el viejo "todo en uno". Lo sigue leyendo isAdminViewer en el código y
//   solo lo tiene el rol Administrador (protegido, ya tiene todo). Se reemplazó por los finos de abajo.
// - usar_asistente_ia, gestionar_usuarios, gestionar_roles: son solo del Administrador real (la Edge
//   Function y la RLS de usuarios/roles_app/iglesias exigen rol = 'admin'). Además, dejar que un rol
//   no-admin gestione usuarios o roles le permitiría darse a sí mismo más permisos.
export const GRUPOS_PERMISOS = ["Eventos", "Canciones", "Ministerios", "En vivo"];

export const PERMISOS_APP = [
  { clave: "ver_todos_eventos", grupo: "Eventos", etiqueta: "Ver todos los eventos", detalle: "Aunque no esté asignado. Solo mirar." },
  { clave: "editar_setlist", grupo: "Eventos", etiqueta: "Editar el Setlist", detalle: "Canciones, versículos, slides, bloques, orden, tonalidad para ese evento y encargados.", incluye: ["ver_todos_eventos"] },
  { clave: "gestionar_eventos", grupo: "Eventos", etiqueta: "Organizar eventos", detalle: "Crear eventos y plantillas, cambiar fecha y hora, recordatorios, publicar y eliminar.", incluye: ["ver_todos_eventos", "editar_setlist"] },
  { clave: "ver_canciones", grupo: "Canciones", etiqueta: "Ver el cancionero", detalle: "La pestaña Canciones con letras y acordes." },
  { clave: "gestionar_canciones", grupo: "Canciones", etiqueta: "Gestionar canciones", detalle: "Crear, editar, cambiar la tonalidad original y borrar canciones.", incluye: ["ver_canciones"] },
  { clave: "gestionar_ministerios", grupo: "Ministerios", etiqueta: "Gestionar ministerios", detalle: "Crear ministerios, su planificación, recursos y líder." },
  { clave: "iniciar_finalizar_vivo", grupo: "En vivo", etiqueta: "Iniciar y finalizar el culto en vivo", detalle: "Desde una computadora." },
  { clave: "controlar_estilo_vivo", grupo: "En vivo", etiqueta: "Cambiar el estilo de la proyección", detalle: "Fondo, letra y tamaño mientras se transmite." },
];

// ¿Este permiso está encendido porque otro activo ya lo incluye?
export function permisoIncluidoPor(clave, permisos) {
  return PERMISOS_APP.find((p) => permisos?.[p.clave] && p.incluye?.includes(clave)) || null;
}

// Puntos de partida al crear un rol: un toque y el rol queda casi listo, en vez de revisar cada
// interruptor. Después se puede ajustar lo que haga falta.
export const PLANTILLAS_ROL = [
  { nombre: "Líder de alabanza", permisos: { gestionar_canciones: true, editar_setlist: true } },
  { nombre: "Coordinador de eventos", permisos: { gestionar_eventos: true } },
  { nombre: "Líder de ministerio", permisos: { gestionar_ministerios: true } },
  { nombre: "Equipo de proyección", permisos: { iniciar_finalizar_vivo: true, controlar_estilo_vivo: true } },
  { nombre: "Pastor / Supervisor", permisos: { ver_todos_eventos: true, ver_canciones: true } },
];

// Resumen corto de lo que puede hacer un rol, para la lista de roles (ej. "Eventos · Canciones").
export function resumenPermisos(rol) {
  if (rol.protegido) return "Control total";
  const activos = PERMISOS_APP.filter((p) => rol.permisos?.[p.clave] || permisoIncluidoPor(p.clave, rol.permisos));
  if (activos.length === 0) return "Solo lo que le asignen";
  return [...new Set(activos.map((p) => p.grupo))].join(" · ");
}

export async function listarRoles() {
  const { data, error } = await supabase.from("roles_app").select("*").order("orden");
  if (error) throw error;
  return data;
}

// El nombre de un rol es único dentro de la iglesia (roles_app_iglesia_nombre_key).
const errorRol = (error) => (error.code === "23505" ? new Error("Ya existe un rol con ese nombre en tu iglesia.") : error);

export async function crearRol({ nombre, permisos }) {
  const { count } = await supabase.from("roles_app").select("id", { count: "exact", head: true });
  const { data, error } = await supabase.from("roles_app").insert({ nombre: nombre.trim(), permisos: permisos || {}, orden: count ?? 0 }).select().single();
  if (error) throw errorRol(error);
  return data;
}

export async function actualizarRol(id, patch) {
  const { error } = await supabase.from("roles_app").update(patch).eq("id", id);
  if (error) throw errorRol(error);
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
