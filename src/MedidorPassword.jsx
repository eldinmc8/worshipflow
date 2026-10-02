import { REQUISITOS_PASSWORD, fuerzaPassword } from "./lib/passwordSegura.js";

const NIVELES = [
  { texto: "", color: "var(--wf-border)" },
  { texto: "Débil", color: "#C23B32" },
  { texto: "Aceptable", color: "#E8821E" },
  { texto: "Buena", color: "#1F8A73" },
  { texto: "Muy segura", color: "#1F8A73" },
];

// Barra de fuerza + lista de requisitos que se van marcando mientras se escribe. Se muestra debajo
// de cualquier campo de "nueva contraseña".
export default function MedidorPassword({ password }) {
  if (!password) return null;
  const fuerza = fuerzaPassword(password);
  const nivel = NIVELES[fuerza];
  return (
    <div style={{ marginTop: -2 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= fuerza ? nivel.color : "var(--wf-border)" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: nivel.color, marginBottom: 4 }}>{nivel.texto}</div>
      {REQUISITOS_PASSWORD.map((r) => {
        const ok = r.cumple(password);
        return (
          <div key={r.id} style={{ fontSize: 11, color: ok ? "#1F8A73" : "var(--wf-muted)" }}>
            {ok ? "✓" : "○"} {r.texto}
          </div>
        );
      })}
    </div>
  );
}
