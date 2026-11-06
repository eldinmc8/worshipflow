import { useEffect, useRef, useState } from "react";
import { cssAnimacion, cssSombraReceta, recetaCompleta, listaPalabrasClave, tratamientoDe } from "../lib/animaciones.js";
import { ESTILOS_RECETA, GRUPOS_NUEVOS } from "../lib/estilosAnimados.js";
import { familiaDe } from "../lib/diapositivas.js";

// Letras animadas para la proyección (pedido de Eldin, 2026-10-18): "que las letras pasen como en los
// videos", con un clic desde Estilo. Cada estilo trae su propia letra, sus colores, su forma de entrar
// y un fondo animado dibujado en la misma pantalla (canvas): nada se descarga, así que funciona igual
// sin internet y en computadoras sencillas.
//
// Cómo encaja con lo demás:
// - liveStyle.animacion = clave de ANIMACIONES (sin valor o "ninguna" = como siempre).
// - liveStyle.animFondo = "estilo" (por defecto: el fondo animado del estilo) | "propio" (el fondo de
//   siempre: colores, imagen o video de Estilo > Fondo). Un fondo propio de la diapositiva o de la
//   canción ("Fondo por canción") siempre gana.
// - Solo la letra de CANCIONES se anima palabra por palabra; versículos y diapositivas se ven como
//   siempre, encima del mismo fondo animado.
// - Las animaciones solo mueven transform/opacity/filter/color (nunca el tamaño de la letra): así
//   AutoFitText mide bien el texto aunque esté a mitad de la animación. La CSS vive en index.css
//   (clases .wfa-*); aquí solo se arman las palabras con sus variables.

export const GRUPOS_ANIMACION = ["Adoración", "Celebración", "Juvenil", ...GRUPOS_NUEVOS];

export const ANIMACIONES = {
  // ---- Adoración: entradas suaves, para cantar sin distraer ----
  suave: { nombre: "Suave", grupo: "Adoración", desc: "Sube despacio desde la niebla", fondo: "aurora", modo: "palabra",
    fuente: { family: "'Fraunces', serif", weight: 500 }, color: "#FFFFFF", sombra: "0 0.05em 0.3em rgba(0,0,0,.45)",
    muestra: "radial-gradient(circle at 30% 40%, #3B5BA9 0%, transparent 55%), radial-gradient(circle at 75% 65%, #7A3FA0 0%, transparent 55%), #0A1022" },
  luz: { nombre: "Luz", grupo: "Adoración", desc: "Aparece brillando entre destellos dorados", fondo: "bokeh", modo: "palabra",
    fuente: { family: "'Fraunces', serif", weight: 600 }, color: "#FFF4DE", sombra: "0 0 0.35em rgba(255,190,100,.55), 0 0 1em rgba(255,160,60,.25)",
    muestra: "radial-gradient(circle at 50% 45%, #5A3A12 0%, #120A03 70%)" },
  cielo: { nombre: "Cielo", grupo: "Adoración", desc: "Palabras que bajan flotando, cielo estrellado", fondo: "estrellas", modo: "palabra",
    fuente: { family: "'Montserrat', sans-serif", weight: 300, transform: "uppercase", tracking: "0.12em" }, color: "#EAF2FF", sombra: "0 0 0.4em rgba(140,180,255,.45)",
    muestra: "radial-gradient(ellipse at 50% 120%, #1D3B6E 0%, #050914 65%)" },
  karaoke: { nombre: "Karaoke", grupo: "Adoración", desc: "Cada palabra se ilumina al cantarla", fondo: "foco", modo: "palabra",
    fuente: { family: "'Poppins', sans-serif", weight: 700 }, color: "rgba(255,255,255,.3)", sombra: "none",
    muestra: "linear-gradient(135deg, #1B0B3A, #0B1E3F 55%, #3A1608)" },

  // ---- Celebración: movimiento con fuerza, para cantos de júbilo ----
  cinetico: { nombre: "Cinético", grupo: "Celebración", desc: "Palabras que vuelan; las clave en grande", fondo: "rayos", modo: "palabra", claves: true,
    fuente: { family: "'Bebas Neue', sans-serif", weight: 400, tracking: "0.02em" }, color: "#FFFFFF", sombra: "0 0.04em 0.3em rgba(0,0,0,.5)",
    muestra: "linear-gradient(115deg, #0A1424 0%, #1C3A6B 35%, #0A1424 50%, #6B3A10 70%, #1A0F06 100%)" },
  ola: { nombre: "Ola", grupo: "Celebración", desc: "Letra por letra rebotando y ondulando", fondo: "olas", modo: "letra",
    fuente: { family: "'Poppins', sans-serif", weight: 800 }, color: "#FFFFFF", sombra: "0 0.06em 0.25em rgba(0,0,0,.4)",
    muestra: "linear-gradient(180deg, #0E1B3A 0%, #2A1240 60%, #4A3AA0 100%)" },
  impacto: { nombre: "Impacto", grupo: "Celebración", desc: "Golpes de letra gigante con temblor", fondo: "ondas", modo: "palabra", flash: true,
    fuente: { family: "'Bebas Neue', sans-serif", weight: 400, tracking: "0.01em" }, color: "#FFFFFF", sombra: "0 0.04em 0.2em rgba(0,0,0,.6)",
    muestra: "radial-gradient(circle at 50% 50%, transparent 25%, #E8821E 27%, transparent 30%), #08080A" },
  fiesta: { nombre: "Fiesta", grupo: "Celebración", desc: "Saltan con confeti cayendo", fondo: "confeti", modo: "palabra", claves: true,
    fuente: { family: "'Fredoka', 'Quicksand', sans-serif", weight: 700 }, color: "#FFFFFF", sombra: "0 0.06em 0 rgba(0,0,0,.35)",
    muestra: "radial-gradient(circle at 20% 30%, #FFD23F 0 6%, transparent 7%), radial-gradient(circle at 70% 20%, #3EC1D3 0 5%, transparent 6%), radial-gradient(circle at 60% 75%, #FF4F79 0 6%, transparent 7%), #2B1055" },

  // ---- Juvenil: más atrevidos, para actividades de jóvenes ----
  neon: { nombre: "Neón", grupo: "Juvenil", desc: "Se enciende parpadeando como letrero", fondo: "synth", modo: "letra",
    fuente: { family: "'Montserrat', sans-serif", weight: 300, transform: "uppercase", tracking: "0.08em" }, color: "#FFFFFF", sombra: "none",
    muestra: "linear-gradient(180deg, #05030C 55%, #3A0B3A 100%)" },
  glitch: { nombre: "Glitch", grupo: "Juvenil", desc: "Interferencia digital, colores separados", fondo: "glitch", modo: "palabra",
    fuente: { family: "'Archivo Black', sans-serif", weight: 400, transform: "uppercase", tracking: "0.02em" }, color: "#FFFFFF", sombra: "0.045em 0 0 rgba(255,42,109,.9), -0.045em 0 0 rgba(5,217,232,.9)",
    muestra: "repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 2px, transparent 2px 5px), linear-gradient(90deg, #0A0A12, #1A0A2A)" },
  urbano: { nombre: "Urbano", grupo: "Juvenil", desc: "Grafiti estampado con colores fuertes", fondo: "urbano", modo: "palabra", colores: ["#FFE600", "#FFFFFF", "#FF3FA4", "#3EF0FF"],
    fuente: { family: "'Permanent Marker', cursive", weight: 400 }, color: "#FFFFFF", sombra: "0.05em 0.05em 0 rgba(0,0,0,.85)",
    muestra: "radial-gradient(circle at 25% 35%, #FF3FA455 0 18%, transparent 30%), radial-gradient(circle at 75% 60%, #FFE60044 0 20%, transparent 32%), #151515" },
  comic: { nombre: "Cómic", grupo: "Juvenil", desc: "¡POW! Letras de historieta que explotan", fondo: "comic", modo: "palabra", flash: true,
    fuente: { family: "'Bangers', 'Bebas Neue', sans-serif", weight: 400, tracking: "0.04em" }, color: "#FFE14D",
    sombra: "0.04em 0.04em 0 #000, -0.04em 0.04em 0 #000, 0.04em -0.04em 0 #000, -0.04em -0.04em 0 #000, 0.1em 0.1em 0 #000",
    muestra: "repeating-conic-gradient(from 0deg at 50% 50%, #FF7A00 0 10deg, #FFB000 10deg 20deg)" },
  retro: { nombre: "Retro 80", grupo: "Juvenil", desc: "Cromado ochentero con atardecer", fondo: "retro", modo: "palabra", degradado: true,
    fuente: { family: "'Bungee', 'Archivo Black', sans-serif", weight: 400 }, color: "#FFFFFF", sombra: "none",
    muestra: "linear-gradient(180deg, #2B0F4A 0%, #A0287A 55%, #FF8A3D 70%, #1A0630 71%)" },
  pop: { nombre: "Pop", grupo: "Juvenil", desc: "Burbujas de colores que rebotan", fondo: "burbujas", modo: "palabra", colores: ["#FF5FA2", "#FFD23F", "#4DE1C1", "#8F7CFF", "#FF8A3D"],
    fuente: { family: "'Fredoka', 'Quicksand', sans-serif", weight: 700 }, color: "#FFFFFF", sombra: "0 0.07em 0 rgba(0,0,0,.3)",
    muestra: "radial-gradient(circle at 30% 30%, #FF5FA2 0 14%, transparent 15%), radial-gradient(circle at 70% 60%, #4DE1C1 0 12%, transparent 13%), linear-gradient(135deg, #3A1C71, #5B2A86)" },
  maquina: { nombre: "Máquina", grupo: "Juvenil", desc: "Se escribe sola, letra por letra", fondo: "terminal", modo: "letra",
    fuente: { family: "'Courier Prime', 'JetBrains Mono', monospace", weight: 700 }, color: "#E8FFE8", sombra: "0 0 0.3em rgba(80,255,140,.45)",
    muestra: "repeating-linear-gradient(0deg, rgba(80,255,140,.08) 0 1px, transparent 1px 4px), #04110A" },
};

