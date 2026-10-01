import ShepherdStaffIcon from "./components/ShepherdStaffIcon.jsx";

// Círculo navy con el báculo de pastor adentro — el trazo genérico de marca de WorshipFlow (ver
// CLAUDE.md: "Ícono de marca: trazo simple de báculo de pastor"). Pieza compartida por AppLogo.jsx
// (cuando una iglesia todavía no tiene logo propio) y GenericMark.jsx (pantallas sin iglesia
// conocida) — ambos lo necesitan, pero con distinto contenido alrededor (AppLogo: nada más;
// GenericMark: además el texto "WorshipFlow" debajo), así que vive aparte en vez de duplicarse.
export default function MarkCircle({ size }) {
  return (
    <div style={{ width: size, height: size, maxWidth: "100%", aspectRatio: "1 / 1", borderRadius: "50%", background: "var(--wf-brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <ShepherdStaffIcon className="" color="var(--wf-brand-accent)" style={{ width: "55%", height: "55%" }} />
    </div>
  );
}
