import { useEffect, useState } from "react";
import { Speaker, Check, Volume2, RefreshCw, Info } from "lucide-react";
import { ModalShell } from "../pantallas/compartido.jsx";
import { soportaSalidaAudio, leerSalidaAudio, guardarSalidaAudio, listarSalidasAudio, resolverSalida, probarSalidaAudio, escucharSalidaAudio } from "../lib/salidaAudio.js";
import { showToast } from "../lib/toast.js";

// Ajustes → "Salida de audio de los videos" (2026-11-08). Elige por qué salida de ESTA computadora suena
// el video proyectado: la imagen sigue yendo al proyector/TV y el sonido a la consola o mixer. Ver
// lib/salidaAudio.js.

// Texto corto para la fila de Ajustes y la consola: por dónde sale hoy.
export function useSalidaAudioActual() {
  const [salida, setSalida] = useState(leerSalidaAudio);
  useEffect(() => escucharSalidaAudio(setSalida), []);
  return salida;
}

export function SalidaAudioModal({ onClose }) {
  const soportado = soportaSalidaAudio();
  const [elegida, setElegida] = useState(leerSalidaAudio);
  const [lista, setLista] = useState(null); // null = todavía no se pidió la lista
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargar = async (pedirPermiso) => {
    setCargando(true); setError("");
    try {
      setLista(await listarSalidasAudio({ pedirPermiso }));
    } catch (e) {
      setError(e?.name === "NotAllowedError"
        ? "El navegador no dio permiso. Toca el candado junto a la dirección → Micrófono → Permitir, y vuelve a intentar. (Solo se usa para ver los nombres de las salidas; no se graba nada.)"
        : "No se pudo leer la lista de salidas de audio de esta computadora.");
    } finally {
      setCargando(false);
    }
  };
  // Si el permiso ya está dado, la lista aparece sola al abrir.
  useEffect(() => { if (soportado) listarSalidasAudio().then((l) => { if (l.some((d) => !/^Salida de audio \d+$/.test(d.label))) setLista(l); }).catch(() => {}); }, [soportado]);

  const elegir = (d) => {
    const nueva = d ? { deviceId: d.deviceId, label: d.label } : null;
    setElegida(nueva);
    guardarSalidaAudio(nueva);
    showToast(d ? `El audio de los videos saldrá por: ${d.label}` : "El audio de los videos saldrá por la salida predeterminada.", "info");
  };
  const probar = async (d) => {
    try { await probarSalidaAudio(d?.deviceId || ""); } catch { showToast("No se pudo reproducir el sonido de prueba por esa salida.", "error"); }
  };

  const actual = lista ? resolverSalida(elegida, lista.map((d) => ({ ...d, kind: "audiooutput" }))) : null;
  const guardadaDesconectada = !!(lista && elegida && !actual);
  const opcion = (d, activa) => (
    <div key={d ? d.deviceId : "predeterminada"} style={{ display: "flex", alignItems: "center", gap: 8, background: activa ? "rgba(232,130,30,0.12)" : "var(--wf-hover)", borderRadius: 12, padding: "10px 10px", marginBottom: 6 }}>
      <button onClick={() => elegir(d)} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "var(--wf-text)" }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: activa ? "#E8821E" : "transparent", boxShadow: activa ? "none" : "inset 0 0 0 2px var(--wf-border)" }}>
          {activa && <Check size={12} color="#fff" />}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{d ? d.label : "Predeterminada del sistema"}</span>
      </button>
      <button onClick={() => probar(d)} title="Probar sonido" aria-label={`Probar sonido por ${d ? d.label : "la salida predeterminada"}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--wf-card)", border: "none", boxShadow: "0 2px 8px rgba(22,50,79,0.10)", borderRadius: 10, padding: "6px 9px", fontSize: 11, fontWeight: 700, color: "var(--wf-text-2)", cursor: "pointer", flexShrink: 0 }}>
        <Volume2 size={13} /> Probar
      </button>
    </div>
  );

  return (
    <ModalShell title="Salida de audio de los videos" icon={Speaker} color="#B15EA0" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.45, marginBottom: 12 }}>
        La imagen del video va al proyector o TV; aquí eliges <b>por dónde sale el sonido</b> en esta computadora — por ejemplo la salida de audífonos o la interfaz USB conectada a la consola o mixer, para que suene en las bocinas de la iglesia.
      </div>

      {!soportado ? (
        <div style={{ fontSize: 12, color: "#C23B32", fontWeight: 600, lineHeight: 1.4 }}>
          Este navegador no permite elegir la salida de audio. Usa Google Chrome o Microsoft Edge en la computadora que proyecta.
        </div>
      ) : (
        <>
          {opcion(null, !elegida)}
          {lista && lista.map((d) => opcion(d, !!actual && actual.deviceId === d.deviceId))}
          {guardadaDesconectada && (
            <div style={{ fontSize: 11.5, color: "#C23B32", fontWeight: 600, margin: "2px 2px 8px" }}>
              «{elegida.label}» no está conectada ahora. Mientras tanto el audio sale por la predeterminada; al conectarla vuelve a usarse sola.
            </div>
          )}
          {!lista && (
            <button onClick={() => cargar(true)} disabled={cargando} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#E8821E", color: "#fff", border: "none", borderRadius: 12, padding: "11px 12px", fontSize: 13, fontWeight: 700, cursor: cargando ? "default" : "pointer", marginTop: 4 }}>
              <Speaker size={15} /> {cargando ? "Buscando…" : "Ver las salidas de audio de esta computadora"}
            </button>
          )}
          {!lista && !error && (
            <div style={{ fontSize: 11, color: "var(--wf-faint)", margin: "6px 2px 0", lineHeight: 1.4 }}>
              El navegador pedirá permiso de micrófono: es solo para mostrar los nombres de las salidas. No se graba nada.
            </div>
          )}
          {lista && (
            <button onClick={() => cargar(true)} disabled={cargando} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: "var(--wf-text-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 2px" }}>
              <RefreshCw size={12} /> {cargando ? "Buscando…" : "Actualizar lista (si acabas de conectar algo)"}
            </button>
          )}
          {error && <div style={{ fontSize: 11.5, color: "#C23B32", fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>{error}</div>}
        </>
      )}

      <div style={{ display: "flex", gap: 8, background: "var(--wf-hover)", borderRadius: 12, padding: 10, marginTop: 14, fontSize: 11.5, color: "var(--wf-text-2)", lineHeight: 1.45 }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          Aplica a los videos <b>subidos a la app, .mp4 y Google Drive</b> que se proyectan en esta computadora (también en el segundo monitor).
          <br /><br />
          <b>YouTube y Vimeo</b>: el navegador no deja elegirles la salida desde la app. En Windows ve a <b>Configuración → Sistema → Sonido → Mezclador de volumen</b> y en Chrome (o Edge) elige la misma salida de la consola. Para que todo salga por el mixer sin tocar Windows, mejor sube el video a la app.
        </div>
      </div>
    </ModalShell>
  );
}
