import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// vite-plugin-pwa (modo injectManifest) reemplaza esto por la lista real de archivos a precachear
// en cada build — mismo precache que ya traía el modo generateSW, solo que ahora el archivo del
// service worker es nuestro (para poder agregar los listeners de push de abajo, que generateSW no
// permite personalizar).
precacheAndRoute(self.__WB_MANIFEST);

// ---- Sin internet (pedido de Eldin, 2026-10-17) ----
// 1) Abrir o recargar CUALQUIER pantalla de la app sin señal (incluida la de proyección,
//    ?screen=publico&igl=...): se sirve la app guardada en vez de la página de "sin conexión".
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));
// 2) Las letras tipográficas (Google Fonts): sin esto, una proyección recargada sin internet salía con
//    una letra genérica. Se guardan la primera vez que se usan.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "wf-fuentes-css" })
);
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "wf-fuentes",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);
// 3) Fondos e imágenes de diapositivas (las de la app y las subidas por la iglesia): una vez que se
//    vieron con internet, siguen saliendo sin él.
registerRoute(
  ({ request, url }) => request.destination === "image" && (url.origin === self.location.origin || url.pathname.startsWith("/storage/v1/object/public/")),
  new CacheFirst({
    cacheName: "wf-imagenes",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 })],
  })
);

// Actualización automática (pedido de Eldin, 2026-10-09): el SW nuevo se activa solo apenas se
// instala, sin esperar a que alguien toque "Actualizar". Al tomar control, la página se recarga sola
// (listener "controllerchange" de swUpdate.js — que ya estaba en las versiones anteriores, así que
// también los equipos que todavía tienen la versión vieja abierta se actualizan solos).
// Cambio (pedido de Eldin, 2026-10-25: "publícalo solo para los dispositivos que den actualizar, así no
// se altera la computadora que está transmitiendo"): la versión nueva ya NO se activa sola al instalarse.
// Queda esperando y solo toma el control:
//  - cuando la propia app lo pide con { manual: true } (desde esta versión la app lo pide sola apenas
//    detecta una versión nueva, así que de aquí en adelante todo vuelve a actualizarse solo), o
//  - cuando se cierran todas las ventanas de la app y se vuelve a abrir (comportamiento normal).
// Las versiones viejas mandan { type: "SKIP_WAITING" } sin "manual" apenas detectan una versión nueva:
// eso se ignora, así una consola en pleno culto no se recarga sola.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING" && event.data.manual) self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Notificación push real (Web Push / VAPID) — la manda notificar-asignacion o procesar-recordatorios
// desde el servidor. El payload es JSON simple: { title, body, url? }.
self.addEventListener("push", (event) => {
  let data = { title: "WorshipFlow", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "WorshipFlow", {
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
