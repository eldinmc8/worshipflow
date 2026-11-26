// Carrusel de la portada de la página web (pedido de Eldin, 2026-11-20): en lugar de una sola maqueta
// ("Culto del domingo"), la portada muestra una ventana de CADA función de la app, que se desliza sola
// hacia la izquierda. Son ilustraciones (no la app real); las funciones salen de lo que la app sí tiene.
// - Se desliza con el dedo (scroll-snap nativo), tiene puntos para saltar y se pausa al tocar o pasar el mouse.
// - Si la persona tiene activado "reducir movimiento", no avanza sola (solo con el dedo o los puntos).
// - Las ventanas son decorativas (aria-hidden); lo que leen los lectores de pantalla es el título y la frase de cada una.
import { useCallback, useEffect, useRef, useState } from "react";

const AZUL = "#16324F";
const NARANJA = "#E8821E";
const SOBRE_NARANJA = "#16233A";
const TINTA = "#0E1726";
const SUAVE = "#5A6678";
const NIEBLA = "#F3F5F9";
const LINEA = "#E3E7EE";
const OSCURO = "#0B1626";
const ROJO = "#C23B32";
const TEAL = "#1F8A73";
const AZUL_VERSO = "#2F5FA8";
const INDIGO = "#5661B3";
const ORQUIDEA = "#B15EA0";
const INTERVALO = 5200;
const REANUDAR_TRAS_TOQUE = 7000;

const css = `
.wfc-pista{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x pan-y;border-radius:14px}
.wfc-pista::-webkit-scrollbar{display:none}
.wfc-slide{flex:0 0 100%;min-width:0;scroll-snap-align:start;display:flex;flex-direction:column;gap:14px}
.wfc-v{height:326px;background:#fff;border:1px solid ${LINEA};border-radius:14px;overflow:hidden;display:flex;flex-direction:column;text-align:left}
.wfc-barra{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid ${NIEBLA};font-size:13px;font-weight:700;color:${TINTA};flex:none}
.wfc-punto{width:9px;height:9px;border-radius:50%;background:${LINEA}}
.wfc-cuerpo{flex:1;min-height:0;display:flex}
.wfc-chip{font-size:12px;font-weight:600;background:${NIEBLA};border-radius:6px;padding:4px 8px;color:${TINTA};white-space:nowrap}
.wfc-btn{font-size:13px;font-weight:600;text-align:center;padding:9px 0;border-radius:8px;background:${NIEBLA};color:${TINTA}}
.wfc-solo-ancho{display:flex}
.wfc-culto{flex-direction:row}
.wfc-culto-lista{flex:1 1 40%;min-width:0;border-right:1px solid ${NIEBLA};padding:6px 0;overflow:hidden}
.wfc-culto-pantalla{flex:1.5 1 60%;min-width:0;padding:12px;display:flex;flex-direction:column;gap:10px}
.wfc-solo-cel{display:none}
.wfc-dot{width:24px;height:24px;border:0;background:transparent;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%}
.wfc-dot span{display:block;height:8px;width:8px;border-radius:4px;background:#C5CCD8;transition:width .25s,background .25s}
.wfc-dot[aria-current="true"] span{width:22px;background:${NARANJA}}
.wfc-dot:focus-visible{outline:2px solid ${AZUL};outline-offset:1px}
@keyframes wfcBrillo{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes wfcAvance{0%{width:8%}100%{width:100%}}
@media (max-width:640px){
  .wfc-v{height:352px}
  .wfc-solo-ancho{display:none!important}
  .wfc-culto{flex-direction:column}
  .wfc-culto-lista{flex:none;border-right:0;border-bottom:1px solid ${NIEBLA};padding:2px 0}
  .wfc-culto-lista>div{padding-top:5px!important;padding-bottom:5px!important}
  .wfc-culto-pantalla{padding:10px 12px;gap:8px}
  .wfc-solo-cel{display:flex}
}
@media (prefers-reduced-motion:reduce){
  .wfc-pista{scroll-behavior:auto}
  .wfc-anim{animation:none!important}
}
`;

