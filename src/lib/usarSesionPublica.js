import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { subscribeLiveSession, subscribeLiveBroadcast, pedirEstadoActual, guardarUltimaFila, leerUltimaFila, leerSesionPublica, escucharPantallas } from "./liveSession.js";

const CADA_MS = 30000; // cada cuánto se vuelve a confirmar el código (y se resincroniza lo que está al aire)

// Lo que está al aire para una pantalla SIN sesión (proyección /p/… o escenario /e/…). Devuelve
// { fila, vencido, iglesiaId }. Tres caminos, se aplica lo que llegue primero:
// 1. Canal local del navegador: la consola en la MISMA computadora (TV por HDMI). Funciona sin internet y
//    sin código — es la misma máquina de quien lleva la transmisión.
// 2. Supabase con el código del enlace: lectura inicial (sesion_en_vivo_publica) + canal de Realtime con
//    el código en el nombre. Cada 30 s se vuelve a confirmar: si el código venció (se finalizó la
//    transmisión), vencido = true y la pantalla deja de mostrar.
// 3. Si la base todavía no tiene el código (migración sin correr), la lectura de siempre.
export function useSesionPublica({ slug, codigo }) {
  const [iglesiaId, setIglesiaId] = useState(null);
  const [fila, setFila] = useState(null);
  const [vencido, setVencido] = useState(false);
  const localRef = useRef(false);

  // Iglesia: slug de la URL → id (iglesia_id_por_slug), con copia en este dispositivo para arrancar sin internet.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const claveCache = `worshipflow_iglesia_por_slug_${slug || "_defecto"}`;
    const directo = params.get("iid");
    let guardado = null;
    try { guardado = localStorage.getItem(claveCache); } catch { /* sin storage */ }
    if (directo || guardado) setIglesiaId(directo || guardado);
    const resolver = slug ? supabase.rpc("iglesia_id_por_slug", { p_slug: slug }) : supabase.rpc("iglesia_id_por_defecto");
    resolver.then(({ data }) => {
      if (!data) return;
      setIglesiaId(data);
      try { localStorage.setItem(claveCache, data); } catch { /* sin storage */ }
    }).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!iglesiaId) return undefined;
    let vivo = true;
    let quitarRemoto = null;
    let modoRemoto = null; // "codigo" | "antiguo"
    const aplicar = (f) => { if (!vivo || !f) return; setFila(f); guardarUltimaFila(iglesiaId, f); };

    const ultima = leerUltimaFila(iglesiaId);
    if (ultima) setFila(ultima);
    const quitarLocal = subscribeLiveBroadcast(iglesiaId, (f) => { localRef.current = true; setVencido(false); aplicar(f); });
    pedirEstadoActual(iglesiaId);

    const conectar = (modo) => {
      if (modoRemoto === modo) return;
      quitarRemoto?.();
      modoRemoto = modo;
      quitarRemoto = modo === "codigo" ? escucharPantallas(iglesiaId, codigo, aplicar) : subscribeLiveSession(iglesiaId, aplicar);
    };
    const verificar = async () => {
      try {
        const r = await leerSesionPublica(iglesiaId, codigo);
        if (!vivo) return;
        if (r.estado === "vencido") {
          quitarRemoto?.(); quitarRemoto = null; modoRemoto = null;
          if (!localRef.current) { setVencido(true); setFila(null); guardarUltimaFila(iglesiaId, null); }
          return;
        }
        setVencido(false);
        aplicar(r.fila);
        conectar(r.estado === "ok" ? "codigo" : "antiguo");
      } catch { /* sin internet: se sigue mostrando lo último */ }
    };
    verificar();
    const intervalo = setInterval(verificar, CADA_MS);
    return () => { vivo = false; clearInterval(intervalo); quitarLocal(); quitarRemoto?.(); };
  }, [iglesiaId, codigo]);

  return { fila, vencido, iglesiaId };
}
