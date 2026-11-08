import { useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { tipoDeVideo, urlIncrustada } from "../lib/videoEnlace.js";

// Video en la proyección (2026-11-08): archivos (.mp4, subidos a la app, Google Drive) con <video>;
// YouTube y Vimeo con su reproductor incrustado.
// - conSonido: video solo, a pantalla completa → con sonido y una sola vez. Si el navegador no deja
//   arrancar con sonido (nadie tocó todavía la pantalla de proyección), arranca sin sonido para que al
//   menos se vea, en vez de quedarse en negro.
// - miniatura: vistas previas de la consola → nunca suenan ni cargan el reproductor de YouTube (se
//   muestra su imagen), para no oír el video dos veces ni cargar de más la computadora.
export default function VideoProyectado({ url, conSonido = false, miniatura = false, ajuste = "cover" }) {
  const info = tipoDeVideo(url);
  const ref = useRef(null);
  const sonar = conSonido && !miniatura;

  useEffect(() => {
    const v = ref.current;
    if (!v || !sonar) return;
    v.muted = false;
    const intento = v.play?.();
    if (intento && typeof intento.catch === "function") {
      intento.catch(() => { v.muted = true; v.play?.().catch(() => {}); });
    }
  }, [sonar, info.src]);

  const cubrir = { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none" };

  if (info.tipo === "youtube" || info.tipo === "vimeo") {
    if (miniatura) {
      return (
        <div style={{ ...cubrir, background: info.miniatura ? `center / cover no-repeat url(${info.miniatura})` : "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "3px 8px" }}><Play size={10} /> {info.nombre}</span>
        </div>
      );
    }
    return (
      <iframe
        key={`${info.src}-${sonar}`} title={`Video de ${info.nombre}`} src={urlIncrustada(info, { conSonido: sonar })}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
        style={{ ...cubrir, background: "#000" }}
      />
    );
  }
  if (info.tipo !== "archivo") return null;
  return (
    <video
      ref={ref} key={`${info.src}-${sonar}`} src={info.src} autoPlay playsInline
      muted={!sonar} loop={!sonar} preload="auto"
      style={{ ...cubrir, objectFit: ajuste }}
    />
  );
}
