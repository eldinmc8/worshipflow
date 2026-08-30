import { useEffect, useState } from "react";
import { AlertTriangle, WifiOff, Info, X } from "lucide-react";
import { subscribeToast } from "./lib/toast.js";

// Se monta UNA sola vez en main.jsx (fuera de AuthGate) para que funcione sin importar en qué
// pantalla esté la persona — Login, Usuarios, la app real, etc. — sin tener que pasar props por
// todos lados. Reemplaza los window.alert() nativos por una tarjeta con la misma identidad visual
// del resto de la app (sombra suave, esquinas redondeadas), en vez de un aviso del sistema que se ve
// como si algo estuviera roto.
const ESTILOS = {
  error: { accent: "#C23B32", Icon: AlertTriangle },
  offline: { accent: "#E8821E", Icon: WifiOff },
  info: { accent: "#2F5FA8", Icon: Info },
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribeToast((toast) => {
    setToasts((ts) => [...ts, toast]);
    const duracion = toast.type === "offline" ? 7000 : 5000;
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== toast.id)), duracion);
  }), []);

  if (!toasts.length) return null;

  return (
    <div
      style={{
        position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10000,
        padding: "0 16px", pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => {
        const { accent, Icon } = ESTILOS[toast.type] || ESTILOS.error;
        return (
          <div
            key={toast.id}
            className="screen-enter"
            style={{
              pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10,
              maxWidth: 420, width: "100%", background: "#FFFFFF", borderLeft: `4px solid ${accent}`,
              borderRadius: 12, boxShadow: "0 8px 28px rgba(22,50,79,0.22)", padding: "12px 14px",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <Icon size={18} color={accent} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#16233A", flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
            <button
              onClick={() => setToasts((ts) => ts.filter((t) => t.id !== toast.id))}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}
            >
              <X size={14} color="#8996A6" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
