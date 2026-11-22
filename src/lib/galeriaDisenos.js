// Galería de diseños listos para diapositivas (pedido de Eldin, 2026-11-22, idea tomada de un video de
// RW Presenter): ofrendas, jóvenes, notas del sermón y anuncios. Aparece como sección "Diseños listos" al
// crear una diapositiva de texto (setlist y "Texto rápido" de la consola) y en las plantillas del editor.
// Tocar uno abre el editor de diapositivas (solo computadora) con el diseño ya puesto: se cambia el texto
// y se toca Listo. Son diapositivas con diseño normales (ver lib/diapositivas.js): la proyección ya las
// sabe dibujar, no hay nada nuevo en la base de datos.
//
// Planes: los que tienen `gratis: true` los usa cualquier iglesia; los demás piden el plan Ministerio o
// mayor (FUNCIONES_PLAN.galeria_disenos en lib/planes.js).
import { nuevaDiapositiva, nuevaCapaTexto as T, nuevaCapaIcono as I, nuevaCapaForma as F, degradado } from "./diapositivas.js";

const conFondo = (fondo, capas) => ({ ...nuevaDiapositiva(fondo), capas });
const grad = (color, color2, angulo = 150) => ({ tipo: "degradado", color, color2, angulo, url: "", ajuste: "cover" });

export const CATEGORIAS_DISENOS = [
  { clave: "ofrendas", nombre: "Ofrendas" },
  { clave: "jovenes", nombre: "Jóvenes" },
  { clave: "sermon", nombre: "Notas del sermón" },
  { clave: "anuncios", nombre: "Anuncios" },
];

