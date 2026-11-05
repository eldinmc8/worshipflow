// Cuenta regresiva antes del culto (pedido de Eldin, 2026-11-05).
//
// Es un elemento más del Setlist (tipo "slide" con la configuración en item.cuentaRegresiva, que se
// guarda en items_servicio.estructura — no hace falta tocar la base) o se lanza al momento desde la
// consola. Al proyectarse, la diapositiva lleva la hora exacta en que termina (cuenta.hasta, en ms):
// cada pantalla cuenta sola con su propio reloj, así que no se manda nada cada segundo por internet y
// todas van al mismo segundo.
//
// Modos:
// - "hora":    hasta la hora del evento (fecha + hora). Si el evento no tiene hora, cuenta los minutos.
// - "minutos": N minutos desde que se pone al aire.
// Al llegar a cero (alTerminar): "mensaje" (muestra mensajeFinal), "quedarse" (00:00) o "avanzar"
// (la consola pasa sola a lo que sigue).

export const CUENTA_DEFAULT = {
  modo: "hora",
  minutos: 5,
  estilo: "clasico",
  mostrarTexto: true,
  texto: "El servicio comienza en",
  alTerminar: "mensaje",
  mensajeFinal: "¡Bienvenidos!",
  fondo: "propio", // "propio" (el del estilo) | "estilo" (el fondo de Estilo de la proyección)
  versiculo: "Este es el día que hizo el Señor; nos gozaremos y alegraremos en él.",
  referencia: "Salmo 118:24",
};

export const MODOS_CUENTA = [
  { id: "hora", label: "Hasta la hora del culto" },
  { id: "minutos", label: "Por minutos" },
];

export const AL_TERMINAR = [
  { id: "mensaje", label: "Mostrar un mensaje" },
  { id: "quedarse", label: "Quedarse en 00:00" },
  { id: "avanzar", label: "Pasar sola a lo que sigue" },
];

export const MINUTOS_RAPIDOS = [1, 3, 5, 10, 15, 20, 30];

export function normalizarCuenta(c) {
  const base = { ...CUENTA_DEFAULT, ...(c && typeof c === "object" ? c : {}) };
  const minutos = Number(base.minutos);
  base.minutos = Number.isFinite(minutos) && minutos > 0 ? Math.min(Math.round(minutos * 2) / 2, 600) : CUENTA_DEFAULT.minutos;
  if (!MODOS_CUENTA.some((m) => m.id === base.modo)) base.modo = CUENTA_DEFAULT.modo;
  if (!AL_TERMINAR.some((m) => m.id === base.alTerminar)) base.alTerminar = CUENTA_DEFAULT.alTerminar;
  if (base.fondo !== "estilo") base.fondo = "propio";
  base.mostrarTexto = base.mostrarTexto !== false;
  return base;
}

export function esCuentaRegresiva(item) {
  return !!item && item.type === "slide" && !!item.cuentaRegresiva;
}

// Elemento nuevo del Setlist.
export function itemCuentaRegresiva(id, config) {
  return { id, type: "slide", title: "Cuenta regresiva", subtitle: "", bg: "#0B0F17", bgType: "color", cuentaRegresiva: normalizarCuenta(config) };
}

// Hora del evento (en la hora de este dispositivo — la consola está en la iglesia), en ms. null si no hay.
export function horaDelEvento(evento) {
  if (!evento?.date || !evento?.hora) return null;
  const hora = String(evento.hora).slice(0, 8);
  const t = new Date(`${evento.date}T${hora.length === 5 ? `${hora}:00` : hora}`).getTime();
  return Number.isFinite(t) ? t : null;
}

// ¿Esta cuenta va por minutos (aunque diga "hora", si el evento no tiene hora)?
export function cuentaPorMinutos(cuenta, evento) {
  return normalizarCuenta(cuenta).modo === "minutos" || horaDelEvento(evento) == null;
}

