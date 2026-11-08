// Videos por enlace en la proyección (arreglo del 2026-11-08: "pego el enlace y no pasa nada").
// La proyección usaba siempre un <video>, que solo sabe reproducir un ARCHIVO de video (.mp4, .webm…).
// Un enlace de YouTube o Vimeo es una página, no un archivo, así que la pantalla se quedaba en negro.
// Aquí se reconoce qué tipo de enlace es y cómo reproducirlo.

const idYouTube = (u) => {
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname);
    return m ? m[1] : null;
  }
  return null;
};

const idVimeo = (u) => {
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = /\/(?:video\/)?(\d+)/.exec(u.pathname);
  return m ? m[1] : null;
};

const idDrive = (u) => {
  if (!/(^|\.)drive\.google\.com$/.test(u.hostname)) return null;
  const m = /\/file\/d\/([^/]+)/.exec(u.pathname);
  return m ? m[1] : u.searchParams.get("id");
};

// Sitios que no dejan reproducir sus videos dentro de otra página.
const NO_SOPORTADOS = [/facebook\.com$/, /fb\.watch$/, /instagram\.com$/, /tiktok\.com$/, /twitter\.com$/, /(^|\.)x\.com$/];

// { tipo: "youtube" | "vimeo" | "archivo" | "no-soportado" | "vacio", id?, src, miniatura?, nombre }
// "archivo" incluye los subidos a la app, los .mp4 directos y Google Drive (su enlace de descarga directa).
export function tipoDeVideo(url) {
  const texto = String(url || "").trim();
  if (!texto) return { tipo: "vacio", src: "" };
  if (texto.startsWith("data:") || texto.startsWith("blob:")) return { tipo: "archivo", src: texto, nombre: "Video" };
  let u;
  try { u = new URL(texto); } catch { return { tipo: "no-soportado", src: texto, nombre: "Enlace no válido" }; }
  const yt = idYouTube(u);
  if (yt) return { tipo: "youtube", id: yt, src: texto, miniatura: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, nombre: "YouTube" };
  const vm = idVimeo(u);
  if (vm) return { tipo: "vimeo", id: vm, src: texto, nombre: "Vimeo" };
  const dr = idDrive(u);
  if (dr) return { tipo: "archivo", id: dr, src: `https://drive.google.com/uc?export=download&id=${dr}`, nombre: "Google Drive", drive: true };
  const host = u.hostname.replace(/^www\./, "");
  if (NO_SOPORTADOS.some((r) => r.test(host))) return { tipo: "no-soportado", src: texto, nombre: host };
  return { tipo: "archivo", src: texto, nombre: "Video" };
}

// Dirección para el <iframe> de YouTube/Vimeo. conSonido: video a pantalla completa (se ve una vez, con
// sonido); si no, es fondo de una diapositiva con texto (sin sonido, en bucle).
export function urlIncrustada(info, { conSonido }) {
  if (info?.tipo === "youtube") {
    const p = new URLSearchParams({ autoplay: "1", mute: conSonido ? "0" : "1", controls: "0", rel: "0", playsinline: "1", modestbranding: "1", iv_load_policy: "3", disablekb: "1" });
    if (!conSonido) { p.set("loop", "1"); p.set("playlist", info.id); }
    return `https://www.youtube-nocookie.com/embed/${info.id}?${p}`;
  }
  if (info?.tipo === "vimeo") {
    const p = conSonido
      ? new URLSearchParams({ autoplay: "1", muted: "0", title: "0", byline: "0", portrait: "0", dnt: "1" })
      : new URLSearchParams({ background: "1", autoplay: "1", muted: "1", loop: "1", dnt: "1" });
    return `https://player.vimeo.com/video/${info.id}?${p}`;
  }
  return null;
}

// Diapositiva que es SOLO un video (sin texto encima): se proyecta como video de verdad — con sonido,
// una sola vez y sin oscurecer. Con texto encima es un fondo: sin sonido y en bucle, como siempre.
export function esVideoSolo(slide) {
  return !!slide && slide.type === "slide" && slide.bgType === "video" && !!slide.videoUrl
    && !String(slide.title || "").trim() && !String(slide.subtitle || "").trim();
}

// Texto corto para el formulario: qué se detectó o por qué no se va a poder reproducir.
export function avisoDeEnlace(url) {
  const info = tipoDeVideo(url);
  if (info.tipo === "vacio") return null;
  if (info.tipo === "youtube") return { ok: true, texto: "✓ Video de YouTube. Se reproduce con sonido en la proyección." };
  if (info.tipo === "vimeo") return { ok: true, texto: "✓ Video de Vimeo. Se reproduce con sonido en la proyección." };
  if (info.drive) return { ok: true, texto: "Google Drive: el archivo debe estar compartido como «Cualquier persona con el enlace». Si no se ve, descárgalo y súbelo aquí." };
  if (info.tipo === "no-soportado") return { ok: false, texto: info.nombre === "Enlace no válido" ? "Ese enlace no es válido. Debe empezar con https://" : `Los videos de ${info.nombre} no se pueden proyectar desde otra app. Descárgalo y súbelo aquí, o usa un enlace de YouTube.` };
  return { ok: true, texto: "✓ Enlace a un archivo de video." };
}
