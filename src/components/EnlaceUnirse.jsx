import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { showToast } from "../lib/toast.js";
import { confirmDialog } from "../lib/confirm.js";
import {
  codigoDeMiIglesia, cambiarCodigoDeMiIglesia, enlaceParaUnirse, mensajeWhatsApp,
  solicitudesPendientes, aprobarSolicitud, rechazarSolicitud,
} from "../lib/unirse.js";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 8px", fontSize: 12, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const primaryBtn = { background: "var(--wf-brand-accent)", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: "var(--wf-brand-primary)", cursor: "pointer" };
const ghostBtn = { background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };
const card = { background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 1px 3px rgba(22,50,79,0.08)", padding: 16, marginBottom: 20 };

// En Miembros (2026-11-20): el enlace para unirse a la iglesia y las solicitudes que esperan aprobación.
// opcionesRol: las <option> del selector de rol de Miembros; valorARol: convierte el valor elegido en
// { rol, rol_id } (mismo selector que al invitar por correo).
export default function EnlaceUnirse({ iglesiaId, opcionesRol, valorARol, onAprobado }) {
  const [codigo, setCodigo] = useState(null);
  const [nombreIglesia, setNombreIglesia] = useState("");
  const [pendientes, setPendientes] = useState(null);
  const [rolElegido, setRolElegido] = useState({}); // solicitud id → valor del selector
  const [ocupado, setOcupado] = useState(null); // id de la solicitud en proceso, o "codigo"
  const [error, setError] = useState("");

  const cargarPendientes = useCallback(async () => {
    try { setPendientes(await solicitudesPendientes()); } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    codigoDeMiIglesia().then(setCodigo).catch((e) => setError(e.message));
    if (iglesiaId) supabase.from("iglesias").select("nombre").eq("id", iglesiaId).maybeSingle().then(({ data }) => setNombreIglesia(data?.nombre || ""));
    cargarPendientes();
  }, [iglesiaId, cargarPendientes]);

  const enlace = codigo ? enlaceParaUnirse(codigo) : "";

  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); showToast("Enlace copiado.", "info"); }
    catch { window.prompt("Copia este enlace:", enlace); }
  };

  const cambiar = async () => {
    const ok = await confirmDialog("El enlace actual dejará de funcionar y tendrás que compartir el nuevo. Las solicitudes que ya llegaron no se pierden. ¿Cambiarlo?", { textoConfirmar: "Cambiar enlace" });
    if (!ok) return;
    setOcupado("codigo"); setError("");
    try { setCodigo(await cambiarCodigoDeMiIglesia()); showToast("Listo: el enlace anterior ya no funciona.", "info"); }
    catch (e) { setError(e.message); }
    finally { setOcupado(null); }
  };

  const aprobar = async (s) => {
    const { rol, rol_id } = valorARol(rolElegido[s.id] || "legacy:miembro");
    setOcupado(s.id); setError("");
    try {
      await aprobarSolicitud(s.id, rol, rol_id || null);
      showToast(`${s.nombre} ya es parte de la iglesia.`, "info");
      await cargarPendientes();
      onAprobado?.();
    } catch (e) { setError(e.message); }
    finally { setOcupado(null); }
  };

  const rechazar = async (s) => {
    const ok = await confirmDialog(`¿Rechazar la solicitud de ${s.nombre} (${s.email})? No podrá entrar con este enlace.`, { danger: true, textoConfirmar: "Rechazar" });
    if (!ok) return;
    setOcupado(s.id); setError("");
    try { await rechazarSolicitud(s.id); await cargarPendientes(); }
    catch (e) { setError(e.message); }
    finally { setOcupado(null); }
  };

  return (
    <>
      {pendientes?.length > 0 && (
        <div style={{ ...card, border: "1px solid var(--wf-brand-accent)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wf-text)", marginBottom: 2 }}>Pendientes ({pendientes.length})</div>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>Pidieron unirse con el enlace. Elige su rol y apruébalos, o recházalos.</div>
          {pendientes.map((s) => (
            <div key={s.id} style={{ padding: "10px 0", borderTop: "1px solid var(--wf-hover)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{s.nombre}</div>
              <div style={{ fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <select aria-label={`Rol para ${s.nombre}`} value={rolElegido[s.id] || "legacy:miembro"} onChange={(e) => setRolElegido({ ...rolElegido, [s.id]: e.target.value })} style={{ ...inputStyle, flex: "1 1 140px", minWidth: 0 }}>
                  {opcionesRol}
                </select>
                <button onClick={() => aprobar(s)} disabled={!!ocupado} style={{ ...primaryBtn, opacity: ocupado ? 0.6 : 1 }}>{ocupado === s.id ? "…" : "Aprobar"}</button>
                <button onClick={() => rechazar(s)} disabled={!!ocupado} style={{ ...ghostBtn, color: "#C23B32", opacity: ocupado ? 0.6 : 1 }}>Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wf-text)", marginBottom: 2 }}>Enlace para unirse</div>
        <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>Compártelo en el grupo de la iglesia. Cada persona crea su cuenta y te llega aquí para que la apruebes.</div>
        {error && <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 8 }}>{error}</div>}
        <div style={{ fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", background: "var(--wf-bg)", borderRadius: 10, padding: "8px 10px", marginBottom: 10, wordBreak: "break-all", color: "var(--wf-text)" }}>
          {enlace || "Cargando…"}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={copiar} disabled={!codigo} style={primaryBtn}>Copiar</button>
          <a href={codigo ? mensajeWhatsApp(nombreIglesia, enlace) : undefined} target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Compartir por WhatsApp</a>
          <button onClick={cambiar} disabled={!codigo || ocupado === "codigo"} style={ghostBtn}>{ocupado === "codigo" ? "Cambiando…" : "Cambiar enlace"}</button>
        </div>
      </div>
    </>
  );
}
