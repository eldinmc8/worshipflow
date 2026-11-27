// Repertorios (2026-11-26, lib/repertorios.js): listas fijas de canciones con nombre propio, sin evento
// ni fecha. Pestaña "Repertorios" en Canciones: la lista, el repertorio abierto (para ensayar como un
// álbum: tocar una canción abre el lector con Anterior/Siguiente dentro del repertorio), y para quien
// administra canciones crear, renombrar, agregar/quitar/ordenar canciones y compartir el enlace.
// ElegirRepertorio es la ventana "Agregar repertorio" del setlist de un culto.
import { useMemo, useState } from "react";
import { Radio, ListMusic, Plus, ChevronRight, ArrowLeft, Pencil, Trash2, ChevronUp, ChevronDown, X, Search, Check, Link2, Share2, Lock, Paperclip, Music, ArrowUpDown } from "lucide-react";
import { ModalShell, primaryBtn, inputStyle, iconGhost, BorrarBusqueda } from "../pantallas/compartido.jsx";
import { buscarCanciones } from "../lib/busqueda.js";
import { acordeEn } from "../lib/preferencias.js";
import { confirmDialog } from "../lib/confirm.js";
import { useCerrarConAtras } from "../lib/atras.js";
import { notifyError, showToast } from "../lib/toast.js";
import { NOTES } from "../lib/musicTheory.js";
import { usePlan, permite, abrirPlanes } from "../lib/planes.js";
import { cancionesDeRepertorio, idsDe, tonosDe, armarCanciones, ponerTono, agregarCanciones, quitarCancion, moverCancion, crearRepertorio, guardarRepertorio, borrarRepertorio, enlaceRepertorio, textoWhatsApp } from "../lib/repertorios.js";

const VERDE = "#1F8A73";
const chip = { fontSize: 11, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 20, padding: "3px 10px", color: "var(--wf-text-2)", flexShrink: 0 };
const botonSuave = { display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 10, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", color: "var(--wf-text)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const tarjeta = { display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" };

// Las 12 notas, en menor si la canción es menor (igual que el setlist: nunca cambia de mayor a menor).
function opcionesTono(original, actual) {
  const menor = (original || "").endsWith("m");
  const lista = NOTES.map((n) => (menor ? `${n}m` : n));
  return [original, actual].filter((k) => k && !lista.includes(k)).concat(lista);
}

const nCanciones = (n) => `${n} ${n === 1 ? "canción" : "canciones"}`;

export function RepertoriosPane({ repertorios, library, puedeEditar, bloqueado, onBloqueado, abiertoId, onAbrir, onCerrar, onAbrirCancion, onCambio }) {
  const abierto = abiertoId ? repertorios.find((r) => r.id === abiertoId) : null;
  const [editando, setEditando] = useState(null); // null | "nuevo" | repertorio
  if (abierto) {
    return <DetalleRepertorio rep={abierto} library={library} puedeEditar={puedeEditar} onCerrar={onCerrar} onAbrirCancion={onAbrirCancion} onCambio={onCambio} />;
  }
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--wf-muted)", lineHeight: 1.45 }}>
          Listas de canciones con nombre propio, sin fecha. Los músicos las abren para ensayar cuando quieran.
        </div>
        {puedeEditar && (
          <button onClick={() => (bloqueado ? onBloqueado() : setEditando("nuevo"))} style={{ ...botonSuave, background: "var(--wf-brand-accent)", border: "none", color: "var(--wf-on-brand-accent)", flexShrink: 0 }}>
            {bloqueado ? <Lock size={14} /> : <Plus size={15} />} Nuevo
          </button>
        )}
      </div>
      {repertorios.map((r) => {
        const n = cancionesDeRepertorio(r, library).length;
        return (
          <button key={r.id} onClick={() => (bloqueado ? onBloqueado() : onAbrir(r.id))} className="hoverable" style={tarjeta}>
            <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(31,138,115,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ListMusic size={20} color={VERDE} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nCanciones(n)}{r.descripcion ? ` · ${r.descripcion}` : ""}</span>
            </span>
            {bloqueado ? <Lock size={15} color="var(--wf-faint)" /> : <ChevronRight size={16} color="var(--wf-faint)" />}
          </button>
        );
      })}
      {repertorios.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--wf-faint)", fontSize: 13, padding: "36px 10px", lineHeight: 1.5 }}>
          Todavía no hay repertorios.{puedeEditar ? " Crea el primero con \"Nuevo\" (por ejemplo \"Lista 1 Alabanza\")." : " Quien administra las canciones puede crearlos."}
        </div>
      )}
      {editando && (
        <EditarRepertorio rep={editando === "nuevo" ? null : editando} onCerrar={() => setEditando(null)}
          onGuardado={(r) => { setEditando(null); onCambio?.(r); onAbrir(r.id); }} />
      )}
    </div>
  );
}

