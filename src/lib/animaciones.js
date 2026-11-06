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
  // Más entradas (2026-11-06, "más de 100 estilos, con efectos juveniles y de concierto").
  { clave: "cortina", nombre: "Cortina", dur: 0.7 },
  { clave: "emerger", nombre: "Emerger de una línea", dur: 0.75 },
  { clave: "caida", nombre: "Caída libre", dur: 0.95 },
  { clave: "zoomatras", nombre: "Llegar desde la cámara", dur: 0.9 },
  { clave: "estampar", nombre: "Estampar", dur: 0.5, golpe: true },
  { clave: "voltear", nombre: "Voltear", dur: 0.75, rebote: true },
  { clave: "girar3d", nombre: "Girar en 3D", dur: 0.8, rebote: true },
  { clave: "elastico", nombre: "Elástico", dur: 0.8 },
  { clave: "barrido", nombre: "Barrido de luz", dur: 0.8 },
  { clave: "sacudida", nombre: "Sacudida", dur: 0.7 },
  { clave: "pixelar", nombre: "Enfocar a saltos", dur: 0.8, escalones: true },
  { clave: "latigazo", nombre: "Latigazo", dur: 0.6, rebote: true },
  { clave: "explosion", nombre: "Armarse (explosión)", dur: 1, rebote: true },
  { clave: "papel", nombre: "Pegar papel", dur: 0.6, rebote: true },
];
export const PERMANENCIAS = [
  { clave: "quieta", nombre: "Quieta" },
  { clave: "flotar", nombre: "Flotar", dur: 3.2 },
  { clave: "latir", nombre: "Latir", dur: 1.4 },
  { clave: "brillar", nombre: "Brillar", dur: 2.6 },
  { clave: "ondular", nombre: "Ondular", dur: 1.6 },
  { clave: "balancear", nombre: "Balancearse", dur: 2.2 },
  { clave: "temblar", nombre: "Temblar", dur: 0.35 },
  { clave: "respirar", nombre: "Respirar", dur: 3.4 },
  { clave: "chispear", nombre: "Chispear (neón)", dur: 3 },
];

// Cómo se ve cada palabra (2026-11-06). "mezcla": se funde con el fondo (necesita que el texto no quede en
// su propia capa — ver ProjectionPanel).
export const TRATAMIENTOS = [
  { clave: "ninguno", nombre: "Normal" },
  { clave: "periodico", nombre: "Recortes de periódico", mezcla: true },
  { clave: "cinta", nombre: "Cinta adhesiva", mezcla: true },
  { clave: "sello", nombre: "Sello", mezcla: true },
  { clave: "caja", nombre: "Caja de color" },
  { clave: "resaltador", nombre: "Resaltador" },
  { clave: "contorno", nombre: "Solo contorno" },
  { clave: "cromo", nombre: "Cromo" },
  { clave: "degradado", nombre: "Degradado de colores" },
  { clave: "calado", nombre: "Letra calada (se ve el fondo)", mezcla: true },
  { clave: "invertido", nombre: "Invertido", mezcla: true },
  { clave: "sombralarga", nombre: "3D (sombra larga)" },
];
// Efectos de toda la pantalla al entrar cada diapositiva.
export const PANTALLAS = [
  { clave: "ninguno", nombre: "Ninguno" },
  { clave: "puertas", nombre: "Pantalla partida (puertas)" },
  { clave: "cortina", nombre: "Pantalla partida (arriba y abajo)" },
  { clave: "diagonal", nombre: "Corte en diagonal" },
  { clave: "persianas", nombre: "Persianas" },
  { clave: "corte", nombre: "Tajo de luz" },
  { clave: "barras", nombre: "Barras de cine" },
  { clave: "led", nombre: "Pantalla LED" },
  { clave: "destellos", nombre: "Destellos al compás" },
  { clave: "barrido", nombre: "Luz que pasa" },
  { clave: "rgb", nombre: "Interferencia de color" },
  { clave: "temblor", nombre: "Temblor" },
  { clave: "acercar", nombre: "Cámara que se acerca" },
  { clave: "espejo", nombre: "Reflejo" },
];
export const ACOMODOS = [
  { clave: "centro", nombre: "Normal" },
  { clave: "escalonado", nombre: "Escalonado" },
  { clave: "cascada", nombre: "En cascada" },
  { clave: "diagonal", nombre: "En diagonal" },
  { clave: "gigante", nombre: "Palabras clave gigantes" },
];
export const tratamientoDe = (k) => TRATAMIENTOS.find((t) => t.clave === k) || TRATAMIENTOS[0];
const entradaDe = (k) => ENTRADAS.find((e) => e.clave === k);
const permanenciaDe = (k) => PERMANENCIAS.find((p) => p.clave === k);

function curva(e) {
  if (!e) return "ease";
  // "Escribirse": un fundido cortísimo y lineal. Con steps() de 0.01 s, Chrome a veces dejaba la primera
  // letra invisible para siempre (se vio en "Diario", 2026-11-06).
  if (e.clave === "escribir") return "linear";
  if (e.pasos) return "steps(1, end)";
  if (e.escalones) return "steps(4, end)";
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
    const dur = e.clave === "escribir" ? 0.04 : e.dur / Math.max(0.25, velocidad);
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
  // 2026-11-06: cómo se ve cada palabra, efecto de pantalla, acomodo y latido al compás (tempo de la canción).
  tratamiento: "ninguno", pantalla: "ninguno", acomodo: "centro", compas: false,
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
  if (!TRATAMIENTOS.some((t) => t.clave === base.tratamiento)) base.tratamiento = "ninguno";
  if (!PANTALLAS.some((t) => t.clave === base.pantalla)) base.pantalla = "ninguno";
  if (!ACOMODOS.some((t) => t.clave === base.acomodo)) base.acomodo = "centro";
  base.compas = !!base.compas;
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
