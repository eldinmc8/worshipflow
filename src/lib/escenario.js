// Pantalla de escenario (stage display, pedido de Eldin, 2026-11-01): un monitor en el piso del
// escenario para quienes cantan, tocan o predican. Muestra lo que está al aire, lo que sigue, la parte
// de la canción y la que viene, la siguiente canción y un mensaje de Multimedia que el público no ve.
//
// La consola (quien lleva la transmisión) arma este resumen con armarEscenario() y lo manda junto con
// la diapositiva al aire (slide_actual.escenario en sesiones_en_vivo, y por el canal local). Así la
// pantalla de escenario, que no tiene sesión iniciada, no necesita leer el Setlist: todo le llega listo.

import { esBloquePredicacion } from "./predicacion.js";

// ¿Esta diapositiva es de este elemento del Setlist? Mismo criterio que la consola (perteneceA):
// canción "<id>-<parte>-<n>", versículo partido "<id>~<k>", diapositiva de un grupo "<id>~<id>".
export function perteneceA(slide, itemId) {
  if (!slide || !itemId) return false;
  const id = String(slide.slideId || "");
  return id === itemId || id.startsWith(`${itemId}-`) || id.startsWith(`${itemId}~`);
}

// Lo mínimo para mostrar una diapositiva en el escenario (sin diseño ni fondos).
export function resumenDiapositiva(s) {
  if (!s) return null;
  if (s.type === "cancion") return { tipo: "cancion", lineas: (s.lines || []).filter((l) => l && l.trim()), etiqueta: s.blockLabel || s.sectionLabel || "", titulo: s.songTitle || "" };
  if (s.type === "biblia") return { tipo: "biblia", lineas: [s.text || ""], etiqueta: s.reference || "", titulo: s.reference || "" };
  const lineas = [s.title, s.subtitle].filter((t) => t && String(t).trim());
  return { tipo: "slide", lineas: lineas.length ? lineas : [s.nombre || "Diapositiva"], etiqueta: s.subtitle || "", titulo: s.title || s.nombre || "" };
}

// Abreviatura de una parte para las pastillas de arriba: "Verso 1" → "V1", "Coro" → "C", "Puente" → "P".
export function abreviarParte(nombre) {
  const t = String(nombre || "").trim();
  if (!t) return "?";
  const num = (t.match(/\d+/) || [""])[0];
  const base = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const mapa = [["pre", "PC"], ["verso", "V"], ["estrofa", "V"], ["verse", "V"], ["coro", "C"], ["chorus", "C"], ["puente", "P"], ["bridge", "P"], ["intro", "I"], ["final", "F"], ["outro", "F"], ["interludio", "IN"], ["instrumental", "IN"], ["tag", "T"]];
  const hallado = mapa.find(([clave]) => base.startsWith(clave));
  return hallado ? `${hallado[1]}${num}` : t.slice(0, 3).toUpperCase();
}

// Partes de la canción que está al aire, en el orden en que se cantan, y cuál es la actual.
// Cada vez que aparece una parte en la estructura (V1 · C · V2 · C) es una entrada distinta: se separan
// por el número de posición que la consola pone en el id ("<item>-<posición>-<n>").
function partesDeCancion(slides, indice, itemId) {
  const actual = slides[indice];
  const partes = [];
  let parteActual = -1;
  slides.forEach((s, k) => {
    if (!perteneceA(s, itemId) || s.type !== "cancion") return;
    const resto = String(s.slideId).slice(itemId.length + 1);
    const posicion = /^(\d+)-/.exec(resto)?.[1] ?? s.blockKey;
    const ultima = partes[partes.length - 1];
    if (!ultima || ultima.posicion !== posicion) partes.push({ posicion, nombre: s.sectionLabel || s.blockKey || "", corto: abreviarParte(s.sectionLabel || s.blockKey) });
    if (k === indice || s === actual) parteActual = partes.length - 1;
  });
  return { partes: partes.map(({ nombre, corto }) => ({ nombre, corto })), parteActual };
}

