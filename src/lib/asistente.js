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
