import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { esIphone, soportaPantallaCompleta } from "../lib/pantallaCompleta.js";

// En iPhone no existe la pantalla completa para páginas web. Lo más parecido: Compartir → "Agregar a
// inicio", que abre la pantalla sin las barras de Safari. Este aviso lo explica unos segundos al abrir
// (solo en iPhone, y no si ya se abrió desde el ícono de inicio) y se va solo o con la X.
export default function AvisoIphone() {
  const [visible, setVisible] = useState(() => esIphone() && !soportaPantallaCompleta() && !(typeof navigator !== "undefined" && navigator.standalone));
  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => setVisible(false), 12000);
    return () => clearTimeout(t);
  }, [visible]);
  if (!visible) return null;
  return (
    <div role="status" style={{ position: "fixed", left: 12, right: 12, bottom: "calc(12px + env(safe-area-inset-bottom))", zIndex: 1001, display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(22,35,58,0.96)", color: "#fff", borderRadius: 14, padding: "12px 14px", fontFamily: "'Poppins', sans-serif", fontSize: 13, lineHeight: 1.45, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
      <span style={{ flex: 1 }}>
        <b>En iPhone no hay pantalla completa.</b> Para verla sin las barras de Safari: toca <b>Compartir</b> (el cuadrito con la flecha) → <b>Agregar a inicio</b>, y ábrela desde ese ícono.
      </span>
      <button type="button" onClick={() => setVisible(false)} aria-label="Cerrar aviso" style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 2, display: "flex" }}><X size={16} /></button>
    </div>
  );
}
