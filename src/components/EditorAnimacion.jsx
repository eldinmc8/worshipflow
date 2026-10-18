import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Sparkles } from "lucide-react";
import { ENTRADAS, PERMANENCIAS, SOMBRAS_RECETA, RECETA_VACIA, recetaCompleta } from "../lib/animaciones.js";
import { FUENTES, familiaDe } from "../lib/diapositivas.js";
import { ANIMACIONES, FONDOS_DISPONIBLES, definicionDeReceta, armarLineasAnimadas, claseAnimacion, FondoAnimado, precargarFuentesAnimacion } from "./LetrasAnimadas.jsx";
import { guardarAnimacion } from "../lib/animacionesIglesia.js";
import { showToast } from "../lib/toast.js";

// Creador de animaciones propias (pedido de Eldin, 2026-10-18): la iglesia arma su estilo de letra animada
// eligiendo piezas — letra, cómo entra, cómo se queda, palabras clave y fondo — con una vista previa en
// vivo. Lo guardado aparece en "De mi iglesia" dentro del menú de Letra animada.

// Punto de partida aproximado para cada estilo de fábrica ("Partir de…").
const PARTIR_DE = {
  suave: { fuente: "fraunces", negrita: false, entrada: "subir", unidad: "palabra", separacion: 0.09, sombra: "suave", fondo: { tipo: "aurora" } },
  luz: { fuente: "fraunces", negrita: true, color: "#FFF4DE", entrada: "desenfoque", unidad: "palabra", separacion: 0.16, permanencia: "brillar", sombra: "brillo", colorEfecto: "#FFBE64", fondo: { tipo: "bokeh" } },
  cielo: { fuente: "montserrat", negrita: false, mayusculas: true, espaciado: 0.12, color: "#EAF2FF", entrada: "bajar", unidad: "palabra", separacion: 0.14, permanencia: "flotar", sombra: "brillo", colorEfecto: "#8CB4FF", fondo: { tipo: "estrellas" } },
  karaoke: { fuente: "poppins", entrada: "aparecer", unidad: "palabra", separacion: 0.3, sombra: "brillo", colorEfecto: "#FFFFFF", fondo: { tipo: "foco" } },
  cinetico: { fuente: "bebas", negrita: false, entrada: "volar", unidad: "palabra", separacion: 0.13, permanencia: "flotar", claves: true, colorClave: "#E8821E", sombra: "suave", fondo: { tipo: "rayos" } },
  ola: { fuente: "poppins", entrada: "rebotar", unidad: "letra", separacion: 0.09, permanencia: "ondular", sombra: "suave", fondo: { tipo: "olas" } },
  impacto: { fuente: "bebas", negrita: false, entrada: "golpe", unidad: "palabra", separacion: 0.12, destello: true, sombra: "suave", fondo: { tipo: "ondas" } },
  fiesta: { fuente: "fredoka", entrada: "crecer", unidad: "palabra", separacion: 0.1, permanencia: "balancear", claves: true, colorClave: "#FFD23F", sombra: "solida", fondo: { tipo: "confeti" } },
  neon: { fuente: "montserrat", negrita: false, mayusculas: true, espaciado: 0.08, entrada: "parpadear", unidad: "letra", separacion: 0.06, permanencia: "brillar", sombra: "neon", colorEfecto: "#3EE7FF", fondo: { tipo: "synth" } },
  glitch: { fuente: "archivo", negrita: false, mayusculas: true, entrada: "deslizar", unidad: "palabra", separacion: 0.07, sombra: "neon", colorEfecto: "#FF2A6D", fondo: { tipo: "glitch" } },
  urbano: { fuente: "marker", negrita: false, color: "#FFE600", entrada: "golpe", unidad: "palabra", separacion: 0.16, sombra: "solida", fondo: { tipo: "urbano" } },
  comic: { fuente: "bangers", negrita: false, color: "#FFE14D", entrada: "crecer", unidad: "palabra", separacion: 0.12, sombra: "contorno", destello: true, fondo: { tipo: "comic" } },
  retro: { fuente: "bungee", negrita: false, entrada: "deslizar", unidad: "palabra", separacion: 0.1, sombra: "brillo", colorEfecto: "#FF5EC4", fondo: { tipo: "retro" } },
  pop: { fuente: "fredoka", color: "#FF5FA2", entrada: "rebotar", unidad: "palabra", separacion: 0.11, permanencia: "latir", sombra: "solida", fondo: { tipo: "burbujas" } },
  maquina: { fuente: "courier", color: "#E8FFE8", entrada: "escribir", unidad: "letra", separacion: 0.14, sombra: "brillo", colorEfecto: "#50FF8C", fondo: { tipo: "terminal" } },
};
export function recetaDesdeEstilo(clave) {
  const p = PARTIR_DE[clave] || {};
  return recetaCompleta({ ...RECETA_VACIA, ...p, fondo: { ...RECETA_VACIA.fondo, ...(p.fondo || {}) } });
}

