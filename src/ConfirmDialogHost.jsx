import { useEffect, useRef, useState } from "react";
import { subscribeConfirm, resolverConfirm } from "./lib/confirm.js";

// Se monta UNA sola vez en main.jsx (igual que ToastHost) para que funcione desde cualquier
// pantalla. Reemplaza window.confirm()/window.prompt() nativos por una tarjeta con la identidad
// visual de la app — el diálogo del navegador delataba que esto corre en
// worshipflow-pearl.vercel.app en vez de sentirse como una app real, y no hay forma de ocultar eso
// sin dominio propio.
export default function ConfirmDialogHost() {
  const [dialog, setDialog] = useState(null); // { tipo, mensaje, titulo, textoConfirmar, danger, placeholder } | null
  const [valor, setValor] = useState("");
  const inputRef = useRef(null);

  useEffect(() => subscribeConfirm((d) => { setDialog(d); setValor(""); }), []);
  // Foco automático en el campo de texto apenas aparece un diálogo tipo "prompt" — igual que hacía
  // window.prompt() nativo, sin que la persona tenga que tocar el campo primero.
  useEffect(() => {
    if (dialog?.tipo === "prompt") inputRef.current?.focus();
  }, [dialog]);

  if (!dialog) return null;
  const esPrompt = dialog.tipo === "prompt";

  const cerrar = (valorFinal) => {
    resolverConfirm(valorFinal);
    setDialog(null);
  };
  const aceptar = () => cerrar(esPrompt ? (valor.trim() || null) : true);
  const cancelar = () => cerrar(esPrompt ? null : false);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, padding: 20 }}
      onClick={cancelar}
    >
      <div
        className="screen-enter"
        style={{ width: 340, maxWidth: "100%", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.35)", padding: 24, fontFamily: "'Poppins', sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {dialog.titulo && (
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: "var(--wf-heading)", marginBottom: 8 }}>{dialog.titulo}</div>
        )}
        <div style={{ fontSize: 14, color: "var(--wf-text)", lineHeight: 1.5, marginBottom: esPrompt ? 12 : 22 }}>{dialog.mensaje}</div>
        {esPrompt && (
          <input
            ref={inputRef}
            type={dialog.esPassword ? "password" : "text"}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") aceptar(); }}
            placeholder={dialog.placeholder || ""}
            style={{ width: "100%", background: "var(--wf-bg)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box", marginBottom: 22 }}
          />
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={cancelar}
            style={{ background: "var(--wf-hover)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "var(--wf-text)", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={aceptar}
            style={{ background: dialog.danger ? "#C23B32" : "#E8821E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: dialog.danger ? "#fff" : "#16324F", cursor: "pointer" }}
          >
            {dialog.textoConfirmar || "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}
