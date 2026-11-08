// Control del video desde la consola (pedido de Eldin, 2026-11-08): play, pausa, detener, reiniciar,
// saltar ±10 s y sonido, sin tener que tocar la pantalla de proyección (Smart TV, otra computadora).
//
// La consola guarda un estado chico y lo manda dentro de slide_actual.video, junto con la diapositiva:
//   { estado: "play" | "pausa" | "stop", pos: segundo en que estaba en el instante `en`, en: Date.now(),
//     sonido: true | false, n: contador (cambia en cada orden, para que la pantalla la aplique aunque
//     se repita la misma) }
// La pantalla calcula el segundo exacto con posicionActual (si está en play, pos + lo que pasó desde `en`),
// así todas las pantallas quedan en el mismo punto aunque el mensaje llegue con un poco de retraso.

export function controlInicial(ahora = Date.now()) {
  return { estado: "play", pos: 0, en: ahora, sonido: true, n: 0 };
}

export function posicionActual(control, ahora = Date.now()) {
  if (!control) return 0;
  if (control.estado !== "play") return Math.max(0, control.pos || 0);
  return Math.max(0, (control.pos || 0) + (ahora - (control.en ?? ahora)) / 1000);
}

// accion: "play" | "pausa" | "alternar" | "stop" | "reiniciar" | "sonido" | { saltar: ±segundos } | { ir: segundo }
// duracion (opcional, la que reporta la pantalla) para no saltar más allá del final.
export function aplicarAccion(control, accion, { ahora = Date.now(), duracion = null } = {}) {
  const c = control || controlInicial(ahora);
  const pos = posicionActual(c, ahora);
  const tope = (s) => Math.max(0, duracion ? Math.min(s, Math.max(0, duracion - 0.5)) : s);
  const siguiente = (cambios) => ({ ...c, ...cambios, en: ahora, n: (c.n || 0) + 1 });
  if (accion === "play") return siguiente({ estado: "play", pos: c.estado === "stop" ? 0 : pos });
  if (accion === "pausa") return siguiente({ estado: "pausa", pos });
  if (accion === "alternar") return aplicarAccion(c, c.estado === "play" ? "pausa" : "play", { ahora, duracion });
  if (accion === "stop") return siguiente({ estado: "stop", pos: 0 });
  if (accion === "reiniciar") return siguiente({ estado: "play", pos: 0 });
  if (accion === "sonido") return siguiente({ pos, sonido: !c.sonido });
  if (accion && typeof accion === "object" && typeof accion.saltar === "number") return siguiente({ pos: tope(pos + accion.saltar) });
  if (accion && typeof accion === "object" && typeof accion.ir === "number") return siguiente({ pos: tope(accion.ir) });
  return c;
}

// "1:05" / "1:02:09"
export function textoTiempo(seg) {
  const s = Math.max(0, Math.floor(seg || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const dos = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${dos(m)}:${dos(r)}` : `${m}:${dos(r)}`;
}
