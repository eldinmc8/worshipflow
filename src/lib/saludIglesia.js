// "Salud" de cada iglesia para la consola general (pedido de Eldin, 2026-11-05, etapa de iglesias
// fundadoras): a partir de los números de resumen_plataforma(), ¿la están usando? ¿qué les falta?
// Solo mira fechas y cantidades — nunca el contenido.

const DIA = 86400000;

export function diasDesde(fecha, ahora = Date.now()) {
  if (!fecha) return null;
  const t = new Date(fecha).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((ahora - t) / DIA)) : null;
}

// "hoy", "ayer", "hace 5 días", "hace 3 semanas", "hace 2 meses", "nunca".
export function haceCuanto(fecha, ahora = Date.now()) {
  const d = diasDesde(fecha, ahora);
  if (d == null) return "nunca";
  if (d === 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 14) return `hace ${d} días`;
  if (d < 60) return `hace ${Math.floor(d / 7)} semanas`;
  return `hace ${Math.floor(d / 30)} meses`;
}

// Lo más reciente que hizo la iglesia: entrar, agregar una canción, crear un evento o transmitir.
export function ultimaActividad(r) {
  const fechas = [r.ultimo_ingreso, r.ultima_cancion, r.ultimo_evento_creado, r.ultima_transmision].filter(Boolean).map((f) => new Date(f).getTime());
  return fechas.length ? new Date(Math.max(...fechas)).toISOString() : null;
}

export const ESTADOS_SALUD = {
  activa: { label: "Activa", color: "#1F8A73", fondo: "rgba(31,138,115,0.12)", orden: 3 },
  nueva: { label: "Nueva", color: "#2F5FA8", fondo: "rgba(47,95,168,0.12)", orden: 2 },
  bajando: { label: "Bajando", color: "#E8821E", fondo: "rgba(232,130,30,0.14)", orden: 1 },
  dormida: { label: "Sin uso", color: "#C23B32", fondo: "rgba(194,59,50,0.12)", orden: 0 },
  pausada: { label: "Pausada", color: "#8996A6", fondo: "rgba(137,150,166,0.16)", orden: 4 },
};

// activa: algo en los últimos 7 días · bajando: 8 a 21 días · dormida: más de 21 (o nunca).
// nueva: creada hace menos de 14 días y todavía sin mucho movimiento (se le da tiempo de arrancar).
export function estadoSalud(r, ahora = Date.now()) {
  if (r.activa === false) return "pausada";
  const d = diasDesde(ultimaActividad(r), ahora);
  const edad = diasDesde(r.creada, ahora) ?? 999;
  if (d != null && d <= 7) return edad < 14 && !r.eventos && !r.canciones_propias ? "nueva" : "activa";
  if (edad < 14) return "nueva";
  if (d != null && d <= 21) return "bajando";
  return "dormida";
}

// Pasos de una iglesia fundadora para empezar a usar la app de verdad.
export function pasosArranque(r) {
  return [
    { clave: "canciones", label: "Agregó sus propias canciones", hecho: (r.canciones_propias ?? r.canciones ?? 0) > 0, detalle: `${r.canciones_propias ?? r.canciones ?? 0} propias` },
    { clave: "equipo", label: "Invitó a su equipo (3 o más personas)", hecho: (r.usuarios ?? 0) >= 3, detalle: `${r.usuarios ?? 0} personas` },
    { clave: "grupos", label: "Armó sus grupos o ministerios", hecho: (r.ministerios ?? 0) > 0, detalle: `${r.ministerios ?? 0} grupos` },
    { clave: "evento", label: "Creó su primer evento", hecho: (r.eventos ?? 0) > 0, detalle: `${r.eventos ?? 0} eventos` },
    { clave: "proximo", label: "Tiene un evento próximo", hecho: (r.eventos_proximos ?? 0) > 0, detalle: r.proximo_evento?.fecha || "ninguno" },
    { clave: "vivo", label: "Transmitió en vivo", hecho: !!r.ultima_transmision, detalle: r.ultima_transmision ? haceCuanto(r.ultima_transmision) : "nunca" },
  ];
}

// Avisos para que Eldin actúe (de lo más urgente a lo menos).
export function alertasIglesia(r, ahora = Date.now()) {
  if (r.activa === false) return [];
  const out = [];
  const edad = diasDesde(r.creada, ahora) ?? 999;
  const ingreso = diasDesde(r.ultimo_ingreso, ahora);
  if (ingreso == null) out.push({ nivel: "alta", texto: "Nadie ha entrado nunca" });
  else if (ingreso > 14) out.push({ nivel: "alta", texto: `Nadie entra desde ${haceCuanto(r.ultimo_ingreso, ahora)}` });
  if (!r.eventos_proximos && edad >= 7) out.push({ nivel: "media", texto: "No tiene eventos próximos" });
  if ((r.usuarios ?? 0) <= 1 && edad >= 7) out.push({ nivel: "media", texto: "Solo tiene 1 usuario: no ha invitado a su equipo" });
  if (!(r.canciones_propias ?? 0) && edad >= 7) out.push({ nivel: "media", texto: "No ha agregado canciones propias" });
  if ((r.nunca_entraron ?? 0) > 0 && (r.usuarios ?? 0) > 1) out.push({ nivel: "baja", texto: `${r.nunca_entraron} ${r.nunca_entraron === 1 ? "persona invitada no ha entrado" : "personas invitadas no han entrado"}` });
  if (r.ultimo_evento && !r.ultima_transmision && edad >= 14) out.push({ nivel: "baja", texto: "Hace eventos pero nunca ha usado En vivo" });
  return out;
}

// Para ordenar "Necesitan atención": primero las de peor estado y más alertas.
export function prioridadAtencion(r, ahora = Date.now()) {
  const pesos = { alta: 10, media: 3, baja: 1 };
  const alertas = alertasIglesia(r, ahora).reduce((s, a) => s + pesos[a.nivel], 0);
  return ESTADOS_SALUD[estadoSalud(r, ahora)].orden * 100 - alertas;
}