// Estilos propios de la iglesia ("recetas", ver lib/animaciones.js y EditorAnimacion.jsx): en el estilo en
// vivo se guardan como animacion = "mia:<id>" + animReceta (la receta completa), así la pantalla de
// proyección no necesita ir a buscarla a ningún lado — llega con el mismo estilo, también sin internet.
export const ES_PROPIA = (k) => typeof k === "string" && k.startsWith("mia:");

export function animacionActiva(liveStyle) {
  const k = liveStyle?.animacion;
  if (ES_PROPIA(k)) return liveStyle?.animReceta ? k : null;
  return k && ANIMACIONES[k] ? k : null;
}

// Muestra (miniatura quieta) de cada fondo animado, tomada del estilo de fábrica que lo usa.
const MUESTRA_FONDO = {
  ...Object.fromEntries(Object.values(ANIMACIONES).map((a) => [a.fondo, a.muestra])),
  // Fondos nuevos (2026-11-06): concierto, collage y más.
  haces: "conic-gradient(from 200deg at 50% 110%, transparent 0 10deg, rgba(120,170,255,.35) 14deg, transparent 18deg 40deg, rgba(255,120,220,.3) 44deg, transparent 48deg), #05060B",
  led: "radial-gradient(circle at 50% 50%, #3EE7FF55, transparent 60%), repeating-linear-gradient(0deg, #0B0F18 0 3px, #000 3px 4px), #000",
  humo: "radial-gradient(ellipse at 30% 70%, #3A4258 0%, transparent 55%), radial-gradient(ellipse at 75% 40%, #2A3046 0%, transparent 55%), #090B10",
  chispas: "radial-gradient(circle at 50% 120%, #FF7A1A 0%, #3A1204 45%, #0A0402 75%)",
  papel: "repeating-linear-gradient(8deg, #2A2A2A 0 6px, #262626 6px 12px), #222",
  tunel: "repeating-radial-gradient(circle at 50% 50%, #120A2A 0 4%, #3A1E7A 5%, #120A2A 7%)",
  lluvia: "linear-gradient(180deg, #0A1428 0%, #13284A 100%)",
  geometrico: "linear-gradient(135deg, #10131F, #1E1236)",
};
export const FONDOS_DISPONIBLES = [
  ["aurora", "Aurora"], ["bokeh", "Destellos dorados"], ["estrellas", "Cielo estrellado"], ["foco", "Foco de luz"],
  ["rayos", "Rayos de luz"], ["olas", "Olas"], ["ondas", "Ondas de choque"], ["confeti", "Confeti"],
  ["synth", "Neón retro"], ["glitch", "Interferencia"], ["urbano", "Pared urbana"], ["comic", "Cómic"],
  ["retro", "Atardecer 80"], ["burbujas", "Burbujas"], ["terminal", "Pantalla verde"],
  ["haces", "Luces de concierto"], ["led", "Pantalla LED"], ["humo", "Humo de escenario"], ["chispas", "Chispas"],
  ["papel", "Collage de papel"], ["tunel", "Túnel de luz"], ["lluvia", "Lluvia de luz"], ["geometrico", "Geométrico"],
];

// Convierte una receta en la misma forma que tienen los estilos de fábrica (lo que usa la proyección).
export function definicionDeReceta(receta, nombre = "Mi animación") {
  const r = recetaCompleta(receta);
  const sinFondo = r.fondo.tipo === "propio";
  return {
    nombre, grupo: "De mi iglesia", desc: "Animación de tu iglesia", receta: r,
    fondo: sinFondo ? null : r.fondo.tipo, ajustesFondo: r.fondo,
    modo: r.unidad === "letra" ? "letra" : "palabra",
    claves: r.claves, listaClaves: listaPalabrasClave(r.palabrasClave), colorClave: r.colorClave,
    fuente: { family: familiaDe(r.fuente), weight: r.negrita ? 700 : 400, transform: r.mayusculas ? "uppercase" : "none", tracking: `${r.espaciado || 0}em` },
    color: r.color, sombra: r.tratamiento === "ninguno" || r.tratamiento === "resaltador" || r.tratamiento === "caja" ? cssSombraReceta(r.sombra, r.colorEfecto) : "none", flash: r.destello,
    // Tratamientos que se funden con el fondo: la letra no puede ir en su propia capa (ver ProjectionPanel).
    mezcla: !!tratamientoDe(r.tratamiento).mezcla,
    muestra: sinFondo ? "linear-gradient(135deg, #1A1F2B, #0C0E13)" : MUESTRA_FONDO[r.fondo.tipo] || "#111",
  };
}

