// Diapositivas con diseño propio (pedido de Eldin, 2026-10-10): una presentación importada (PDF,
// imágenes) es UN solo elemento del orden del culto con varias diapositivas adentro — igual que una
// canción —, y cada diapositiva se puede diseñar en el editor de escritorio (texto, imágenes, fondo).
//
// Un elemento "slide" del Setlist puede traer `diapositivas: [Diapositiva]` (se guarda en
// items_servicio.estructura como { diapositivas }). Sin eso es una diapositiva de las de siempre
// (título/subtítulo con el estilo en vivo) y se proyecta como antes.
//
// Diapositiva = { id, fondo: { tipo: "color" | "imagen" | "video", color, url, ajuste: "contain" | "cover" }, capas: [Capa] }
// Capa texto  = { id, tipo: "texto", x, y, w, h, texto, fuente, tamano, color, negrita, cursiva, alinear, vertical, caja, radio }
// Capa imagen = { id, tipo: "imagen", x, y, w, h, url, ajuste, radio, opacidad }
// Capa forma  = { id, tipo: "forma", x, y, w, h, forma: "rect" | "circulo", color, borde, grosor, radio, opacidad }
// Capa icono  = { id, tipo: "icono", x, y, w, h, icono (clave de components/iconosDiseno.js), color, grosor, opacidad }
// Fondo "degradado" = { tipo: "degradado", color, color2, angulo } (editor tipo Canva, 2026-10-11)
// x, y, w, h en % del lienzo 16:9; tamano en px sobre un lienzo de 1920 de ancho; radio en px sobre 1920.
// Así se ve igual en una miniatura, en el editor y en el proyector.

export const LIENZO_ANCHO = 1920;
export const LIENZO_ALTO = 1080;

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

// Fuentes del editor: las mismas familias que ya carga la app para el estilo en vivo.
export const FUENTES = [
  { clave: "poppins", nombre: "Poppins", family: "'Poppins', sans-serif" },
  { clave: "montserrat", nombre: "Montserrat", family: "'Montserrat', sans-serif" },
  { clave: "fraunces", nombre: "Fraunces", family: "'Fraunces', serif" },
  { clave: "playfair", nombre: "Playfair Display", family: "'Playfair Display', serif" },
  { clave: "bitter", nombre: "Bitter", family: "'Bitter', serif" },
  { clave: "cinzel", nombre: "Cinzel", family: "'Cinzel', serif" },
  { clave: "raleway", nombre: "Raleway", family: "'Raleway', sans-serif" },
  { clave: "quicksand", nombre: "Quicksand", family: "'Quicksand', sans-serif" },
  { clave: "oswald", nombre: "Oswald", family: "'Oswald', sans-serif" },
  { clave: "barlow", nombre: "Barlow Condensed", family: "'Barlow Condensed', sans-serif" },
  { clave: "bebas", nombre: "Bebas Neue", family: "'Bebas Neue', sans-serif" },
  { clave: "anton", nombre: "Anton", family: "'Anton', sans-serif" },
  { clave: "archivo", nombre: "Archivo Black", family: "'Archivo Black', sans-serif" },
  { clave: "caveat", nombre: "Caveat", family: "'Caveat', cursive" },
  { clave: "dancing", nombre: "Dancing Script", family: "'Dancing Script', cursive" },
  { clave: "pacifico", nombre: "Pacifico", family: "'Pacifico', cursive" },
  { clave: "marker", nombre: "Permanent Marker", family: "'Permanent Marker', cursive" },
  { clave: "georgia", nombre: "Georgia", family: "Georgia, 'Times New Roman', serif" },
  // Caligrafía (fase 2 del editor, 2026-10-11) — como las letras de las diapositivas de Bienvenida.
  { clave: "greatvibes", nombre: "Great Vibes (caligrafía)", family: "'Great Vibes', cursive" },
  { clave: "allura", nombre: "Allura (caligrafía)", family: "'Allura', cursive" },
  { clave: "alexbrush", nombre: "Alex Brush (caligrafía)", family: "'Alex Brush', cursive" },
  { clave: "sacramento", nombre: "Sacramento (firma)", family: "'Sacramento', cursive" },
  { clave: "parisienne", nombre: "Parisienne (caligrafía)", family: "'Parisienne', cursive" },
  { clave: "satisfy", nombre: "Satisfy (pincel)", family: "'Satisfy', cursive" },
];
export const familiaDe = (clave) => (FUENTES.find((f) => f.clave === clave) || FUENTES[0]).family;