export const GALERIA_DISENOS = [
  // ---- Ofrendas ----
  {
    clave: "diezmos", categoria: "ofrendas", nombre: "Diezmos y ofrendas", gratis: true,
    crear: () => conFondo(degradado("dorado"), [
      I("ofrenda", { x: 45, y: 12, w: 10, h: 17.8, color: "#FFF4DD" }),
      T({ texto: "Diezmos y ofrendas", fuente: "fraunces", tamano: 140, y: 34, h: 22 }),
      F("linea", { x: 42, y: 60, w: 16, h: 0.6, color: "#FFF4DD" }),
      T({ texto: "Traed todos los diezmos al alfolí. — Malaquías 3:10", tamano: 46, y: 65, h: 10, negrita: false, color: "#FFF4DD" }),
    ]),
  },
  {
    clave: "dar-alegria", categoria: "ofrendas", nombre: "Dar con alegría",
    crear: () => conFondo(grad("#1F8A73", "#0D3B2E", 160), [
      I("mano-corazon", { x: 8, y: 14, w: 8, h: 14.2, color: "#F4E6C8" }),
      T({ texto: "Dios ama al dador alegre", fuente: "playfair", cursiva: true, tamano: 120, x: 8, y: 32, w: 84, h: 24, alinear: "left" }),
      F("rect", { x: 8, y: 60, w: 0.6, h: 18, color: "#F4E6C8" }),
      T({ texto: "Cada uno dé como propuso en su corazón:\nno con tristeza, ni por necesidad.", tamano: 46, x: 11, y: 60, w: 80, h: 12, alinear: "left", negrita: false, color: "#F4E6C8" }),
      T({ texto: "2 Corintios 9:7", tamano: 36, x: 11, y: 72, w: 40, h: 7, alinear: "left", color: "#FFFFFF" }),
    ]),
  },
  {
    clave: "ofrenda-misionera", categoria: "ofrendas", nombre: "Ofrenda misionera",
    crear: () => conFondo(grad("#0E7C86", "#16324F", 160), [
      I("mundo", { x: 44, y: 10, w: 12, h: 21.3, color: "#FFFFFF", grosor: 1.2 }),
      T({ texto: "OFRENDA MISIONERA", fuente: "bebas", tamano: 170, y: 34, h: 22, negrita: false }),
      T({ texto: "Id por todo el mundo y predicad el evangelio", tamano: 52, y: 58, h: 10, negrita: false, color: "#D9F2F0" }),
      T({ texto: "Marcos 16:15", tamano: 38, x: 38, y: 72, w: 24, h: 9, color: "#16324F", caja: "#FFFFFF", radio: 30 }),
    ]),
  },
  {
    clave: "transferencia", categoria: "ofrendas", nombre: "Datos para transferir",
    crear: () => conFondo({ color: "#0F141C" }, [
      F("rect", { x: 0, y: 0, w: 100, h: 1.2, color: "#E8821E" }),
      T({ texto: "Ofrenda en línea", fuente: "fraunces", tamano: 110, x: 8, y: 10, w: 84, h: 18, alinear: "left" }),
      F("rect", { x: 8, y: 34, w: 84, h: 46, radio: 30, color: "#1B2330" }),
      T({ texto: "Banco: Nombre del banco\nCuenta: 000-000000-0\nA nombre de: Nombre de la iglesia", tamano: 56, x: 12, y: 38, w: 56, h: 38, alinear: "left", negrita: false, color: "#E8ECF2" }),
      I("qr", { x: 72, y: 40, w: 18, h: 32, color: "#FFFFFF", grosor: 1.2 }),
    ]),
  },
  // ---- Jóvenes ----
  {
    clave: "noche-jovenes", categoria: "jovenes", nombre: "Noche de jóvenes", gratis: true,
    crear: () => conFondo(grad("#3B2A7A", "#0B0F17", 145), [
      T({ texto: "NOCHE DE", fuente: "bebas", tamano: 110, y: 16, h: 14, negrita: false, color: "#B15EA0" }),
      T({ texto: "JÓVENES", fuente: "bebas", tamano: 280, y: 28, h: 32, negrita: false }),
      T({ texto: "Sábado · 6:00 p. m.", tamano: 52, x: 34, y: 68, w: 32, h: 10, color: "#0B0F17", caja: "#F4A62A", radio: 40 }),
      I("musica", { x: 10, y: 70, w: 5, h: 8.9, color: "#B15EA0" }),
      I("microfono", { x: 85, y: 70, w: 5, h: 8.9, color: "#B15EA0" }),
    ]),
  },
  {
    clave: "bienvenidos-jovenes", categoria: "jovenes", nombre: "Bienvenidos",
    crear: () => conFondo(degradado("fuego"), [
      T({ texto: "¡Bienvenidos!", fuente: "bangers", tamano: 220, y: 24, h: 30, negrita: false }),
      T({ texto: "Qué bueno que estás aquí", fuente: "righteous", tamano: 64, y: 58, h: 11, negrita: false }),
      I("brillos", { x: 12, y: 18, w: 7, h: 12.4, color: "#FFFFFF" }),
      I("brillos", { x: 81, y: 62, w: 7, h: 12.4, color: "#FFFFFF" }),
    ]),
  },
  {
    clave: "conferencia", categoria: "jovenes", nombre: "Conferencia",
    crear: () => conFondo({ color: "#0B0F17" }, [
      F("franja", { y: 0, h: 100, w: 38, x: 62, color: "#E8821E" }),
      T({ texto: "CONFERENCIA\nJUVENIL", fuente: "anton", tamano: 150, x: 6, y: 18, w: 54, h: 40, alinear: "left", negrita: false }),
      T({ texto: "Nombre del tema", fuente: "playfair", cursiva: true, tamano: 64, x: 6, y: 60, w: 54, h: 10, alinear: "left", color: "#E8821E" }),
      I("fecha", { x: 70, y: 30, w: 5, h: 8.9, color: "#0B0F17" }),
      T({ texto: "12–14\nDICIEMBRE", fuente: "bebas", tamano: 110, x: 66, y: 42, w: 30, h: 28, negrita: false, color: "#0B0F17" }),
    ]),
  },
  {
    clave: "retiro", categoria: "jovenes", nombre: "Retiro",
    crear: () => conFondo(grad("#1F8A73", "#16324F", 170), [
      I("montana", { x: 42, y: 10, w: 16, h: 28.4, color: "#FFFFFF", grosor: 1.2 }),
      T({ texto: "Retiro de jóvenes", fuente: "fraunces", tamano: 130, y: 40, h: 20 }),
      T({ texto: "Fechas · Lugar · Costo", tamano: 52, y: 62, h: 10, negrita: false, color: "#D9F2F0" }),
      T({ texto: "¡Inscríbete!", tamano: 44, x: 40, y: 76, w: 20, h: 9, color: "#16324F", caja: "#FFFFFF", radio: 30 }),
    ]),
  },
  // ---- Notas del sermón ----
  {
    clave: "titulo-mensaje", categoria: "sermon", nombre: "Título del mensaje", gratis: true,
    crear: () => conFondo(degradado("carbon"), [
      T({ texto: "SERIE · NOMBRE DE LA SERIE", tamano: 40, y: 26, h: 7, color: "#E8821E" }),
      T({ texto: "Título del mensaje", fuente: "fraunces", tamano: 150, y: 34, h: 24 }),
      F("linea", { x: 44, y: 62, w: 12, h: 0.6, color: "#E8821E" }),
      T({ texto: "Pastor Nombre Apellido", tamano: 46, y: 66, h: 8, negrita: false, color: "#C9D1DC" }),
    ]),
  },
  {
    clave: "punto-sermon", categoria: "sermon", nombre: "Punto del mensaje", gratis: true,
    crear: () => conFondo(degradado("noche"), [
      T({ texto: "1", fuente: "abril", tamano: 360, x: 6, y: 18, w: 20, h: 60, color: "#E8821E", negrita: false }),
      T({ texto: "Primer punto del mensaje", fuente: "fraunces", tamano: 110, x: 28, y: 26, w: 66, h: 26, alinear: "left" }),
      T({ texto: "Una idea corta que explica el punto.", tamano: 52, x: 28, y: 54, w: 66, h: 12, alinear: "left", negrita: false, color: "#C9D1DC" }),
    ]),
  },
  {
    clave: "versiculo-clave", categoria: "sermon", nombre: "Versículo clave",
    crear: () => conFondo({ color: "#F4E6C8" }, [
      I("cita", { x: 8, y: 12, w: 7, h: 12.4, color: "#B15EA0", grosor: 1.2 }),
      T({ texto: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino.", fuente: "playfair", cursiva: true, tamano: 96, x: 10, y: 26, w: 80, h: 36, negrita: false, color: "#16324F" }),
      T({ texto: "Salmos 119:105", tamano: 46, x: 30, y: 68, w: 40, h: 9, color: "#B15EA0" }),
    ]),
  },
  {
    clave: "para-pensar", categoria: "sermon", nombre: "Para pensar",
    crear: () => conFondo(grad("#2F5FA8", "#16324F", 160), [
      I("idea", { x: 8, y: 14, w: 7, h: 12.4, color: "#F4A62A" }),
      T({ texto: "PARA PENSAR", fuente: "bebas", tamano: 80, x: 17, y: 15, w: 50, h: 11, alinear: "left", negrita: false, color: "#F4A62A" }),
      T({ texto: "¿Qué cambio concreto voy a hacer esta semana?", fuente: "fraunces", tamano: 104, x: 8, y: 34, w: 84, h: 34, alinear: "left" }),
    ]),
  },
  // ---- Anuncios ----
  {
    clave: "anuncio-general", categoria: "anuncios", nombre: "Anuncio general", gratis: true,
    crear: () => conFondo({ color: "#16324F" }, [
      I("megafono", { x: 45, y: 12, w: 10, h: 17.8, color: "#E8821E" }),
      T({ texto: "Título del anuncio", fuente: "fraunces", tamano: 130, y: 34, h: 20 }),
      T({ texto: "Escribe aquí los detalles del anuncio", tamano: 52, y: 56, h: 10, negrita: false, color: "#C9D1DC" }),
      T({ texto: "¡Te esperamos!", tamano: 44, x: 38, y: 72, w: 24, h: 10, color: "#16324F", caja: "#E8821E", radio: 30 }),
    ]),
  },
  {
    clave: "bienvenida-visitas", categoria: "anuncios", nombre: "Bienvenida a visitas", gratis: true,
    crear: () => conFondo(degradado("atardecer"), [
      T({ texto: "¡Bienvenido a casa!", fuente: "dancing", tamano: 170, y: 22, h: 28 }),
      T({ texto: "Si nos visitas por primera vez,\nnos encantaría conocerte.", tamano: 54, y: 54, h: 16, negrita: false }),
      I("comunion", { x: 46, y: 74, w: 8, h: 14.2, color: "#FFFFFF" }),
    ]),
  },
  {
    clave: "evento-fecha", categoria: "anuncios", nombre: "Evento con fecha",
    crear: () => conFondo(grad("#B1345E", "#3B2A7A", 135), [
      F("rect", { x: 8, y: 22, w: 24, h: 56, radio: 40, color: "#FFFFFF" }),
      T({ texto: "DIC", fuente: "bebas", tamano: 90, x: 8, y: 26, w: 24, h: 12, negrita: false, color: "#B1345E" }),
      T({ texto: "24", fuente: "anton", tamano: 230, x: 8, y: 38, w: 24, h: 30, negrita: false, color: "#16324F" }),
      T({ texto: "Nombre del evento", fuente: "fraunces", tamano: 110, x: 38, y: 26, w: 56, h: 22, alinear: "left" }),
      T({ texto: "7:00 p. m. · Templo principal", tamano: 50, x: 38, y: 52, w: 56, h: 10, alinear: "left", negrita: false, color: "#F4E6C8" }),
      T({ texto: "Trae a tu familia", tamano: 42, x: 38, y: 66, w: 26, h: 9, color: "#3B2A7A", caja: "#FFFFFF", radio: 30 }),
    ]),
  },
  {
    clave: "oremos", categoria: "anuncios", nombre: "Oremos",
    crear: () => conFondo(degradado("oceano"), [
      F("marco", { borde: "#FFFFFF", grosor: 4, opacidad: 0.6 }),
      I("manos", { x: 45, y: 16, w: 10, h: 17.8, color: "#FFFFFF" }),
      T({ texto: "Oremos", fuente: "greatvibes", tamano: 220, y: 36, h: 26, negrita: false }),
      T({ texto: "Por nombre · por nombre · por nombre", tamano: 48, y: 66, h: 9, negrita: false, color: "#D9F2F0" }),
    ]),
  },
];

// ¿Esta iglesia puede usar el diseño? tieneGaleria = tiene(plan, "galeria_disenos").
export const disenoDisponible = (d, tieneGaleria) => !!d?.gratis || !!tieneGaleria;
export const disenosDe = (categoria) => GALERIA_DISENOS.filter((d) => !categoria || d.categoria === categoria);
