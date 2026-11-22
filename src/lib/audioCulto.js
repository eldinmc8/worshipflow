// Audio del culto (pedido de Eldin, 2026-11-22): música de fondo que ponen los botones de un solo toque
// (ver lib/botonesRapidos.js) y el audio de una "diapositiva de audio" del orden del culto.
//
// - Suena en la COMPUTADORA DE LA CONSOLA (no en la pantalla de proyección): así Multimedia la controla
//   y la oye, y sale por la "Salida de audio de los videos" elegida en Ajustes (lib/salidaAudio.js),
//   que normalmente va a la consola de sonido.
// - Un solo reproductor: lo nuevo reemplaza a lo que sonaba, con un fundido corto para que no corte feo.
// - Sirve un archivo subido a la biblioteca o un enlace directo a un audio/video (.mp3, .m4a, .wav,
//   .ogg, .mp4). YouTube y Spotify no se pueden: no dejan reproducir su audio fuera de su página.
// - origen: "musica" (de un botón rápido, sigue sonando al cambiar de diapositiva) o "diapositiva"
//   (la consola la baja sola al pasar a otra cosa, salvo que la diapositiva diga "seguir sonando").
import { useEffect, useState } from "react";
import { aplicarSalidaAudio, escucharSalidaAudio } from "./salidaAudio.js";

export const FUNDIDO_ENTRADA_MS = 1200;
export const FUNDIDO_SALIDA_MS = 3000;

const VACIO = { url: null, nombre: "", origen: null, clave: null, sonando: false, volumen: 1, repetir: false, seguir: false, error: "" };
let estado = { ...VACIO };
let el = null;
let fundido = null;
let alTerminar = null;
const oyentes = new Set();

function avisar(cambios) {
  estado = { ...estado, ...cambios };
  oyentes.forEach((fn) => fn(estado));
}

// Nombre legible de un enlace: "https://…/1700000-Himno_de_entrada.mp3" → "Himno de entrada".
export function nombreDeAudio(url) {
  if (!url) return "";
  try {
    const ultimo = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    const sinNumero = ultimo.replace(/^\d{10,}-/, "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_-]+/g, " ").trim();
    return sinNumero || "Audio";
  } catch {
    return "Audio";
  }
}

// ¿Se puede reproducir este enlace aquí? { ok, texto } para avisar al pegarlo.
export function avisoEnlaceAudio(url) {
  const u = String(url || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) return { ok: false, texto: "Pega un enlace que empiece con https://" };
  if (/youtu\.?be|spotify\.com|music\.apple|soundcloud\.com/i.test(u)) return { ok: false, texto: "YouTube, Spotify y SoundCloud no dejan sacar su audio. Sube el archivo (MP3) desde tu equipo." };
  if (/drive\.google\.com/i.test(u)) return { ok: false, texto: "Google Drive no deja reproducir audio fuera de su página. Sube el archivo (MP3) desde tu equipo." };
  return { ok: true, texto: "Listo: se escuchará en la computadora de la consola." };
}

// Volumen en cada paso de un fundido (0 a 1). Separado para poder probarlo.
export function volumenEnFundido(desde, hasta, transcurridoMs, duracionMs) {
  if (duracionMs <= 0 || transcurridoMs >= duracionMs) return hasta;
  const t = Math.max(0, transcurridoMs) / duracionMs;
  return Math.min(1, Math.max(0, desde + (hasta - desde) * t));
}

function pararFundido() {
  if (fundido) { clearInterval(fundido); fundido = null; }
}

function fundir(hasta, ms, alAcabar) {
  pararFundido();
  if (!el) { alAcabar?.(); return; }
  const desde = el.volume;
  const inicio = Date.now();
  fundido = setInterval(() => {
    if (!el) { pararFundido(); return; }
    const v = volumenEnFundido(desde, hasta, Date.now() - inicio, ms);
    el.volume = v;
    if (v === hasta) { pararFundido(); alAcabar?.(); }
  }, 50);
}

function reproductor() {
  if (el || typeof Audio === "undefined") return el;
  el = new Audio();
  el.preload = "auto";
  el.addEventListener("play", () => avisar({ sonando: true, error: "" }));
  el.addEventListener("pause", () => avisar({ sonando: false }));
  el.addEventListener("ended", () => {
    const fn = alTerminar;
    alTerminar = null;
    avisar({ ...VACIO, volumen: estado.volumen });
    fn?.();
  });
  el.addEventListener("error", () => { if (el?.getAttribute("src")) avisar({ sonando: false, error: "No se pudo reproducir este audio. Revisa el enlace o vuelve a subir el archivo." }); });
  aplicarSalidaAudio(el);
  escucharSalidaAudio((salida) => aplicarSalidaAudio(el, salida));
  return el;
}

function soltar() {
  pararFundido();
  alTerminar = null;
  if (el) { el.pause(); el.removeAttribute("src"); el.load(); }
}

// Pone un audio. Si ya suena el mismo (misma clave), no lo vuelve a empezar.
export function reproducirAudio({ url, nombre = "", origen = "musica", clave = null, repetir = false, seguir = false, onTerminar = null }) {
  if (!url) return;
  const claveFinal = clave || `${origen}|${url}`;
  if (estado.clave === claveFinal && estado.url === url && el && !el.paused) { alTerminar = onTerminar; return; }
  const a = reproductor();
  if (!a) return;
  const arrancar = () => {
    pararFundido();
    alTerminar = onTerminar;
    a.src = url;
    a.loop = !!repetir;
    a.volume = 0;
    avisar({ url, nombre: nombre || nombreDeAudio(url), origen, clave: claveFinal, repetir: !!repetir, seguir: !!seguir, error: "" });
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => avisar({ sonando: false, error: "El navegador no dejó empezar el audio. Toca ▶ para reproducirlo." }));
    fundir(estado.volumen, FUNDIDO_ENTRADA_MS);
  };
  // Lo que sonaba se va rápido (medio segundo) antes de que entre lo nuevo.
  if (estado.url && !a.paused) fundir(0, 500, arrancar);
  else arrancar();
}

// Baja el volumen poco a poco y lo detiene.
export function bajarAudio(ms = FUNDIDO_SALIDA_MS) {
  if (!el || !estado.url) return;
  alTerminar = null;
  if (el.paused) { soltar(); avisar({ ...VACIO, volumen: estado.volumen }); return; }
  fundir(0, ms, () => { soltar(); avisar({ ...VACIO, volumen: estado.volumen }); });
}

export function detenerAudio() {
  if (!estado.url) return;
  soltar();
  avisar({ ...VACIO, volumen: estado.volumen });
}

export function pausarAudio() { pararFundido(); el?.pause(); }
export function reanudarAudio() {
  if (!el || !estado.url) return;
  el.volume = estado.volumen;
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

export function setVolumenAudio(v) {
  const vol = Math.min(1, Math.max(0, Number(v) || 0));
  pararFundido();
  if (el) el.volume = vol;
  avisar({ volumen: vol });
}

export function estadoAudio() { return estado; }

export function escucharAudio(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export function useAudioCulto() {
  const [e, setE] = useState(estado);
  useEffect(() => escucharAudio(setE), []);
  return e;
}

// Borrador de una diapositiva de audio nueva (texto vacío, fondo de Estilo).
export function nuevaDiapositivaAudio() {
  return { title: "", subtitle: "", name: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "", audio: { url: "", nombre: "", alTerminar: "quedarse", repetir: false, seguir: false } };
}

// ¿Esta diapositiva/ítem trae audio?
export function tieneAudio(x) {
  return !!x && !!x.audio && typeof x.audio.url === "string" && !!x.audio.url;
}
