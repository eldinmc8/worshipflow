// Beneficio de lanzamiento por grupo en "Tu plan" (Ajustes → Plan) y el aviso de plazo vencido (2026-11-23).
// Solo se ve si la iglesia tiene grupo_beneficio (mi_plan().beneficio). Iglesias sin grupo: no se muestra nada.
import { Gift } from "lucide-react";
import { beneficioPorGrupo, estadoBeneficio, fechaBeneficio, resumenBeneficio, enlaceProrroga, WHATSAPP_BENEFICIO_TEXTO } from "../lib/beneficios.js";
import { enlacePago } from "../lib/paddle.js";

const fila = (etiqueta, valor) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginTop: 6 }}>
    <span style={{ color: "var(--wf-text-2)" }}>{etiqueta}</span>
    <span style={{ fontWeight: 700, color: "var(--wf-text)", textAlign: "right" }}>{valor}</span>
  </div>
);

// Aviso de plazo vencido sin activar: sigue en Gratis, sin perder datos, y puede pedir prórroga por WhatsApp.
export function AvisoBeneficioVencido({ beneficio, teamName, compacto }) {
  if (estadoBeneficio(beneficio) !== "vencido") return null;
  return (
    <div style={{ background: "#FDECEA", border: "1px solid #C23B32", borderRadius: 14, padding: compacto ? "12px 14px" : 14, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#C23B32" }}>Venció el plazo para activar tu beneficio</div>
      <div style={{ fontSize: 12.5, color: "var(--wf-text)", marginTop: 4, lineHeight: 1.45 }}>
        El plazo era hasta el {fechaBeneficio(beneficio.plazo_hasta)}. Tu iglesia sigue en el plan Gratis y no se borró nada. Si necesitas más tiempo, escríbenos al WhatsApp {WHATSAPP_BENEFICIO_TEXTO} y pide una prórroga.
      </div>
      <a href={enlaceProrroga(teamName)} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 10, background: "#1F8A73", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13, borderRadius: 12, padding: "8px 13px" }}>
        Pedir prórroga por WhatsApp
      </a>
    </div>
  );
}

// Tarjeta del beneficio en "Tu plan": grupo, hasta cuándo es gratis y cuándo sube a precio normal.
export function TarjetaBeneficio({ plan, correo, puedeActivar, teamName }) {
  const b = plan?.beneficio;
  const info = beneficioPorGrupo(b?.grupo);
  const estado = estadoBeneficio(b);
  if (!info) return null;
  if (estado === "vencido") return <AvisoBeneficioVencido beneficio={b} teamName={teamName} />;
  const activo = estado === "activo";
  return (
    <div style={{ background: "linear-gradient(135deg, #16324F, #2F5FA8)", color: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Gift size={18} />
        <span style={{ fontSize: 16, fontWeight: 800 }}>Beneficio {info.nombre}</span>
      </div>
      <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 4, lineHeight: 1.45 }}>{resumenBeneficio(b.grupo)}.</div>
      <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "4px 12px 10px", marginTop: 10, "--wf-text": "#fff", "--wf-text-2": "rgba(255,255,255,0.8)" }}>
        {fila("Grupo", info.nombre)}
        {activo ? (
          <>
            {fila("Lo gratis termina", fechaBeneficio(b.gratis_hasta) || "—")}
            {fila("Sube a precio normal", info.mesesPrecio == null ? "Nunca: precio especial para siempre" : fechaBeneficio(b.precio_hasta) || "—")}
          </>
        ) : (
          <>
            {fila("Lo gratis", `${info.mesesGratis} ${info.mesesGratis === 1 ? "mes" : "meses"} desde que lo actives`)}
            {fila("Sube a precio normal", info.mesesPrecio == null ? "Nunca: precio especial para siempre" : `${info.mesesPrecio} meses después de lo gratis`)}
            {b.plazo_hasta && fila("Actívalo antes del", fechaBeneficio(b.plazo_hasta))}
          </>
        )}
      </div>
      {!activo && puedeActivar && (
        <a href={enlacePago({ beneficio: true, iglesiaId: plan.iglesia_id, correo })} style={{ display: "inline-block", marginTop: 10, background: "#E8821E", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13.5, borderRadius: 12, padding: "9px 14px" }}>
          Activar mi beneficio
        </a>
      )}
      {!activo && !puedeActivar && !plan?.soy_admin && (
        <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 8 }}>Solo un administrador de la iglesia puede activarlo.</div>
      )}
      {activo && <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 8 }}>Si cancelas o el pago falla, tu iglesia pasa al plan Gratis sin perder nada. El beneficio es de una sola vez.</div>}
    </div>
  );
}