function DetalleRepertorio({ rep, library, puedeEditar, onCerrar, onAbrirCancion, onCambio }) {
  useCerrarConAtras(true, onCerrar); // atrás vuelve a la lista de repertorios
  const [editando, setEditando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [ordenando, setOrdenando] = useState(false);
  const canciones = cancionesDeRepertorio(rep, library);
  const tonos = tonosDe(rep);
  const modoMusicoPermitido = permite(usePlan(), "modo_musico");

  const guardarCanciones = async (lista) => {
    try { onCambio?.(await guardarRepertorio(rep.id, { canciones: lista })); } catch (e) { notifyError("No se pudo guardar el repertorio", e); }
  };
  const guardarIds = (ids) => guardarCanciones(armarCanciones(ids, tonosDe(rep))); // los tonos propios se quedan
  const cambiarTono = (song, tono) => guardarCanciones(ponerTono(rep, song.id, tono, song.key));
  const quitar = async (song) => {
    if (!(await confirmDialog(`¿Quitar "${song.title}" de este repertorio? La canción sigue en la biblioteca.`, { danger: true, textoConfirmar: "Quitar" }))) return;
    guardarIds(quitarCancion(idsDe(rep), song.id));
  };
  const borrar = async () => {
    if (!(await confirmDialog(`¿Borrar el repertorio "${rep.nombre}"? Las canciones siguen en la biblioteca.`, { danger: true, textoConfirmar: "Borrar" }))) return;
    try { await borrarRepertorio(rep.id); onCambio?.({ id: rep.id, borrado: true }); onCerrar(); showToast("Repertorio borrado.", "info"); } catch (e) { notifyError("No se pudo borrar el repertorio", e); }
  };

  return (
    <div>
      <button onClick={onCerrar} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 0", marginBottom: 10, fontSize: 13, fontWeight: 700, color: "var(--wf-brand-accent)", cursor: "pointer", fontFamily: "inherit" }}>
        <ArrowLeft size={15} /> Repertorios
      </button>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 21, margin: 0, wordBreak: "break-word" }}>{rep.nombre}</h3>
          <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginTop: 2 }}>{nCanciones(canciones.length)}{rep.descripcion ? ` · ${rep.descripcion}` : ""}</div>
        </div>
        {puedeEditar && (
          <>
            <button onClick={() => setEditando(true)} title="Cambiar nombre" aria-label="Cambiar nombre" style={{ ...iconGhost, width: 32, height: 32 }}><Pencil size={16} /></button>
            <button onClick={borrar} title="Borrar repertorio" aria-label="Borrar repertorio" style={{ ...iconGhost, width: 32, height: 32 }}><Trash2 size={16} color="#C23B32" /></button>
          </>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 14px" }}>
        {canciones.length > 0 && (
          <button onClick={() => onAbrirCancion(rep, canciones[0].id)} style={{ ...botonSuave, background: VERDE, border: "none", color: "#fff" }}>
            <Music size={14} /> Ensayar desde el inicio
          </button>
        )}
        {canciones.length > 0 && (
          <button onClick={() => (modoMusicoPermitido ? onAbrirCancion(rep, canciones[0].id, { modoMusico: true }) : abrirPlanes())}
            title={modoMusicoPermitido ? "Acordes con avance automático; al terminar una canción pasa sola a la siguiente" : "Modo Músico es parte de los planes Ministerio e Iglesia"}
            style={modoMusicoPermitido ? { ...botonSuave, background: "var(--wf-brand-accent)", border: "none", color: "var(--wf-on-brand-accent)" } : { ...botonSuave, borderStyle: "dashed", color: "var(--wf-muted)" }}>
            {modoMusicoPermitido ? <Radio size={14} /> : <Lock size={14} />} Modo Músico
          </button>
        )}
        {puedeEditar && <button onClick={() => setAgregando(true)} style={botonSuave}><Plus size={14} /> Agregar canciones</button>}
        {puedeEditar && canciones.length > 1 && (
          <button onClick={() => setOrdenando((v) => !v)} aria-pressed={ordenando} style={{ ...botonSuave, ...(ordenando ? { borderColor: "var(--wf-brand-accent)", color: "var(--wf-brand-accent)" } : {}) }}>
            {ordenando ? <Check size={14} /> : <ArrowUpDown size={14} />} {ordenando ? "Listo" : "Ordenar"}
          </button>
        )}
        <button onClick={() => setCompartiendo(true)} style={botonSuave}><Share2 size={14} /> Compartir</button>
      </div>
      {canciones.map((s, i) => (
        <div key={s.id} style={{ ...tarjeta, cursor: ordenando ? "default" : "pointer", padding: "12px 14px" }} className={ordenando ? undefined : "hoverable"}
          onClick={ordenando ? undefined : () => onAbrirCancion(rep, s.id)} role={ordenando ? undefined : "button"}>
          <span style={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 800, color: "var(--wf-faint)", flexShrink: 0 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{s.title}</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)" }}>{s.artist || "Unknown"}</span>
          </span>
          {s.hasAttachment && !ordenando && <Paperclip size={14} color="var(--wf-faint)" />}
          {!ordenando && (puedeEditar ? (
            <select value={tonos[s.id] || s.key} onClick={(e) => e.stopPropagation()} onChange={(e) => cambiarTono(s, e.target.value)}
              title="Tono en este repertorio (la canción no cambia)" aria-label={`Tono de ${s.title} en este repertorio`}
              style={{ ...chip, padding: "3px 4px", cursor: "pointer", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: tonos[s.id] ? "var(--wf-brand-accent)" : VERDE, borderColor: tonos[s.id] ? "var(--wf-brand-accent)" : "var(--wf-border)" }}>
              {opcionesTono(s.key, tonos[s.id]).map((k) => <option key={k} value={k}>{acordeEn(k)}{k === s.key ? " (original)" : ""}</option>)}
            </select>
          ) : (
            <span title={tonos[s.id] ? `Original ${acordeEn(s.key)}` : undefined} style={{ ...chip, color: tonos[s.id] ? "var(--wf-brand-accent)" : VERDE, fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(tonos[s.id] || s.key)}</span>
          ))}
          {ordenando && (
            <>
              <button onClick={() => guardarIds(moverCancion(idsDe(rep), s.id, -1))} disabled={i === 0} aria-label="Subir" style={{ ...iconGhost, width: 32, height: 32, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={18} /></button>
              <button onClick={() => guardarIds(moverCancion(idsDe(rep), s.id, 1))} disabled={i === canciones.length - 1} aria-label="Bajar" style={{ ...iconGhost, width: 32, height: 32, opacity: i === canciones.length - 1 ? 0.3 : 1 }}><ChevronDown size={18} /></button>
              <button onClick={() => quitar(s)} aria-label="Quitar del repertorio" style={{ ...iconGhost, width: 32, height: 32 }}><X size={17} color="#C23B32" /></button>
            </>
          )}
        </div>
      ))}
      {canciones.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--wf-faint)", fontSize: 13, padding: "30px 10px" }}>
          {puedeEditar ? "Este repertorio está vacío. Toca \"Agregar canciones\"." : "Este repertorio todavía no tiene canciones."}
        </div>
      )}
      {editando && <EditarRepertorio rep={rep} onCerrar={() => setEditando(false)} onGuardado={(r) => { setEditando(false); onCambio?.(r); }} />}
      {agregando && (
        <ElegirCanciones library={library} yaEstan={idsDe(rep)} onCerrar={() => setAgregando(false)}
          onElegir={async (ids) => { setAgregando(false); await guardarIds(agregarCanciones(idsDe(rep), ids)); showToast(ids.length === 1 ? "Se agregó 1 canción." : `Se agregaron ${ids.length} canciones.`, "info"); }} />
      )}
      {compartiendo && <CompartirRepertorio rep={rep} onCerrar={() => setCompartiendo(false)} />}
    </div>
  );
}

function EditarRepertorio({ rep, onCerrar, onGuardado }) {
  const [nombre, setNombre] = useState(rep?.nombre || "");
  const [descripcion, setDescripcion] = useState(rep?.descripcion || "");
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    try {
      const r = rep ? await guardarRepertorio(rep.id, { nombre, descripcion }) : await crearRepertorio({ nombre, descripcion });
      onGuardado(r);
    } catch (e) {
      notifyError("No se pudo guardar el repertorio", e);
      setGuardando(false);
    }
  };
  return (
    <ModalShell title={rep ? "Cambiar nombre" : "Nuevo repertorio"} icon={ListMusic} color={VERDE} onClose={onCerrar}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4 }} htmlFor="wf-rep-nombre">Nombre</label>
      <input id="wf-rep-nombre" autoFocus value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
        placeholder="Ej. Lista 1 Alabanza" style={{ ...inputStyle, marginBottom: 12, fontSize: 14 }} />
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4 }} htmlFor="wf-rep-desc">Nota (opcional)</label>
      <input id="wf-rep-desc" value={descripcion} maxLength={300} onChange={(e) => setDescripcion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
        placeholder="Ej. Para los que van llegando al grupo" style={{ ...inputStyle, marginBottom: 16 }} />
      <button onClick={guardar} disabled={!nombre.trim() || guardando} style={{ ...primaryBtn, opacity: nombre.trim() ? 1 : 0.5 }}>
        {guardando ? "Guardando…" : rep ? "Guardar" : "Crear y agregar canciones"}
      </button>
    </ModalShell>
  );
}