function Ventana({ titulo, insignia, children }) {
  return (
    <div className="wfc-v" aria-hidden="true">
      <div className="wfc-barra">
        <span style={{ display: "flex", gap: 5 }}><span className="wfc-punto" /><span className="wfc-punto" /><span className="wfc-punto" /></span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
        {insignia}
      </div>
      <div className="wfc-cuerpo">{children}</div>
    </div>
  );
}

const EnVivo = () => <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: ROJO, borderRadius: 6, padding: "2px 6px", flex: "none" }}>EN VIVO</span>;

// ---------- 1. Culto del domingo + proyección ----------
function VentanaCulto() {
  const orden = [["Bienvenida", "Slide"], ["Santo, Santo, Santo", "Canción · D"], ["Salmo 100", "Versículo · RVR1960"], ["Canción de respuesta", "Canción · G"], ["Anuncios", "Bloque"]];
  return (
    <Ventana titulo="Culto del domingo" insignia={<EnVivo />}>
      <div className="wfc-cuerpo wfc-culto">
        <div className="wfc-culto-lista">
          {orden.map(([t, k], i) => (
            <div key={t} className={i > 2 ? "wfc-solo-ancho" : undefined} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", background: i === 1 ? "#FFF4E8" : "transparent", boxShadow: i === 1 ? `inset 3px 0 0 ${NARANJA}` : "none" }}>
              <span style={{ fontSize: 11.5, color: "#8A96A8", width: 12, flex: "none" }}>{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: TINTA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
                <span style={{ display: "block", fontSize: 11.5, color: SUAVE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="wfc-culto-pantalla">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SUAVE, fontWeight: 500, gap: 6 }}><span>● AL AIRE</span><span>Coro 1 de 3</span></div>
          <div style={{ flex: 1, minHeight: 0, background: OSCURO, borderRadius: 10, border: `2px solid ${ROJO}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#fff", textAlign: "center", padding: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>Santo, Santo, Santo</span>
            <span style={{ fontSize: 14, color: "#B9C2D0" }}>Señor omnipotente</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
            {["Anterior", "Siguiente", "Negro"].map((b, i) => (
              <span key={b} className="wfc-btn" style={{ background: i === 1 ? NARANJA : NIEBLA, color: i === 1 ? SOBRE_NARANJA : TINTA, fontSize: 12.5 }}>{b}</span>
            ))}
          </div>
        </div>
      </div>
    </Ventana>
  );
}

// ---------- 2. Modo Músico ----------
function VentanaMusico() {
  const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace", whiteSpace: "pre", fontSize: 15, lineHeight: 1.45 };
  const linea = (acordes, letra, activa) => (
    <div style={{ padding: "8px 14px", background: activa ? "#FFF4E8" : "transparent", boxShadow: activa ? `inset 3px 0 0 ${NARANJA}` : "none" }}>
      <div style={{ ...mono, fontWeight: 700, color: TEAL }}>{acordes}</div>
      <div style={{ ...mono, color: TINTA }}>{letra}</div>
    </div>
  );
  return (
    <Ventana titulo="Modo Músico" insignia={<span className="wfc-chip" style={{ color: TEAL }}>Auto-avance</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "12px 0 14px", gap: 10 }}>
        <div style={{ padding: "0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: TINTA, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Santo, Santo, Santo</span>
          <span style={{ display: "flex", gap: 6, flex: "none" }}><span className="wfc-chip">Tono: D</span><span className="wfc-chip">72 BPM</span></span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
          {linea("D          G      D", "Santo, Santo, Santo,", false)}
          {linea("Bm      A       D", "Señor omnipotente", true)}
          {linea("G      D     A", "Siempre el labio", false)}
        </div>
        <div style={{ padding: "0 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 5, background: NIEBLA, borderRadius: 3, overflow: "hidden" }}><div className="wfc-anim" style={{ height: 5, background: NARANJA, animation: `wfcAvance ${INTERVALO}ms linear infinite` }} /></div>
          <span className="wfc-btn" style={{ padding: "7px 12px", fontSize: 12.5 }}>Tap tempo</span>
        </div>
      </div>
    </Ventana>
  );
}

// ---------- 3. Pantalla de escenario ----------
function VentanaEscenario() {
  return (
    <div className="wfc-v" aria-hidden="true" style={{ background: OSCURO, borderColor: "#1B2A40", color: "#fff" }}>
      <div className="wfc-barra" style={{ borderColor: "rgba(255,255,255,0.08)", color: "#fff" }}>
        <span style={{ flex: 1 }}>Pantalla de escenario</span>
        <span style={{ fontSize: 12, color: "#9AA6B6", fontWeight: 600 }}>Siempre oscura</span>
      </div>
      <div className="wfc-cuerpo" style={{ flexDirection: "column", padding: 14, gap: 10 }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: NARANJA, textTransform: "uppercase" }}>Ahora · Canción</div>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, marginTop: 6 }}>Santo, Santo, Santo,<br />Señor omnipotente</div>
        </div>
        <div style={{ borderTop: "2px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "#9AA6B6", textTransform: "uppercase" }}>Sigue · Versículo</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#7FA6E0", marginTop: 4 }}>Salmo 100:1-2</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: "none", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ fontSize: 11, color: "#9AA6B6", fontWeight: 600 }}>Tiempo</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>04:32</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, background: "rgba(232,130,30,0.16)", borderRadius: 8, padding: "7px 10px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: 11, color: "#F6C344", fontWeight: 600 }}>Mensaje de Multimedia</div>
            <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Cerrar en 5 minutos</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 4. Control remoto desde el celular ----------
function VentanaControl() {
  return (
    <Ventana titulo="Control remoto" insignia={<EnVivo />}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: 14, background: NIEBLA }}>
        <div style={{ width: 196, height: "100%", maxHeight: 268, background: "#fff", border: `3px solid ${AZUL}`, borderRadius: 24, padding: 12, display: "flex", flexDirection: "column", gap: 10, boxSizing: "border-box" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: SUAVE, textAlign: "center" }}>Controlar diapositivas</div>
          <div style={{ flex: 1, minHeight: 0, background: OSCURO, borderRadius: 8, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 6, lineHeight: 1.25 }}>Santo, Santo, Santo</div>
          <span className="wfc-btn" style={{ background: NARANJA, color: SOBRE_NARANJA, padding: "11px 0", fontSize: 14 }}>Siguiente</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><span className="wfc-btn" style={{ padding: "9px 0" }}>Anterior</span><span className="wfc-btn" style={{ padding: "9px 0" }}>Negro</span></div>
        </div>
        <div className="wfc-solo-ancho" style={{ flexDirection: "column", gap: 8, maxWidth: 190 }}>
          {["Siguiente y anterior", "Pantalla en negro", "Ir a una parte del culto", "Proyectar un versículo"].map((t) => (
            <div key={t} style={{ fontSize: 13.5, fontWeight: 600, color: TINTA, background: "#fff", borderRadius: 8, padding: "8px 10px" }}>{t}</div>
          ))}
        </div>
      </div>
    </Ventana>
  );
}

// ---------- 5. Biblia ----------
function VentanaBiblia() {
  return (
    <Ventana titulo="Biblia" insignia={<span className="wfc-chip" style={{ color: AZUL_VERSO }}>5 versiones</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["RVR1960", "NVI", "TLA", "DHH", "NTV"].map((v, i) => (
            <span key={v} className="wfc-chip" style={{ background: i === 0 ? AZUL_VERSO : NIEBLA, color: i === 0 ? "#fff" : TINTA }}>{v}</span>
          ))}
        </div>
        <div style={{ border: `1px solid ${LINEA}`, borderRadius: 10, padding: "10px 12px", fontSize: 14.5, color: TINTA, fontWeight: 600 }}>Salmos 100:1-2</div>
        <div style={{ flex: 1, minHeight: 0, background: "#EEF3FB", borderRadius: 10, padding: 12, overflow: "hidden" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: AZUL_VERSO, marginBottom: 6 }}>Salmos 100 · RVR1960</div>
          <div style={{ fontSize: 15, lineHeight: 1.45, color: TINTA }}><b>1</b> Cantad alegres a Dios, habitantes de toda la tierra. <b>2</b> Servid a Jehová con alegría; venid ante su presencia con regocijo.</div>
        </div>
        <span className="wfc-btn" style={{ background: NARANJA, color: SOBRE_NARANJA }}>Proyectar</span>
      </div>
    </Ventana>
  );
}

// ---------- 6. Canciones ----------
function VentanaCanciones() {
  const canciones = [["Castillo fuerte es nuestro Dios", "Himno · E"], ["Santo, Santo, Santo", "Himno · D"], ["Sublime gracia", "Himno · G"]];
  return (
    <Ventana titulo="Canciones" insignia={<span className="wfc-chip">Biblioteca</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 10 }}>
        <div style={{ border: `1px solid ${LINEA}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "#8A96A8" }}>Buscar canción…</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Internet", "Importar", "Nueva canción"].map((t) => <span key={t} className="wfc-chip">{t}</span>)}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
          {canciones.map(([t, k], i) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, background: i === 1 ? "#FFF4E8" : NIEBLA, borderRadius: 10, padding: "9px 12px" }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TINTA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
                <span style={{ display: "block", fontSize: 12, color: SUAVE }}>{k}</span>
              </span>
              <span style={{ color: i === 1 ? NARANJA : "#B8C0CC", fontSize: 18, lineHeight: 1 }}>★</span>
            </div>
          ))}
        </div>
      </div>
    </Ventana>
  );
}

// ---------- 7. Letras animadas y estilo ----------
function VentanaLetras() {
  const estilos = [["Cromo", "linear-gradient(135deg,#dfe6ee,#8a97a8)"], ["Karaoke", "linear-gradient(135deg,#F6C344,#E8821E)"], ["Degradado", "linear-gradient(135deg,#6A8DFF,#B15EA0)"], ["Retro 80", "linear-gradient(135deg,#FF5FA2,#7A5CFF)"]];
  return (
    <Ventana titulo="Letras animadas y estilo" insignia={<span className="wfc-chip" style={{ color: ORQUIDEA }}>En vivo</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 12 }}>
        <div style={{ flex: 1, minHeight: 0, background: "linear-gradient(160deg,#0B1626,#241A4A)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <span className="wfc-anim" style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", backgroundImage: "linear-gradient(90deg,#F6C344,#FF7AB6,#6A8DFF,#F6C344)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent", animation: "wfcBrillo 3.2s linear infinite" }}>Aleluya</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          {estilos.map(([n, g]) => (
            <div key={n} style={{ textAlign: "center" }}>
              <div style={{ height: 30, borderRadius: 8, backgroundImage: g }} />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: TINTA, marginTop: 4, whiteSpace: "nowrap" }}>{n}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: SUAVE }}>Fondos, tipografía, color y transiciones, sin cortar la proyección.</div>
      </div>
    </Ventana>
  );
}

