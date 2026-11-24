import { useMemo, useState } from "react";
import { ListMusic, ChevronUp, ChevronDown, X, Plus, Repeat, Search, ArrowLeft, RotateCcw } from "lucide-react";
import { ModalShell, primaryBtn, BorrarBusqueda } from "../pantallas/compartido.jsx";
import { badgeColor } from "../pantallas/canciones.jsx";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { buscarCanciones } from "../lib/busqueda.js";
import { distintivoDe } from "../lib/textoCancion.js";
import { acordeEn } from "../lib/preferencias.js";
import {
  cancionParaElEvento, ordenInicial, ordenEventoDe, esIgualAlOriginal, claveDeOtra, leerClaveOtra,
  moverParte, quitarParte, repetirAqui, agregarAlFinal,
} from "../lib/ordenEvento.js";

// "Orden para este culto" (2026-11-24, ver lib/ordenEvento.js): el director acomoda las partes de una
// canción como se ensayaron, y puede sumar una parte de otra canción (mezclas), sin tocar el cancionero.
// Sirve en el celular y en la computadora: solo se ordenan partes, no se editan diapositivas.

const TOQUE = 40;
const etiqueta = { fontSize: 11.5, fontWeight: 800, color: "var(--wf-muted)", letterSpacing: 0.5, margin: "16px 0 8px", display: "flex", alignItems: "center", gap: 6 };
const dist = (b) => b?.badge || distintivoDe(b?.label || "");

