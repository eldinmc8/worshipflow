import { Clock } from "lucide-react";

// Lo que muestra una pantalla (proyección o escenario) cuando su enlace ya venció: el código cambia solo
// al finalizar cada transmisión (ver migración 20261104000000_enlace_pantalla_que_vence.sql). Oscura,
// como toda pantalla de proyección.
export default function EnlaceVencido({ tipo = "proyeccion" }) {
  const escenario = tipo === "escenario";
  return (
    <div style={{ flex: 1, minHeight: "100%", width: "100%", background: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, boxSizing: "border-box", textAlign: "center", fontFamily: "'Poppins', sans-serif" }}>
      <span style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(232,130,30,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={30} color="#E8821E" /></span>
      <div style={{ fontSize: "clamp(22px, 4vh, 40px)", fontWeight: 700 }}>Este enlace ya venció</div>
      <div style={{ fontSize: "clamp(14px, 2.2vh, 22px)", color: "#8996A6", maxWidth: 640, lineHeight: 1.5 }}>
        Por seguridad, el enlace de {escenario ? "la pantalla de escenario" : "la proyección"} cambia cada vez que termina un culto.
        Pide el nuevo enlace o código QR a Multimedia: en la app, <b style={{ color: "#fff" }}>Ajustes → {escenario ? "Pantalla de escenario" : "Pantalla en otro equipo"}</b>.
      </div>
    </div>
  );
}
