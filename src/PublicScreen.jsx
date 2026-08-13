import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ProjectionPanel } from "./PrototipoWorshipFlow.jsx";
import { getLiveSession, subscribeLiveSession, subscribeLiveBroadcast } from "./lib/liveSession.js";

const CURSOR_IDLE_MS = 3000;

export default function PublicScreen() {
  const [live, setLive] = useState({ slide: null, blanked: false, liveStyle: { theme: "stage", font: "elegante" } });
  const [cursorHidden, setCursorHidden] = useState(false);
  const [needsTapToFullscreen, setNeedsTapToFullscreen] = useState(false);
  const idleTimerRef = useRef(null);

  // Dos caminos a la vez: BroadcastChannel llega al instante (sin depender de internet) cuando esta
  // pantalla está en la MISMA computadora que el panel de control — el caso típico: TV conectado por
  // HDMI como segunda pantalla, igual que un presentador local (tipo PowerPoint). Supabase Realtime
  // sigue siendo el camino real cuando esta pantalla está en otro dispositivo de verdad — se lee la
  // sesión en vivo al entrar y se sigue seguido por Realtime, más lento si el internet del lugar anda
  // mal, pero funciona aunque control y proyección estén en computadoras distintas.
  useEffect(() => {
    const aplicar = (fila) => setLive({ slide: fila.slide_actual, blanked: fila.blanked, liveStyle: fila.estilo_en_vivo || { theme: "stage", font: "elegante" } });
    getLiveSession().then(aplicar).catch(() => {});
    const unsubscribeRealtime = subscribeLiveSession(aplicar);
    const unsubscribeBroadcast = subscribeLiveBroadcast(aplicar);
    return () => { unsubscribeRealtime(); unsubscribeBroadcast(); };
  }, []);

  useEffect(() => {
    const resetIdle = () => {
      setCursorHidden(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    };
    resetIdle();
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("touchstart", resetIdle); // esta pantalla no siempre tiene mouse (TV/tablet táctil)
    return () => { window.removeEventListener("mousemove", resetIdle); window.removeEventListener("touchstart", resetIdle); clearTimeout(idleTimerRef.current); };
  }, []);

  // Esta pantalla es deliberadamente de solo lectura, sin ningún botón ni navegación — pensada para un
  // dispositivo fijo junto al proyector que nunca debería necesitar interacción. Pero si un dispositivo
  // termina acá por error (ej. se instaló la PWA desde la URL ?screen=publico en vez de la del panel de
  // control), antes no había NINGUNA forma de salir desde la propia app — la única opción era desinstalar
  // y reinstalar. Este botón resuelve eso: se esconde solo junto con el cursor (igual que arriba), así
  // que la congregación nunca lo ve, pero aparece apenas alguien toca/mueve el mouse si lo necesita.
  const salirDePantallaPublica = () => {
    document.exitFullscreen?.().catch(() => {});
    window.location.href = window.location.origin + window.location.pathname;
  };

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
      {!cursorHidden && (
        <button
          onClick={salirDePantallaPublica}
          title="Salir de la pantalla de proyección"
          style={{ position: "fixed", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1000 }}
        ><X size={15} /></button>
      )}
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
