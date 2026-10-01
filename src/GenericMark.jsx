import MarkCircle from "./MarkCircle.jsx";

// Marca genérica de WorshipFlow (el producto), para las pantallas que corren ANTES de saber a qué
// iglesia pertenece quien las ve — Login, Crear mi iglesia, y las dos del primer ingreso tras
// aceptar una invitación (ver AuthGate.jsx). Esas pantallas son compartidas por TODAS las iglesias
// (no hay subdominios por iglesia todavía), así que no pueden mostrar el logo/nombre de una en
// particular — decisión explícita de Eldin, 2026-09-30: antes se mostraba siempre el logo de Jesús
// El Buen Pastor ahí, lo que no tenía sentido para alguien entrando a otra iglesia.
export default function GenericMark({ size = 72 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <MarkCircle size={size} />
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: "var(--wf-brand-primary)" }}>WorshipFlow</span>
    </div>
  );
}
