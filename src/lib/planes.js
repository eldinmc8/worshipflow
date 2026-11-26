// Planes de suscripción (pedido de Eldin, 2026-11-10). La fuente de verdad son los límites en la base
// (migración 20261115000000_planes_suscripcion.sql: triggers que bloquean agregar por encima del plan).
// Aquí solo se muestran los planes y se ponen candados en la app para que nadie choque contra un error.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

// Los planes y el cuadro comparativo viven en planesDatos.js (sin Supabase) para que la página web los use
// también al publicar (vite.config.js arma con ellos el texto para Google).
import { PLANES } from "./planesDatos.js";
export { PLANES, COMPARATIVO } from "./planesDatos.js";

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
  estilos_animados: { plan: "ministerio", nombre: "Todas las letras animadas y fondos en movimiento" },
  galeria_disenos: { plan: "ministerio", nombre: "Galería completa de diseños para diapositivas" },
  fondo_propio: { plan: "crecimiento", nombre: "Imagen o video propio de fondo" },
  importar: { plan: "crecimiento", nombre: "Importar PowerPoint y PDF al culto, y canciones de internet" },
  // Importar canciones de archivos (PDF, Holyrics, ProPresenter, OpenLP…): solo plan Iglesia (Eldin, 2026-11-26).
  importar_canciones: { plan: "iglesia", nombre: "Importar tus canciones de otros programas (Holyrics, ProPresenter, OpenLP…) o PDF" },
  bosquejo: { plan: "crecimiento", nombre: "Bosquejo del predicador y Modo Predicar" },
  identidad: { plan: "crecimiento", nombre: "Identidad de la iglesia (logo y colores)" },
  animaciones_propias: { plan: "crecimiento", nombre: "Crear letras animadas propias" },
  roles_personalizados: { plan: "iglesia", nombre: "Roles y permisos personalizados" },
  // Plan Gratis más limitado (Eldin, 2026-11-26): canciones ilimitadas en los planes de pago, y esto pide Ministerio.
  pantallas_extra: { plan: "ministerio", nombre: "Pantalla de escenario y salida para OBS" },
  botones_rapidos: { plan: "ministerio", nombre: "Botones de un solo toque" },
  audio_culto: { plan: "ministerio", nombre: "Música y diapositivas con audio" },
  material_cancion: { plan: "ministerio", nombre: "Material de la canción (tutoriales, partituras y fotos)" },
  sin_conexion: { plan: "ministerio", nombre: "Preparar para usar sin conexión" },
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
// Plan Gratis: 3 letras animadas básicas de fábrica (Eldin, 2026-11-26; antes 5), sin crear ni usar las de la galería.
export const ANIMACIONES_BASICAS = ["suave", "luz", "karaoke"];



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
