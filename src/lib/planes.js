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
    incluye: ["Hasta 20 miembros", "Todo lo del plan Gratis", "Modo Músico (acordes, auto-avance, tap tempo)", "Letras animadas y fondos en movimiento", "Canciones ilimitadas", "Plantillas de eventos", "Hasta 3 ministerios", "Asistente: 30 mensajes al día"],
  },
  {
    id: "crecimiento", nombre: "Crecimiento", precio: 19.99, precioAnual: 199, color: "#2F5FA8",
    resumen: "Para verse profesional cada domingo",
    incluye: ["Hasta 50 miembros", "Todo lo del plan Ministerio", "Importar PowerPoint y PDF", "Bosquejo del predicador y Modo Predicar", "Logo y colores de tu iglesia", "Imagen o video propio de fondo", "Crear letras animadas propias", "Hasta 6 ministerios", "Asistente: 60 mensajes al día"],
  },
  {
    id: "iglesia", nombre: "Iglesia", precio: 29.99, precioAnual: 299, color: "#E8821E",
    resumen: "Toda la iglesia, organizada y sin límites",
    incluye: ["Miembros ilimitados", "Todo lo del plan Crecimiento", "Roles y permisos personalizados", "Te ayudamos a cargar tus canciones", "Ministerios ilimitados", "Asistente: 100 mensajes al día", "Soporte prioritario por WhatsApp"],
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

// Funciones por plan (pedido de Eldin, 2026-11-10: que cada plan sume algo más que miembros).
// Se deciden aquí (no en la base) porque son pantallas y herramientas, no datos que haya que proteger.
const NIVEL = { gratis: 0, ministerio: 1, crecimiento: 2, iglesia: 3 };
export const FUNCIONES_PLAN = {
  estilos_animados: { plan: "ministerio", nombre: "Letras animadas y fondos en movimiento" },
  fondo_propio: { plan: "crecimiento", nombre: "Imagen o video propio de fondo" },
  importar: { plan: "crecimiento", nombre: "Importar PowerPoint, PDF y canciones de internet" },
  bosquejo: { plan: "crecimiento", nombre: "Bosquejo del predicador y Modo Predicar" },
  identidad: { plan: "crecimiento", nombre: "Identidad de la iglesia (logo y colores)" },
  animaciones_propias: { plan: "crecimiento", nombre: "Crear letras animadas propias" },
  roles_personalizados: { plan: "iglesia", nombre: "Roles y permisos personalizados" },
};
// ¿El plan incluye esta función? Mientras no se sabe el plan, sí (no se traba un culto por la red).
export function tiene(plan, funcion) {
  if (!plan?.plan) return true;
  const req = FUNCIONES_PLAN[funcion]?.plan;
  return !req || (NIVEL[plan.plan] ?? 0) >= NIVEL[req];
}
export const nombrePlanRequerido = (funcion) => planPorId(FUNCIONES_PLAN[funcion]?.plan).nombre;
// Compatibilidad: letras animadas y fondos en movimiento.
export const estilosAvanzados = (plan) => tiene(plan, "estilos_animados");

// Cuadro comparativo (página de precios). Valor por plan: true/false o un texto.
export const COMPARATIVO = [
  { grupo: "Equipo", filas: [
    ["Miembros con cuenta", "5", "20", "50", "Ilimitados"],
    ["Ministerios", "1", "3", "6", "Ilimitados"],
    ["Roles, confirmaciones y recordatorios", true, true, true, true],
    ["Roles y permisos personalizados", false, false, false, true],
  ] },
  { grupo: "Canciones y culto", filas: [
    ["Canciones", "50", "Ilimitadas", "Ilimitadas", "Ilimitadas"],
    ["Eventos y setlist", true, true, true, true],
    ["Plantillas de eventos", false, true, true, true],
    ["Biblia (RVR1960, NVI, TLA, DHH, NTV)", true, true, true, true],
    ["Importar PowerPoint y PDF", false, false, true, true],
    ["Bosquejo del predicador y Modo Predicar", false, false, true, true],
  ] },
  { grupo: "Proyección", filas: [
    ["Proyección en vivo y TV", true, true, true, true],
    ["Pantalla de escenario (teleprompter)", true, true, true, true],
    ["Temas de color y tipos de letra", true, true, true, true],
    ["Letras animadas", false, true, true, true],
    ["Fondos en movimiento", false, true, true, true],
    ["Imagen o video propio de fondo", false, false, true, true],
    ["Crear letras animadas propias", false, false, true, true],
    ["Logo y colores de tu iglesia", false, false, true, true],
  ] },
  { grupo: "Músicos", filas: [
    ["Acordes y transporte de tono", true, true, true, true],
    ["Modo Músico: auto-avance, tap tempo y dirigir", false, true, true, true],
  ] },
  { grupo: "Extras", filas: [
    ["Asistente con IA (mensajes al día)", "5", "30", "60", "100"],
    ["Te ayudamos a cargar tus canciones", false, false, false, true],
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
