import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ProjectionPanel } from "./pantallas/proyeccion.jsx";
import { precargarFuentesAnimacion } from "./components/LetrasAnimadas.jsx";
import { leerPantallaDeUrl } from "./lib/enlacePantalla.js";
import { anunciarProyeccion, enviarEstadoVideo, alPedirCerrarProyeccion } from "./lib/liveSession.js";
import { useSesionPublica } from "./lib/usarSesionPublica.js";
import EnlaceVencido from "./components/EnlaceVencido.jsx";
import { soportaPantallaCompleta, estaEnPantallaCompleta, pedirPantallaCompleta, salirDePantallaCompleta, alCambiarPantallaCompleta } from "./lib/pantallaCompleta.js";
import AvisoIphone from "./components/AvisoIphone.jsx";

const CURSOR_IDLE_MS = 3000;

export default function PublicScreen() {
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

  // Las letras de los estilos animados se descargan al abrir la proyección, antes de que salga la primera diapositiva.
  useEffect(() => { precargarFuentesAnimacion(); }, []);
  // Esta pantalla no tiene sesión iniciada: la iglesia y el código secreto vienen del enlace
  // (/p/<iglesia>/<código>). Lo que está al aire llega por el canal local (misma computadora que la
  // consola) o por Supabase con el código, que vence al finalizar cada transmisión — ver useSesionPublica.
  const [enlace] = useState(() => leerPantallaDeUrl(window.location.pathname, window.location.search) || {});
  const { fila, vencido, iglesiaId } = useSesionPublica({ slug: enlace.slug || null, codigo: enlace.codigo || null });
  const live = fila
    ? { slide: fila.slide_actual, blanked: fila.blanked, liveStyle: fila.estilo_en_vivo || { theme: "stage", font: "elegante" } }
    : { slide: null, blanked: false, liveStyle: { theme: "stage", font: "elegante" } };

  // Avisa a la consola que esta pantalla está abierta (ver anunciarProyeccion): si no, la consola
  // muestra "La pantalla de proyección no está abierta". Con el enlace vencido no se anuncia.
  useEffect(() => (iglesiaId && !vencido ? anunciarProyeccion(iglesiaId) : undefined), [iglesiaId, vencido]);
  // Al finalizar el evento en la consola de esta computadora, esta ventana se cierra sola (ver
  // pedirCerrarProyeccion). Solo si la abrió la consola: un TV o equipo aparte se queda como está.
  useEffect(() => {
    if (!iglesiaId || typeof window === "undefined" || !window.opener) return undefined;
    return alPedirCerrarProyeccion(iglesiaId, () => { salirDePantallaCompleta(); window.close(); });
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
    salirDePantallaCompleta();
    window.location.href = window.location.origin + "/";
  };

  // Se intenta pantalla completa sola apenas se monta (a veces alcanza a contar como "gesto de usuario"
  // porque esta ventana se abrió con window.open desde el clic de "Iniciar evento"/"Reabrir proyección",
  // pero casi siempre el navegador ya perdió ese permiso para cuando esta página termina de cargar). Si
  // no lo logra, se muestra un botón bien visible que cubre toda la pantalla — un clic ahí SÍ cuenta
  // como gesto real y el navegador lo permite siempre, sin depender de timing ni del navegador usado.
  // iPhone (2026-11-02): Safari en iPhone no permite pantalla completa para páginas web, así que el aviso
  // de "Toca para pantalla completa" nunca debe salir ahí — antes salía y, como tocarlo no hacía nada, se
  // quedaba tapando la proyección para siempre. Ver lib/pantallaCompleta.js.
  useEffect(() => {
    if (!soportaPantallaCompleta()) return undefined;
    pedirPantallaCompleta();
    const checkTimer = setTimeout(() => {
      if (!estaEnPantallaCompleta()) setNeedsTapToFullscreen(true);
    }, 500);
    const onFsChange = () => {
      if (estaEnPantallaCompleta()) {
        everFullscreenRef.current = true;
        setNeedsTapToFullscreen(false);
        setFullscreenDroppedQuietly(false);
        return;
      }
      if (everFullscreenRef.current) {
        // A PROPÓSITO sin reintento automático acá (sí lo había en la primera versión de este arreglo,
        // 2026-10-04): aunque casi siempre falla por falta de gesto real, las pocas veces que SÍ
        // alcanzaba a funcionar la ventana de proyección saltaba al frente justo cuando el panel de
        // control estaba abriendo el diálogo nativo de "elegir archivo" (al subir un fondo) -- tapando
        // la pantalla de control y escondiendo ese diálogo detrás, viéndose como que "la app se puso en
        // negro y no deja hacer nada". Mejor esperar siempre al clic real en el botón de abajo.
        setFullscreenDroppedQuietly(true);
      } else {
        setNeedsTapToFullscreen(true);
      }
    };
    const dejar = alCambiarPantallaCompleta(onFsChange);
    return () => { clearTimeout(checkTimer); dejar(); };
  }, []);

  // El aviso se quita con el toque aunque el navegador no conceda la pantalla completa: nunca debe
  // quedarse tapando la proyección.
  const tapToFullscreen = async () => {
    await pedirPantallaCompleta();
    setNeedsTapToFullscreen(false);
    setFullscreenDroppedQuietly(false);
  };

  return (
    <div style={{ height: "100vh", display: "flex", cursor: cursorHidden ? "none" : "default" }}>
      {vencido ? <EnlaceVencido tipo="proyeccion" /> : (
        <ProjectionPanel slide={live.slide} blanked={live.blanked} split={false} liveStyle={live.liveStyle}
          onEstadoVideo={(e) => enviarEstadoVideo(iglesiaId, enlace.codigo || null, { ...e, slideId: live.slide?.slideId || null })} />
      )}
      {!cursorHidden && (
        <button
          onClick={salirDePantallaPublica}
          title="Salir de la pantalla de proyección"
          style={{ position: "fixed", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 1000 }}
        ><X size={15} /></button>
      )}
      <AvisoIphone />
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
