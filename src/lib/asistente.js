import { callUsersFunction } from "./supabaseClient.js";

// Manda el historial de la conversación (solo texto, sin bloques de tool_use crudos — ver por qué
// en asistente-chat/index.ts) y recibe o una respuesta de texto normal, o un plan propuesto que
// todavía no se guardó en ningún lado.
export function enviarMensajeAsistente(messages) {
  return callUsersFunction("asistente-chat", { mode: "chat", messages });
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
