import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileUp, Check, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cancionesDePdf } from "../lib/importarCancionesPdf.js";
import { textoACancion } from "../lib/textoCancion.js";
import { guardarCancionDesdeEditor } from "../lib/canciones.js";
import { subirAdjunto } from "../lib/adjuntosCancion.js";
import { parseChordLine, buildChordRow } from "../lib/musicTheory.js";

// Importar canciones desde PDF (pedido de Eldin, 2026-10-17). Se eligen uno o varios PDF (un PDF por
// canción o un cancionero con muchas); la app los lee, separa las canciones, pega cada acorde en su
// sílaba y arma partes y diapositivas. Antes de guardar se revisa todo: título, autor, tono, y la
// letra tal como quedó, por si algo hay que corregir.
const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export default function ImportarCancionesPdf({ library = [], clasificaciones = [], iglesiaId, userId, onCerrar, onImportadas }) {
  const inputRef = useRef(null);
  const [archivos, setArchivos] = useState([]); // [{ id, file, estado, error, canciones: [...] }]
  const [categoria, setCategoria] = useState(clasificaciones[0]?.clave || "corito");
  const [adjuntarOriginal, setAdjuntarOriginal] = useState(true);
  const [abierta, setAbierta] = useState(null); // clave de la canción que se está revisando
  const [guardando, setGuardando] = useState(null); // { hechas, total }
  const [terminado, setTerminado] = useState(null); // { ok, fallas }
  const existentes = new Set(library.map((s) => normalizar(s.title)));

  const elegir = async (files) => {
    const nuevos = [...files].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf").map((file) => ({ id: `${Date.now()}-${Math.random()}`, file, estado: "leyendo", canciones: [] }));
    if (!nuevos.length) return;
    setArchivos((a) => [...a, ...nuevos]);
    for (const n of nuevos) {
      try {
        const canciones = (await cancionesDePdf(n.file)).map((c, i) => ({
          clave: `${n.id}-${i}`, incluir: !existentes.has(normalizar(c.titulo)), existe: existentes.has(normalizar(c.titulo)),
          titulo: c.titulo, artista: c.artista, tonalidad: c.tonalidad || c.resultado.tonalidadSugerida || "", texto: c.texto, resultado: c.resultado,
        }));
        setArchivos((a) => a.map((x) => (x.id === n.id ? { ...x, estado: canciones.length ? "listo" : "error", error: canciones.length ? null : "No se encontró ninguna canción en este PDF.", canciones } : x)));
      } catch (e) {
        const msg = e?.message === "SIN_TEXTO"
          ? "Este PDF es una imagen escaneada (foto o escáner): no trae texto que se pueda leer. Hay que copiar la letra a mano o pegarla en la pestaña Escribir."
          : "No se pudo leer este PDF.";
        setArchivos((a) => a.map((x) => (x.id === n.id ? { ...x, estado: "error", error: msg } : x)));
      }
    }
  };

  const cambiar = (clave, patch) => setArchivos((a) => a.map((x) => ({ ...x, canciones: x.canciones.map((c) => {
    if (c.clave !== clave) return c;
    const sig = { ...c, ...patch };
    if ("texto" in patch) sig.resultado = textoACancion(patch.texto);
    if ("titulo" in patch) sig.existe = existentes.has(normalizar(patch.titulo));
    return sig;
  }) })));

  const todas = archivos.flatMap((a) => a.canciones.map((c) => ({ ...c, archivo: a })));
  const elegidas = todas.filter((c) => c.incluir && c.titulo.trim());
  const leyendo = archivos.some((a) => a.estado === "leyendo");

  const importar = async () => {
    setGuardando({ hechas: 0, total: elegidas.length });
    let ok = 0;
    const fallas = [];
    for (const c of elegidas) {
      try {
        const r = c.resultado;
        const draft = {
          title: c.titulo.trim(), artist: c.artista.trim() || "Unknown", key: c.tonalidad || r.tonalidadSugerida || "C",
          tempo: "", compas: "", themes: "", category: categoria, favorite: false,
          blocks: r.blocks, letra: r.letra, defaultStructure: r.defaultStructure,
        };
        const id = await guardarCancionDesdeEditor(draft, false, userId);
        // El PDF original queda adjunto a la canción (para verlo tal cual), solo si traía UNA canción.
        if (adjuntarOriginal && c.archivo.canciones.length === 1 && iglesiaId) {
          await subirAdjunto({ iglesiaId, cancionId: id, file: c.archivo.file, titulo: "PDF original" }).catch(() => {});
        }
        ok++;
      } catch {
        fallas.push(c.titulo);
      }
      setGuardando((g) => ({ ...g, hechas: g.hechas + 1 }));
    }
    setGuardando(null);
    setTerminado({ ok, fallas });
    onImportadas?.();
  };

  const C = { borde: "var(--wf-divider)" };
  const boton = { border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
  const campo = { border: "1px solid var(--wf-border)", borderRadius: 10, background: "var(--wf-bg)", color: "var(--wf-text)", padding: "7px 10px", fontSize: 14, fontFamily: "inherit", minWidth: 0 };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--wf-card)", color: "var(--wf-text)", width: "min(900px, 100%)", height: "min(92dvh, 100%)", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.borde}` }}>
          <FileUp size={20} color="var(--wf-brand-accent)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>Importar canciones desde PDF</div>
            <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>Un PDF por canción o un cancionero completo. Revisas todo antes de guardar.</div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: "var(--wf-hover)", border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--wf-text)" }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {terminado ? (
            <div style={{ textAlign: "center", padding: "50px 10px" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#1F8A7322", color: "#1F8A73", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Check size={28} /></div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{terminado.ok} {terminado.ok === 1 ? "canción importada" : "canciones importadas"}</div>
              {terminado.fallas.length > 0 && <div style={{ color: "#C23B32", fontSize: 13, marginTop: 8 }}>No se pudieron guardar: {terminado.fallas.join(", ")}</div>}
              <div style={{ color: "var(--wf-muted)", fontSize: 13, marginTop: 8 }}>Ya están en tu biblioteca. Si algún acorde quedó corrido, lo ajustas en la canción → Editar → Contenido.</div>
              <button onClick={onCerrar} style={{ ...boton, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", marginTop: 18 }}>Listo</button>
            </div>
          ) : (
            <>
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: "none" }} onChange={(e) => { elegir(e.target.files); e.target.value = ""; }} />
              <button onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); elegir(e.dataTransfer.files); }}
                style={{ width: "100%", border: "2px dashed var(--wf-brand-accent)", background: "color-mix(in srgb, var(--wf-brand-accent) 7%, transparent)", borderRadius: 16, padding: archivos.length ? "14px" : "34px 14px", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit", marginBottom: 16 }}>
                <FileUp size={archivos.length ? 18 : 30} color="var(--wf-brand-accent)" />
                <div style={{ fontWeight: 800, fontSize: archivos.length ? 14 : 16, marginTop: 6 }}>{archivos.length ? "Agregar más PDF" : "Elegir PDF de canciones"}</div>
                {!archivos.length && <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginTop: 4 }}>Puedes elegir varios a la vez, o arrastrarlos aquí. Funciona con PDF que traen texto (no fotos escaneadas).</div>}
              </button>

              {todas.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14, fontSize: 13 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Guardar en
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={campo}>
                      {(clasificaciones.length ? clasificaciones : [{ clave: "corito", nombre: "Corito" }]).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={adjuntarOriginal} onChange={(e) => setAdjuntarOriginal(e.target.checked)} /> Adjuntar el PDF original a cada canción
                  </label>
                </div>
              )}

              {archivos.map((a) => (
                <div key={a.id} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    {a.estado === "leyendo" && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                    {a.file.name}{a.estado === "listo" && a.canciones.length > 1 ? ` · ${a.canciones.length} canciones` : ""}
                  </div>
                  {a.estado === "leyendo" && <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Leyendo…</div>}
                  {a.estado === "error" && <div style={{ display: "flex", gap: 8, fontSize: 13, color: "#C23B32", background: "#C23B3214", borderRadius: 10, padding: "8px 10px" }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{a.error}</div>}
                  {a.canciones.map((c) => {
                    const partes = Object.keys(c.resultado.blocks).length;
                    const diaps = Object.values(c.resultado.letra).reduce((n, s) => n + s.length, 0);
                    const abiertaEsta = abierta === c.clave;
                    return (
                      <div key={c.clave} style={{ border: `1px solid ${C.borde}`, borderRadius: 14, padding: 10, marginBottom: 8, opacity: c.incluir ? 1 : 0.6, background: "var(--wf-card)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={c.incluir} onChange={(e) => cambiar(c.clave, { incluir: e.target.checked })} style={{ width: 18, height: 18 }} aria-label="Importar esta canción" />
                          <input value={c.titulo} onChange={(e) => cambiar(c.clave, { titulo: e.target.value })} placeholder="Título" style={{ ...campo, flex: "2 1 180px", fontWeight: 700 }} />
                          <input value={c.artista} onChange={(e) => cambiar(c.clave, { artista: e.target.value })} placeholder="Autor (opcional)" style={{ ...campo, flex: "1 1 130px" }} />
                          <input value={c.tonalidad} onChange={(e) => cambiar(c.clave, { tonalidad: e.target.value })} placeholder="Tono" style={{ ...campo, width: 64, flex: "0 0 64px" }} />
                          <button onClick={() => setAbierta(abiertaEsta ? null : c.clave)} style={{ ...boton, padding: "7px 12px", fontSize: 12.5, background: "var(--wf-hover)", color: "var(--wf-text)", display: "flex", alignItems: "center", gap: 4 }}>
                            Revisar {abiertaEsta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginTop: 6, paddingLeft: 26 }}>
                          {partes} {partes === 1 ? "parte" : "partes"} · {diaps} diapositivas
                          {c.existe && <span style={{ color: "#B58500", fontWeight: 700 }}> · Ya hay una canción con este título (no se importa, a menos que la marques)</span>}
                        </div>
                        {abiertaEsta && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
                            <textarea value={c.texto} onChange={(e) => cambiar(c.clave, { texto: e.target.value })} spellCheck={false}
                              style={{ ...campo, minHeight: 260, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.45, resize: "vertical" }} />
                            <div style={{ background: "var(--wf-bg)", borderRadius: 12, padding: 10, maxHeight: 420, overflowY: "auto" }}>
                              {Object.entries(c.resultado.blocks).map(([k, b]) => (
                                <div key={k} style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--wf-brand-accent)", marginBottom: 3 }}>{b.label}</div>
                                  {b.lines.map((l, i) => <VistaLinea key={i} linea={l} />)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {!terminado && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: `1px solid ${C.borde}`, background: "var(--wf-bg)" }}>
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--wf-muted)" }}>
              {guardando ? `Guardando ${guardando.hechas} de ${guardando.total}…` : todas.length ? `${elegidas.length} de ${todas.length} canciones marcadas` : ""}
            </span>
            <button onClick={onCerrar} style={{ ...boton, background: "transparent", color: "var(--wf-text)" }}>Cancelar</button>
            <button disabled={!elegidas.length || leyendo || !!guardando} onClick={importar}
              style={{ ...boton, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: !elegidas.length || leyendo || guardando ? 0.5 : 1 }}>
              {guardando ? "Importando…" : `Importar ${elegidas.length || ""}`.trim()}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Una línea con [acordes] dibujada como en la vista del músico: acordes arriba, letra abajo.
function VistaLinea({ linea }) {
  if (!String(linea).trim()) return <div style={{ height: 8 }} />;
  const { plain, positions } = parseChordLine(linea);
  const fila = positions.length ? buildChordRow(positions) : "";
  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.3, whiteSpace: "pre", overflowX: "auto" }}>
      {fila && <div style={{ color: "#1F8A73", fontWeight: 700 }}>{fila}</div>}
      <div>{plain || " "}</div>
    </div>
  );
}
