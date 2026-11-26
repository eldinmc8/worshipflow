import { Lock } from "lucide-react";

// Lo que muestra la pantalla de escenario cuando la iglesia está en el plan Gratis (Eldin, 2026-11-26:
// escenario y OBS desde el plan Ministerio). Oscura, como toda pantalla de proyección.
export default function PantallaSinPlan() {
  return (
    <div style={{ flex: 1, minHeight: "100%", width: "100%", background: "radial-gradient(ellipse at center 40%, #1A1F2B 0%, #0C0E13 70%)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, boxSizing: "border-box", textAlign: "center", fontFamily: "'Poppins', sans-serif" }}>
      <span style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(232,130,30,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={30} color="#E8821E" /></span>
      <div style={{ fontSize: "clamp(22px, 4vh, 40px)", fontWeight: 700 }}>La pantalla de escenario es del plan Ministerio</div>
      <div style={{ fontSize: "clamp(14px, 2.2vh, 22px)", color: "#8996A6", maxWidth: 640, lineHeight: 1.5 }}>
        Un administrador puede mejorar el plan en la app, en <b style={{ color: "#fff" }}>Ajustes → Plan</b>. Al hacerlo, esta pantalla se abre sola.
      </div>
    </div>
  );
}
