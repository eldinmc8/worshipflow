import { supabase } from "./supabaseClient.js";

// Unirse a una iglesia con un enlace (?unirse=CODIGO) + aprobación del líder. La base hace todo el
// trabajo (ver migración 20261124000000_unirse_con_enlace.sql); esto son solo las llamadas.
//
// El código se guarda en este dispositivo apenas se abre el enlace: así sobrevive a la vuelta de Google
// y al enlace de "confirma tu correo", que pueden regresar sin el ?unirse= en la dirección.

const LLAVE = "worshipflow_codigo_unirse";

export function leerCodigoDeUrl(search = typeof window !== "undefined" ? window.location.search : "") {
  try {
    const c = new URLSearchParams(search).get("unirse");
    return c && /^[0-9a-zA-Z]{6,40}$/.test(c.trim()) ? c.trim() : null;
  } catch { return null; }
}

export function guardarCodigo(codigo) {
  try { if (codigo) localStorage.setItem(LLAVE, codigo); } catch { /* sin storage */ }
}

export function codigoGuardado() {
  try { return localStorage.getItem(LLAVE) || null; } catch { return null; }
}

// Cuando ya entró (o el código no sirve): se olvida el código y se quita ?unirse= de la dirección.
export function olvidarCodigo() {
  try { localStorage.removeItem(LLAVE); } catch { /* sin storage */ }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("unirse")) {
      url.searchParams.delete("unirse");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch { /* sin window */ }
}

// El código pendiente de esta sesión: el de la dirección, el guardado, o el que quedó en la cuenta al
// registrarse (user_metadata.codigo_union, por si confirmó el correo en otro dispositivo).
export function codigoPendiente(session) {
  return leerCodigoDeUrl() || codigoGuardado() || session?.user?.user_metadata?.codigo_union || null;
}

export function enlaceParaUnirse(codigo, origen = typeof window !== "undefined" ? window.location.origin : "https://app.worshipflowapp.com") {
  return `${origen}/?unirse=${codigo}`;
}

export function mensajeWhatsApp(nombreIglesia, enlace) {
  const texto = `Únete a ${nombreIglesia || "nuestra iglesia"} en WorshipFlow: ${enlace}`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

// Nombre para la solicitud: el que escribió al registrarse, o el de Google.
export function nombreDeSesion(session) {
  const m = session?.user?.user_metadata || {};
  return (m.nombre || m.full_name || m.name || "").trim();
}

const rpc = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

export async function iglesiaPorCodigo(codigo) {
  const filas = await rpc("wf_iglesia_por_codigo", { p_codigo: codigo });
  return (Array.isArray(filas) ? filas[0] : filas) || null;
}

// { estado: "pendiente" | "rechazada" | "miembro" | "codigo_invalido", iglesia? }
export const solicitarIngreso = (codigo, nombre) => rpc("wf_solicitar_ingreso", { p_codigo: codigo, p_nombre: nombre || "" });
// { estado, iglesia } o null si no tiene ninguna.
export const miSolicitud = () => rpc("wf_mi_solicitud");

export const codigoDeMiIglesia = () => rpc("wf_codigo_union");
export const cambiarCodigoDeMiIglesia = () => rpc("wf_cambiar_codigo_union");

export async function solicitudesPendientes() {
  const { data, error } = await supabase.from("solicitudes_ingreso").select("id, nombre, email, estado, creado_at").eq("estado", "pendiente");
  if (error) throw new Error(error.message);
  return (data || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es", { sensitivity: "base" }));
}

export const aprobarSolicitud = (id, rol, rolId = null) => rpc("wf_aprobar_solicitud", { p_id: id, p_rol: rol, p_rol_id: rolId });
export const rechazarSolicitud = (id) => rpc("wf_rechazar_solicitud", { p_id: id });
