// Computadora con la fecha u hora mal (caso real, 2026-11-11: un miembro de Ministerio Benjamín
// Honduras entraba bien en su celular, pero en la PC le salía "Todavía no tienes acceso").
//
// Qué pasaba: Supabase da una "llave" de sesión que vence en 1 hora, con la hora del SERVIDOR. Si el
// reloj de la computadora va adelantado más de esa hora, la llave nueva ya le parece vencida apenas
// llega: pide otra, y otra, y otra (decenas por segundo) hasta que Supabase la frena por exceso de
// pedidos y la sesión se cae a media carga. La lectura del perfil que justo estaba en camino salía
// sin sesión → "no hay fila" → la app concluía que la persona no estaba invitada.
//
// Cómo se detecta: una llave recién renovada trae `iat` (cuándo la emitió el servidor). Justo al
// recibirla, la hora de la computadora y ese `iat` deberían ser casi iguales; la diferencia es cuánto
// está corrido el reloj.

export const DESFASE_MAXIMO_SEG = 30 * 60; // más de media hora corrido = reloj mal

function payloadJwt(token) {
  try {
    const parte = String(token || "").split(".")[1];
    if (!parte) return null;
    const b64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

// Segundos que la computadora va adelantada (+) o atrasada (−) respecto al servidor, a partir de una
// sesión RECIÉN emitida (evento TOKEN_REFRESHED). null si no se puede saber.
export function desfaseDeReloj(session, ahoraMs = Date.now()) {
  const iat = payloadJwt(session?.access_token)?.iat;
  return typeof iat === "number" ? Math.round(ahoraMs / 1000 - iat) : null;
}

export const relojMal = (desfase) => desfase !== null && Math.abs(desfase) > DESFASE_MAXIMO_SEG;

// "2 horas adelantada", "1 día atrasada", "45 minutos adelantada".
export function describirDesfase(desfase) {
  const seg = Math.abs(desfase);
  const sentido = desfase > 0 ? "adelantada" : "atrasada";
  if (seg >= 86400 * 1.5) return `${Math.round(seg / 86400)} días ${sentido}`;
  if (seg >= 86400 * 0.75) return `1 día ${sentido}`;
  if (seg >= 3600 * 1.5) return `${Math.round(seg / 3600)} horas ${sentido}`;
  if (seg >= 3600 * 0.75) return `1 hora ${sentido}`;
  return `${Math.round(seg / 60)} minutos ${sentido}`;
}
