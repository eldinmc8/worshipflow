// Enlace corto de la pantalla de proyección para abrirla en OTRO equipo (TV, tablet, otra computadora):
// https://<app>/p/<slug-de-la-iglesia> — pedido de Eldin, 2026-10-18 ("que las personas de las iglesias
// accedan de forma sencilla"). vercel.json manda /p/* al index.html y main.jsx lo reconoce como pantalla
// pública. El enlace largo de siempre (?screen=publico&igl=<slug>) sigue funcionando igual.
//
// Enlace que vence (2026-11-02): ahora lleva además el código secreto de la iglesia, que cambia solo al
// finalizar cada transmisión — /p/<slug>/<código> (o &k=<código> en el enlace largo). Ver migración
// 20261104000000_enlace_pantalla_que_vence.sql.
function armar(prefijo, pantallaLarga, slug, origen, codigo) {
  if (!slug) return `${origen}/?screen=${pantallaLarga}${codigo ? `&k=${encodeURIComponent(codigo)}` : ""}`;
  return `${origen}/${prefijo}/${encodeURIComponent(slug)}${codigo ? `/${encodeURIComponent(codigo)}` : ""}`;
}

function leer(prefijo, pantallaLarga, pathname, search) {
  const params = new URLSearchParams(search || "");
  const m = new RegExp(`^/${prefijo}/([^/?#]+)(?:/([^/?#]+))?/?$`).exec(pathname || "");
  if (m) return { slug: decodeURIComponent(m[1]), codigo: m[2] ? decodeURIComponent(m[2]) : params.get("k") || undefined };
  if (params.get("screen") === pantallaLarga) return { slug: params.get("igl"), codigo: params.get("k") || undefined };
  return null;
}

export function enlacePantalla(slug, origen = typeof window !== "undefined" ? window.location.origin : "", codigo = null) {
  return armar("p", "publico", slug, origen, codigo);
}

// ¿Esta dirección es la pantalla pública? Devuelve { slug, codigo } (pueden venir vacíos) o null si no lo es.
export function leerPantallaDeUrl(pathname, search) {
  return leer("p", "publico", pathname, search);
}

// Pantalla de escenario (stage display, 2026-11-01): https://<app>/e/<slug>/<código>, o ?screen=escenario&igl=<slug>&k=<código>.
// Mismo funcionamiento que la de proyección (sin sesión, sigue lo que esté en vivo), otra vista.
export function enlaceEscenario(slug, origen = typeof window !== "undefined" ? window.location.origin : "", codigo = null) {
  return armar("e", "escenario", slug, origen, codigo);
}

export function leerEscenarioDeUrl(pathname, search) {
  return leer("e", "escenario", pathname, search);
}