function Distintivo({ b }) {
  return <span style={{ minWidth: 28, height: 28, padding: "0 6px", boxSizing: "border-box", borderRadius: 14, background: badgeColor(dist(b)), color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{dist(b)}</span>;
}

function BotonIcono({ etiqueta: et, onClick, disabled, color = "var(--wf-muted)", children }) {
  return (
    <button type="button" aria-label={et} title={et} onClick={onClick} disabled={disabled}
      style={{ width: 34, height: 34, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 10, background: "transparent", color, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.25 : 1 }}>
      {children}
    </button>
  );
}

const chip = { minHeight: 36, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px 0 5px", borderRadius: 18, border: "1px solid var(--wf-divider)", background: "var(--wf-card)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--wf-text)", fontFamily: "inherit" };

export default function OrdenCancionEvento({ song, item, library, onGuardar, onCerrar }) {
  const [orden, setOrden] = useState(() => ordenInicial(song, item));
  const [buscandoOtra, setBuscandoOtra] = useState(false);
  const [query, setQuery] = useState("");
  const [otraElegida, setOtraElegida] = useState(null);
  // La canción con el orden que se está armando: trae los nombres de las partes de otras canciones.
  const vista = useMemo(() => cancionParaElEvento(song, { ordenEvento: orden }, library), [song, orden, library]);
  const bloques = vista?.blocks || song.blocks || {};
  const visibles = orden.filter((k) => bloques[k]);
  const propias = Object.keys(song.blocks || {});
  // Partes de otras canciones que ya están en el orden: para volver a agregarlas con un toque.
  const prestadas = [...new Set(visibles.filter((k) => leerClaveOtra(k)))];
  const teniaEspecial = !!ordenEventoDe(item);
  const arrastre = useArrastreLista({ habilitado: true, onReorder: (desde, destino) => setOrden((o) => moverParte(o, desde, destino)) });

  const otras = useMemo(() => {
    const lista = (library || []).filter((s) => s.id !== song.id && Object.keys(s.blocks || {}).length > 0)
      .sort((a, b) => (a.title || "").localeCompare(b.title || "", "es", { sensitivity: "base" }));
    return buscarCanciones(lista, query);
  }, [library, song.id, query]);

  const guardar = () => {
    if (!visibles.length) return;
    onGuardar(esIgualAlOriginal(song, visibles) ? null : visibles);
  };

  return (
    <ModalShell title="Orden para este culto" icon={ListMusic} color="#1F8A73" onClose={onCerrar}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{song.title}</div>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 2, lineHeight: 1.45 }}>
        Solo para este evento. La canción del cancionero no cambia.
      </div>

      <div style={etiqueta}><ListMusic size={13} /> ASÍ SE VA A CANTAR</div>
      {visibles.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--wf-faint)", fontSize: 13, padding: "18px 10px", background: "var(--wf-hover)", borderRadius: 12 }}>No hay partes. Agrega al menos una abajo.</div>
      ) : (
        <div>
          {visibles.map((k, idx) => {
            const b = bloques[k];
            return (
              <div key={`${k}-${idx}`} {...arrastre.filaProps(idx)} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 12, padding: "4px 4px 4px 8px", marginBottom: 6, minHeight: TOQUE + 4, ...arrastre.estiloFila(idx) }}>
                <span style={{ width: 16, fontSize: 11.5, color: "var(--wf-faint)", fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{idx + 1}</span>
                <Distintivo b={b} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.25, overflowWrap: "anywhere" }}>{b.label}</span>
                <BotonIcono etiqueta={`Repetir ${b.label}`} onClick={() => setOrden((o) => repetirAqui(o, idx))} color="#1F8A73"><Repeat size={15} /></BotonIcono>
                <BotonIcono etiqueta={`Subir ${b.label}`} onClick={() => setOrden((o) => moverParte(o, idx, idx - 1))} disabled={idx === 0}><ChevronUp size={17} /></BotonIcono>
                <BotonIcono etiqueta={`Bajar ${b.label}`} onClick={() => setOrden((o) => moverParte(o, idx, idx + 1))} disabled={idx === visibles.length - 1}><ChevronDown size={17} /></BotonIcono>
                <BotonIcono etiqueta={`Quitar ${b.label}`} onClick={() => setOrden((o) => quitarParte(o, idx))} color="#C23B32"><X size={16} /></BotonIcono>
              </div>
            );
          })}
          {visibles.length > 1 && <div style={{ fontSize: 11.5, color: "var(--wf-faint)", marginTop: 2 }}>Usa las flechas o mantén presionada una parte y arrástrala.</div>}
        </div>
      )}

      <div style={etiqueta}><Plus size={13} /> AGREGAR AL FINAL</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[...propias, ...prestadas].map((k) => (
          <button key={k} type="button" onClick={() => setOrden((o) => agregarAlFinal(o, k))} className="hoverable" style={chip}>
            <Distintivo b={bloques[k]} /> {bloques[k].label}
          </button>
        ))}
      </div>

      {!buscandoOtra ? (
        <button type="button" onClick={() => setBuscandoOtra(true)} className="hoverable"
          style={{ marginTop: 10, width: "100%", minHeight: TOQUE, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: "1.5px dashed var(--wf-border)", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", color: "var(--wf-text-2)" }}>
          <Plus size={15} /> Parte de otra canción
        </button>
      ) : (
        <div style={{ marginTop: 10, background: "var(--wf-hover)", borderRadius: 12, padding: 10 }}>
          {otraElegida ? (
            <>
              <button type="button" onClick={() => setOtraElegida(null)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, marginBottom: 8, fontSize: 12, fontWeight: 700, color: "#2F5FA8", cursor: "pointer", fontFamily: "inherit" }}><ArrowLeft size={13} /> Otra canción</button>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{otraElegida.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 8 }}>Toca la parte que quieres agregar al final.{otraElegida.key && song.key && otraElegida.key !== song.key ? ` Sus acordes pasan de ${acordeEn(otraElegida.key)} a ${acordeEn(song.key)}.` : ""}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(otraElegida.blocks || {}).map(([k, b]) => (
                  <button key={k} type="button" onClick={() => { setOrden((o) => agregarAlFinal(o, claveDeOtra(otraElegida.id, k))); setOtraElegida(null); setBuscandoOtra(false); setQuery(""); }} className="hoverable" style={chip}>
                    <Distintivo b={b} /> {b.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "7px 10px", marginBottom: 8 }}>
                <Search size={13} color="var(--wf-faint)" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." aria-label="Buscar canción" style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 16, width: "100%" }} />
                <BorrarBusqueda valor={query} onBorrar={() => setQuery("")} />
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {otras.length === 0 && <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: 6 }}>No se encontró ninguna canción.</div>}
                {otras.slice(0, 60).map((s) => (
                  <button key={s.id} type="button" onClick={() => setOtraElegida(s)} className="hoverable"
                    style={{ width: "100%", textAlign: "left", padding: "8px 10px", marginBottom: 4, borderRadius: 10, border: "none", background: "var(--wf-card)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--wf-text)" }}>
                    {s.title}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => { setBuscandoOtra(false); setQuery(""); }} style={{ marginTop: 6, background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            </>
          )}
        </div>
      )}

      <button type="button" onClick={guardar} disabled={!visibles.length} style={{ ...primaryBtn, width: "100%", marginTop: 16, opacity: visibles.length ? 1 : 0.5 }}>Guardar</button>
      {teniaEspecial && (
        <button type="button" onClick={() => onGuardar(null)} className="hoverable"
          style={{ width: "100%", marginTop: 8, minHeight: TOQUE, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit", color: "var(--wf-muted)" }}>
          <RotateCcw size={14} /> Volver al orden del cancionero
        </button>
      )}
    </ModalShell>
  );
}
