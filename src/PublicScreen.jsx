import { useEffect, useRef, useState } from "react";
import { ProjectionPanel } from "./PrototipoWorshipFlow.jsx";
import { getLiveSession, subscribeLiveSession } from "./lib/liveSession.js";

const CURSOR_IDLE_MS = 3000;

export default function PublicScreen() {
  const [live, setLive] = useState({ slide: null, blanked: false, liveStyle: { theme: "stage", font: "elegante" } });
  const [cursorHidden, setCursorHidden] = useState(false);
  const [needsTapToFullscreen, setNeedsTapToFullscreen] = useState(false);
  const idleTimerRef = useRef(null);

  // Ya no BroadcastChannel (solo servía dentro del mismo navegador): ahora se lee la sesión en vivo
  // de Supabase al entrar y se sigue en tiempo real con Realtime — funciona aunque esta pantalla esté
  // en una computadora distinta a la del panel de control.
  useEffect(() => {
    const aplicar = (fila) => setLive({ slide: fila.slide_actual, blanked: fila.blanked, liveStyle: fila.estilo_en_vivo || { theme: "stage", font: "elegante" } });
    getLiveSession().then(aplicar).catch(() => {});
    const unsubscribe = subscribeLiveSession(aplicar);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const resetIdle = () => {
      setCursorHidden(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    };
    resetIdle();
    window.addEventListener("mousemove", resetIdle);
    return () => { window.removeEventListener("mousemove", resetIdle); clearTimeout(idleTimerRef.current); };
  }, []);

  // Se intenta pantalla completa sola apenas se monta (a veces alcanza a contar como "gesto de usuario"
  // porque esta ventana se abrió con window.open desde el clic de "Iniciar evento"/"Reabrir proyección",
  // pero casi siempre el navegador ya perdió ese permiso para cuando esta página termina de cargar). Si
  // no lo logra, se muestra un botón bien visible que cubre toda la pantalla — un clic ahí SÍ cuenta
  // como gesto real y el navegador lo permite siempre, sin depender de timing ni del navegador usado.
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const checkTimer = setTimeout(() => {
      if (!document.fullscreenElement) setNeedsTapToFullscreen(true);
    }, 500);
    const onFsChange = () => setNeedsTapToFullscreen(!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => { clearTimeout(checkTimer); document.removeEventListener("fullscreenchange", onFsChange); };
  }, []);

  const tapToFullscreen = () => {
    document.documentElement.requestFullscreen?.().then(() => setNeedsTapToFullscreen(false)).catch(() => {});
  };

  return (
    <div style={{ height: "100vh", display: "flex", cursor: cursorHidden ? "none" : "default" }}>
      <ProjectionPanel slide={live.slide} blanked={live.blanked} split={false} liveStyle={live.liveStyle} />
      {needsTapToFullscreen && (
        <button
          onClick={tapToFullscreen}
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", background: "rgba(11,15,22,0.94)", color: "#fff", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 999 }}
        >
          <span style={{ fontSize: 22, fontWeight: 700 }}>Toca para pantalla completa</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: "#8996A6" }}>Oculta la barra de tareas y queda lista para proyectar</span>
        </button>
      )}
    </div>
  );
}
