// Planes de suscripción (pedido de Eldin, 2026-11-10). La fuente de verdad son los límites en la base
// (migración 20261115000000_planes_suscripcion.sql: triggers que bloquean agregar por encima del plan).
// Aquí solo se muestran los planes y se ponen candados en la app para que nadie choque contra un error.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export const PLANES = [
  {
    id: "gratis", nombre: "Gratis", precio: 0, precioAnual: 0, color: "#5661B3",
    resumen: "Para empezar a proyectar el domingo",
    incluye: ["Hasta 5 miembros", "Biblia en todas las versiones", "Pantalla de escenario (teleprompter)", "Eventos y setlist", "Proyección en vivo", "Temas de color y tipos de letra", "Hasta 50 canciones", "1 ministerio", "Asistente: 5 mensajes al día"],
  },
  {
    id: "ministerio", nombre: "Ministerio", precio: 9.99, precioAnual: 99, color: "#1F8A73",
    resumen: "Para el equipo de alabanza completo",
    incluye: ["Hasta 20 miembros", "Todo lo del plan Gratis", "Modo Músico (acordes, auto-avance, tap tempo)", "Letras animadas y fondos en movimiento", "Imagen o video propio de fondo", "Canciones ilimitadas", "Plantillas de eventos", "Hasta 3 ministerios", "Asistente: 30 mensajes al día"],
  },
  {
    id: "crecimiento", nombre: "Crecimiento", precio: 19.99, precioAnual: 199, color: "#2F5FA8",
    resumen: "Para la iglesia que está creciendo",
    incluye: ["Hasta 50 miembros", "Todo lo del plan Ministerio", "Hasta 6 ministerios", "Asistente: 60 mensajes al día"],
  },
  {
    id: "iglesia", nombre: "Iglesia", precio: 29.99, precioAnual: 299, color: "#E8821E",
    resumen: "Toda la iglesia, sin límites",
    incluye: ["Miembros ilimitados", "Todo lo del plan Ministerio", "Ministerios ilimitados", "Asistente: 100 mensajes al día", "Soporte prioritario por WhatsApp"],
  },
];

export const planPorId = (id) => PLANES.find((p) => p.id === id) || PLANES[0];

// ---- Plan de MI iglesia: un solo pedido compartido por toda la app ----
let actual = null; // resultado de mi_plan(), o null mientras carga / si falla
let pedido = null;
const listeners = new Set();
const avisar = () => listeners.forEach((fn) => fn(actual));

export function recargarPlan() {
  pedido = supabase.rpc("mi_plan").then(({ data, error }) => {
    // Si falla (sin conexión, migración aún no aplicada), no se bloquea nada: la base igual protege.
    actual = error ? null : data;
    avisar();
    return actual;
  });
  return pedido;
}

export function usePlan() {
  const [plan, setPlan] = useState(actual);
  useEffect(() => {
    listeners.add(setPlan);
    if (!pedido) recargarPlan();
    else setPlan(actual);
    return () => listeners.delete(setPlan);
  }, []);
  return plan;
}

// ¿El plan permite esta función? Mientras no se sabe el plan, se permite (no se traban cultos por red).
export function permite(plan, funcion) {
  if (!plan?.limites) return true;
  return plan.limites[funcion] !== false;
}

// Estilos avanzados de proyección (letras animadas, fondos en movimiento, imagen o video propio de
// fondo): planes de pago. Se decide aquí (no en la base) porque es solo cómo se ve la pantalla.
export function estilosAvanzados(plan) {
  return !plan?.plan || plan.plan !== "gratis";
}

// Cuadro comparativo (página de precios). Valor por plan: true/false o un texto.
export const COMPARATIVO = [
  { grupo: "Equipo", filas: [
    ["Miembros con cuenta", "5", "20", "50", "Ilimitados"],
    ["Ministerios", "1", "3", "6", "Ilimitados"],
    ["Roles, confirmaciones y recordatorios", true, true, true, true],
  ] },
  { grupo: "Canciones y culto", filas: [
    ["Canciones", "50", "Ilimitadas", "Ilimitadas", "Ilimitadas"],
    ["Eventos y setlist", true, true, true, true],
    ["Plantillas de eventos", false, true, true, true],
    ["Biblia (RVR1960, NVI, TLA, DHH, NTV)", true, true, true, true],
  ] },
  { grupo: "Proyección", filas: [
    ["Proyección en vivo y TV", true, true, true, true],
    ["Pantalla de escenario (teleprompter)", true, true, true, true],
    ["Temas de color y tipos de letra", true, true, true, true],
    ["Letras animadas", false, true, true, true],
    ["Fondos en movimiento", false, true, true, true],
    ["Imagen o video propio de fondo", false, true, true, true],
  ] },
  { grupo: "Músicos", filas: [
    ["Acordes y transporte de tono", true, true, true, true],
    ["Modo Músico: auto-avance, tap tempo y dirigir", false, true, true, true],
  ] },
  { grupo: "Extras", filas: [
    ["Asistente con IA (mensajes al día)", "5", "30", "60", "100"],
    ["Soporte", "Correo", "Correo y WhatsApp", "Correo y WhatsApp", "Prioritario por WhatsApp"],
  ] },
];

// ¿Queda cupo? (null en el límite = ilimitado)
export function quedaCupo(plan, clave) {
  const lim = plan?.limites?.[clave];
  if (lim == null) return true;
  return (plan?.uso?.[clave] ?? 0) < lim;
}

export function diasRestantes(vence) {
  if (!vence) return null;
  return Math.max(0, Math.ceil((new Date(vence).getTime() - Date.now()) / 86400000));
}

// Abrir la ventana de planes desde cualquier lado (candados, avisos de límite).
const abrirListeners = new Set();
export function abrirPlanes() { abrirListeners.forEach((fn) => fn()); }
export function onAbrirPlanes(fn) { abrirListeners.add(fn); return () => abrirListeners.delete(fn); }
