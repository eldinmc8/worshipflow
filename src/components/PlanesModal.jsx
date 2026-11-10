// Ventana "Tu plan": plan actual, uso (miembros / canciones / ministerios) y los 3 planes para elegir.
// Mientras no esté conectada la pasarela de pagos, "Quiero este plan" abre WhatsApp con el pedido
// y el super administrador activa el plan desde la consola (pagos por transferencia).
import { useEffect, useState } from "react";
import { Crown, Check } from "lucide-react";
import { ModalShell } from "../pantallas/compartido.jsx";
import { PLANES, planPorId, usePlan, recargarPlan, diasRestantes, onAbrirPlanes } from "../lib/planes.js";
import { WHATSAPP_SOPORTE } from "../lib/soporte.js";

function Medidor({ label, usados, limite }) {
  const pct = limite == null ? 0 : Math.min(100, Math.round((usados / Math.max(limite, 1)) * 100));
  const lleno = limite != null && usados >= limite;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "var(--wf-text-2)" }}>{label}</span>
        <span style={{ fontWeight: 700, color: lleno ? "#C23B32" : "var(--wf-text)" }}>{usados}{limite == null ? " · ilimitado" : ` de ${limite}`}</span>
      </div>
      {limite != null && (
        <div style={{ height: 6, borderRadius: 6, background: "var(--wf-hover)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: lleno ? "#C23B32" : "var(--wf-brand-accent)" }} />
        </div>
      )}
    </div>
  );
}

export function PlanesModal({ onClose, teamName }) {
  const plan = usePlan();
  const [anual, setAnual] = useState(false);
  useEffect(() => { recargarPlan(); }, []);
  const actual = planPorId(plan?.plan);
  const dias = diasRestantes(plan?.vence);
  const enPrueba = !!plan?.en_prueba;

  const pedir = (p) => {
    const texto = `Hola, quiero el plan ${p.nombre} de WorshipFlow (${anual ? `$${p.precioAnual} al año` : `$${p.precio} al mes`}) para ${teamName || "mi iglesia"}.`;
    window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  return (
    <ModalShell title="Tu plan" icon={Crown} color="var(--wf-brand-accent)" onClose={onClose} alto>
      <div style={{ flex: 1, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        {plan && (
          <div style={{ background: "var(--wf-bg)", borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Plan {actual.nombre}</span>
              {enPrueba && <span style={{ fontSize: 11, fontWeight: 700, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", borderRadius: 12, padding: "3px 9px" }}>Prueba: {dias} {dias === 1 ? "día" : "días"}</span>}
              {!enPrueba && plan.vence && !plan.vencido && <span style={{ fontSize: 11, color: "var(--wf-muted)" }}>Hasta {new Date(plan.vence).toLocaleDateString()}</span>}
            </div>
            {plan.vencido && plan.plan_contratado !== "gratis" && (
              <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 10 }}>Tu plan {planPorId(plan.plan_contratado).nombre} venció. Tus datos siguen guardados; renueva para volver a usar todo.</div>
            )}
            <Medidor label="Miembros" usados={plan.uso?.miembros ?? 0} limite={plan.limites?.miembros} />
            <Medidor label="Canciones" usados={plan.uso?.canciones ?? 0} limite={plan.limites?.canciones} />
            <Medidor label="Ministerios" usados={plan.uso?.ministerios ?? 0} limite={plan.limites?.ministerios} />
          </div>
        )}

        <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 14, padding: 3, marginBottom: 12 }}>
          {[false, true].map((a) => (
            <button key={String(a)} onClick={() => setAnual(a)} style={{ flex: 1, border: "none", borderRadius: 12, padding: "7px 6px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: anual === a ? "var(--wf-card)" : "transparent", color: "var(--wf-text)", boxShadow: anual === a ? "0 2px 8px rgba(22,50,79,0.12)" : "none" }}>
              {a ? "Anual · 2 meses gratis" : "Mensual"}
            </button>
          ))}
        </div>

        {PLANES.map((p) => {
          const esActual = p.id === actual.id && !enPrueba;
          return (
            <div key={p.id} style={{ background: "var(--wf-card)", boxShadow: esActual ? `0 0 0 2px ${p.color}` : "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 16, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: p.color }}>{p.nombre}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>
                  {p.precio === 0 ? "$0" : anual ? `$${p.precioAnual}` : `$${p.precio}`}
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--wf-muted)" }}>{p.precio === 0 ? "" : anual ? " /año" : " /mes"}</span>
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 8 }}>{p.resumen}</div>
              {p.incluye.map((t) => (
                <div key={t} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, marginBottom: 3 }}>
                  <Check size={14} color={p.color} style={{ flexShrink: 0, marginTop: 2 }} /> {t}
                </div>
              ))}
              {esActual ? (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: p.color, textAlign: "center" }}>Tu plan actual</div>
              ) : p.precio > 0 ? (
                <button onClick={() => pedir(p)} style={{ marginTop: 10, width: "100%", border: "none", borderRadius: 12, padding: "9px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: p.color, color: "#fff" }}>
                  Quiero este plan
                </button>
              ) : null}
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: "var(--wf-faint)", textAlign: "center", margin: "4px 0 8px" }}>
          Bajar de plan nunca borra nada: lo que pase del límite queda guardado, solo no se puede agregar más.
        </div>
      </div>
    </ModalShell>
  );
}

// Montado una vez (main.jsx): abre la ventana cuando cualquier candado llama abrirPlanes().
export default function PlanesHost() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => onAbrirPlanes(() => setAbierto(true)), []);
  return abierto ? <PlanesModal onClose={() => setAbierto(false)} /> : null;
}