// Segundos que faltan (enteros, nunca negativos). null si la cuenta todavía no tiene hora final.
export function segundosRestantes(hasta, ahora = Date.now()) {
  if (hasta == null) return null;
  return Math.max(0, Math.ceil((hasta - ahora) / 1000));
}

export function partesTiempo(seg) {
  const s = Math.max(0, Math.floor(seg || 0));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const dos = (n) => String(n).padStart(2, "0");

// "4:05", "12:00", "1:02:03".
export function textoCuenta(seg) {
  const { h, m, s } = partesTiempo(seg);
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

// Dígitos para los estilos que dibujan cada número aparte (tarjetas, bloques...).
export function digitosCuenta(seg) {
  const { h, m, s } = partesTiempo(seg);
  return h > 0 ? [String(h), dos(m), dos(s)] : [dos(m), dos(s)];
}

// Diapositiva proyectable de un elemento de cuenta regresiva (para buildSlides). La hora final se pone
// después, al proyectarla (ver conHoraFinal).
export function slideCuentaRegresiva(item) {
  return { slideId: item.id, type: "slide", title: "Cuenta regresiva", nombre: "Cuenta regresiva", subtitle: "", bg: "#0B0F17", bgType: "color", cuenta: normalizarCuenta(item.cuentaRegresiva) };
}

// Le pone a la diapositiva la hora en que termina (cuenta.hasta) y su duración total (para las barras y
// anillos). horasFinales: { [slideId]: ms } para las cuentas por minutos, que empiezan al ponerse al aire.
export function conHoraFinal(slide, { evento = null, horasFinales = {}, ahora = Date.now(), logoUrl = null } = {}) {
  if (!slide?.cuenta) return slide;
  const cuenta = normalizarCuenta(slide.cuenta);
  let hasta = slide.cuenta.hasta ?? null;
  let total = slide.cuenta.total ?? null;
  if (hasta == null) {
    if (!cuentaPorMinutos(cuenta, evento)) {
      hasta = horaDelEvento(evento);
      // La barra/anillo se llena sobre los últimos 30 minutos (o lo que falte, si es menos).
      total = Math.max(60, Math.min(30 * 60, Math.ceil((hasta - ahora) / 1000)));
    } else {
      hasta = horasFinales[slide.slideId] ?? null;
      total = cuenta.minutos * 60;
    }
  }
  return { ...slide, cuenta: { ...cuenta, hasta, total, ...(logoUrl ? { logoUrl } : {}) } };
}

// Al ponerse al aire una cuenta por minutos: arranca (o sigue, si ya iba y no ha terminado).
export function arrancarSiHaceFalta(horasFinales, slide, evento, ahora = Date.now()) {
  if (!slide?.cuenta || slide.cuenta.hasta != null || !cuentaPorMinutos(slide.cuenta, evento)) return horasFinales;
  const actual = horasFinales[slide.slideId];
  if (actual != null && actual > ahora) return horasFinales;
  // De paso se olvidan las cuentas que terminaron hace más de un día.
  const vigentes = Object.fromEntries(Object.entries(horasFinales).filter(([, t]) => t > ahora - 86400000));
  return { ...vigentes, [slide.slideId]: ahora + normalizarCuenta(slide.cuenta).minutos * 60 * 1000 };
}

// Cuenta lanzada al momento desde la consola: ya trae su hora final.
export function slideCuentaAlMomento(config, evento, ahora = Date.now()) {
  const cuenta = normalizarCuenta(config);
  const slide = { slideId: `adhoc-cuenta-${ahora}`, type: "slide", title: "Cuenta regresiva", nombre: "Cuenta regresiva", subtitle: "", bg: "#0B0F17", bgType: "color", cuenta };
  const conHora = conHoraFinal(slide, { evento, horasFinales: arrancarSiHaceFalta({}, slide, evento, ahora), ahora });
  return conHora;
}

// Progreso de 0 (recién empieza) a 1 (terminó).
export function progresoCuenta(cuenta, seg) {
  if (!cuenta?.total || seg == null) return 0;
  return Math.min(1, Math.max(0, 1 - seg / cuenta.total));
}