function tituloDeItem(it, library) {
  if (!it) return "";
  if (it.type === "cancion") return library.find((s) => s.id === it.songId)?.title || "Canción";
  if (it.type === "biblia") return it.reference || "Versículo";
  if (it.type === "seccion") return it.title || "Bloque";
  return it.name || it.title || "Diapositiva";
}

function tonoDeItem(it, library) {
  if (!it || it.type !== "cancion") return "";
  return it.keyOverride || library.find((s) => s.id === it.songId)?.key || "";
}

// Resumen completo para la pantalla de escenario.
// slides: lo que la consola puede proyectar (en orden) · indice: el que está al aire en `slides`
// (-1 si lo que está al aire no es del plan, ej. un versículo suelto) · alAire: la diapositiva al aire.
export function armarEscenario({ slides = [], indice = -1, alAire = null, serviceOrder = [], library = [], mensaje = "", inicio = null, bosquejos = {}, temporizador = null }) {
  const actual = indice >= 0 ? slides[indice] : alAire;
  const item = actual ? serviceOrder.find((it) => it.type !== "seccion" && perteneceA(actual, it.id)) || null : null;
  const siguienteDiapositiva = indice >= 0 ? slides[indice + 1] || null : null;

  let partes = [], parteActual = -1;
  if (item?.type === "cancion" && indice >= 0) ({ partes, parteActual } = partesDeCancion(slides, indice, item.id));
  const siguienteParte = parteActual >= 0 && parteActual + 1 < partes.length ? partes[parteActual + 1].nombre : "";

  // Lo que viene en el orden del culto después del elemento al aire.
  const desde = item ? serviceOrder.findIndex((it) => it.id === item.id) + 1 : 0;
  const despues = item ? serviceOrder.slice(desde) : [];
  const sigCancion = despues.find((it) => it.type === "cancion") || null;
  const proximos = despues.slice(0, 6).map((it) => ({ tipo: it.type, titulo: tituloDeItem(it, library), tono: tonoDeItem(it, library) }));

  return {
    siguiente: resumenDiapositiva(siguienteDiapositiva),
    // Si la siguiente diapositiva ya es de OTRO elemento, se avisa (cambio de canción/lectura).
    siguienteEsOtro: !!(siguienteDiapositiva && item && !perteneceA(siguienteDiapositiva, item.id)),
    cancion: item?.type === "cancion" ? { titulo: tituloDeItem(item, library), tono: tonoDeItem(item, library) } : null,
    partes, parteActual, siguienteParte,
    siguienteCancion: sigCancion ? { titulo: tituloDeItem(sigCancion, library), tono: tonoDeItem(sigCancion, library) } : null,
    proximos,
    mensaje: (mensaje || "").trim(),
    inicio: inicio || null,
    predicacion: datosPredicacion(serviceOrder, item, bosquejos),
    temporizador: temporizadorActivo(temporizador) ? { finEn: temporizador.finEn || null, restanteSeg: temporizador.finEn ? null : temporizador.restanteSeg, duracionSeg: temporizador.duracionSeg || null } : null,
  };
}

// ---------- Predicación (2026-11-02) ----------

// ¿Lo que está al aire es de la predicación? Una diapositiva del bosquejo, o cualquier cosa dentro del
// bloque de Predicación. Sirve para que el temporizador arranque solo.
export function estaEnPredicacion(serviceOrder = [], item = null) {
  if (!item) return false;
  if (item.bosquejoDe) return true;
  const i = serviceOrder.findIndex((it) => it.id === item.id);
  for (let k = i - 1; k >= 0; k--) if (serviceOrder[k].type === "seccion") return esBloquePredicacion(serviceOrder[k]);
  return false;
}

// Número de punto del bosquejo de un elemento (las diapositivas enviadas antes de guardar el número se
// reconocen por su subtítulo "Punto N"; un versículo toma el del punto que tiene arriba).
function puntoDe(serviceOrder, item) {
  const directo = (it) => it.bosquejoPunto || (/^Punto (\d+)$/.exec(it.subtitle || "") ? Number(/^Punto (\d+)$/.exec(it.subtitle)[1]) : null);
  const p = directo(item);
  if (p) return p;
  const i = serviceOrder.findIndex((it) => it.id === item.id);
  for (let k = i - 1; k >= 0; k--) {
    const it = serviceOrder[k];
    if (it.bosquejoDe !== item.bosquejoDe) break;
    const q = directo(it);
    if (q) return q;
  }
  return null;
}