// Buscar y marcar varias canciones de la biblioteca (las que ya están salen marcadas y apagadas).
function ElegirCanciones({ library, yaEstan, onCerrar, onElegir }) {
  const [query, setQuery] = useState("");
  const [marcadas, setMarcadas] = useState(() => []);
  const ya = useMemo(() => new Set(yaEstan), [yaEstan]);
  const orden = useMemo(() => (library || []).slice().sort((a, b) => (a.title || "").localeCompare(b.title || "", "es", { sensitivity: "base", numeric: true })), [library]);
  const lista = useMemo(() => (query.trim() ? buscarCanciones(orden, query) : orden), [orden, query]);
  const alternar = (id) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  return (
    <ModalShell alto title="Agregar canciones" icon={Music} color={VERDE} onClose={onCerrar}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 10px", marginBottom: 10, flexShrink: 0 }}>
        <Search size={13} color="var(--wf-faint)" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 13, width: "100%" }} />
        <BorrarBusqueda valor={query} onBorrar={() => setQuery("")} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>
        {lista.map((s) => {
          const esta = ya.has(s.id);
          const marcada = esta || marcadas.includes(s.id);
          return (
            <button key={s.id} disabled={esta} onClick={() => alternar(s.id)} className={esta ? undefined : "hoverable"}
              style={{ width: "100%", textAlign: "left", padding: "10px", marginBottom: 6, borderRadius: 12, background: marcada && !esta ? "var(--wf-active-bg)" : "transparent", border: marcada && !esta ? `1px solid ${VERDE}` : "1px solid var(--wf-border)", cursor: esta ? "default" : "pointer", opacity: esta ? 0.55 : 1, display: "flex", alignItems: "center", gap: 10, color: "var(--wf-text)", fontFamily: "inherit" }}>
              <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: marcada ? VERDE : "transparent", border: marcada ? "none" : "1.5px solid var(--wf-faint)" }}>
                {marcada && <Check size={15} color="#fff" strokeWidth={3} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{s.title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--wf-muted)" }}>{esta ? "Ya está en el repertorio" : s.artist || "Unknown"}</span>
              </span>
              <span style={{ ...chip, color: VERDE, fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(s.key)}</span>
            </button>
          );
        })}
        {lista.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13, padding: "10px 2px" }}>No hay canciones que coincidan.</div>}
      </div>
      <button onClick={() => onElegir(marcadas)} disabled={!marcadas.length} style={{ ...primaryBtn, marginTop: 10, flexShrink: 0, opacity: marcadas.length ? 1 : 0.5 }}>
        {marcadas.length ? `Agregar ${nCanciones(marcadas.length)}` : "Marca las canciones"}
      </button>
    </ModalShell>
  );
}

