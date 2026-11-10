// Planes de suscripción (pedido de Eldin, 2026-11-10). La fuente de verdad son los límites en la base
// (migración 20261115000000_planes_suscripcion.sql: triggers que bloquean agregar por encima del plan).
// Aquí solo se muestran los planes y se ponen candados en la app para que nadie choque contra un error.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

export const PLANES = [
  {
    id: "gratis", nombre: "Gratis", precio: 0, precioAnual: 0, color: "#5661B3",
    resumen: "Para empezar a proyectar el domingo",
    incluye: ["Hasta 5 miembros", "Biblia en todas las versiones", "Pantalla de escenario (teleprompter)", "Eventos y setlist", "Proyección en vivo", "Hasta 50 canciones", "1 ministerio", "Asistente: 5 mensajes al día"],
  },
  {
    id: "ministerio", nombre: "Ministerio", precio: 9.99, precioAnual: 99, color: "#1F8A73",
    resumen: "Para el equipo de alabanza completo",
    incluye: ["Hasta 15 miembros", "Todo lo del plan Gratis", "Modo Músico (acordes, auto-avance, tap tempo)", "Canciones ilimitadas", "Plantillas de eventos", "Hasta 3 ministerios", "Asistente: 30 mensajes al día"],
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
