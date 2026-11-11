// Biblia: buscador para agregar versículos, Biblia en vivo de la consola y descargas sin internet. Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState, useRef, useEffect } from "react";
import { contarCapitulosGuardados, descargarBibliaCompleta, borrarVersionOffline, todosLosVersiculosOffline } from "../lib/bibleOfflineStore.js";
import { showToast, notifyError } from "../lib/toast.js";
import { confirmDialog } from "../lib/confirm.js";
import { CloudDownload, ChevronRight, Search, BookOpen, X } from "lucide-react";
import { crearIndice, buscarEnIndice, filtrarResultadosApi } from "../lib/buscarBiblia.js";
import { stripBibleSearchMarkup } from "../lib/textoBiblia.js";
import { leerCita, normalizar as normalizarBusqueda } from "../lib/busqueda.js";
import { partesDeVersiculo } from "../lib/dividirTexto.js";
import { fetchBibleBooks, fetchBibleChapter, BIBLE_VERSIONS, SelectorVersionBiblia, versionBiblia, addBtnStyle, inputStyle, primaryBtn, ModalShell, iconGhost } from "./compartido.jsx";

const BIBLE_QUICK = [
  { ref: "Salmos 100:1-2", version: "RV1960", text: "Toda la tierra celebra con gozo la presencia del Señor y sirve delante de él con alegría." },
  { ref: "Filipenses 4:6-7", version: "NVI", text: "No se inquieten por nada; en toda situación, presenten sus peticiones delante de Dios, y su paz cuidará sus corazones." },
  { ref: "Isaías 41:10", version: "RV1960", text: "No temas, porque yo estoy contigo; te sostengo con mi mano derecha." },
];

// Versión que se descarga para uso sin conexión — solo esta, para no golpear la API gratuita
// bolls.life con las 5 versiones completas (serían miles de pedidos). Reina-Valera 1960 es la que
// aparece primero en BIBLE_VERSIONS (la más usada en iglesias como esta).
const BIBLE_OFFLINE_VERSION = "RV1960";