export const COLORES = ["#FFFFFF", "#000000", "#16324F", "#E8821E", "#1F8A73", "#2F5FA8", "#B15EA0", "#C23B32", "#F4E6C8", "#5B6472"];

export function nuevaDiapositiva(fondo = {}) {
  return { id: uid(), fondo: { tipo: "color", color: "#16324F", url: "", ajuste: "cover", ...fondo }, capas: [] };
}

export function nuevaCapaTexto(props = {}) {
  return {
    id: uid(), tipo: "texto", x: 10, y: 38, w: 80, h: 24,
    texto: "Escribe aquí", fuente: "poppins", tamano: 96, color: "#FFFFFF", negrita: true, cursiva: false,
    alinear: "center", vertical: "middle", caja: null, radio: 24,
    ...props,
  };
}

// La imagen entra centrada, con su proporción real (anchoPx/altoPx de la imagen), ocupando a lo más
// 40% del ancho o 50% del alto.
export function nuevaCapaImagen(url, anchoPx = 16, altoPx = 9, props = {}) {
  const proporcion = anchoPx && altoPx ? anchoPx / altoPx : 16 / 9;
  let w = 40;
  let h = (w * 16) / 9 / proporcion; // % del alto equivalente
  if (h > 50) { h = 50; w = (h * proporcion * 9) / 16; }
  return { id: uid(), tipo: "imagen", x: (100 - w) / 2, y: (100 - h) / 2, w, h, url, ajuste: "contain", radio: 0, opacidad: 1, ...props };
}

// ---- Formas, íconos y degradados (editor tipo Canva, pedido de Eldin, 2026-10-11) ----
// Formas listas para insertar: todas son un rectángulo o un círculo con distinto tamaño/esquinas.
export const FORMAS = [
  { clave: "rect", nombre: "Rectángulo", crear: () => ({ forma: "rect", w: 40, h: 30, radio: 0 }) },
  { clave: "redondeado", nombre: "Redondeado", crear: () => ({ forma: "rect", w: 40, h: 30, radio: 60 }) },
  { clave: "circulo", nombre: "Círculo", crear: () => ({ forma: "circulo", w: 22.5, h: 40 }) },
  { clave: "linea", nombre: "Línea", crear: () => ({ forma: "rect", w: 50, h: 0.8, radio: 8 }) },
  { clave: "franja", nombre: "Franja", crear: () => ({ forma: "rect", w: 100, h: 22, radio: 0, x: 0 }) },
  { clave: "marco", nombre: "Marco", crear: () => ({ forma: "rect", w: 90, h: 84, radio: 24, color: null, borde: "#FFFFFF", grosor: 8 }) },
];
export function nuevaCapaForma(clave = "rect", props = {}) {
  const f = (FORMAS.find((x) => x.clave === clave) || FORMAS[0]).crear();
  const w = f.w; const h = f.h;
  return { id: uid(), tipo: "forma", x: f.x ?? (100 - w) / 2, y: (100 - h) / 2, w, h, forma: f.forma, color: f.color === null ? null : "#E8821E", borde: f.borde || null, grosor: f.grosor || 6, radio: f.radio || 0, opacidad: 1, ...props };
}
// Un ícono entra cuadrado en pantalla (16:9 → el alto en % es 16/9 del ancho).
export function nuevaCapaIcono(icono = "cruz", props = {}) {
  const w = 12; const h = (w * 16) / 9;
  return { id: uid(), tipo: "icono", x: (100 - w) / 2, y: (100 - h) / 2, w, h, icono, color: "#FFFFFF", grosor: 1.6, opacidad: 1, ...props };
}
export const DEGRADADOS = [
  { clave: "noche", nombre: "Noche", color: "#16324F", color2: "#0B1622", angulo: 160 },
  { clave: "atardecer", nombre: "Atardecer", color: "#E8821E", color2: "#B1345E", angulo: 135 },
  { clave: "real", nombre: "Real", color: "#3B2A7A", color2: "#B15EA0", angulo: 135 },
  { clave: "oceano", nombre: "Océano", color: "#0E7C86", color2: "#16324F", angulo: 160 },
  { clave: "dorado", nombre: "Dorado", color: "#C8963E", color2: "#5A3B12", angulo: 150 },
  { clave: "cielo", nombre: "Cielo", color: "#8EC5FC", color2: "#2F5FA8", angulo: 180 },
  { clave: "bosque", nombre: "Bosque", color: "#1F8A73", color2: "#0D3B2E", angulo: 160 },
  { clave: "fuego", nombre: "Fuego", color: "#F4A62A", color2: "#C23B32", angulo: 135 },
  { clave: "claro", nombre: "Claro", color: "#FFFFFF", color2: "#E3EAF4", angulo: 180 },
  { clave: "carbon", nombre: "Carbón", color: "#2B3240", color2: "#07090D", angulo: 160 },
];
export const degradado = (clave) => { const d = DEGRADADOS.find((x) => x.clave === clave) || DEGRADADOS[0]; return { tipo: "degradado", color: d.color, color2: d.color2, angulo: d.angulo, url: "", ajuste: "cover" }; };
export const cssDegradado = (f) => `linear-gradient(${f.angulo ?? 160}deg, ${f.color || "#16324F"}, ${f.color2 || "#000000"})`;

