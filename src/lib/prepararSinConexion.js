// "Preparar para usar sin conexión" (pedido de Eldin, 2026-11-14): una iglesia sin internet el domingo
// necesita dejar todo guardado en la computadora de multimedia ANTES, con Wi-Fi, y saber que sí quedó.
// Aquí van las partes que se pueden probar solas; la pantalla está en components/PrepararSinConexion.jsx.
//
// Qué se guarda y dónde (todo ya existía, esto solo lo junta y lo comprueba):
//  - La app misma: service worker (src/sw.js).
//  - Canciones, eventos y ministerios: localStorage (lib/offlineCache.js).
//  - Imágenes de fondo: caché "wf-imagenes" del service worker.
//  - Biblia: IndexedDB (lib/bibleOfflineStore.js).
// Los VIDEOS de fondo no se guardan (pesan mucho): se avisa cuáles diapositivas los usan.

export const CACHE_IMAGENES = "wf-imagenes";
const VIDEO = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const RUTA_STORAGE = "/storage/v1/object/public/";
const PLATAFORMAS_VIDEO = /(youtube\.com|youtu\.be|vimeo\.com)/i;

// Recorre cualquier estructura (items del evento, canciones, estilo) y junta los enlaces a medios.
// - imagenes: las que el service worker sí guarda (de la app o subidas a WorshipFlow).
// - externas: imágenes de otro sitio web; sin internet no cargan.
// - videos: archivos de video (no se guardan) y enlaces de YouTube/Vimeo (necesitan internet).
export function recolectarMedios(...fuentes) {
  const imagenes = new Set();
  const externas = new Set();
  const videos = new Set();
  const visto = new WeakSet();
  const mirar = (v, profundidad) => {
    if (profundidad > 8 || v == null) return;
    if (typeof v === "string") {
      if (v.length > 2048 || v.startsWith("data:")) return;
      const esAbsoluta = /^https?:\/\//i.test(v);
      const esRuta = /^\/[^/\s]/.test(v);
      if (!esAbsoluta && !esRuta) return;
      if (VIDEO.test(v) || PLATAFORMAS_VIDEO.test(v)) { videos.add(v); return; }
      const esImagen = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(v) || v.includes(RUTA_STORAGE);
      if (!esImagen) return;
      if (esRuta || v.includes(RUTA_STORAGE) || v.startsWith(globalThis.location?.origin || "\u0000")) imagenes.add(v);
      else externas.add(v);
      return;
    }
    if (typeof v !== "object") return;
    if (visto.has(v)) return;
    visto.add(v);
    if (Array.isArray(v)) { for (const x of v) mirar(x, profundidad + 1); return; }
    for (const k of Object.keys(v)) mirar(v[k], profundidad + 1);
  };
  for (const f of fuentes) mirar(f, 0);
  return { imagenes: [...imagenes], externas: [...externas], videos: [...videos] };
}

// De una lista de eventos: los items (setlist) y las canciones que usan.
export function fuentesDeEventos(eventos, canciones) {
  const ids = new Set();
  for (const ev of eventos) for (const it of ev.serviceOrder || []) if (it.songId) ids.add(it.songId);
  return { items: eventos.map((e) => e.serviceOrder || []), canciones: (canciones || []).filter((c) => ids.has(c.id)) };
}

// Guarda en localStorage y comprueba que de verdad quedó (offlineCache.saveCache se traga el error de
// "no cabe", y un cancionero de cientos de canciones puede no caber en ~5 MB).
export function guardarYVerificar(clave, datos, prefijo = "worshipflow_cache_") {
  try {
    localStorage.setItem(prefijo + clave, JSON.stringify({ data: datos, savedAt: Date.now() }));
    const vuelta = JSON.parse(localStorage.getItem(prefijo + clave) || "null")?.data;
    return Array.isArray(datos) ? Array.isArray(vuelta) && vuelta.length === datos.length : vuelta != null;
  } catch {
    return false;
  }
}

// Canciones: si el cancionero completo no cabe, se guardan al menos las de los eventos próximos.
// Devuelve { completo: bool, guardadas: n, total: n }.
export function guardarCanciones(canciones, usadas) {
  if (guardarYVerificar("canciones", canciones)) return { completo: true, guardadas: canciones.length, total: canciones.length };
  if (guardarYVerificar("canciones", usadas)) return { completo: false, guardadas: usadas.length, total: canciones.length };
  return { completo: false, guardadas: 0, total: canciones.length };
}

// Baja las imágenes a la caché del service worker (la misma que ya usa para servirlas sin internet).
// onProgreso(hechas, total). Devuelve { guardadas, fallidas: [url] }.
export async function guardarImagenes(urls, { onProgreso, cachesApi = globalThis.caches, fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
  const fallidas = [];
  let guardadas = 0;
  if (!urls.length) return { guardadas, fallidas };
  if (!cachesApi || !fetchFn) return { guardadas, fallidas: [...urls] };
  const cache = await cachesApi.open(CACHE_IMAGENES);
  let hechas = 0;
  for (const url of urls) {
    try {
      if (await cache.match(url)) {
        guardadas++;
      } else {
        let r;
        try { r = await fetchFn(url, { credentials: "omit" }); } catch { r = await fetchFn(url, { mode: "no-cors", credentials: "omit" }); }
        if (!r || (!r.ok && r.type !== "opaque")) throw new Error("respuesta " + r?.status);
        await cache.put(url, r);
        guardadas++;
      }
    } catch {
      fallidas.push(url);
    }
    hechas++;
    onProgreso?.(hechas, urls.length);
  }
  return { guardadas, fallidas };
}

// ¿Quedó la app guardada para abrir sin internet? Revisa el service worker y su copia.
export async function appGuardada({ nav = globalThis.navigator, cachesApi = globalThis.caches } = {}) {
  try {
    if (!nav?.serviceWorker || !cachesApi) return false;
    const reg = await nav.serviceWorker.getRegistration();
    if (!reg?.active) return false;
    const copia = await cachesApi.match("/index.html", { ignoreSearch: true });
    return !!copia;
  } catch {
    return false;
  }
}

// ¿Cuántas de estas imágenes ya están guardadas?
export async function contarImagenesGuardadas(urls, cachesApi = globalThis.caches) {
  if (!urls.length) return 0;
  try {
    const cache = await cachesApi.open(CACHE_IMAGENES);
    let n = 0;
    for (const u of urls) if (await cache.match(u)) n++;
    return n;
  } catch {
    return 0;
  }
}

// Eventos que faltan por hacerse (con el mismo criterio que "Próximos").
export function eventosProximos(eventos, esProximo) {
  return (eventos || []).filter((e) => !e.esPlantilla && esProximo(e));
}
