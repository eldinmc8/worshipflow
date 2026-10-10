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
export const PLANTILLAS = [
  {
    clave: "bienvenida", nombre: "Bienvenida",
    crear: () => ({ ...nuevaDiapositiva({ color: "#16324F" }), capas: [
      nuevaCapaTexto({ texto: "Bienvenidos", fuente: "dancing", tamano: 180, y: 22, h: 30, negrita: true }),
      nuevaCapaTexto({ texto: "Venid a mí todos los que estáis trabajados y cargados,\ny yo os haré descansar.", tamano: 52, y: 56, h: 18, negrita: false, color: "#F4E6C8" }),
      nuevaCapaTexto({ texto: "Mateo 11:28", tamano: 40, y: 76, h: 8, negrita: true, color: "#E8821E" }),
    ] }),
  },
  {
    clave: "anuncio", nombre: "Anuncio",
    crear: () => ({ ...nuevaDiapositiva({ color: "#0F141C" }), capas: [
      nuevaCapaTexto({ texto: "ANUNCIO", tamano: 44, x: 8, y: 14, w: 40, h: 8, alinear: "left", color: "#E8821E" }),
      nuevaCapaTexto({ texto: "Título del anuncio", tamano: 120, x: 8, y: 24, w: 84, h: 22, alinear: "left", fuente: "fraunces" }),
      nuevaCapaTexto({ texto: "Domingo 10:00 a. m. · Templo principal", tamano: 56, x: 8, y: 50, w: 84, h: 10, alinear: "left", negrita: false, color: "#C9D1DC" }),
      nuevaCapaTexto({ texto: "¡Te esperamos!", tamano: 52, x: 8, y: 72, w: 40, h: 11, color: "#16324F", caja: "#E8821E", radio: 30 }),
    ] }),
  },
  {
    clave: "versiculo", nombre: "Versículo",
    crear: () => ({ ...nuevaDiapositiva({ color: "#1B2029" }), capas: [
      nuevaCapaTexto({ texto: "Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito…", fuente: "fraunces", tamano: 84, x: 10, y: 24, w: 80, h: 40, negrita: false }),
      nuevaCapaTexto({ texto: "Juan 3:16", tamano: 48, x: 30, y: 70, w: 40, h: 9, color: "#E8821E" }),
    ] }),
  },
  {
    clave: "titulo", nombre: "Título",
    crear: () => ({ ...nuevaDiapositiva({ color: "#16324F" }), capas: [
      nuevaCapaTexto({ texto: "Título", fuente: "fraunces", tamano: 150, y: 32, h: 24 }),
      nuevaCapaTexto({ texto: "Subtítulo", tamano: 56, y: 58, h: 10, negrita: false, color: "#C9D1DC" }),
    ] }),
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