// ---------- 8. Grupos ----------
function VentanaGrupos() {
  const semanas = [["Semana 1", "Ensayo general"], ["Semana 2", "Noche de adoración"], ["Semana 3", "Repaso de canciones nuevas"], ["Semana 4", "Culto especial"]];
  return (
    <Ventana titulo="Grupos" insignia={<span className="wfc-chip" style={{ color: INDIGO }}>Planificación</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["Alabanza", true], ["Infantil", false], ["Jóvenes", false]].map(([n, a]) => <span key={n} className="wfc-chip" style={{ background: a ? INDIGO : NIEBLA, color: a ? "#fff" : TINTA }}>{n}</span>)}
        </div>
        <div style={{ fontSize: 13, color: SUAVE }}>Líder: <b style={{ color: TINTA }}>María</b> · Noviembre</div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
          {semanas.map(([s, t]) => (
            <div key={s} style={{ display: "flex", gap: 10, alignItems: "center", background: NIEBLA, borderRadius: 10, padding: "8px 12px", minWidth: 0 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: INDIGO, flex: "none" }}>{s}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: TINTA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: SUAVE }}>Recursos compartidos: <b style={{ color: TINTA }}>Repertorio del mes ↗</b></div>
      </div>
    </Ventana>
  );
}

// ---------- 9. Equipo del culto ----------
function VentanaEquipo() {
  const roles = [["Alabanza", "Multimedia", 3, 4, INDIGO], ["Multimedia", "Proyección", 1, 1, TEAL], ["Recepción", "Bienvenida", 2, 3, NARANJA]];
  return (
    <Ventana titulo="Equipo del culto" insignia={<span className="wfc-chip">Domingo</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 10 }}>
        {roles.map(([nombre, , ok, total, c]) => (
          <div key={nombre} style={{ background: NIEBLA, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: TINTA }}><span>{nombre}</span><span style={{ fontSize: 12.5, color: SUAVE, fontWeight: 600 }}>{ok} de {total} confirmados</span></div>
            <div style={{ height: 6, background: "#fff", borderRadius: 3, marginTop: 8, overflow: "hidden" }}><div style={{ width: `${(ok / total) * 100}%`, height: 6, background: c }} /></div>
          </div>
        ))}
        <div style={{ fontSize: 12.5, color: SUAVE, marginTop: "auto" }}>Cada quien confirma desde su celular y recibe avisos.</div>
      </div>
    </Ventana>
  );
}

