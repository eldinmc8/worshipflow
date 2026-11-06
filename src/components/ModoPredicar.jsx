import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Minus, Plus, Radio, BookOpen, Timer, Navigation } from "lucide-react";
import { pasosPredicar, pasoAlAire } from "../lib/bosquejos.js";
import { restanteTemporizador, textoTemporizador, nivelTemporizador } from "../lib/escenario.js";

// Modo predicar (pedido de Eldin, 2026-11-06): para cuando la iglesia no tiene pantalla de escenario.
// El predicador ve su bosquejo en su propio celular, un paso a la vez y en letra grande: título y cita,
// idea central, cada punto con su nota privada (nunca se proyecta) y el texto completo de sus versículos.
// - Si el culto está en vivo, sigue solo a Multimedia: cuando proyectan el punto 2, aquí salta al punto 2.
//   Si el predicador se mueve a mano, deja de seguir hasta que toque "Ir a lo que está al aire".
// - Sin transmisión, se avanza a mano (botones, o tocando los lados de la pantalla).
// Siempre oscuro (regla de oro: es pantalla de escenario) y con la pantalla encendida mientras está abierto.

const NARANJA = "#E8821E";
const GRIS = "#8996A6";
const ROJO = "#C23B32";
const TAMANOS = [0.85, 1, 1.15, 1.3, 1.5];
const CLAVE_TAMANO = "worshipflow_predicar_tamano";
const leerTamano = () => { try { const v = Number(localStorage.getItem(CLAVE_TAMANO)); return TAMANOS.includes(v) ? v : 1; } catch { return 1; } };

function Versiculo({ v, t }) {
  return (
    <div style={{ background: "rgba(47,95,168,0.16)", borderRadius: 14, padding: "12px 14px", marginTop: 10 }}>
      <div style={{ fontSize: 14 * t, fontWeight: 700, color: "#8FB4F0", display: "flex", alignItems: "center", gap: 6 }}><BookOpen size={14 * t} /> {v.ref} <span style={{ fontWeight: 500, color: GRIS }}>· {v.version}</span></div>
      <div style={{ fontSize: 17 * t, lineHeight: 1.5, color: "#E8ECF2", marginTop: 4 }}>{v.text}</div>
    </div>
  );
}

function tituloPaso(paso, b) {
  if (!paso) return "";
  if (paso.tipo === "inicio") return "Inicio";
  if (paso.tipo === "idea") return "Idea central";
  return (b.puntos[paso.i]?.titulo || "").trim() || `Punto ${paso.i + 1}`;
}