// Para el predicador, mientras está al aire algo de su bosquejo: "Punto 2 de 4", su nota privada de ese
// punto (nunca se proyecta) y los próximos versículos del bosquejo, para que los vaya buscando.
export function datosPredicacion(serviceOrder = [], item = null, bosquejos = {}) {
  if (!item?.bosquejoDe) return null;
  const b = bosquejos?.[item.bosquejoDe] || null;
  const puntos = b?.puntos || [];
  const conTitulo = puntos.map((pt, i) => ({ i, titulo: (pt.titulo || "").trim() })).filter((pt) => pt.titulo);
  const punto = puntoDe(serviceOrder, item);
  const orden = punto ? conTitulo.findIndex((pt) => pt.i === punto - 1) + 1 : 0;
  const total = conTitulo.length || serviceOrder.filter((it) => it.bosquejoDe === item.bosquejoDe && /^Punto \d+$/.test(it.subtitle || "")).length;
  const desde = serviceOrder.findIndex((it) => it.id === item.id) + 1;
  const proximosVersiculos = serviceOrder.slice(desde).filter((it) => it.bosquejoDe === item.bosquejoDe && it.type === "biblia").slice(0, 4).map((it) => it.reference);
  return {
    titulo: b?.titulo || "",
    punto: orden > 0 ? orden : punto || null,
    total: total || null,
    nota: punto ? (puntos[punto - 1]?.nota || "").trim() : "",
    proximosVersiculos,
  };
}

// ---------- Temporizador del mensaje ----------
// { duracionSeg, finEn } corriendo · { duracionSeg, restanteSeg } en pausa · null o sin ninguno = apagado.
export function temporizadorActivo(t) {
  return !!t && (!!t.finEn || typeof t.restanteSeg === "number");
}

// Segundos que faltan (negativo = se pasó del tiempo).
export function restanteTemporizador(t, ahora = Date.now()) {
  if (!temporizadorActivo(t)) return null;
  if (t.finEn) return Math.round((new Date(t.finEn).getTime() - ahora) / 1000);
  return t.restanteSeg;
}

// "12:05", "1:02:09" o "+2:15" cuando ya se pasó.
export function textoTemporizador(seg) {
  if (seg == null) return "";
  const a = Math.abs(seg);
  const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60;
  const dos = (n) => String(n).padStart(2, "0");
  return `${seg < 0 ? "+" : ""}${h > 0 ? `${h}:${dos(m)}` : m}:${dos(s)}`;
}

// normal · aviso (faltan 5 minutos o menos) · excedido.
export function nivelTemporizador(seg) {
  if (seg == null) return null;
  if (seg < 0) return "excedido";
  return seg <= 300 ? "aviso" : "normal";
}

export function iniciarTemporizador(duracionSeg, ahora = Date.now()) {
  return { duracionSeg, finEn: new Date(ahora + duracionSeg * 1000).toISOString() };
}
export function pausarTemporizador(t, ahora = Date.now()) {
  if (!t?.finEn) return t;
  return { duracionSeg: t.duracionSeg, restanteSeg: restanteTemporizador(t, ahora) };
}
export function reanudarTemporizador(t, ahora = Date.now()) {
  if (!t || t.finEn || typeof t.restanteSeg !== "number") return t;
  return { duracionSeg: t.duracionSeg, finEn: new Date(ahora + t.restanteSeg * 1000).toISOString() };
}

// "1:05:09" / "12:04" desde una fecha ISO hasta ahora.
export function tiempoTranscurrido(inicioIso, ahora = Date.now()) {
  if (!inicioIso) return "";
  const seg = Math.max(0, Math.floor((ahora - new Date(inicioIso).getTime()) / 1000));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  const dos = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}