// Estilos de fábrica hechos con recetas (2026-11-06, ver lib/estilosAnimados.js): se agregan al mismo menú.
for (const e of ESTILOS_RECETA) {
  if (!ANIMACIONES[e.clave]) ANIMACIONES[e.clave] = { ...definicionDeReceta(e.receta, e.nombre), grupo: e.grupo, desc: e.desc };
}

// Lo que necesita la proyección del estilo activo: { clave, def } o null (letra como siempre).
export function definicionAnimacion(liveStyle) {
  const k = animacionActiva(liveStyle);
  if (!k) return null;
  if (ES_PROPIA(k)) return { clave: k, def: definicionDeReceta(liveStyle.animReceta, liveStyle.animNombre) };
  return { clave: k, def: ANIMACIONES[k] };
}
// Velocidad de la letra animada (pedido de Eldin, 2026-10-21: "a veces cantamos más rápido que el
// tiempo que dura en aparecer una letra"). liveStyle.animVelocidad: 0.5 (más lenta) – 2.5 (mucho más
// rápida); 1 = normal. "Normal" ya es un poco más rápido que el diseño original (BASE_TIEMPO).
export const BASE_TIEMPO = 0.75;
export const VELOCIDADES_LETRA = [
  { valor: 0.7, nombre: "Lenta" },
  { valor: 1, nombre: "Normal" },
  { valor: 1.4, nombre: "Rápida" },
  { valor: 2, nombre: "Muy rápida" },
];
export function velocidadLetra(liveStyle) {
  const v = Number(liveStyle?.animVelocidad);
  return Number.isFinite(v) && v > 0 ? Math.min(2.5, Math.max(0.5, v)) : 1;
}
export function nombreAnimacion(liveStyle) {
  return definicionAnimacion(liveStyle)?.def.nombre || null;
}

// Pseudoaleatorio estable (misma diapositiva = mismo vuelo de palabras en todas las pantallas).
function semilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const CLAVES = /^(santo|santa|señor|dios|jesús|jesus|cristo|rey|gloria|aleluya|hosanna|amén|amen|digno|padre|espíritu|espiritu|cordero|salvador|majestad|poderoso|grande|vida|amor|gracia|fuego|libre|victoria|eterno)$/i;

