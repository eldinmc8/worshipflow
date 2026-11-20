import { useEffect, useState } from "react";
import AutoFitText from "./components/AutoFitText.jsx";
import { leerTransmisionDeUrl } from "./lib/enlacePantalla.js";
import { useSesionPublica } from "./lib/usarSesionPublica.js";
import { estiloParaDiapositiva } from "./lib/estiloBiblia.js";
import { LIVE_FONTS } from "./pantallas/compartido.jsx";
import { ajustesTransmision, altoFranja, textoParaTransmision } from "./lib/transmision.js";

// Salida para la transmisión (OBS, Streamlabs…), 2026-11-20 — ver lib/transmision.js. Se pega en OBS como
// fuente "Navegador" del tamaño de la transmisión, SIN achicarla: el fondo es transparente (se ve la cámara
// detrás) y la letra sale sola en una franja abajo o arriba, con su propio tamaño. Pantalla en negro =
// no sale nada. Igual que la proyección: enlace fijo, sin sesión, sigue lo que esté en vivo.
const SOMBRA = "0 0.05em 0.12em rgba(0,0,0,0.95), 0 0 0.35em rgba(0,0,0,0.75)";

export default function PantallaTransmision() {
  // La página entera transparente (OBS la pone encima de la cámara).
  useEffect(() => {
    const antes = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return () => { [document.documentElement.style.background, document.body.style.background] = antes; };
  }, []);
  const [enlace] = useState(() => leerTransmisionDeUrl(window.location.pathname, window.location.search) || {});
  const { fila, vencido } = useSesionPublica({ slug: enlace.slug || null, codigo: enlace.codigo || null });
  const slide = fila?.slide_actual || null;
  const estilo = fila?.estilo_en_vivo || {};
  const ajustes = ajustesTransmision(estilo);
  const contenido = vencido
    ? { lineas: ["Enlace vencido: copia el nuevo en WorshipFlow → Pantallas y TV → Transmisión (OBS)"], referencia: "", aviso: true }
    : fila?.blanked ? null : textoParaTransmision(slide);
  const font = LIVE_FONTS[estiloParaDiapositiva(estilo, slide)?.font] || LIVE_FONTS.elegante;
  const alto = altoFranja(ajustes.tamano);
  const conFranja = ajustes.fondo === "franja" || contenido?.aviso;
  const margen = "3vh";
  const clave = slide ? String(slide.slideId ?? `${slide.reference || ""}|${slide.parte ?? ""}|${slide.title || ""}`) : "";

  return (
    <div data-testid="pantalla-transmision" style={{ position: "fixed", inset: 0, background: "transparent", overflow: "hidden", pointerEvents: "none" }}>
      {contenido && (
        <div key={clave} style={{
          position: "absolute", left: "4vw", right: "4vw", [ajustes.posicion === "arriba" ? "top" : "bottom"]: margen,
          height: `${alto * 100}vh`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: conFranja ? "rgba(8,10,14,0.72)" : "transparent", borderRadius: "1.4vh",
          padding: conFranja ? "1vh 3vw" : 0, boxSizing: "border-box",
        }}>
          <AutoFitText
            lines={contenido.lineas} targetRatio={contenido.referencia ? 0.36 : 0.42} minPx={12} maxWidth="100%"
            style={{ fontFamily: font.family, fontWeight: font.weight, fontStyle: font.italic ? "italic" : "normal", textTransform: font.transform, letterSpacing: font.tracking, color: contenido.aviso ? "#E8821E" : "#FFFFFF", textShadow: SOMBRA, lineHeight: 1.2, textAlign: "center", whiteSpace: slide?.type === "cancion" ? "nowrap" : "normal", textWrap: "balance" }}
          />
          {contenido.referencia && (
            <div style={{ flexShrink: 0, fontSize: `${alto * 13}vh`, fontWeight: 800, color: "#9FC0E8", textShadow: SOMBRA, fontFamily: "var(--wf-font-ui)", marginTop: "0.4vh" }}>{contenido.referencia}</div>
          )}
        </div>
      )}
    </div>
  );
}
