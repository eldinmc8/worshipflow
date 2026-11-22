// Botones de un solo toque (pedido de Eldin, 2026-11-22, idea tomada de otro programa): en la consola en
// vivo, un botón hace varias cosas a la vez. Ej. "Inicio del culto" pone el fondo, arranca la cuenta
// regresiva y la música de fondo.
//
// - Se guardan en ESTA computadora (localStorage), como la salida de audio: la consola casi siempre es
//   la misma máquina y así no hace falta tocar la base de datos.
// - Cada botón es una lista de pasos que se hacen en orden. La consola los ejecuta (ver
//   ejecutarBotonRapido en pantallas/envivo.jsx); aquí solo están los datos y la lógica que se puede probar.
import { CUENTA_DEFAULT } from "./cuentaRegresiva.js";
import { DURACIONES_AVISO, DURACION_AVISO_DEFECTO, MAX_LETRAS_AVISO } from "./avisoCongregacion.js";

const CLAVE = "wf_botones_rapidos";
export const MAX_BOTONES = 12;
export const MAX_PASOS = 10;

export const COLORES_BOTON = ["#E8821E", "#1F8A73", "#2F5FA8", "#5661B3", "#B15EA0", "#C23B32", "#16324F"];

// Tipos de paso, en el orden en que salen en "Agregar paso".
export const TIPOS_PASO = [
  { tipo: "fondo", label: "Poner un fondo", detalle: "El fondo que tengas puesto al armar el botón" },
  { tipo: "cuenta", label: "Cuenta regresiva", detalle: "Hasta la hora del culto o por minutos" },
  { tipo: "musica", label: "Poner música", detalle: "Un audio que suena en esta computadora" },
  { tipo: "bajarMusica", label: "Bajar la música", detalle: "Se va apagando poco a poco" },
  { tipo: "irA", label: "Ir a una parte del culto", detalle: "El primer canto, el inicio o el final" },
  { tipo: "negro", label: "Pantalla en negro", detalle: "Esconder o volver a mostrar" },
  { tipo: "mensaje", label: "Mensaje para la congregación", detalle: "Una franja en el proyector que se quita sola" },
  { tipo: "escenario", label: "Mensaje al escenario", detalle: "Solo lo ven los músicos y el predicador" },
];

export const DESTINOS_IR_A = [
  { id: "primerCanto", label: "El primer canto" },
  { id: "inicio", label: "El inicio del culto" },
  { id: "final", label: "La última diapositiva" },
];

const texto = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

export function pasoNuevo(tipo) {
  switch (tipo) {
    case "fondo": return { tipo, fondo: null };
    case "cuenta": return { tipo, modo: "hora", minutos: 5 };
    case "musica": return { tipo, url: "", nombre: "", repetir: true };
    case "bajarMusica": return { tipo };
    case "irA": return { tipo, destino: "primerCanto" };
    case "negro": return { tipo, valor: true };
    case "mensaje": return { tipo, texto: "", segundos: DURACION_AVISO_DEFECTO };
    case "escenario": return { tipo, texto: "" };
    default: return null;
  }
}

// Solo lo que hace falta del fondo del estilo en vivo.
export function fondoDeEstilo(estilo) {
  if (!estilo || typeof estilo !== "object") return null;
  const f = { theme: texto(estilo.theme, 60) || "stage" };
  if (f.theme === "custom") {
    f.customBgType = estilo.customBgType === "video" ? "video" : "imagen";
    if (f.customBgType === "video") f.customVideo = texto(estilo.customVideo, 2000);
    else f.customImage = texto(estilo.customImage, 2000);
  }
  return f;
}

export function normalizarPaso(p) {
  if (!p || typeof p !== "object") return null;
  const base = pasoNuevo(p.tipo);
  if (!base) return null;
  switch (p.tipo) {
    case "fondo": return { tipo: "fondo", fondo: p.fondo ? fondoDeEstilo(p.fondo) : null };
    case "cuenta": {
      const minutos = Number(p.minutos);
      return { tipo: "cuenta", modo: p.modo === "minutos" ? "minutos" : "hora", minutos: Number.isFinite(minutos) && minutos > 0 ? Math.min(Math.round(minutos), 120) : 5 };
    }
    case "musica": return { tipo: "musica", url: texto(p.url, 2000).trim(), nombre: texto(p.nombre, 120), repetir: p.repetir !== false };
    case "irA": return { tipo: "irA", destino: DESTINOS_IR_A.some((d) => d.id === p.destino) ? p.destino : "primerCanto" };
    case "negro": return { tipo: "negro", valor: p.valor !== false };
    case "mensaje": return { tipo: "mensaje", texto: texto(p.texto, MAX_LETRAS_AVISO), segundos: DURACIONES_AVISO.includes(Number(p.segundos)) ? Number(p.segundos) : DURACION_AVISO_DEFECTO };
    case "escenario": return { tipo: "escenario", texto: texto(p.texto, 200) };
    default: return base;
  }
}