// Arma cada línea en palabras (y letras, si el estilo lo pide) con las variables que usa la CSS.
// Devuelve { lineas: ReactNode[], vars: estilo para el contenedor }.
// vel: velocidad elegida en la consola (ver velocidadLetra); acelera entradas y turnos, no los bucles.
export function armarLineasAnimadas(clave, lineas, idDiapositiva, vel = 1) {
  const a = typeof clave === "string" ? ANIMACIONES[clave] : clave;
  const tiempo = BASE_TIEMPO / (Number(vel) > 0 ? Number(vel) : 1); // multiplica duraciones y retrasos
  const r0 = a.receta || null;
  const r = r0 ? { ...r0, velocidad: r0.velocidad / tiempo, separacion: r0.separacion * tiempo } : null;
  const rnd = semilla(`${idDiapositiva}|${lineas.join("/")}`);
  let iPal = 0, iLet = 0;
  const totalPal = lineas.reduce((n, l) => n + l.split(/\s+/).filter(Boolean).length, 0) || 1;
  // Cómo se ve cada palabra (recortes de periódico, cinta, caja...): un "papel" adentro de la palabra, con su
  // variante e inclinación (la animación va en la palabra; la inclinación, en el papel: no chocan).
  const trat = r?.tratamiento || "ninguno";
  const conTrat = trat !== "ninguno" && trat !== "contorno" && trat !== "invertido";
  const porLetraTrat = conTrat && a.modo === "letra" && ["periodico", "calado", "caja", "sello", "cromo", "degradado"].includes(trat);
  const envolver = (contenido, key, v) => (
    <span key={key} className={`wft-in wft-v${v}`} style={{ "--rr": (rnd() * 2 - 1).toFixed(3), ...(trat === "cinta" ? { "--cinta": CINTAS[Math.floor(rnd() * CINTAS.length)] } : {}) }}>{contenido}</span>
  );
  // La fusión con el fondo va en la palabra (o letra) animada misma: una animación deja al elemento en su
  // propia capa, y una mezcla puesta más adentro solo se mezclaría con esa capa vacía (no con el fondo).
  const mezclaDe = (v, esClave) => {
    if (trat === "periodico") return esClave ? undefined : MEZCLA_PERIODICO[v];
    if (trat === "cinta") return "hard-light";
    if (trat === "sello" || trat === "calado") return "screen";
    if (trat === "invertido") return "difference";
    return undefined;
  };
  const nodos = lineas.map((linea, li) => {
    const palabras = linea.split(/\s+/).filter(Boolean);
    const partes = [];
    palabras.forEach((p, pi) => {
      const limpia = p.replace(/[¡!¿?.,;:"“”«»()]/g, "");
      const esClave = !!a.claves && (a.listaClaves?.length ? a.listaClaves.includes(limpia.toLowerCase()) : CLAVES.test(limpia));
      const vars = {
        "--i": iPal, "--li": li, "--pi": pi,
        "--dx": (rnd() * 2 - 1).toFixed(3), "--dy": (rnd() * 2 - 1).toFixed(3), "--r": (rnd() * 2 - 1).toFixed(3),
      };
      if (a.colores) vars.color = a.colores[iPal % a.colores.length];
      if (r) {
        // Receta propia: cada palabra (o letra, o línea) lleva su propia animación, con su turno.
        if (esClave) vars.color = a.colorClave;
        if (r.unidad === "palabra") vars.animation = cssAnimacion({ entrada: r.entrada, permanencia: r.permanencia, velocidad: r.velocidad, retraso: 0.15 * tiempo + iPal * r.separacion });
      }
      const clases = "wfa-p" + (esClave ? " wfa-clave" : "") + (conTrat || trat === "contorno" || trat === "invertido" ? ` wft-${trat}` : "");
      if (a.modo === "letra") {
        const letras = [...p].map((ch, ci) => { const vl = Math.floor(rnd() * 7); return <span key={ci} className="wfa-c" style={{ ...(porLetraTrat ? { mixBlendMode: mezclaDe(vl, esClave) } : {}), "--c": iLet + ci, "--ci": ci, "--fl": rnd().toFixed(3),
          ...(r ? { "--dx": (rnd() * 2 - 1).toFixed(3), "--dy": (rnd() * 2 - 1).toFixed(3), "--r": (rnd() * 2 - 1).toFixed(3), animation: cssAnimacion({ entrada: r.entrada, permanencia: r.permanencia, velocidad: r.velocidad, retraso: 0.15 * tiempo + (iLet + ci) * r.separacion * 0.35 }) } : {}) }}>{porLetraTrat ? envolver(ch, ci, vl) : ch}</span>; });
        iLet += p.length + 1;
        const vp = Math.floor(rnd() * 7);
        if (!porLetraTrat && mezclaDe(vp, esClave)) vars.mixBlendMode = mezclaDe(vp, esClave);
        partes.push(<span key={pi} className={clases} style={vars}>{conTrat && !porLetraTrat ? envolver(letras, "w", vp) : letras}</span>);
      } else {
        const vp = Math.floor(rnd() * 7);
        if (mezclaDe(vp, esClave)) vars.mixBlendMode = mezclaDe(vp, esClave);
        partes.push(<span key={pi} className={clases} style={vars}>{conTrat ? envolver(p, "w", vp) : p}</span>);
      }
      iPal++;
      if (pi < palabras.length - 1) partes.push(" ");
    });
    const estiloLinea = { "--li": li, ...(r && r.unidad === "linea" ? { animation: cssAnimacion({ entrada: r.entrada, permanencia: r.permanencia, velocidad: r.velocidad, retraso: (0.15 + li * 0.25) * tiempo + li * r.separacion * 3 }) } : {}) };
    return <span key={li} className="wfa-linea" style={estiloLinea}>{partes}</span>;
  });
  // Clases del contenedor: acomodo, efectos de la letra completa y latido al compás.
  const clase = r ? [
    r.acomodo && r.acomodo !== "centro" ? `wfl-${r.acomodo}` : "",
    ["temblor", "acercar", "espejo"].includes(r.pantalla) ? `wfs-${r.pantalla}` : "",
    r.compas ? "wfb-latido" : "",
  ].filter(Boolean).join(" ") : "";
  const varsTrat = r ? { "--wft-color": r.colorEfecto, "--wft-trazo": r.color, "--wft-sombra": r.colorClave } : {};
  return { lineas: nodos, clase, vars: { "--n": totalPal, "--nl": lineas.length, "--wfv": +tiempo.toFixed(3), ...(r ? { "--m": "1em" } : {}), ...varsTrat } };
}
// Variantes de papel del periódico (ver .wft-v* en index.css) que se funden con el fondo.
const MEZCLA_PERIODICO = [undefined, "screen", "hard-light", undefined, undefined, "hard-light", "screen"];
const CINTAS = ["rgba(255,225,77,.8)", "rgba(255,95,162,.78)", "rgba(77,225,193,.78)", "rgba(143,124,255,.78)", "rgba(255,138,61,.8)"];

// ---------------- Efectos de pantalla (2026-11-06) ----------------
// Se dibujan encima de la proyección al entrar cada diapositiva (key = la diapositiva, para que se repitan).
// Los que mueven la letra completa (temblor, acercar, espejo) van como clase del contenedor (arriba).
export function EfectoPantalla({ tipo, color = "#E8821E", beat = 0.5 }) {
  if (!tipo || tipo === "ninguno" || ["temblor", "acercar", "espejo"].includes(tipo)) return null;
  const estilo = { "--wfe-color": color, "--beat": `${beat}s` };
  if (tipo === "persianas") return <div aria-hidden className="wfe wfe-persianas" style={estilo}>{Array.from({ length: 9 }, (_, k) => <span key={k} className="wfe-tira" style={{ "--k": k }} />)}</div>;
  if (tipo === "corte") return <div aria-hidden className="wfe wfe-corte" style={estilo}><span className="wfe-linea" /></div>;
  if (tipo === "barrido") return <div aria-hidden className="wfe wfe-barrido" style={estilo}><span className="wfe-luz" /></div>;
  if (tipo === "rgb") return <div aria-hidden className="wfe wfe-rgb" style={estilo}>{["#FF2A6D", "#05D9E8", "#FFE14D", "#FF2A6D", "#05D9E8"].map((c, k) => <span key={k} className="wfe-franja" style={{ "--k": k, top: `${12 + k * 17}%`, background: c }} />)}</div>;
  if (tipo === "led" || tipo === "destellos") return <div aria-hidden className={`wfe wfe-${tipo}`} style={estilo} />;
  return <div aria-hidden className={`wfe wfe-${tipo}`} style={estilo}><span className="wfe-panel wfe-a" /><span className="wfe-panel wfe-b" /></div>;
}

// Clase CSS del contenedor de la letra: los de fábrica traen su propia CSS (.wfa-<clave>); las recetas
// llevan la animación escrita en cada palabra.
export const claseAnimacion = (clave) => (ES_PROPIA(clave) || ANIMACIONES[clave]?.receta ? "wfa wfr" : `wfa wfa-${clave}`);

// ---------------- Precarga de letras ----------------
// Varios estilos usan tipos de letra que la app no usaba antes (Bangers, Bungee, Fredoka...). Si se piden
// recién cuando sale la primera diapositiva, el navegador los descarga en pleno culto y el texto se
// reacomoda: eso se sentía como "lento al principio". Se piden todos apenas se abre la consola o la
// proyección, una sola vez.
let fuentesPrecargadas = false;
export function precargarFuentesAnimacion() {
  if (fuentesPrecargadas || typeof document === "undefined" || !document.fonts?.load) return;
  fuentesPrecargadas = true;
  for (const a of Object.values(ANIMACIONES)) {
    document.fonts.load(`${a.fuente.weight} 48px ${a.fuente.family}`, "Aleluya Señor").catch(() => {});
  }
}

// ---------------- Fondos animados (canvas) ----------------
// `pulso` cambia en cada diapositiva nueva: algunos fondos reaccionan (ondas, confeti, destello).
// quieto: dibuja un solo cuadro y no se mueve (vistas previas de la consola: la que se anima es la
// proyección real; tres fondos animándose a la vez en la misma computadora costaban de más).
// chico: miniatura (menos resolución, ~30 cuadros por segundo).
// ajustes (opcional, recetas propias): { tono (grados), brillo (0.5–1.5), velocidad (0.25–2), densidad (0.5–2) }.
export function FondoAnimado({ tipo, pulso, chico = false, quieto = false, ajustes }) {
  const ref = useRef(null);
  const estado = useRef({ tipo, pulso: 0, ondas: [], parts: null, dibujado: false, vel: 1, dens: 1 });
  const vel = ajustes?.velocidad ?? 1, dens = ajustes?.densidad ?? 1;
  estado.current.vel = vel;
  if (estado.current.dens !== dens) { estado.current.dens = dens; estado.current.parts = null; estado.current.dibujado = false; }

  useEffect(() => {
    const e = estado.current;
    if (e.tipo !== tipo) { e.tipo = tipo; e.parts = null; e.ondas = []; e.dibujado = false; }
  }, [tipo]);
  useEffect(() => {
    const e = estado.current;
    e.pulso = 1;
    e.ondas.push({ t: 0 });
    if (e.ondas.length > 4) e.ondas.shift();
    e.estallido = 1;
  }, [pulso]);

  useEffect(() => {
    precargarFuentesAnimacion();
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, raf = 0, ultimo = 0, vivo = true;
    const tam = () => {
      const r = cv.getBoundingClientRect();
      // Nunca más de ~1920 px de ancho por dentro: en un TV 4K o con zoom de Windows, dibujar al doble
      // no se nota en el proyector y cuesta cuatro veces más.
      const dpr = chico || quieto ? 1 : Math.min(window.devicePixelRatio || 1, 1.5, 1920 / Math.max(1, r.width));
      W = cv.width = Math.max(1, Math.round(r.width * dpr));
      H = cv.height = Math.max(1, Math.round(r.height * dpr));
      estado.current.parts = null;
      estado.current.dibujado = false;
    };
    tam();
    const ro = new ResizeObserver(tam);
    ro.observe(cv);
    const dibujarCuadro = (t) => {
      const e = estado.current;
      const dibujar = FONDOS[e.tipo] || FONDOS.aurora;
      try { dibujar(ctx, W, H, t * (e.vel || 1), e); } catch { /* un cuadro fallido no debe tumbar la proyección */ }
      e.pulso *= 0.95;
      e.estallido = (e.estallido || 0) * 0.9;
      // Arranque suave: el lienzo aparece con un fundido en vez de exigir todo de golpe.
      if (cv.style.opacity !== "1") cv.style.opacity = "1";
    };
    const cuadro = (t) => {
      if (!vivo) return;
      raf = requestAnimationFrame(cuadro);
      const e = estado.current;
      if (quieto) {
        if (e.dibujado) return;
        // Varios cuadros seguidos para que las partículas se repartan y el fondo se vea "en marcha".
        for (let k = 0; k < 40; k++) dibujarCuadro(4000 + k * 16);
        e.dibujado = true;
        return;
      }
      if (chico && t - ultimo < 32) return;
      ultimo = t;
      dibujarCuadro(t);
    };
    raf = requestAnimationFrame(cuadro);
    return () => { vivo = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [chico, quieto]);

  const filtro = ajustes && ((ajustes.tono || 0) !== 0 || (ajustes.brillo ?? 1) !== 1) ? `hue-rotate(${ajustes.tono || 0}deg) brightness(${ajustes.brillo ?? 1})` : undefined;
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, display: "block", opacity: 0, transition: "opacity .7s ease", filter: filtro }} />;
}

// Muestra en vivo de un estilo (al pasar el cursor por su tarjeta, como las miniaturas de YouTube):
// su fondo animado y una frase entrando con su animación, repitiéndose mientras siga el cursor encima.
const FRASE_MUESTRA = ["Santo, santo es el Señor", "digno de toda gloria"];
export function MiniaturaAnimada({ clave, def }) {
  const a = def || ANIMACIONES[clave];
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setVuelta((v) => v + 1), 4200);
    return () => clearInterval(id);
  }, []);
  const { lineas, vars, clase } = armarLineasAnimadas(a, FRASE_MUESTRA, `muestra-${vuelta}`);
  return (
    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 8, background: "#000" }}>
      {a.fondo ? <FondoAnimado tipo={a.fondo} pulso={vuelta} chico ajustes={a.ajustesFondo} /> : <span style={{ position: "absolute", inset: 0, background: a.muestra }} />}
      {a.flash && <span key={`f${vuelta}`} className="wfa-flash" />}
      <span key={vuelta} className={`${claseAnimacion(clave)} ${clase || ""}`} style={{ position: "relative", zIndex: a.mezcla ? "auto" : 1, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: a.fuente.family, fontWeight: a.fuente.weight, textTransform: a.fuente.transform || "none", letterSpacing: a.fuente.tracking || "normal", color: a.color, textShadow: a.sombra, fontSize: 10.5, lineHeight: 1.2, whiteSpace: "nowrap", ...vars }}>
        {lineas.map((l, i) => <div key={i}>{l}</div>)}
      </span>
      {a.receta?.pantalla && <EfectoPantalla key={`e${vuelta}`} tipo={a.receta.pantalla} color={a.receta.colorEfecto} />}
    </span>
  );
}

