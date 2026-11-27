// Ventana para preparar una cuenta regresiva (2026-11-05): se usa desde el Setlist (queda como un elemento
// más del culto) y desde la consola en vivo (se proyecta al momento). Vista previa grande arriba, galería
// de los 20 estilos y las opciones (hasta cuándo, texto de arriba opcional, qué pasa al llegar a cero).
import { useState } from "react";
import { createPortal } from "react-dom";
import { Timer, X, Check } from "lucide-react";
import RelojCuentaRegresiva, { ESTILOS_CUENTA } from "./RelojCuentaRegresiva.jsx";
import { normalizarCuenta, horaDelEvento, MINUTOS_RAPIDOS, AL_TERMINAR, FONDOS_CUENTA } from "../lib/cuentaRegresiva.js";
import { inputStyle, primaryBtn, iconGhost } from "../pantallas/compartido.jsx";
import { MediaPicker } from "../pantallas/ventanas.jsx";
import { COLORES_LISOS } from "../lib/fondoDiapositiva.js";

import { useCerrarConAtras } from "../lib/atras.js";
const MORADO = "#5661B3";

function Titulo({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, margin: "14px 0 6px" }}>{children}</div>;
}

function Pastilla({ activo, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={activo}
      style={{ fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", background: activo ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: activo ? "var(--wf-on-brand-accent)" : "var(--wf-text)" }}>
      {children}
    </button>
  );
}

// inicial: configuración guardada (o nada para una nueva). evento: para mostrar la hora del culto.
// enConsola: el botón dice "Proyectar ahora" en vez de "Agregar al Setlist"/"Guardar".
// iglesiaId: para subir o elegir la imagen/video de fondo. siguiente: nombre de lo que sigue en el orden del
// culto (para decir a dónde pasa al llegar a cero); null si no se sabe.
export default function CuentaRegresivaModal({ inicial = null, evento = null, enConsola = false, editando = false, iglesiaId = null, siguiente = null, onClose, onGuardar }) {
  useCerrarConAtras(true, onClose); // atrás del teléfono cierra esta ventana (ver lib/atras.js)
  const [c, setC] = useState(() => normalizarCuenta(inicial));
  const set = (patch) => setC((x) => ({ ...x, ...patch }));
  const horaCulto = horaDelEvento(evento);
  const textoHora = horaCulto ? new Date(horaCulto).toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" }) : null;
  // Vista previa: con la hora del culto, lo que falta de verdad (si falta menos de un día); si no, los minutos.
  const faltan = horaCulto ? Math.round((horaCulto - Date.now()) / 1000) : null;
  const muestra = c.modo === "hora" && faltan != null && faltan > 0 && faltan < 86400 ? faltan : c.minutos * 60;
  const boton = enConsola ? "Proyectar ahora" : editando ? "Guardar cambios" : "Agregar al Setlist";

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 8, boxSizing: "border-box" }} onClick={onClose}>
      {/* El alto máximo es el 100% del fondo (que sí mide la ventana real), no 100dvh: en navegadores viejos
          dvh no existe y con letra "Grande" (zoom) mide de más, y el botón de abajo quedaba fuera de la pantalla. */}
      <div role="dialog" aria-label="Cuenta regresiva" onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--wf-card)", borderRadius: 18, boxShadow: "0 18px 50px rgba(0,0,0,.35)", width: "min(760px, 100%)", maxHeight: "100%", display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Timer size={17} color={MORADO} /><span style={{ fontWeight: 700, fontSize: 15 }}>Cuenta regresiva</span></div>
          <button type="button" onClick={onClose} style={iconGhost} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "0 16px 16px", flex: "1 1 auto", minHeight: 0 }}>
          {/* Vista previa (oscura, como se verá en la proyección) */}
          <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 14, overflow: "hidden", background: "#000" }}>
            <RelojCuentaRegresiva cuenta={c} muestra={muestra} />
          </div>

          <Titulo>¿HASTA CUÁNDO?</Titulo>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pastilla activo={c.modo === "hora"} onClick={() => set({ modo: "hora" })}>Hasta la hora del culto{textoHora ? ` (${textoHora})` : ""}</Pastilla>
            <Pastilla activo={c.modo === "minutos"} onClick={() => set({ modo: "minutos" })}>Por minutos</Pastilla>
          </div>
          {c.modo === "hora" && !textoHora && (
            <div style={{ fontSize: 12, color: "#C23B32", marginTop: 6 }}>{evento ? "Este evento no tiene hora: mientras no la tenga, contará los minutos de abajo." : "Sin evento con hora: contará los minutos de abajo."}</div>
          )}
          {(c.modo === "minutos" || !textoHora) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              {MINUTOS_RAPIDOS.map((m) => <Pastilla key={m} activo={c.minutos === m} onClick={() => set({ minutos: m })}>{m} min</Pastilla>)}
              <input type="number" min={0.5} max={600} step={0.5} value={c.minutos} aria-label="Minutos"
                onChange={(e) => set({ minutos: Number(e.target.value) || 1 })} style={{ ...inputStyle, width: 80 }} />
            </div>
          )}

          <Titulo>ESTILO ({ESTILOS_CUENTA.length})</Titulo>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 8 }}>
            {ESTILOS_CUENTA.map((e) => {
              const activo = c.estilo === e.id;
              return (
                <button key={e.id} type="button" onClick={() => set({ estilo: e.id })} aria-pressed={activo} title={e.nombre}
                  style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 10, overflow: "hidden", background: "#000", boxShadow: activo ? "0 0 0 3px var(--wf-brand-accent)" : "0 2px 8px rgba(22,50,79,0.15)" }}>
                    <RelojCuentaRegresiva cuenta={{ ...c, estilo: e.id, fondo: "propio" }} muestra={299} quieto />
                    {activo && <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: 10, background: "var(--wf-brand-accent)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}><Check size={13} color="#fff" /></div>}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: activo ? 700 : 500, color: activo ? "var(--wf-text)" : "var(--wf-muted)", marginTop: 4 }}>{e.nombre}</div>
                </button>
              );
            })}
          </div>

          {c.estilo === "dividido" && (
            <>
              <Titulo>VERSÍCULO</Titulo>
              <textarea value={c.versiculo} onChange={(e) => set({ versiculo: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} aria-label="Versículo" />
              <input value={c.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder="Ej. Salmo 118:24" style={{ ...inputStyle, marginTop: 6 }} aria-label="Cita del versículo" />
            </>
          )}

          <Titulo>TEXTO ARRIBA DEL RELOJ</Titulo>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Pastilla activo={c.mostrarTexto} onClick={() => set({ mostrarTexto: true })}>Con texto</Pastilla>
            <Pastilla activo={!c.mostrarTexto} onClick={() => set({ mostrarTexto: false })}>Solo el reloj</Pastilla>
          </div>
          {c.mostrarTexto && (
            <input value={c.texto} onChange={(e) => set({ texto: e.target.value })} placeholder="El servicio comienza en" style={{ ...inputStyle, marginTop: 8 }} aria-label="Texto arriba del reloj" />
          )}

          <Titulo>AL LLEGAR A CERO</Titulo>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {AL_TERMINAR.map((o) => <Pastilla key={o.id} activo={c.alTerminar === o.id} onClick={() => set({ alTerminar: o.id })}>{o.label}</Pastilla>)}
          </div>
          {c.alTerminar === "avanzar" && (
            <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 8, lineHeight: 1.45 }}>
              {enConsola
                ? "Al llegar a cero, la consola vuelve sola al orden del culto, donde lo dejaste."
                : siguiente
                  ? <>Al llegar a cero pasa sola a <b style={{ color: "var(--wf-text)" }}>{siguiente}</b>. Para cambiarlo, mueve en el orden del culto lo que quieres que salga después.</>
                  : "Al llegar a cero pasa sola a lo que sigue en el orden del culto (por ejemplo, tu diapositiva de Bienvenidos)."}
            </div>
          )}
          {c.alTerminar === "mensaje" && (
            <textarea value={c.mensajeFinal} onChange={(e) => set({ mensajeFinal: e.target.value })} rows={2} placeholder={"¡Iniciamos!\nBienvenidos"} style={{ ...inputStyle, marginTop: 8, resize: "vertical", fontFamily: "inherit" }} aria-label="Mensaje al llegar a cero" />
          )}

          <Titulo>FONDO</Titulo>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FONDOS_CUENTA.map((f) => (
              <Pastilla key={f.id} activo={c.fondo === f.id} onClick={() => set({ fondo: f.id })}
                title={f.id === "estilo" ? "El mismo fondo de la letra (tema, imagen o video de Estilo)" : undefined}>{f.label}</Pastilla>
            ))}
          </div>
          {c.fondo === "estilo" && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 6 }}>Sale con el fondo que esté puesto en Estilo en ese momento (el mismo de las canciones).</div>}
          {c.fondo === "color" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              {COLORES_LISOS.map((col) => (
                <button key={col} type="button" onClick={() => set({ fondoColor: col })} title={col} aria-label={`Color ${col}`} aria-pressed={c.fondoColor.toLowerCase() === col.toLowerCase()}
                  style={{ width: 34, height: 34, borderRadius: 12, background: col, border: c.fondoColor.toLowerCase() === col.toLowerCase() ? "3px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)", cursor: "pointer", padding: 0, boxSizing: "border-box" }} />
              ))}
              <label title="Elegir otro color" style={{ width: 34, height: 34, borderRadius: 12, border: "1px solid var(--wf-border)", cursor: "pointer", position: "relative", overflow: "hidden", background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)", display: "flex", boxSizing: "border-box" }}>
                <input type="color" aria-label="Otro color" value={c.fondoColor} onChange={(e) => set({ fondoColor: e.target.value })} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
              </label>
            </div>
          )}
          {(c.fondo === "imagen" || c.fondo === "video") && (
            <div style={{ marginTop: 8 }}>
              <MediaPicker key={c.fondo} iglesiaId={iglesiaId} tipo={c.fondo} value={c.fondo === "imagen" ? c.fondoImagen : c.fondoVideo}
                onChange={(url) => set(c.fondo === "imagen" ? { fondoImagen: url } : { fondoVideo: url })} color={MORADO} galeriaAbierta />
              {!(c.fondo === "imagen" ? c.fondoImagen : c.fondoVideo) && (
                <div style={{ fontSize: 12, color: "#C23B32", marginTop: 6 }}>Elige {c.fondo === "imagen" ? "una imagen" : "un video"} de la biblioteca o súbelo. Mientras no elijas, queda el fondo del estilo.</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--wf-muted)", margin: "10px 0 2px" }}>
                <span>Oscurecer {c.fondo === "imagen" ? "la imagen" : "el video"} (para que se lean los números)</span><b>{c.oscurecer}%</b>
              </div>
              <input type="range" min={0} max={80} step={5} value={c.oscurecer} aria-label="Oscurecer el fondo" onChange={(e) => set({ oscurecer: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--wf-brand-accent)" }} />
              {c.fondo === "video" && <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>El video se repite sin sonido mientras corre la cuenta.</div>}
            </div>
          )}
        </div>
        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--wf-border)", flexShrink: 0 }}>
          <button type="button" onClick={() => onGuardar(normalizarCuenta(c))} style={primaryBtn}>{boton}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