const C = { panel: "var(--wf-card)", borde: "var(--wf-border)", texto: "var(--wf-text)", suave: "var(--wf-muted)", tenue: "var(--wf-faint)", hover: "var(--wf-hover)", acento: "#B15EA0", naranja: "var(--wf-brand-accent)" };
const etiqueta = { fontSize: 10.5, fontWeight: 700, color: C.suave, letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" };
const campo = { width: "100%", boxSizing: "border-box", background: C.panel, border: `1px solid ${C.borde}`, borderRadius: 10, padding: "7px 9px", fontSize: 12.5, color: C.texto };

function Chips({ valor, opciones, onCambiar }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {opciones.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onCambiar(v)}
          style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 9px", borderRadius: 999, cursor: "pointer", border: valor === v ? `2px solid ${C.acento}` : `1px solid ${C.borde}`, background: valor === v ? "color-mix(in srgb, #B15EA0 12%, var(--wf-card))" : C.panel, color: C.texto }}>{l}</button>
      ))}
    </div>
  );
}
function Deslizador({ etiquetaTexto, valor, min, max, paso, onCambiar, formato }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "110px 1fr 46px", alignItems: "center", gap: 8, fontSize: 12, color: C.texto, marginBottom: 6 }}>
      <span>{etiquetaTexto}</span>
      <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => onCambiar(Number(e.target.value))} style={{ accentColor: "var(--wf-brand-accent)", cursor: "pointer", minWidth: 0 }} />
      <span style={{ fontSize: 11, color: C.suave, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formato ? formato(valor) : valor}</span>
    </label>
  );
}
function Interruptor({ texto, valor, onCambiar }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: C.texto, cursor: "pointer", marginBottom: 6 }}>
      <input type="checkbox" checked={!!valor} onChange={(e) => onCambiar(e.target.checked)} style={{ accentColor: "var(--wf-brand-accent)", cursor: "pointer" }} />
      {texto}
    </label>
  );
}
function Color({ valor, onCambiar, titulo }) {
  return <input type="color" title={titulo} value={valor} onChange={(e) => onCambiar(e.target.value)} style={{ width: 34, height: 28, border: `1px solid ${C.borde}`, borderRadius: 8, background: "none", cursor: "pointer", padding: 1 }} />;
}

