import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Globe, Search, Check, AlertTriangle, ArrowLeft, Loader2, ExternalLink, ChevronRight } from "lucide-react";
import { resultadosDeLaCuerda, cancionDeLaCuerda, enlacesDeBusqueda } from "../lib/cancionesWeb.js";
import { textoACancion } from "../lib/textoCancion.js";
import { guardarCancionDesdeEditor } from "../lib/canciones.js";
import { callUsersFunction } from "../lib/supabaseClient.js";
import { VistaLinea } from "./ImportarCancionesPdf.jsx";

// Buscar canciones en internet (pedido de Eldin, 2026-11-11): se escribe el título (o título y
// artista), salen las canciones de LaCuerda.net, se elige una y entra con su letra y sus acordes ya
// puestos en cada sílaba. Antes de guardar se revisa igual que al importar un PDF. La parte que
// entiende las páginas del sitio está en lib/cancionesWeb.js.
const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export default function BuscarCancionWeb({ library = [], clasificaciones = [], userId, onCerrar, onImportadas }) {
  const [q, setQ] = useState("");
  const [buscado, setBuscado] = useState(""); // lo último que se buscó
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null); // null = todavía no se busca
  const [error, setError] = useState(null);
  const [abriendo, setAbriendo] = useState(null); // "ruta#version" de la canción que se está trayendo
  const [borrador, setBorrador] = useState(null); // { ruta, version, versiones, titulo, artista, tonalidad, texto, resultado }
  const [categoria, setCategoria] = useState(clasificaciones[0]?.clave || "corito");
  const [guardando, setGuardando] = useState(false);
  const [agregadas, setAgregadas] = useState([]); // títulos (normalizados) agregados en esta visita
  // Al pasar de la lista a la canción (o de vuelta) se empieza desde arriba.
  const cuerpoRef = useRef(null);
  const viendo = borrador ? `${borrador.ruta}#${borrador.version}` : "";
  useEffect(() => { if (cuerpoRef.current) cuerpoRef.current.scrollTop = 0; }, [viendo]);
  const existentes = new Set([...library.map((s) => normalizar(s.title)), ...agregadas]);

  const buscar = async (e) => {
    e?.preventDefault();
    const texto = q.trim();
    if (texto.length < 2 || buscando) return;
    setBuscando(true); setError(null);
    try {
      const { html } = await callUsersFunction("buscar-cancion-web", { accion: "buscar", q: texto });
      setResultados(resultadosDeLaCuerda(html));
      setBuscado(texto);
    } catch (err) {
      setError(err.message || "No se pudo buscar.");
    }
    setBuscando(false);
  };

  const abrir = async (r, version) => {
    if (abriendo) return;
    setAbriendo(`${r.ruta}#${version}`); setError(null);
    try {
      const { html } = await callUsersFunction("buscar-cancion-web", { accion: "cancion", ruta: r.ruta, version });
      const c = cancionDeLaCuerda(html);
      if (!c) throw new Error("No se pudo leer esa canción. Prueba con otra versión.");
      const resultado = textoACancion(c.texto);
      setBorrador({ ruta: r.ruta, version, versiones: r.versiones, titulo: c.titulo || r.titulo, artista: c.artista || r.artista, tonalidad: resultado.tonalidadSugerida || "", texto: c.texto, resultado });
    } catch (err) {
      setError(err.message || "No se pudo abrir esa canción.");
    }
    setAbriendo(null);
  };

  const cambiar = (patch) => setBorrador((b) => ({ ...b, ...patch, ...("texto" in patch ? { resultado: textoACancion(patch.texto) } : {}) }));

  const guardar = async () => {
    const b = borrador;
    if (!b.titulo.trim() || guardando) return;
    setGuardando(true); setError(null);
    try {
      const r = b.resultado;
      await guardarCancionDesdeEditor({
        title: b.titulo.trim(), artist: b.artista.trim() || "Unknown", key: b.tonalidad.trim() || r.tonalidadSugerida || "C",
        tempo: "", compas: "", themes: "", category: categoria, favorite: false,
        blocks: r.blocks, letra: r.letra, defaultStructure: r.defaultStructure,
      }, false, userId);
      setAgregadas((a) => [...a, normalizar(b.titulo)]);
      setBorrador(null);
      onImportadas?.();
    } catch {
      setError("No se pudo guardar la canción. Revisa tu conexión e intenta de nuevo.");
    }
    setGuardando(false);
  };

  const boton = { border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" };
  const campo = { border: "1px solid var(--wf-border)", borderRadius: 10, background: "var(--wf-bg)", color: "var(--wf-text)", padding: "7px 10px", fontSize: 14, fontFamily: "inherit", minWidth: 0 };
  const pildora = { border: "1px solid var(--wf-border)", borderRadius: 999, background: "var(--wf-bg)", color: "var(--wf-text)", padding: "5px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const avisoError = error && (
    <div role="alert" style={{ display: "flex", gap: 8, fontSize: 13, color: "#C23B32", background: "#C23B3214", borderRadius: 10, padding: "8px 10px", marginBottom: 12 }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
    </div>
  );
  const partes = borrador ? Object.keys(borrador.resultado.blocks).length : 0;
  const diaps = borrador ? Object.values(borrador.resultado.letra).reduce((n, s) => n + s.length, 0) : 0;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,10,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--wf-card)", color: "var(--wf-text)", width: "min(900px, 100%)", height: "min(92dvh, 100%)", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--wf-divider)" }}>
          {borrador
            ? <button onClick={() => { setBorrador(null); setError(null); }} aria-label="Volver a los resultados" style={{ background: "var(--wf-hover)", border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--wf-text)", flexShrink: 0 }}><ArrowLeft size={18} /></button>
            : <Globe size={20} color="var(--wf-brand-accent)" style={{ flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 19, fontWeight: 600 }}>{borrador ? "Revisar antes de agregar" : "Buscar canción en internet"}</div>
            <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>{borrador ? "Corrige lo que haga falta; después la sigues editando como cualquier canción." : "Letra y acordes desde LaCuerda.net, directo a tu biblioteca."}</div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: "var(--wf-hover)", border: "none", borderRadius: 10, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--wf-text)", flexShrink: 0 }}><X size={18} /></button>
        </div>

        <div ref={cuerpoRef} style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {borrador ? (
            <>
              {avisoError}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <input value={borrador.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} placeholder="Título" aria-label="Título" style={{ ...campo, flex: "2 1 180px", fontWeight: 700 }} />
                <input value={borrador.artista} onChange={(e) => cambiar({ artista: e.target.value })} placeholder="Autor (opcional)" aria-label="Autor" style={{ ...campo, flex: "1 1 130px" }} />
                <input value={borrador.tonalidad} onChange={(e) => cambiar({ tonalidad: e.target.value })} placeholder="Tono" aria-label="Tono" style={{ ...campo, width: 64, flex: "0 0 64px" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", margin: "10px 0", fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Guardar en
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={campo}>
                    {(clasificaciones.length ? clasificaciones : [{ clave: "corito", nombre: "Corito" }]).map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
                  </select>
                </label>
                {borrador.versiones.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>Versión
                    {borrador.versiones.map((v) => (
                      <button key={v} disabled={!!abriendo} onClick={() => v !== borrador.version && abrir(borrador, v)}
                        style={{ ...pildora, ...(v === borrador.version ? { background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", borderColor: "transparent" } : {}) }}>
                        {abriendo === `${borrador.ruta}#${v}` ? "…" : v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 8 }}>
                {partes} {partes === 1 ? "parte" : "partes"} · {diaps} diapositivas
                {existentes.has(normalizar(borrador.titulo)) && <span style={{ color: "#B58500", fontWeight: 700 }}> · Ya tienes una canción con este título</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
                <textarea value={borrador.texto} onChange={(e) => cambiar({ texto: e.target.value })} spellCheck={false} aria-label="Letra con acordes"
                  style={{ ...campo, minHeight: 300, fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, lineHeight: 1.45, resize: "vertical", whiteSpace: "pre", overflowX: "auto" }} />
                <div style={{ background: "var(--wf-bg)", borderRadius: 12, padding: 10, maxHeight: 460, overflowY: "auto" }}>
                  {Object.entries(borrador.resultado.blocks).map(([k, b]) => (
                    <div key={k} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--wf-brand-accent)", marginBottom: 3 }}>{b.label}</div>
                      {b.lines.map((l, i) => <VistaLinea key={i} linea={l} />)}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 10 }}>
                En el cuadro de texto está la canción como viene del sitio; en la vista con colores, cómo queda en la app. Para nombrar una parte escribe <b>Coro</b> o <b>Estrofa 2</b> en su propio renglón; un renglón vacío corta la diapositiva.
              </div>
            </>
          ) : (
            <>
              <form onSubmit={buscar} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 14, padding: "0 14px", minWidth: 0 }}>
                  <Search size={16} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, o título y artista" aria-label="Buscar canción" enterKeyHint="search"
                    style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 15, width: "100%", height: 44, fontFamily: "inherit" }} />
                </div>
                <button type="submit" disabled={q.trim().length < 2 || buscando} style={{ ...boton, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: q.trim().length < 2 || buscando ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  {buscando ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}{buscando ? "Buscando" : "Buscar"}
                </button>
              </form>
              {avisoError}

              {resultados === null && !buscando && (
                <div style={{ textAlign: "center", color: "var(--wf-muted)", fontSize: 13.5, padding: "36px 10px" }}>
                  <Globe size={30} color="var(--wf-brand-accent)" />
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--wf-text)", marginTop: 8 }}>Escribe el nombre de la canción</div>
                  <div style={{ marginTop: 4 }}>Por ejemplo: <i>Cuán grande es Él</i>, o <i>Renuévame Marcos Witt</i>.</div>
                </div>
              )}
              {resultados?.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--wf-muted)", fontSize: 13.5, padding: "26px 10px" }}>
                  No encontré “{buscado}” en LaCuerda. Prueba con menos palabras o sin el artista.
                </div>
              )}
              {resultados?.map((r) => {
                const ya = existentes.has(normalizar(r.titulo));
                const cargando = abriendo?.startsWith(`${r.ruta}#`);
                return (
                  <div key={r.ruta} style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--wf-divider)" }}>
                    <button onClick={() => abrir(r, r.versiones[0])} disabled={!!abriendo}
                      style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", padding: "11px 2px", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.titulo}</div>
                      <div style={{ fontSize: 12.5, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.artista}{r.versiones.length > 1 ? ` · ${r.versiones.length} versiones` : ""}
                      </div>
                      {ya && <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#1F8A73", fontWeight: 700, marginTop: 2 }}><Check size={12} /> Ya la tienes</div>}
                    </button>
                    {cargando ? <Loader2 size={17} color="var(--wf-muted)" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} /> : <ChevronRight size={17} color="var(--wf-faint)" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}

              {(resultados !== null || error) && (
                <div style={{ marginTop: 18, background: "var(--wf-bg)", borderRadius: 14, padding: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{resultados === null ? "Mientras tanto" : "¿No está la que buscas?"}</div>
                  <div style={{ color: "var(--wf-muted)", marginBottom: 8 }}>Búscala en otro sitio, copia la letra (con o sin acordes) y pégala en <b>+ Nueva canción → Escribir</b>: la app acomoda los acordes sola.</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {enlacesDeBusqueda(buscado || q).map((s) => (
                      <a key={s.nombre} href={s.url} target="_blank" rel="noopener noreferrer" style={{ ...pildora, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {s.nombre} <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--wf-divider)", background: "var(--wf-bg)" }}>
          <span style={{ flex: 1, fontSize: 11.5, color: "var(--wf-muted)", minWidth: 0 }}>
            {borrador
              ? "Los acordes los suben usuarios de LaCuerda.net: revísalos antes del culto."
              : agregadas.length ? `${agregadas.length} ${agregadas.length === 1 ? "canción agregada" : "canciones agregadas"} a tu biblioteca` : "Las letras tienen derechos de autor: proyéctalas con la licencia de tu iglesia."}
          </span>
          {borrador ? (
            <button disabled={!borrador.titulo.trim() || guardando} onClick={guardar}
              style={{ ...boton, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: !borrador.titulo.trim() || guardando ? 0.5 : 1, flexShrink: 0 }}>
              {guardando ? "Guardando…" : "Agregar a la biblioteca"}
            </button>
          ) : (
            <button onClick={onCerrar} style={{ ...boton, background: "var(--wf-hover)", color: "var(--wf-text)", flexShrink: 0 }}>{agregadas.length ? "Listo" : "Cerrar"}</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
