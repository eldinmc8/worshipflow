import WorshipFlowIcon from "./WorshipFlowIcon.jsx";

// Ícono genérico de WorshipFlow: lo usan AppLogo.jsx (cuando una iglesia todavía no subió su logo),
// Crear mi iglesia y la pantalla de completar perfil. Antes era un círculo con el báculo de pastor;
// desde 2026-10-01 es el ícono oficial de la app (nota musical), igual al de la app instalada.
export default function MarkCircle({ size }) {
  return <WorshipFlowIcon size={size} style={{ maxWidth: "100%", height: "auto" }} />;
}
