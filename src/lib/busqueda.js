// Búsqueda tolerante "como YouTube" (pedido de Eldin, 2026-10-21): sin importar tildes, signos ni
// mayúsculas, con las palabras en cualquier orden y aguantando faltas de ortografía ("alavare" →
// "Alabaré", "jeova" → "Jehová", "cosecháremos" → "cosecharemos"). La usan los buscadores de canciones y
// la búsqueda por palabras de la Biblia.

// Minúsculas, sin tildes ni signos, espacios simples. "¡Oye Jehová!" → "oye jehova".
export function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const palabrasDe = (texto) => normalizar(texto).split(" ").filter(Boolean);

// Cómo "suena" una palabra en español, para que las faltas típicas no cuenten: h muda, b/v, s/z/c,
// ll/y, k/qu/c, letras dobles. "jeova" y "jehova" → "jeoba"; "alavare" y "alabare" → "alabare".
export function sonido(palabra) {
  return normalizar(palabra)
    .replace(/h/g, "")
    .replace(/v/g, "b")
    .replace(/w/g, "u")
    .replace(/z/g, "s")
    .replace(/c([ei])/g, "s$1")
    .replace(/qu([ei])/g, "k$1")
    .replace(/c/g, "k")
    .replace(/ll/g, "y")
    .replace(/x/g, "ks")
    .replace(/g([ei])/g, "j$1")
    .replace(/(.)\1+/g, "$1");
}

// Distancia de edición (con cambio de dos letras vecinas = 1). Se corta en cuanto pasa de `max`.
export function distancia(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length, m = b.length;
  let prev2 = null, prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    let minFila = i;
    for (let j = 1; j <= m; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + costo);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < minFila) minFila = v;
    }
    if (minFila > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[m];
}

// Cuántos errores se aceptan según el largo de la palabra buscada.
export const tolerancia = (largo) => (largo <= 3 ? 0 : largo <= 6 ? 1 : 2);

// Palabras tan comunes que no ayudan a encontrar nada: si el texto no las tiene, no se descarta.
const VACIAS = new Set(["de", "la", "el", "los", "las", "y", "a", "en", "que", "un", "una", "lo", "al", "del", "se", "mi", "tu", "su", "por", "con", "para", "es", "o", "e", "le", "les", "me", "te", "nos"]);
export const esVacia = (p) => VACIAS.has(p);

// Qué tan bien una palabra buscada (q) coincide con una palabra del texto (w). 0 = no coincide.
// 3 exacta · 2.5 suena igual · 2 empieza igual (se está escribiendo) · 1.5/1 con errores.
export function coincidencia(q, w, { prefijo = true } = {}) {
  if (q === w) return 3;
  const sq = sonido(q), sw = sonido(w);
  if (sq && sq === sw) return 2.5;
  if (prefijo && q.length >= 2 && w.startsWith(q)) return 2;
  const tol = tolerancia(q.length);
  if (tol === 0) return 0;
  const d = Math.min(distancia(q, w, tol), distancia(sq, sw, tol));
  if (d > tol) {
    // Palabra a medio escribir con un error ("alab" ← "alav"): compara contra el comienzo.
    if (prefijo && q.length >= 4 && w.length > q.length && distancia(sq, sonido(w.slice(0, q.length)), 1) <= 1) return 1.2;
    return 0;
  }
  return d === 1 ? 1.5 : 1;
}

// Puntaje de un texto para una búsqueda: null si alguna palabra importante no aparece. Todas las palabras
// en cualquier orden; más puntos si la frase aparece tal cual o si empieza igual.
export function puntuar(busqueda, texto, { prefijo = true } = {}) {
  const q = palabrasDe(busqueda);
  if (!q.length) return null;
  const t = palabrasDe(texto);
  if (!t.length) return null;
  let total = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    // La última palabra puede estar a medio escribir.
    const esUltima = i === q.length - 1;
    let mejor = 0;
    for (const w of t) {
      const c = coincidencia(p, w, { prefijo: prefijo && (esUltima || p.length >= 4) });
      if (c > mejor) mejor = c;
      if (mejor === 3) break;
    }
    if (!mejor) {
      if (esVacia(p) && q.length > 1) continue;
      return null;
    }
    total += mejor;
  }
  const nq = q.join(" "), nt = t.join(" ");
  if (nt === nq) total += 6;
  else if (nt.startsWith(nq)) total += 4;
  else if (nt.includes(nq)) total += 3;
  // Textos cortos (títulos) que casi solo tienen lo buscado van primero.
  total += Math.max(0, 2 - Math.abs(t.length - q.length) * 0.25);
  return total;
}

// Filtra y ordena una lista por la búsqueda. Sin búsqueda, la deja igual.
export function buscar(lista, busqueda, textoDe = (x) => x) {
  if (!normalizar(busqueda)) return lista;
  const conPuntaje = [];
  lista.forEach((item, i) => {
    const p = puntuar(busqueda, textoDe(item));
    if (p !== null) conPuntaje.push({ item, p, i });
  });
  conPuntaje.sort((a, b) => b.p - a.p || a.i - b.i);
  return conPuntaje.map((x) => x.item);
}

