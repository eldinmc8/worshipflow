import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ProjectionPanel } from "./PrototipoWorshipFlow.jsx";
import { getLiveSession, subscribeLiveSession, subscribeLiveBroadcast } from "./lib/liveSession.js";
import { supabase } from "./lib/supabaseClient.js";

const CURSOR_IDLE_MS = 3000;

export default function PublicScreen() {
  const [live, setLive] = useState({ slide: null, blanked: false, liveStyle: { theme: "stage", font: "elegante" } });
  const [cursorHidden, setCursorHidden] = useState(false);
  const [needsTapToFullscreen, setNeedsTapToFullscreen] = useState(false);
  // Distinto de needsTapToFullscreen (la primera vez, antes de que se vea nada todavía): esta pantalla
  // YA estaba en pantalla completa, mostrando contenido con normalidad, y la perdió sola -- típicamente
  // porque en el panel de control alguien abrió el diálogo nativo de "elegir archivo" para subir un
  // fondo nuevo (ver MediaPicker en PrototipoWorshipFlow.jsx). Windows/Chrome a veces sacan de pantalla
  // completa a TODAS las ventanas de ese navegador cuando aparece un diálogo así en cualquiera de ellas,
  // sin que nadie haya tocado esta pantalla ni su contenido. Tapar todo con el aviso grande en ese caso
  // sería justo la interrupción que se quiere evitar -- acá se deja el contenido tal cual, visible, y
  // solo se ofrece un botón chico para recuperar la pantalla completa cuando convenga.
  const [fullscreenDroppedQuietly, setFullscreenDroppedQuietly] = useState(false);
  const everFullscreenRef = useRef(false);
  const idleTimerRef = useRef(null);

  // Fase 2b (multi-iglesia): esta pantalla no tiene sesión iniciada (es la que ve la congregación,
  // anclada a una URL fija), así que no puede saber "mi iglesia" vía auth.uid() como el resto de la
  // app — lo trae de la URL (?screen=publico&igl=<slug>, puesta por openOnOtherScreen en
  // PrototipoWorshipFlow.jsx) y la resuelve a un id con la función iglesia_id_por_slug (de solo
  // lectura, ejecutable sin sesión — ver migración 20260930000300_sesion_en_vivo_por_iglesia.sql).
  // Sin slug en la URL (pantalla instalada antes de este cambio), cae a iglesia_id_por_defecto() —
  // correcto mientras exista una sola iglesia.
  const [iglesiaId, setIglesiaId] = useState(null);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("igl");
    const resolver = slug
      ? supabase.rpc("iglesia_id_por_slug", { p_slug: slug })
      : supabase.rpc("iglesia_id_por_defecto");
    resolver.then(({ data }) => setIglesiaId(data || null)).catch(() => {});
  }, []);

  // Dos caminos a la vez: BroadcastChannel llega al instante (sin depender de internet) cuando esta
  // pantalla está en la MISMA computadora que el panel de control — el caso típico: TV conectado por
  // HDMI como segunda pantalla, igual que un presentador local (tipo PowerPoint). Supabase Realtime
  // sigue siendo el camino real cuando esta pantalla está en otro dispositivo de verdad — se lee la
  // sesión en vivo al entrar y se sigue seguido por Realtime, más lento si el internet del lugar anda
  // mal, pero funciona aunque control y proyección estén en computadoras distintas.
  useEffect(() => {
    if (!iglesiaId) return;
    const aplicar = (fila) => setLive({ slide: fila.slide_actual, blanked: fila.blanked, liveStyle: fila.estilo_en_vivo || { theme: "stage", font: "elegante" } });
    getLiveSession(iglesiaId).then(aplicar).catch(() => {});
    const unsubscribeRealtime = subscribeLiveSession(iglesiaId, aplicar);
    const unsubscribeBroadcast = subscribeLiveBroadcast(iglesiaId, aplicar);
    return () => { unsubscribeRealtime(); unsubscribeBroadcast(); };
  }, [iglesiaId]);

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
    const onFsChange = () => {
      if (document.fullscreenElement) {
        everFullscreenRef.current = true;
        setNeedsTapToFullscreen(false);
        setFullscreenDroppedQuietly(false);
        return;
      }
      if (everFullscreenRef.current) {
        // Reintenta sola, en silencio (sin gesto no va a funcionar casi nunca, pero no cuesta nada
        // intentarlo -- si por lo que sea sí alcanza, nadie ni se entera de que pasó algo).
        document.documentElement.requestFullscreen?.().catch(() => {});
        setFullscreenDroppedQuietly(true);
      } else {
        setNeedsTapToFullscreen(true);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => { clearTimeout(checkTimer); document.removeEventListener("fullscreenchange", onFsChange); };
  }, []);

  const tapToFullscreen = () => {
    document.documentElement.requestFullscreen?.().then(() => { setNeedsTapToFullscreen(false); setFullscreenDroppedQuietly(false); }).catch(() => {});
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
      {/* A diferencia del aviso grande de arriba, este NO tapa el contenido -- la idea es justo que la
          congregación no note nada, solo quien esté junto al proyector/TV vea este botón chico (se
          esconde solo con el cursor, igual que "Salir") y lo toque si quiere recuperar la pantalla
          completa de verdad (sin él, el contenido se sigue viendo bien igual, solo con una franja fina
          de la ventana del navegador en vez de ocupar el monitor borde a borde). */}
      {!cursorHidden && fullscreenDroppedQuietly && (
        <button
          onClick={tapToFullscreen}
          title="Se perdió la pantalla completa sola — tocar para recuperarla"
          style={{ position: "fixed", bottom: 10, right: 10, fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 20, background: "rgba(232,130,30,0.85)", color: "#16324F", border: "none", cursor: "pointer", zIndex: 1000 }}
        >
          Pantalla completa
        </button>
      )}
    </div>
  );
}
