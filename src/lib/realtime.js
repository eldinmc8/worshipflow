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
export function subscribeTableChanges(channelName, tables, onChange, debounceMs = 900) {
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
