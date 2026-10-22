// Búsqueda por palabras en la Biblia (pedido de Eldin, 2026-10-21: "el buscador falla mucho"):
// - Todas las palabras en cualquier orden, con otras palabras de por medio: "de donde vienen los
//   pleitos" encuentra Santiago 4:1 ("¿De dónde vienen las guerras y los pleitos…?").
// - Sin importar tildes, signos ni faltas de ortografía. Con errores de ortografía funciona sobre la
//   Biblia guardada en el equipo (índice de palabras en memoria); por internet solo encuentra palabras
//   bien escritas, porque la API no entiende errores.
import { normalizar, palabrasDe, sonido, coincidencia, esVacia } from "./busqueda.js";
import { stripBibleSearchMarkup } from "./textoBiblia.js";

// ---------------- Índice local (Biblia descargada) ----------------
// capitulos: [{ bookId, chapter, verses: [{ verse, text }] }] tal como los guarda bibleOfflineStore.
export function crearIndice(capitulos) {
  const versiculos = [];
  const porPalabra = new Map(); // palabra → [índices de versículo]
  const orden = [...capitulos].sort((a, b) => a.bookId - b.bookId || a.chapter - b.chapter);
  for (const cap of orden) {
    for (const v of cap.verses || []) {
      const texto = stripBibleSearchMarkup(v.text);
      const idx = versiculos.length;
      const norm = normalizar(texto);
      versiculos.push({ book: cap.bookId, chapter: cap.chapter, verse: v.verse, text: texto, norm });
      for (const p of new Set(norm.split(" "))) {
        if (!p) continue;
        let lista = porPalabra.get(p);
        if (!lista) { lista = []; porPalabra.set(p, lista); }
        lista.push(idx);
      }
    }
  }
  const vocabulario = [...porPalabra.keys()].map((p) => ({ p, s: sonido(p) }));
  return { versiculos, porPalabra, vocabulario };
}

// Palabras del vocabulario que coinciden con una palabra buscada, con su calidad.
function palabrasParecidas(indice, q, prefijo) {
  const res = [];
  for (const { p } of indice.vocabulario) {
    const c = coincidencia(q, p, { prefijo });
    if (c) res.push([p, c]);
  }
  return res;
}

export function buscarEnIndice(indice, busqueda, max = 60) {
  const todas = palabrasDe(busqueda);
  if (!todas.length) return [];
  const utiles = todas.filter((p) => !esVacia(p));
  const q = utiles.length ? utiles : todas;
  let candidatos = null; // Map índice → puntaje
  for (let i = 0; i < q.length; i++) {
    const esUltima = i === q.length - 1 && todas[todas.length - 1] === q[i];
    const parecidas = palabrasParecidas(indice, q[i], esUltima || q[i].length >= 5);
    const aqui = new Map();
    for (const [p, c] of parecidas) {
      for (const idx of indice.porPalabra.get(p)) {
        if (candidatos && !candidatos.has(idx)) continue;
        if ((aqui.get(idx) || 0) < c) aqui.set(idx, c);
      }
    }
    candidatos = new Map([...aqui].map(([idx, c]) => [idx, (candidatos?.get(idx) || 0) + c]));
    if (!candidatos.size) return [];
  }
  const frase = todas.join(" ");
  const lista = [...candidatos].map(([idx, p]) => {
    const v = indice.versiculos[idx];
    return { v, p: p + (v.norm.includes(frase) ? 5 : 0) };
  });
  lista.sort((a, b) => b.p - a.p || a.v.book - b.v.book || a.v.chapter - b.v.chapter || a.v.verse - b.v.verse);
  return lista.slice(0, max).map(({ v }) => ({ pk: `${v.book}-${v.chapter}-${v.verse}`, book: v.book, chapter: v.chapter, verse: v.verse, text: v.text }));
}

// ---------------- Filtro de lo que devuelve la API ----------------
// La API (modo por palabra) devuelve versículos con alguna de las palabras; aquí se dejan los que tienen
// TODAS (en cualquier orden) y se ordenan poniendo primero los que traen la frase tal cual.
export function filtrarResultadosApi(resultados, busqueda) {
  const todas = palabrasDe(busqueda);
  const utiles = todas.filter((p) => !esVacia(p));
  const q = utiles.length ? utiles : todas;
  const frase = todas.join(" ");
  const lista = [];
  for (const r of resultados || []) {
    const texto = stripBibleSearchMarkup(r.text);
    const palabras = palabrasDe(texto);
    let total = 0, ok = true;
    for (let i = 0; i < q.length; i++) {
      let mejor = 0;
      for (const w of palabras) { const c = coincidencia(q[i], w, { prefijo: i === q.length - 1 }); if (c > mejor) mejor = c; }
      if (!mejor) { ok = false; break; }
      total += mejor;
    }
    if (!ok) continue;
    if (normalizar(texto).includes(frase)) total += 5;
    lista.push({ r: { ...r, text: texto }, total });
  }
  lista.sort((a, b) => b.total - a.total);
  return lista.map((x) => x.r);
}
