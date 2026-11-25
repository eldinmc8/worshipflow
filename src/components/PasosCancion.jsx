import { useLayoutEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, X, Plus, Pencil, Trash2, Repeat, Music, ListMusic, Keyboard, Hand, MoveHorizontal, ArrowDownToLine, Scissors, ArrowUp } from "lucide-react";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { promptDialog, confirmDialog } from "../lib/confirm.js";
import { acordeEn } from "../lib/preferencias.js";
import { quitarAcordes, diapositivasDeLineas, distintivoDe } from "../lib/textoCancion.js";
import {
  TIPOS_PARTE, ordenDe, partesUnicas, partesSinUsar, agregarParte, repetirParte, moverEnOrden, quitarDelOrden, borrarParte, renombrarParte,
  textoDeParte, contenidoVaConLetra, escribirLetraParte, lineasParaAcordes, palabrasDe, ponerAcorde, quitarAcorde, agregarAcordeAlFinal,
  partirPalabra, alargarLetra, acortarLetra, puedeAlargar, puedeAcortar, revisarTextoAcordes, unirRenglones, partirRenglon,
  agregarCambioTono, cambiarCambioTono,
} from "../lib/pasosCancion.js";
import { esCambioTono, semitonosCambio, cambiosPorPosicion, tonoMas, textoCambio } from "../lib/cambioTono.js";
import { ElegirCambioTono, COLOR_CAMBIO } from "./CambioTono.jsx";

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
  const sube = esCambioTono(b);
  return <span style={{ minWidth: t, height: t, padding: "0 6px", boxSizing: "border-box", borderRadius: t / 2, background: sube ? COLOR_CAMBIO : color, color: "#fff", fontSize: grande ? 12 : 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{sube ? <ArrowUp size={grande ? 16 : 14} strokeWidth={3} /> : dist(b)}</span>;
}

// ---------------- Paso 2: Estructura ----------------
export function PasoEstructura({ cancion, setCancion, colorDe }) {
  const orden = ordenDe(cancion);
  // "Sube de tono": null | { nuevo: true } | { k, idx } (cambiar uno que ya está en el orden).
  const [eligiendoTono, setEligiendoTono] = useState(null);
  const cambios = cambiosPorPosicion(orden, cancion.blocks);
  const tonoAl = (s) => tonoMas(cancion.key, s);
  const tonoFinal = tonoAl(cambios.length ? cambios[cambios.length - 1] : 0);
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
        <button type="button" onClick={() => setEligiendoTono({ nuevo: true })} className="hoverable"
          style={{ minHeight: TOQUE + 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, border: "none", cursor: "pointer", fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", background: `color-mix(in srgb, ${COLOR_CAMBIO} 15%, var(--wf-card))`, color: COLOR_CAMBIO }}>
          <ArrowUp size={16} /> Sube de tono
        </button>
      </div>
      {eligiendoTono?.nuevo && (
        <ElegirCambioTono desdeKey={tonoFinal} titulo="¿A qué tono sube desde aquí?" onCancelar={() => setEligiendoTono(null)}
          onElegir={(n) => { setCancion((c) => agregarCambioTono(c, n)); setEligiendoTono(null); }} />
      )}

      <div style={etiquetaSeccion}><ListMusic size={13} /> ORDEN DE LA CANCIÓN</div>
      {orden.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: "center", color: "var(--wf-faint)", fontSize: 13.5, padding: "26px 14px" }}>Todavía no hay partes. Empieza tocando Intro, Estrofa o Coro.</div>
      ) : (
        <div>
          {orden.length > 1 && <div style={{ fontSize: 12, color: "var(--wf-faint)", marginBottom: 8 }}>Para cambiar el orden usa las flechas, o mantén presionada una parte y arrástrala.</div>}
          {orden.map((k, idx) => {
            const b = cancion.blocks[k];
            const sube = semitonosCambio(b);
            const editandoEste = eligiendoTono && !eligiendoTono.nuevo && eligiendoTono.idx === idx;
            return (
              <div key={`${k}-${idx}`}>
              <div data-parte={dist(b)} {...arrastre.filaProps(idx)} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "6px 6px 6px 10px", marginBottom: 8, minHeight: TOQUE + 8, ...arrastre.estiloFila(idx) }}>
                <span style={{ width: 18, fontSize: 12, color: "var(--wf-faint)", fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{idx + 1}</span>
                <Distintivo b={b} color={colorDe(dist(b))} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.label}
                  {sube > 0 && cancion.key && <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: COLOR_CAMBIO }}>{textoCambio(sube, acordeEn(tonoAl(cambios[idx])))}</span>}
                </span>
                {sube > 0
                  ? <BotonIcono etiqueta={`Cambiar a qué tono sube`} onClick={() => setEligiendoTono(editandoEste ? null : { k, idx })}><ArrowUp size={16} /></BotonIcono>
                  : <BotonIcono etiqueta={`Cambiar nombre de ${b.label}`} onClick={() => renombrar(k)}><Pencil size={15} /></BotonIcono>}
                <BotonIcono etiqueta={`Subir ${b.label}`} onClick={() => setCancion((c) => moverEnOrden(c, idx, idx - 1))} disabled={idx === 0}><ChevronUp size={18} /></BotonIcono>
                <BotonIcono etiqueta={`Bajar ${b.label}`} onClick={() => setCancion((c) => moverEnOrden(c, idx, idx + 1))} disabled={idx === orden.length - 1}><ChevronDown size={18} /></BotonIcono>
                <BotonIcono etiqueta={`Quitar ${b.label}`} onClick={() => { setEligiendoTono(null); setCancion((c) => quitarDelOrden(c, idx)); }} color="#C23B32"><X size={17} /></BotonIcono>
              </div>
              {editandoEste && (
                <ElegirCambioTono desdeKey={tonoAl(cambios[idx] - sube)} actual={sube} onCancelar={() => setEligiendoTono(null)}
                  onElegir={(n) => { setCancion((c) => cambiarCambioTono(c, k, n)); setEligiendoTono(null); }} />
              )}
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
  // "Sube de tono" no lleva letra: no se muestra aquí.
  const partes = partesUnicas(cancion).filter((k) => !esCambioTono(cancion.blocks[k]));
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
              placeholder={/^(IN|INS|INT|F|O|M|VI)\d*$/i.test(dist(b)) ? `Letra de ${b.label} (si no tiene, déjala vacía)` : `Escribe aquí la letra de ${b.label}…`} />
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
// Mejoras pedidas por Eldin (2026-11-20, pensando en multimedia y el líder de alabanza):
// - La estrofa se ve corrida (los cortes de diapositiva son solo de la proyección).
// - El acorde va en la letra exacta: al tocar una palabra, abajo sale letra por letra.
// - "Alargar"/"Acortar": estira una letra SOLO para los músicos ("Dios" → "Diooos") para poner varios
//   acordes en una nota larga; la diapositiva sigue diciendo "Dios".
// - "+" al final de cada renglón para un acorde que cae después de la última palabra.
// - "Escribir como texto" para quien escribe rápido: [G] a mano, pero sin poder cambiar la letra.
const btnChico = { minHeight: 36, padding: "0 12px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 };

// La palabra con sus acordes encima, cada acorde sobre su letra.
function PalabraConAcordes({ texto }) {
  const { plano, acordes } = partirPalabra(texto);
  const cortes = [...new Set([0, ...acordes.map((a) => a.pos), plano.length])].sort((a, b) => a - b);
  const trozos = [];
  for (let j = 0; j < cortes.length - 1 || (j === 0 && cortes.length === 1); j++) {
    const ini = cortes[j], fin = cortes[j + 1] ?? plano.length;
    trozos.push({ texto: plano.slice(ini, fin), acordes: acordes.filter((a) => a.pos === ini).map((a) => a.acorde) });
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end" }}>
      {trozos.map((t, j) => (
        <span key={j} style={{ display: "inline-flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: "#1F8A73", minHeight: "1.3em", whiteSpace: "nowrap", paddingRight: t.acordes.length ? 3 : 0 }}>{t.acordes.length ? t.acordes.map((a) => acordeEn(a)).join(" ") : " "}</span>
          <span style={{ fontSize: 16, color: "var(--wf-text)", whiteSpace: "pre" }}>{t.texto}</span>
        </span>
      ))}
    </span>
  );
}

function CuadroTextoAcordes({ lineas, onListo, onActivo, insertarRef }) {
  const [texto, setTexto] = useState(() => lineas.filter((l) => String(l).trim()).join("\n"));
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const cursor = useRef(null); // dónde estaba el cursor la última vez (el celular lo pierde al tocar la barra)
  const recordar = () => { const el = ref.current; if (el) cursor.current = [el.selectionStart, el.selectionEnd]; };
  useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.max(el.scrollHeight, 80)}px`; } }, [texto]);
  const cambiar = (t) => {
    setTexto(t);
    // Mientras se escribe un acorde ("[G" sin cerrar) no se revisa todavía.
    if ((t.match(/\[/g) || []).length !== (t.match(/\]/g) || []).length) return;
    const r = revisarTextoAcordes(lineas, t);
    if (r.ok) { setError(null); onListo(r.lineas.length ? r.lineas : [""]); } else setError(r);
  };
  // La barra de acordes de abajo pone el acorde donde está el cursor: sin escribir corchetes.
  const insertar = (acorde) => {
    const [ini, fin] = cursor.current || [texto.length, texto.length];
    const ins = `[${acorde}]`;
    cambiar(texto.slice(0, ini) + ins + texto.slice(fin));
    const pos = ini + ins.length;
    cursor.current = [pos, pos];
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.focus({ preventScroll: true }); el.setSelectionRange(pos, pos); } });
  };
  const activar = () => { recordar(); if (insertarRef) insertarRef.current = insertar; onActivo?.(); };
  return (
    <div>
      <textarea ref={ref} value={texto} onChange={(e) => { cambiar(e.target.value); recordar(); }} onFocus={activar} onSelect={activar} onKeyUp={recordar} onClick={activar} spellCheck={false} aria-label="Acordes como texto"
        style={{ width: "100%", boxSizing: "border-box", resize: "none", overflow: "hidden", border: `1px solid ${error ? "#C23B32" : "var(--wf-border)"}`, borderRadius: 12, padding: "10px 12px", fontSize: 15, lineHeight: 1.55, fontFamily: "'JetBrains Mono', monospace", background: "var(--wf-bg)", color: "var(--wf-text)", outline: "none" }} />
      {error && (
        <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6, background: "rgba(194,59,50,0.1)", borderRadius: 10, padding: "8px 10px", fontSize: 12.5, color: "var(--wf-text)" }}>
          <span style={{ flex: 1 }}>En el renglón {error.renglon} cambió la letra{error.esperado && error.escrito ? <>: dice «{error.escrito}» y debe decir «{error.esperado}»</> : error.esperado ? <>: falta «{error.esperado}»</> : <>: sobra «{error.escrito}»</>}. Aquí solo se ponen acordes: la letra se cambia en el paso Letra. Esto no se guarda hasta que la letra quede igual.</span>
          <button type="button" onClick={() => { setTexto(lineas.filter((l) => String(l).trim()).join("\n")); setError(null); }} style={{ ...btnChico, minHeight: 30, background: "var(--wf-card)", color: "var(--wf-text)" }}>Deshacer</button>
        </div>
      )}
    </div>
  );
}

export function PasoAcordes({ cancion, setCancion, colorDe, grupos, abajo }) {
  const partes = partesUnicas(cancion);
  const [sel, setSel] = useState(null); // { k, i, n, pos } n = número de palabra o "fin"; pos = antes de qué letra
  const [comoTexto, setComoTexto] = useState(false);
  const insertarRef = useRef(null); // el cuadro de texto donde está el cursor (modo texto)
  const [cuadroActivo, setCuadroActivo] = useState(null);
  const cambiarLineas = (k, fn) => { setCancion((c) => ({ ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], lines: fn(lineasParaAcordes(c, k).filter((x) => String(x).trim())) } } })); setSel(null); };

  const lineasDe = (k) => {
    const l = lineasParaAcordes(cancion, k).filter((x) => String(x).trim());
    return l.length ? l : [""];
  };
  const cambiarLinea = (k, i, fn) => setCancion((c) => {
    const lines = lineasParaAcordes(c, k).filter((x) => String(x).trim());
    if (!lines.length) lines.push("");
    lines[i] = fn(lines[i] || "");
    return { ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], lines } } };
  });
  const palabraSel = sel && sel.n !== "fin" ? palabrasDe(lineasDe(sel.k)[sel.i] || "")[sel.n] : null;
  const partida = palabraSel ? partirPalabra(palabraSel.texto) : null;
  const acordeEnPos = partida?.acordes.find((a) => a.pos === sel?.pos);

  const elegirPalabra = (k, i, n, texto) => {
    if (sel && sel.k === k && sel.i === i && sel.n === n) { setSel(null); return; }
    const { acordes } = partirPalabra(texto || "");
    setSel({ k, i, n, pos: n === "fin" ? 0 : (acordes[0]?.pos ?? 0) });
  };
  const poner = (acorde) => {
    const a = String(acorde || "").trim();
    if (!sel || !a) return;
    if (sel.n === "fin") cambiarLinea(sel.k, sel.i, (l) => agregarAcordeAlFinal(l, a));
    else cambiarLinea(sel.k, sel.i, (l) => ponerAcorde(l, sel.n, a, sel.pos));
  };
  const quitar = () => {
    if (!sel || sel.n === "fin" || !partida) return;
    if (!partida.plano) { cambiarLinea(sel.k, sel.i, (l) => quitarAcorde(l, sel.n)); setSel(null); return; }
    cambiarLinea(sel.k, sel.i, (l) => quitarAcorde(l, sel.n, sel.pos));
  };
  const alargar = () => sel && cambiarLinea(sel.k, sel.i, (l) => alargarLetra(l, sel.n, sel.pos));
  const acortar = () => {
    if (!sel || !partida) return;
    const linea = lineasDe(sel.k)[sel.i] || "";
    const nueva = acortarLetra(linea, sel.n, sel.pos);
    cambiarLinea(sel.k, sel.i, () => nueva);
    // Si la letra elegida se fue al acortar, queda elegida la última igual que sigue ahí.
    const plano = partirPalabra(palabrasDe(nueva)[sel.n]?.texto || "").plano;
    const base = (partida.plano[sel.pos] || "").toLowerCase().normalize("NFD")[0];
    let pos = Math.min(sel.pos, plano.length - 1);
    while (pos > 0 && plano[pos].toLowerCase().normalize("NFD")[0] !== base) pos--;
    setSel({ ...sel, pos: Math.max(0, pos) });
  };
  const ponerBars = (k, v) => setCancion((c) => ({ ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], bars: Math.max(1, parseInt(v, 10) || 1) } } }));
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
    <div style={{ paddingBottom: comoTexto ? 120 : sel ? 300 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ ...tituloPaso, flex: 1 }}>Acordes <span style={{ fontSize: 13, fontWeight: 600, color: "var(--wf-muted)", fontFamily: "var(--wf-font-ui)" }}>· opcional</span></h2>
        <button type="button" onClick={() => { setComoTexto((v) => !v); setSel(null); setCuadroActivo(null); insertarRef.current = null; }} style={{ ...btnChico, background: "var(--wf-hover)", color: "var(--wf-text)" }}>
          {comoTexto ? <><Hand size={14} /> Tocar palabras</> : <><Keyboard size={14} /> Escribir como texto</>}
        </button>
      </div>
      <p style={ayuda}>{comoTexto
        ? <>Escribe cada acorde entre corchetes justo antes de la letra donde cae, ej. <code style={{ color: "#1F8A73" }}>[G]Santo es el [D]Señor</code>. Puedes alargar palabras ("Diooos"), pero la letra no se puede cambiar aquí.</>
        : <><b>Toca una palabra</b>, elige la letra exacta donde cae el acorde y luego el acorde. Con <b>Unir</b> juntas dos renglones en uno solo para el músico (la pantalla no cambia). La letra no se cambia aquí: para eso está el paso Letra.</>}</p>
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
            {comoTexto ? (
              <CuadroTextoAcordes key={`${k}-texto`} lineas={lines} insertarRef={insertarRef} onActivo={() => setCuadroActivo(k)} onListo={(nuevas) => setCancion((c) => ({ ...c, blocks: { ...c.blocks, [k]: { ...c.blocks[k], lines: nuevas } } }))} />
            ) : (
              <>
                {sinLetra && <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginBottom: 8 }}>Esta parte no tiene letra. Puedes poner sus acordes aquí:</div>}
                {lines.map((linea, i) => {
                  const palabras = palabrasDe(linea);
                  return (
                    <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 0, rowGap: 2, marginBottom: 6 }}>
                      {palabras.map((p, n) => {
                        const { plano } = partirPalabra(p.texto);
                        const activo = esSel(k, i, n);
                        return (
                          <button key={n} type="button" onClick={() => elegirPalabra(k, i, n, p.texto)}
                            style={{ display: "inline-flex", alignItems: "flex-end", minHeight: 40, padding: "2px 5px", margin: plano ? 0 : "0 3px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                              background: activo ? "color-mix(in srgb, var(--wf-brand-accent) 22%, transparent)" : plano ? "transparent" : "var(--wf-hover)", outline: activo ? "2px solid var(--wf-brand-accent)" : "none" }}>
                            <PalabraConAcordes texto={p.texto} />
                          </button>
                        );
                      })}
                      <button type="button" aria-label={sinLetra ? "Agregar acorde" : "Agregar acorde al final del renglón"} title="Acorde al final del renglón" onClick={() => elegirPalabra(k, i, "fin")}
                        style={{ minHeight: 34, minWidth: 34, marginLeft: 4, borderRadius: 8, border: "1.5px dashed var(--wf-border)", background: esSel(k, i, "fin") ? "color-mix(in srgb, var(--wf-brand-accent) 22%, transparent)" : "transparent", color: "var(--wf-faint)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 13, fontWeight: 700, padding: sinLetra ? "0 10px" : 0, fontFamily: "inherit", alignSelf: "flex-end" }}>
                        <Plus size={14} />{sinLetra && " Acorde"}
                      </button>
                      {i < lines.length - 1 && (
                        <button type="button" onClick={() => cambiarLineas(k, (ls) => unirRenglones(ls, i))} aria-label="Unir con el renglón de abajo" title="Unir con el renglón de abajo (solo para el músico)"
                          style={{ minHeight: 34, marginLeft: 4, borderRadius: 8, border: "none", background: "var(--wf-hover)", color: "var(--wf-muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, padding: "0 9px", fontFamily: "inherit", alignSelf: "flex-end" }}>
                          <ArrowDownToLine size={13} /> Unir
                        </button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      {sel && !comoTexto && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: abajo, background: "var(--wf-card)", borderTop: "1px solid var(--wf-divider)", boxShadow: "0 -4px 14px rgba(22,50,79,0.12)", padding: "10px 0 12px", zIndex: 46 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Music size={14} color="#1F8A73" />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sel.n === "fin" ? "Acorde al final del renglón" : partida?.plano ? "Toca la letra donde cae el acorde" : "Cambiar este acorde"}
              </span>
              <BotonIcono etiqueta="Cerrar acordes" onClick={() => setSel(null)}><X size={18} /></BotonIcono>
            </div>
            {partida?.plano && (
              <>
                <div className="chordbar-scroll" style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 4, marginBottom: 6 }}>
                  {[...partida.plano].map((letra, j) => {
                    const ac = partida.acordes.filter((a) => a.pos === j);
                    const elegida = sel.pos === j;
                    return (
                      <button key={j} type="button" aria-label={`Letra ${j + 1}: ${letra}`} onClick={() => setSel({ ...sel, pos: j })}
                        style={{ flexShrink: 0, minWidth: 34, height: 54, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 1, padding: "3px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                          border: elegida ? "2px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)", background: elegida ? "color-mix(in srgb, var(--wf-brand-accent) 16%, var(--wf-card))" : "var(--wf-hover)" }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#1F8A73", minHeight: 14, whiteSpace: "nowrap" }}>{ac.map((a) => acordeEn(a.acorde)).join(" ")}</span>
                        <span style={{ fontSize: 18, fontWeight: 600, color: "var(--wf-text)", lineHeight: 1.1 }}>{letra}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={alargar} disabled={!puedeAlargar(palabraSel.texto, sel.pos)} title="Estira esta letra solo para los músicos" style={{ ...btnChico, background: "var(--wf-hover)", color: "var(--wf-text)", opacity: puedeAlargar(palabraSel.texto, sel.pos) ? 1 : 0.35 }}><MoveHorizontal size={14} /> Alargar</button>
                  <button type="button" onClick={acortar} disabled={!puedeAcortar(palabraSel.texto, sel.pos)} style={{ ...btnChico, background: "var(--wf-hover)", color: "var(--wf-text)", opacity: puedeAcortar(palabraSel.texto, sel.pos) ? 1 : 0.35 }}>Acortar</button>
                  {sel.n > 0 && <button type="button" onClick={() => cambiarLineas(sel.k, (ls) => partirRenglon(ls, sel.i, sel.n))} title="Empieza un renglón nuevo en esta palabra (solo para el músico)" style={{ ...btnChico, background: "var(--wf-hover)", color: "var(--wf-text)" }}><Scissors size={14} /> Partir aquí</button>}
                  {acordeEnPos && <button type="button" onClick={quitar} style={{ ...btnChico, background: "rgba(194,59,50,0.12)", color: "#C23B32" }}>Quitar {acordeEn(acordeEnPos.acorde)}</button>}
                </div>
              </>
            )}
            {partida && !partida.plano && <div style={{ marginBottom: 8 }}><button type="button" onClick={quitar} style={{ ...btnChico, background: "rgba(194,59,50,0.12)", color: "#C23B32" }}>Quitar acorde</button></div>}
            <BarraAcordes grupos={grupos} onAcorde={poner} />
          </div>
        </div>
      )}

      {comoTexto && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: abajo, background: "var(--wf-card)", borderTop: "1px solid var(--wf-divider)", boxShadow: "0 -4px 14px rgba(22,50,79,0.12)", padding: "8px 0 10px", zIndex: 46 }}>
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 12px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>
              {cuadroActivo ? <>Toca un acorde y se pone donde está el cursor en <b>{cancion.blocks[cuadroActivo]?.label}</b></> : "Toca dentro de una parte y luego un acorde: se pone donde está el cursor"}
            </div>
            <BarraAcordes grupos={grupos} onAcorde={(a) => insertarRef.current?.(a)} desactivada={!cuadroActivo} />
          </div>
        </div>
      )}
    </div>
  );
}

// Barra de acordes de la tonalidad (deslizable) + "Otro" para escribir uno que no esté.
function BarraAcordes({ grupos, onAcorde, desactivada = false }) {
  const [otro, setOtro] = useState("");
  return (
    <>
      <div className="chordbar-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", alignItems: "stretch", opacity: desactivada ? 0.5 : 1 }}>
        {grupos.map((g, gi) => (
          <div key={g.titulo} style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "stretch", paddingLeft: gi === 0 ? 0 : 8, borderLeft: gi === 0 ? "none" : "1px solid var(--wf-divider)" }}>
            {g.acordes.map((c) => (
              <button key={c.chord + c.grado} type="button" disabled={desactivada} onMouseDown={(e) => e.preventDefault()} onClick={() => onAcorde(c.chord)} className="hoverable" style={{ flexShrink: 0, minWidth: 52, minHeight: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", cursor: desactivada ? "default" : "pointer" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{acordeEn(c.chord)}</span>
                <span style={{ fontSize: 10, color: "var(--wf-faint)", whiteSpace: "nowrap" }}>{c.grado}</span>
              </button>
            ))}
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); if (otro.trim() && !desactivada) onAcorde(otro.trim()); setOtro(""); }} style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "stretch", paddingLeft: grupos.length ? 8 : 0, borderLeft: grupos.length ? "1px solid var(--wf-divider)" : "none" }}>
          <input value={otro} onChange={(e) => setOtro(e.target.value.replace(/[[\]\s]/g, ""))} placeholder="Otro" aria-label="Escribir otro acorde" style={{ width: 76, border: "1px solid var(--wf-border)", borderRadius: 12, padding: "0 8px", fontSize: 16, fontFamily: "'JetBrains Mono', monospace", background: "var(--wf-bg)", color: "var(--wf-text)" }} />
          <button type="submit" disabled={!otro.trim() || desactivada} style={{ minWidth: 52, borderRadius: 12, border: "none", background: "#1F8A73", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: otro.trim() ? 1 : 0.4 }}>Poner</button>
        </form>
      </div>
      {grupos.length === 0 && <div style={{ fontSize: 12, color: "var(--wf-faint)", marginTop: 6 }}>Elige la tonalidad en Datos para ver aquí sus acordes.</div>}
    </>
  );
}
