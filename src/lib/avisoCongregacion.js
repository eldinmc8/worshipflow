// Mensaje para la congregación (2026-11-22): una franja corta que Multimedia manda al proyector, encima de
// lo que esté al aire (sin quitarlo), y que se quita sola a los pocos segundos. Distinto del mensaje del
// ESCENARIO (ese solo lo ven los de la plataforma).
//
// Viaja dentro del estilo en vivo (sesiones_en_vivo.estilo_en_vivo → liveStyle.avisoCongregacion), igual
// que las transiciones, así que no hace falta tocar la base de datos:
//   { id, texto, duracionSeg, enviadoEn }
// - La consola lo borra cuando se acaba el tiempo (o con "Quitar ya").
// - Cada pantalla, además, lo quita sola contando desde que lo recibió, por si la consola se cerró antes.
// - Como el estilo en vivo NO se borra al finalizar, un aviso viejo (más de 2 min pasado su tiempo) se ignora.

export const MAX_LETRAS_AVISO = 120;
export const DURACIONES_AVISO = [5, 10, 15, 30];
export const DURACION_AVISO_DEFECTO = 10;
// En orden alfabético. Tocar uno lo pone en el cuadro de texto, para completarlo (la placa) antes de enviar.
export const MENSAJES_AVISO = [
  "Bienvenidos a la casa de Dios",
  "Favor de silenciar sus celulares",
  "Padres de niños de la sala cuna, favor de pasar",
  "Se busca al dueño del carro placa ",
];
const GRACIA_MS = 2 * 60 * 1000;

export function crearAviso(texto, duracionSeg = DURACION_AVISO_DEFECTO, ahora = Date.now()) {
  const limpio = String(texto || "").replace(/\s+/g, " ").trim().slice(0, MAX_LETRAS_AVISO);
  if (!limpio) return null;
  const dur = DURACIONES_AVISO.includes(Number(duracionSeg)) ? Number(duracionSeg) : DURACION_AVISO_DEFECTO;
  return { id: `${ahora}-${Math.random().toString(36).slice(2, 7)}`, texto: limpio, duracionSeg: dur, enviadoEn: ahora };
}

// ¿Este aviso todavía puede mostrarse? (tiene texto y no es uno viejo que quedó guardado)
export function avisoValido(aviso, ahora = Date.now()) {
  if (!aviso || typeof aviso !== "object" || !aviso.id || !String(aviso.texto || "").trim()) return false;
  const dur = Number(aviso.duracionSeg) || DURACION_AVISO_DEFECTO;
  const enviado = Number(aviso.enviadoEn) || 0;
  return ahora - enviado < dur * 1000 + GRACIA_MS;
}

// Segundos que le quedan según la consola que lo mandó (su propio reloj).
export function segundosRestantesAviso(aviso, ahora = Date.now()) {
  if (!avisoValido(aviso, ahora)) return 0;
  const fin = Number(aviso.enviadoEn) + (Number(aviso.duracionSeg) || DURACION_AVISO_DEFECTO) * 1000;
  return Math.max(0, Math.ceil((fin - ahora) / 1000));
}

export function conAviso(liveStyle, aviso) {
  return { ...(liveStyle || {}), avisoCongregacion: aviso || null };
}
