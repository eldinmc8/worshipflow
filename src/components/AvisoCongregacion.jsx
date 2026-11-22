import { useEffect, useState } from "react";
import { avisoValido, DURACION_AVISO_DEFECTO } from "../lib/avisoCongregacion.js";

// La franja que se ve en el proyector (ver lib/avisoCongregacion.js). Se dibuja encima de la diapositiva,
// abajo, sin tocar lo que está al aire. Cuenta su tiempo desde que ESTA pantalla la recibió (no depende de
// que los relojes de los equipos coincidan) y se quita sola.
export default function AvisoCongregacion({ aviso, miniatura = false }) {
  const valido = avisoValido(aviso);
  const id = valido ? aviso.id : null;
  const [visto, setVisto] = useState(null); // { id, hasta } según el reloj de esta pantalla
  const [, setTic] = useState(0);

  useEffect(() => {
    if (!id) return;
    setVisto((v) => (v?.id === id ? v : { id, hasta: Date.now() + (Number(aviso.duracionSeg) || DURACION_AVISO_DEFECTO) * 1000 }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visto) return undefined;
    const falta = visto.hasta - Date.now();
    if (falta <= 0) return undefined;
    const t = setTimeout(() => setTic((n) => n + 1), falta + 30);
    return () => clearTimeout(t);
  }, [visto]);

  if (!id || visto?.id !== id || Date.now() >= visto.hasta) return null;

  return (
    <div role="status" aria-live="polite" data-aviso-congregacion="" style={{
      position: "absolute", left: miniatura ? "4%" : "5%", right: miniatura ? "4%" : "5%", bottom: miniatura ? "5%" : "6%", zIndex: 30,
      display: "flex", alignItems: "center", gap: miniatura ? 5 : "1.2vh",
      background: "rgba(10,16,28,0.88)", borderLeft: `${miniatura ? 3 : 8}px solid #E8821E`,
      borderRadius: miniatura ? 5 : 14, padding: miniatura ? "4px 7px" : "1.6vh 2.6vh",
      boxShadow: "0 6px 24px rgba(0,0,0,0.45)", boxSizing: "border-box",
      animation: "wfAvisoEntra 0.45s ease-out both", pointerEvents: "none",
    }}>
      <span style={{
        color: "#fff", fontFamily: "'Poppins', sans-serif", fontWeight: 600, lineHeight: 1.25,
        fontSize: miniatura ? 9 : "clamp(18px, 4.4vh, 64px)", textAlign: "center", flex: 1,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>{aviso.texto}</span>
    </div>
  );
}