// Vista previa: el fondo y una frase de prueba entrando con la receta, repetida cada pocos segundos.
export function VistaPreviaReceta({ receta, nombre, frase, vuelta }) {
  const def = useMemo(() => definicionDeReceta(receta, nombre), [receta, nombre]);
  const lineas = (frase || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const { lineas: nodos, vars } = armarLineasAnimadas(def, lineas.length ? lineas : ["Santo es el Señor"], `prev-${vuelta}`);
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 14, overflow: "hidden", background: "#000", containerType: "inline-size", boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
      {def.fondo ? <FondoAnimado tipo={def.fondo} pulso={vuelta} ajustes={def.ajustesFondo} /> : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)" }} />}
      {def.flash && <div key={`f${vuelta}`} className="wfa-flash" />}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6cqw" }}>
        <div key={vuelta} className={claseAnimacion("mia:prev")} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", fontFamily: def.fuente.family, fontWeight: def.fuente.weight, textTransform: def.fuente.transform, letterSpacing: def.fuente.tracking, color: def.color, textShadow: def.sombra, fontSize: "6.2cqw", lineHeight: 1.25, whiteSpace: "nowrap", ...vars }}>
          {nodos.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
      {!def.fondo && <div style={{ position: "absolute", left: 10, bottom: 8, fontSize: 10.5, color: "rgba(255,255,255,.55)" }}>Se usará el fondo que elijas en Estilo (colores, imagen o video)</div>}
    </div>
  );
}

export default function EditorAnimacion({ inicial, iglesiaId, iglesiaNombre, usuarioId, onCerrar, onGuardado }) {
  // inicial: { id?, nombre, receta, compartida } — sin id es una animación nueva.
  const [nombre, setNombre] = useState(inicial?.nombre || "");
  const [receta, setReceta] = useState(() => recetaCompleta(inicial?.receta || RECETA_VACIA));
  const [compartida, setCompartida] = useState(!!inicial?.compartida);
  const [frase, setFrase] = useState("Santo, santo es el Señor\ndigno de toda gloria");
  const [vuelta, setVuelta] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const cambiar = (patch) => setReceta((r) => recetaCompleta({ ...r, ...patch }));
  const cambiarFondo = (patch) => setReceta((r) => recetaCompleta({ ...r, fondo: { ...r.fondo, ...patch } }));

  useEffect(() => { precargarFuentesAnimacion(); }, []);
  // Cada cambio vuelve a reproducir la entrada (con una pausa corta para no repetirla a cada letra que se escribe),
  // y además se repite sola cada 5 segundos para poder mirarla con calma.
  useEffect(() => { const t = setTimeout(() => setVuelta((v) => v + 1), 250); return () => clearTimeout(t); }, [receta, frase]);
  useEffect(() => { const id = setInterval(() => setVuelta((v) => v + 1), 5000); return () => clearInterval(id); }, []);

  const guardar = async () => {
    if (!nombre.trim()) { showToast("Ponle un nombre a tu animación", "error"); return; }
    setGuardando(true);
    try {
      const fila = await guardarAnimacion({ id: inicial?.id, iglesiaId, nombre, receta, compartida, autorIglesia: iglesiaNombre, usuarioId });
      showToast(inicial?.id ? "Animación actualizada" : "Animación guardada en De mi iglesia", "info");
      onGuardado?.({ ...fila, receta: recetaCompleta(fila.receta) });
    } catch (e) {
      showToast(`No se pudo guardar: ${e.message || e}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  const seccion = (titulo, contenido) => (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid var(--wf-divider, ${C.borde})` }}>
      <div style={etiqueta}>{titulo}</div>
      {contenido}
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,16,28,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Crear animación" style={{ width: "min(1100px, 100%)", maxHeight: "min(760px, calc(100vh - 32px))", background: "var(--wf-bg, #F4F6FA)", borderRadius: 18, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: C.panel, borderBottom: `1px solid ${C.borde}` }}>
          <Sparkles size={18} color="#B15EA0" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-heading)", flex: 1 }}>{inicial?.id ? "Editar animación" : "Crear animación"}</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: C.suave, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexWrap: "wrap", overflowY: "auto" }}>
          {/* Vista previa */}
          <div style={{ flex: "1 1 460px", minWidth: 0, padding: 16, display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 0, alignSelf: "flex-start" }}>
            <VistaPreviaReceta receta={receta} nombre={nombre} frase={frase} vuelta={vuelta} />
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <textarea id="anim-frase" value={frase} onChange={(e) => setFrase(e.target.value)} rows={2} aria-label="Frase de prueba" style={{ ...campo, resize: "none", flex: 1 }} />
              <button type="button" onClick={() => setVuelta((v) => v + 1)} style={{ ...campo, width: "auto", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 600 }}><RotateCcw size={14} /> Repetir</button>
            </div>
            <div style={{ fontSize: 11.5, color: C.suave, lineHeight: 1.5 }}>Escribe una frase de prueba para ver cómo se vería. En el culto se usa la letra de cada canción.</div>
            <div>
              <div style={etiqueta}>Partir de un estilo</div>
              <select id="anim-partir" value="" onChange={(e) => { if (e.target.value) setReceta(recetaDesdeEstilo(e.target.value)); }} style={campo}>
                <option value="">Elegir para copiar su forma…</option>
                {Object.entries(ANIMACIONES).map(([k, a]) => <option key={k} value={k}>{a.nombre} ({a.grupo})</option>)}
              </select>
            </div>
          </div>

          {/* Controles */}
          <div style={{ flex: "1 1 380px", minWidth: 0, padding: 16, background: C.panel, borderLeft: `1px solid ${C.borde}` }}>
            {seccion("Letra", <>
              <select id="anim-fuente" value={receta.fuente} onChange={(e) => cambiar({ fuente: e.target.value })} style={{ ...campo, fontFamily: familiaDe(receta.fuente), marginBottom: 8 }}>
                {FUENTES.map((f) => <option key={f.clave} value={f.clave} style={{ fontFamily: f.family }}>{f.nombre}</option>)}
              </select>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                <Interruptor texto="Negrita" valor={receta.negrita} onCambiar={(v) => cambiar({ negrita: v })} />
                <Interruptor texto="MAYÚSCULAS" valor={receta.mayusculas} onCambiar={(v) => cambiar({ mayusculas: v })} />
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 6 }}>Color <Color valor={receta.color} onCambiar={(v) => cambiar({ color: v })} /></span>
              </div>
              <Deslizador etiquetaTexto="Espacio entre letras" valor={receta.espaciado} min={0} max={0.3} paso={0.01} onCambiar={(v) => cambiar({ espaciado: v })} />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select id="anim-sombra" value={receta.sombra} onChange={(e) => cambiar({ sombra: e.target.value })} style={{ ...campo, flex: 1 }}>
                  {SOMBRAS_RECETA.map((s) => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}
                </select>
                {(receta.sombra === "brillo" || receta.sombra === "neon") && <Color titulo="Color del brillo" valor={receta.colorEfecto} onCambiar={(v) => cambiar({ colorEfecto: v })} />}
              </div>
            </>)}

            {seccion("Cómo entra", <>
              <div style={{ marginBottom: 8 }}>
                <Chips valor={receta.unidad} onCambiar={(v) => cambiar({ unidad: v })} opciones={[["linea", "Línea por línea"], ["palabra", "Palabra por palabra"], ["letra", "Letra por letra"]]} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <Chips valor={receta.entrada} onCambiar={(v) => cambiar({ entrada: v })} opciones={ENTRADAS.map((e) => [e.clave, e.nombre])} />
              </div>
              <Deslizador etiquetaTexto="Velocidad" valor={receta.velocidad} min={0.4} max={2} paso={0.1} onCambiar={(v) => cambiar({ velocidad: v })} formato={(v) => (v < 0.85 ? "Lenta" : v > 1.25 ? "Rápida" : "Normal")} />
              <Deslizador etiquetaTexto={receta.unidad === "linea" ? "Pausa entre líneas" : receta.unidad === "letra" ? "Pausa entre letras" : "Pausa entre palabras"} valor={receta.separacion} min={0} max={0.5} paso={0.01} onCambiar={(v) => cambiar({ separacion: v })} formato={(v) => `${v.toFixed(2)} s`} />
            </>)}

            {seccion("Mientras está en pantalla", (
              <Chips valor={receta.permanencia} onCambiar={(v) => cambiar({ permanencia: v })} opciones={PERMANENCIAS.map((p) => [p.clave, p.nombre])} />
            ))}

            {seccion("Palabras clave", <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Interruptor texto="Resaltar palabras clave con otro color" valor={receta.claves} onCambiar={(v) => cambiar({ claves: v })} />
                {receta.claves && <Color titulo="Color de las palabras clave" valor={receta.colorClave} onCambiar={(v) => cambiar({ colorClave: v })} />}
              </div>
              {receta.claves && (
                <>
                  <input id="anim-claves" value={receta.palabrasClave} onChange={(e) => cambiar({ palabrasClave: e.target.value })} placeholder="Ej. Jesús, Rey, Cordero (vacío = Santo, Señor, Dios, Gloria…)" style={campo} />
                </>
              )}
            </>)}

            {seccion("Fondo", <>
              <div style={{ marginBottom: 8 }}>
                <Chips valor={receta.fondo.tipo} onCambiar={(v) => cambiarFondo({ tipo: v })} opciones={[["propio", "Mi fondo de siempre"], ...FONDOS_DISPONIBLES]} />
              </div>
              {receta.fondo.tipo !== "propio" && <>
                <Deslizador etiquetaTexto="Color (tono)" valor={receta.fondo.tono} min={-180} max={180} paso={5} onCambiar={(v) => cambiarFondo({ tono: v })} formato={(v) => `${v}°`} />
                <Deslizador etiquetaTexto="Brillo" valor={receta.fondo.brillo} min={0.4} max={1.5} paso={0.05} onCambiar={(v) => cambiarFondo({ brillo: v })} formato={(v) => `${Math.round(v * 100)}%`} />
                <Deslizador etiquetaTexto="Movimiento" valor={receta.fondo.velocidad} min={0.25} max={2} paso={0.05} onCambiar={(v) => cambiarFondo({ velocidad: v })} formato={(v) => (v < 0.75 ? "Lento" : v > 1.3 ? "Rápido" : "Normal")} />
                <Deslizador etiquetaTexto="Cantidad" valor={receta.fondo.densidad} min={0.5} max={2} paso={0.1} onCambiar={(v) => cambiarFondo({ densidad: v })} formato={(v) => `${Math.round(v * 100)}%`} />
              </>}
            </>)}

            <div>
              <div style={etiqueta}>Extras</div>
              <Interruptor texto="Destello al cambiar de diapositiva" valor={receta.destello} onCambiar={(v) => cambiar({ destello: v })} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 16px", background: C.panel, borderTop: `1px solid ${C.borde}` }}>
          <input id="anim-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Nombre (ej. Jóvenes Fuego)" aria-label="Nombre de la animación" style={{ ...campo, width: 240 }} />
          <Interruptor texto="Compartir en la galería para otras iglesias" valor={compartida} onCambiar={setCompartida} />
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onCerrar} style={{ ...campo, width: "auto", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando} style={{ ...campo, width: "auto", cursor: "pointer", fontWeight: 700, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent, #1b1004)", border: "none", opacity: guardando ? 0.6 : 1 }}>{guardando ? "Guardando…" : "Guardar animación"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
