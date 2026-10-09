import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp, X, Trash2, Merge, Loader2, Images, FileText } from "lucide-react";
import { ACEPTA, tipoDeArchivo, paginasDePdf, imagenNormalizada, textoDeArchivo, dividirEnDiapositivas, itemsDeImportacion } from "../lib/importarPresentacion.js";
import { subirPaginaPresentacion } from "../lib/multimedia.js";
import { useArrastreGrid } from "../lib/arrastreGrid.js";

// Ventana para importar una presentación al orden del culto (ver lib/importarPresentacion.js):
// 1) elegir el archivo (o arrastrarlo encima), 2) revisar — páginas en miniatura para quitar o
// reordenar arrastrando, o el texto ya separado en diapositivas para corregir, unir o quitar —,
// 3) "Agregar al culto": las páginas se suben al almacenamiento de la iglesia y todo entra al Setlist.
// onImportar(items) recibe los elementos listos para el orden del culto; `destino` dice dónde entran.
export default function ImportarPresentacion({ iglesiaId, destino, onImportar, onClose }) {
  const [fase, setFase] = useState("elegir"); // elegir | procesando | revisar | subiendo
  const [nombre, setNombre] = useState("");
  const [paginas, setPaginas] = useState([]); // [{ id, blob, vista }]
  const [texto, setTexto] = useState(null); // texto completo de un Word/.txt (null si son páginas)
  const [modo, setModo] = useState("bloque");
  const [textos, setTextos] = useState([]); // [{ id, texto }]
  const [agrupar, setAgrupar] = useState(true);
  const [progreso, setProgreso] = useState(null); // { hechas, total, verbo }
  const [error, setError] = useState("");
  const [sobreZona, setSobreZona] = useState(false);
  const inputRef = useRef(null);

  // Las vistas previas son URLs locales del navegador: se liberan al cerrar.
  const paginasRef = useRef(paginas);
  paginasRef.current = paginas;
  useEffect(() => () => paginasRef.current.forEach((p) => URL.revokeObjectURL(p.vista)), []);

  useEffect(() => {
    if (texto == null) return;
    setTextos(dividirEnDiapositivas(texto, modo).map((t) => ({ id: crypto.randomUUID(), texto: t })));
  }, [texto, modo]);

  const nuevaPagina = (blob) => ({ id: crypto.randomUUID(), blob, vista: URL.createObjectURL(blob) });

  const procesar = async (files) => {
    const lista = [...(files || [])];
    if (!lista.length) return;
    setError("");
    const tipos = lista.map(tipoDeArchivo);
    if (tipos.includes("presentacion-sin-pdf")) {
      setError("Los archivos de PowerPoint o Keynote no se pueden leer directo. Ábrelo en su programa y usa \"Exportar → PDF\" (en Canva: Compartir → Descargar → PDF), y sube ese PDF.");
      return;
    }
    if (tipos.some((t) => !t)) { setError("Ese tipo de archivo no se puede importar. Usa PDF, imágenes (PNG/JPG), Word (.docx) o texto (.txt)."); return; }
    if (lista.length > 1 && tipos.some((t) => t !== "imagen")) { setError("Varios archivos a la vez solo si todos son imágenes. Un PDF o un Word, de uno en uno."); return; }
    setNombre(lista.length > 1 ? "Presentación" : lista[0].name);
    setFase("procesando");
    try {
      if (tipos[0] === "pdf") {
        const blobs = await paginasDePdf(lista[0], (hechas, total) => setProgreso({ hechas, total, verbo: "Leyendo páginas" }));
        setPaginas(blobs.map(nuevaPagina));
        setTexto(null);
      } else if (tipos[0] === "imagen") {
        const blobs = [];
        for (let i = 0; i < lista.length; i++) {
          blobs.push(await imagenNormalizada(lista[i]));
          setProgreso({ hechas: i + 1, total: lista.length, verbo: "Preparando imágenes" });
        }
        setPaginas(blobs.map(nuevaPagina));
        setTexto(null);
      } else {
        const t = await textoDeArchivo(lista[0], tipos[0]);
        if (!t.trim()) throw new Error("El archivo no tiene texto.");
        setPaginas([]);
        setTexto(t);
      }
      setFase("revisar");
    } catch (e) {
      setError(e?.message || "No se pudo leer el archivo.");
      setFase("elegir");
    } finally {
      setProgreso(null);
    }
  };

  const esTexto = texto != null;
  const elementos = esTexto ? textos : paginas;
  const mover = (desde, hacia) => {
    const cambiar = (arr) => { const a = [...arr]; const [x] = a.splice(desde, 1); a.splice(hacia, 0, x); return a; };
    if (esTexto) setTextos(cambiar); else setPaginas(cambiar);
  };
  const arrastre = useArrastreGrid({ habilitado: fase === "revisar", grupoDe: () => "todo", onReorder: mover });
  const quitar = (id) => {
    if (esTexto) setTextos((t) => t.filter((x) => x.id !== id));
    else setPaginas((p) => { const q = p.find((x) => x.id === id); if (q) URL.revokeObjectURL(q.vista); return p.filter((x) => x.id !== id); });
  };
  const unirConSiguiente = (i) => setTextos((t) => i >= t.length - 1 ? t : [...t.slice(0, i), { ...t[i], texto: `${t[i].texto}\n${t[i + 1].texto}` }, ...t.slice(i + 2)]);

  const agregar = async () => {
    setError("");
    if (!esTexto) {
      setFase("subiendo");
      try {
        const subidas = [];
        for (let i = 0; i < paginas.length; i++) {
          setProgreso({ hechas: i, total: paginas.length, verbo: "Subiendo páginas" });
          subidas.push({ url: await subirPaginaPresentacion(iglesiaId, paginas[i].blob, `${nombre}-${i + 1}.jpg`) });
        }
        onImportar(itemsDeImportacion({ nombre, paginas: subidas, agrupar, nuevoId: () => crypto.randomUUID() }));
      } catch (e) {
        setError(`No se pudieron subir las páginas: ${e?.message || e}. Revisa el internet e intenta de nuevo.`);
        setFase("revisar");
        setProgreso(null);
      }
      return;
    }
    onImportar(itemsDeImportacion({ nombre, textos: textos.map((t) => t.texto.trim()).filter(Boolean), agrupar, nuevoId: () => crypto.randomUUID() }));
  };

  const ocupado = fase === "procesando" || fase === "subiendo";
  const boton = (props, contenido) => <button type="button" {...props} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled ? 0.5 : 1, ...props.style }}>{contenido}</button>;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div style={{ background: "var(--wf-card)", borderRadius: 18, width: "min(860px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.4)", fontFamily: "'Poppins', sans-serif", color: "var(--wf-text)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><FileUp size={17} color="var(--wf-brand-accent)" /><span style={{ fontWeight: 700, fontSize: 15 }}>Importar presentación</span></div>
          <button type="button" onClick={onClose} disabled={fase === "subiendo"} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--wf-muted)", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: "0 18px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {fase === "elegir" && (
            <>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setSobreZona(true); }}
                onDragLeave={() => setSobreZona(false)}
                onDrop={(e) => { e.preventDefault(); setSobreZona(false); procesar(e.dataTransfer.files); }}
                style={{ border: `2px dashed ${sobreZona ? "var(--wf-brand-accent)" : "var(--wf-border)"}`, background: sobreZona ? "var(--wf-active-bg)" : "var(--wf-hover)", borderRadius: 16, padding: "34px 16px", textAlign: "center", cursor: "pointer" }}
              >
                <FileUp size={30} color="var(--wf-brand-accent)" />
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>Arrastra el archivo aquí o toca para elegirlo</div>
                <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 4 }}>PDF, imágenes (PNG, JPG), Word (.docx) o texto (.txt)</div>
              </div>
              <input ref={inputRef} type="file" accept={ACEPTA} multiple hidden onChange={(e) => { procesar(e.target.files); e.target.value = ""; }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, margin: "14px 0 4px" }}>
                <div style={{ display: "flex", gap: 10, background: "var(--wf-hover)", borderRadius: 12, padding: 12 }}>
                  <Images size={18} color="#B15EA0" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 12, lineHeight: 1.45 }}><b>PDF o imágenes</b> — Canva, PowerPoint, Keynote o Google Slides exportados a PDF. Cada página se proyecta tal cual, con su propio diseño.</div>
                </div>
                <div style={{ display: "flex", gap: 10, background: "var(--wf-hover)", borderRadius: 12, padding: 12 }}>
                  <FileText size={18} color="#2F5FA8" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 12, lineHeight: 1.45 }}><b>Word o texto</b> — un bosquejo o puntos de la prédica. Se separa en diapositivas de texto que puedes corregir, con el estilo de la iglesia.</div>
                </div>
              </div>
            </>
          )}

          {ocupado && (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <Loader2 size={28} color="var(--wf-brand-accent)" style={{ animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 13, marginTop: 10 }}>{progreso ? `${progreso.verbo}… ${progreso.hechas} de ${progreso.total}` : "Leyendo el archivo…"}</div>
              <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
            </div>
          )}

          {fase === "revisar" && (
            <>
              <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>
                <b style={{ color: "var(--wf-text)" }}>{nombre}</b> · {elementos.length} diapositiva{elementos.length === 1 ? "" : "s"} · Arrastra para cambiar el orden{esTexto ? ", corrige el texto o une las que van juntas." : " y quita las que no vayas a usar."}
              </div>
              {esTexto && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12 }}>Separar:</span>
                  {[["bloque", "Por espacio entre párrafos"], ["parrafo", "Cada línea sola"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setModo(k)} style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: "5px 10px", cursor: "pointer", border: modo === k ? "2px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)" }}>{l}</button>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: esTexto ? "repeat(auto-fill, minmax(230px, 1fr))" : "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, paddingBottom: 6 }}>
                {elementos.map((el, i) => (
                  <div key={el.id} {...arrastre.itemProps(i)} style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "var(--wf-card)", boxShadow: "0 1px 5px rgba(22,50,79,0.16)", ...arrastre.estiloItem(i) }}>
                    <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a0e14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {esTexto
                        ? <span style={{ color: "#fff", fontSize: 11, padding: 10, textAlign: "center", whiteSpace: "pre-line", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }}>{el.texto}</span>
                        : <img src={el.vista} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />}
                      <span style={{ position: "absolute", top: 4, left: 6, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{i + 1}</span>
                      <button type="button" onClick={() => quitar(el.id)} title="Quitar" style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 7, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><Trash2 size={11} color="#FF8A80" /></button>
                    </div>
                    {esTexto && (
                      <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                        <textarea value={el.texto} onChange={(e) => setTextos((t) => t.map((x) => (x.id === el.id ? { ...x, texto: e.target.value } : x)))} rows={3} style={{ width: "100%", boxSizing: "border-box", fontSize: 12, fontFamily: "inherit", border: "1px solid var(--wf-border)", borderRadius: 8, padding: 6, resize: "vertical", background: "var(--wf-card)", color: "var(--wf-text)" }} />
                        {i < elementos.length - 1 && (
                          <button type="button" onClick={() => unirConSiguiente(i)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 600, border: "none", borderRadius: 8, padding: "4px 0", cursor: "pointer", background: "var(--wf-hover)", color: "var(--wf-text)" }}><Merge size={11} /> Unir con la siguiente</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {elementos.length === 0 && <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "16px 0", textAlign: "center" }}>No quedó ninguna diapositiva.</div>}
            </>
          )}

          {error && <div style={{ background: "rgba(194,59,50,0.1)", color: "#C23B32", borderRadius: 10, padding: "8px 10px", fontSize: 12, margin: "10px 0" }}>{error}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 18px 16px", borderTop: "1px solid var(--wf-divider)", flexWrap: "wrap" }}>
          <div style={{ fontSize: 11.5, color: "var(--wf-muted)", minWidth: 0, flex: "1 1 260px" }}>
            {fase === "revisar" && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 2 }}>
                <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} style={{ accentColor: "var(--wf-brand-accent)" }} />
                Agrupar en un bloque llamado "{nombre.replace(/\.[a-z0-9]+$/i, "")}"
              </label>
            )}
            {destino}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {fase === "revisar" && boton({ onClick: () => { setFase("elegir"); setTexto(null); setPaginas([]); setTextos([]); }, style: { background: "var(--wf-hover)", color: "var(--wf-text)" } }, "Otro archivo")}
            {boton({ onClick: agregar, disabled: fase !== "revisar" || elementos.length === 0, style: { background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)" } }, `Agregar al culto${elementos.length ? ` (${elementos.length})` : ""}`)}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
