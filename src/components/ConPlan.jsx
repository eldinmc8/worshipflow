// Envuelve una ventana o herramienta que depende del plan (ver lib/planes.js → FUNCIONES_PLAN). Si el
// plan la incluye, la muestra tal cual; si no, muestra un aviso con "Ver planes" en su lugar.
import { Lock } from "lucide-react";
import { ModalShell, primaryBtn, addBtnStyle } from "../pantallas/compartido.jsx";
import { usePlan, tiene, FUNCIONES_PLAN, nombrePlanRequerido, abrirPlanes } from "../lib/planes.js";

export function AvisoPlan({ funcion, onCerrar }) {
  const nombre = FUNCIONES_PLAN[funcion]?.nombre || "Esta función";
  return (
    <ModalShell title={nombre} icon={Lock} color="var(--wf-brand-accent)" onClose={onCerrar}>
      <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--wf-text-2)", margin: "0 0 16px" }}>
        {nombre} es parte del plan <b>{nombrePlanRequerido(funcion)}</b> y superiores. Tus datos están guardados; al mejorar tu plan se activa de inmediato.
      </p>
      <button onClick={() => { onCerrar?.(); abrirPlanes(); }} style={{ ...primaryBtn, width: "100%" }}>Ver planes</button>
      <button onClick={onCerrar} style={{ ...addBtnStyle, width: "100%", justifyContent: "center", marginTop: 8, marginBottom: 0 }}>Ahora no</button>
    </ModalShell>
  );
}

export default function ConPlan({ funcion, onCerrar, children }) {
  const plan = usePlan();
  return tiene(plan, funcion) ? children : <AvisoPlan funcion={funcion} onCerrar={onCerrar} />;
}
