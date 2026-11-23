import { useEffect, useRef, useState } from "react";
import { X, Minus, Plus, Maximize, Music, BookOpen, Type, MessageSquare, Timer, LayoutGrid, Check } from "lucide-react";
import { parseChordLine, buildChordRow } from "./lib/musicTheory.js";
import AutoFitText from "./components/AutoFitText.jsx";
import { leerEscenarioDeUrl } from "./lib/enlacePantalla.js";
import { tiempoTranscurrido, restanteTemporizador, textoTemporizador, nivelTemporizador, VISTAS_ESCENARIO, vistaInicial } from "./lib/escenario.js";
import { useSesionPublica } from "./lib/usarSesionPublica.js";
import EnlaceVencido from "./components/EnlaceVencido.jsx";
import { soportaPantallaCompleta, pedirPantallaCompleta, salirDePantallaCompleta } from "./lib/pantallaCompleta.js";
import AvisoIphone from "./components/AvisoIphone.jsx";
import { segundosRestantes, textoCuenta } from "./lib/cuentaRegresiva.js";

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
const CLAVE_VISTA = "worshipflow_escenario_vista";
const TEAL = "#1F8A73";
// Cada mensaje nuevo de Multimedia ocupa TODA la pantalla estos segundos (pedido de Eldin, 2026-11-22:
// "enviamos un mensaje y ni lo vio"). Después queda como franja arriba hasta que Multimedia lo quite.
const ALERTA_SEG = 12;

function leerVistaGuardada() {
  try { return localStorage.getItem(CLAVE_VISTA); } catch { return null; }
}

function leerTamano() {
  try { const v = Number(localStorage.getItem(CLAVE_TAMANO)); return TAMANOS.includes(v) ? v : 1; } catch { return 1; }
}

function Etiqueta({ children, color = GRIS }) {
  return <div style={{ fontSize: "clamp(11px, 1.3vh, 16px)", fontWeight: 700, letterSpacing: 1.2, color, textTransform: "uppercase", marginBottom: "0.6vh", display: "flex", alignItems: "center", gap: 6 }}>{children}</div>;
}

function Tarjeta({ children, style }) {
  return <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "1.4vh 1.4vw", ...style }}>{children}</div>;
}

// Un renglón con los acordes arriba de cada palabra (como la vista del músico): el acorde nunca se
// separa de su palabra y el renglón se acomoda solo si no cabe a lo ancho.
function RenglonConAcordes({ raw, tamanoPx, atenuado = false }) {
  const palabras = String(raw || "").split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: tamanoPx * 0.15, marginBottom: tamanoPx * 0.35 }}>
      {palabras.map((p, i) => {
        const { plain, positions } = parseChordLine(p);
        const fila = buildChordRow(positions);
        return (
          <span key={i} style={{ display: "inline-flex", flexDirection: "column", marginRight: "0.45em", whiteSpace: "pre", fontSize: tamanoPx, lineHeight: 1.1 }}>
            <span style={{ color: atenuado ? "#5FA898" : "#3FD1AE", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82em", minHeight: "1.15em" }}>{fila || "\u00A0"}</span>
            <span style={{ color: atenuado ? "#9AA6B6" : "#fff", fontWeight: 700 }}>{plain || "\u00A0"}</span>
          </span>
        );
      })}
    </div>
  );
}

// Tamaño de letra para que una parte quepa sin partir renglones: por alto (cada renglón ocupa ~2.6
// alturas: acordes + letra + espacio) y por ancho (el renglón más largo). Con la ventana real.
function tamanoParaRenglones(renglones, altoDisponible, anchoDisponible, tamano, max) {
  const porAlto = altoDisponible / Math.max(3, renglones.length) / 2.6;
  const largo = Math.max(10, ...renglones.map((l) => parseChordLine(l).plain.length));
  const porAncho = anchoDisponible / (largo * 0.62);
  return Math.max(16, Math.min(max, porAlto, porAncho)) * tamano;
}

