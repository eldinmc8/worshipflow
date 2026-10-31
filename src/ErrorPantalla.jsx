import { Component } from "react";
import { reportarError } from "./lib/monitoreo.js";

// Red de seguridad (2026-10-31): si una pantalla falla al dibujarse, React la deja en blanco y la
// persona cree que "la app no carga". Con esto se ve un aviso claro con un botón para recargar, y el
// error queda en la consola para poder revisarlo.
export default class ErrorPantalla extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[WorshipFlow] Error al mostrar la pantalla:", error, info?.componentStack);
    reportarError(error, { componentStack: info?.componentStack });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--wf-bg, #F4F6FA)", fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ maxWidth: 360, width: "100%", background: "var(--wf-card, #fff)", borderRadius: 18, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: 22, textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--wf-text, #16324F)", marginBottom: 6 }}>Algo no cargó bien</div>
          <div style={{ fontSize: 13, color: "var(--wf-muted, #5B6B80)", marginBottom: 16, lineHeight: 1.5 }}>Vuelve a cargar la app. Si sigue pasando, avísale al administrador.</div>
          <button
            onClick={() => window.location.reload()}
            style={{ background: "var(--wf-brand-accent, #E8821E)", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 14, fontWeight: 700, color: "var(--wf-brand-primary, #16324F)", cursor: "pointer" }}
          >
            Recargar
          </button>
          <div style={{ fontSize: 10, color: "var(--wf-faint, #8A97A8)", marginTop: 12, wordBreak: "break-word" }}>{String(this.state.error?.message || this.state.error).slice(0, 160)}</div>
        </div>
      </div>
    );
  }
}
