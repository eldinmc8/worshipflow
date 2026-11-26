// Cuenta regresiva del lanzamiento oficial. La FECHA se cambia en supabase/functions/_shared/lanzamiento.js
// (un solo lugar, compartido con la función crear-iglesia). Aquí solo está lo que necesita la pantalla.
import { useEffect, useState } from "react";
import { FECHA_LANZAMIENTO, MOMENTO_LANZAMIENTO, yaLanzamos } from "../../supabase/functions/_shared/lanzamiento.js";

export { FECHA_LANZAMIENTO, MOMENTO_LANZAMIENTO, yaLanzamos };

// Cierre de la lista de espera (pedido de Eldin, 2026-11-25): el formulario de Google vence a medianoche del
// 26 de noviembre, hora de Guatemala. Desde ese momento la página web ya no muestra los botones ni el recuadro
// de la lista de espera (hasta el lanzamiento solo se ven la cuenta regresiva y los precios).
export const CIERRE_LISTA_ESPERA = "2026-11-26T00:00:00-06:00";
export const MOMENTO_CIERRE_LISTA = Date.parse(CIERRE_LISTA_ESPERA);
export function listaEsperaAbierta(ahora = Date.now()) {
  return ahora < MOMENTO_CIERRE_LISTA && !yaLanzamos(ahora);
}

// Días, horas, minutos y segundos que faltan (todo en 0 si ya pasó).
export function tiempoRestante(ahora = Date.now()) {
  const ms = Math.max(0, MOMENTO_LANZAMIENTO - ahora);
  const s = Math.floor(ms / 1000);
  return { ms, dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), minutos: Math.floor((s % 3600) / 60), segundos: s % 60 };
}

// "viernes, 1 de enero de 2027, 12:00 a. m." en hora de Guatemala.
export function fechaLanzamientoTexto() {
  try {
    return new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(MOMENTO_LANZAMIENTO));
  } catch {
    return FECHA_LANZAMIENTO.slice(0, 10);
  }
}

// "1 de enero" (corto, para botones).
export function fechaLanzamientoCorta() {
  try {
    return new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "long" }).format(new Date(MOMENTO_LANZAMIENTO));
  } catch {
    return FECHA_LANZAMIENTO.slice(0, 10);
  }
}

// Se actualiza cada segundo mientras falte; al llegar a cero, `lanzado` pasa a true sin recargar la página.
export function useLanzamiento() {
  const [ahora, setAhora] = useState(() => Date.now());
  const lanzado = yaLanzamos(ahora);
  useEffect(() => {
    if (lanzado) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lanzado]);
  return { lanzado, listaAbierta: listaEsperaAbierta(ahora), ...tiempoRestante(ahora) };
}
