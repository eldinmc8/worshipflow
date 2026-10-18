// Piezas de animación que cada iglesia combina a su gusto (pedido de Eldin, 2026-10-18: "que las iglesias
// creen sus propias animaciones aquí en la app"). Las mismas piezas sirven para:
// - Estilos de letra animada propios ("recetas", ver components/EditorAnimacion.jsx): cómo entra cada
//   palabra/letra/línea de una canción, cómo se queda, la letra, los colores y el fondo animado.
// - Elementos de una diapositiva diseñada (editor de diapositivas): cómo entra cada texto, imagen o forma,
//   con su retraso y, si se quiere, al clic (paso a paso).
// Todo es una "receta" de datos que se dibuja con CSS (keyframes wfx-* en index.css) y canvas: pesa casi
// nada, viaja dentro del estilo en vivo y funciona sin internet.
//
// Las keyframes usan --m como "unidad de movimiento": 1em en la letra de una canción, unos cqw en una
// diapositiva — así la misma animación se ve proporcionada en una miniatura y en el proyector.

export const ENTRADAS = [
  { clave: "aparecer", nombre: "Aparecer", dur: 0.7 },
  { clave: "subir", nombre: "Subir", dur: 0.8 },
  { clave: "bajar", nombre: "Caer desde arriba", dur: 1.1 },
  { clave: "deslizar", nombre: "Deslizar de lado", dur: 0.8 },
  { clave: "volar", nombre: "Volar desde lejos", dur: 0.8, rebote: true },
  { clave: "rebotar", nombre: "Rebotar", dur: 0.7, rebote: true },
  { clave: "crecer", nombre: "Crecer", dur: 0.6, rebote: true },
  { clave: "golpe", nombre: "Golpe", dur: 0.45, golpe: true },
  { clave: "girar", nombre: "Girar", dur: 0.8, rebote: true },
  { clave: "desenfoque", nombre: "Salir de la niebla", dur: 1.3 },
  { clave: "parpadear", nombre: "Encenderse (neón)", dur: 0.9, pasos: true },
  { clave: "escribir", nombre: "Escribirse", dur: 0.01, pasos: true },
];
export const PERMANENCIAS = [
  { clave: "quieta", nombre: "Quieta" },
  { clave: "flotar", nombre: "Flotar", dur: 3.2 },
  { clave: "latir", nombre: "Latir", dur: 1.4 },
  { clave: "brillar", nombre: "Brillar", dur: 2.6 },
  { clave: "ondular", nombre: "Ondular", dur: 1.6 },
  { clave: "balancear", nombre: "Balancearse", dur: 2.2 },
];
const entradaDe = (k) => ENTRADAS.find((e) => e.clave === k);
const permanenciaDe = (k) => PERMANENCIAS.find((p) => p.clave === k);

function curva(e) {
  if (!e) return "ease";
  if (e.pasos) return "steps(1, end)";
  if (e.golpe) return "cubic-bezier(.7,0,.3,1)";
  if (e.rebote) return "cubic-bezier(.3,1.5,.5,1)";
  return "cubic-bezier(.2,.7,.2,1)";
}

// La propiedad CSS `animation` de un elemento: entrada (una vez) + permanencia (en bucle, después).
// velocidad: 0.5 (lento) – 2 (rápido). retraso en segundos.
export function cssAnimacion({ entrada, permanencia, velocidad = 1, retraso = 0 }) {
  const partes = [];
  const e = entradaDe(entrada);
  let fin = retraso;
  if (e) {
    const dur = e.pasos && e.clave === "escribir" ? 0.01 : e.dur / Math.max(0.25, velocidad);
    partes.push(`wfx-${e.clave} ${dur.toFixed(3)}s ${curva(e)} ${retraso.toFixed(3)}s both`);
    fin = retraso + dur;
  }
  const p = permanenciaDe(permanencia);
  if (p && p.dur) partes.push(`wfx-p-${p.clave} ${p.dur}s ease-in-out ${(fin + 0.05).toFixed(3)}s infinite alternate`);
  return partes.length ? partes.join(", ") : undefined;
}