// "Descargar Biblia" en Ajustes: guarda capítulo por capítulo en este dispositivo (ver
// bibleOfflineStore.js) para que el buscador de Biblia en vivo y "siguiente versículo" (ver
// fetchBibleChapter/fetchBibleBooks) sigan funcionando aunque se corte el internet en el templo.
export function BibleDownloadSection() {
  const [totalCapitulos, setTotalCapitulos] = useState(0);
  const [guardados, setGuardados] = useState(null); // null = todavía revisando
  const [descargando, setDescargando] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const cancelRef = useRef({ aborted: false });

  const actualizarConteo = () => {
    Promise.all([
      fetchBibleBooks(BIBLE_OFFLINE_VERSION).catch(() => null),
      contarCapitulosGuardados(BIBLE_OFFLINE_VERSION),
    ]).then(([books, n]) => {
      setTotalCapitulos(books ? books.reduce((acc, b) => acc + b.chapters, 0) : 0);
      setGuardados(n);
    });
  };
  useEffect(() => { actualizarConteo(); }, []);

  const iniciarDescarga = async () => {
    cancelRef.current = { aborted: false };
    setDescargando(true);
    setProgreso({ hechos: 0, total: 0 });
    try {
      const resultado = await descargarBibliaCompleta(BIBLE_OFFLINE_VERSION, {
        fetchBooks: fetchBibleBooks,
        fetchChapter: fetchBibleChapter,
        onProgress: (hechos, total) => setProgreso({ hechos, total }),
        signal: cancelRef.current,
      });
      if (!resultado.cancelado) showToast("Biblia Reina-Valera 1960 descargada — ya puedes usarla sin conexión.", "info");
    } catch (e) {
      notifyError("No se pudo terminar de descargar la Biblia", e);
    } finally {
      setDescargando(false);
      actualizarConteo();
    }
  };
  const cancelarDescarga = () => { cancelRef.current.aborted = true; };
  const eliminarDescarga = async () => {
    if (!(await confirmDialog("¿Eliminar la copia de la Biblia descargada de este dispositivo?", { danger: true, textoConfirmar: "Eliminar" }))) return;
    await borrarVersionOffline(BIBLE_OFFLINE_VERSION);
    actualizarConteo();
  };

  const completa = guardados !== null && totalCapitulos > 0 && guardados >= totalCapitulos;
  const porcentaje = totalCapitulos ? Math.round(((guardados || 0) / totalCapitulos) * 100) : 0;

  return (
    <div style={{ background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 16, padding: 14, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <CloudDownload size={16} color="#2F5FA8" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Biblia sin conexión (Reina-Valera 1960)</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>
        Descárgala una vez con buena señal para poder seguir buscando y proyectando versículos aunque se corte el internet en el templo.
      </div>
      {guardados === null ? (
        <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>Revisando…</div>
      ) : descargando ? (
        <>
          <div style={{ height: 8, background: "var(--wf-hover)", borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${progreso.total ? Math.round((progreso.hechos / progreso.total) * 100) : 0}%`, background: "#2F5FA8", transition: "width .2s" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 8 }}>{progreso.hechos} de {progreso.total || "…"} capítulos — puede tardar varios minutos.</div>
          <button onClick={cancelarDescarga} style={{ fontSize: 12, fontWeight: 700, color: "#C23B32", background: "none", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 12px", cursor: "pointer" }}>Cancelar</button>
        </>
      ) : completa ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#1F8A73", fontWeight: 700 }}>✓ Descargada completa ({guardados} capítulos)</span>
          <button onClick={eliminarDescarga} style={{ fontSize: 11, color: "#C23B32", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Eliminar</button>
        </div>
      ) : (
        <>
          {guardados > 0 && <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 8 }}>Ya tienes {guardados} de {totalCapitulos} capítulos ({porcentaje}%)</div>}
          <button onClick={iniciarDescarga} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--wf-bg)", border: "none", borderRadius: 12, padding: "9px 10px", fontSize: 12, fontWeight: 700, color: "var(--wf-text)", cursor: "pointer" }}>
            <CloudDownload size={14} color="#2F5FA8" /> {guardados > 0 ? "Continuar descarga" : "Descargar para uso sin conexión"}
          </button>
        </>
      )}
    </div>
  );
}

// La API devuelve <mark> alrededor de las palabras encontradas y a veces <br> dentro del texto (saltos de
// línea de poesía) — se limpia para mostrarlo como texto plano, igual que el resto de la app.

// Búsqueda por palabras (pedido de Eldin, 2026-10-21 — antes pedía la frase exacta y fallaba mucho):
// 1. Si se escribió una cita ("stgo 4:1", "jn 3 16", "salmo 23") abre ese pasaje.
// 2. Con la Biblia guardada en el equipo: todas las palabras en cualquier orden, sin tildes y con faltas
//    de ortografía (índice en memoria, ver lib/buscarBiblia.js).
// 3. Si no está guardada: la API (palabras bien escritas), filtrada a los que tienen TODAS las palabras.
// 4. Si en esta versión no aparece (ej. "cosecharemos" no existe en RV1960, ahí dice "segaremos"),
//    busca en NTV/LBLA/PDT y ofrece proyectar ese mismo versículo en la versión elegida.
const indicesBiblia = {};

// La consola baja sola la RV1960 al equipo la primera vez que se abre la Biblia (unos minutos, en segundo
// plano): con ella guardada la búsqueda aguanta faltas de ortografía y funciona sin internet.
const descargaAuto = { estado: "inactivo", hechos: 0, total: 0, oyentes: new Set() };

const avisarDescargaAuto = () => descargaAuto.oyentes.forEach((f) => f());

async function arrancarDescargaAuto() {
  if (descargaAuto.estado !== "inactivo" || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  descargaAuto.estado = "revisando";
  try {
    const libros = await fetchBibleBooks(BIBLE_OFFLINE_VERSION);
    const total = libros.reduce((acc, b) => acc + b.chapters, 0);
    const guardados = await contarCapitulosGuardados(BIBLE_OFFLINE_VERSION);
    if (guardados >= total) { descargaAuto.estado = "lista"; avisarDescargaAuto(); return; }
    descargaAuto.estado = "bajando"; descargaAuto.hechos = guardados; descargaAuto.total = total; avisarDescargaAuto();
    const r = await descargarBibliaCompleta(BIBLE_OFFLINE_VERSION, {
      fetchBooks: fetchBibleBooks, fetchChapter: fetchBibleChapter,
      onProgress: (h, t) => { descargaAuto.hechos = h; descargaAuto.total = t; if (h % 25 === 0) avisarDescargaAuto(); },
    });
    delete indicesBiblia[BIBLE_OFFLINE_VERSION];
    descargaAuto.estado = r.cancelado ? "inactivo" : "lista";
  } catch {
    descargaAuto.estado = "inactivo"; // se vuelve a intentar la próxima vez que se abra la Biblia
  }
  avisarDescargaAuto();
}

function useBibliaParaBuscar() {
  const [, redibujar] = useState(0);
  useEffect(() => {
    const f = () => redibujar((x) => x + 1);
    descargaAuto.oyentes.add(f);
    arrancarDescargaAuto();
    return () => { descargaAuto.oyentes.delete(f); };
  }, []);
  return { lista: descargaAuto.estado === "lista", bajando: descargaAuto.estado === "bajando", porcentaje: descargaAuto.total ? Math.round((descargaAuto.hechos / descargaAuto.total) * 100) : 0 };
}

async function indiceBibliaLocal(version) {
  if (!indicesBiblia[version]) {
    indicesBiblia[version] = todosLosVersiculosOffline(version).then((caps) => (caps.length >= 1100 ? crearIndice(caps) : null));
  }
  const indice = await indicesBiblia[version].catch(() => null);
  if (!indice) delete indicesBiblia[version]; // incompleta: se vuelve a intentar cuando termine de bajar
  return indice;
}

async function buscarEnApiBiblia(version, texto) {
  // Las de api.getbible.net no tienen búsqueda por palabras: se busca en NTV/LBLA/PDT y se ofrece
  // proyectar ese mismo versículo en la versión elegida (ver searchBibleVerses, "otraVersion").
  if (versionBiblia(version)?.fuente) return [];
  const res = await fetch(`https://bolls.life/v2/find/${version}?search=${encodeURIComponent(texto)}&match_case=false`);
  if (!res.ok) throw new Error("No se pudo buscar en la Biblia.");
  const data = await res.json();
  // Por si otra versión también queda bloqueada: nunca ofrecer un "versículo" que es un aviso legal.
  return (data.results || []).filter((r) => !/prohibi[oó] usar la traducci[oó]n/i.test(stripBibleSearchMarkup(r.text)));
}

async function searchBibleVerses(version, query, books) {
  const cita = leerCita(query, books);
  if (cita) {
    const { libro, capitulo, desde, hasta } = cita;
    const verses = await fetchBibleChapter(version, libro.bookid, capitulo);
    const elegidos = desde ? verses.filter((v) => v.verse >= desde && v.verse <= hasta) : verses;
    return {
      cita: `${libro.name} ${capitulo}${desde ? `:${desde}${hasta > desde ? `-${hasta}` : ""}` : ""}`,
      resultados: elegidos.map((v) => ({ pk: `${libro.bookid}-${capitulo}-${v.verse}`, book: libro.bookid, chapter: capitulo, verse: v.verse, text: stripBibleSearchMarkup(v.text) })),
    };
  }
  const indice = await indiceBibliaLocal(version);
  if (indice) {
    const r = buscarEnIndice(indice, query);
    if (r.length) return { resultados: r };
  }
  let resultados = [];
  let sinInternet = null;
  try {
    resultados = filtrarResultadosApi(await buscarEnApiBiblia(version, query), query);
    if (!resultados.length) {
      // La API a veces no trae nada con varias palabras: se prueba con las más largas una por una.
      const largas = normalizarBusqueda(query).split(" ").filter((p) => p.length >= 4).sort((a, b) => b.length - a.length).slice(0, 2);
      for (const w of largas) {
        resultados = filtrarResultadosApi(await buscarEnApiBiblia(version, w), query);
        if (resultados.length) break;
      }
    }
  } catch (e) {
    sinInternet = e;
    // Sin conexión y sin la Biblia completa: busca en lo que sí se haya guardado.
    if (!indice) {
      const capitulos = await todosLosVersiculosOffline(version);
      if (!capitulos.length) throw e;
      const todos = capitulos.flatMap((cap) => cap.verses.map((v) => ({ pk: `${cap.bookId}-${cap.chapter}-${v.verse}`, book: cap.bookId, chapter: cap.chapter, verse: v.verse, text: v.text })));
      resultados = filtrarResultadosApi(todos, query);
    }
  }
  if (resultados.length) return { resultados: resultados.slice(0, 60) };
  if (!sinInternet) {
    for (const otra of ["NTV", "LBLA", "PDT"].filter((v) => v !== version)) {
      try {
        const r = filtrarResultadosApi(await buscarEnApiBiblia(otra, query), query);
        if (r.length) return { resultados: r.slice(0, 30), otraVersion: otra };
      } catch { /* sigue con la siguiente */ }
    }
  }
  return { resultados: [] };
}

// Cuerpo del buscador de Biblia, sin el modal alrededor — se reutiliza tal cual dentro de un <ModalShell>
// (Setlist: "Agregar versículo") y también suelto dentro de un panel lateral angosto (En vivo: versículo
// improvisado), que es justo la manera compacta en la que se quería ver esto en el dashboard en vivo.
export function BibleBrowserBody({ onAdd, submitLabel = "Agregar al servicio", splitVersesIndividually = false }) {
  const [mode, setMode] = useState("browse"); // browse: biblia completa en vivo · manual: escribir a mano
  const [version, setVersion] = useState(BIBLE_VERSIONS[0].code);
  const [books, setBooks] = useState(null);
  const [bookFilter, setBookFilter] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState(null);
  const [range, setRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [custom, setCustom] = useState({ ref: "", version: BIBLE_VERSIONS[0].code, text: "" });

  useEffect(() => {
    if (mode !== "browse") return;
    setLoading(true); setLoadError("");
    fetchBibleBooks(version).then(setBooks).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  }, [mode, version]);

  const backToBooks = () => { setSelectedBook(null); setSelectedChapter(null); setVerses(null); setRange(null); };
  const backToChapters = () => { setSelectedChapter(null); setVerses(null); setRange(null); };
  const openChapter = (book, chapter) => {
    setSelectedBook(book); setSelectedChapter(chapter); setRange(null); setVerses(null);
    setLoading(true); setLoadError("");
    fetchBibleChapter(version, book.bookid, chapter).then(setVerses).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  const pickVerse = (v) => {
    setRange((r) => {
      if (!r || r.start !== r.end) return { start: v, end: v }; // sin selección, o el rango anterior ya estaba cerrado: empieza uno nuevo
      return { start: Math.min(r.start, v), end: Math.max(r.start, v) }; // había un solo versículo elegido: lo convierte en rango
    });
  };
  const confirmRange = () => {
    if (!range || !verses) return;
    const picked = verses.filter((v) => v.verse >= range.start && v.verse <= range.end);
    // bookId/chapter/verseStart/verseEnd quedan guardados para poder usar "Siguiente versículo" y cambiar de
    // versión en vivo más adelante sin tener que volver a abrir este buscador (ver MultimediaControl).
    if (splitVersesIndividually && picked.length > 1) {
      // Cada versículo del rango se agrega como su propia diapositiva — así quien lee puede avanzar
      // versículo por versículo en vivo, en vez de tener un solo bloque con todos juntos.
      picked.forEach((v) => {
        onAdd({ ref: `${selectedBook.name} ${selectedChapter}:${v.verse}`, version, text: stripBibleSearchMarkup(v.text), bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: v.verse, verseEnd: v.verse });
      });
      return;
    }
    const text = picked.map((v) => stripBibleSearchMarkup(v.text)).join(" ");
    const ref = range.start === range.end ? `${selectedBook.name} ${selectedChapter}:${range.start}` : `${selectedBook.name} ${selectedChapter}:${range.start}-${range.end}`;
    onAdd({ ref, version, text, bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: range.start, verseEnd: range.end });
  };
  const filteredBooks = books ? books.filter((b) => normalizarBusqueda(b.name).includes(normalizarBusqueda(bookFilter))) : [];

  return (
    <>
      <div style={{ display: "flex", gap: 3, background: "var(--wf-hover)", padding: 3, borderRadius: 12, marginBottom: 12, width: "fit-content" }}>
        {[["browse", "Buscar en la Biblia"], ["manual", "Escribir manualmente"]].map(([val, label]) => (
          <button key={val} onClick={() => setMode(val)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: mode === val ? "var(--wf-brand-accent)" : "transparent", color: mode === val ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>{label}</button>
        ))}
      </div>

      {mode === "manual" && (
        <>
          <div style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700, marginBottom: 8 }}>ACCESO RÁPIDO</div>
          {BIBLE_QUICK.map((b) => (
            <button key={b.ref} onClick={() => onAdd(b)} className="hoverable" style={{ ...addBtnStyle, textAlign: "left", marginBottom: 6 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{b.ref}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#2F5FA8", background: "#EAF0FA", borderRadius: 10, padding: "1px 5px" }}>{b.version}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>{b.text}</div>
              </div>
            </button>
          ))}
          <div style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700, margin: "14px 0 8px" }}>O ESCRIBE UNO NUEVO</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Referencia (ej. Juan 3:16)" value={custom.ref} onChange={(e) => setCustom({ ...custom, ref: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
            <SelectorVersionBiblia value={custom.version} onChange={(v) => setCustom({ ...custom, version: v })} style={{ width: 130, flexShrink: 0 }} />
          </div>
          <textarea placeholder="Texto a proyectar..." value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} style={{ ...inputStyle, height: 70, marginTop: 8, resize: "none" }} />
          <button onClick={() => custom.ref && custom.text && onAdd(custom)} style={{ ...primaryBtn, marginTop: 10 }}>{submitLabel}</button>
        </>
      )}

      {mode === "browse" && (
        <>
          <div style={{ marginBottom: 10 }}>
            <SelectorVersionBiblia value={version} onChange={setVersion} />
          </div>

          {(selectedBook || selectedChapter) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2F5FA8", fontWeight: 700, marginBottom: 10 }}>
              <span onClick={backToBooks} style={{ cursor: "pointer" }}>Libros</span>
              {selectedBook && <><ChevronRight size={12} /><span onClick={backToChapters} style={{ cursor: "pointer" }}>{selectedBook.name}</span></>}
              {selectedChapter && <><ChevronRight size={12} /><span>Cap. {selectedChapter}</span></>}
            </div>
          )}

          {loading && <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "20px 0", textAlign: "center" }}>Cargando…</div>}
          {loadError && <div style={{ fontSize: 12, color: "#C23B32", padding: "10px 0" }}>{loadError} Revisa tu conexión a internet e intenta de nuevo.</div>}

          {!loading && !loadError && !selectedBook && books && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 10px", marginBottom: 10 }}>
                <Search size={13} color="var(--wf-faint)" />
                <input value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} placeholder="Buscar libro (ej. Juan, Salmos)…" style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 12, width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {filteredBooks.map((b) => (
                  <button key={b.bookid} onClick={() => setSelectedBook(b)} className="hoverable" style={{ ...addBtnStyle, textAlign: "left" }}>{b.name}</button>
                ))}
              </div>
            </>
          )}

          {!loading && !loadError && selectedBook && !selectedChapter && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((c) => (
                <button key={c} onClick={() => openChapter(selectedBook, c)} style={{ padding: "8px 0", borderRadius: 12, border: "1px solid var(--wf-border)", background: "var(--wf-card)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
          )}

          {!loading && !loadError && selectedBook && selectedChapter && verses && (
            <>
              <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 8 }}>
                Toca un versículo para empezar, y otro para armar un rango.
                {splitVersesIndividually && " Cada versículo del rango se agrega como su propia diapositiva."}
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {verses.map((v) => {
                  const inRange = range && v.verse >= range.start && v.verse <= range.end;
                  return (
                    <button key={v.verse} onClick={() => pickVerse(v.verse)} style={{ textAlign: "left", padding: "6px 8px", borderRadius: 12, border: inRange ? "1px solid #2F5FA8" : "1px solid transparent", background: inRange ? "#EAF0FA" : "transparent", cursor: "pointer", fontSize: 12.5, color: "var(--wf-text)", lineHeight: 1.45 }}>
                      <b style={{ color: "#2F5FA8" }}>{v.verse}</b> {stripBibleSearchMarkup(v.text)}
                    </button>
                  );
                })}
              </div>
              {range && (
                <button onClick={confirmRange} style={{ ...primaryBtn, marginTop: 12 }}>
                  {submitLabel} · {selectedBook.name} {selectedChapter}:{range.start === range.end ? range.start : `${range.start}-${range.end}`}
                  {splitVersesIndividually && range.end > range.start ? ` (${range.end - range.start + 1} diapositivas)` : ""}
                </button>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

export function BibleModal({ onClose, onAdd, title = "Agregar versículo", submitLabel = "Agregar al servicio", splitVersesIndividually = false }) {
  return (
    <ModalShell title={title} icon={BookOpen} color="#2F5FA8" onClose={onClose}>
      <BibleBrowserBody onAdd={onAdd} submitLabel={submitLabel} splitVersesIndividually={splitVersesIndividually} />
    </ModalShell>
  );
}

const VISTA_VERSICULOS_KEY = "wf-biblia-vista-versiculos";

// ---------------- BIBLIA EN VIVO (estilo Proyektor: 3 columnas, clic en un versículo proyecta al instante) ----------------
// Columna 1: libros divididos en Antiguo/Nuevo Testamento (bookid 1-39 = AT, 40-66 = NT en bolls.life).
// Columna 2: versión arriba, capítulos del libro elegido, e historial de versículos ya proyectados esta
// sesión — así el operador vuelve rápido a un pasaje que el pastor ya citó antes, sin tener que buscarlo
// de nuevo. Columna 3: el capítulo completo; tocar un versículo lo proyecta de inmediato, sin botón de
// confirmación (a diferencia del buscador del Setlist, aquí no se arma un rango: es lectura en vivo).
export function BibleLivePanel({ version, setVersion, history, setHistory, onProject, liveVerse, palabrasPorParte = 40 }) {
  const [books, setBooks] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [bookFilter, setBookFilter] = useState("");
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [verses, setVerses] = useState(null);
  const [loadingChapter, setLoadingChapter] = useState(false);
  // Búsqueda de frase dentro del texto (no solo nombre de libro): mientras hay una búsqueda activa, la
  // columna 3 muestra los versículos encontrados en TODA la Biblia en vez del capítulo seleccionado.
  const [searchResults, setSearchResults] = useState(null); // null = sin búsqueda activa; [] = sin resultados
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchInfo, setSearchInfo] = useState({}); // { cita, otraVersion }
  const bibliaLista = useBibliaParaBuscar(); // descarga sola la RV1960 para buscar con errores
  // Columna 3: versículos con su texto completo o solo sus números. Cada computadora recuerda lo
  // que eligió quien la usa (localStorage puede fallar en modo privado: entonces vuelve a "texto").
  const [vistaVersiculos, setVistaVersiculos] = useState(() => {
    try { return localStorage.getItem(VISTA_VERSICULOS_KEY) === "numeros" ? "numeros" : "texto"; } catch { return "texto"; }
  });
  const cambiarVistaVersiculos = (val) => {
    setVistaVersiculos(val);
    try { localStorage.setItem(VISTA_VERSICULOS_KEY, val); } catch { /* sin almacenamiento: solo esta vez */ }
  };

  useEffect(() => {
    setLoadError("");
    fetchBibleBooks(version).then(setBooks).catch((e) => setLoadError(e.message));
  }, [version]);

  // Con al menos 3 caracteres busca la frase completa en el texto de los versículos — con menos, se
  // asume que todavía está escribiendo el nombre de un libro y no vale la pena golpear la API.
  // Debounce de 400ms: no dispara una búsqueda por cada tecla mientras escribe.
  useEffect(() => {
    const query = bookFilter.trim();
    // Solo el nombre de un libro ("jua", "salmos") no es búsqueda: filtra la lista de libros.
    const esSoloLibro = books && !/\d/.test(query) && books.some((b) => normalizarBusqueda(b.name).startsWith(normalizarBusqueda(query)));
    if (query.length < 3 || esSoloLibro) { setSearchResults(null); setSearchError(""); return; }
    setSearching(true); setSearchError("");
    let vigente = true;
    const timer = setTimeout(() => {
      searchBibleVerses(version, query, books)
        .then(({ resultados, ...info }) => { if (!vigente) return; setSearchResults(resultados.slice(0, 60)); setSearchInfo(info); })
        .catch((e) => { if (!vigente) return; setSearchError(e.message); setSearchResults([]); setSearchInfo({}); })
        .finally(() => { if (vigente) setSearching(false); });
    }, 350);
    return () => { vigente = false; clearTimeout(timer); };
  }, [bookFilter, version, books, bibliaLista.lista]);

  const loadChapter = (bookId, chapter, v) => {
    setLoadingChapter(true); setLoadError("");
    fetchBibleChapter(v || version, bookId, chapter).then(setVerses).catch((e) => setLoadError(e.message)).finally(() => setLoadingChapter(false));
  };
  // Elegir un libro/capítulo a mano siempre gana sobre una búsqueda de frase que haya quedado pendiente.
  const openBook = (book) => { setSearchResults(null); setSelectedBook(book); setSelectedChapter(1); loadChapter(book.bookid, 1); };
  const openChapter = (chapter) => { setSearchResults(null); setSelectedChapter(chapter); loadChapter(selectedBook.bookid, chapter); };
  const changeVersion = (v) => { setVersion(v); if (selectedBook) loadChapter(selectedBook.bookid, selectedChapter, v); };

  const rememberAndProject = (entry) => {
    onProject(entry);
    const { parte, ...paraHistorial } = entry; // el historial guarda el versículo completo
    setHistory((h) => [paraHistorial, ...h.filter((x) => x.ref !== entry.ref || x.version !== entry.version)].slice(0, 25));
  };
  // parte: en un versículo largo, en cuál de sus partes arrancar (ver la lista de abajo).
  const pickVerse = (v, parte = 0) => {
    rememberAndProject({
      ref: `${selectedBook.name} ${selectedChapter}:${v.verse}`, version, text: stripBibleSearchMarkup(v.text),
      bookId: selectedBook.bookid, bookName: selectedBook.name, chapter: selectedChapter, verseStart: v.verse, verseEnd: v.verse, parte,
    });
  };
  const openHistoryEntry = (entry) => {
    rememberAndProject(entry);
    // Igual que abrir un libro/capítulo a mano: si había quedado una búsqueda de frase activa, se
    // limpia — si no, la columna 3 se quedaba mostrando esos resultados viejos en vez del capítulo
    // completo del versículo que se acaba de elegir del historial.
    setBookFilter(""); setSearchResults(null);
    const book = books?.find((b) => b.bookid === entry.bookId);
    if (book) setSelectedBook(book);
    setSelectedChapter(entry.chapter);
    if (entry.version !== version) setVersion(entry.version);
    loadChapter(entry.bookId, entry.chapter, entry.version);
  };
  // Elegir un resultado de búsqueda: proyecta ese versículo Y salta a su capítulo completo (limpiando la
  // búsqueda), para poder seguir leyendo alrededor de ese versículo con la vista normal de capítulo.
  const pickSearchResult = async (r) => {
    const book = books?.find((b) => b.bookid === r.book);
    const bookName = book?.name || `Libro ${r.book}`;
    // Encontrado en otra versión: se proyecta el MISMO versículo en la versión elegida.
    let texto = stripBibleSearchMarkup(r.text);
    if (searchInfo.otraVersion) {
      try {
        const cap = await fetchBibleChapter(version, r.book, r.chapter);
        const v = cap.find((x) => x.verse === r.verse);
        if (v) texto = stripBibleSearchMarkup(v.text);
      } catch { /* sin conexión: se queda con el texto encontrado */ }
    }
    rememberAndProject({
      ref: `${bookName} ${r.chapter}:${r.verse}`, version, text: texto,
      bookId: r.book, bookName, chapter: r.chapter, verseStart: r.verse, verseEnd: r.verse,
    });
    if (book) setSelectedBook(book);
    setSelectedChapter(r.chapter);
    loadChapter(r.book, r.chapter);
    setBookFilter(""); setSearchResults(null);
  };

  // Mientras hay resultados de una frase o cita, la lista de libros se queda completa.
  const matchesFilter = (name) => !bookFilter || searchResults !== null || normalizarBusqueda(name).includes(normalizarBusqueda(bookFilter));
  const oldTestament = books ? books.filter((b) => b.bookid <= 39 && matchesFilter(b.name)) : [];
  const newTestament = books ? books.filter((b) => b.bookid >= 40 && matchesFilter(b.name)) : [];
  const bookListStyle = (b) => ({ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "3px 4px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: selectedBook?.bookid === b.bookid ? 700 : 500, color: selectedBook?.bookid === b.bookid ? "var(--wf-brand-accent)" : "#2F5FA8" });

  return (
    <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
      {/* Columna 1: libros AT/NT */}
      <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 9px", marginBottom: 8, flexShrink: 0 }}>
          <Search size={12} color="var(--wf-faint)" />
          <input value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} placeholder="Libro, cita (jn 3:16) o palabras…" style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 11.5, width: "100%" }} />
          {bookFilter && <button onClick={() => { setBookFilter(""); setSearchResults(null); }} style={iconGhost}><X size={12} /></button>}
        </div>
        {bibliaLista.bajando && version === BIBLE_OFFLINE_VERSION && (
          <div title="Se guarda la Reina-Valera 1960 en esta computadora: así la búsqueda entiende faltas de ortografía y funciona sin internet." style={{ fontSize: 10.5, color: "var(--wf-muted)", margin: "-4px 2px 8px", lineHeight: 1.35 }}>
            Preparando búsqueda con faltas de ortografía… {bibliaLista.porcentaje}%
          </div>
        )}
        {loadError && <div style={{ fontSize: 11, color: "#C23B32", marginBottom: 8 }}>{loadError}</div>}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 64 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: "sticky", top: 0, background: "var(--wf-bg)", fontSize: 10, fontWeight: 700, color: "var(--wf-muted)", padding: "2px 0 6px" }}>ANTIGUO TESTAMENTO</div>
              {oldTestament.map((b) => (<button key={b.bookid} onClick={() => openBook(b)} style={bookListStyle(b)}>{b.name}</button>))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: "sticky", top: 0, background: "var(--wf-bg)", fontSize: 10, fontWeight: 700, color: "var(--wf-muted)", padding: "2px 0 6px" }}>NUEVO TESTAMENTO</div>
              {newTestament.map((b) => (<button key={b.bookid} onClick={() => openBook(b)} style={bookListStyle(b)}>{b.name}</button>))}
            </div>
          </div>
        </div>
      </div>

      {/* Columna 2: versión, capítulos, historial */}
      <div style={{ width: 210, flexShrink: 0, minHeight: 0, overflowY: "auto", paddingBottom: 64 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>VERSIÓN</div>
        <div style={{ marginBottom: 14 }}>
          <SelectorVersionBiblia value={version} onChange={changeVersion} compacto />
        </div>

        {selectedBook ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>CAPÍTULOS DE {selectedBook.name.toUpperCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 14 }}>
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map((c) => (
                <button key={c} onClick={() => openChapter(c)} style={{ padding: "6px 0", borderRadius: 10, border: "none", background: selectedChapter === c ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: selectedChapter === c ? "var(--wf-brand-primary)" : "var(--wf-text)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: "var(--wf-faint)", marginBottom: 14 }}>Elige un libro para ver sus capítulos.</div>
        )}

        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>HISTORIAL</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--wf-faint)" }}>Los versículos que proyectes van a aparecer aquí para volver rápido a ellos.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {history.map((h) => {
              const isLive = liveVerse && liveVerse.ref === h.ref && liveVerse.version === h.version;
              return (
                <button key={`${h.ref}-${h.version}`} onClick={() => openHistoryEntry(h)} style={{ textAlign: "left", background: isLive ? "var(--wf-active-bg)" : "#fff", border: isLive ? "1px solid var(--wf-brand-accent)" : "1px solid transparent", borderRadius: 10, padding: "5px 7px", cursor: "pointer", boxShadow: "0 1px 4px rgba(22,50,79,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-text)" }}>{h.ref} <span style={{ color: "#2F5FA8", fontWeight: 700 }}>· {h.version}</span></div>
                  <div style={{ fontSize: 10.5, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.text}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Columna 3: resultados de búsqueda de frase (si hay una activa), si no el capítulo completo —
          en ambos casos, clic en un versículo proyecta al instante */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: "auto", paddingBottom: 64 }}>
        {searchResults !== null ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>
              {searching ? "Buscando…" : searchInfo.cita ? searchInfo.cita : `"${bookFilter.trim()}" · ${searchResults.length} versículo${searchResults.length === 1 ? "" : "s"}`}
            </div>
            {!searching && searchInfo.otraVersion && searchResults.length > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--wf-text-2)", background: "var(--wf-hover)", borderRadius: 10, padding: "7px 9px", marginBottom: 8, lineHeight: 1.45 }}>
                Con esas palabras no aparece en {version}; esto es de la <b>{searchInfo.otraVersion}</b>. Al tocar uno se proyecta ese mismo versículo en {version}.
              </div>
            )}
            {searchError && <div style={{ fontSize: 12, color: "#C23B32", padding: "10px 0" }}>{searchError} Revisa tu conexión a internet e intenta de nuevo.</div>}
            {!searching && !searchError && searchResults.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "20px 0", textAlign: "center" }}>No se encontró ningún versículo con esas palabras. Prueba con menos palabras, o escribe la cita (ej. <b>stgo 4:1</b>).</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {searchResults.map((r) => {
                const bookName = books?.find((b) => b.bookid === r.book)?.name || `Libro ${r.book}`;
                const isLive = liveVerse && liveVerse.bookId === r.book && liveVerse.chapter === r.chapter && liveVerse.verseStart === r.verse && liveVerse.version === version;
                return (
                  <button key={r.pk} onClick={() => pickSearchResult(r)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: 12, border: "none", background: isLive ? "var(--wf-divider)" : "transparent", cursor: "pointer", fontSize: 13, color: "var(--wf-text)", lineHeight: 1.5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", marginBottom: 2 }}>{bookName} {r.chapter}:{r.verse}</div>
                    {stripBibleSearchMarkup(r.text)}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {!selectedBook && <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "20px 0", textAlign: "center" }}>Elige un libro y capítulo para ver los versículos.</div>}
            {selectedBook && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{selectedBook.name} {selectedChapter}</div>
                <div style={{ display: "flex", gap: 2, background: "var(--wf-hover)", padding: 2, borderRadius: 10, flexShrink: 0 }}>
                  {[["texto", "Texto"], ["numeros", "Números"]].map(([val, label]) => (
                    <button key={val} onClick={() => cambiarVistaVersiculos(val)} title={val === "texto" ? "Ver los versículos completos" : "Ver solo el número de cada versículo"} style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 9px", borderRadius: 8, border: "none", cursor: "pointer", background: vistaVersiculos === val ? "var(--wf-brand-accent)" : "transparent", color: vistaVersiculos === val ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            {loadingChapter && <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "20px 0", textAlign: "center" }}>Cargando…</div>}
            {/* Solo números (pedido de Eldin, 2026-11-07): una cuadrícula como la de capítulos, para
                encontrar rápido el versículo que cita el pastor. Tocar uno lo proyecta igual que en la
                vista de texto; si es largo arranca en su primera parte y las flechas siguen avanzando. */}
            {!loadingChapter && verses && vistaVersiculos === "numeros" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 4 }}>
                {verses.map((v) => {
                  const isLive = liveVerse && liveVerse.bookId === selectedBook.bookid && liveVerse.chapter === selectedChapter && liveVerse.verseStart === v.verse && liveVerse.version === version;
                  return (
                    <button key={v.verse} onClick={() => pickVerse(v)} title={stripBibleSearchMarkup(v.text)} style={{ padding: "8px 0", borderRadius: 10, border: "none", background: isLive ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: isLive ? "var(--wf-brand-primary)" : "var(--wf-text)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v.verse}</button>
                  );
                })}
              </div>
            )}
            {!loadingChapter && verses && vistaVersiculos === "texto" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {verses.map((v) => {
                  const isLive = liveVerse && liveVerse.bookId === selectedBook.bookid && liveVerse.chapter === selectedChapter && liveVerse.verseStart === v.verse && liveVerse.version === version;
                  // Versículo largo (pedido de Eldin, 2026-10-08): cada parte aparece en la lista como
                  // si fuera su propio versículo — "9 (1/2)", "9 (2/2)" — para tocar directo la que
                  // toque; las flechas siguen avanzando parte por parte. Mismo corte que la proyección.
                  const partes = partesDeVersiculo(stripBibleSearchMarkup(v.text), palabrasPorParte);
                  if (partes.length > 1) {
                    return partes.map((texto, k) => {
                      const parteEnVivo = isLive && (liveVerse.parte ?? 0) === k;
                      return (
                        <button key={`${v.verse}-${k}`} onClick={() => pickVerse(v, k)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: 12, border: "none", background: parteEnVivo ? "var(--wf-divider)" : "transparent", cursor: "pointer", fontSize: 13, color: "var(--wf-text)", lineHeight: 1.5 }}>
                          <b style={{ color: "#2F5FA8" }}>{v.verse}</b> <span style={{ fontSize: 10.5, fontWeight: 700, color: "#2F5FA8" }}>({k + 1}/{partes.length})</span> {texto}
                        </button>
                      );
                    });
                  }
                  return (
                    <button key={v.verse} onClick={() => pickVerse(v)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: 12, border: "none", background: isLive ? "var(--wf-divider)" : "transparent", cursor: "pointer", fontSize: 13, color: "var(--wf-text)", lineHeight: 1.5 }}>
                      <b style={{ color: "#2F5FA8" }}>{v.verse}</b> {stripBibleSearchMarkup(v.text)}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
