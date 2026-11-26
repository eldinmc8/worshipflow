// Pantalla de escenario (/e/…) y salida para OBS (/t/…): desde el plan Ministerio (Eldin, 2026-11-26).
// Se abren sin sesión, así que se pregunta a la base con pantallas_extra_permitidas(iglesia) (solo dice
// sí/no). Si la pregunta falla (sin internet, SQL aún sin correr) se deja abrir: no se traba un culto.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";

const claveCache = (id) => `wf_pantallas_extra_${id}`;

export function usePantallasExtraPermitidas(iglesiaId) {
  const [permitido, setPermitido] = useState(() => {
    try { return iglesiaId ? localStorage.getItem(claveCache(iglesiaId)) !== "no" : true; } catch { return true; }
  });
  useEffect(() => {
    if (!iglesiaId) return undefined;
    let vivo = true;
    const revisar = () => supabase.rpc("pantallas_extra_permitidas", { p_iglesia: iglesiaId }).then(({ data, error }) => {
      if (!vivo || error || typeof data !== "boolean") return;
      setPermitido(data);
      try { localStorage.setItem(claveCache(iglesiaId), data ? "si" : "no"); } catch { /* sin storage */ }
    }).catch(() => {});
    revisar();
    const t = setInterval(revisar, 5 * 60 * 1000); // si mejoran el plan, la pantalla se abre sola
    return () => { vivo = false; clearInterval(t); };
  }, [iglesiaId]);
  return permitido;
}
