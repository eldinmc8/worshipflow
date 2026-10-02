import WorshipFlowIcon from "./WorshipFlowIcon.jsx";

// Logo completo de WorshipFlow (el producto) para las pantallas que corren ANTES de saber a qué
// iglesia pertenece quien las ve: Login y el primer ingreso tras aceptar una invitación (ver
// AuthGate.jsx). Son compartidas por TODAS las iglesias, así que no muestran el logo de ninguna en
// particular. Diseño tomado del logo oficial que compartió Eldin (2026-10-01): ícono a la izquierda,
// nombre en negrita, línea naranja y la frase "El control de tu iglesia en un lugar".
export default function GenericMark({ size = 72 }) {
  const escala = size / 72;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 * escala }}>
      <WorshipFlowIcon size={size} style={{ borderRadius: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30 * escala, fontWeight: 700, lineHeight: 1.05, color: "var(--wf-heading)", letterSpacing: -0.5 }}>WorshipFlow</div>
        <div style={{ height: 4 * escala, borderRadius: 4, background: "#E8821E", margin: `${6 * escala}px 0 ${5 * escala}px` }} />
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 10.5 * escala, color: "var(--wf-muted)", whiteSpace: "nowrap" }}>El control de tu iglesia en un lugar</div>
      </div>
    </div>
  );
}
