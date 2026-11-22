// Botones de un solo toque en la consola en vivo (pedido de Eldin, 2026-11-22) — ver lib/botonesRapidos.js.
// FilaBotonesRapidos: la fila de botones + el reproductor de música (lib/audioCulto.js).
// EditorBotonesRapidos: crear, cambiar, ordenar los pasos y borrar botones.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Zap, Pencil, X, Plus, Trash2, ChevronUp, ChevronDown, Music, Pause, Play, Square, Check, RotateCcw } from "lucide-react";
import { useCerrarConAtras } from "../lib/atras.js";
import {
  TIPOS_PASO, DESTINOS_IR_A, COLORES_BOTON, MAX_BOTONES, MAX_PASOS,
  pasoNuevo, fondoDeEstilo, resumenPaso, pasoIncompleto, botonesDeFabrica, normalizarBotones,
} from "../lib/botonesRapidos.js";
import { MINUTOS_RAPIDOS } from "../lib/cuentaRegresiva.js";
import { DURACIONES_AVISO, MAX_LETRAS_AVISO } from "../lib/avisoCongregacion.js";
import { useAudioCulto, pausarAudio, reanudarAudio, bajarAudio, setVolumenAudio, nombreDeAudio } from "../lib/audioCulto.js";
import { SelectorAudio } from "../pantallas/ventanas.jsx";
import { LIVE_THEMES, inputStyle, primaryBtn, iconGhost } from "../pantallas/compartido.jsx";
import { confirmDialog } from "../lib/confirm.js";

