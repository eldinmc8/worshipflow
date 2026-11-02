import { useEffect, useRef, useState } from "react";
import { X, Minus, Plus, Maximize, Music, BookOpen, Type, MessageSquare } from "lucide-react";
import AutoFitText from "./components/AutoFitText.jsx";
import { leerEscenarioDeUrl } from "./lib/enlacePantalla.js";
import { tiempoTranscurrido } from "./lib/escenario.js";
import { getLiveSession, subscribeLiveSession, subscribeLiveBroadcast, pedirEstadoActual, guardarUltimaFila, leerUltimaFila } from "./lib/liveSession.js";
import { supabase } from "./lib/supabaseClient.js";

// Pantalla de escenario (stage display, pedido de Eldin, 2026-11-01). Monitor en el piso del escenario
// para quienes cantan, tocan o predican: la letra al aire en grande, lo que sigue, la parte de la
// canción y la siguiente, la siguiente canción, reloj, tiempo del culto y el mensaje de Multimedia.
// Igual que la Proyección: enlace fijo (/e/<iglesia>), sin sesión, sigue lo que esté en vivo — por
// Supabase y, si está en la misma computadora que la consola, por el canal local (sin internet).
// A diferencia de la Proyección, "pantalla en negro" NO la apaga: el escenario sigue viendo la letra.
// Siempre oscura (regla de oro: es pantalla de escenario, como la proyección).

const CURSOR_IDLE_MS = 3000;
const NARANJA = "#E8821E";
const GRIS = "#8996A6";
const TAMANOS = [0.7, 0.8, 0.9, 1, 1.1, 1.25];
const CLAVE_TAMANO = "worshipflow_escenario_tamano";

function leerTamano() {
  try { const v = Number(localStorage.getItem(CLAVE_TAMANO)); return TAMANOS.includes(v) ? v : 1; } catch { return 1; }
}

function Etiqueta({ children, color = GRIS }) {
  return <div style={{ fontSize: "clamp(11px, 1.3vh, 16px)", fontWeight: 700, letterSpacing: 1.2, color, textTransform: "uppercase", marginBottom: "0.6vh", display: "flex", alignItems: "center", gap: 6 }}>{children}</div>;
}

function Tarjeta({ children, style }) {
  return <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "1.4vh 1.4vw", ...style }}>{children}</div>;
}

