import { supabase } from "./supabaseClient.js";
import { enlacePantalla, enlaceEscenario } from "./enlacePantalla.js";

// "Conectar TV" (2026-11-02): el TV abre /tv, muestra un número de 6 dígitos y Multimedia lo escribe en
// la app. Ver migración 20261105000000_conectar_tv.sql.

const CLAVE_TOKEN = "worshipflow_tv_token";

// Secreto propio de este TV (se guarda en el TV). Con respaldo para navegadores de TV viejos.
export function tokenDelTv(almacen = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const guardado = almacen?.getItem(CLAVE_TOKEN);
    if (guardado && guardado.length >= 24) return guardado;
  } catch { /* sin storage */ }
  let nuevo = "";
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    nuevo = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    for (let i = 0; i < 32; i++) nuevo += Math.floor(Math.random() * 16).toString(16);
  }
  try { almacen?.setItem(CLAVE_TOKEN, nuevo); } catch { /* sin storage */ }
  return nuevo;
}

export async function pedirCodigoTv(token) {
  const { data, error } = await supabase.rpc("tv_pedir_codigo", { p_token: token });
  if (error) throw error;
  return data;
}

export async function estadoTv(token) {
  const { data, error } = await supabase.rpc("tv_estado", { p_token: token });
  if (error) throw error;
  return data || { estado: "nuevo" };
}

// Desde la app (Multimedia). Devuelve un mensaje de error entendible si no se pudo.
export async function vincularTv(codigo, tipo) {
  const limpio = String(codigo || "").replace(/\D/g, "");
  if (limpio.length !== 6) throw new Error("Escribe los 6 números que aparecen en el TV.");
  const { error } = await supabase.rpc("tv_vincular", { p_codigo: limpio, p_tipo: tipo });
  if (!error) return true;
  if (error.code === "42501") throw new Error("Solo Multimedia o un administrador puede conectar pantallas.");
  if (error.code === "P0002") throw new Error("Ese número no existe o ya venció. Revisa el TV: el número cambia cada 15 minutos.");
  if (error.code === "PGRST202") throw new Error("Falta activar esta función en la base de datos.");
  throw new Error("No se pudo conectar el TV. Revisa tu conexión a internet.");
}

// La dirección que abre el TV ya conectado (con ?tv=1 para que, al vencer, vuelva solo a /tv).
export function direccionDeTvConectado(e, origen = typeof window !== "undefined" ? window.location.origin : "") {
  const base = e.tipo === "escenario" ? enlaceEscenario(e.slug, origen, e.codigo) : enlacePantalla(e.slug, origen, e.codigo);
  return `${base}${base.includes("?") ? "&" : "?"}tv=1${!e.slug && e.iglesia_id ? `&iid=${e.iglesia_id}` : ""}`;
}

export function direccionTv(origen = typeof window !== "undefined" ? window.location.origin : "") {
  return `${origen}/tv`;
}