const chip = { display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", border: "none", borderRadius: 17, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 };

// Muestra del fondo guardado en un paso (o el de Estilo).
function MuestraFondo({ fondo }) {
  const tema = fondo && fondo.theme !== "custom" ? LIVE_THEMES[fondo.theme] : null;
  const img = fondo?.theme === "custom" && fondo.customBgType !== "video" ? fondo.customImage : null;
  return (
    <span aria-hidden style={{ width: 44, height: 25, borderRadius: 6, flexShrink: 0, border: "1px solid var(--wf-border)", background: img ? `center / cover no-repeat url(${img})` : tema?.bg || "#0B0F17", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}>
      {fondo?.theme === "custom" && fondo.customBgType === "video" ? "VIDEO" : !tema && !img ? "FONDO" : ""}
    </span>
  );
}

// Reproductor compacto: lo que suena, pausa/sigue, volumen y "Bajar".
export function ReproductorAudio() {
  const a = useAudioCulto();
  if (!a.url) return null;
  const boton = { width: 30, height: 30, borderRadius: 15, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-hover)", color: "var(--wf-text)", flexShrink: 0 };
  return (
    <div role="group" aria-label="Música" style={{ display: "flex", alignItems: "center", gap: 6, background: "color-mix(in srgb, #1F8A73 14%, transparent)", borderRadius: 18, padding: "3px 6px 3px 12px", minWidth: 0, flexShrink: 1 }}>
      <Music size={14} color="#1F8A73" style={{ flexShrink: 0 }} />
      <span title={a.error || a.nombre} style={{ fontSize: 12, fontWeight: 700, color: a.error ? "#C23B32" : "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, maxWidth: 200 }}>
        {a.error ? "No suena: revisa el audio" : `${a.sonando ? "Sonando" : "En pausa"}: ${a.nombre || nombreDeAudio(a.url)}`}
      </span>
      <button type="button" onClick={() => (a.sonando ? pausarAudio() : reanudarAudio())} aria-label={a.sonando ? "Pausar la música" : "Seguir la música"} title={a.sonando ? "Pausar" : "Seguir"} style={boton}>{a.sonando ? <Pause size={14} /> : <Play size={14} />}</button>
      <input type="range" min={0} max={1} step={0.05} value={a.volumen} onChange={(e) => setVolumenAudio(e.target.value)} aria-label="Volumen de la música" title="Volumen" style={{ width: 70, accentColor: "#1F8A73" }} />
      <button type="button" onClick={() => bajarAudio()} aria-label="Bajar la música poco a poco y pararla" title="Bajar poco a poco y parar" style={{ ...boton, width: "auto", padding: "0 10px", fontSize: 11.5, fontWeight: 800, gap: 4 }}><Square size={11} /> Bajar</button>
    </div>
  );
}

export function FilaBotonesRapidos({ botones, onEjecutar, onEditar, compacto = false }) {
  return (
    <div data-testid="fila-botones-rapidos" role="toolbar" aria-label="Botones de un solo toque" style={{ display: "flex", alignItems: "center", gap: 8, padding: compacto ? "0 16px 10px" : "8px 76px 8px 16px", background: compacto ? "transparent" : "var(--wf-card)", borderTop: compacto ? "none" : "1px solid var(--wf-divider)", flexShrink: 0, minWidth: 0 }}>
      <span title="Un toque hace varias cosas a la vez" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, color: "var(--wf-muted)", letterSpacing: 0.3, flexShrink: 0 }}><Zap size={14} color="#E8821E" /> UN TOQUE</span>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", minWidth: 0, flex: "0 1 auto", scrollbarWidth: "thin" }}>
        {botones.map((b) => (
          <button key={b.id} type="button" onClick={() => onEjecutar(b)} className="hoverable"
            title={b.pasos.length ? b.pasos.map((p, i) => `${i + 1}. ${resumenPaso(p, { temas: LIVE_THEMES })}`).join("\n") : "Este botón todavía no hace nada: tócalo en Editar"}
            style={{ ...chip, background: b.color, color: "#fff" }}>{b.nombre}</button>
        ))}
      </div>
      <button type="button" onClick={onEditar} className="hoverable" title="Crear o cambiar los botones de un solo toque" style={{ ...chip, background: "var(--wf-hover)", color: "var(--wf-text)", fontWeight: 700, padding: "0 12px" }}>
        {botones.length ? <><Pencil size={13} /> Editar</> : <><Plus size={13} /> Crear botón</>}
      </button>
      <div style={{ flex: 1 }} />
      <ReproductorAudio />
    </div>
  );
}

const etiqueta = { display: "block", fontSize: 11.5, fontWeight: 800, color: "var(--wf-text)", margin: "12px 0 6px", letterSpacing: 0.2 };

function Pastillas({ opciones, valor, onCambiar, etiquetaGrupo }) {
  return (
    <div role="radiogroup" aria-label={etiquetaGrupo} style={{ display: "flex", gap: 3, background: "var(--wf-hover)", padding: 3, borderRadius: 12, flexWrap: "wrap" }}>
      {opciones.map(([val, label]) => (
        <button key={String(val)} type="button" role="radio" aria-checked={valor === val} onClick={() => onCambiar(val)}
          style={{ flex: 1, fontSize: 11.5, fontWeight: 700, padding: "6px 8px", borderRadius: 10, border: "none", cursor: "pointer", whiteSpace: "nowrap", background: valor === val ? "var(--wf-brand-accent)" : "transparent", color: valor === val ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>{label}</button>
      ))}
    </div>
  );
}

// Lo que se ajusta de cada paso.
function AjustesPaso({ paso, cambiar, iglesiaId, estiloActual }) {
  switch (paso.tipo) {
    case "fondo": {
      const actual = fondoDeEstilo(estiloActual);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {paso.fondo ? <MuestraFondo fondo={paso.fondo} /> : null}
          <button type="button" onClick={() => cambiar({ fondo: actual })} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 10, border: "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" }}>
            <MuestraFondo fondo={actual} /> {paso.fondo ? "Cambiar por el que está puesto ahora" : "Usar el fondo que está puesto ahora"}
          </button>
          <div style={{ fontSize: 11, color: "var(--wf-faint)", width: "100%" }}>Pon el fondo que quieras en la pestaña Estilo y luego toca este botón.</div>
        </div>
      );
    }
    case "cuenta":
      return (
        <>
          <Pastillas etiquetaGrupo="Hasta cuándo" valor={paso.modo} onCambiar={(modo) => cambiar({ modo })} opciones={[["hora", "Hasta la hora del culto"], ["minutos", "Por minutos"]]} />
          {paso.modo === "minutos" && (
            <div style={{ marginTop: 8 }}><Pastillas etiquetaGrupo="Minutos" valor={paso.minutos} onCambiar={(minutos) => cambiar({ minutos })} opciones={MINUTOS_RAPIDOS.map((m) => [m, `${m} min`])} /></div>
          )}
          {paso.modo === "hora" && <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Si el evento no tiene hora, cuenta 5 minutos.</div>}
        </>
      );
    case "musica":
      return (
        <>
          <SelectorAudio iglesiaId={iglesiaId} value={paso.url} onChange={(url) => cambiar({ url, nombre: nombreDeAudio(url) })} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={!!paso.repetir} onChange={(e) => cambiar({ repetir: e.target.checked })} /> Repetir sin parar hasta que la baje
          </label>
        </>
      );
    case "irA":
      return <Pastillas etiquetaGrupo="A dónde" valor={paso.destino} onCambiar={(destino) => cambiar({ destino })} opciones={DESTINOS_IR_A.map((d) => [d.id, d.label])} />;
    case "negro":
      return <Pastillas etiquetaGrupo="Negro" valor={paso.valor} onCambiar={(valor) => cambiar({ valor })} opciones={[[true, "Poner en negro"], [false, "Volver a mostrar"]]} />;
    case "mensaje":
      return (
        <>
          <input value={paso.texto} maxLength={MAX_LETRAS_AVISO} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="Ej. Bienvenidos, el culto empieza pronto" style={inputStyle} />
          <div style={{ marginTop: 8 }}><Pastillas etiquetaGrupo="Cuánto dura" valor={paso.segundos} onCambiar={(segundos) => cambiar({ segundos })} opciones={DURACIONES_AVISO.map((s) => [s, `${s} s`])} /></div>
        </>
      );
    case "escenario":
      return <input value={paso.texto} maxLength={200} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="Ej. Empezamos en 1 minuto" style={inputStyle} />;
    default:
      return null;
  }
}

export function EditorBotonesRapidos({ botones: iniciales, onGuardar, onCerrar, iglesiaId, estiloActual }) {
  useCerrarConAtras(true, onCerrar);
  const [botones, setBotones] = useState(() => iniciales.map((b) => ({ ...b, pasos: b.pasos.map((p) => ({ ...p })) })));
  const [selId, setSelId] = useState(iniciales[0]?.id || null);
  const [agregandoPaso, setAgregandoPaso] = useState(false);
  const sel = botones.find((b) => b.id === selId) || null;
  const cambiarBoton = (patch) => setBotones((bs) => bs.map((b) => (b.id === selId ? { ...b, ...patch } : b)));
  const cambiarPaso = (i, patch) => cambiarBoton({ pasos: sel.pasos.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const moverPaso = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= sel.pasos.length) return;
    const pasos = [...sel.pasos];
    [pasos[i], pasos[j]] = [pasos[j], pasos[i]];
    cambiarBoton({ pasos });
  };
  const nuevoBoton = () => {
    const b = { id: `boton-${Date.now()}`, nombre: "Botón nuevo", color: COLORES_BOTON[botones.length % COLORES_BOTON.length], pasos: [] };
    setBotones((bs) => [...bs, b]);
    setSelId(b.id);
    setAgregandoPaso(true);
  };
  const borrarBoton = async () => {
    if (!sel || !(await confirmDialog(`¿Borrar el botón "${sel.nombre}"?`, { danger: true, textoConfirmar: "Borrar" }))) return;
    const resto = botones.filter((b) => b.id !== sel.id);
    setBotones(resto);
    setSelId(resto[0]?.id || null);
  };
  const deFabrica = async () => {
    if (!(await confirmDialog("¿Volver a los 3 botones que vienen listos? Se pierden los cambios que hiciste.", { textoConfirmar: "Volver" }))) return;
    const f = botonesDeFabrica();
    setBotones(f);
    setSelId(f[0].id);
  };
  const guardar = () => onGuardar(normalizarBotones(botones) || []);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 10, boxSizing: "border-box" }} onClick={onCerrar}>
      <div role="dialog" aria-label="Botones de un solo toque" onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--wf-card)", borderRadius: 18, boxShadow: "0 18px 50px rgba(0,0,0,.35)", width: "min(600px, 100%)", maxHeight: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Zap size={17} color="#E8821E" /><span style={{ fontWeight: 700, fontSize: 15 }}>Botones de un solo toque</span></div>
          <button type="button" onClick={onCerrar} style={iconGhost} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div style={{ padding: "0 16px", fontSize: 12, color: "var(--wf-muted)" }}>Cada botón hace sus pasos en orden, con un solo toque. Se guardan en esta computadora.</div>
        <div style={{ overflowY: "auto", padding: "10px 16px 16px", flex: "1 1 auto", minHeight: 0 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {botones.map((b) => (
              <button key={b.id} type="button" onClick={() => { setSelId(b.id); setAgregandoPaso(false); }} aria-pressed={b.id === selId}
                style={{ ...chip, background: b.color, color: "#fff", outline: b.id === selId ? "3px solid var(--wf-text)" : "none", outlineOffset: 2 }}>{b.nombre}</button>
            ))}
            {botones.length < MAX_BOTONES && <button type="button" onClick={nuevoBoton} style={{ ...chip, background: "var(--wf-hover)", color: "var(--wf-text)" }}><Plus size={14} /> Nuevo botón</button>}
          </div>

          {!sel && <div style={{ fontSize: 13, color: "var(--wf-muted)", marginTop: 16 }}>No hay botones. Toca "Nuevo botón" para crear uno.</div>}
          {sel && (
            <div data-testid="editor-boton" style={{ marginTop: 6 }}>
              <label style={etiqueta}>Nombre</label>
              <input value={sel.nombre} maxLength={40} onChange={(e) => cambiarBoton({ nombre: e.target.value })} style={inputStyle} aria-label="Nombre del botón" />
              <label style={etiqueta}>Color</label>
              <div style={{ display: "flex", gap: 8 }}>
                {COLORES_BOTON.map((c) => (
                  <button key={c} type="button" onClick={() => cambiarBoton({ color: c })} aria-label={`Color ${c}`} aria-pressed={sel.color === c}
                    style={{ width: 30, height: 30, borderRadius: 15, background: c, border: sel.color === c ? "3px solid var(--wf-text)" : "none", cursor: "pointer", padding: 0 }} />
                ))}
              </div>

              <label style={etiqueta}>Lo que hace, en orden</label>
              {!sel.pasos.length && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 8 }}>Todavía no hace nada. Agrégale un paso.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sel.pasos.map((p, i) => {
                  const info = TIPOS_PASO.find((t) => t.tipo === p.tipo);
                  const falta = pasoIncompleto(p);
                  return (
                    <div key={i} data-testid="paso-boton" style={{ background: "var(--wf-hover)", borderRadius: 12, padding: 10, border: falta ? "1px dashed #E8821E" : "1px solid transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 11, background: sel.color, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0 }}>{info?.label}</span>
                        <button type="button" onClick={() => moverPaso(i, -1)} disabled={i === 0} aria-label="Subir paso" style={{ ...iconGhost, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={15} /></button>
                        <button type="button" onClick={() => moverPaso(i, 1)} disabled={i === sel.pasos.length - 1} aria-label="Bajar paso" style={{ ...iconGhost, opacity: i === sel.pasos.length - 1 ? 0.3 : 1 }}><ChevronDown size={15} /></button>
                        <button type="button" onClick={() => cambiarBoton({ pasos: sel.pasos.filter((_, j) => j !== i) })} aria-label="Quitar paso" style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>
                      </div>
                      <div style={{ marginTop: 8 }}><AjustesPaso paso={p} cambiar={(patch) => cambiarPaso(i, patch)} iglesiaId={iglesiaId} estiloActual={estiloActual} /></div>
                      {falta && <div style={{ fontSize: 11, color: "#B4610F", marginTop: 6, fontWeight: 600 }}>Falta completar: si no, este paso se salta.</div>}
                    </div>
                  );
                })}
              </div>
              {sel.pasos.length < MAX_PASOS && (agregandoPaso ? (
                <div style={{ marginTop: 8, border: "1px solid var(--wf-border)", borderRadius: 12, padding: 6 }}>
                  {TIPOS_PASO.map((t) => (
                    <button key={t.tipo} type="button" onClick={() => { cambiarBoton({ pasos: [...sel.pasos, pasoNuevo(t.tipo)] }); setAgregandoPaso(false); }} className="hoverable"
                      style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, padding: "7px 8px", cursor: "pointer", fontFamily: "inherit", color: "var(--wf-text)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: "var(--wf-muted)" }}>{t.detalle}</div>
                    </button>
                  ))}
                  <button type="button" onClick={() => setAgregandoPaso(false)} style={{ background: "none", border: "none", fontSize: 12, color: "var(--wf-muted)", cursor: "pointer", padding: "4px 8px" }}>Cancelar</button>
                </div>
              ) : (
                <button type="button" onClick={() => setAgregandoPaso(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 8, height: 38, borderRadius: 12, border: "1px dashed var(--wf-border)", background: "transparent", color: "var(--wf-text)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> Agregar paso</button>
              ))}
              <button type="button" onClick={borrarBoton} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, background: "none", border: "none", color: "#C23B32", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}><Trash2 size={13} /> Borrar este botón</button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "10px 16px 14px", borderTop: "1px solid var(--wf-divider)", alignItems: "center" }}>
          <button type="button" onClick={deFabrica} title="Volver a Inicio del culto, Empezar alabanza y Final del culto" style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--wf-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><RotateCcw size={13} /> Los de fábrica</button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={guardar} style={{ ...primaryBtn, width: "auto", padding: "10px 22px", display: "flex", alignItems: "center", gap: 6 }}><Check size={15} /> Guardar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
