import { useEffect, useRef, useState } from "react";
import { Play, VolumeX } from "lucide-react";
import { tipoDeVideo, urlIncrustada } from "../lib/videoEnlace.js";
import { posicionActual } from "../lib/videoControl.js";
import { aplicarSalidaAudio, escucharSalidaAudio } from "../lib/salidaAudio.js";

// Video en la proyección (2026-11-08): archivos (.mp4, subidos a la app, Google Drive) con <video>;
// YouTube y Vimeo con su reproductor incrustado, manejado por mensajes (postMessage) para que la consola
// lo controle: play, pausa, detener, saltar y sonido (ver lib/videoControl.js).
//
// - conSonido: video solo, a pantalla completa. Arranca siempre (sin sonido, que el navegador nunca
//   bloquea) y enseguida se le activa el sonido. Si el navegador no lo deja (nadie tocó todavía esta
//   pantalla), sigue sin sonido para que al menos se vea, avisa a la consola y muestra un aviso chico:
//   con UN toque en la pantalla (o OK en el control de la TV) ya suena, y ese permiso dura toda la sesión.
// - control: lo que mandó la consola ({ estado, pos, en, sonido, n }). Sin control (consola vieja) se
//   reproduce desde el inicio, como antes.
// - onEstado: la pantalla de proyección reporta { pos, duracion, reproduciendo, sonidoBloqueado }.
// - miniatura: vistas previas de la consola → nunca suenan, no se controlan y no cargan el reproductor
//   de YouTube (se muestra su imagen).
export default function VideoProyectado({ url, conSonido = false, miniatura = false, ajuste = "cover", control = null, onEstado = null }) {
  const info = tipoDeVideo(url);
  const conControl = conSonido && !miniatura;
  if (info.tipo === "youtube" || info.tipo === "vimeo") {
    if (miniatura) {
      return (
        <div style={{ ...cubrir, background: info.miniatura ? `center / cover no-repeat url(${info.miniatura})` : "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "3px 8px" }}><Play size={10} /> {info.nombre}</span>
        </div>
      );
    }
    return <ReproductorIncrustado key={info.src} info={info} conSonido={conControl} control={conControl ? control : null} onEstado={conControl ? onEstado : null} />;
  }
  if (info.tipo !== "archivo") return null;
  return <ReproductorArchivo key={info.src} src={info.src} ajuste={ajuste} conSonido={conControl} control={conControl ? control : null} onEstado={conControl ? onEstado : null} />;
}

const cubrir = { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none" };

// Aviso chico (abajo, centrado) cuando el navegador bloqueó el sonido. Cualquier toque o tecla en la
// pantalla (OK del control remoto incluido) lo resuelve.
function AvisoSonido() {
  return (
    <div style={{ position: "absolute", left: "50%", bottom: "4%", transform: "translateX(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: "clamp(11px, 1.6vw, 18px)", fontWeight: 600, borderRadius: 999, padding: "0.5em 1.1em", fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap", pointerEvents: "none" }}>
      <VolumeX size={16} /> Toca la pantalla o presiona OK en el control para activar el sonido
    </div>
  );
}

// Se escucha en toda la ventana: el primer toque/tecla cuenta como permiso del navegador para el sonido.
function usePrimerGesto(activo, alTocar) {
  const ref = useRef(alTocar);
  ref.current = alTocar;
  useEffect(() => {
    if (!activo) return undefined;
    const f = () => ref.current();
    window.addEventListener("pointerdown", f);
    window.addEventListener("keydown", f);
    return () => { window.removeEventListener("pointerdown", f); window.removeEventListener("keydown", f); };
  }, [activo]);
}

// Reporta a lo sumo una vez por segundo (y al cambiar algo importante).
function useReporte(onEstado) {
  const ultimo = useRef({ t: 0, clave: "", pos: 0 });
  return (estado) => {
    if (!onEstado) return;
    const clave = `${estado.reproduciendo}|${estado.sonidoBloqueado}|${Math.round(estado.duracion || 0)}`;
    const ahora = Date.now();
    const salto = Math.abs((estado.pos || 0) - ultimo.current.pos) > 2; // un salto (±10 s) se avisa ya
    if (clave === ultimo.current.clave && !salto && ahora - ultimo.current.t < 1000) return;
    ultimo.current = { t: ahora, clave, pos: estado.pos || 0 };
    onEstado(estado);
  };
}

// ---------- Archivo de video (<video>) ----------
function ReproductorArchivo({ src, ajuste, conSonido, control, onEstado }) {
  const ref = useRef(null);
  const [bloqueado, setBloqueado] = useState(false);
  // Salida de audio elegida en Ajustes para esta computadora (ej. la consola/mixer en vez del HDMI del
  // proyector). Se aplica al cargar y cambia en vivo si alguien la ajusta. Ver lib/salidaAudio.js.
  useEffect(() => {
    if (!conSonido) return undefined;
    aplicarSalidaAudio(ref.current);
    const quitar = escucharSalidaAudio((salida) => aplicarSalidaAudio(ref.current, salida));
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
    const alConectar = () => aplicarSalidaAudio(ref.current); // se conectó/desconectó la interfaz de audio
    md?.addEventListener?.("devicechange", alConectar);
    return () => { quitar(); md?.removeEventListener?.("devicechange", alConectar); };
  }, [conSonido, src]);
  const reportar = useReporte(onEstado);
  const quiereSonido = conSonido && (control ? control.sonido !== false : true);
  const detenido = control?.estado === "stop";

  const reproducir = (v) => {
    v.muted = !quiereSonido;
    const p = v.play?.();
    if (p && typeof p.then === "function") {
      p.then(() => { if (!v.muted) setBloqueado(false); })
        .catch(() => { if (!v.muted) { v.muted = true; setBloqueado(true); v.play?.().catch(() => {}); } });
    }
  };
  // Chrome a veces deja arrancar y enseguida PAUSA el video al activarle el sonido sin un toque previo:
  // si se pausó solo (la consola no pidió pausa), sigue sin sonido y avisa, en vez de quedarse congelado.
  const alPausarse = () => {
    const v = ref.current;
    alAvanzar();
    if (!v || v.ended || !conSonido || v.muted || (control && control.estado !== "play")) return;
    v.muted = true; setBloqueado(true); v.play?.().catch(() => {});
  };

  // Aplica cada orden de la consola (o el arranque, si no hay consola que mande).
  useEffect(() => {
    const v = ref.current;
    if (!v || !conSonido) return;
    const objetivo = control ? posicionActual(control) : null;
    if (objetivo != null && Number.isFinite(objetivo) && Math.abs((v.currentTime || 0) - objetivo) > 1.5) {
      try { v.currentTime = objetivo; } catch { /* aún sin datos */ }
    }
    if (!control || control.estado === "play") reproducir(v);
    else { try { v.pause?.(); } catch { /* sin soporte */ } }
    if (!quiereSonido) v.muted = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conSonido, control?.n, control?.estado, quiereSonido]);

  // Vigilante (igual que en YouTube): si debe estar reproduciéndose y está quieto, se vuelve a arrancar
  // solo — sin sonido si el navegador no lo deja — en vez de tener que detener y dar play.
  useEffect(() => {
    if (!conSonido) return undefined;
    const t = setInterval(() => {
      const v = ref.current;
      if (!v || v.ended || v.readyState < 2 || (control && control.estado !== "play")) return;
      if (!v.paused) return;
      if (!v.muted && quiereSonido) { v.muted = true; setBloqueado(true); }
      v.play?.().catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  });

  usePrimerGesto(bloqueado, () => {
    const v = ref.current;
    setBloqueado(false);
    if (v && quiereSonido) { v.muted = false; if (!control || control.estado === "play") v.play?.().catch(() => {}); }
  });

  const alAvanzar = () => {
    const v = ref.current;
    if (!v) return;
    reportar({ pos: v.currentTime || 0, duracion: Number.isFinite(v.duration) ? v.duration : null, reproduciendo: !v.paused && !v.ended, sonidoBloqueado: bloqueado, termino: v.ended });
  };

  return (
    <>
      <video
        ref={ref} src={src} autoPlay muted playsInline preload="auto" loop={!conSonido}
        onTimeUpdate={alAvanzar} onPlay={alAvanzar} onPause={alPausarse} onEnded={alAvanzar} onLoadedMetadata={alAvanzar} onSeeked={alAvanzar}
        style={{ ...cubrir, objectFit: ajuste, visibility: detenido ? "hidden" : "visible" }}
      />
      {bloqueado && quiereSonido && !detenido && <AvisoSonido />}
    </>
  );
}

// ---------- YouTube / Vimeo (iframe manejado por postMessage) ----------
function ReproductorIncrustado({ info, conSonido, control, onEstado }) {
  const ref = useRef(null);
  const listo = useRef(false);
  const estado = useRef({ pos: 0, duration: null, reproduciendo: false, muted: true });
  const intentoSonido = useRef(0);
  const ultimaOrden = useRef(0); // cuándo se mandó la última orden (para el vigilante)
  const estadoConocido = useRef(false); // ¿el reproductor ya nos dijo si corre o está pausado?
  const reintentos = useRef(0);
  const [bloqueado, setBloqueado] = useState(false);
  const reportar = useReporte(onEstado);
  const esYT = info.tipo === "youtube";
  const quiereSonido = conSonido && (control ? control.sonido !== false : true);
  const detenido = control?.estado === "stop";
  // Arranca SIEMPRE sin sonido (eso nunca lo bloquea el navegador) y luego se le pide sonido.
  const src = (() => {
    const base = urlIncrustada(info, { conSonido });
    if (!base) return null;
    const u = new URL(base);
    if (esYT) {
      u.searchParams.set("mute", "1");
      u.searchParams.set("enablejsapi", "1");
      if (typeof window !== "undefined") u.searchParams.set("origin", window.location.origin);
    } else {
      u.searchParams.set("muted", "1");
      u.searchParams.set("api", "1");
    }
    return u.toString();
  })();

  const mandar = (func, args = []) => {
    const w = ref.current?.contentWindow;
    if (!w) return;
    if (esYT) w.postMessage(JSON.stringify({ event: "command", func, args, id: 1, channel: "widget" }), "*");
    else w.postMessage(JSON.stringify(func === "playVideo" ? { method: "play" } : func === "pauseVideo" ? { method: "pause" } : func === "seekTo" ? { method: "setCurrentTime", value: args[0] } : func === "mute" ? { method: "setVolume", value: 0 } : func === "unMute" ? { method: "setVolume", value: 1 } : func === "stopVideo" ? { method: "unload" } : { method: func }), "*");
  };

  const aplicar = () => {
    if (!listo.current || !conSonido) return;
    ultimaOrden.current = Date.now();
    reintentos.current = 0;
    const objetivo = control ? posicionActual(control) : null;
    if (objetivo != null && Math.abs((estado.current.pos || 0) - objetivo) > 1.5) mandar("seekTo", [objetivo, true]);
    if (control?.estado === "stop") { mandar("pauseVideo"); mandar("seekTo", [0, true]); return; }
    if (control && control.estado === "pausa") { mandar("pauseVideo"); return; }
    mandar("playVideo");
    if (quiereSonido) { intentoSonido.current = Date.now(); mandar("unMute"); mandar("setVolume", [100]); }
    else mandar("mute");
  };

  // Mensajes del reproductor: listo, en qué segundo va, si está pausado y si está sin sonido.
  useEffect(() => {
    const alMensaje = (e) => {
      if (e.source !== ref.current?.contentWindow) return;
      let d = e.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
      if (!d) return;
      if (esYT) {
        if (d.event === "onReady" || d.event === "initialDelivery") { if (!listo.current) { listo.current = true; aplicar(); } }
        const i = d.info;
        // onStateChange trae el estado como número suelto (1 = reproduciendo, 2 = pausado, 0 = terminó).
        if (d.event === "onStateChange" && typeof i === "number") { estadoConocido.current = true; estado.current.reproduciendo = i === 1; estado.current.termino = i === 0; estado.current.cargando = i === 3; }
        if (i && typeof i === "object") {
          if (typeof i.currentTime === "number") estado.current.pos = i.currentTime;
          if (typeof i.duration === "number" && i.duration > 0) estado.current.duration = i.duration;
          if (typeof i.muted === "boolean") estado.current.muted = i.muted;
          if (typeof i.playerState === "number") {
            estadoConocido.current = true;
            estado.current.reproduciendo = i.playerState === 1;
            estado.current.termino = i.playerState === 0;
            estado.current.cargando = i.playerState === 3; // cargando (internet lento): no es que esté trabado
            // Se pidió sonido y el navegador lo frenó: se pausa solo apenas se le activa el sonido.
            if (i.playerState === 2 && quiereSonido && Date.now() - intentoSonido.current < 2500 && control?.estado !== "pausa") {
              setBloqueado(true); mandar("mute"); mandar("playVideo");
            }
          }
        }
      } else {
        if (d.event === "ready") {
          listo.current = true;
          for (const ev of ["timeupdate", "pause", "play"]) ref.current?.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value: ev }), "*");
          aplicar();
        }
        if (d.event === "timeupdate" && d.data) { estadoConocido.current = true; estado.current.pos = d.data.seconds || 0; estado.current.duration = d.data.duration || null; estado.current.reproduciendo = true; }
        if (d.event === "pause") { estadoConocido.current = true; estado.current.reproduciendo = false; }
      }
      reportar({ pos: estado.current.pos, duracion: estado.current.duration ?? null, reproduciendo: estado.current.reproduciendo, sonidoBloqueado: bloqueado || (quiereSonido && estado.current.muted && listo.current && Date.now() - intentoSonido.current > 3000) });
    };
    window.addEventListener("message", alMensaje);
    return () => window.removeEventListener("message", alMensaje);
  });

  // YouTube manda sus mensajes solo después de que se le pide que avise ("listening"). Arreglo
  // (2026-11-08, "tuve que darle stop y play para que se reprodujera"): antes se pedía UNA vez al cargar,
  // y si el reproductor de YouTube todavía no estaba listo nunca respondía — la app no se enteraba de si
  // el video corría y no podía rescatarlo. Ahora se pide cada 250 ms hasta que conteste.
  const alCargar = () => {
    if (esYT) {
      let veces = 0;
      const pedir = setInterval(() => {
        veces += 1;
        if (estadoConocido.current || veces > 60 || !ref.current) { clearInterval(pedir); return; }
        ref.current.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
      }, 250);
    }
    // Por si el aviso de "listo" no llega: se aplica igual al rato.
    setTimeout(() => { if (!listo.current) { listo.current = true; aplicar(); } }, 1500);
  };

  // Vigilante: si la consola dice "reproducir" y el video está quieto (el navegador lo pausó al activarle
  // el sonido, o no arrancó), se vuelve a arrancar solo. Al segundo intento, sin sonido (eso siempre se
  // deja) y con el aviso de "toca para activar el sonido". Ya no hace falta detener y volver a dar play.
  useEffect(() => {
    if (!conSonido) return undefined;
    const t = setInterval(() => {
      if (!listo.current || detenido || (control && control.estado !== "play")) return;
      if (estado.current.reproduciendo || estado.current.termino || estado.current.cargando) { reintentos.current = 0; return; }
      if (Date.now() - ultimaOrden.current < 2000) return;
      ultimaOrden.current = Date.now();
      reintentos.current += 1;
      if (reintentos.current === 1 && estadoConocido.current) { mandar("playVideo"); return; }
      if (quiereSonido) setBloqueado(true);
      mandar("mute"); mandar("playVideo");
    }, 1000);
    return () => clearInterval(t);
  });

  // Cada orden de la consola.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { aplicar(); }, [control?.n, control?.estado, quiereSonido]);

  usePrimerGesto(bloqueado, () => {
    setBloqueado(false);
    intentoSonido.current = Date.now();
    if (quiereSonido) { mandar("unMute"); mandar("setVolume", [100]); }
    if (!control || control.estado === "play") mandar("playVideo");
  });

  if (!src) return null;
  return (
    <>
      <iframe
        ref={ref} title={`Video de ${info.nombre}`} src={src} onLoad={alCargar}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"
        style={{ ...cubrir, background: "#000", visibility: detenido ? "hidden" : "visible" }}
      />
      {bloqueado && quiereSonido && !detenido && <AvisoSonido />}
    </>
  );
}
