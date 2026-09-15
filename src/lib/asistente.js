import { callUsersFunction } from "./supabaseClient.js";

// Manda el historial de la conversación (solo texto, sin bloques de tool_use crudos — ver por qué
// en asistente-chat/index.ts) y recibe o una respuesta de texto normal, o un plan propuesto que
// todavía no se guardó en ningún lado. `image` (opcional, { mediaType, data }) va SOLO en el
// último mensaje (el que se está mandando ahora) — no se vuelve a re-enviar en turnos siguientes,
// el historial de ahí en adelante sigue siendo puro texto.
export function enviarMensajeAsistente(messages, image) {
  return callUsersFunction("asistente-chat", { mode: "chat", messages, image: image || null });
}

// Aplica un plan ya confirmado por el administrador — recién acá se escribe algo de verdad.
export function aplicarPlanAsistente(plan) {
  return callUsersFunction("asistente-chat", { mode: "apply", plan });
}

// Reglas/excepciones fijas que el asistente siempre respeta, sin depender de ninguna conversación
// (ver botón "Reglas" en la pantalla del Asistente).
export function obtenerReglasAsistente() {
  return callUsersFunction("asistente-chat", { mode: "reglas_get" });
}
export function guardarReglasAsistente(reglas) {
  return callUsersFunction("asistente-chat", { mode: "reglas_set", reglas });
}