// ---------------- Recetas de letra animada ----------------
export const SOMBRAS_RECETA = [
  { clave: "ninguna", nombre: "Ninguna" },
  { clave: "suave", nombre: "Sombra suave" },
  { clave: "solida", nombre: "Sombra sólida" },
  { clave: "contorno", nombre: "Contorno" },
  { clave: "brillo", nombre: "Brillo" },
  { clave: "neon", nombre: "Neón" },
];
export function cssSombraReceta(tipo, color = "#FFB45C") {
  switch (tipo) {
    case "suave": return "0 0.06em 0.3em rgba(0,0,0,.55)";
    case "solida": return "0.06em 0.06em 0 rgba(0,0,0,.85)";
    case "contorno": return "0.04em 0.04em 0 #000, -0.04em 0.04em 0 #000, 0.04em -0.04em 0 #000, -0.04em -0.04em 0 #000, 0.08em 0.08em 0 #000";
    case "brillo": return `0 0 0.3em ${color}, 0 0 0.9em ${color}88`;
    case "neon": return `0 0 0.05em #fff, 0 0 0.15em ${color}, 0 0 0.35em ${color}, 0 0 0.7em ${color}`;
    default: return "none";
  }
}

export const RECETA_VACIA = {
  v: 1,
  fuente: "poppins", negrita: true, mayusculas: false, espaciado: 0,
  color: "#FFFFFF", sombra: "suave", colorEfecto: "#FFB45C",
  claves: false, colorClave: "#E8821E", palabrasClave: "",
  unidad: "palabra", entrada: "subir", velocidad: 1, separacion: 0.1,
  permanencia: "quieta",
  fondo: { tipo: "aurora", tono: 0, brillo: 1, velocidad: 1, densidad: 1 },
  destello: false,
};

// Normaliza lo que venga guardado (versiones viejas, campos faltantes) a una receta completa.
export function recetaCompleta(r) {
  const base = { ...RECETA_VACIA, ...(r || {}) };
  base.fondo = { ...RECETA_VACIA.fondo, ...((r && r.fondo) || {}) };
  if (!entradaDe(base.entrada)) base.entrada = "aparecer";
  if (!permanenciaDe(base.permanencia)) base.permanencia = "quieta";
  if (!["linea", "palabra", "letra"].includes(base.unidad)) base.unidad = "palabra";
  base.velocidad = Math.min(2, Math.max(0.4, Number(base.velocidad) || 1));
  base.separacion = Math.min(0.6, Math.max(0, Number(base.separacion) || 0));
  return base;
}

export function listaPalabrasClave(texto) {
  return String(texto || "").split(/[,\n]/).map((s) => s.trim().toLowerCase().replace(/[¡!¿?.,;:]/g, "")).filter(Boolean);
}

// ---------------- Animación de los elementos de una diapositiva ----------------
// capa.anim = { entrada, permanencia, velocidad, retraso, paso, unidad }
//   paso: 0 = aparece con la diapositiva; 1, 2, 3… = aparece con cada clic de "Siguiente".
//   unidad (solo texto): "todo" | "palabra" | "letra".
export const ANIM_CAPA_VACIA = { entrada: "aparecer", permanencia: "quieta", velocidad: 1, retraso: 0, paso: 0, unidad: "todo" };

export function capaTieneAnimacion(capa) {
  return !!(capa?.anim && (entradaDe(capa.anim.entrada) || (permanenciaDe(capa.anim.permanencia)?.dur) || capa.anim.paso > 0));
}
// Cuántos clics de "Siguiente" tiene una diapositiva antes de pasar a la otra.
export function pasosDeDiapositiva(diseno) {
  let max = 0;
  for (const c of diseno?.capas || []) if (c.anim?.paso > max) max = c.anim.paso;
  return max;
}
