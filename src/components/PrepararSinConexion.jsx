import { useCallback, useEffect, useRef, useState } from "react";
import { WifiOff, Check, AlertTriangle, Loader2, CloudDownload } from "lucide-react";
import { supabase } from "../lib/supabaseClient.js";
import { loadCache } from "../lib/offlineCache.js";
import { isUpcoming } from "../lib/dates.js";
import { showToast, notifyError } from "../lib/toast.js";
import { listCancionesCompletas } from "../lib/canciones.js";
import { listEventosCompletos } from "../lib/eventos.js";
import { listMinisteriosCompletos } from "../lib/ministerios.js";
import { contarCapitulosGuardados, descargarBibliaCompleta } from "../lib/bibleOfflineStore.js";
import { fetchBibleBooks, fetchBibleChapter } from "../pantallas/compartido.jsx";
import { BIBLE_OFFLINE_VERSION } from "../pantallas/biblia.jsx";
import {
  recolectarMedios, fuentesDeEventos, guardarYVerificar, guardarCanciones, guardarImagenes,
  appGuardada, contarImagenesGuardadas, eventosProximos,
} from "../lib/prepararSinConexion.js";

// "Preparar para usar sin conexión" (pedido de Eldin, 2026-11-14), en Ajustes de la computadora que
// proyecta. Con Wi-Fi: guarda canciones, eventos próximos, imágenes de fondo y la Biblia, y muestra una
// lista con lo que quedó listo y lo que no. La lógica está en lib/prepararSinConexion.js.

const OK = "#1F8A73", AVISO = "#B58500", MAL = "#C23B32";

// Lee lo guardado en este equipo (sin internet) y arma las filas de la lista.
async function revisar() {
  const filas = [];
  const guardadoApp = await appGuardada();
  filas.push({ id: "app", ok: guardadoApp, titulo: "La app", detalle: guardadoApp ? "Guardada: abre aunque no haya señal." : "Todavía no se guardó. Recarga la página una vez con internet y vuelve a revisar." });

  let sesion = false;
  try { sesion = !!(await supabase.auth.getSession())?.data?.session; } catch { /* sin sesión */ }
  filas.push({ id: "sesion", ok: sesion, titulo: "Sesión iniciada", detalle: sesion ? "Mañana no cierres sesión en esta computadora." : "Inicia sesión antes de quedarte sin internet." });

  const eventos = loadCache("eventos");
  const canciones = loadCache("canciones");
  const proximos = eventosProximos(eventos, isUpcoming);
  filas.push({
    id: "eventos", ok: proximos.length > 0, aviso: !eventos,
    titulo: "Eventos",
    detalle: !eventos ? "Todavía no hay eventos guardados." : proximos.length ? `${proximos.length} ${proximos.length === 1 ? "evento próximo guardado" : "eventos próximos guardados"}: ${proximos.slice(0, 3).map((e) => e.title).join(", ")}${proximos.length > 3 ? "…" : ""}` : "No hay eventos próximos que guardar.",
  });
  const usadas = new Set(proximos.flatMap((e) => (e.serviceOrder || []).map((i) => i.songId).filter(Boolean)));
  const faltan = [...usadas].filter((id) => !(canciones || []).some((c) => c.id === id)).length;
  filas.push({
    id: "canciones", ok: !!canciones && faltan === 0, titulo: "Canciones",
    detalle: !canciones ? "Todavía no hay canciones guardadas." : faltan ? `Faltan ${faltan} canciones de los eventos próximos. Toca "Preparar ahora".` : `${canciones.length} canciones guardadas.`,
  });

  const medios = recolectarMedios(...(() => { const f = fuentesDeEventos(proximos, canciones || []); return [f.items, f.canciones, loadCache("estilo_en_vivo")]; })());
  const guardadas = await contarImagenesGuardadas(medios.imagenes);
  filas.push({
    id: "imagenes", ok: guardadas === medios.imagenes.length, titulo: "Imágenes de fondo",
    detalle: medios.imagenes.length ? `${guardadas} de ${medios.imagenes.length} guardadas.` : "Los eventos próximos no usan imágenes.",
  });
  if (medios.externas.length) filas.push({ id: "externas", aviso: true, titulo: "Imágenes de otro sitio web", detalle: `${medios.externas.length} no se pueden guardar y sin internet no se verán. Súbelas a WorshipFlow para que se guarden.` });
  if (medios.videos.length) filas.push({ id: "videos", aviso: true, titulo: "Videos de fondo", detalle: `${medios.videos.length} ${medios.videos.length === 1 ? "video" : "videos"} en los eventos próximos: no se guardan y sin internet no se verán. Cambia esos fondos a color o imagen.` });

  let capitulos = 0, total = 0;
  try { capitulos = await contarCapitulosGuardados(BIBLE_OFFLINE_VERSION); } catch { /* sin IndexedDB */ }
  try { total = (await fetchBibleBooks(BIBLE_OFFLINE_VERSION)).reduce((a, b) => a + b.chapters, 0); } catch { /* sin internet: se usa el total conocido */ }
  const completa = total > 0 ? capitulos >= total : capitulos >= 1189;
  filas.push({ id: "biblia", ok: completa, titulo: "Biblia (Reina-Valera 1960)", detalle: completa ? `Descargada completa (${capitulos} capítulos).` : `${capitulos} de ${total || 1189} capítulos. Toca "Preparar ahora" con buena señal (tarda unos minutos).` });
  return filas;
}

