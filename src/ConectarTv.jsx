import { useEffect, useRef, useState } from "react";
import { Tv } from "lucide-react";
import { tokenDelTv, pedirCodigoTv, estadoTv, direccionDeTvConectado, direccionTv } from "./lib/conectarTv.js";
import WorshipFlowIcon from "./WorshipFlowIcon.jsx";

// Pantalla del TV en /tv (2026-11-02): muestra un número de 6 dígitos grande. Multimedia lo escribe en la
// app (Ajustes → Pantallas y TV → Conectar un TV) y este TV abre solo la proyección o la pantalla de
// escenario de esa iglesia. Se maneja sin tocar nada: pensado para el control remoto de un Smart TV o una
// caja de Claro/Android TV. Siempre oscura, como toda pantalla de proyección.
const CADA_MS = 3000;

export default function ConectarTv() {
  const [codigo, setCodigo] = useState(null);
  const [error, setError] = useState("");
  const [conectando, setConectando] = useState(false);
  const tokenRef = useRef(null);

  useEffect(() => {
    tokenRef.current = tokenDelTv();
    let vivo = true;
    const pedir = async () => {
      try { const c = await pedirCodigoTv(tokenRef.current); if (vivo) { setCodigo(c); setError(""); } }
      catch { if (vivo) setError("Sin conexión a internet. Reintentando…"); }
    };
    const revisar = async () => {
      try {
        const e = await estadoTv(tokenRef.current);
        if (!vivo) return;
        setError("");
        if (e.estado === "vinculado") {
          setConectando(true);
          window.location.replace(direccionDeTvConectado(e));
        } else if (e.estado === "nuevo") {
          await pedir();
        } else if (e.codigo) {
          setCodigo(e.codigo);
        }
      } catch {
        if (vivo) setError("Sin conexión a internet. Reintentando…");
      }
    };
    pedir();
    const intervalo = setInterval(revisar, CADA_MS);
    return () => { vivo = false; clearInterval(intervalo); };
  }, []);

  const digitos = (codigo || "······").split("");
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center 35%, #1A2232 0%, #0A0C11 75%)", color: "#fff", fontFamily: "'Poppins', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4vh", padding: "4vh 5vw", boxSizing: "border-box", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <WorshipFlowIcon size={44} />
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(26px, 4.5vh, 46px)", fontWeight: 600 }}>WorshipFlow</span>
      </div>

      {conectando ? (
        <div style={{ fontSize: "clamp(22px, 4vh, 40px)", fontWeight: 700 }}>¡Conectado! Abriendo la pantalla…</div>
      ) : (
        <>
          <div style={{ fontSize: "clamp(18px, 3vh, 30px)", color: "#B8C2D0" }}>Para conectar este TV, escribe este número en la app</div>
          <div aria-label={codigo ? `Número: ${codigo.split("").join(" ")}` : "Cargando número"} style={{ display: "flex", gap: "1.4vw" }}>
            {digitos.map((d, i) => (
              <span key={i} style={{ width: "clamp(52px, 9vw, 130px)", height: "clamp(72px, 16vh, 170px)", borderRadius: 18, background: "rgba(255,255,255,0.07)", border: "2px solid rgba(232,130,30,0.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "clamp(44px, 11vh, 120px)", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: codigo ? "#fff" : "#4A5466" }}>{d}</span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "clamp(15px, 2.4vh, 26px)", color: "#E6EAF0", background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "1.6vh 2.4vw" }}>
            <Tv size={26} color="#E8821E" style={{ flexShrink: 0 }} />
            <span>En la app: <b>Ajustes → Pantallas y TV → Conectar un TV</b></span>
          </div>
          <div style={{ fontSize: "clamp(12px, 1.8vh, 18px)", color: "#6B7686", maxWidth: 900, lineHeight: 1.5 }}>
            El número cambia cada 15 minutos. Guarda esta dirección en los favoritos del TV: <b style={{ color: "#B8C2D0" }}>{direccionTv().replace(/^https?:\/\//, "")}</b>
          </div>
          {error && <div style={{ fontSize: "clamp(13px, 2vh, 20px)", color: "#F6C344" }}>{error}</div>}
        </>
      )}
    </div>
  );
}