// ---------- 10. Bosquejo del predicador ----------
function VentanaPredicar() {
  return (
    <Ventana titulo="Modo Predicar" insignia={<span className="wfc-chip" style={{ color: ROJO }}>Solo tú lo ves</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#B4610F", letterSpacing: "0.04em" }}>PUNTO 2 DE 4</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: TINTA, lineHeight: 1.2 }}>Entren por sus puertas con acción de gracias</div>
        <div style={{ fontSize: 14, color: AZUL_VERSO, fontWeight: 600 }}>Salmos 100:4</div>
        <div style={{ flex: 1, minHeight: 0, borderLeft: "4px solid #F6C344", background: "#FFF9E6", borderRadius: 8, padding: "8px 12px", fontSize: 14, color: "#5C4A12", lineHeight: 1.4, overflow: "hidden" }}>
          Nota privada: contar el testimonio de la semana. No se proyecta.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <span className="wfc-btn">Anterior</span>
          <span className="wfc-btn" style={{ background: NARANJA, color: SOBRE_NARANJA }}>Pantalla</span>
        </div>
      </div>
    </Ventana>
  );
}

// ---------- 11. Asistente ----------
function VentanaAsistente() {
  return (
    <Ventana titulo="Asistente" insignia={<span className="wfc-chip">Con IA</span>}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 14, gap: 10, background: NIEBLA }}>
        <div style={{ alignSelf: "flex-end", maxWidth: "86%", background: AZUL, color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "9px 12px", fontSize: 14, lineHeight: 1.35 }}>Arma el culto del domingo con 3 canciones de alabanza.</div>
        <div style={{ alignSelf: "flex-start", maxWidth: "92%", background: "#fff", color: TINTA, borderRadius: "14px 14px 14px 4px", padding: "10px 12px", fontSize: 14, lineHeight: 1.4 }}>
          Te propongo este orden:
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3, color: SUAVE, fontSize: 13.5 }}><span>1. Bienvenida</span><span>2. Santo, Santo, Santo</span><span>3. Sublime gracia</span></div>
        </div>
        <span className="wfc-btn" style={{ alignSelf: "flex-start", padding: "9px 16px", background: NARANJA, color: SOBRE_NARANJA, marginTop: "auto" }}>Aplicar al culto</span>
      </div>
    </Ventana>
  );
}

