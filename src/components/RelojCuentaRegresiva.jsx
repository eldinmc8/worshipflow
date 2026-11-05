// Reloj de cuenta regresiva con 20 estilos (pedido de Eldin, 2026-11-05). Lo dibujan la proyección, sus
// mini-vistas y la galería para elegir estilo. Todos son diseños propios de WorshipFlow, pensados para
// verse bien en un proyector con luces bajas (fondos oscuros, números grandes).
//
// El tamaño sale del espacio real (ResizeObserver), así se ve igual en la miniatura y en la pantalla
// grande, sin depender de funciones nuevas del navegador (algunas Smart TV son viejitas).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { segundosRestantes, textoCuenta, digitosCuenta, progresoCuenta, normalizarCuenta, partesTiempo } from "../lib/cuentaRegresiva.js";

const NARANJA = "#E8821E";
const AZUL = "#16324F";

function useTamano() {
  const ref = useRef(null);
  const [t, setT] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setT({ w: el.clientWidth, h: el.clientHeight });
    medir();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, t];
}

function useAhora(activo) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, [activo]);
  return ahora;
}

// Posiciones fijas (no al azar en cada dibujo) para estrellas y partículas.
const PUNTOS = Array.from({ length: 46 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.1234;
  const r = (x) => x - Math.floor(x);
  return { x: r(a) * 100, y: r(b) * 100, t: 0.6 + r(a * 3) * 2.2, d: r(b * 7) * 4, s: 0.5 + r(a * b) * 1.2 };
});

const numeros = { fontVariantNumeric: "tabular-nums", lineHeight: 1, whiteSpace: "nowrap" };

// Texto de arriba ("El servicio comienza en"), opcional.
function Encabezado({ p, style }) {
  if (!p.mostrarTexto || !p.texto) return null;
  return <div style={{ fontSize: p.u * 5.2, fontWeight: 500, letterSpacing: "0.04em", opacity: 0.9, textAlign: "center", maxWidth: "90%", ...style }}>{p.texto}</div>;
}

// Cuando terminó y hay mensaje: reemplaza los números.
// El tamaño depende de lo largo del mensaje, para que nunca se salga de la pantalla.
function Final({ p, style, escala = 1 }) {
  const msg = p.cuenta.mensajeFinal || "¡Bienvenidos!";
  const tam = p.u * Math.min(14, 150 / Math.max(6, msg.length)) * escala;
  return <div style={{ fontWeight: 800, textAlign: "center", maxWidth: "88%", lineHeight: 1.1, whiteSpace: msg.length <= 22 ? "nowrap" : "normal", overflowWrap: "break-word", animation: "wfcAparecer .8s ease both", ...style, fontSize: tam }}>{msg}</div>;
}

function Centro({ children, gap = 3, p, style }) {
  return <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: p.u * gap, ...style }}>{children}</div>;
}

// Números o mensaje final, con el mismo estilo de letra.
function NumerosOFinal({ p, style, finalStyle, escalaFinal = 1 }) {
  if (p.mostrarFinal) return <Final p={p} style={{ ...style, ...finalStyle }} escala={escalaFinal} />;
  return <div style={{ ...numeros, ...style }}>{p.texto2}</div>;
}

