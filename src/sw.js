import { precacheAndRoute } from "workbox-precaching";

// vite-plugin-pwa (modo injectManifest) reemplaza esto por la lista real de archivos a precachear
// en cada build — mismo precache que ya traía el modo generateSW, solo que ahora el archivo del
// service worker es nuestro (para poder agregar los listeners de push de abajo, que generateSW no
// permite personalizar).
precacheAndRoute(self.__WB_MANIFEST);

// No self.skipWaiting() automático en "install": con registerType "prompt", el SW nuevo debe
// quedarse en estado "waiting" hasta que la persona toque "Actualizar" (ver swUpdate.js). Si
// esto llamara skipWaiting() solo, nunca habría un SW esperando y el aviso nunca se mostraría.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Notificación push real (Web Push / VAPID) — la manda notificar-asignacion o procesar-recordatorios
// desde el servidor. El payload es JSON simple: { title, body, url? }.
self.addEventListener("push", (event) => {
  let data = { title: "JBP App", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "JBP App", {
      body: data.body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      data: { url: data.url || "/" },
    })
  );
});

// Al tocar la notificación: enfoca una pestaña de la app ya abierta si existe, si no abre una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.startsWith(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