export default function PantallaEscenario() {
  const [fila, setFila] = useState(null);
  const [iglesiaId, setIglesiaId] = useState(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [tamano, setTamano] = useState(leerTamano);
  const [cursorOculto, setCursorOculto] = useState(false);
  const [vertical, setVertical] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth);
  const idleRef = useRef(null);

  // Misma resolución de iglesia que la Proyección (ver PublicScreen.jsx): slug de la URL → id, con
  // copia en este dispositivo para arrancar aunque no haya internet.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = leerEscenarioDeUrl(window.location.pathname, window.location.search)?.slug || null;
    const claveCache = `worshipflow_iglesia_por_slug_${slug || "_defecto"}`;
    const directo = params.get("iid");
    let guardado = null;
    try { guardado = localStorage.getItem(claveCache); } catch { /* sin storage */ }
    if (directo || guardado) setIglesiaId(directo || guardado);
    const resolver = slug ? supabase.rpc("iglesia_id_por_slug", { p_slug: slug }) : supabase.rpc("iglesia_id_por_defecto");
    resolver.then(({ data }) => {
      if (!data) return;
      setIglesiaId(data);
      try { localStorage.setItem(claveCache, data); } catch { /* sin storage */ }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!iglesiaId) return;
    const aplicar = (f) => { setFila(f); guardarUltimaFila(iglesiaId, f); };
    const ultima = leerUltimaFila(iglesiaId);
    if (ultima) setFila(ultima);
    const quitarLocal = subscribeLiveBroadcast(iglesiaId, aplicar);
    pedirEstadoActual(iglesiaId);
    getLiveSession(iglesiaId).then(aplicar).catch(() => {});
    const quitarRealtime = subscribeLiveSession(iglesiaId, aplicar);
    return () => { quitarRealtime(); quitarLocal(); };
  }, [iglesiaId]);

  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const alCambiar = () => setVertical(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);
  useEffect(() => {
    const mover = () => {
      setCursorOculto(false);
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => setCursorOculto(true), CURSOR_IDLE_MS);
    };
    mover();
    window.addEventListener("mousemove", mover);
    window.addEventListener("touchstart", mover);
    return () => { window.removeEventListener("mousemove", mover); window.removeEventListener("touchstart", mover); clearTimeout(idleRef.current); };
  }, []);
  useEffect(() => { document.documentElement.requestFullscreen?.().catch(() => {}); }, []);

  const cambiarTamano = (d) => {
    const i = Math.min(TAMANOS.length - 1, Math.max(0, TAMANOS.indexOf(tamano) + d));
    setTamano(TAMANOS[i]);
    try { localStorage.setItem(CLAVE_TAMANO, String(TAMANOS[i])); } catch { /* sin storage */ }
  };

  const slide = fila?.slide_actual || null;
  const esc = slide?.escenario || null;
  const enVivo = !!(fila?.evento_id || fila?.libre);
  const reloj = new Date(ahora).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
  const transcurrido = esc?.inicio ? tiempoTranscurrido(esc.inicio, ahora) : "";

  // Lo que está al aire, como líneas de texto.
  let lineasAhora = [], etiquetaAhora = "", IconoAhora = Type;
  if (slide?.type === "cancion") { lineasAhora = (slide.lines || []).filter((l) => l && l.trim()); etiquetaAhora = slide.blockLabel || ""; IconoAhora = Music; }
  else if (slide?.type === "biblia") { lineasAhora = [slide.text || ""]; etiquetaAhora = slide.reference || ""; IconoAhora = BookOpen; }
  else if (slide) { lineasAhora = [slide.title, slide.subtitle].filter((t) => t && String(t).trim()); if (!lineasAhora.length) lineasAhora = [slide.nombre || "Diapositiva"]; etiquetaAhora = slide.diseno ? "Diapositiva con diseño" : ""; }
  const esVersiculo = slide?.type === "biblia";

  const sig = esc?.siguiente || null;
  const botonControl = { width: 40, height: 40, borderRadius: 20, background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

  return (
    <div style={{ height: "100dvh", minHeight: "100vh", background: "radial-gradient(ellipse at center 30%, #161B26 0%, #0A0C11 75%)", color: "#fff", fontFamily: "'Poppins', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", cursor: cursorOculto ? "none" : "default", boxSizing: "border-box", padding: "1.6vh 1.6vw", gap: "1.4vh" }}>
      {/* Mensaje de Multimedia: lo primero que se ve. El público no lo ve. */}
      {esc?.mensaje && (
        <div role="status" style={{ background: NARANJA, color: "#16233A", borderRadius: 14, padding: "1.2vh 2vw", display: "flex", alignItems: "center", gap: "1.2vw", animation: "wfEscenarioPulso 2s ease-in-out infinite", flexShrink: 0 }}>
          <MessageSquare size={30} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: `calc(clamp(22px, 5vh, 64px) * ${tamano})`, fontWeight: 800, lineHeight: 1.1 }}>{esc.mensaje}</span>
        </div>
      )}

      {/* Barra de arriba: canción, partes, reloj */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", flexShrink: 0, minHeight: "6vh" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "1vw", flexWrap: "wrap" }}>
          {esc?.cancion && (
            <span style={{ fontSize: "clamp(16px, 2.8vh, 34px)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
              {esc.cancion.titulo}{esc.cancion.tono && <span style={{ marginLeft: 10, fontFamily: "'JetBrains Mono', monospace", color: "#1F8A73", background: "rgba(31,138,115,0.18)", borderRadius: 8, padding: "2px 10px", fontSize: "0.8em" }}>{esc.cancion.tono}</span>}
            </span>
          )}
          {esc?.partes?.length > 0 && (
            <div aria-label="Partes de la canción" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {esc.partes.map((p, i) => (
                <span key={i} title={p.nombre} style={{
                  fontSize: "clamp(13px, 2.2vh, 28px)", fontWeight: 800, minWidth: "2.2em", textAlign: "center", padding: "0.3vh 0.8vw", borderRadius: 10,
                  background: i === esc.parteActual ? NARANJA : i < esc.parteActual ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.14)",
                  color: i === esc.parteActual ? "#16233A" : i < esc.parteActual ? "#5B6472" : "#fff",
                }}>{p.corto}</span>
              ))}
            </div>
          )}
          {!esc?.cancion && etiquetaAhora && <span style={{ fontSize: "clamp(16px, 2.8vh, 34px)", fontWeight: 700, color: esVersiculo ? "#7FA6E0" : "#fff" }}>{etiquetaAhora}</span>}
          {fila?.blanked && enVivo && <span style={{ fontSize: "clamp(11px, 1.6vh, 18px)", fontWeight: 700, color: "#fff", background: "#C23B32", borderRadius: 8, padding: "2px 10px" }}>PROYECCIÓN EN NEGRO</span>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "clamp(22px, 4.6vh, 60px)", fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{reloj}</div>
          {transcurrido && <div style={{ fontSize: "clamp(11px, 1.6vh, 20px)", color: GRIS, marginTop: 2, fontVariantNumeric: "tabular-nums" }}><span style={{ color: "#C23B32" }}>●</span> En vivo · {transcurrido}</div>}
        </div>
      </div>

      {!enVivo || !slide ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
          <div style={{ fontSize: "clamp(22px, 4vh, 48px)", fontWeight: 700 }}>Pantalla de escenario</div>
          <div style={{ fontSize: "clamp(14px, 2.2vh, 26px)", color: GRIS, maxWidth: 700 }}>{enVivo ? "En vivo. Cuando Multimedia ponga algo al aire, aparece aquí." : "Esperando a que Multimedia inicie la transmisión."}</div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: vertical ? "column" : "row", gap: "1.4vw" }}>
          {/* Izquierda: AHORA (grande) y SIGUE */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <Etiqueta color={NARANJA}><IconoAhora size={13} style={{ flexShrink: 0 }} />Ahora{etiquetaAhora && esc?.cancion ? ` · ${etiquetaAhora}` : ""}</Etiqueta>
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <AutoFitText
                  lines={lineasAhora} targetRatio={(esVersiculo ? 0.13 : 0.22) * tamano} minRatio={esVersiculo ? 0.05 : 0.09} minPx={18}
                  alinearH="flex-start" style={{ color: "#fff", fontWeight: 700, lineHeight: 1.2, textAlign: "left", whiteSpace: esVersiculo ? "normal" : "nowrap" }}
                />
              </div>
            </div>
            <div style={{ height: vertical ? "22%" : "27%", minHeight: 0, display: "flex", flexDirection: "column", borderTop: "2px solid rgba(255,255,255,0.08)", paddingTop: "1.2vh" }}>
              <Etiqueta>{sig ? `Sigue${sig.etiqueta ? ` · ${sig.etiqueta}` : ""}${esc?.siguienteEsOtro && sig.titulo && sig.titulo !== sig.etiqueta ? ` · ${sig.titulo}` : ""}` : "Sigue"}</Etiqueta>
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {sig ? (
                  <AutoFitText
                    lines={sig.lineas} targetRatio={(sig.tipo === "biblia" ? 0.2 : 0.32) * tamano} minRatio={0.12} minPx={14}
                    alinearH="flex-start" style={{ color: esc?.siguienteEsOtro ? "#7FA6E0" : "#9AA6B6", fontWeight: 600, lineHeight: 1.2, textAlign: "left", whiteSpace: sig.tipo === "biblia" ? "normal" : "nowrap" }}
                  />
                ) : <div style={{ color: "#5B6472", fontSize: "clamp(14px, 2.4vh, 28px)" }}>Fin del orden del culto</div>}
              </div>
            </div>
          </div>

          {/* Derecha: lo que viene */}
          <div style={{ width: vertical ? "auto" : "min(32%, 520px)", flexShrink: 0, display: "flex", flexDirection: vertical ? "row" : "column", gap: "1.2vh", minHeight: 0, flexWrap: vertical ? "wrap" : "nowrap" }}>
            {esc?.siguienteParte && (
              <Tarjeta style={{ flex: vertical ? 1 : "none" }}>
                <Etiqueta>Siguiente parte</Etiqueta>
                <div style={{ fontSize: `calc(clamp(20px, 4.4vh, 56px) * ${tamano})`, fontWeight: 800, color: NARANJA, lineHeight: 1.1 }}>{esc.siguienteParte}</div>
              </Tarjeta>
            )}
            {esc?.siguienteCancion && (
              <Tarjeta style={{ flex: vertical ? 1 : "none" }}>
                <Etiqueta>Siguiente canción</Etiqueta>
                <div style={{ fontSize: `calc(clamp(16px, 3vh, 38px) * ${tamano})`, fontWeight: 700, lineHeight: 1.2 }}>
                  {esc.siguienteCancion.titulo}
                  {esc.siguienteCancion.tono && <span style={{ marginLeft: 10, fontFamily: "'JetBrains Mono', monospace", color: "#1F8A73", fontSize: "0.85em" }}>{esc.siguienteCancion.tono}</span>}
                </div>
              </Tarjeta>
            )}
            {!vertical && esc?.proximos?.length > 0 && (
              <Tarjeta style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <Etiqueta>Después</Etiqueta>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.9vh" }}>
                  {esc.proximos.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: `calc(clamp(13px, 2.2vh, 28px) * ${tamano})`, color: p.tipo === "seccion" ? GRIS : "#E6EAF0", fontWeight: p.tipo === "seccion" ? 700 : 500, textTransform: p.tipo === "seccion" ? "uppercase" : "none", letterSpacing: p.tipo === "seccion" ? 0.8 : 0 }}>
                      {p.tipo !== "seccion" && <span style={{ width: 8, height: 8, borderRadius: 4, flexShrink: 0, background: p.tipo === "cancion" ? NARANJA : p.tipo === "biblia" ? "#2F5FA8" : "#B15EA0" }} />}
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</span>
                      {p.tono && <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#1F8A73", fontSize: "0.85em" }}>{p.tono}</span>}
                    </div>
                  ))}
                </div>
              </Tarjeta>
            )}
          </div>
        </div>
      )}

      {/* Controles: aparecen al mover el mouse o tocar, y se esconden solos */}
      {!cursorOculto && (
        <div style={{ position: "fixed", right: 14, bottom: 14, display: "flex", gap: 8, zIndex: 10 }}>
          <button type="button" onClick={() => cambiarTamano(-1)} style={botonControl} aria-label="Letra más pequeña" title="Letra más pequeña"><Minus size={18} /></button>
          <button type="button" onClick={() => cambiarTamano(1)} style={botonControl} aria-label="Letra más grande" title="Letra más grande"><Plus size={18} /></button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} style={botonControl} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={17} /></button>
          <button type="button" onClick={() => { document.exitFullscreen?.().catch(() => {}); window.location.href = window.location.origin + "/"; }} style={botonControl} aria-label="Salir de la pantalla de escenario" title="Salir"><X size={18} /></button>
        </div>
      )}
      <style>{"@keyframes wfEscenarioPulso { 0%, 100% { opacity: 1 } 50% { opacity: .82 } }"}</style>
    </div>
  );
}