export const ESTILOS_CUENTA = [
  {
    id: "clasico", nombre: "Clásico grande", fondo: "radial-gradient(ellipse at center, #1B2232 0%, #0A0D14 75%)",
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
        <Encabezado p={p} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 30, fontWeight: 700 }} />
      </Centro>
    ),
  },
  {
    id: "digital", nombre: "Digital", fondo: "#050505",
    render: (p) => (
      <Centro p={p} style={{ color: "#FF4436", fontFamily: "'JetBrains Mono', monospace" }}>
        <Encabezado p={p} style={{ color: "#FF8A80", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", fontSize: p.u * 4 }} />
        {p.mostrarFinal ? <Final p={p} style={{ textShadow: "0 0 0.25em #FF4436" }} /> : (
          <div style={{ position: "relative", fontSize: p.u * 26, fontWeight: 700 }}>
            <div style={{ ...numeros, opacity: 0.08 }}>{p.texto2.replace(/\d/g, "8")}</div>
            <div style={{ ...numeros, position: "absolute", inset: 0, textShadow: "0 0 0.12em #FF4436, 0 0 0.4em rgba(255,68,54,.5)" }}>{p.texto2}</div>
          </div>
        )}
      </Centro>
    ),
  },
  {
    id: "neon", nombre: "Neón", fondo: "radial-gradient(ellipse at center, #1A0B2E 0%, #05020B 80%)",
    render: (p) => (
      <Centro p={p} style={{ fontFamily: "'Poppins', sans-serif" }}>
        <Encabezado p={p} style={{ color: "#7DF9FF", textShadow: "0 0 0.3em #00E5FF", fontWeight: 300 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 30, fontWeight: 200, color: "#FFE3FB", textShadow: "0 0 0.05em #fff, 0 0 0.15em #FF4FD8, 0 0 0.4em #FF4FD8, 0 0 0.8em #B100FF" }} />
      </Centro>
    ),
  },
  {
    id: "anillo", nombre: "Anillo", fondo: "radial-gradient(circle at center, #182133 0%, #090C12 70%)",
    render: (p) => {
      const r = 44, c = 2 * Math.PI * r;
      const tam = p.u * 78;
      return (
        <Centro p={p} gap={2} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
          <Encabezado p={p} style={{ fontSize: p.u * 4.4 }} />
          <div style={{ position: "relative", width: tam, height: tam }}>
            <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={NARANJA} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * p.progreso} style={{ transition: "stroke-dashoffset .3s linear" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <NumerosOFinal p={p} style={{ fontSize: tam * (p.digitos.length > 2 ? 0.17 : 0.24), fontWeight: 700 }} escalaFinal={0.6} />
            </div>
          </div>
        </Centro>
      );
    },
  },
  {
    id: "barra", nombre: "Barra de progreso", fondo: "linear-gradient(180deg, #111827 0%, #0A0E16 100%)",
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Montserrat', sans-serif" }}>
        <Encabezado p={p} style={{ fontWeight: 300, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: p.u * 4 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 28, fontWeight: 300 }} />
        <div style={{ width: "70%", height: p.u * 1.6, borderRadius: p.u, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <div style={{ width: `${(1 - p.progreso) * 100}%`, height: "100%", background: `linear-gradient(90deg, ${NARANJA}, #F6C344)`, transition: "width .3s linear" }} />
        </div>
      </Centro>
    ),
  },
  {
    id: "tarjetas", nombre: "Tarjetas que giran", fondo: "linear-gradient(180deg, #1C1F26 0%, #0C0E12 100%)",
    render: (p) => (
      <Centro p={p} style={{ color: "#F2F2F2", fontFamily: "'Oswald', sans-serif" }}>
        <Encabezado p={p} style={{ fontFamily: "'Poppins', sans-serif" }} />
        {p.mostrarFinal ? <Final p={p} /> : (
          <div style={{ display: "flex", alignItems: "center", gap: p.u * 2 }}>
            {p.digitos.map((grupo, gi) => (
              <div key={gi} style={{ display: "flex", alignItems: "center", gap: p.u * 2 }}>
                {gi > 0 && <div style={{ fontSize: p.u * 16, opacity: 0.5 }}>:</div>}
                {grupo.split("").map((d, di) => (
                  <div key={`${gi}-${di}-${d}`} style={{ position: "relative", width: p.u * 15, height: p.u * 22, borderRadius: p.u * 2, background: "linear-gradient(180deg, #2B2F38 0%, #2B2F38 49.5%, #22252C 50.5%, #22252C 100%)", boxShadow: "0 0.6em 1.4em rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: p.u * 18, fontWeight: 600, animation: "wfcGiro .45s ease both", transformOrigin: "50% 50%" }}>
                    {d}
                    <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: Math.max(1, p.u * 0.35), background: "rgba(0,0,0,.55)" }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Centro>
    ),
  },
  {
    id: "minimalista", nombre: "Minimalista (esquina)", fondo: "linear-gradient(135deg, #0F141C 0%, #151B26 100%)",
    render: (p) => (
      <div style={{ position: "absolute", right: p.u * 6, bottom: p.u * 6, textAlign: "right", color: "#fff", fontFamily: "'Raleway', sans-serif" }}>
        {p.mostrarTexto && p.texto && <div style={{ fontSize: p.u * 3.6, fontWeight: 400, opacity: 0.75, marginBottom: p.u }}>{p.texto}</div>}
        {p.mostrarFinal ? <div style={{ fontSize: p.u * 7, fontWeight: 600 }}>{p.cuenta.mensajeFinal}</div> : <div style={{ ...numeros, fontSize: p.u * 12, fontWeight: 300 }}>{p.texto2}</div>}
      </div>
    ),
  },
  {
    id: "elegante", nombre: "Elegante", fondo: "radial-gradient(ellipse at center, #1E1A14 0%, #0B0906 80%)",
    render: (p) => (
      <Centro p={p} style={{ color: "#E9C77B", fontFamily: "'Fraunces', serif" }}>
        <Encabezado p={p} style={{ fontStyle: "italic", fontWeight: 400, color: "#F3E3BC" }} />
        <div style={{ width: p.u * 30, height: 1, background: "linear-gradient(90deg, transparent, #E9C77B, transparent)" }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 28, fontWeight: 400 }} finalStyle={{ fontStyle: "italic", fontWeight: 500 }} />
        <div style={{ width: p.u * 30, height: 1, background: "linear-gradient(90deg, transparent, #E9C77B, transparent)" }} />
      </Centro>
    ),
  },
  {
    id: "degradado", nombre: "Degradado animado", fondo: "linear-gradient(120deg, #16324F, #5661B3, #B15EA0, #E8821E, #16324F)",
    fondoExtra: { backgroundSize: "400% 400%", animation: "wfcDegradado 18s ease infinite" },
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif", textShadow: "0 0.08em 0.3em rgba(0,0,0,.35)" }}>
        <Encabezado p={p} style={{ fontWeight: 600 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 30, fontWeight: 800 }} />
      </Centro>
    ),
  },
  {
    id: "logo", nombre: "Con el logo de la iglesia", fondo: `radial-gradient(ellipse at center, #1D3B5C 0%, ${AZUL} 45%, #0B1828 100%)`,
    render: (p) => (
      <Centro p={p} gap={2.5} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
        {p.cuenta.logoUrl
          ? <img src={p.cuenta.logoUrl} alt="" style={{ maxHeight: p.u * 22, maxWidth: "50%", objectFit: "contain", filter: "drop-shadow(0 0.4em 1em rgba(0,0,0,.4))" }} />
          : <Baculo size={p.u * 18} />}
        <Encabezado p={p} style={{ fontSize: p.u * 4.4 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 22, fontWeight: 700, color: "#fff" }} />
      </Centro>
    ),
  },
  {
    id: "estrellas", nombre: "Cielo estrellado", fondo: "radial-gradient(ellipse at 50% 120%, #1B2B57 0%, #0A1230 45%, #03050F 100%)",
    capa: (p) => PUNTOS.map((s, i) => <div key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: p.u * 0.5 * s.s, height: p.u * 0.5 * s.s, borderRadius: "50%", background: "#fff", animation: p.quieto ? "none" : `wfcTitilar ${s.t + 1.5}s ease-in-out ${s.d}s infinite`, opacity: 0.8 }} />),
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Raleway', sans-serif" }}>
        <Encabezado p={p} style={{ fontWeight: 300, letterSpacing: "0.1em" }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 30, fontWeight: 200, textShadow: "0 0 0.3em rgba(150,180,255,.5)" }} />
      </Centro>
    ),
  },
  {
    id: "amanecer", nombre: "Amanecer", fondo: "linear-gradient(180deg, #1B1035 0%, #4B1F4F 40%, #C2493D 75%, #F2A33A 100%)",
    capa: (p) => <div style={{ position: "absolute", left: "50%", bottom: `${-30 + p.progreso * 30}%`, width: p.u * 60, height: p.u * 60, marginLeft: -p.u * 30, borderRadius: "50%", background: "radial-gradient(circle, #FFE7A3 0%, #FFB547 45%, rgba(255,140,40,0) 70%)", transition: "bottom 1s linear" }} />,
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif", textShadow: "0 0.06em 0.3em rgba(40,10,40,.5)", justifyContent: "flex-start", paddingTop: "14%" }}>
        <Encabezado p={p} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 26, fontWeight: 700 }} />
      </Centro>
    ),
  },
  {
    id: "ondas", nombre: "Ondas suaves", fondo: "linear-gradient(180deg, #0B1A22 0%, #0E2A31 100%)",
    capa: (p) => (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "38%", overflow: "hidden" }}>
        {[0, 1, 2].map((k) => (
          <svg key={k} viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: 0, width: "200%", height: `${60 + k * 20}%`, opacity: 0.25 + k * 0.15, animation: p.quieto ? "none" : `wfcOnda ${14 - k * 3}s linear infinite` }}>
            <path d="M0,60 C150,110 350,10 600,60 C850,110 1050,10 1200,60 L1200,120 L0,120 Z" fill="#1F8A73" />
          </svg>
        ))}
      </div>
    ),
    render: (p) => (
      <Centro p={p} style={{ color: "#E6FFF8", fontFamily: "'Quicksand', sans-serif", paddingBottom: "12%" }}>
        <Encabezado p={p} style={{ fontWeight: 600 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 28, fontWeight: 700 }} />
      </Centro>
    ),
  },
  {
    id: "particulas", nombre: "Partículas de luz", fondo: "radial-gradient(ellipse at center, #1A1626 0%, #08070C 80%)",
    capa: (p) => PUNTOS.slice(0, 30).map((s, i) => <div key={i} style={{ position: "absolute", left: `${s.x}%`, bottom: "-5%", width: p.u * 1.2 * s.s, height: p.u * 1.2 * s.s, borderRadius: "50%", background: i % 3 === 0 ? NARANJA : "#F6C344", boxShadow: `0 0 ${p.u * 2}px ${i % 3 === 0 ? NARANJA : "#F6C344"}`, opacity: 0, animation: p.quieto ? "none" : `wfcSubir ${6 + s.t * 2}s linear ${s.d * 2}s infinite` }} />),
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
        <Encabezado p={p} style={{ fontWeight: 300 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 30, fontWeight: 600, textShadow: "0 0 0.4em rgba(246,195,68,.35)" }} />
      </Centro>
    ),
  },
  {
    id: "cristal", nombre: "Cristal", fondo: "radial-gradient(circle at 20% 30%, #5661B3 0%, transparent 40%), radial-gradient(circle at 80% 70%, #E8821E 0%, transparent 40%), radial-gradient(circle at 70% 20%, #B15EA0 0%, transparent 35%), #10131C",
    render: (p) => (
      <Centro p={p}>
        <div style={{ padding: `${p.u * 5}px ${p.u * 9}px`, borderRadius: p.u * 5, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", boxShadow: "0 1em 3em rgba(0,0,0,.35)", display: "flex", flexDirection: "column", alignItems: "center", gap: p.u * 2, color: "#fff", fontFamily: "'Poppins', sans-serif", maxWidth: "88%" }}>
          <Encabezado p={p} style={{ maxWidth: "100%" }} />
          <NumerosOFinal p={p} style={{ fontSize: p.u * 24, fontWeight: 600 }} escalaFinal={0.75} />
        </div>
      </Centro>
    ),
  },
  {
    id: "marca", nombre: "Colores de la marca", fondo: AZUL,
    render: (p) => (
      <Centro p={p} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
        <Encabezado p={p} style={{ fontWeight: 600 }} />
        {p.mostrarFinal ? <Final p={p} style={{ color: NARANJA }} /> : (
          <div style={{ display: "flex", alignItems: "center", gap: p.u * 2.5 }}>
            {p.digitos.map((g, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: p.u * 2.5 }}>
                {i > 0 && <div style={{ fontSize: p.u * 14, fontWeight: 800, color: NARANJA }}>:</div>}
                <div style={{ ...numeros, background: NARANJA, color: AZUL, borderRadius: p.u * 3, padding: `${p.u * 2}px ${p.u * 3.5}px`, fontSize: p.u * 20, fontWeight: 800, boxShadow: "0 0.4em 1.2em rgba(0,0,0,.3)" }}>{g}</div>
              </div>
            ))}
          </div>
        )}
      </Centro>
    ),
  },
  {
    id: "maquina", nombre: "Máquina de escribir", fondo: "#141210",
    render: (p) => (
      <Centro p={p} style={{ color: "#EFE6D2", fontFamily: "'JetBrains Mono', monospace" }}>
        <Encabezado p={p} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: p.u * 4 }} />
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <NumerosOFinal p={p} style={{ fontSize: p.u * 24, fontWeight: 500 }} finalStyle={{ fontWeight: 500, maxWidth: "none" }} escalaFinal={0.75} />
          <span style={{ display: "inline-block", width: p.u * 2.5, height: p.u * (p.mostrarFinal ? 9 : 20), background: "#EFE6D2", marginLeft: p.u * 1.5, animation: p.quieto ? "none" : "wfcCursor 1s steps(1) infinite" }} />
        </div>
      </Centro>
    ),
  },
  {
    id: "pulso", nombre: "Pulso", fondo: "radial-gradient(circle at center, #20141A 0%, #0B0709 75%)",
    render: (p) => {
      const ultimo = p.seg != null && p.seg <= 60 && !p.mostrarFinal;
      return (
        <Centro p={p} style={{ color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
          <div style={{ position: "absolute", width: p.u * 70, height: p.u * 70, borderRadius: "50%", border: `${Math.max(1, p.u * 0.5)}px solid ${ultimo ? "#C23B32" : NARANJA}`, opacity: 0, animation: p.quieto ? "none" : "wfcOndaPulso 1s ease-out infinite" }} />
          <Encabezado p={p} />
          <div key={p.seg} style={{ animation: p.quieto ? "none" : "wfcLatido 1s ease-out" }}>
            <NumerosOFinal p={p} style={{ fontSize: p.u * 30, fontWeight: 800, color: ultimo ? "#FF6B5E" : "#fff" }} />
          </div>
        </Centro>
      );
    },
  },
  {
    id: "dividido", nombre: "Reloj y versículo", fondo: "linear-gradient(90deg, #0E1420 0%, #0E1420 50%, #16324F 50%, #16324F 100%)",
    render: (p) => (
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: p.u * 2, color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
          <Encabezado p={p} style={{ fontSize: p.u * 4 }} />
          <NumerosOFinal p={p} style={{ fontSize: p.u * (p.digitos.length > 2 ? 13 : 18), fontWeight: 700 }} escalaFinal={0.55} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${p.u * 9}px`, color: "#fff" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: p.u * 5.2, lineHeight: 1.35 }}>“{p.cuenta.versiculo}”</div>
          {p.cuenta.referencia && <div style={{ marginTop: p.u * 2.5, fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: p.u * 4, color: NARANJA }}>{p.cuenta.referencia}</div>}
        </div>
      </div>
    ),
  },
  {
    id: "pizarra", nombre: "Pizarra", fondo: "radial-gradient(ellipse at center, #2C4A3B 0%, #1A2E24 80%)",
    fondoExtra: { boxShadow: "inset 0 0 0 1.4vmin #5A3D25, inset 0 0 6vmin rgba(0,0,0,.45)" },
    render: (p) => (
      <Centro p={p} style={{ color: "#F4F1E8", fontFamily: "'Caveat', cursive", textShadow: "0 0 1px rgba(255,255,255,.6)" }}>
        <Encabezado p={p} style={{ fontSize: p.u * 7, fontWeight: 600 }} />
        <NumerosOFinal p={p} style={{ fontSize: p.u * 32, fontWeight: 700 }} escalaFinal={1.2} />
      </Centro>
    ),
  },
];

const POR_ID = Object.fromEntries(ESTILOS_CUENTA.map((e) => [e.id, e]));
export const estiloCuenta = (id) => POR_ID[id] || ESTILOS_CUENTA[0];

// Báculo de pastor (ícono de la marca) para el estilo con logo cuando la iglesia no tiene logo.
function Baculo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={NARANJA} strokeWidth="4" strokeLinecap="round">
      <path d="M30 60 V22 a12 12 0 1 1 24 0 a6 6 0 0 1 -12 0" />
    </svg>
  );
}

const KEYFRAMES = `
@keyframes wfcAparecer { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: none } }
@keyframes wfcGiro { from { transform: rotateX(-80deg); opacity: .4 } to { transform: none; opacity: 1 } }
@keyframes wfcDegradado { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
@keyframes wfcTitilar { 0%, 100% { opacity: .9 } 50% { opacity: .15 } }
@keyframes wfcOnda { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes wfcSubir { 0% { transform: translateY(0); opacity: 0 } 10% { opacity: .9 } 90% { opacity: .6 } 100% { transform: translateY(-110vh); opacity: 0 } }
@keyframes wfcCursor { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
@keyframes wfcLatido { 0% { transform: scale(1.08) } 100% { transform: scale(1) } }
@keyframes wfcOndaPulso { 0% { transform: scale(.6); opacity: .7 } 100% { transform: scale(1.25); opacity: 0 } }
`;

// cuenta: configuración (ver lib/cuentaRegresiva.js) con hasta/total ya puestos. Sin `hasta` (la miniatura
// de un elemento del Setlist que todavía no se proyecta) muestra la duración completa, quieta.
// muestra: segundos fijos para la galería de estilos.
export default function RelojCuentaRegresiva({ cuenta: cuentaCruda, quieto = false, muestra = null, sinFondo = false }) {
  const cuenta = { ...normalizarCuenta(cuentaCruda), hasta: cuentaCruda?.hasta ?? null, total: cuentaCruda?.total ?? null, logoUrl: cuentaCruda?.logoUrl || null };
  const [ref, { w, h }] = useTamano();
  const corre = muestra == null && cuenta.hasta != null;
  useAhora(corre); // solo para volver a dibujar 4 veces por segundo; la hora se lee al momento
  const seg = muestra != null ? muestra : corre ? segundosRestantes(cuenta.hasta, Date.now()) : cuenta.modo === "minutos" ? cuenta.minutos * 60 : null;
  const segMostrar = seg ?? cuenta.minutos * 60;
  const terminado = corre && seg === 0;
  const estilo = estiloCuenta(cuenta.estilo);
  const u = Math.max(0.5, Math.min(h, w * 0.5625) / 100);
  const p = {
    u, cuenta, seg: segMostrar, quieto,
    texto: cuenta.texto, mostrarTexto: cuenta.mostrarTexto,
    texto2: textoCuenta(segMostrar), digitos: digitosCuenta(segMostrar),
    progreso: muestra != null ? 0.35 : progresoCuenta(cuenta, segMostrar),
    mostrarFinal: terminado && cuenta.alTerminar === "mensaje",
    partes: partesTiempo(segMostrar),
  };
  const conFondo = !sinFondo && cuenta.fondo !== "estilo";
  return (
    <div ref={ref} aria-label={p.mostrarFinal ? cuenta.mensajeFinal : `Cuenta regresiva: ${p.texto2}`} style={{ position: "absolute", inset: 0, overflow: "hidden", background: conFondo ? estilo.fondo : "transparent", ...(conFondo ? estilo.fondoExtra || {} : {}), zIndex: 1 }}>
      <style>{KEYFRAMES}</style>
      {w > 0 && (
        <>
          {estilo.capa && conFondo && estilo.capa(p)}
          {estilo.render(p)}
        </>
      )}
    </div>
  );
}
