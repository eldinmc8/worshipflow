import { supabase } from "./supabaseClient.js";

// Llave pública VAPID: no es secreta (por eso va embebida acá) — la privada vive solo como secreto
// de las Edge Functions notificar-asignacion/procesar-recordatorios, nunca en el frontend.
const VAPID_PUBLIC_KEY = "BND4hfZ-SGDp7ZS3J8JE0rz0aLZNZReqUvHQePoWQ7ou1-vEg0MQ9tN7Guy8lJXezkd-wXb_3nWqVzRUX2TgGtE";

export async function listMisNotificaciones(usuarioId) {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function marcarLeida(id) {
  const { error } = await supabase.from("notificaciones").update({ leido: true }).eq("id", id);
  if (error) throw error;
}

export async function marcarTodasLeidas(usuarioId) {
  const { error } = await supabase.from("notificaciones").update({ leido: true }).eq("usuario_id", usuarioId).eq("leido", false);
  if (error) throw error;
}

// Se suscribe en tiempo real a notificaciones NUEVAS de este usuario (para que la campanita del
// header actualice su contador solo, sin recargar) — mismo patrón que subscribeLiveSession en
// src/lib/liveSession.js. Devuelve una función para cancelar la suscripción al desmontar.
export function subscribeNotificaciones(usuarioId, onInsert) {
  const channel = supabase
    .channel(`notificaciones_${usuarioId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${usuarioId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Pide permiso de notificaciones, se suscribe a Web Push en este dispositivo/navegador y guarda la
// suscripción en Supabase — a partir de acá, las Edge Functions ya le pueden mandar push de verdad.
export async function suscribirPush(usuarioId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Este navegador no admite notificaciones push.");
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") throw new Error("No diste permiso para las notificaciones.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const raw = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { usuario_id: usuarioId, endpoint: raw.endpoint, p256dh: raw.keys.p256dh, auth: raw.keys.auth },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function estaSuscritoPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

export async function desuscribirPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

// A diferencia de estaSuscritoPush() (que solo mira ESTE navegador/dispositivo), esto pregunta si la
// persona tiene AL MENOS UNA suscripción guardada en la base, en cualquier dispositivo — para decidir
// si mostrarle el aviso de "activa tus notificaciones": alguien que ya las activó en su celular no
// debería ver el aviso otra vez solo porque hoy entró desde la computadora.
export async function tieneAlgunaSuscripcionPush(usuarioId) {
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// "default" (nunca se le preguntó) | "granted" | "denied" (el navegador lo bloqueó -- volver a pedir
// permiso ya no hace nada, solo mostrar instrucciones) | "sin-soporte".
export function estadoPermisoNotificacion() {
  if (!("Notification" in window)) return "sin-soporte";
  return Notification.permission;
}

// Qué hacer al abrir la app, dado el estado real de esta persona — función pura (sin DOM, sin red)
// para poder probarla sola. Tres casos:
// - "granted" sin suscripción en la base: se perdió (reinstaló la app, cambió de teléfono, limpió
//   datos del sitio) pero el permiso del navegador SIGUE concedido -- se puede reinscribir sola, sin
//   preguntarle nada (con el permiso ya dado, el navegador no vuelve a mostrar ningún diálogo).
// - "default" o "denied" sin suscripción: ahí sí hace falta mostrarle el aviso (con instrucciones de
//   desbloqueo si está "denied").
// - ya tiene alguna suscripción, o este navegador no soporta push: no hay nada que hacer.
export function decidirAccionPush({ tieneSuscripcion, permiso }) {
  if (tieneSuscripcion || permiso === "sin-soporte") return "nada";
  if (permiso === "granted") return "reinscribir-en-silencio";
  return "mostrar-aviso"; // "default" | "denied"
}
