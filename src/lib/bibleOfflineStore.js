// Copia local de la Biblia para poder leerla/proyectarla sin internet (ver "Descargar Biblia" en
// Ajustes) — una Biblia completa son ~1200 capítulos y pesa varios MB, demasiado para el localStorage
// que ya usa offlineCache.js (limitado a unos 5-10MB y compartido con canciones/eventos/ministerios),
// así que esto usa IndexedDB, pensado para justamente este tamaño de datos.
const DB_NAME = "worshipflow_biblia";
const STORE = "capitulos";

function abrirDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "clave" });
        store.createIndex("version", "version", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const clave = (version, bookId, chapter) => `${version}_${bookId}_${chapter}`;

export async function guardarCapituloOffline(version, bookId, chapter, verses) {
  try {
    const db = await abrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ clave: clave(version, bookId, chapter), version, bookId, chapter, verses });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Sin IndexedDB (modo incógnito estricto, cuota llena, etc.) esto es solo un respaldo — no pasa nada
    // grave si no se pudo guardar, la app sigue funcionando con la API en vivo cuando haya conexión.
  }
}

export async function obtenerCapituloOffline(version, bookId, chapter) {
  try {
    const db = await abrirDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(clave(version, bookId, chapter));
      req.onsuccess = () => resolve(req.result?.verses ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function contarCapitulosGuardados(version) {
  try {
    const db = await abrirDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("version").count(IDBKeyRange.only(version));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function borrarVersionOffline(version) {
  try {
    const db = await abrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.index("version").openKeyCursor(IDBKeyRange.only(version));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) { store.delete(cursor.primaryKey); cursor.continue(); }
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // no había nada que borrar, o no hay IndexedDB disponible
  }
}

// Todos los versículos de todos los capítulos guardados de una versión — para poder "buscar una
// frase" sin conexión (ver searchBibleVerses), ya que sin internet no hay a quién preguntarle.
export async function todosLosVersiculosOffline(version) {
  try {
    const db = await abrirDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).index("version").getAll(IDBKeyRange.only(version));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// Descarga capítulo por capítulo (la API bolls.life no ofrece la versión completa en un solo
// archivo) con una pausa corta entre cada uno para no saturar un servicio gratuito compartido con
// más gente. onProgress(hechos, total) se llama tras cada capítulo para poder mostrar una barra de
// avance; señal.aborted permite cancelar a medio camino sin perder lo ya descargado.
export async function descargarBibliaCompleta(version, { fetchBooks, fetchChapter, onProgress, signal }) {
  const books = await fetchBooks(version);
  const total = books.reduce((acc, b) => acc + b.chapters, 0);
  let hechos = 0;
  for (const book of books) {
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      if (signal?.aborted) return { hechos, total, cancelado: true };
      const yaGuardado = await obtenerCapituloOffline(version, book.bookid, chapter);
      if (!yaGuardado) {
        const verses = await fetchChapter(version, book.bookid, chapter);
        await guardarCapituloOffline(version, book.bookid, chapter, verses);
        // Pausa corta entre pedidos — nada más para no golpear la API gratuita de un solo tirón.
        await new Promise((r) => setTimeout(r, 120));
      }
      hechos++;
      onProgress?.(hechos, total);
    }
  }
  return { hechos, total, cancelado: false };
}