const copiaProfunda = (v) => JSON.parse(JSON.stringify(v));

// Copia con ids nuevos (para duplicar o pegar sin que dos diapositivas compartan ids).
export function clonarDiapositiva(d) {
  const c = copiaProfunda(d);
  c.id = uid();
  c.capas = (c.capas || []).map((capa) => ({ ...capa, id: uid() }));
  return c;
}
export function clonarCapa(capa, desplazar = 0) {
  return { ...copiaProfunda(capa), id: uid(), x: Math.min(95, capa.x + desplazar), y: Math.min(95, capa.y + desplazar) };
}

export const esGrupoDiapositivas = (item) => !!item && item.type === "slide" && Array.isArray(item.diapositivas) && item.diapositivas.length > 0;

// Las diapositivas de un elemento del Setlist. Si todavía es de las de siempre, se convierte: una página
// importada a la vieja usanza → su imagen de fondo; una diapositiva de texto → fondo + su texto como capa.
export function diapositivasDeItem(item) {
  if (!item) return [];
  if (esGrupoDiapositivas(item)) return item.diapositivas;
  if (item.type !== "slide") return [];
  if (item.bg === "presentacion" && item.imageUrl) {
    return [{ id: uid(), fondo: { tipo: "imagen", url: item.imageUrl, color: "#000000", ajuste: "contain" }, capas: [] }];
  }
  const fondo = item.bgType === "video" && item.videoUrl ? { tipo: "video", url: item.videoUrl, color: "#000000", ajuste: "cover" }
    : item.imageUrl ? { tipo: "imagen", url: item.imageUrl, color: "#000000", ajuste: "cover" }
    : { tipo: "color", color: /^#[0-9a-f]{3,8}$/i.test(item.bg || "") ? item.bg : "#1B2029", url: "", ajuste: "cover" };
  const capas = [];
  if ((item.title || "").trim()) capas.push(nuevaCapaTexto({ texto: item.title, y: item.subtitle ? 28 : 34, h: item.subtitle ? 26 : 32, tamano: 104, fuente: "fraunces" }));
  if ((item.subtitle || "").trim()) capas.push(nuevaCapaTexto({ texto: item.subtitle, y: 56, h: 18, tamano: 56, negrita: false, color: "#E8ECF2" }));
  return [{ id: uid(), fondo, capas }];
}

// Nombre base de un elemento ("Bienvenida (2/5)" → "Bienvenida").
export const tituloBase = (t) => String(t || "").replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();

// Un elemento "slide" con estas diapositivas. Guarda también la primera imagen en imageUrl/bg
// "presentacion" para que una versión vieja de la app (antes de actualizarse) al menos muestre algo.
export function itemConDiapositivas(item, diapositivas) {
  const primera = diapositivas[0];
  const imagen = primera?.fondo?.tipo === "imagen" ? primera.fondo.url : "";
  return {
    ...item, type: "slide", diapositivas,
    subtitle: item.subtitle || "", bgType: "color", videoUrl: "",
    bg: imagen ? "presentacion" : (primera?.fondo?.color || item.bg || "#1B2029"),
    imageUrl: imagen,
    isSermonPoint: undefined,
  };
}

// Diapositivas proyectables de un elemento con diseño, para buildSlides. Si es una sola, conserva el
// id del elemento (así editarla/borrarla en vivo sigue apuntando al elemento).
export function slidesDeGrupo(item) {
  const ds = item.diapositivas || [];
  const n = ds.length;
  return ds.map((d, k) => ({
    // Con el id propio de cada diapositiva (no su posición): si se borra o se mueve otra del grupo,
    // la que está al aire sigue siendo la misma.
    slideId: n === 1 ? item.id : `${item.id}~${d.id}`,
    type: "slide",
    title: n === 1 ? item.title || "" : `${item.title || "Diapositiva"} (${k + 1}/${n})`,
    subtitle: "",
    diseno: d,
    grupoId: item.id, indiceEnGrupo: k, totalGrupo: n,
  }));
}

// ---- Mover / copiar diapositivas entre elementos (sobre el orden del culto completo) ----
// origen: { itemId, indice }. destino: id de otro elemento "slide", "nuevo" (grupo nuevo justo después
// del origen, con nombreNuevo) o "suelta" (diapositiva sola justo después del origen). Devuelve el
// orden nuevo; no modifica el que recibe. Un grupo que se queda sin diapositivas desaparece.
export function moverDiapositiva(orden, { itemId, indice, destino, copiar = false, nombreNuevo, nuevoId = uid }) {
  const iOrigen = orden.findIndex((it) => it.id === itemId);
  if (iOrigen === -1) return orden;
  const origen = orden[iOrigen];
  const dsOrigen = diapositivasDeItem(origen);
  const d = dsOrigen[indice];
  if (!d) return orden;
  const enviada = clonarDiapositiva(d);
  let nuevo = orden.map((it) => it);

  if (!copiar) {
    const quedan = dsOrigen.filter((_, k) => k !== indice);
    nuevo[iOrigen] = quedan.length ? itemConDiapositivas(origen, quedan) : null;
  } else if (!esGrupoDiapositivas(origen)) {
    nuevo[iOrigen] = itemConDiapositivas(origen, dsOrigen); // se convierte para que ambas queden con diseño
  }

  if (destino === "nuevo" || destino === "suelta") {
    const titulo = destino === "nuevo" ? (nombreNuevo || "Nuevo grupo") : (tituloBase(origen.title) || "Diapositiva");
    const item = itemConDiapositivas({ id: nuevoId(), type: "slide", title: titulo, encargados: [] }, [enviada]);
    nuevo.splice(iOrigen + 1, 0, item);
  } else {
    const iDestino = nuevo.findIndex((it) => it && it.id === destino);
    if (iDestino === -1) return orden;
    const dest = nuevo[iDestino];
    nuevo[iDestino] = itemConDiapositivas(dest, [...diapositivasDeItem(dest), enviada]);
  }
  return nuevo.filter(Boolean);
}

// Reordenar dentro del mismo elemento.
export function reordenarEnGrupo(orden, itemId, desde, hacia) {
  return orden.map((it) => {
    if (it.id !== itemId) return it;
    const ds = [...diapositivasDeItem(it)];
    if (desde === hacia || !ds[desde] || hacia < 0 || hacia >= ds.length) return it;
    const [m] = ds.splice(desde, 1);
    ds.splice(hacia, 0, m);
    return itemConDiapositivas(it, ds);
  });
}

export function quitarDiapositiva(orden, itemId, indice) {
  return orden.flatMap((it) => {
    if (it.id !== itemId) return [it];
    const ds = diapositivasDeItem(it).filter((_, k) => k !== indice);
    return ds.length ? [itemConDiapositivas(it, ds)] : [];
  });
}

// ---- Plantillas ----
// Plantillas de iglesia (pedido de Eldin, 2026-10-11): todo es editable después de aplicarla.
const T = nuevaCapaTexto;
const I = nuevaCapaIcono;
const F = nuevaCapaForma;
const conFondo = (fondo, capas) => ({ ...nuevaDiapositiva(fondo), capas });
export const PLANTILLAS = [
  {
    clave: "bienvenida", nombre: "Bienvenida",
    crear: () => conFondo(degradado("noche"), [
      I("brillos", { x: 45, y: 8, w: 10, h: 17.8, color: "#E8821E" }),
      T({ texto: "Bienvenidos", fuente: "dancing", tamano: 190, y: 26, h: 30, negrita: true }),
      T({ texto: "Venid a mí todos los que estáis trabajados y cargados,\ny yo os haré descansar.", tamano: 50, y: 58, h: 16, negrita: false, color: "#F4E6C8" }),
      T({ texto: "Mateo 11:28", tamano: 40, y: 77, h: 8, negrita: true, color: "#E8821E" }),
    ]),
  },
  {
    clave: "anuncio", nombre: "Anuncio",
    crear: () => conFondo({ color: "#0F141C" }, [
      F("rect", { x: 0, y: 0, w: 1.2, h: 100, color: "#E8821E" }),
      I("megafono", { x: 8, y: 12, w: 6, h: 10.7, color: "#E8821E" }),
      T({ texto: "ANUNCIO", tamano: 44, x: 16, y: 13, w: 40, h: 8, alinear: "left", color: "#E8821E" }),
      T({ texto: "Título del anuncio", tamano: 120, x: 8, y: 26, w: 84, h: 22, alinear: "left", fuente: "fraunces" }),
      I("fecha", { x: 8, y: 54, w: 3.5, h: 6.2, color: "#C9D1DC" }),
      T({ texto: "Domingo 10:00 a. m. · Templo principal", tamano: 52, x: 13, y: 53, w: 80, h: 9, alinear: "left", negrita: false, color: "#C9D1DC" }),
      T({ texto: "¡Te esperamos!", tamano: 52, x: 8, y: 72, w: 36, h: 11, color: "#16324F", caja: "#E8821E", radio: 30 }),
    ]),
  },
  {
    clave: "versiculo", nombre: "Versículo",
    crear: () => conFondo(degradado("carbon"), [
      I("cita", { x: 8, y: 12, w: 8, h: 14.2, color: "#E8821E", grosor: 1.2 }),
      T({ texto: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito…", fuente: "fraunces", tamano: 84, x: 10, y: 26, w: 80, h: 38, negrita: false }),
      F("linea", { x: 42, y: 69, w: 16, h: 0.6, color: "#E8821E" }),
      T({ texto: "Juan 3:16", tamano: 48, x: 30, y: 73, w: 40, h: 9, color: "#E8821E" }),
    ]),
  },
  {
    clave: "ofrenda", nombre: "Ofrenda",
    crear: () => conFondo(degradado("dorado"), [
      I("ofrenda", { x: 44, y: 10, w: 12, h: 21.3, color: "#FFF4DD" }),
      T({ texto: "Tiempo de dar", fuente: "dancing", tamano: 170, y: 34, h: 24 }),
      T({ texto: "Cada uno dé como propuso en su corazón:\nno con tristeza, ni por necesidad,\nporque Dios ama al dador alegre.", tamano: 46, y: 60, h: 20, negrita: false, color: "#FFF4DD" }),
      T({ texto: "2 Corintios 9:7", tamano: 36, y: 82, h: 7, color: "#FFFFFF" }),
    ]),
  },
  {
    clave: "cumpleanos", nombre: "Cumpleañeros",
    crear: () => conFondo(degradado("real"), [
      I("pastel", { x: 44, y: 8, w: 12, h: 21.3, color: "#FFFFFF" }),
      I("fiesta", { x: 18, y: 16, w: 8, h: 14.2, color: "#F4A62A" }),
      I("fiesta", { x: 74, y: 16, w: 8, h: 14.2, color: "#F4A62A" }),
      T({ texto: "¡Feliz cumpleaños!", fuente: "pacifico", tamano: 130, y: 32, h: 22, negrita: false }),
      T({ texto: "Nombre · Nombre · Nombre", tamano: 60, y: 58, h: 12 }),
      T({ texto: "Que Dios te bendiga este nuevo año de vida", tamano: 42, y: 74, h: 9, negrita: false, color: "#F4E6C8" }),
    ]),
  },
  {
    clave: "santa-cena", nombre: "Santa Cena",
    crear: () => conFondo(degradado("carbon"), [
      I("trigo", { x: 36, y: 10, w: 11, h: 19.6, color: "#E3C27A" }),
      I("copa", { x: 53, y: 10, w: 11, h: 19.6, color: "#B1345E" }),
      T({ texto: "Santa Cena", fuente: "cinzel", tamano: 140, y: 34, h: 20 }),
      T({ texto: "Haced esto en memoria de mí.", fuente: "fraunces", tamano: 60, y: 58, h: 12, negrita: false, cursiva: true, color: "#F4E6C8" }),
      T({ texto: "Lucas 22:19", tamano: 38, y: 74, h: 8, color: "#E3C27A" }),
    ]),
  },
  {
    clave: "bautizo", nombre: "Bautizo",
    crear: () => conFondo(degradado("cielo"), [
      I("paloma", { x: 45, y: 8, w: 10, h: 17.8, color: "#FFFFFF" }),
      T({ texto: "Bautizos", fuente: "dancing", tamano: 180, y: 28, h: 26 }),
      T({ texto: "El que creyere y fuere bautizado, será salvo.", tamano: 52, y: 58, h: 12, negrita: false }),
      I("agua", { x: 40, y: 74, w: 20, h: 12, color: "#FFFFFF", grosor: 1.2 }),
    ]),
  },
  {
    clave: "ayuno", nombre: "Ayuno y oración",
    crear: () => conFondo(degradado("noche"), [
      F("marco", { borde: "#E8821E", grosor: 6 }),
      I("manos", { x: 45, y: 14, w: 10, h: 17.8, color: "#E8821E" }),
      T({ texto: "Ayuno y oración", fuente: "fraunces", tamano: 120, y: 34, h: 20 }),
      T({ texto: "Viernes · 6:00 a. m. a 12:00 p. m.", tamano: 52, y: 58, h: 10, negrita: false, color: "#C9D1DC" }),
      T({ texto: "¡Te esperamos!", tamano: 44, x: 38, y: 72, w: 24, h: 10, color: "#16324F", caja: "#E8821E", radio: 30 }),
    ]),
  },
  {
    clave: "oracion", nombre: "Oración",
    crear: () => conFondo(degradado("oceano"), [
      I("llama", { x: 45, y: 12, w: 10, h: 17.8, color: "#F4A62A" }),
      T({ texto: "Tiempo de oración", fuente: "fraunces", tamano: 120, y: 34, h: 20 }),
      T({ texto: "Clama a mí, y yo te responderé.", fuente: "fraunces", tamano: 56, y: 58, h: 12, negrita: false, cursiva: true }),
      T({ texto: "Jeremías 33:3", tamano: 38, y: 74, h: 8, color: "#F4E6C8" }),
    ]),
  },
  {
    clave: "despedida", nombre: "Despedida",
    crear: () => conFondo(degradado("atardecer"), [
      T({ texto: "Dios les bendiga", fuente: "dancing", tamano: 180, y: 20, h: 28 }),
      F("linea", { x: 30, y: 52, w: 40, h: 0.6, color: "#FFFFFF" }),
      I("fecha", { x: 31, y: 58, w: 4, h: 7.1, color: "#FFFFFF" }),
      T({ texto: "Nos vemos el domingo a las 10:00", tamano: 56, x: 36, y: 57, w: 50, h: 10, alinear: "left", negrita: false }),
    ]),
  },
  {
    clave: "jovenes", nombre: "Jóvenes",
    crear: () => conFondo(degradado("fuego"), [
      F("franja", { y: 66, h: 34, color: "#16324F" }),
      T({ texto: "CULTO DE JÓVENES", fuente: "bebas", tamano: 190, y: 18, h: 26, negrita: false }),
      T({ texto: "Sábado · 5:00 p. m.", tamano: 56, y: 72, h: 10 }),
      I("musica", { x: 8, y: 72, w: 6, h: 10.7, color: "#F4A62A" }),
      I("microfono", { x: 86, y: 72, w: 6, h: 10.7, color: "#F4A62A" }),
    ]),
  },
  {
    clave: "titulo", nombre: "Título",
    crear: () => conFondo({ color: "#16324F" }, [
      T({ texto: "Título", fuente: "fraunces", tamano: 150, y: 32, h: 24 }),
      T({ texto: "Subtítulo", tamano: 56, y: 58, h: 10, negrita: false, color: "#C9D1DC" }),
    ]),
  },
  { clave: "blanco", nombre: "En blanco", crear: () => nuevaDiapositiva({ color: "#000000" }) },
];

// Posición rápida: 9 puntos (fila: arriba/medio/abajo × columna: izq/centro/der) con margen de 5%.
export function posicionRapida(capa, fila, columna) {
  const margen = 5;
  const x = columna === 0 ? margen : columna === 1 ? (100 - capa.w) / 2 : 100 - capa.w - margen;
  const y = fila === 0 ? margen : fila === 1 ? (100 - capa.h) / 2 : 100 - capa.h - margen;
  return { ...capa, x: redondear(x), y: redondear(y) };
}

export const redondear = (n) => Math.round(n * 100) / 100;

// Ajustar a guías (centro y bordes del lienzo y de otras capas) mientras se arrastra: devuelve la
// posición ajustada y qué guías mostrar. tolerancia en % del lienzo.
export function ajustarAGuias(capa, otras, tolerancia = 1) {
  const guiasX = [0, 50, 100];
  const guiasY = [0, 50, 100];
  otras.forEach((o) => { guiasX.push(o.x, o.x + o.w / 2, o.x + o.w); guiasY.push(o.y, o.y + o.h / 2, o.y + o.h); });
  let { x, y } = capa;
  const visibles = { x: null, y: null };
  const puntosX = [[0, x], [capa.w / 2, x + capa.w / 2], [capa.w, x + capa.w]];
  for (const [desfase, valor] of puntosX) {
    const g = guiasX.find((gx) => Math.abs(gx - valor) <= tolerancia);
    if (g !== undefined) { x = g - desfase; visibles.x = g; break; }
  }
  const puntosY = [[0, y], [capa.h / 2, y + capa.h / 2], [capa.h, y + capa.h]];
  for (const [desfase, valor] of puntosY) {
    const g = guiasY.find((gy) => Math.abs(gy - valor) <= tolerancia);
    if (g !== undefined) { y = g - desfase; visibles.y = g; break; }
  }
  return { capa: { ...capa, x: redondear(x), y: redondear(y) }, guias: visibles };
}