function CompartirRepertorio({ rep, onCerrar }) {
  const enlace = enlaceRepertorio(rep.id);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); showToast("Enlace copiado.", "info"); } catch { showToast("No se pudo copiar. Mantén presionado el enlace para copiarlo.", "info"); }
  };
  return (
    <ModalShell title="Compartir repertorio" icon={Share2} color={VERDE} onClose={onCerrar}>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--wf-text-2)", margin: "0 0 12px" }}>
        Mándale este enlace a quien va a ensayar. Lo abre con su cuenta de WorshipFlow: solo lo ven los miembros de tu iglesia.
      </p>
      <div style={{ ...inputStyle, fontSize: 12.5, wordBreak: "break-all", userSelect: "all", marginBottom: 12 }}>{enlace}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={copiar} style={{ ...primaryBtn, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Link2 size={15} /> Copiar</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp(rep, enlace))}`} target="_blank" rel="noreferrer"
          style={{ ...primaryBtn, flex: 1, background: "#25D366", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxSizing: "border-box" }}>
          <Share2 size={15} /> WhatsApp
        </a>
      </div>
    </ModalShell>
  );
}

// "Agregar repertorio" en el setlist de un culto: elegir uno, quitar la marca de los que no van, agregar.
export function ElegirRepertorio({ repertorios, library, onCerrar, onAgregar }) {
  const [rep, setRep] = useState(null);
  const [desmarcadas, setDesmarcadas] = useState(() => new Set());
  const canciones = rep ? cancionesDeRepertorio(rep, library) : [];
  const elegidas = canciones.filter((s) => !desmarcadas.has(s.id));
  const alternar = (id) => setDesmarcadas((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <ModalShell alto title={rep ? "Elige las canciones" : "Agregar repertorio"} icon={ListMusic} color={VERDE} onClose={onCerrar}>
      {!rep && (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>
          <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginBottom: 8 }}>Elige un repertorio. Sus canciones entran a este culto de un solo.</div>
          {repertorios.map((r) => {
            const n = cancionesDeRepertorio(r, library).length;
            return (
              <button key={r.id} disabled={!n} onClick={() => { setRep(r); setDesmarcadas(new Set()); }} className="hoverable"
                style={{ width: "100%", textAlign: "left", padding: "11px 10px", marginBottom: 6, borderRadius: 12, background: "transparent", border: "1px solid var(--wf-border)", cursor: n ? "pointer" : "default", opacity: n ? 1 : 0.5, display: "flex", alignItems: "center", gap: 10, color: "var(--wf-text)", fontFamily: "inherit" }}>
                <ListMusic size={17} color={VERDE} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{r.nombre}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)" }}>{nCanciones(n)}</span>
                </span>
                <ChevronRight size={16} color="var(--wf-faint)" />
              </button>
            );
          })}
          {repertorios.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13, padding: "10px 2px", lineHeight: 1.5 }}>Todavía no hay repertorios. Se crean en Canciones → Repertorios.</div>}
        </div>
      )}
      {rep && (
        <>
          <button onClick={() => setRep(null)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 0", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: "var(--wf-brand-accent)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <ArrowLeft size={14} /> Otros repertorios
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, flexShrink: 0 }}>{rep.nombre}</div>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 8, flexShrink: 0 }}>Quita la marca de las que no van.</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>
            {canciones.map((s) => {
              const marcada = !desmarcadas.has(s.id);
              return (
                <button key={s.id} onClick={() => alternar(s.id)} className="hoverable"
                  style={{ width: "100%", textAlign: "left", padding: "10px", marginBottom: 6, borderRadius: 12, background: marcada ? "var(--wf-active-bg)" : "transparent", border: marcada ? `1px solid ${VERDE}` : "1px solid var(--wf-border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "var(--wf-text)", fontFamily: "inherit" }}>
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: marcada ? VERDE : "transparent", border: marcada ? "none" : "1.5px solid var(--wf-faint)" }}>
                    {marcada && <Check size={15} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{s.title}</span>
                  <span style={{ ...chip, color: tonosDe(rep)[s.id] ? "var(--wf-brand-accent)" : VERDE, fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(tonosDe(rep)[s.id] || s.key)}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => onAgregar(elegidas.map((s) => s.id), rep)} disabled={!elegidas.length} style={{ ...primaryBtn, marginTop: 10, flexShrink: 0, opacity: elegidas.length ? 1 : 0.5 }}>
            {elegidas.length ? `Agregar ${nCanciones(elegidas.length)} a este culto` : "Marca al menos una canción"}
          </button>
        </>
      )}
    </ModalShell>
  );
}
