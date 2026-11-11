// Buscar canciones en internet (pedido de Eldin, 2026-11-11): desde la biblioteca se busca una canción
// en LaCuerda.net, se elige una versión y entra a la app con su letra y sus acordes, lista para revisar.
//
// El navegador no puede leer otra página web directamente (el sitio no lo permite), así que la página
// la trae la función "buscar-cancion-web" de Supabase y aquí solo se LEE su HTML. Todo lo que depende
// de cómo está hecha la página de LaCuerda vive en este archivo: si el sitio cambia, se arregla aquí.
//
// Cifra Club y Letras.com bloquean a propósito las lecturas automáticas, así que no se leen: para
// esos sitios la app abre la búsqueda en otra pestaña y la letra se pega a mano (enlacesDeBusqueda).

const ENTIDADES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", iexcl: "¡", iquest: "¿", ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
};
export function decodificarHtml(s) {
  return String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (todo, n) => ENTIDADES[n] ?? todo);
}

// ---- 1) Página de resultados → lista de canciones ----
// Cada resultado trae `lcd='RKR-123'`: una letra por versión (R = acordes, K = teclado, T = tablatura,
// B = bajo…). Solo sirven las de acordes. La dirección de cada canción no viene en el enlace: el
// sitio la arma con dos listas (hds = carpeta del artista, al revés; fns = archivo de la canción).
const listaJs = (html, nombre) => {
  const m = html.match(new RegExp(`var ${nombre}=\\[([^\\]]*)\\]`));
  return m ? [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]) : [];
};
const RE_PARTE_RUTA = /^[a-z0-9_-]+$/;

export function resultadosDeLaCuerda(html) {
  html = String(html || "");
  const hds = listaJs(html, "hds");
  const fns = listaJs(html, "fns");
  const nmax = Number((html.match(/var NMAX=(\d+)/) || [])[1]);
  const out = [];
  let artista = "";
  let carpeta = "";
  const re = /<a href="\/([a-z0-9_-]+)\/">([^<]*)<\/a>|<li id='r(\d+)' lcd='([A-Z]*)-(\d*)'><a[^>]*>([^<]*)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { carpeta = m[1]; artista = decodificarHtml(m[2]).trim(); continue; }
    const n = Number(m[3]);
    const dir = hds[nmax - n] || carpeta;
    const archivo = fns[n];
    if (!dir || !archivo || !RE_PARTE_RUTA.test(dir) || !RE_PARTE_RUTA.test(archivo)) continue;
    const versiones = [...m[5]].map(Number).filter((v) => v >= 1 && m[4][v - 1] === "R");
    if (!versiones.length) continue;
    out.push({ titulo: decodificarHtml(m[6]).trim(), artista, ruta: `${dir}/${archivo}`, versiones });
  }
  return out;
}

// ---- 2) Página de una canción → título, artista y texto con los acordes ENCIMA de la letra ----
// Ese texto es justo lo que ya entiende textoACancion (lib/textoCancion.js): mete cada acorde en su
// sílaba y arma partes y diapositivas.
export function cancionDeLaCuerda(html) {
  html = String(html || "");
  const cuerpo = html.match(/<div id=['"]?t_body['"]?>\s*<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (!cuerpo) return null;
  const sinEtiquetas = (s) => decodificarHtml(String(s || "").replace(/<[^>]*>/g, ""));
  const texto = limpiarTextoDeAcordes(sinEtiquetas(cuerpo[1]));
  if (!texto) return null;
  const titulo = sinEtiquetas((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]).trim();
  const artista = sinEtiquetas((html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1]).trim();
  return { titulo, artista, texto };
}

// Costumbres de quienes suben canciones a esos sitios, pasadas a como las lee la app:
//   "C O R O" → "CORO" · "V1:" → "Estrofa 1" · varios renglones vacíos seguidos → uno solo.
const PARTES_ESPACIADAS = new Set(["coro", "estrofa", "verso", "intro", "puente", "precoro", "final", "estribillo", "interludio"]);
export function limpiarTextoDeAcordes(texto) {
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n").map((l) => {
    let t = l.replace(/\s+$/, "");
    t = t.replace(/^(\s*)((?:[A-Za-zÁÉÍÓÚÑ] ){2,}[A-Za-zÁÉÍÓÚÑ])(?=\s|:|$)/, (todo, sangria, letras) => {
      const palabra = letras.replace(/ /g, "");
      return PARTES_ESPACIADAS.has(palabra.toLowerCase()) ? sangria + palabra : todo;
    });
    const estrofa = t.match(/^\s*[VE]\s?(\d)\s*[:.)]?$/i);
    return estrofa ? `Estrofa ${estrofa[1]}` : t;
  });
  const out = [];
  lineas.forEach((l) => { if (l.trim() || (out.length && out[out.length - 1].trim())) out.push(l); });
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join("\n");
}

// ---- 3) Los sitios que no se pueden leer: se abren en otra pestaña con la búsqueda ya hecha ----
export function enlacesDeBusqueda(consulta) {
  const q = encodeURIComponent(String(consulta || "").trim());
  return [
    { nombre: "Cifra Club", url: `https://www.cifraclub.com/?q=${q}` },
    { nombre: "Letras.com", url: `https://www.letras.com/?q=${q}` },
    { nombre: "Google", url: `https://www.google.com/search?q=${q}%20letra%20y%20acordes` },
  ];
}