export default function ModoPredicar({ bosquejo, serviceOrder = [], bloqueId, enVivo = false, slideAlAire = null, onClose }) {
  const b = bosquejo || {};
  const pasos = useMemo(() => pasosPredicar(b), [b]);
  const puntosVisibles = pasos.filter((p) => p.tipo === "punto");
  const alAire = enVivo ? pasoAlAire(pasos, serviceOrder, bloqueId, slideAlAire, b) : -1;
  const [indice, setIndice] = useState(() => (alAire >= 0 ? alAire : 0));
  const [siguiendo, setSiguiendo] = useState(true);
  const [tamano, setTamano] = useState(leerTamano);
  const [ahora, setAhora] = useState(() => Date.now());
  const contenido = useRef(null);

  // Sigue a Multimedia mientras no se haya movido a mano.
  useEffect(() => { if (siguiendo && alAire >= 0) setIndice(alAire); }, [siguiendo, alAire]);
  useEffect(() => { contenido.current?.scrollTo?.({ top: 0 }); }, [indice]);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { try { localStorage.setItem(CLAVE_TAMANO, String(tamano)); } catch { /* sin almacenamiento */ } }, [tamano]);

  // Que el celular no se apague a mitad del sermón (donde el navegador lo permite).
  useEffect(() => {
    let lock = null, vivo = true;
    const pedir = () => navigator.wakeLock?.request?.("screen").then((l) => { if (vivo) lock = l; else l.release?.(); }).catch(() => {});
    pedir();
    const alVolver = () => { if (document.visibilityState === "visible") pedir(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { vivo = false; document.removeEventListener("visibilitychange", alVolver); lock?.release?.().catch?.(() => {}); };
  }, []);

  // Flechas del teclado o un control de presentación (que envía flechas / PageUp-PageDown).
  const ir = (n) => { if (n < 0 || n >= pasos.length) return; setIndice(n); if (enVivo && n !== alAire) setSiguiendo(false); };
  useEffect(() => {
    const tecla = (e) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); ir(indice + 1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); ir(indice - 1); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const paso = pasos[indice];
  const t = tamano;
  const temporizador = enVivo ? slideAlAire?.escenario?.temporizador || null : null;
  const restante = temporizador ? restanteTemporizador(temporizador, ahora) : null;
  const colorTiempo = restante == null ? GRIS : { normal: "#4CC38A", aviso: NARANJA, excedido: ROJO }[nivelTemporizador(restante)] || GRIS;
  const hora = new Date(ahora).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });

  let cuerpo = null;
  if (paso?.tipo === "inicio") {
    cuerpo = (
      <>
        <div style={{ fontSize: 13 * t, fontWeight: 700, letterSpacing: 1.2, color: NARANJA, textTransform: "uppercase" }}>Sermón</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 34 * t, fontWeight: 600, lineHeight: 1.15, marginTop: 6 }}>{b.titulo || "Sin título"}</div>
        {b.citaBase && <Versiculo v={b.citaBase} t={t} />}
      </>
    );
  } else if (paso?.tipo === "idea") {
    cuerpo = (
      <>
        <div style={{ fontSize: 13 * t, fontWeight: 700, letterSpacing: 1.2, color: NARANJA, textTransform: "uppercase" }}>Idea central{!b.mostrarIdea && <span style={{ color: GRIS }}> · no se proyecta</span>}</div>
        <div style={{ fontSize: 24 * t, lineHeight: 1.4, marginTop: 8, whiteSpace: "pre-line" }}>{b.ideaCentral}</div>
      </>
    );
  } else if (paso?.tipo === "punto") {
    const p = b.puntos[paso.i] || {};
    const num = puntosVisibles.findIndex((x) => x.i === paso.i) + 1;
    cuerpo = (
      <>
        <div style={{ fontSize: 13 * t, fontWeight: 700, letterSpacing: 1.2, color: NARANJA, textTransform: "uppercase" }}>Punto {num} de {puntosVisibles.length}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30 * t, fontWeight: 600, lineHeight: 1.2, marginTop: 6 }}>{(p.titulo || "").trim() || `Punto ${num}`}</div>
        {(p.nota || "").trim() && (
          <div style={{ background: "rgba(232,130,30,0.14)", borderRadius: 14, padding: "12px 14px", marginTop: 12 }}>
            <div style={{ fontSize: 12 * t, fontWeight: 700, color: NARANJA, letterSpacing: 0.6 }}>TU NOTA · no se proyecta</div>
            <div style={{ fontSize: 18 * t, lineHeight: 1.5, marginTop: 4, whiteSpace: "pre-line" }}>{p.nota}</div>
          </div>
        )}
        {(p.versiculos || []).map((v, k) => <Versiculo key={`${v.ref}-${k}`} v={v} t={t} />)}
      </>
    );
  }

  const siguiente = pasos[indice + 1];
  const botonBarra = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none", borderRadius: 14, padding: "14px 12px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
  const botonChico = { background: "rgba(255,255,255,0.08)", border: "none", color: "#E8ECF2", width: 36, height: 36, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Modo predicar" style={{ position: "fixed", inset: 0, zIndex: 80, background: "#0E1116", color: "#F2F4F7", display: "flex", flexDirection: "column", fontFamily: "'Poppins', sans-serif" }}>
      {/* Barra de arriba */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(10px + env(safe-area-inset-top)) 14px 10px" }}>
        <button type="button" onClick={onClose} style={botonChico} aria-label="Salir del modo predicar"><X size={18} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.titulo || "Bosquejo"}</div>
          <div style={{ fontSize: 11.5, color: GRIS }}>{hora}{restante != null && <span style={{ color: colorTiempo, fontWeight: 700 }}> · <Timer size={11} style={{ verticalAlign: -1 }} /> {textoTemporizador(restante)}</span>}</div>
        </div>
        <button type="button" onClick={() => setTamano(TAMANOS[Math.max(0, TAMANOS.indexOf(tamano) - 1)])} style={botonChico} aria-label="Letra más chica"><Minus size={16} /></button>
        <button type="button" onClick={() => setTamano(TAMANOS[Math.min(TAMANOS.length - 1, TAMANOS.indexOf(tamano) + 1)])} style={botonChico} aria-label="Letra más grande"><Plus size={16} /></button>
      </div>

      {/* Siguiendo a Multimedia / volver a lo que está al aire */}
      {enVivo && (
        <div style={{ padding: "0 14px 8px" }}>
          {siguiendo || indice === alAire ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#fff", background: alAire >= 0 ? ROJO : "rgba(255,255,255,0.1)", borderRadius: 20, padding: "5px 11px" }}>
              <Radio size={13} /> {alAire >= 0 ? "En vivo · siguiendo a Multimedia" : "En vivo · tu bosquejo aún no está al aire"}
            </div>
          ) : alAire >= 0 ? (
            <button type="button" onClick={() => { setSiguiendo(true); setIndice(alAire); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#0E1116", background: NARANJA, border: "none", borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
              <Navigation size={13} /> Ir a lo que está al aire ({tituloPaso(pasos[alAire], b)})
            </button>
          ) : null}
        </div>
      )}

      {/* Progreso */}
      <div style={{ display: "flex", gap: 4, padding: "0 14px 10px" }}>
        {pasos.map((p, k) => (
          <button key={k} type="button" onClick={() => ir(k)} aria-label={`Ir a ${tituloPaso(p, b)}`} title={tituloPaso(p, b)}
            style={{ flex: 1, height: 5, border: "none", padding: 0, borderRadius: 3, cursor: "pointer", background: k === alAire ? ROJO : k <= indice ? NARANJA : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>

      {/* Contenido: tocar el tercio izquierdo/derecho también cambia de paso */}
      <div ref={contenido} style={{ flex: 1, overflowY: "auto", padding: "8px 18px 20px", position: "relative" }}
        onClick={(e) => {
          if (window.getSelection?.()?.toString()) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          if (x > 0.7) ir(indice + 1); else if (x < 0.3) ir(indice - 1);
        }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>{cuerpo}</div>
      </div>

      {/* Barra de abajo */}
      <div style={{ display: "flex", gap: 8, padding: "10px 14px calc(12px + env(safe-area-inset-bottom))", background: "rgba(255,255,255,0.03)" }}>
        <button type="button" onClick={() => ir(indice - 1)} disabled={indice === 0} aria-label="Paso anterior"
          style={{ ...botonBarra, background: "rgba(255,255,255,0.08)", color: "#E8ECF2", opacity: indice === 0 ? 0.35 : 1, minWidth: 64 }}>
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => ir(indice + 1)} disabled={!siguiente} aria-label="Paso siguiente"
          style={{ ...botonBarra, flex: 1, background: siguiente ? NARANJA : "rgba(255,255,255,0.08)", color: siguiente ? "#0E1116" : GRIS, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siguiente ? `Siguiente: ${tituloPaso(siguiente, b)}` : "Fin del bosquejo"}</span>
          {siguiente && <ChevronRight size={18} style={{ flexShrink: 0 }} />}
        </button>
      </div>
    </div>,
    document.body
  );
}
