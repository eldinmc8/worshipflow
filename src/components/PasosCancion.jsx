import { useLayoutEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, X, Plus, Pencil, Trash2, Repeat, Music, ListMusic } from "lucide-react";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { promptDialog, confirmDialog } from "../lib/confirm.js";
import { acordeEn } from "../lib/preferencias.js";
import { quitarAcordes, diapositivasDeLineas, distintivoDe } from "../lib/textoCancion.js";
import {
  TIPOS_PARTE, ordenDe, partesUnicas, partesSinUsar, agregarParte, repetirParte, moverEnOrden, quitarDelOrden, borrarParte, renombrarParte,
  textoDeParte, contenidoVaConLetra, escribirLetraParte, lineasParaAcordes, palabrasDe, ponerAcorde, quitarAcorde, agregarAcordeAlFinal, esLineaSoloAcordes,
} from "../lib/pasosCancion.js";

// Pasos 2, 3 y 4 del asistente de canciones (ver lib/pasosCancion.js). Pensados primero para el
// celular: botones grandes, letra a 16px (así el iPhone no hace zoom al escribir) y nada que haya que
// deslizar de lado salvo la barra de acordes.

const TOQUE = 44; // alto mínimo cómodo para un dedo
const tarjeta = { background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 1px 3px rgba(22,50,79,0.08)", padding: 14, marginBottom: 12 };
const tituloPaso = { fontFamily: "var(--wf-font-titulo)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--wf-text)", margin: "4px 0 4px" };
const ayuda = { fontSize: 13.5, color: "var(--wf-muted)", lineHeight: 1.45, margin: "0 0 14px" };
const etiquetaSeccion = { fontSize: 11.5, fontWeight: 800, color: "var(--wf-muted)", letterSpacing: 0.5, margin: "18px 0 8px", display: "flex", alignItems: "center", gap: 6 };

// Algunas canciones guardadas no traen distintivo (V1, C…): se saca del nombre de la parte.
const dist = (b) => b?.badge || distintivoDe(b?.label || "");

function Distintivo({ b, color, grande = false }) {
  const t = grande ? 34 : 28;
  return <span style={{ minWidth: t, height: t, padding: "0 6px", boxSizing: "border-box", borderRadius: t / 2, background: color, color: "#fff", fontSize: grande ? 12 : 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{dist(b)}</span>;
}

// ---------------- Paso 2: Estructura ----------------
export function PasoEstructura({ cancion, setCancion, colorDe }) {
  const orden = ordenDe(cancion);
  const unicas = partesUnicas(cancion).filter((k) => orden.includes(k));
  const sinUsar = partesSinUsar(cancion);
  const arrastre = useArrastreLista({ habilitado: true, onReorder: (desde, destino) => setCancion((c) => moverEnOrden(c, desde, destino)) });
  const otra = async () => {
    const nombre = await promptDialog("¿Cómo se llama esta parte?", { placeholder: "Ej.: Coro 2, Tag, Interludio" });
    if (nombre && nombre.trim()) setCancion((c) => agregarParte(c, null, { nombre }));
  };
  const renombrar = async (k) => {
    const nombre = await promptDialog("Nuevo nombre de la parte", { valorInicial: cancion.blocks[k].label, placeholder: cancion.blocks[k].label });
    if (nombre && nombre.trim()) setCancion((c) => renombrarParte(c, k, nombre));
  };
  const borrar = async (k) => {
    if (await confirmDialog(`¿Borrar "${cancion.blocks[k].label}" y su letra?`, { danger: true, textoConfirmar: "Borrar" })) setCancion((c) => borrarParte(c, k));
  };
  return (
    <div>
      <h2 style={tituloPaso}>¿Qué partes tiene la canción?</h2>
      <p style={ayuda}>Tócalas en el orden en que se cantan. Si el coro se repite, tócalo otra vez. Las estrofas se numeran solas.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))", gap: 8 }}>
        {TIPOS_PARTE.map((t) => {
          const color = colorDe(t.prefix);
          return (
            <button key={t.id} type="button" onClick={() => setCancion((c) => agregarParte(c, t.id))} className="hoverable"
              style={{ minHeight: TOQUE + 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", background: `color-mix(in srgb, ${color} 15%, var(--wf-card))`, color }}>
              <Plus size={16} /> {t.label}
            </button>
          );
        })}
        <button type="button" onClick={otra} className="hoverable" style={{ minHeight: TOQUE + 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, border: "1.5px dashed var(--wf-border)", background: "transparent", cursor: "pointer", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", color: "var(--wf-muted)" }}>
          <Plus size={16} /> Otra…
        </button>
      </div>

      <div style={etiquetaSeccion}><ListMusic size={13} /> ORDEN DE LA CANCIÓN</div>
      {orden.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: "center", color: "var(--wf-faint)", fontSize: 13.5, padding: "26px 14px" }}>Todavía no hay partes. Empieza tocando Intro, Estrofa o Coro.</div>
      ) : (
        <div>
          {orden.length > 1 && <div style={{ fontSize: 12, color: "var(--wf-faint)", marginBottom: 8 }}>Para cambiar el orden usa las flechas, o mantén presionada una parte y arrástrala.</div>}
          {orden.map((k, idx) => {
            const b = cancion.blocks[k];
            return (
              <div key={`${k}-${idx}`} data-parte={dist(b)} {...arrastre.filaProps(idx)} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "6px 6px 6px 10px", marginBottom: 8, minHeight: TOQUE + 8, ...arrastre.estiloFila(idx) }}>
                <span style={{ width: 18, fontSize: 12, color: "var(--wf-faint)", fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{idx + 1}</span>
                <Distintivo b={b} color={colorDe(dist(b))} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.label}</span>
                <BotonIcono etiqueta={`Cambiar nombre de ${b.label}`} onClick={() => renombrar(k)}><Pencil size={15} /></BotonIcono>
                <BotonIcono etiqueta={`Subir ${b.label}`} onClick={() => setCancion((c) => moverEnOrden(c, idx, idx - 1))} disabled={idx === 0}><ChevronUp size={18} /></BotonIcono>
                <BotonIcono etiqueta={`Bajar ${b.label}`} onClick={() => setCancion((c) => moverEnOrden(c, idx, idx + 1))} disabled={idx === orden.length - 1}><ChevronDown size={18} /></BotonIcono>
                <BotonIcono etiqueta={`Quitar ${b.label}`} onClick={() => setCancion((c) => quitarDelOrden(c, idx))} color="#C23B32"><X size={17} /></BotonIcono>
              </div>
            );
          })}
        </div>
      )}

      {unicas.length > 0 && (
        <>
          <div style={etiquetaSeccion}><Repeat size={13} /> REPETIR UNA PARTE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {unicas.map((k) => (
              <button key={k} type="button" onClick={() => setCancion((c) => repetirParte(c, k))} className="hoverable"
                style={{ minHeight: 40, display: "flex", alignItems: "center", gap: 6, padding: "0 12px 0 6px", borderRadius: 20, border: "1px solid var(--wf-divider)", background: "var(--wf-card)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--wf-text)", fontFamily: "inherit" }}>
                <Distintivo b={cancion.blocks[k]} color={colorDe(dist(cancion.blocks[k]))} /> {cancion.blocks[k].label}
              </button>
            ))}
          </div>
        </>
      )}

      {sinUsar.length > 0 && (
        <>
          <div style={etiquetaSeccion}>PARTES QUE NO ESTÁN EN EL ORDEN</div>
          <div style={{ fontSize: 12, color: "var(--wf-faint)", marginBottom: 8 }}>Tienen letra guardada, pero no se cantan. Agrégalas al orden o bórralas.</div>
          {sinUsar.map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", borderRadius: 14, padding: "6px 6px 6px 10px", marginBottom: 8, minHeight: TOQUE + 8, opacity: 0.85 }}>
              <Distintivo b={cancion.blocks[k]} color={colorDe(dist(cancion.blocks[k]))} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{cancion.blocks[k].label}</span>
              <button type="button" onClick={() => setCancion((c) => repetirParte(c, k))} style={{ minHeight: 36, padding: "0 12px", borderRadius: 12, border: "none", background: "var(--wf-hover)", fontWeight: 700, fontSize: 13, cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>Agregar</button>
              <BotonIcono etiqueta={`Borrar ${cancion.blocks[k].label}`} onClick={() => borrar(k)} color="#C23B32"><Trash2 size={16} /></BotonIcono>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BotonIcono({ etiqueta, onClick, disabled, color = "var(--wf-muted)", children }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} onClick={onClick} disabled={disabled}
      style={{ width: 38, height: 38, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 12, background: "transparent", color, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.25 : 1 }}>
      {children}
    </button>
  );
}

// ---------------- Paso 3: Letra ----------------
function CuadroCreciente({ value, onChange, placeholder, etiqueta }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 96)}px`;
  }, [value]);
  return (
    <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={etiqueta} spellCheck={false} rows={3}
      style={{ width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "12px 12px", fontSize: 16, lineHeight: 1.5, fontFamily: "inherit", background: "var(--wf-bg)", color: "var(--wf-text)", outline: "none" }} />
  );
}

export function PasoLetra({ cancion, setCancion, colorDe, onIrAEstructura }) {
  const partes = partesUnicas(cancion);
  const orden = ordenDe(cancion);
  // Se decide una vez al abrir el paso (no a cada tecla) qué partes llevan su letra también a los acordes.
  const [vaConLetra] = useState(() => Object.fromEntries(partes.map((k) => [k, contenidoVaConLetra(cancion, k)])));
  const [textos, setTextos] = useState(() => Object.fromEntries(partes.map((k) => [k, textoDeParte(cancion, k)])));
  const escribir = (k, t) => {
    setTextos((x) => ({ ...x, [k]: t }));
    setCancion((c) => escribirLetraParte(c, k, t, vaConLetra[k] !== false));
  };
  if (partes.length === 0) {
    return (
      <div>
        <h2 style={tituloPaso}>Letra</h2>
        <div style={{ ...tarjeta, textAlign: "center", padding: "26px 16px" }}>
          <div style={{ fontSize: 14, color: "var(--wf-muted)", marginBottom: 12 }}>Primero elige las partes de la canción (Estrofa, Coro…). Después aquí solo escribes la letra de cada una.</div>
          <button type="button" onClick={onIrAEstructura} style={{ minHeight: TOQUE, padding: "0 18px", borderRadius: 14, border: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent, #fff)", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: "inherit" }}>Elegir las partes</button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 style={tituloPaso}>Escribe la letra</h2>
      <p style={ayuda}>Escribe o pega la letra dentro de cada parte. <b>Deja un renglón vacío</b> para pasar a la siguiente diapositiva. Cada parte se escribe una sola vez: las repeticiones ya están en la Estructura.</p>
      {partes.map((k) => {
        const b = cancion.blocks[k];
        const color = colorDe(dist(b));
        const veces = orden.filter((x) => x === k).length;
        const texto = textos[k] ?? "";
        const slides = diapositivasDeLineas(texto.split("\n"));
        return (
          <div key={k} style={tarjeta}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Distintivo b={b} color={color} grande />
              <span style={{ fontWeight: 800, fontSize: 15.5, flex: 1, minWidth: 0 }}>{b.label}</span>
              {veces > 1 && <span style={{ fontSize: 12, color: "var(--wf-muted)", fontWeight: 600 }}>se canta {veces} veces</span>}
              {veces === 0 && <span style={{ fontSize: 12, color: "var(--wf-muted)", fontWeight: 600 }}>no está en el orden</span>}
            </div>
            <CuadroCreciente value={texto} onChange={(t) => escribir(k, t)} etiqueta={`Letra de ${b.label}`}
              placeholder={/^(IN|INS|F|O)\d*$/i.test(dist(b)) ? `Letra de ${b.label} (si no tiene, déjala vacía)` : `Escribe aquí la letra de ${b.label}…`} />
            {vaConLetra[k] === false && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 6 }}>Esta parte tiene los acordes escritos aparte. Si cambias la letra aquí, revisa también el paso Acordes.</div>}
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--wf-muted)", letterSpacing: 0.4, margin: "10px 0 6px" }}>
              {slides.length === 0 ? "SIN DIAPOSITIVAS · no se proyecta" : `${slides.length} DIAPOSITIVA${slides.length === 1 ? "" : "S"}`}
            </div>
            {slides.length > 0 && (
              <div className="chordbar-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                {slides.map((s, i) => (
                  <div key={i} style={{ flex: "0 0 150px", aspectRatio: "16/9", background: "#10141B", borderRadius: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 8, boxSizing: "border-box", fontSize: 11, lineHeight: 1.3, fontFamily: "'Fraunces', serif", overflow: "hidden" }}>
                    <div>{s.map((x, j) => <div key={j}>{x}</div>)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Paso 4: Acordes ----------------
const acordesDe = (texto) => [...String(texto).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);

export function PasoAcordes({ cancion, setCancion, colorDe, grupos, abajo }) {
  const partes = partesUnicas(cancion);
  const [sel, setSel] = useState(null); // { k, i, n } n = número de palabra o "fin" (agregar al final)
  const [otro, setOtro] = useState("");

  const lineasDe = (k) => {
    const l = lineasParaAcordes(cancion, k);
    return l.some((x) => String(x).trim()) ? l : [""];
  };
  const cambiarLinea = (k, i, fn) => setCancion((c) => {
    const lines = [...lineasParaAcordes(c, k)];
    if (!lines.length) lines.push("");
    lines[i] = fn(lines[i] || "");
    return { ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], lines } } };
  });
  const poner = (acorde) => {
    const a = String(acorde || "").trim();
    if (!sel || !a) return;
    if (sel.n === "fin") cambiarLinea(sel.k, sel.i, (l) => agregarAcordeAlFinal(l, a));
    else cambiarLinea(sel.k, sel.i, (l) => ponerAcorde(l, sel.n, a));
  };
  const quitar = () => {
    if (!sel || sel.n === "fin") return;
    const linea = lineasDe(sel.k)[sel.i] || "";
    const eraSoloAcorde = !quitarAcordes(palabrasDe(linea)[sel.n]?.texto || "");
    cambiarLinea(sel.k, sel.i, (l) => quitarAcorde(l, sel.n));
    if (eraSoloAcorde) setSel(null);
  };
  const ponerBars = (k, v) => setCancion((c) => ({ ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], bars: Math.max(1, parseInt(v, 10) || 1) } } }));

  const palabraSel = sel && sel.n !== "fin" ? palabrasDe(lineasDe(sel.k)[sel.i] || "")[sel.n] : null;
  const esSel = (k, i, n) => sel && sel.k === k && sel.i === i && sel.n === n;

  if (partes.length === 0) {
    return (
      <div>
        <h2 style={tituloPaso}>Acordes</h2>
        <div style={{ ...tarjeta, textAlign: "center", color: "var(--wf-muted)", fontSize: 14, padding: "26px 16px" }}>Esta canción todavía no tiene partes ni letra. Puedes omitir este paso.</div>
      </div>
    );
  }
  return (
    <div style={{ paddingBottom: sel ? 190 : 0 }}>
      <h2 style={tituloPaso}>Acordes <span style={{ fontSize: 13, fontWeight: 600, color: "var(--wf-muted)", fontFamily: "var(--wf-font-ui)" }}>· opcional</span></h2>
      <p style={ayuda}><b>Toca una palabra</b> y luego el acorde que va ahí. La letra no se cambia aquí: para eso está el paso Letra.</p>
      {partes.map((k) => {
        const b = cancion.blocks[k];
        const lines = lineasDe(k);
        const sinLetra = !lines.some((l) => quitarAcordes(l).trim());
        return (
          <div key={k} style={tarjeta}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Distintivo b={b} color={colorDe(dist(b))} grande />
              <span style={{ fontWeight: 800, fontSize: 15.5, flex: 1, minWidth: 0 }}>{b.label}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--wf-faint)" }} title="Para el avance automático del Modo Músico">
                <input type="number" inputMode="numeric" min={1} value={b.bars || 8} onChange={(e) => ponerBars(k, e.target.value)} style={{ width: 52, height: 34, textAlign: "center", border: "1px solid var(--wf-border)", borderRadius: 10, fontSize: 15, background: "var(--wf-bg)", color: "var(--wf-text)" }} />
                compases
              </label>
            </div>
            {sinLetra && <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginBottom: 8 }}>Esta parte no tiene letra. Puedes poner sus acordes aquí:</div>}
            {lines.map((linea, i) => {
              if (!String(linea).trim() && !(sinLetra && lines.length === 1)) return <div key={i} style={{ height: 12 }} />;
              const palabras = palabrasDe(linea);
              const soloAcordes = sinLetra || esLineaSoloAcordes(linea);
              return (
                <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: soloAcordes ? 6 : 0, rowGap: soloAcordes ? 6 : 0, marginBottom: 6 }}>
                  {palabras.map((p, n) => {
                    const acs = acordesDe(p.texto);
                    const plano = quitarAcordes(p.texto);
                    const activo = esSel(k, i, n);
                    return (
                      <button key={n} type="button" onClick={() => setSel(activo ? null : { k, i, n })}
                        style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", minHeight: 40, justifyContent: "flex-end", padding: "2px 5px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          background: activo ? "color-mix(in srgb, var(--wf-brand-accent) 22%, transparent)" : soloAcordes ? "var(--wf-hover)" : "transparent", outline: activo ? "2px solid var(--wf-brand-accent)" : "none" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#1F8A73", minHeight: "1.3em", whiteSpace: "nowrap" }}>{acs.length ? acs.map((a) => acordeEn(a)).join(" ") : " "}</span>
                        {plano && <span style={{ fontSize: 16, color: "var(--wf-text)", whiteSpace: "nowrap" }}>{plano}</span>}
                      </button>
                    );
                  })}
                  {soloAcordes && (
                    <button type="button" aria-label="Agregar acorde" onClick={() => setSel(esSel(k, i, "fin") ? null : { k, i, n: "fin" })}
                      style={{ minHeight: 40, minWidth: 44, borderRadius: 8, border: "1.5px dashed var(--wf-border)", background: esSel(k, i, "fin") ? "color-mix(in srgb, var(--wf-brand-accent) 22%, transparent)" : "transparent", color: "var(--wf-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 13, fontWeight: 700, padding: "0 10px", fontFamily: "inherit" }}>
                      <Plus size={15} /> Acorde
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {sel && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: abajo, background: "var(--wf-card)", borderTop: "1px solid var(--wf-divider)", boxShadow: "0 -4px 14px rgba(22,50,79,0.12)", padding: "10px 0 12px", zIndex: 46 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Music size={14} color="#1F8A73" />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sel.n === "fin" ? "Agregar un acorde" : <>Acorde para «{quitarAcordes(palabraSel?.texto || "") || acordesDe(palabraSel?.texto || "").join(" ")}»</>}
              </span>
              {palabraSel && acordesDe(palabraSel.texto).length > 0 && (
                <button type="button" onClick={quitar} style={{ minHeight: 34, padding: "0 12px", borderRadius: 10, border: "none", background: "rgba(194,59,50,0.12)", color: "#C23B32", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Quitar</button>
              )}
              <BotonIcono etiqueta="Cerrar acordes" onClick={() => setSel(null)}><X size={18} /></BotonIcono>
            </div>
            <div className="chordbar-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", alignItems: "stretch" }}>
              {grupos.map((g, gi) => (
                <div key={g.titulo} style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "stretch", paddingLeft: gi === 0 ? 0 : 8, borderLeft: gi === 0 ? "none" : "1px solid var(--wf-divider)" }}>
                  {g.acordes.map((c) => (
                    <button key={c.chord + c.grado} type="button" onClick={() => poner(c.chord)} className="hoverable" style={{ flexShrink: 0, minWidth: 52, minHeight: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", cursor: "pointer" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{acordeEn(c.chord)}</span>
                      <span style={{ fontSize: 10, color: "var(--wf-faint)", whiteSpace: "nowrap" }}>{c.grado}</span>
                    </button>
                  ))}
                </div>
              ))}
              <form onSubmit={(e) => { e.preventDefault(); poner(otro); setOtro(""); }} style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "stretch", paddingLeft: grupos.length ? 8 : 0, borderLeft: grupos.length ? "1px solid var(--wf-divider)" : "none" }}>
                <input value={otro} onChange={(e) => setOtro(e.target.value.replace(/[[\]\s]/g, ""))} placeholder="Otro" aria-label="Escribir otro acorde" style={{ width: 76, border: "1px solid var(--wf-border)", borderRadius: 12, padding: "0 8px", fontSize: 16, fontFamily: "'JetBrains Mono', monospace", background: "var(--wf-bg)", color: "var(--wf-text)" }} />
                <button type="submit" disabled={!otro.trim()} style={{ minWidth: 52, borderRadius: 12, border: "none", background: "#1F8A73", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: otro.trim() ? 1 : 0.4 }}>Poner</button>
              </form>
            </div>
            {grupos.length === 0 && <div style={{ fontSize: 12, color: "var(--wf-faint)", marginTop: 6 }}>Elige la tonalidad en Datos para ver aquí sus acordes.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

