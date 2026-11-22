// "Diseños listos" (pedido de Eldin, 2026-11-22): galería por categorías con miniaturas reales. Los
// diseños de pago llevan candado; tocar uno con candado abre la ventana de planes. Ver lib/galeriaDisenos.js.
import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import DiapositivaDisenada from "./DiapositivaDisenada.jsx";
import { CATEGORIAS_DISENOS, GALERIA_DISENOS, disenoDisponible } from "../lib/galeriaDisenos.js";
import { usePlan, tiene, abrirPlanes } from "../lib/planes.js";

export default function GaleriaDisenos({ onElegir, columnas = 4, oscuro = false }) {
  const plan = usePlan();
  const tieneGaleria = tiene(plan, "galeria_disenos");
  const [categoria, setCategoria] = useState(CATEGORIAS_DISENOS[0].clave);
  // Una sola muestra por diseño (crear() da ids nuevos cada vez).
  const muestras = useMemo(() => Object.fromEntries(GALERIA_DISENOS.map((d) => [d.clave, d.crear()])), []);
  const lista = GALERIA_DISENOS.filter((d) => d.categoria === categoria);
  const texto = oscuro ? "#E8ECF2" : "var(--wf-text)";
  return (
    <div data-testid="galeria-disenos">
      <div role="tablist" aria-label="Categorías de diseños" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {CATEGORIAS_DISENOS.map((c) => {
          const activa = c.clave === categoria;
          return (
            <button key={c.clave} type="button" role="tab" aria-selected={activa} onClick={() => setCategoria(c.clave)}
              style={{ fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, border: "none", cursor: "pointer", background: activa ? "var(--wf-brand-accent, #E8821E)" : oscuro ? "rgba(255,255,255,0.08)" : "var(--wf-hover)", color: activa ? "var(--wf-brand-primary, #16324F)" : texto }}>{c.nombre}</button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`, gap: 8 }}>
        {lista.map((d) => {
          const libre = disenoDisponible(d, tieneGaleria);
          return (
            <button key={d.clave} type="button" title={libre ? d.nombre : `${d.nombre} · plan Ministerio o mayor`} aria-label={libre ? `Usar diseño ${d.nombre}` : `${d.nombre} (con candado)`}
              onClick={() => (libre ? onElegir(d) : abrirPlanes())}
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: texto, minWidth: 0 }}>
              <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(22,50,79,0.12)" }}>
                <DiapositivaDisenada diapositiva={muestras[d.clave]} />
                {!libre && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(11,15,23,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}><Lock size={12} color="#fff" /></span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11.5, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nombre}</div>
            </button>
          );
        })}
      </div>
      {!tieneGaleria && <div style={{ fontSize: 11, color: oscuro ? "#9AA4B2" : "var(--wf-faint)", marginTop: 8 }}>Los diseños con candado son del plan Ministerio o mayor.</div>}
    </div>
  );
}