export default function PrepararSinConexion() {
  const [filas, setFilas] = useState(null);
  const [trabajo, setTrabajo] = useState(null); // { texto, hechos, total } mientras prepara
  const cancelRef = useRef({ aborted: false });

  const actualizar = useCallback(() => revisar().then(setFilas).catch(() => setFilas([])), []);
  useEffect(() => { actualizar(); }, [actualizar]);

  const preparar = async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) { showToast("Necesitas internet para preparar. Hazlo con Wi-Fi.", "offline"); return; }
    cancelRef.current = { aborted: false };
    try {
      setTrabajo({ texto: "Guardando canciones y eventos…" });
      const [canciones, eventos, ministerios] = await Promise.all([listCancionesCompletas(), listEventosCompletos(), listMinisteriosCompletos()]);
      const proximos = eventosProximos(eventos, isUpcoming);
      const f = fuentesDeEventos(proximos, canciones);
      const resCanciones = guardarCanciones(canciones, f.canciones);
      const eventosOk = guardarYVerificar("eventos", eventos);
      guardarYVerificar("ministerios", ministerios);
      if (!resCanciones.completo || !eventosOk) {
        showToast(!eventosOk ? "No cupieron los eventos en la memoria de este equipo." : `Solo se guardaron las ${resCanciones.guardadas} canciones de los eventos próximos (el cancionero completo no cupo).`, "offline");
      }

      const medios = recolectarMedios(f.items, f.canciones, loadCache("estilo_en_vivo"));
      if (medios.imagenes.length) {
        setTrabajo({ texto: "Guardando imágenes de fondo…", hechos: 0, total: medios.imagenes.length });
        await guardarImagenes(medios.imagenes, { onProgreso: (hechos, total) => setTrabajo({ texto: "Guardando imágenes de fondo…", hechos, total }) });
      }

      setTrabajo({ texto: "Descargando la Biblia…", hechos: 0, total: 0 });
      await descargarBibliaCompleta(BIBLE_OFFLINE_VERSION, {
        fetchBooks: fetchBibleBooks, fetchChapter: fetchBibleChapter,
        onProgress: (hechos, total) => setTrabajo({ texto: "Descargando la Biblia… (puede tardar unos minutos)", hechos, total }),
        signal: cancelRef.current,
      });
    } catch (e) {
      notifyError("No se pudo terminar de preparar", e);
    } finally {
      setTrabajo(null);
      actualizar();
    }
  };

  const todoListo = filas && filas.length > 0 && filas.every((f) => f.ok || f.aviso);
  const hayAvisos = filas?.some((f) => f.aviso);

  return (
    <div style={{ background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 16, padding: 14, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <WifiOff size={16} color="var(--wf-brand-accent)" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Preparar para usar sin conexión</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>
        Hazlo con Wi-Fi, en la computadora que proyecta. Guarda las canciones, los eventos próximos, las imágenes de fondo y la Biblia para que el culto funcione aunque no haya internet. La proyección al TV por HDMI sigue funcionando; una pantalla en otro dispositivo sí necesita internet.
      </div>

      {filas === null ? (
        <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>Revisando…</div>
      ) : (
        <div style={{ marginBottom: 10 }}>
          {filas.map((f) => {
            const color = f.ok ? OK : f.aviso ? AVISO : MAL;
            const Icono = f.ok ? Check : AlertTriangle;
            return (
              <div key={f.id} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: "1px solid var(--wf-divider)" }}>
                <Icono size={15} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wf-text)" }}>{f.titulo}</div>
                  <div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>{f.detalle}</div>
                </div>
              </div>
            );
          })}
          {todoListo && (
            <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: hayAvisos ? AVISO : OK }}>
              {hayAvisos ? "Casi listo: revisa los avisos en amarillo." : "✓ Todo listo para usar sin conexión."}
            </div>
          )}
        </div>
      )}

      {trabajo ? (
        <>
          <div style={{ height: 8, background: "var(--wf-hover)", borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${trabajo.total ? Math.round((trabajo.hechos / trabajo.total) * 100) : 5}%`, background: "var(--wf-brand-accent)", transition: "width .2s" }} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
            {trabajo.texto}{trabajo.total ? ` ${trabajo.hechos} de ${trabajo.total}` : ""}
          </div>
          <button onClick={() => { cancelRef.current.aborted = true; }} style={{ fontSize: 12, fontWeight: 700, color: MAL, background: "none", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 12px", cursor: "pointer" }}>Cancelar la Biblia</button>
        </>
      ) : (
        <button onClick={preparar} className="hoverable" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", border: "none", borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <CloudDownload size={15} /> Preparar ahora
        </button>
      )}
    </div>
  );
}
