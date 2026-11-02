// Enlace corto de la pantalla de proyección para abrirla en OTRO equipo (TV, tablet, otra computadora):
// https://<app>/p/<slug-de-la-iglesia> — pedido de Eldin, 2026-10-18 ("que las personas de las iglesias
// accedan de forma sencilla"). vercel.json manda /p/* al index.html y main.jsx lo reconoce como pantalla
// pública. El enlace largo de siempre (?screen=publico&igl=<slug>) sigue funcionando igual.
export function enlacePantalla(slug, origen = typeof window !== "undefined" ? window.location.origin : "") {
  return slug ? `${origen}/p/${encodeURIComponent(slug)}` : `${origen}/?screen=publico`;
}

// ¿Esta dirección es la pantalla pública? Devuelve { slug } (slug puede ser null) o null si no lo es.
export function leerPantallaDeUrl(pathname, search) {
  const m = /^\/p\/([^/?#]+)\/?$/.exec(pathname || "");
  if (m) return { slug: decodeURIComponent(m[1]) };
  const params = new URLSearchParams(search || "");
  if (params.get("screen") === "publico") return { slug: params.get("igl") };
  return null;
}

// Pantalla de escenario (stage display, 2026-11-01): https://<app>/e/<slug>, o ?screen=escenario&igl=<slug>.
// Mismo funcionamiento que la de proyección (sin sesión, sigue lo que esté en vivo), otra vista.
export function enlaceEscenario(slug, origen = typeof window !== "undefined" ? window.location.origin : "") {
  return slug ? `${origen}/e/${encodeURIComponent(slug)}` : `${origen}/?screen=escenario`;
}

export function leerEscenarioDeUrl(pathname, search) {
  const m = /^\/e\/([^/?#]+)\/?$/.exec(pathname || "");
  if (m) return { slug: decodeURIComponent(m[1]) };
  const params = new URLSearchParams(search || "");
  if (params.get("screen") === "escenario") return { slug: params.get("igl") };
  return null;
}
