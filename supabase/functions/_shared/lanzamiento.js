// ─────────────────────────────────────────────────────────────────────────────────────────────
// FECHA DEL LANZAMIENTO OFICIAL (pedido de Eldin, 2026-11-19). ESTE ES EL ÚNICO LUGAR DONDE SE CAMBIA.
//
// Formato: "AAAA-MM-DDTHH:MM:00-06:00" (el -06:00 es la hora de Guatemala).
// Ejemplo: 1 de diciembre de 2026 a las 7:00 p. m. → "2026-12-01T19:00:00-06:00"
//
// Antes de esta fecha:
//   - La página web muestra la cuenta regresiva, los precios y la información, pero NO deja crear iglesias.
//   - La pantalla "Crear mi iglesia" de la app solo funciona con un código de invitación (Fundadoras).
//   - La función de Supabase "crear-iglesia" rechaza cualquier alta sin código (así nadie se lo salta).
// Al llegar la fecha todo se abre solo, sin tocar nada más.
//
// Lo usan la app (src/lib/lanzamiento.js) y la función supabase/functions/crear-iglesia: al cambiar la
// fecha hay que volver a desplegar esa función además de unir el PR.
// ─────────────────────────────────────────────────────────────────────────────────────────────
export const FECHA_LANZAMIENTO = "2026-11-30T00:00:00-06:00"; // medianoche del 30 de noviembre de 2026

export const MOMENTO_LANZAMIENTO = Date.parse(FECHA_LANZAMIENTO);

export function yaLanzamos(ahora = Date.now()) {
  return ahora >= MOMENTO_LANZAMIENTO;
}
