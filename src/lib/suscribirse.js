// Activar el beneficio de lanzamiento en un toque (pedido de Eldin, 2026-11-23).
//
// 1) Enlace para los correos: https://app.worshipflowapp.com/?suscribirse
//    - Con sesión: va directo a worshipflowapp.com/web/pagar (Paddle se abre solo con el precio y el descuento del
//      grupo_beneficio de la iglesia).
//    - Sin sesión: pide iniciar sesión y, al entrar (correo o Google), sigue solo al pago. El pedido se guarda en
//      este equipo apenas se abre el enlace, porque Google regresa a la app sin el ?suscribirse en la dirección.
//    - Si ya lo activó, venció el plazo, no tiene grupo, ya paga una suscripción o no es administrador: Ajustes → Plan.
// 2) Barra arriba en la app para los administradores que todavía pueden activarlo. Se cierra con la X y vuelve a
//    salir al día siguiente (en ese equipo) hasta que lo active o venza el plazo.

import { beneficioPorGrupo, estadoBeneficio, fechaBeneficio } from "./beneficios.js";
import { enlacePago, pagosConfigurados } from "./paddle.js";

const LLAVE = "wf_ir_a_suscribirse";
// Un pedido viejo (abrió el enlace y nunca entró) no debe mandar al pago por sorpresa días después.
export const VIGENCIA_MS = 2 * 60 * 60 * 1000;

export function leerSuscribirseDeUrl(search = typeof window !== "undefined" ? window.location.search : "") {
  try { return new URLSearchParams(search).has("suscribirse"); } catch { return false; }
}

export function guardarPendiente(ahora = Date.now()) {
  try { localStorage.setItem(LLAVE, String(ahora)); } catch { /* sin storage */ }
}

export function hayPendiente(ahora = Date.now()) {
  if (leerSuscribirseDeUrl()) return true;
  try {
    const t = Number(localStorage.getItem(LLAVE));
    return !!t && ahora - t >= 0 && ahora - t < VIGENCIA_MS;
  } catch { return false; }
}

// Se olvida el pedido y se quita ?suscribirse de la dirección (para que recargar no vuelva a mandar al pago).
export function olvidarPendiente() {
  try { localStorage.removeItem(LLAVE); } catch { /* sin storage */ }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("suscribirse")) {
      url.searchParams.delete("suscribirse");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch { /* sin window */ }
}

// ¿Esta persona puede activar el beneficio ahora mismo? (lo que devuelve mi_plan)
export function puedeActivarBeneficio(plan, ahora = Date.now()) {
  return pagosConfigurados() && !!plan?.soy_admin && !!plan?.iglesia_id && !plan?.tiene_suscripcion && estadoBeneficio(plan?.beneficio, ahora) === "disponible";
}

// A dónde lleva el enlace ?suscribirse: "pago" o "plan" (Ajustes → Plan).
export const destinoSuscribirse = (plan, ahora = Date.now()) => (puedeActivarBeneficio(plan, ahora) ? "pago" : "plan");

export const enlacePagoBeneficio = (plan, correo) => enlacePago({ beneficio: true, iglesiaId: plan.iglesia_id, correo });

// ---- Barra de aviso ----
// Día de hoy en la hora de este equipo (AAAA-MM-DD): la barra cerrada vuelve a salir cuando cambia.
export function hoyLocal(d = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}
const llaveBarra = (iglesiaId) => `wf_barra_beneficio_cerrada_${iglesiaId || ""}`;

export function barraCerradaHoy(iglesiaId, d = new Date()) {
  try { return localStorage.getItem(llaveBarra(iglesiaId)) === hoyLocal(d); } catch { return false; }
}
export function cerrarBarraHoy(iglesiaId, d = new Date()) {
  try { localStorage.setItem(llaveBarra(iglesiaId), hoyLocal(d)); } catch { /* sin storage */ }
}

export function textoBarraBeneficio(beneficio) {
  const info = beneficioPorGrupo(beneficio?.grupo);
  if (!info) return "";
  const meses = `${info.mesesGratis} ${info.mesesGratis === 1 ? "mes" : "meses"} gratis`;
  const fecha = fechaBeneficio(beneficio.plazo_hasta);
  return `Activa tu beneficio de ${meses}${fecha ? ` (hasta ${fecha})` : ""}`;
}
