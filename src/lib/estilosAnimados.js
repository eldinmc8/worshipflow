// Estilos de letra animada hechos con las piezas del motor de recetas (pedido de Eldin, 2026-11-06: "más de
// 100 estilos, con efectos juveniles, de concierto, recortes de periódico, pantalla partida…"). Cada uno es
// una receta (ver lib/animaciones.js): la misma forma que las animaciones que arma cada iglesia, así que
// también sirven de punto de partida en "Crear animación". Diseños propios de WorshipFlow, inspirados en el
// estilo de los conciertos de alabanza (sin copiar imágenes ni diseños de ninguna banda).
//
// Etapa 1: 43 estilos nuevos (con los 15 de antes, 58). Etapa 2 (mismo día): 48 más, con fondos de
// "adoración moderna" (degradados vivos con grano, arcos de luz, vitral, nubes, océano, temporadas): 106.
import { RECETA_VACIA } from "./animaciones.js";

export const GRUPOS_NUEVOS = ["Atmósfera", "Concierto", "Collage", "Pantalla partida", "Temporadas", "Minimalista"];

const F = (tipo, extra = {}) => ({ ...RECETA_VACIA.fondo, tipo, ...extra });
// Letra ancha y espaciada en mayúsculas, como los títulos de los fondos de adoración moderna.
const ANCHA = { fuente: "montserrat", negrita: true, mayusculas: true, espaciado: 0.14, sombra: "suave" };
const e = (clave, nombre, grupo, desc, receta) => ({ clave, nombre, grupo, desc, receta: { ...RECETA_VACIA, ...receta } });

