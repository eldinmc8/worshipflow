// Preferencias de ESTE dispositivo (pedido de Eldin, 2026-10-09), igual que el modo oscuro: cada
// quien decide en su celular/computadora, no afecta a nadie más ni a la pantalla de Proyección.
//
// - Tamaño de letra de la app: "normal" | "grande" | "muy_grande" — para los hermanos mayores que
//   no alcanzan a leer. Agranda TODA la app (CSS zoom en <html>), nunca la Proyección (que es otra
//   página: ?screen=publico, y main.jsx no llama iniciarPreferencias ahí).
// - Cómo ver tonos y acordes: "letras" (C D E) | "solfeo" (Do Re Mi). Solo cambia cómo se MUESTRAN;
//   lo guardado sigue en letras, así que cada músico puede ver el suyo sin afectar a los demás.
import { useEffect, useState } from "react";

const K_TAMANO = "worshipflow_tamano_letra";
const K_NOTACION = "worshipflow_notacion";

export const TAMANOS_LETRA = [
  { value: "normal", label: "Normal", zoom: 1 },
  { value: "grande", label: "Grande", zoom: 1.15 },
  { value: "muy_grande", label: "Muy grande", zoom: 1.3 },
];
export const NOTACIONES = [
  { value: "letras", label: "C  D  E" },
  { value: "solfeo", label: "Do  Re  Mi" },
];

const listeners = new Set();
const avisar = () => listeners.forEach((fn) => fn());

function leer(key, validos, porDefecto) {
  try {
    const v = localStorage.getItem(key);
    return validos.includes(v) ? v : porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(key, v) {
  try { localStorage.setItem(key, v); } catch { /* sin localStorage: vale solo para esta sesión */ }
}

let tamanoActual = null;
let notacionActual = null;

export function getTamanoLetra() {
  if (tamanoActual === null) tamanoActual = leer(K_TAMANO, TAMANOS_LETRA.map((t) => t.value), "normal");
  return tamanoActual;
}
export function getNotacion() {
  if (notacionActual === null) notacionActual = leer(K_NOTACION, NOTACIONES.map((n) => n.value), "letras");
  return notacionActual;
}

export function zoomDe(tamano) {
  return TAMANOS_LETRA.find((t) => t.value === tamano)?.zoom || 1;
}

// Algunos navegadores agrandan también las unidades vh con el zoom (Chrome moderno) y otros no. El
// alto de la app (.app-shell-height, 100dvh) tiene que seguir midiendo exactamente la pantalla, así
// que se mide de verdad cuánto crece un 100vh y se compensa con --wf-vh-div (ver index.css).
function aplicarAlDocumento(tamano) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const zoom = zoomDe(tamano);
  html.style.zoom = zoom === 1 ? "" : String(zoom);
  let divisor = 1;
  if (zoom !== 1 && document.body) {
    const prueba = document.createElement("div");
    prueba.style.cssText = "position:absolute;visibility:hidden;top:0;left:0;width:1px;height:100vh;";
    document.body.appendChild(prueba);
    const medido = prueba.getBoundingClientRect().height;
    prueba.remove();
    const alto = window.innerHeight || medido;
    if (alto && medido / alto > 1.05) divisor = zoom;
  }
  html.style.setProperty("--wf-vh-div", String(divisor));
}

export function setTamanoLetra(tamano) {
  tamanoActual = tamano;
  guardar(K_TAMANO, tamano);
  aplicarAlDocumento(tamano);
  avisar();
}
export function setNotacion(notacion) {
  notacionActual = notacion;
  guardar(K_NOTACION, notacion);
  avisar();
}

// Al arrancar la app (main.jsx), antes de montar React, para que no "salte" el tamaño.
export function iniciarPreferencias() {
  aplicarAlDocumento(getTamanoLetra());
}

export function usePreferencias() {
  const [, forzar] = useState(0);
  useEffect(() => {
    const fn = () => forzar((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return { tamanoLetra: getTamanoLetra(), notacion: getNotacion() };
}

// ---- Do Re Mi ----
const SOLFEO = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };

// Una nota o acorde suelto: cambia la raíz y deja el resto tal cual. "C#m7" → "Do#m7",
// "Bb" → "Sib", "G/B" → "Sol/Si", "Am" → "Lam". Lo que no sea un acorde (N.C., "x2") queda igual.
export function acordeEn(acorde, notacion = getNotacion()) {
  if (!acorde || notacion !== "solfeo") return acorde;
  return String(acorde).replace(/(^|\/)([A-G])(?=[#b♯♭]|[^a-z]|m|maj|min|dim|aug|sus|add|$)/g, (_, pre, letra) => `${pre}${SOLFEO[letra]}`);
}

// Una línea con acordes inline "[G]Te alabo [D/F#]Señor" → los acordes entre corchetes convertidos.
export function lineaEn(linea, notacion = getNotacion()) {
  if (!linea || notacion !== "solfeo") return linea;
  return linea.replace(/\[([^\]]+)\]/g, (_, c) => `[${acordeEn(c, notacion)}]`);
}