const SLIDES = [
  { id: "culto", nombre: "Culto del domingo", frase: "Arma el orden del culto y proyecta en vivo con un toque.", Ventana: VentanaCulto },
  { id: "musico", nombre: "Modo Músico", frase: "Acordes arriba de la letra que avanzan solos al ritmo del tempo.", Ventana: VentanaMusico },
  { id: "escenario", nombre: "Pantalla de escenario", frase: "Quien está en la plataforma ve qué sigue, la letra, el reloj y mensajes.", Ventana: VentanaEscenario },
  { id: "control", nombre: "Control remoto", frase: "Cambia diapositivas y pon la pantalla en negro desde el celular.", Ventana: VentanaControl },
  { id: "biblia", nombre: "Biblia integrada", frase: "RVR1960, NVI, TLA, DHH y NTV. Busca un pasaje y proyéctalo.", Ventana: VentanaBiblia },
  { id: "canciones", nombre: "Biblioteca de canciones", frase: "Letras con acordes. Búscalas en internet o impórtalas desde PDF.", Ventana: VentanaCanciones },
  { id: "letras", nombre: "Letras animadas y estilo", frase: "Cambia fondos, tipografía y animaciones en vivo, sin interrumpir.", Ventana: VentanaLetras },
  { id: "grupos", nombre: "Grupos", frase: "Cada grupo con su líder, su planificación mensual y sus recursos.", Ventana: VentanaGrupos },
  { id: "equipo", nombre: "Equipo del culto", frase: "Roles, confirmaciones y avisos para cada persona del equipo.", Ventana: VentanaEquipo },
  { id: "predicar", nombre: "Bosquejo y Modo Predicar", frase: "El predicador sigue su bosquejo en su celular, con notas privadas.", Ventana: VentanaPredicar },
  { id: "asistente", nombre: "Asistente con IA", frase: "Pídele que arme el orden del culto y aplícalo con un toque.", Ventana: VentanaAsistente },
];