export function normalizarBoton(b, i = 0) {
  if (!b || typeof b !== "object") return null;
  const pasos = (Array.isArray(b.pasos) ? b.pasos : []).map(normalizarPaso).filter(Boolean).slice(0, MAX_PASOS);
  return {
    id: texto(b.id, 60) || `boton-${Date.now()}-${i}`,
    nombre: texto(b.nombre, 40).trim() || "Botón",
    color: COLORES_BOTON.includes(b.color) ? b.color : COLORES_BOTON[i % COLORES_BOTON.length],
    pasos,
  };
}

export function normalizarBotones(lista) {
  if (!Array.isArray(lista)) return null;
  return lista.map(normalizarBoton).filter(Boolean).slice(0, MAX_BOTONES);
}

// Los tres que vienen listos. El fondo y la música quedan por elegir (cada iglesia tiene los suyos).
export function botonesDeFabrica() {
  return [
    { id: "fabrica-inicio", nombre: "Inicio del culto", color: "#E8821E", pasos: [pasoNuevo("fondo"), { ...pasoNuevo("cuenta"), modo: "hora" }, pasoNuevo("musica")] },
    { id: "fabrica-alabanza", nombre: "Empezar alabanza", color: "#1F8A73", pasos: [pasoNuevo("bajarMusica"), { tipo: "irA", destino: "primerCanto" }] },
    { id: "fabrica-final", nombre: "Final del culto", color: "#16324F", pasos: [pasoNuevo("fondo"), { tipo: "mensaje", texto: "¡Dios les bendiga! Gracias por acompañarnos", segundos: 30 }, pasoNuevo("musica")] },
  ];
}

export function leerBotones() {
  try {
    const guardados = normalizarBotones(JSON.parse(localStorage.getItem(CLAVE) || "null"));
    return guardados || botonesDeFabrica();
  } catch {
    return botonesDeFabrica();
  }
}

export function guardarBotones(lista) {
  try { localStorage.setItem(CLAVE, JSON.stringify(normalizarBotones(lista) || [])); } catch { /* sin almacenamiento: vale para esta sesión */ }
}

// Un paso al que todavía le falta algo para poder hacerse (fondo sin elegir, música sin audio, mensaje vacío).
export function pasoIncompleto(p) {
  if (!p) return true;
  if (p.tipo === "fondo") return !p.fondo;
  if (p.tipo === "musica") return !p.url;
  if (p.tipo === "mensaje" || p.tipo === "escenario") return !String(p.texto || "").trim();
  return false;
}

// Texto corto de un paso, para la lista del editor y el título del botón.
export function resumenPaso(p, { temas = {} } = {}) {
  switch (p?.tipo) {
    case "fondo": {
      if (!p.fondo) return "Fondo: falta elegirlo";
      if (p.fondo.theme === "custom") return p.fondo.customBgType === "video" ? "Fondo: tu video" : "Fondo: tu imagen";
      return `Fondo: ${temas[p.fondo.theme]?.label || "del estilo"}`;
    }
    case "cuenta": return p.modo === "minutos" ? `Cuenta regresiva de ${p.minutos} min` : "Cuenta regresiva hasta la hora del culto";
    case "musica": return p.url ? `Música: ${p.nombre || "audio"}${p.repetir ? " (en bucle)" : ""}` : "Música: falta elegir el audio";
    case "bajarMusica": return "Bajar la música poco a poco";
    case "irA": return `Ir a ${(DESTINOS_IR_A.find((d) => d.id === p.destino)?.label || "").toLowerCase()}`;
    case "negro": return p.valor ? "Pantalla en negro" : "Quitar la pantalla en negro";
    case "mensaje": return p.texto ? `Mensaje: «${p.texto}» (${p.segundos} s)` : "Mensaje: falta escribirlo";
    case "escenario": return p.texto ? `Al escenario: «${p.texto}»` : "Al escenario: falta escribirlo";
    default: return "";
  }
}

// Índice de la diapositiva a la que va "Ir a…" dentro del plan (null si no hay a dónde ir).
export function indiceDestino(destino, slides = []) {
  if (!slides.length) return null;
  if (destino === "inicio") return 0;
  if (destino === "final") return slides.length - 1;
  const i = slides.findIndex((s) => s?.type === "cancion");
  return i === -1 ? null : i;
}

// Configuración de la cuenta regresiva que arranca un botón. Si el botón también pone un fondo, la
// cuenta va sobre ese fondo (el de Estilo) en vez del propio del reloj.
export function cuentaDelPaso(p, conFondo = false) {
  return { ...CUENTA_DEFAULT, modo: p.modo === "minutos" ? "minutos" : "hora", minutos: p.minutos || 5, ...(conFondo ? { fondo: "estilo" } : {}) };
}