// ---------------- Citas bíblicas escritas en el buscador ----------------
// "santiago 4:1", "stgo 4 1", "1 cor 13:4-7", "jn 3.16", "salmo 23" → { libro, capitulo, desde, hasta }.
const ABREVIATURAS = {
  gn: "genesis", gen: "genesis", ex: "exodo", lv: "levitico", nm: "numeros", dt: "deuteronomio",
  jos: "josue", jue: "jueces", rt: "rut", sm: "samuel", re: "reyes", cr: "cronicas", esd: "esdras",
  neh: "nehemias", est: "ester", sal: "salmos", salmo: "salmos", sl: "salmos", pr: "proverbios", prov: "proverbios",
  ec: "eclesiastes", ecl: "eclesiastes", cnt: "cantares", is: "isaias", jer: "jeremias", lm: "lamentaciones",
  ez: "ezequiel", dn: "daniel", os: "oseas", jl: "joel", am: "amos", abd: "abdias", jon: "jonas", mi: "miqueas",
  nah: "nahum", hab: "habacuc", sof: "sofonias", hag: "hageo", zac: "zacarias", mal: "malaquias",
  mt: "mateo", mr: "marcos", mc: "marcos", lc: "lucas", jn: "juan", hch: "hechos", ro: "romanos", rom: "romanos",
  co: "corintios", cor: "corintios", ga: "galatas", gal: "galatas", ef: "efesios", fil: "filipenses", flp: "filipenses",
  col: "colosenses", ts: "tesalonicenses", tes: "tesalonicenses", ti: "timoteo", tim: "timoteo", tit: "tito",
  flm: "filemon", heb: "hebreos", he: "hebreos", stg: "santiago", stgo: "santiago", sant: "santiago", pe: "pedro", ped: "pedro",
  jud: "judas", ap: "apocalipsis", apoc: "apocalipsis",
};

// books: [{ bookid, name }] de la API. Devuelve null si no parece una cita.
export function leerCita(texto, books) {
  const t = normalizar(String(texto).replace(/(\d)\s*[:.,]\s*(\d)/g, "$1 $2").replace(/(\d)\s*-\s*(\d)/g, "$1 a $2"));
  const m = t.match(/^([1-3]\s*)?([a-z]+(?: [a-z]+)*?)\s+(\d{1,3})(?:\s+(\d{1,3}))?(?:\s+a\s+(\d{1,3}))?$/);
  if (!m || !books?.length) return null;
  const num = m[1] ? m[1].trim() : "";
  let nombre = m[2];
  nombre = ABREVIATURAS[nombre] || nombre;
  const candidatos = books.map((b) => ({ b, n: normalizar(b.name) }));
  const elegir = (n) => {
    const conNum = num ? `${num} ${n}` : n;
    return candidatos.find((c) => c.n === conNum)
      || candidatos.find((c) => c.n.startsWith(conNum))
      || candidatos.find((c) => (num ? c.n.startsWith(num + " ") : !/^\d/.test(c.n)) && distancia(sonido(c.n.replace(/^\d /, "")), sonido(n), 2) <= (n.length > 5 ? 2 : 1));
  };
  const hallado = elegir(nombre);
  if (!hallado) return null;
  const capitulo = Number(m[3]);
  const desde = m[4] ? Number(m[4]) : null;
  const hasta = m[5] ? Number(m[5]) : desde;
  if (hallado.b.chapters && capitulo > hallado.b.chapters) return null;
  return { libro: hallado.b, capitulo, desde, hasta: hasta && desde && hasta >= desde ? hasta : desde };
}

// ---------------- Canciones ----------------
// Todo el texto de la letra de una canción (song.letra: { parte: [diapositivas…] } o texto).
function textoLetra(song) {
  const partes = [];
  const recorrer = (x) => {
    if (x == null) return;
    if (typeof x === "string") partes.push(x);
    else if (Array.isArray(x)) x.forEach(recorrer);
    else if (typeof x === "object") Object.values(x).forEach(recorrer);
  };
  recorrer(song?.letra);
  return partes.join(" ");
}

// Busca canciones por título (primero) y, si la búsqueda es de al menos dos palabras o 5 letras,
// también por la letra (después). Sin búsqueda devuelve la lista igual.
export function buscarCanciones(lista, busqueda) {
  const q = normalizar(busqueda);
  if (!q) return lista;
  const porLetra = q.length >= 5 || q.includes(" ");
  const res = [];
  lista.forEach((s, i) => {
    const pt = puntuar(busqueda, `${s.title || ""} ${s.artist || ""}`);
    if (pt !== null) { res.push({ s, p: 100 + pt, i }); return; }
    if (porLetra) {
      const pl = puntuar(busqueda, textoLetra(s), { prefijo: false });
      if (pl !== null) res.push({ s, p: pl, i });
    }
  });
  res.sort((a, b) => b.p - a.p || a.i - b.i);
  return res.map((x) => x.s);
}
