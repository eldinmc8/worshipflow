// Piezas que usan varias pantallas (estilos de botones, ventana base, constantes de la proyección…). Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { saveCache, loadCache } from "../lib/offlineCache.js";
import { guardarCapituloOffline, obtenerCapituloOffline } from "../lib/bibleOfflineStore.js";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Versiones disponibles a través de la Biblia completa y buscable (ver BibleModal). "RVR1960"/"NVI"/"NTV" son
// las que pediste; "TLA"/"DHH" no están disponibles en la fuente de datos gratuita usada por el prototipo, así
// que se agregaron "PDT" (también en lenguaje sencillo, como TLA) y "LBLA" (más literal, como DHH) en su lugar.
// En producción, cuando haya backend propio, esto se reemplaza por la fuente de texto bíblico que se contrate.
export const BIBLE_VERSIONS = [
  { code: "RV1960", label: "Reina-Valera 1960" },
  // NVI quitada (2026-10-21): bolls.life ya no la tiene — Biblica se lo prohibió y en su lugar devuelve
  // un mensaje de protesta en cada versículo, que salía proyectado tal cual.
  { code: "NTV", label: "Nueva Traducción Viviente" },
  { code: "PDT", label: "Palabra de Dios para Todos" },
  { code: "LBLA", label: "La Biblia de las Américas" },
];

export function Field({ label, required, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label} {required && <span style={{ color: "#C23B32" }}>*</span>}</div>
      {children}
    </div>
  );
}

// ---------- Biblia completa y buscable: se consulta en vivo (fetch) a la API pública bolls.life, así el
// operador navega Libro → Capítulo → Versículo(s) sin tener que escribir ni copiar/pegar el texto. Se
// cachea por versión a nivel de módulo para no repetir la descarga de la lista de libros en cada apertura. ----------
const bibleBooksCache = {};

// Si falla el pedido en vivo (sin internet, API caída) se cae a la última lista de libros guardada
// localmente — es un archivo chico (unos 66 nombres), así que basta con offlineCache. El texto de
// cada capítulo, mucho más pesado, vive aparte en IndexedDB (ver bibleOfflineStore.js).
export async function fetchBibleBooks(version) {
  if (bibleBooksCache[version]) return bibleBooksCache[version];
  try {
    const res = await fetch(`https://bolls.life/get-books/${version}/`);
    if (!res.ok) throw new Error("No se pudo cargar la lista de libros.");
    const data = await res.json();
    bibleBooksCache[version] = data;
    saveCache(`biblia_libros_${version}`, data);
    return data;
  } catch (e) {
    const cached = loadCache(`biblia_libros_${version}`);
    if (cached) { bibleBooksCache[version] = cached; return cached; }
    throw e;
  }
}

export async function fetchBibleChapter(version, bookId, chapter) {
  try {
    const res = await fetch(`https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`);
    if (!res.ok) throw new Error("No se pudo cargar el capítulo.");
    const data = await res.json();
    guardarCapituloOffline(version, bookId, chapter, data); // sin esperarlo: no atrasa la lectura por guardar
    return data;
  } catch (e) {
    const offline = await obtenerCapituloOffline(version, bookId, chapter);
    if (offline) return offline;
    throw e;
  }
}

export function ModalShell({ title, icon: Icon, color, onClose, children, alto = false }) {
  // Portal a document.body (no un <div> normal en el sitio donde se usa <ModalShell>) — "position:
  // fixed" por sí solo no basta: si algún ancestro tiene un transform activo (ej. SongView, que anima
  // transform al deslizar entre canciones del Setlist), ese ancestro se vuelve el "contenedor" del
  // fixed y el modal queda atrapado ahí en vez de la pantalla real — mezclado con el scroll de esa
  // vista, a veces cortado a la mitad. Un portal a <body> lo saca del todo de ese árbol, así que
  // siempre se ve completo y centrado en la pantalla real, sin importar desde dónde se abra.
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      {/* alto: usa casi toda la pantalla y deja que una lista de adentro (flex: 1) llene el espacio. */}
      <div style={alto
        ? { background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 16, padding: 18, width: "min(440px, calc(100vw - 20px))", height: "calc(100dvh - 24px)", maxHeight: "calc(100vh - 24px)", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }
        : { background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 16, padding: 20, width: 360, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={16} color={color} /><span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span></div>
          <button onClick={onClose} style={iconGhost}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ---------------- estilos compartidos ----------------
export const iconGhost = { background: "transparent", border: "none", color: "var(--wf-muted)", cursor: "pointer", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 };

export const addBtnStyle = { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: "9px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };

export const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };

export const primaryBtn = { width: "100%", background: "var(--wf-brand-accent)", border: "none", borderRadius: 12, padding: "10px", fontSize: 13, fontWeight: 700, color: "var(--wf-on-brand-accent)", cursor: "pointer" };
