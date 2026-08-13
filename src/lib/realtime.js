import { supabase } from "./supabaseClient.js";

// Se suscribe a INSERT/UPDATE/DELETE de una o más tablas y llama a onChange() cuando algo cambia — así
// Canciones/Eventos/Ministerios se actualizan solos en todos los dispositivos conectados, sin tener que
// recargar la página. Cada tabla dispara por separado (ej. un evento trae eventos + items_servicio +
// roles_evento + miembros_rol + recordatorios_evento a la vez), así que se juntan varios cambios
// seguidos en un solo refresco con un debounce, en vez de recargar una vez por cada fila que cambió.
//
// Mientras alguien está escribiendo en un campo de texto en CUALQUIER parte de la pantalla, el refresco
// se pospone (reintenta más adelante) en vez de reemplazar los datos de golpe — así un cambio remoto
// nunca le borra a alguien lo que está escribiendo a mitad de una edición.
//
// El debounce en sí (2.5s) también importa por otra razón: varias de estas tablas se sincronizan con un
// patrón "borra todo lo del padre y reinserta" (ver sincronizarServiceOrder/sincronizarPlan/etc.) — hay
// una ventana breve, entre el DELETE y el INSERT de ESE MISMO guardado, en la que la fila "no existe
// todavía". Un debounce corto podía alcanzar a refrescar justo en esa ventana y traer un estado a medias.
// No es una garantía perfecta (por eso además Ministerios ya no guarda letra por letra, solo con el
// botón "Guardar planificación"), pero le da mucho más margen a que el guardado en curso ya haya
// terminado antes de que el refresco compita con él.
export function subscribeTableChanges(channelName, tables, onChange, debounceMs = 2500) {
  let timer = null;
  const attempt = () => {
    const el = document.activeElement;
    const isTyping = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if (isTyping) { timer = setTimeout(attempt, debounceMs); return; }
    onChange();
  };
  const trigger = () => { clearTimeout(timer); timer = setTimeout(attempt, debounceMs); };

  let channel = supabase.channel(channelName);
  tables.forEach((table) => {
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, trigger);
  });
  channel.subscribe();

  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}