export const ESTILOS_RECETA = [
  // ---------------- Concierto ----------------
  e("estadio", "Estadio", "Concierto", "Golpes de letra con luces de escenario", { fuente: "bebas", negrita: false, mayusculas: true, espaciado: 0.03, entrada: "golpe", unidad: "palabra", separacion: 0.09, claves: true, colorClave: "#FFD23F", pantalla: "destellos", compas: true, sombra: "suave", fondo: F("haces") }),
  e("coromasivo", "Coro de estadio", "Concierto", "Cada línea llega desde la cámara", { fuente: "anton", negrita: false, mayusculas: true, entrada: "zoomatras", unidad: "linea", separacion: 0.12, pantalla: "acercar", compas: true, sombra: "suave", fondo: F("humo") }),
  e("reflector", "Reflector", "Concierto", "Una luz que barre la letra", { fuente: "montserrat", negrita: false, mayusculas: true, espaciado: 0.15, entrada: "barrido", unidad: "palabra", separacion: 0.1, pantalla: "barrido", sombra: "brillo", colorEfecto: "#9CC9FF", fondo: F("haces", { tono: -40 }) }),
  e("pantallaled", "Pantalla LED", "Concierto", "Letra de pantalla gigante, a saltos", { fuente: "rubikmono", negrita: false, mayusculas: true, entrada: "pixelar", unidad: "letra", separacion: 0.03, pantalla: "led", sombra: "brillo", colorEfecto: "#3EE7FF", fondo: F("led") }),
  e("explosion", "La explosión", "Concierto", "Las palabras se arman de golpe", { fuente: "archivo", negrita: false, mayusculas: true, entrada: "explosion", unidad: "palabra", separacion: 0.05, pantalla: "temblor", destello: true, compas: true, sombra: "suave", fondo: F("ondas") }),
  e("fuego", "Fuego", "Concierto", "Sube entre chispas, como pirotecnia", { fuente: "bebas", negrita: false, mayusculas: true, color: "#FFF3E0", entrada: "emerger", unidad: "palabra", separacion: 0.1, permanencia: "chispear", sombra: "brillo", colorEfecto: "#FF7A1A", fondo: F("chispas") }),
  e("manosarriba", "Manos arriba", "Concierto", "Rebota al ritmo de la canción", { fuente: "poppins", entrada: "rebotar", unidad: "palabra", separacion: 0.08, compas: true, claves: true, colorClave: "#FF4FD8", sombra: "suave", fondo: F("haces", { tono: 60 }) }),
  e("tunel", "Túnel de luz", "Concierto", "Palabras que vienen desde el fondo", { fuente: "montserrat", negrita: true, mayusculas: true, espaciado: 0.06, entrada: "zoomatras", unidad: "palabra", separacion: 0.12, sombra: "neon", colorEfecto: "#8F7CFF", fondo: F("tunel") }),
  e("escenario", "Escenario", "Concierto", "Sale del humo, con barras de cine", { fuente: "fraunces", entrada: "desenfoque", unidad: "linea", separacion: 0.2, permanencia: "respirar", pantalla: "barras", sombra: "suave", fondo: F("humo") }),
  e("eco", "Eco", "Concierto", "Sacudida con interferencia de color", { fuente: "anton", negrita: false, mayusculas: true, entrada: "sacudida", unidad: "palabra", separacion: 0.1, pantalla: "rgb", sombra: "solida", fondo: F("rayos") }),
  e("victoria", "Victoria", "Concierto", "Línea por línea, con destellos al compás", { fuente: "bebas", negrita: false, mayusculas: true, espaciado: 0.04, entrada: "golpe", unidad: "linea", separacion: 0.25, pantalla: "destellos", compas: true, claves: true, colorClave: "#E8821E", sombra: "suave", fondo: F("rayos") }),

  // ---------------- Collage ----------------
  e("recortes", "Recortes de periódico", "Collage", "Cada palabra, un pedazo de papel que se funde con el fondo", { fuente: "archivo", negrita: false, tratamiento: "periodico", entrada: "papel", unidad: "palabra", separacion: 0.14, acomodo: "escalonado", sombra: "ninguna", fondo: F("papel") }),
  e("notarescate", "Nota de rescate", "Collage", "Letra por letra, cada una de otro papel", { fuente: "archivo", negrita: false, tratamiento: "periodico", entrada: "estampar", unidad: "letra", separacion: 0.04, sombra: "ninguna", fondo: F("papel") }),
  e("cinta", "Collage con cinta", "Collage", "Tiras de cinta de colores pegadas al fondo", { fuente: "marker", negrita: false, tratamiento: "cinta", entrada: "papel", unidad: "palabra", separacion: 0.12, acomodo: "escalonado", sombra: "ninguna", fondo: F("papel", { tono: 20 }) }),
  e("revista", "Revista", "Collage", "Titulares en cajas de color", { fuente: "abril", negrita: false, tratamiento: "caja", colorEfecto: "#C23B32", entrada: "cortina", unidad: "palabra", separacion: 0.1, sombra: "ninguna", fondo: F("papel") }),
  e("sellos", "Sellos", "Collage", "Estampado como sello de tinta", { fuente: "archivo", negrita: false, color: "#FF5A45", tratamiento: "sello", entrada: "estampar", unidad: "palabra", separacion: 0.16, sombra: "ninguna", fondo: F("papel") }),
  e("fotocopia", "Fotocopia", "Collage", "Letra calada: el fondo se ve adentro", { fuente: "archivo", negrita: false, mayusculas: true, tratamiento: "calado", entrada: "pixelar", unidad: "palabra", separacion: 0.1, sombra: "ninguna", fondo: F("papel", { brillo: 1.3 }) }),
  e("diario", "Diario", "Collage", "Máquina de escribir sobre papel", { fuente: "elite", negrita: false, color: "#F2EBDD", entrada: "escribir", unidad: "letra", separacion: 0.05, sombra: "suave", fondo: F("papel") }),

  // ---------------- Pantalla partida ----------------
  e("puertas", "Puertas", "Pantalla partida", "La pantalla se abre en dos", { fuente: "poppins", entrada: "aparecer", unidad: "linea", separacion: 0.15, pantalla: "puertas", colorEfecto: "#E8821E", sombra: "suave", fondo: F("aurora") }),
  e("cortediagonal", "Corte diagonal", "Pantalla partida", "Se parte en diagonal y entra de golpe", { fuente: "bebas", negrita: false, mayusculas: true, entrada: "latigazo", unidad: "palabra", separacion: 0.08, pantalla: "diagonal", colorEfecto: "#3EE7FF", sombra: "suave", fondo: F("rayos") }),
  e("persianas", "Persianas", "Pantalla partida", "Tiras que se abren una por una", { fuente: "montserrat", negrita: true, mayusculas: true, espaciado: 0.05, entrada: "cortina", unidad: "linea", separacion: 0.2, pantalla: "persianas", colorEfecto: "#FF4FD8", sombra: "suave", fondo: F("geometrico") }),
  e("telon", "Telón", "Pantalla partida", "Se abre de arriba a abajo", { fuente: "fraunces", entrada: "subir", unidad: "palabra", separacion: 0.1, pantalla: "cortina", colorEfecto: "#FFD9A0", sombra: "suave", fondo: F("bokeh") }),
  e("tajo", "Tajo de luz", "Pantalla partida", "Un corte de luz parte la pantalla", { fuente: "anton", negrita: false, mayusculas: true, entrada: "elastico", unidad: "palabra", separacion: 0.08, pantalla: "corte", destello: true, colorEfecto: "#FF7A1A", sombra: "suave", fondo: F("ondas") }),
  e("cine", "Cine", "Pantalla partida", "Barras de película y letra elegante", { fuente: "playfair", negrita: false, entrada: "desenfoque", unidad: "linea", separacion: 0.3, pantalla: "barras", sombra: "suave", fondo: F("humo", { tono: 30 }) }),
  e("espejo", "Espejo", "Pantalla partida", "La letra se refleja abajo", { fuente: "montserrat", negrita: false, mayusculas: true, espaciado: 0.14, entrada: "emerger", unidad: "palabra", separacion: 0.12, pantalla: "espejo", sombra: "brillo", colorEfecto: "#BFD7FF", fondo: F("estrellas") }),

  // ---------------- Juvenil (se suman a los de antes) ----------------
  e("calada", "Letra calada", "Juvenil", "Cajas blancas con la letra recortada", { fuente: "archivo", negrita: false, mayusculas: true, tratamiento: "calado", entrada: "crecer", unidad: "palabra", separacion: 0.1, sombra: "ninguna", fondo: F("aurora", { brillo: 1.3 }) }),
  e("invertido", "Invertido", "Juvenil", "La letra invierte los colores del fondo", { fuente: "anton", negrita: false, mayusculas: true, tratamiento: "invertido", entrada: "latigazo", unidad: "palabra", separacion: 0.08, sombra: "ninguna", fondo: F("geometrico") }),
  e("cromo", "Cromo", "Juvenil", "Letra metálica que se voltea", { fuente: "bungee", negrita: false, tratamiento: "cromo", entrada: "voltear", unidad: "palabra", separacion: 0.1, fondo: F("retro") }),
  e("arcoiris", "Arcoíris", "Juvenil", "Colores vivos letra por letra", { fuente: "fredoka", tratamiento: "degradado", entrada: "rebotar", unidad: "letra", separacion: 0.03, fondo: F("burbujas") }),
  e("contorno", "Contorno", "Juvenil", "Solo el borde de la letra, en 3D", { fuente: "anton", negrita: false, mayusculas: true, tratamiento: "contorno", claves: true, entrada: "girar3d", unidad: "palabra", separacion: 0.1, fondo: F("synth") }),
  e("tresde", "3D", "Juvenil", "Letra con sombra larga que cae", { fuente: "bungee", negrita: false, color: "#FFD23F", colorClave: "#8A3B12", tratamiento: "sombralarga", entrada: "caida", unidad: "palabra", separacion: 0.1, fondo: F("geometrico", { tono: 160 }) }),
  e("resaltado", "Resaltado", "Juvenil", "Como subrayado con marcador", { fuente: "marker", negrita: false, tratamiento: "resaltador", colorEfecto: "#FF4FD8", entrada: "barrido", unidad: "palabra", separacion: 0.12, sombra: "solida", fondo: F("urbano") }),
  e("chicle", "Chicle", "Juvenil", "Letras elásticas que respiran", { fuente: "fredoka", color: "#FFE3F1", entrada: "elastico", unidad: "letra", separacion: 0.035, permanencia: "respirar", sombra: "solida", fondo: F("burbujas", { tono: 60 }) }),
  e("neontubo", "Neón de tubo", "Juvenil", "Letrero de tubo que chispea", { fuente: "monoton", negrita: false, mayusculas: true, entrada: "parpadear", unidad: "letra", separacion: 0.04, permanencia: "chispear", sombra: "neon", colorEfecto: "#FF4FD8", fondo: F("synth") }),
  e("endiagonal", "En diagonal", "Juvenil", "Cajas de color inclinadas", { fuente: "anton", negrita: false, mayusculas: true, tratamiento: "caja", colorEfecto: "#2F5FA8", acomodo: "diagonal", entrada: "latigazo", unidad: "palabra", separacion: 0.08, fondo: F("geometrico") }),

  // ---------------- Celebración (se suman a los de antes) ----------------
  e("gloria", "Gloria", "Celebración", "Estampa con confeti y palabras clave", { fuente: "poppins", entrada: "estampar", unidad: "palabra", separacion: 0.1, claves: true, colorClave: "#FFD23F", compas: true, acomodo: "gigante", sombra: "solida", fondo: F("confeti") }),
  e("cascada", "Cascada", "Celebración", "Letras que caen en escalera", { fuente: "montserrat", negrita: true, entrada: "caida", unidad: "letra", separacion: 0.025, acomodo: "cascada", sombra: "suave", fondo: F("lluvia") }),
  e("chispas", "Chispas", "Celebración", "Se arma letra por letra entre chispas", { fuente: "fredoka", entrada: "explosion", unidad: "letra", separacion: 0.02, sombra: "brillo", colorEfecto: "#FFB45C", fondo: F("chispas") }),

  // ---------------- Adoración (se suman a los de antes) ----------------
  e("respiro", "Respiro", "Adoración", "Sale de la niebla y respira despacio", { fuente: "raleway", negrita: false, entrada: "desenfoque", unidad: "linea", separacion: 0.3, permanencia: "respirar", sombra: "suave", fondo: F("aurora") }),
  e("lluviagracia", "Lluvia de gracia", "Adoración", "Palabras que emergen bajo la lluvia de luz", { fuente: "fraunces", entrada: "emerger", unidad: "palabra", separacion: 0.14, sombra: "brillo", colorEfecto: "#9CC9FF", fondo: F("lluvia") }),
  e("presencia", "Presencia", "Adoración", "Letra grabada que aparece con luz", { fuente: "cinzel", negrita: false, mayusculas: true, espaciado: 0.1, entrada: "barrido", unidad: "linea", separacion: 0.3, sombra: "brillo", colorEfecto: "#FFE9B0", fondo: F("humo", { tono: 20 }) }),

  // ---------------- Minimalista ----------------
  e("limpio", "Limpio", "Minimalista", "Sube suave, sobre tu propio fondo", { fuente: "poppins", negrita: false, entrada: "subir", unidad: "linea", separacion: 0.15, sombra: "suave", fondo: F("propio") }),
  e("fino", "Fino", "Minimalista", "Letra delgada que se enfoca", { fuente: "raleway", negrita: false, mayusculas: true, espaciado: 0.2, entrada: "desenfoque", unidad: "palabra", separacion: 0.12, sombra: "suave", fondo: F("propio") }),

  // ================= Etapa 2 =================
  // ---------------- Atmósfera: degradados vivos con grano, luz y formas suaves (adoración moderna) ----------------
  e("arcosluz", "Arcos de luz", "Atmósfera", "Arcos que laten detrás de la letra", { ...ANCHA, entrada: "emerger", unidad: "palabra", separacion: 0.1, compas: true, fondo: F("arcos") }),
  e("portal", "Portal", "Atmósfera", "Un arco de sol cálido", { fuente: "montserrat", negrita: true, mayusculas: true, espaciado: 0.12, entrada: "subir", unidad: "linea", separacion: 0.2, sombra: "suave", fondo: F("portal") }),
  e("franjas", "Franjas", "Atmósfera", "Franjas de color que se mueven al ritmo", { fuente: "archivo", negrita: false, mayusculas: true, espaciado: 0.04, entrada: "cortina", unidad: "palabra", separacion: 0.08, compas: true, sombra: "solida", fondo: F("franjas") }),
  e("vitral", "Vitral", "Atmósfera", "Luz que pasa por un vitral que gira", { fuente: "cinzel", negrita: false, mayusculas: true, espaciado: 0.08, entrada: "barrido", unidad: "linea", separacion: 0.25, sombra: "brillo", colorEfecto: "#FFD9A0", fondo: F("vitral") }),
  e("cortinaluz", "Cortina de luz", "Atmósfera", "Destellos verticales morados", { ...ANCHA, entrada: "desenfoque", unidad: "palabra", separacion: 0.12, permanencia: "respirar", fondo: F("cortina") }),
  e("amanecer", "Amanecer", "Atmósfera", "Rayos suaves desde el horizonte", { fuente: "fraunces", negrita: false, color: "#3A2A3A", entrada: "subir", unidad: "linea", separacion: 0.25, sombra: "ninguna", fondo: F("horizonte") }),
  e("rayosgiran", "Rayos", "Atmósfera", "Rayos que giran desde el centro", { fuente: "anton", negrita: false, mayusculas: true, entrada: "zoomatras", unidad: "palabra", separacion: 0.1, sombra: "solida", fondo: F("radial") }),
  e("rayodeluz", "Rayo de luz", "Atmósfera", "Un haz de luz con polvo brillante", { fuente: "fraunces", entrada: "barrido", unidad: "palabra", separacion: 0.14, sombra: "brillo", colorEfecto: "#FFE9C0", fondo: F("hazdivino") }),
  e("marea", "Marea", "Atmósfera", "Ondas de color con brillo de interferencia", { ...ANCHA, entrada: "emerger", unidad: "palabra", separacion: 0.1, pantalla: "rgb", fondo: F("marea") }),
  e("palabragigante", "Palabra gigante", "Atmósfera", "Una palabra enorme que brilla detrás (cambia en cada diapositiva)", { ...ANCHA, negrita: true, entrada: "aparecer", unidad: "linea", separacion: 0.2, sombra: "solida", fondo: F("palabra") }),
  e("cielodia", "Cielo de día", "Atmósfera", "Nubes suaves en un cielo azul", { fuente: "poppins", negrita: true, color: "#FFFFFF", entrada: "subir", unidad: "linea", separacion: 0.2, sombra: "suave", fondo: F("nubes") }),
  e("cielotarde", "Cielo al atardecer", "Atmósfera", "Nubes con luz de atardecer", { fuente: "fraunces", entrada: "desenfoque", unidad: "linea", separacion: 0.25, sombra: "suave", fondo: F("nubestarde") }),
  e("cielonoche", "Cielo de noche", "Atmósfera", "Nubes de noche con estrellas", { ...ANCHA, entrada: "desenfoque", unidad: "palabra", separacion: 0.14, sombra: "brillo", colorEfecto: "#9CB8FF", fondo: F("nubesnoche") }),
  e("aura", "Aura", "Atmósfera", "Degradado vivo que se mueve despacio", { ...ANCHA, entrada: "subir", unidad: "palabra", separacion: 0.1, permanencia: "respirar", fondo: F("aura") }),
  e("oceano", "Océano", "Atmósfera", "Atardecer sobre el mar", { fuente: "fraunces", entrada: "emerger", unidad: "linea", separacion: 0.25, sombra: "suave", fondo: F("oceano") }),
  e("oceanonoche", "Océano de noche", "Atmósfera", "La luna sobre el mar", { ...ANCHA, entrada: "desenfoque", unidad: "palabra", separacion: 0.14, sombra: "brillo", colorEfecto: "#C8D6FF", fondo: F("oceanonoche") }),
  e("vidrio", "Vidrio", "Atmósfera", "Pastillas de vidrio flotando", { fuente: "righteous", negrita: false, mayusculas: true, espaciado: 0.06, entrada: "voltear", unidad: "palabra", separacion: 0.1, tratamiento: "cromo", fondo: F("vidrio") }),
  e("ecos", "Ecos", "Atmósfera", "Ondas que salen del centro, al compás", { ...ANCHA, entrada: "elastico", unidad: "palabra", separacion: 0.1, compas: true, fondo: F("ecos") }),

  // ---------------- Temporadas ----------------
  e("lacruz", "La cruz", "Temporadas", "Semana Santa: la cruz con luz", { fuente: "cinzel", negrita: false, mayusculas: true, espaciado: 0.1, entrada: "desenfoque", unidad: "linea", separacion: 0.3, sombra: "suave", fondo: F("cruz") }),
  e("tumbavacia", "Tumba vacía", "Temporadas", "Resurrección: amanece", { fuente: "fraunces", negrita: true, color: "#3A2A3A", entrada: "emerger", unidad: "palabra", separacion: 0.14, sombra: "ninguna", fondo: F("horizonte", { brillo: 1.1 }) }),
  e("belen", "Estrella de Belén", "Temporadas", "Navidad: la estrella que guía", { fuente: "cinzel", negrita: false, mayusculas: true, espaciado: 0.1, entrada: "barrido", unidad: "linea", separacion: 0.3, sombra: "brillo", colorEfecto: "#FFE6A8", fondo: F("estrella") }),
  e("auroranavidad", "Aurora navideña", "Temporadas", "Navidad en rojo y verde", { fuente: "poppins", negrita: true, entrada: "subir", unidad: "palabra", separacion: 0.1, claves: true, colorClave: "#FFD86B", sombra: "suave", fondo: F("auroranavidad") }),
  e("nochedepaz", "Noche de paz", "Temporadas", "Navidad tranquila bajo las estrellas", { fuente: "playfair", negrita: false, entrada: "desenfoque", unidad: "linea", separacion: 0.3, sombra: "brillo", colorEfecto: "#FFE6A8", fondo: F("estrellas", { tono: 20 }) }),
  e("gloriaadios", "Gloria a Dios", "Temporadas", "Navidad de celebración con confeti", { fuente: "poppins", entrada: "estampar", unidad: "palabra", separacion: 0.1, claves: true, colorClave: "#FFD86B", sombra: "solida", fondo: F("confeti", { tono: 200 }) }),

  // ---------------- Concierto (más) ----------------
  e("laser", "Láser", "Concierto", "Luces rápidas con interferencia", { fuente: "bebas", negrita: false, mayusculas: true, entrada: "latigazo", unidad: "palabra", separacion: 0.07, pantalla: "rgb", compas: true, sombra: "suave", fondo: F("haces", { tono: 120, velocidad: 1.6 }) }),
  e("estrobo", "Estrobo", "Concierto", "Pantalla LED con destellos al compás", { fuente: "anton", negrita: false, mayusculas: true, entrada: "golpe", unidad: "palabra", separacion: 0.06, pantalla: "destellos", compas: true, sombra: "solida", fondo: F("led") }),
  e("escenariorojo", "Escenario rojo", "Concierto", "Luces rojas y golpes de letra", { fuente: "archivo", negrita: false, mayusculas: true, entrada: "golpe", unidad: "palabra", separacion: 0.08, claves: true, colorClave: "#FFD23F", sombra: "suave", fondo: F("haces", { tono: 150 }) }),
  e("coroled", "Coro LED", "Concierto", "Cortina de letra sobre pantalla LED", { fuente: "rubikmono", negrita: false, mayusculas: true, entrada: "cortina", unidad: "linea", separacion: 0.2, sombra: "brillo", colorEfecto: "#FF4FD8", fondo: F("led", { tono: 90 }) }),
  e("humoazul", "Humo azul", "Concierto", "Sale del humo azul del escenario", { fuente: "montserrat", negrita: true, mayusculas: true, espaciado: 0.08, entrada: "emerger", unidad: "palabra", separacion: 0.1, sombra: "brillo", colorEfecto: "#7FB0FF", fondo: F("humo", { tono: -30, brillo: 1.2 }) }),
  e("granfinal", "Gran final", "Concierto", "Chispas y palabras que se arman", { fuente: "bebas", negrita: false, mayusculas: true, entrada: "explosion", unidad: "palabra", separacion: 0.05, pantalla: "temblor", destello: true, sombra: "brillo", colorEfecto: "#FF9A3A", fondo: F("chispas", { densidad: 1.6 }) }),

  // ---------------- Collage (más) ----------------
  e("pegatinas", "Pegatinas", "Collage", "Calcomanías de colores pegadas", { fuente: "fredoka", tratamiento: "caja", colorEfecto: "#E64B9B", entrada: "papel", unidad: "palabra", separacion: 0.12, acomodo: "escalonado", sombra: "ninguna", fondo: F("papel", { tono: 280 }) }),
  e("cartel", "Cartel", "Collage", "Sellos sobre franjas de color", { fuente: "archivo", negrita: false, color: "#FFFFFF", tratamiento: "sello", entrada: "estampar", unidad: "palabra", separacion: 0.14, sombra: "ninguna", fondo: F("franjas") }),
  e("recortesvivos", "Recortes vivos", "Collage", "Periódico sobre un degradado vivo", { fuente: "archivo", negrita: false, tratamiento: "periodico", entrada: "papel", unidad: "palabra", separacion: 0.12, sombra: "ninguna", fondo: F("aura") }),
  e("cintaarcos", "Cinta y arcos", "Collage", "Cinta de colores sobre arcos de luz", { fuente: "marker", negrita: false, tratamiento: "cinta", entrada: "papel", unidad: "palabra", separacion: 0.12, sombra: "ninguna", fondo: F("arcos") }),

  // ---------------- Pantalla partida (más) ----------------
  e("puertasvitral", "Puertas al vitral", "Pantalla partida", "Se abre y aparece el vitral", { fuente: "cinzel", negrita: false, mayusculas: true, espaciado: 0.08, entrada: "aparecer", unidad: "linea", separacion: 0.2, pantalla: "puertas", colorEfecto: "#FFD9A0", sombra: "brillo", fondo: F("vitral") }),
  e("diagonalrayos", "Diagonal y rayos", "Pantalla partida", "Corte diagonal sobre rayos que giran", { fuente: "anton", negrita: false, mayusculas: true, entrada: "latigazo", unidad: "palabra", separacion: 0.08, pantalla: "diagonal", colorEfecto: "#B9A8FF", sombra: "solida", fondo: F("radial") }),
  e("persianasfranjas", "Persianas de color", "Pantalla partida", "Persianas sobre franjas", { fuente: "archivo", negrita: false, mayusculas: true, entrada: "cortina", unidad: "linea", separacion: 0.2, pantalla: "persianas", colorEfecto: "#F6C344", sombra: "solida", fondo: F("franjas") }),
  e("telonnubes", "Telón al cielo", "Pantalla partida", "Se abre y aparece el cielo", { fuente: "fraunces", entrada: "subir", unidad: "linea", separacion: 0.25, pantalla: "cortina", colorEfecto: "#FFFFFF", sombra: "suave", fondo: F("nubestarde") }),
  e("tajoluz", "Tajo y rayo", "Pantalla partida", "Un corte de luz y un haz", { fuente: "bebas", negrita: false, mayusculas: true, entrada: "elastico", unidad: "palabra", separacion: 0.08, pantalla: "corte", colorEfecto: "#FFE9C0", sombra: "suave", fondo: F("hazdivino") }),

  // ---------------- Juvenil (más) ----------------
  e("invertidomarea", "Marea invertida", "Juvenil", "Letra que invierte las ondas", { fuente: "anton", negrita: false, mayusculas: true, tratamiento: "invertido", entrada: "latigazo", unidad: "palabra", separacion: 0.08, fondo: F("marea") }),
  e("cromoarcos", "Cromo y arcos", "Juvenil", "Letra metálica sobre arcos de luz", { fuente: "bungee", negrita: false, tratamiento: "cromo", entrada: "caida", unidad: "palabra", separacion: 0.1, compas: true, fondo: F("arcos") }),
  e("contornorayos", "Contorno y rayos", "Juvenil", "Solo el borde, sobre rayos que giran", { fuente: "anton", negrita: false, mayusculas: true, tratamiento: "contorno", claves: true, entrada: "girar3d", unidad: "palabra", separacion: 0.1, fondo: F("radial") }),
  e("neonfranjas", "Neón y franjas", "Juvenil", "Letrero de neón sobre franjas", { fuente: "monoton", negrita: false, mayusculas: true, entrada: "parpadear", unidad: "letra", separacion: 0.04, permanencia: "chispear", sombra: "neon", colorEfecto: "#3EE7FF", fondo: F("franjas", { brillo: 0.7 }) }),
  e("caladaaura", "Calada y aura", "Juvenil", "El aura se ve dentro de la letra", { fuente: "archivo", negrita: false, mayusculas: true, tratamiento: "calado", entrada: "crecer", unidad: "palabra", separacion: 0.1, sombra: "ninguna", fondo: F("aura", { brillo: 1.3 }) }),

  // ---------------- Minimalista (más) ----------------
  e("elegante", "Elegante", "Minimalista", "Serif que sale de la niebla, sobre tu fondo", { fuente: "fraunces", entrada: "desenfoque", unidad: "linea", separacion: 0.25, sombra: "suave", fondo: F("propio") }),
  e("moderno", "Moderno", "Minimalista", "Letra ancha que sube, sobre tu fondo", { ...ANCHA, negrita: false, entrada: "subir", unidad: "palabra", separacion: 0.08, fondo: F("propio") }),
  e("firma", "Firma", "Minimalista", "Como escrita a mano, sobre tu fondo", { fuente: "caveat", negrita: true, entrada: "cortina", unidad: "palabra", separacion: 0.12, sombra: "suave", fondo: F("propio") }),
  e("titular", "Titular", "Minimalista", "Letra de titular que se descubre, sobre tu fondo", { fuente: "abril", negrita: false, entrada: "cortina", unidad: "linea", separacion: 0.2, sombra: "suave", fondo: F("propio") }),
];
