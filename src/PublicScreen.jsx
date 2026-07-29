import { useEffect, useRef, useState } from "react";
import { ProjectionPanel } from "./PrototipoWorshipFlow.jsx";
import { getLiveSession, subscribeLiveSession } from "./lib/liveSession.js";

const CURSOR_IDLE_MS = 3000;

export default function PublicScreen() {
  const [live, setLive] = useState({ slide: null, blanked: false, liveStyle: { theme: "stage", font: "elegante" } });
  const [cursorHidden, setCursorHidden] = useState(false);
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

  // Debe quedar en pantalla completa sola, sin que el operador tenga que darle un clic extra: se pide
  // apenas se monta (todavía cuenta como "gesto de usuario" porque esta ventana se abrió con window.open
  // desde el clic de "Iniciar evento"/"Reabrir proyección"). Sin botón visible ni mensajes de respaldo:
  // si el navegador la bloquea, se reintenta en silencio ante el primer movimiento sobre esta pantalla.
  useEffect(() => {
    const request = () => document.documentElement.requestFullscreen?.().catch(() => {});
    request();
    const onFirstInteraction = () => { if (!document.fullscreenElement) request(); };
    window.addEventListener("pointerdown", onFirstInteraction, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstInteraction);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", cursor: cursorHidden ? "none" : "default" }}>
      <ProjectionPanel slide={live.slide} blanked={live.blanked} split={false} liveStyle={live.liveStyle} />
    </div>
  );
}