export default function PantallaEscenario() {
  const [ahora, setAhora] = useState(() => Date.now());
  const [tamano, setTamano] = useState(leerTamano);
  const [cursorOculto, setCursorOculto] = useState(false);
  const [vertical, setVertical] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth);
  const [altoVentana, setAltoVentana] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  const [anchoVentana, setAnchoVentana] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  // Diseño de esta pantalla (2026-11-22): cada monitor elige el suyo. El enlace (?vista=) manda sobre lo guardado.
  const [vista, setVista] = useState(() => vistaInicial(typeof window !== "undefined" ? window.location.search : "", leerVistaGuardada()));
  const [menuVista, setMenuVista] = useState(false);
  const [alerta, setAlerta] = useState(null); // { texto, hasta } mientras el mensaje ocupa toda la pantalla
  const ultimoMensajeRef = useRef("");
  const idleRef = useRef(null);

  // Iglesia y código secreto vienen del enlace (/e/<iglesia>/<código>); el código vence al finalizar cada
  // transmisión. Misma lectura que la Proyección — ver useSesionPublica.
  const [enlace] = useState(() => leerEscenarioDeUrl(window.location.pathname, window.location.search) || {});
  const { fila, vencido } = useSesionPublica({ slug: enlace.slug || null, codigo: enlace.codigo || null });

  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const alCambiar = () => { setVertical(window.innerHeight > window.innerWidth); setAltoVentana(window.innerHeight); setAnchoVentana(window.innerWidth); };
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
  useEffect(() => { pedirPantallaCompleta(); }, []);

  const cambiarTamano = (d) => {
    const i = Math.min(TAMANOS.length - 1, Math.max(0, TAMANOS.indexOf(tamano) + d));
    setTamano(TAMANOS[i]);
    try { localStorage.setItem(CLAVE_TAMANO, String(TAMANOS[i])); } catch { /* sin storage */ }
  };

  const elegirVista = (id) => {
    setVista(id);
    setMenuVista(false);
    try { localStorage.setItem(CLAVE_VISTA, id); } catch { /* sin storage */ }
  };

  const slide = fila?.slide_actual || null;
  // Con nada al aire, el mensaje y el temporizador llegan aparte (estilo_en_vivo.escenarioSinDiapositiva).
  const esc = slide?.escenario || (!slide ? fila?.estilo_en_vivo?.escenarioSinDiapositiva : null) || null;
  const mensajeActual = esc?.mensaje || "";
  useEffect(() => {
    if (mensajeActual && mensajeActual !== ultimoMensajeRef.current) setAlerta({ texto: mensajeActual, hasta: Date.now() + ALERTA_SEG * 1000 });
    if (!mensajeActual) setAlerta(null);
    ultimoMensajeRef.current = mensajeActual;
  }, [mensajeActual]);
  const alertaVisible = alerta && alerta.texto === mensajeActual && ahora < alerta.hasta ? alerta : null;
  const enVivo = !!(fila?.evento_id || fila?.libre);
  const reloj = new Date(ahora).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
  const transcurrido = esc?.inicio ? tiempoTranscurrido(esc.inicio, ahora) : "";
  // Temporizador del mensaje (lo maneja Multimedia): blanco, naranja en los últimos 5 min, rojo si se pasa.
  const restante = restanteTemporizador(esc?.temporizador, ahora);
  const nivel = nivelTemporizador(restante);
  const colorTemporizador = nivel === "excedido" ? "#FF5A4E" : nivel === "aviso" ? NARANJA : "#fff";
  const pred = esc?.predicacion || null;

  // Lo que está al aire, como líneas de texto.
  let lineasAhora = [], etiquetaAhora = "", IconoAhora = Type;
  if (slide?.type === "cancion") { lineasAhora = (slide.lines || []).filter((l) => l && l.trim()); etiquetaAhora = slide.blockLabel || ""; IconoAhora = Music; }
  else if (slide?.type === "biblia") { lineasAhora = [slide.text || ""]; etiquetaAhora = `${slide.reference || ""}${slide.version ? ` · ${slide.version}` : ""}`; IconoAhora = BookOpen; }
  else if (slide?.cuenta) {
    // Cuenta regresiva (2026-11-05): el equipo ve cuánto falta, en grande.
    const seg = segundosRestantes(slide.cuenta.hasta, ahora);
    lineasAhora = [seg === 0 && slide.cuenta.alTerminar === "mensaje" ? slide.cuenta.mensajeFinal || "¡Bienvenidos!" : textoCuenta(seg ?? (slide.cuenta.minutos || 5) * 60)];
    etiquetaAhora = slide.cuenta.mostrarTexto && slide.cuenta.texto ? `Cuenta regresiva · ${slide.cuenta.texto}` : "Cuenta regresiva";
    IconoAhora = Timer;
  }
  else if (slide) { lineasAhora = [slide.title, slide.subtitle].filter((t) => t && String(t).trim()); if (!lineasAhora.length) lineasAhora = [slide.nombre || "Diapositiva"]; etiquetaAhora = slide.diseno ? "Diapositiva con diseño" : ""; }
  const esVersiculo = slide?.type === "biblia";

  const sig = esc?.siguiente || null;
  // ---- Diseño "Banda con acordes" ----
  const acordes = esc?.acordes || null;
  const renglonesAhora = acordes?.ahora?.lineas || [];
  const tamAcordes = tamanoParaRenglones(renglonesAhora, altoVentana * (esc?.mensaje ? 0.6 : 0.72), anchoVentana * (vertical ? 0.94 : 0.6), tamano, altoVentana * 0.075);
  const renglonesSigue = (acordes?.sigue?.lineas || []).slice(0, 4);
  const tamSigue = Math.max(14, Math.min(altoVentana * 0.034, tamAcordes * 0.6));
  const cuerpoBanda = (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: vertical ? "column" : "row", gap: "1.4vw" }}>
      <div aria-label="Parte actual con acordes" style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Etiqueta color={NARANJA}><IconoAhora size={13} style={{ flexShrink: 0 }} />Ahora{acordes?.ahora?.etiqueta ? ` · ${acordes.ahora.etiqueta}` : etiquetaAhora ? ` · ${etiquetaAhora}` : ""}</Etiqueta>
        {renglonesAhora.length > 0 ? (
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", paddingTop: "0.6vh" }}>
            {renglonesAhora.map((l, i) => <RenglonConAcordes key={i} raw={l} tamanoPx={tamAcordes} />)}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <AutoFitText lines={lineasAhora} targetRatio={(esVersiculo ? 0.13 : 0.2) * tamano} minRatio={esVersiculo ? 0.05 : 0.09} minPx={18} alinearH="flex-start" style={{ color: "#fff", fontWeight: 700, lineHeight: 1.2, textAlign: "left", whiteSpace: esVersiculo ? "normal" : "nowrap" }} />
          </div>
        )}
      </div>
      <div style={{ width: vertical ? "auto" : "min(34%, 560px)", flexShrink: 0, display: "flex", flexDirection: vertical ? "row" : "column", gap: "1.2vh", minHeight: 0, flexWrap: vertical ? "wrap" : "nowrap" }}>
        {acordes?.sigue ? (
          <Tarjeta style={{ flex: vertical ? 1 : "none", minHeight: 0, overflow: "hidden" }}>
            <Etiqueta>Siguiente parte</Etiqueta>
            <div style={{ fontSize: `calc(clamp(18px, 3.6vh, 46px) * ${tamano})`, fontWeight: 800, color: NARANJA, lineHeight: 1.1, marginBottom: "1vh" }}>{acordes.sigue.etiqueta}</div>
            {renglonesSigue.map((l, i) => <RenglonConAcordes key={i} raw={l} tamanoPx={tamSigue} atenuado />)}
          </Tarjeta>
        ) : sig ? (
          <Tarjeta style={{ flex: vertical ? 1 : "none" }}>
            <Etiqueta>{`Sigue${sig.etiqueta ? ` · ${sig.etiqueta}` : ""}`}</Etiqueta>
            <div style={{ fontSize: `calc(clamp(15px, 2.6vh, 32px) * ${tamano})`, color: esc?.siguienteEsOtro ? "#7FA6E0" : "#9AA6B6", fontWeight: 600, lineHeight: 1.25 }}>{sig.titulo && esc?.siguienteEsOtro ? sig.titulo : (sig.lineas || []).join(" · ")}</div>
          </Tarjeta>
        ) : null}
        {esc?.siguienteCancion && (
          <Tarjeta style={{ flex: vertical ? 1 : "none" }}>
            <Etiqueta>Siguiente canción</Etiqueta>
            <div style={{ fontSize: `calc(clamp(16px, 3vh, 38px) * ${tamano})`, fontWeight: 700, lineHeight: 1.2 }}>
              {esc.siguienteCancion.titulo}
              {esc.siguienteCancion.tono && <span style={{ marginLeft: 10, fontFamily: "'JetBrains Mono', monospace", color: TEAL, fontSize: "0.85em" }}>{esc.siguienteCancion.tono}</span>}
            </div>
          </Tarjeta>
        )}
      </div>
    </div>
  );

  // ---- Diseño "Predicador con notas y tiempo" ----
  const cuerpoPredicador = (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: vertical ? "column" : "row", gap: "1.4vw" }}>
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: "1.4vh" }}>
        {/* Arriba y en grande: lo que está en pantalla (pedido de Eldin, 2026-11-22). Abajo, el tiempo. */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Etiqueta color={NARANJA}><IconoAhora size={13} style={{ flexShrink: 0 }} />En pantalla{etiquetaAhora ? ` · ${etiquetaAhora}` : ""}</Etiqueta>
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {lineasAhora.length > 0
              ? <AutoFitText lines={lineasAhora} targetRatio={(esVersiculo ? 0.13 : 0.2) * tamano} minRatio={esVersiculo ? 0.05 : 0.09} minPx={18} alinearH="flex-start" style={{ color: "#fff", fontWeight: 700, lineHeight: 1.2, textAlign: "left", whiteSpace: "normal" }} />
              : <div style={{ fontSize: "clamp(16px, 3vh, 36px)", color: "#5B6472" }}>Nada en pantalla ahora</div>}
          </div>
        </div>
        <Tarjeta style={{ height: vertical ? "24%" : "30%", minHeight: 0, flexShrink: 0, display: "flex", alignItems: "center", gap: "2.5vw", background: nivel === "excedido" ? "rgba(194,59,50,0.22)" : nivel === "aviso" ? "rgba(232,130,30,0.16)" : "rgba(255,255,255,0.05)" }}>
          {restante != null ? (
            <>
              <div aria-label="Temporizador del mensaje" style={{ fontSize: `calc(min(19vh, 12vw) * ${tamano})`, fontWeight: 800, color: colorTemporizador, lineHeight: 1, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{textoTemporizador(restante)}</div>
              <div style={{ minWidth: 0 }}>
                <Etiqueta color={nivel === "normal" ? GRIS : colorTemporizador}>{nivel === "excedido" ? "Se pasó del tiempo" : esc.temporizador.finEn ? "Tiempo del mensaje" : "Tiempo del mensaje · en pausa"}</Etiqueta>
                <div style={{ fontSize: `calc(clamp(16px, 3.4vh, 42px) * ${tamano})`, fontWeight: 700, color: "#C9D2DE", fontVariantNumeric: "tabular-nums" }}>Hora {reloj}</div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: `calc(min(15vh, 10vw) * ${tamano})`, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{reloj}</div>
              <div style={{ minWidth: 0 }}>
                {transcurrido && <div style={{ fontSize: `calc(clamp(15px, 3vh, 38px) * ${tamano})`, color: "#C9D2DE", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}><span style={{ color: "#C23B32" }}>●</span> Tiempo del culto · {transcurrido}</div>}
                <div style={{ marginTop: "1vh", fontSize: "clamp(11px, 1.6vh, 18px)", color: GRIS, lineHeight: 1.4 }}>El temporizador del mensaje sale aquí cuando Multimedia lo inicia (Escenario → Temporizador).</div>
              </div>
            </>
          )}
        </Tarjeta>
      </div>
      <div style={{ width: vertical ? "auto" : "min(40%, 680px)", flexShrink: 0, display: "flex", flexDirection: "column", gap: "1.2vh", minHeight: 0 }}>
        {pred ? (
          <Tarjeta style={{ flex: 1, minHeight: 0, overflow: "hidden", borderLeft: "4px solid #F6C344" }}>
            <Etiqueta color="#F6C344">{pred.punto && pred.total ? `Punto ${pred.punto} de ${pred.total}` : "Tu bosquejo"}{pred.titulo ? ` · ${pred.titulo}` : ""}</Etiqueta>
            {pred.nota
              ? <div style={{ fontSize: `calc(clamp(18px, 3.4vh, 44px) * ${tamano})`, color: "#FFF4D6", lineHeight: 1.35, whiteSpace: "pre-line" }}>{pred.nota}</div>
              : <div style={{ fontSize: "clamp(14px, 2.2vh, 26px)", color: GRIS }}>Este punto no tiene nota.</div>}
          </Tarjeta>
        ) : (
          <>
            {/* Sin bosquejo al aire: lo que sigue y lo que viene en el culto, para que la pantalla no quede vacía. */}
            {sig && (
              <Tarjeta>
                <Etiqueta>{`Sigue${sig.etiqueta ? ` · ${sig.etiqueta}` : ""}`}</Etiqueta>
                <div style={{ fontSize: `calc(clamp(16px, 3vh, 38px) * ${tamano})`, color: "#E6EAF0", fontWeight: 600, lineHeight: 1.3 }}>{esc?.siguienteEsOtro && sig.titulo ? sig.titulo : (sig.lineas || []).join(" · ")}</div>
              </Tarjeta>
            )}
            {esc?.proximos?.length > 0 && (
              <Tarjeta style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <Etiqueta>Lo que viene en el culto</Etiqueta>
                <div style={{ display: "flex", flexDirection: "column", gap: "1vh" }}>
                  {esc.proximos.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: `calc(clamp(15px, 2.6vh, 32px) * ${tamano})`, color: p.tipo === "seccion" ? GRIS : "#E6EAF0", fontWeight: p.tipo === "seccion" ? 700 : 500, textTransform: p.tipo === "seccion" ? "uppercase" : "none" }}>
                      {p.tipo !== "seccion" && <span style={{ width: 9, height: 9, borderRadius: 5, flexShrink: 0, background: p.tipo === "cancion" ? NARANJA : p.tipo === "biblia" ? "#2F5FA8" : "#B15EA0" }} />}
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.titulo}</span>
                    </div>
                  ))}
                </div>
              </Tarjeta>
            )}
            <Tarjeta style={{ flex: esc?.proximos?.length ? "none" : 1, borderLeft: "4px solid #F6C344" }}>
              <Etiqueta color="#F6C344">Tu bosquejo</Etiqueta>
              <div style={{ fontSize: "clamp(13px, 2vh, 24px)", color: GRIS, lineHeight: 1.4 }}>Cuando Multimedia ponga al aire tu bosquejo, aquí salen el punto en el que vas, tu nota y los próximos versículos.</div>
            </Tarjeta>
          </>
        )}
        {pred?.proximosVersiculos?.length > 0 && (
          <Tarjeta>
            <Etiqueta>Próximos versículos</Etiqueta>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
              {pred.proximosVersiculos.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: `calc(clamp(15px, 2.8vh, 34px) * ${tamano})`, color: "#7FA6E0", fontWeight: 600 }}>
                  <BookOpen size={18} style={{ flexShrink: 0 }} />{r}
                </div>
              ))}
            </div>
          </Tarjeta>
        )}
      </div>
    </div>
  );

  // ---- Diseño "Solo reloj" ----
  const cuerpoReloj = (
    <div aria-label="Reloj" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2vh", textAlign: "center" }}>
      <div style={{ fontSize: `calc(min(34vh, 24vw) * ${tamano})`, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: -2 }}>{reloj}</div>
      {transcurrido && <div style={{ fontSize: "clamp(16px, 3.4vh, 42px)", color: GRIS, fontVariantNumeric: "tabular-nums" }}><span style={{ color: "#C23B32" }}>●</span> En vivo · {transcurrido}</div>}
    </div>
  );

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

      {/* Barra de arriba: canción, partes, reloj (el diseño "Solo reloj" no la necesita) */}
      {vista !== "reloj" && <div style={{ display: "flex", alignItems: "center", gap: "1.5vw", flexShrink: 0, minHeight: "6vh" }}>
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
      </div>}

      {vencido ? (
        <div style={{ flex: 1, display: "flex" }}><EnlaceVencido tipo="escenario" /></div>
      ) : vista === "reloj" ? cuerpoReloj : !enVivo || (!slide && vista !== "predicador") ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center" }}>
          <div style={{ fontSize: "clamp(22px, 4vh, 48px)", fontWeight: 700 }}>Pantalla de escenario</div>
          <div style={{ fontSize: "clamp(14px, 2.2vh, 26px)", color: GRIS, maxWidth: 700 }}>{enVivo ? "En vivo. Cuando Multimedia ponga algo al aire, aparece aquí." : "Esperando a que Multimedia inicie la transmisión."}</div>
        </div>
      ) : vista === "banda" ? cuerpoBanda : vista === "predicador" ? cuerpoPredicador : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: vertical ? "column" : "row", gap: "1.4vw" }}>
          {/* Izquierda: AHORA (grande) y SIGUE */}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: "1.4vh" }}>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <Etiqueta color={NARANJA}><IconoAhora size={13} style={{ flexShrink: 0 }} />Ahora{etiquetaAhora && esc?.cancion ? ` · ${etiquetaAhora}` : ""}{pred?.punto && pred?.total ? ` · Punto ${pred.punto} de ${pred.total}` : ""}</Etiqueta>
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
            {restante != null && (
              <Tarjeta style={{ flex: vertical ? 1 : "none", background: nivel === "excedido" ? "rgba(194,59,50,0.22)" : nivel === "aviso" ? "rgba(232,130,30,0.16)" : "rgba(255,255,255,0.05)" }}>
                <Etiqueta color={nivel === "normal" ? GRIS : colorTemporizador}>{nivel === "excedido" ? "Se pasó del tiempo" : esc.temporizador.finEn ? "Tiempo del mensaje" : "Tiempo del mensaje · en pausa"}</Etiqueta>
                <div aria-label="Temporizador del mensaje" style={{ fontSize: `calc(clamp(34px, 9vh, 120px) * ${tamano})`, fontWeight: 800, color: colorTemporizador, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{textoTemporizador(restante)}</div>
              </Tarjeta>
            )}
            {pred && (pred.nota || (pred.punto && pred.total)) && (
              <Tarjeta style={{ flex: vertical ? 1 : "none", borderLeft: "4px solid #F6C344" }}>
                <Etiqueta color="#F6C344">{pred.punto && pred.total ? `Punto ${pred.punto} de ${pred.total}` : "Tu bosquejo"}{pred.nota ? " · Tu nota" : ""}</Etiqueta>
                {pred.nota
                  ? <div style={{ fontSize: `calc(clamp(15px, 2.6vh, 32px) * ${tamano})`, color: "#FFF4D6", lineHeight: 1.35, whiteSpace: "pre-line", maxHeight: "28vh", overflow: "hidden" }}>{pred.nota}</div>
                  : <div style={{ fontSize: "clamp(13px, 2vh, 22px)", color: GRIS }}>{pred.titulo}</div>}
              </Tarjeta>
            )}
            {pred?.proximosVersiculos?.length > 0 && (
              <Tarjeta style={{ flex: vertical ? 1 : "none" }}>
                <Etiqueta>Próximos versículos</Etiqueta>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6vh" }}>
                  {pred.proximosVersiculos.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: `calc(clamp(14px, 2.4vh, 30px) * ${tamano})`, color: "#7FA6E0", fontWeight: 600 }}>
                      <BookOpen size={16} style={{ flexShrink: 0 }} />{r}
                    </div>
                  ))}
                </div>
              </Tarjeta>
            )}
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
      {menuVista && (
        <div role="menu" aria-label="Diseño de esta pantalla" style={{ position: "fixed", right: 14, bottom: 64, zIndex: 11, width: "min(360px, calc(100vw - 28px))", background: "#1B2130", borderRadius: 16, padding: 8, boxShadow: "0 18px 50px rgba(0,0,0,.55)", fontFamily: "'Inter', sans-serif" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GRIS, letterSpacing: 0.6, padding: "6px 10px 8px", textTransform: "uppercase" }}>Qué muestra esta pantalla</div>
          {VISTAS_ESCENARIO.map((v) => (
            <button key={v.id} type="button" role="menuitemradio" aria-checked={vista === v.id} onClick={() => elegirVista(v.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 10px", borderRadius: 12, border: "none", cursor: "pointer", background: vista === v.id ? "rgba(232,130,30,0.18)" : "transparent", color: "#fff", fontFamily: "inherit" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: vista === v.id ? NARANJA : "#fff" }}>{v.nombre}</span>
                <span style={{ display: "block", fontSize: 12.5, color: GRIS, marginTop: 2 }}>{v.detalle}</span>
              </span>
              {vista === v.id && <Check size={18} color={NARANJA} style={{ flexShrink: 0 }} />}
            </button>
          ))}
        </div>
      )}
      {(!cursorOculto || menuVista) && (
        <div style={{ position: "fixed", right: 14, bottom: 14, display: "flex", gap: 8, zIndex: 10 }}>
          <button type="button" onClick={() => setMenuVista((m) => !m)} style={{ ...botonControl, width: "auto", padding: "0 14px", gap: 7, fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", background: menuVista ? NARANJA : botonControl.background }} aria-label="Diseño de esta pantalla" aria-expanded={menuVista} title="Diseño de esta pantalla"><LayoutGrid size={17} />Diseño</button>
          <button type="button" onClick={() => cambiarTamano(-1)} style={botonControl} aria-label="Letra más pequeña" title="Letra más pequeña"><Minus size={18} /></button>
          <button type="button" onClick={() => cambiarTamano(1)} style={botonControl} aria-label="Letra más grande" title="Letra más grande"><Plus size={18} /></button>
          {soportaPantallaCompleta() && <button type="button" onClick={() => pedirPantallaCompleta()} style={botonControl} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={17} /></button>}
          <button type="button" onClick={() => { salirDePantallaCompleta(); window.location.href = window.location.origin + "/"; }} style={botonControl} aria-label="Salir de la pantalla de escenario" title="Salir"><X size={18} /></button>
        </div>
      )}
      {/* Mensaje nuevo de Multimedia: a pantalla completa, imposible de no ver. Tocar lo achica. */}
      {alertaVisible && (
        <div role="alert" onClick={() => setAlerta(null)} style={{ position: "fixed", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3vh", padding: "5vh 5vw", boxSizing: "border-box", textAlign: "center", color: "#16233A", background: NARANJA, animation: "wfEscenarioAlerta 1.2s ease-in-out infinite", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1vw", fontSize: "clamp(16px, 3.4vh, 40px)", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            <MessageSquare size={36} style={{ flexShrink: 0 }} />Mensaje de Multimedia
          </div>
          <div style={{ fontSize: `calc(min(18vh, ${Math.max(6, Math.min(14, 150 / Math.max(1, alertaVisible.texto.length)))}vw) * ${tamano})`, fontWeight: 900, lineHeight: 1.05, maxWidth: "100%", overflowWrap: "anywhere" }}>{alertaVisible.texto}</div>
          <div style={{ width: "min(60vw, 700px)", height: 8, borderRadius: 4, background: "rgba(22,35,58,0.2)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#16233A", width: `${Math.max(0, Math.min(100, ((alertaVisible.hasta - ahora) / (ALERTA_SEG * 1000)) * 100))}%`, transition: "width 1s linear" }} />
          </div>
          <div style={{ fontSize: "clamp(12px, 2vh, 22px)", fontWeight: 600, opacity: 0.75 }}>Toca la pantalla para achicarlo · queda arriba hasta que Multimedia lo quite</div>
        </div>
      )}
      <AvisoIphone />
      <style>{"@keyframes wfEscenarioPulso { 0%, 100% { opacity: 1 } 50% { opacity: .82 } } @keyframes wfEscenarioAlerta { 0%, 100% { background: #E8821E } 50% { background: #FFB347 } }"}</style>
    </div>
  );
}