export default function CarruselPortada() {
  const pista = useRef(null);
  const [actual, setActual] = useState(0);
  const actualRef = useRef(0);
  const pausa = useRef({ tocando: false, encima: false, enfoque: false, hasta: 0 });
  const programado = useRef(false); // true mientras la pista se mueve por una orden nuestra (no por el dedo)

  const reducirMovimiento = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const irA = useCallback((i, suave = true) => {
    const el = pista.current;
    if (!el) return;
    const n = ((i % SLIDES.length) + SLIDES.length) % SLIDES.length;
    programado.current = true;
    const izq = n * el.clientWidth;
    if (typeof el.scrollTo === "function") el.scrollTo({ left: izq, behavior: suave && !reducirMovimiento() ? "smooth" : "auto" });
    else el.scrollLeft = izq;
    actualRef.current = n;
    setActual(n);
    window.setTimeout(() => { programado.current = false; }, 700);
  }, []);

  const alDeslizar = () => {
    const el = pista.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== actualRef.current) { actualRef.current = i; setActual(i); }
  };

  // Avance automático hacia la izquierda; al llegar a la última vuelve a la primera.
  useEffect(() => {
    if (reducirMovimiento()) return undefined;
    const t = window.setInterval(() => {
      const p = pausa.current;
      if (p.tocando || p.encima || p.enfoque || Date.now() < p.hasta) return;
      if (typeof document !== "undefined" && document.hidden) return;
      irA(actualRef.current + 1);
    }, INTERVALO);
    return () => window.clearInterval(t);
  }, [irA]);

  // Al cambiar el tamaño de la pantalla (girar el celular) se mantiene en la misma ventana.
  useEffect(() => {
    const al = () => irA(actualRef.current, false);
    window.addEventListener("resize", al);
    return () => window.removeEventListener("resize", al);
  }, [irA]);

  const tocar = () => { pausa.current.tocando = true; };
  const soltar = () => { pausa.current.tocando = false; pausa.current.hasta = Date.now() + REANUDAR_TRAS_TOQUE; };

  return (
    <div
      role="region" aria-roledescription="carrusel" aria-label="Funciones de WorshipFlow"
      onMouseEnter={() => { pausa.current.encima = true; }}
      onMouseLeave={() => { pausa.current.encima = false; }}
      onFocus={() => { pausa.current.enfoque = true; }}
      onBlur={() => { pausa.current.enfoque = false; }}
      style={{ background: NIEBLA, borderRadius: 16, padding: "clamp(12px, 2.4vw, 24px)", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
    >
      <style>{css}</style>
      <div
        ref={pista} className="wfc-pista" onScroll={alDeslizar}
        onTouchStart={tocar} onTouchEnd={soltar} onTouchCancel={soltar}
        onPointerDown={tocar} onPointerUp={soltar} onPointerCancel={soltar}
      >
        {SLIDES.map(({ id, nombre, frase, Ventana: V }, i) => (
          <div key={id} className="wfc-slide" role="group" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${SLIDES.length}: ${nombre}`} aria-hidden={i === actual ? undefined : "true"}>
            <V />
            <div style={{ padding: "0 4px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TINTA, letterSpacing: "-0.01em" }}>{nombre}</div>
              <div style={{ fontSize: 14, color: SUAVE, lineHeight: 1.4, marginTop: 2 }}>{frase}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0 }}>
        {SLIDES.map(({ id, nombre }, i) => (
          <button key={id} type="button" className="wfc-dot" aria-label={`Ver ${nombre}`} aria-current={i === actual ? "true" : "false"} onClick={() => { pausa.current.hasta = Date.now() + REANUDAR_TRAS_TOQUE; irA(i); }}>
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
