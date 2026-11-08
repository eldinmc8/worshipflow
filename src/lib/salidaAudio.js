// Salida de audio de los videos (pedido de Eldin, 2026-11-08): en la mayoría de iglesias la imagen del
// video va al proyector/TV (HDMI) pero el SONIDO tiene que ir a la consola o mixer (por la salida de
// audífonos de la computadora o una interfaz USB) para que suene en las bocinas del sistema de sonido.
// Sin esto, Windows manda el audio a la salida predeterminada — muchas veces el mismo HDMI del proyector.
//
// - Se guarda POR COMPUTADORA (localStorage): los dispositivos de audio son de cada máquina, y la
//   ventana de proyección (misma computadora, mismo sitio) la lee de aquí y cambia en vivo si se ajusta.
// - Se aplica con setSinkId() en el <video> de la proyección (Chrome, Edge y Firefox recientes).
// - YouTube y Vimeo van en un reproductor incrustado de otro sitio: el navegador NO deja elegirle la
//   salida desde la app. Para esos, la salida es la que Chrome/Edge tenga en Windows (ver la ayuda en
//   Ajustes → Salida de audio de los videos).
// - Los nombres de los dispositivos solo los da el navegador con permiso de micrófono (es la regla de
//   Chrome para listar dispositivos). Se pide una vez, se usa solo para leer la lista y se apaga enseguida.

const CLAVE = "wf_salida_audio_videos";
const EVENTO = "wf-salida-audio";

export function soportaSalidaAudio() {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype
    && typeof navigator !== "undefined" && !!navigator.mediaDevices?.enumerateDevices;
}

// { deviceId, label } o null (= la salida predeterminada del sistema).
export function leerSalidaAudio() {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || "null");
    return v && v.deviceId && v.deviceId !== "default" ? { deviceId: String(v.deviceId), label: String(v.label || "") } : null;
  } catch {
    return null;
  }
}

export function guardarSalidaAudio(salida) {
  try {
    if (!salida || !salida.deviceId || salida.deviceId === "default") localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, JSON.stringify({ deviceId: salida.deviceId, label: salida.label || "" }));
  } catch { /* sin almacenamiento: queda la predeterminada */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

// Avisa cuando cambia, en ESTA ventana (evento propio) o en otra de la misma computadora ("storage").
export function escucharSalidaAudio(fn) {
  if (typeof window === "undefined") return () => {};
  const alCambiar = (e) => { if (!e || e.type === EVENTO || e.key === CLAVE) fn(leerSalidaAudio()); };
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener("storage", alCambiar);
  return () => { window.removeEventListener(EVENTO, alCambiar); window.removeEventListener("storage", alCambiar); };
}

// Busca la salida guardada entre los dispositivos de ahora: por id y, si cambió (Chrome lo renueva al
// borrar datos del sitio), por nombre. null = no está conectada → se usa la predeterminada.
export function resolverSalida(guardada, dispositivos) {
  if (!guardada) return null;
  const salidas = (dispositivos || []).filter((d) => d.kind === "audiooutput");
  return salidas.find((d) => d.deviceId === guardada.deviceId)
    || (guardada.label ? salidas.find((d) => d.label && d.label === guardada.label) : null)
    || null;
}

// Lista de salidas de audio: [{ deviceId, label }]. Con pedirPermiso, si el navegador no da los nombres,
// pide el micrófono un instante (solo para que muestre la lista) y lo apaga.
export async function listarSalidasAudio({ pedirPermiso = false } = {}) {
  const md = navigator.mediaDevices;
  let lista = (await md.enumerateDevices()).filter((d) => d.kind === "audiooutput");
  const sinNombres = !lista.length || lista.every((d) => !d.label || !d.deviceId);
  if (sinNombres && pedirPermiso && md.getUserMedia) {
    const s = await md.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    lista = (await md.enumerateDevices()).filter((d) => d.kind === "audiooutput");
  }
  return lista
    .filter((d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Salida de audio ${i + 1}` }));
}

// Manda el sonido de un <video>/<audio> a la salida guardada (o a la predeterminada si no hay o si ya
// no está conectada). Nunca lanza: si algo falla, el video sigue sonando por donde sonaba.
export async function aplicarSalidaAudio(elemento, salida = leerSalidaAudio()) {
  if (!elemento || typeof elemento.setSinkId !== "function") return false;
  try {
    let id = "";
    if (salida) {
      const dispositivo = resolverSalida(salida, await navigator.mediaDevices.enumerateDevices());
      id = dispositivo ? dispositivo.deviceId : "";
    }
    if (elemento.sinkId !== id) await elemento.setSinkId(id);
    return !!id;
  } catch {
    return false;
  }
}

// Un "bip" corto para comprobar por dónde suena una salida antes del culto.
export async function probarSalidaAudio(deviceId) {
  const audio = new Audio(tonoDePrueba());
  audio.volume = 0.6;
  if (deviceId && typeof audio.setSinkId === "function") await audio.setSinkId(deviceId);
  await audio.play();
}

function tonoDePrueba() {
  const muestras = 44100 * 0.7;
  const datos = new DataView(new ArrayBuffer(44 + muestras * 2));
  const texto = (o, s) => { for (let i = 0; i < s.length; i += 1) datos.setUint8(o + i, s.charCodeAt(i)); };
  texto(0, "RIFF"); datos.setUint32(4, 36 + muestras * 2, true); texto(8, "WAVE"); texto(12, "fmt ");
  datos.setUint32(16, 16, true); datos.setUint16(20, 1, true); datos.setUint16(22, 1, true);
  datos.setUint32(24, 44100, true); datos.setUint32(28, 88200, true); datos.setUint16(32, 2, true); datos.setUint16(34, 16, true);
  texto(36, "data"); datos.setUint32(40, muestras * 2, true);
  for (let i = 0; i < muestras; i += 1) {
    const t = i / 44100;
    const envolvente = Math.min(1, t / 0.02, (0.7 - t) / 0.1);
    const nota = t < 0.35 ? 660 : 880;
    datos.setInt16(44 + i * 2, Math.sin(2 * Math.PI * nota * t) * 0.5 * envolvente * 32767, true);
  }
  let bin = "";
  const bytes = new Uint8Array(datos.buffer);
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
}