const R = (a, b) => a + Math.random() * (b - a);
function particulas(e, n0, crear) {
  const n = Math.max(1, Math.round(n0 * (e.dens || 1)));
  if (!e.parts || e.parts.length !== n) e.parts = Array.from({ length: n }, (_, i) => crear(i));
  return e.parts;
}
function radial(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${color},${a})`); g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
}

const FONDOS = {
  aurora(ctx, W, H, t) {
    ctx.fillStyle = "#070B18"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const manchas = [["59,91,169", .30, .35, .55], ["122,63,160", .70, .6, .5], ["30,140,160", .5, .8, .45], ["90,60,200", .2, .75, .4]];
    manchas.forEach(([c, x, y, r], k) => {
      const px = (x + Math.sin(t / (5200 + k * 900) + k) * .12) * W, py = (y + Math.cos(t / (6100 + k * 700) + k * 2) * .1) * H;
      radial(ctx, px, py, r * W, c, .45);
    });
    ctx.restore();
  },
  bokeh(ctx, W, H, t, e) {
    const g = ctx.createRadialGradient(W / 2, H * .45, 0, W / 2, H * .45, W * .7);
    g.addColorStop(0, "#2B1A08"); g.addColorStop(1, "#050302");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      ctx.save(); ctx.translate(W * .5, -H * .1); ctx.rotate(-.35 + k * .35 + Math.sin(t / 3000 + k) * .05);
      const rg = ctx.createLinearGradient(0, 0, 0, H * 1.3);
      rg.addColorStop(0, "rgba(255,210,140,.10)"); rg.addColorStop(1, "rgba(255,210,140,0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-W * .02, 0); ctx.lineTo(W * .02, 0); ctx.lineTo(W * .12, H * 1.3); ctx.lineTo(-W * .12, H * 1.3); ctx.fill(); ctx.restore();
    }
    const ps = particulas(e, 55, () => ({ x: Math.random(), y: Math.random(), r: Math.random(), v: R(.3, 1), f: Math.random() * 6.28 }));
    for (const p of ps) {
      p.y -= 0.0006 * p.v * (e.vel || 1); if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      const x = (p.x + Math.sin(t / 2000 + p.f) * .01) * W, y = p.y * H, r = (2 + p.r * 10) * W / 900;
      radial(ctx, x, y, r * 3, "255,200,120", (.25 + .35 * Math.sin(t / 900 + p.f) ** 2) * (1 - Math.abs(p.y - .5)));
    }
    ctx.restore();
  },
  estrellas(ctx, W, H, t, e) {
    const g = ctx.createRadialGradient(W / 2, H * 1.3, 0, W / 2, H * 1.3, H * 1.4);
    g.addColorStop(0, "#1D3B6E"); g.addColorStop(1, "#04070F");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ps = particulas(e, 160, () => ({ x: Math.random(), y: Math.random(), r: Math.random(), f: Math.random() * 6.28, v: R(.3, 1) }));
    for (const p of ps) {
      const a = .25 + .75 * Math.abs(Math.sin(t / (900 + p.v * 1400) + p.f));
      ctx.fillStyle = `rgba(220,232,255,${a})`;
      const s = (p.r < .9 ? 1 : 2.2) * Math.max(1, W / 1200);
      ctx.fillRect(((p.x + t * 0.000004 * p.v) % 1) * W, p.y * H * .9, s, s);
    }
    // estrella fugaz de vez en cuando
    const ciclo = (t % 7000) / 7000;
    if (ciclo < .12) {
      const k = ciclo / .12, x = W * (.2 + .6 * k), y = H * (.15 + .25 * k);
      const gr = ctx.createLinearGradient(x, y, x - W * .12, y - H * .05);
      gr.addColorStop(0, `rgba(255,255,255,${1 - k})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = gr; ctx.lineWidth = Math.max(1, W / 700); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - W * .12, y - H * .05); ctx.stroke();
    }
  },
  foco(ctx, W, H, t) {
    const a = t / 4000;
    const g = ctx.createLinearGradient(W * (.5 + .5 * Math.cos(a)), 0, W * (.5 - .5 * Math.cos(a)), H);
    g.addColorStop(0, "#1B0B3A"); g.addColorStop(.5, "#0B1E3F"); g.addColorStop(1, "#3A1608");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    radial(ctx, W * (.5 + .3 * Math.sin(t / 2600)), H * (.5 + .2 * Math.cos(t / 3100)), W * .4, "255,255,255", .10);
  },
  rayos(ctx, W, H, t, e) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0A1424"); g.addColorStop(1, "#1A0F06");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 7; k++) {
      const x = ((t * 0.00006 * (k + 2) + k * 0.17) % 1.4 - 0.2) * W;
      const c = k % 2 ? "232,130,30" : "70,140,255";
      const gr = ctx.createLinearGradient(x - W * .08, 0, x + W * .08, 0);
      gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(.5, `rgba(${c},${.10 + e.pulso * .15})`); gr.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - W * .1, 0); ctx.lineTo(x + W * .05, 0); ctx.lineTo(x + W * .2, H); ctx.lineTo(x + W * .05, H); ctx.fill();
    }
    ctx.restore();
  },
  olas(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0E1B3A"); g.addColorStop(1, "#2A1240");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      const base = H * (.55 + k * .1), amp = H * (.05 + k * .012), sp = t * 0.0006 * (1 + k * .3);
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += W / 60) ctx.lineTo(x, base + Math.sin(x / W * 6.28 * (1 + k * .4) + sp + k) * amp);
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = `rgba(${k % 2 ? "232,130,30" : "90,120,255"},${.12 + k * .03})`; ctx.fill();
    }
  },
  ondas(ctx, W, H, t, e) {
    ctx.fillStyle = "#08080A"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .06; ctx.fillStyle = "#fff";
    for (let k = 0; k < 300; k++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    ctx.restore();
    radial(ctx, W / 2, H / 2, W * .5, "232,130,30", .08 + e.pulso * .25);
    e.ondas = e.ondas.filter((o) => o.t < 1);
    for (const o of e.ondas) {
      o.t += 0.02;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, o.t * W * .75, 0, 6.2832);
      ctx.strokeStyle = `rgba(232,130,30,${(1 - o.t) * .8})`; ctx.lineWidth = (1 - o.t) * W / 40; ctx.stroke();
    }
  },
  confeti(ctx, W, H, t, e) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#2B1055"); g.addColorStop(1, "#7A1F5C");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    radial(ctx, W / 2, H * .45, W * .45, "255,210,80", .12 + e.pulso * .2);
    const colores = ["#FFD23F", "#3EC1D3", "#FF4F79", "#7CFF6B", "#FFFFFF", "#FF9F1C"];
    const ps = particulas(e, 120, () => ({ x: Math.random(), y: Math.random() * -1, v: R(.4, 1), r: Math.random() * 6.28, vr: R(-.08, .08), c: colores[Math.floor(Math.random() * colores.length)], s: R(.6, 1.4), f: Math.random() * 6.28 }));
    const u = W / 160;
    for (const p of ps) {
      p.y += 0.0022 * p.v * (e.vel || 1) * (1 + (e.estallido || 0) * 2); p.r += p.vr * (e.vel || 1);
      if (p.y > 1.05) { p.y = R(-.2, -.02); p.x = Math.random(); }
      ctx.save(); ctx.translate((p.x + Math.sin(t / 900 + p.f) * .015) * W, p.y * H); ctx.rotate(p.r);
      ctx.scale(1, Math.abs(Math.cos(t / 300 + p.f)));
      ctx.fillStyle = p.c; ctx.fillRect(-u * p.s, -u * p.s * .45, u * 2 * p.s, u * .9 * p.s);
      ctx.restore();
    }
  },
  synth(ctx, W, H, t) {
    ctx.fillStyle = "#05030C"; ctx.fillRect(0, 0, W, H);
    const hz = H * .62;
    const gl = ctx.createLinearGradient(0, hz, 0, H);
    gl.addColorStop(0, "rgba(255,79,216,0)"); gl.addColorStop(1, "rgba(255,79,216,.4)");
    ctx.strokeStyle = gl; ctx.lineWidth = Math.max(1, W / 900);
    for (let k = -14; k <= 14; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * W * .01, hz); ctx.lineTo(W / 2 + k * W * .12, H); ctx.stroke(); }
    const off = (t * 0.00025) % 1;
    ctx.save();
    for (let k = 0; k < 10; k++) { const p = Math.pow((k + off) / 10, 2.2); const y = hz + p * (H - hz); ctx.globalAlpha = p; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    radial(ctx, W / 2, hz, W * .45, "62,231,255", .18 + .06 * Math.sin(t / 700));
  },
  glitch(ctx, W, H, t, e) {
    ctx.fillStyle = "#08080F"; ctx.fillRect(0, 0, W, H);
    radial(ctx, W * .3, H * .4, W * .5, "120,0,255", .18);
    radial(ctx, W * .75, H * .65, W * .45, "0,200,255", .12);
    // franjas de interferencia: más fuertes al cambiar de diapositiva y cada ~2.5 s
    const golpe = Math.max(e.pulso, (t % 2500) < 160 ? .8 : 0);
    if (golpe > .05) {
      for (let k = 0; k < 6; k++) {
        const y = Math.random() * H, h = R(.005, .04) * H;
        ctx.fillStyle = k % 2 ? `rgba(255,42,109,${golpe * .35})` : `rgba(5,217,232,${golpe * .35})`;
        ctx.fillRect(R(-.1, .3) * W, y, R(.3, 1) * W, h);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,.035)";
    for (let y = (t / 40) % 6; y < H; y += 6 * (H / 540)) ctx.fillRect(0, y, W, Math.max(1, H / 900));
  },
  urbano(ctx, W, H, t, e) {
    ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, W, H);
    // ladrillos suaves
    ctx.strokeStyle = "rgba(255,255,255,.04)"; ctx.lineWidth = Math.max(1, W / 1200);
    const bh = H / 14, bw = bh * 2.6;
    for (let r = 0, y = 0; y < H; r++, y += bh) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); for (let x = (r % 2) * bw / 2; x < W; x += bw) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); } }
    const cols = ["255,63,164", "255,230,0", "62,240,255", "140,255,90"];
    const ps = particulas(e, 6, (i) => ({ x: R(.1, .9), y: R(.15, .85), r: R(.18, .32), c: cols[i % cols.length], f: Math.random() * 6.28 }));
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const p of ps) radial(ctx, (p.x + Math.sin(t / 4000 + p.f) * .05) * W, (p.y + Math.cos(t / 5000 + p.f) * .05) * H, p.r * W * (1 + e.pulso * .15), p.c, .22);
    ctx.restore();
  },
  comic(ctx, W, H, t, e) {
    const cx = W / 2, cy = H / 2, n = 24, rot = t / 9000;
    ctx.fillStyle = "#FF7A00"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFB000";
    for (let k = 0; k < n; k += 2) {
      const a1 = rot + (k / n) * 6.2832, a2 = rot + ((k + 1) / n) * 6.2832;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a1) * W, cy + Math.sin(a1) * W); ctx.lineTo(cx + Math.cos(a2) * W, cy + Math.sin(a2) * W); ctx.fill();
    }
    // puntos de imprenta
    ctx.fillStyle = "rgba(0,0,0,.12)";
    const paso = W / 48;
    for (let y = 0; y < H; y += paso) for (let x = (Math.round(y / paso) % 2) * paso / 2; x < W; x += paso) {
      const d = Math.hypot(x - cx, y - cy) / W;
      ctx.beginPath(); ctx.arc(x, y, paso * .32 * Math.min(1, d * 1.6), 0, 6.2832); ctx.fill();
    }
    radial(ctx, cx, cy, W * .35, "255,255,255", .25 + e.pulso * .35);
  },
  retro(ctx, W, H, t) {
    const hz = H * .64;
    const cielo = ctx.createLinearGradient(0, 0, 0, hz);
    cielo.addColorStop(0, "#1A0630"); cielo.addColorStop(.6, "#6A1B6E"); cielo.addColorStop(1, "#FF6A3D");
    ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, hz);
    // sol con franjas
    const sr = H * .2, sx = W / 2, sy = hz - sr * .05;
    const sol = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    sol.addColorStop(0, "#FFE36E"); sol.addColorStop(1, "#FF3D7F");
    ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.2832); ctx.clip();
    ctx.fillStyle = sol; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    ctx.fillStyle = "#6A1B6E";
    for (let k = 0; k < 7; k++) { const y = sy + sr * (.05 + k * .14) + ((t / 60) % (sr * .14)); ctx.fillRect(sx - sr, y, sr * 2, sr * (.02 + k * .012)); }
    ctx.restore();
    ctx.fillStyle = "#12021F"; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = "rgba(255,80,200,.7)"; ctx.lineWidth = Math.max(1, W / 800);
    for (let k = -16; k <= 16; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * W * .015, hz); ctx.lineTo(W / 2 + k * W * .14, H); ctx.stroke(); }
    const off = (t * 0.0003) % 1;
    for (let k = 0; k < 9; k++) { const p = Math.pow((k + off) / 9, 2); const y = hz + p * (H - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  },
  burbujas(ctx, W, H, t, e) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#3A1C71"); g.addColorStop(1, "#5B2A86");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cols = ["255,95,162", "255,210,63", "77,225,193", "143,124,255", "255,138,61"];
    const ps = particulas(e, 26, (i) => ({ x: Math.random(), y: Math.random() * 1.2, r: R(.02, .09), v: R(.3, 1), c: cols[i % cols.length], f: Math.random() * 6.28 }));
    for (const p of ps) {
      p.y -= 0.0012 * p.v * (e.vel || 1); if (p.y < -0.15) { p.y = 1.15; p.x = Math.random(); }
      const x = (p.x + Math.sin(t / 1500 + p.f) * .02) * W, y = p.y * H, r = p.r * W * (1 + Math.sin(t / 500 + p.f) * .05 + (e.pulso || 0) * .1);
      ctx.fillStyle = `rgba(${p.c},.32)`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.arc(x - r * .35, y - r * .35, r * .22, 0, 6.2832); ctx.fill();
    }
  },
  terminal(ctx, W, H, t, e) {
    ctx.fillStyle = "#03100A"; ctx.fillRect(0, 0, W, H);
    radial(ctx, W / 2, H / 2, W * .6, "40,160,90", .12 + .03 * Math.sin(t / 300));
    ctx.fillStyle = "rgba(80,255,140,.05)";
    for (let y = 0; y < H; y += Math.max(3, H / 180)) ctx.fillRect(0, y, W, Math.max(1, H / 720));
    // columna de caracteres que cae al fondo, tenue
    const ps = particulas(e, 40, () => ({ x: Math.random(), y: Math.random(), v: R(.3, 1) }));
    ctx.fillStyle = "rgba(80,255,140,.18)"; ctx.font = `${Math.round(H / 30)}px monospace`;
    for (const p of ps) { p.y += 0.003 * p.v * (e.vel || 1); if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); } ctx.fillText(String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)), p.x * W, p.y * H); }
  },
  // ---- Fondos nuevos (2026-11-06): estilo concierto, collage y juvenil ----
  // Luces de concierto: haces de colores que barren desde abajo del escenario, entre humo.
  haces(ctx, W, H, t, e) {
    ctx.fillStyle = "#04050A"; ctx.fillRect(0, 0, W, H);
    radial(ctx, W * .5, H * 1.05, W * .7, "60,70,120", .35);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const cols = ["120,170,255", "255,110,220", "255,200,120", "120,255,230"];
    const n = Math.max(3, Math.round(6 * (e.dens || 1)));
    for (let k = 0; k < n; k++) {
      const ox = W * (.1 + .8 * (k / Math.max(1, n - 1)));
      const ang = Math.sin(t / (2600 + k * 370) + k * 1.7) * .55 - Math.PI / 2;
      const len = H * 1.5, ancho = .07 + .02 * Math.sin(t / 900 + k);
      const c = cols[k % cols.length];
      const g = ctx.createLinearGradient(ox, H, ox + Math.cos(ang) * len, H + Math.sin(ang) * len);
      g.addColorStop(0, `rgba(${c},${.32 + e.pulso * .3})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, H);
      ctx.lineTo(ox + Math.cos(ang - ancho) * len, H + Math.sin(ang - ancho) * len);
      ctx.lineTo(ox + Math.cos(ang + ancho) * len, H + Math.sin(ang + ancho) * len); ctx.fill();
      radial(ctx, ox, H, W * .03, c, .6);
    }
    ctx.restore();
    radial(ctx, W * (.5 + .3 * Math.sin(t / 7000)), H * .4, W * .6, "120,130,170", .06);
  },
  // Pantalla LED: cuadrícula de focos que se encienden en ondas de color.
  led(ctx, W, H, t, e) {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const cols = Math.round(48 * Math.max(.6, Math.min(1.5, e.dens || 1))), tam = W / cols, filas = Math.ceil(H / tam);
    for (let y = 0; y < filas; y++) for (let x = 0; x < cols; x++) {
      const v = .5 + .5 * Math.sin(x * .32 + y * .21 + t / 700) * Math.cos(y * .17 - t / 1100);
      const b = Math.max(0, v * v * (.75 + e.pulso * .5));
      if (b < .04) continue;
      const hue = (x * 4 + y * 3 + t / 40) % 360;
      ctx.fillStyle = `hsla(${hue},85%,${35 + b * 30}%,${b * .55})`;
      ctx.fillRect(x * tam + tam * .12, y * tam + tam * .12, tam * .76, tam * .76);
    }
  },
  // Humo de escenario: nubes suaves que se mueven despacio, con un foco detrás.
  humo(ctx, W, H, t, e) {
    ctx.fillStyle = "#07080C"; ctx.fillRect(0, 0, W, H);
    radial(ctx, W * .5, H * .15, W * .55, "150,170,220", .14 + e.pulso * .1);
    const ps = particulas(e, 14, () => ({ x: Math.random(), y: R(.3, 1), r: R(.25, .5), v: R(.3, 1), f: Math.random() * 6.28 }));
    for (const p of ps) {
      const x = ((p.x + t * .000012 * p.v) % 1.4 - .2) * W, y = (p.y + Math.sin(t / 5000 + p.f) * .04) * H;
      radial(ctx, x, y, p.r * W, "110,120,150", .16);
    }
  },
  // Chispas que suben, como pirotecnia fría.
  chispas(ctx, W, H, t, e) {
    const g = ctx.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, "#2A0D02"); g.addColorStop(.5, "#0D0402"); g.addColorStop(1, "#050201");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    radial(ctx, W / 2, H * 1.1, W * .6, "255,110,30", .3 + e.pulso * .25);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const ps = particulas(e, 90, () => ({ x: Math.random(), y: Math.random(), v: R(.4, 1.3), f: Math.random() * 6.28, s: R(.5, 1.6) }));
    for (const p of ps) {
      p.y -= .003 * p.v * (e.vel || 1) * (1 + (e.estallido || 0) * 3);
      if (p.y < -.05) { p.y = 1.05; p.x = R(.2, .8); }
      const x = (p.x + Math.sin(t / 600 + p.f) * .01 * (1 - p.y)) * W, y = p.y * H;
      ctx.fillStyle = `rgba(255,${150 + Math.round(p.f * 15)},60,${Math.min(1, p.y * 1.4)})`;
      ctx.fillRect(x, y, p.s * W / 600, p.s * W / 250);
    }
    ctx.restore();
  },
  // Collage de papel: pedazos de periódico y cartulina sobre una pared oscura, moviéndose apenas.
  papel(ctx, W, H, t, e) {
    ctx.fillStyle = "#1C1C1C"; ctx.fillRect(0, 0, W, H);
    const colores = ["#E9E2D0", "#D8D2C2", "#2E2E2E", "#FFE14D", "#FF4F8B", "#F2EBDD", "#3A3A3A"];
    const ps = particulas(e, 16, (i) => ({ x: Math.random(), y: Math.random(), w: R(.12, .3), h: R(.08, .22), r: R(-.35, .35), c: colores[i % colores.length], f: Math.random() * 6.28 }));
    for (const p of ps) {
      ctx.save();
      ctx.translate((p.x + Math.sin(t / 9000 + p.f) * .01) * W, (p.y + Math.cos(t / 11000 + p.f) * .01) * H);
      ctx.rotate(p.r + Math.sin(t / 8000 + p.f) * .02);
      ctx.globalAlpha = .55; ctx.fillStyle = p.c;
      const w = p.w * W, h = p.h * H;
      ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2);
      for (let k = 1; k <= 6; k++) ctx.lineTo(-w / 2 + (w * k) / 6, -h / 2 + ((k % 2) - .5) * h * .04);
      ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fill();
      // renglones de "texto" del periódico
      ctx.globalAlpha = .18; ctx.fillStyle = "#000";
      for (let y = -h / 2 + h * .15; y < h / 2 - h * .1; y += h * .12) ctx.fillRect(-w / 2 + w * .08, y, w * (.6 + ((y * 7) % 3) * .1), Math.max(1, h * .03));
      ctx.restore();
    }
    // grano y puntos de imprenta
    ctx.fillStyle = "rgba(255,255,255,.04)";
    for (let k = 0; k < 160; k++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  },
  // Túnel de anillos de luz que vienen hacia la cámara.
  tunel(ctx, W, H, t, e) {
    ctx.fillStyle = "#06030F"; ctx.fillRect(0, 0, W, H);
    const cx = W / 2 + Math.sin(t / 3000) * W * .03, cy = H / 2 + Math.cos(t / 3700) * H * .03;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const n = 14;
    for (let k = 0; k < n; k++) {
      const p = ((k / n) + t * .00012 * (e.vel || 1)) % 1;
      const r = Math.pow(p, 2.2) * W * .9;
      ctx.strokeStyle = `hsla(${(260 + k * 12 + t / 50) % 360},90%,62%,${p * .8})`;
      ctx.lineWidth = Math.max(1, p * W / 90);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
    radial(ctx, cx, cy, W * .12, "200,180,255", .25 + e.pulso * .3);
  },
  // Lluvia de luz: líneas finas que caen despacio.
  lluvia(ctx, W, H, t, e) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#081226"); g.addColorStop(1, "#14294B");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    radial(ctx, W * .5, H * .2, W * .5, "150,200,255", .12);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    const ps = particulas(e, 70, () => ({ x: Math.random(), y: Math.random(), v: R(.5, 1.2), l: R(.04, .12) }));
    for (const p of ps) {
      p.y += .004 * p.v * (e.vel || 1); if (p.y > 1.1) { p.y = -.15; p.x = Math.random(); }
      const x = p.x * W, y = p.y * H;
      const gr = ctx.createLinearGradient(x, y, x, y + p.l * H);
      gr.addColorStop(0, "rgba(160,210,255,0)"); gr.addColorStop(1, "rgba(200,230,255,.55)");
      ctx.strokeStyle = gr; ctx.lineWidth = Math.max(1, W / 1100);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + p.l * H); ctx.stroke();
    }
    ctx.restore();
  },
  // Geométrico: triángulos de líneas que giran despacio.
  geometrico(ctx, W, H, t, e) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0E1120"); g.addColorStop(1, "#1C1034");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ps = particulas(e, 9, (i) => ({ x: Math.random(), y: Math.random(), r: R(.06, .22), v: R(-1, 1), c: ["232,130,30", "62,231,255", "255,79,216"][i % 3], f: Math.random() * 6.28 }));
    ctx.lineWidth = Math.max(1, W / 500);
    for (const p of ps) {
      const a = t / 4000 * p.v + p.f, R0 = p.r * W * (1 + e.pulso * .1);
      ctx.strokeStyle = `rgba(${p.c},.55)`;
      ctx.beginPath();
      for (let k = 0; k <= 3; k++) { const an = a + k * 2.0944; const x = p.x * W + Math.cos(an) * R0, y = p.y * H + Math.sin(an) * R0; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  },

};

