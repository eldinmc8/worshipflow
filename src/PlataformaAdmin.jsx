import { useEffect, useState } from "react";
import { ArrowLeft, Shield, Copy, RefreshCw, KeyRound, Power, Radio } from "lucide-react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { showToast } from "./lib/toast.js";
import { confirmDialog, promptDialog } from "./lib/confirm.js";

const cardStyle = { background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: "14px 16px", marginBottom: 10 };
const ghostBtn = { background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const dangerBtn = { ...ghostBtn, color: "#C23B32" };
const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace" };

// Código de invitación nuevo — mismo formato que el que genera la propia migración al crearse
// (12 caracteres hexadecimales), para que no se note cuál vino de dónde.
function generarCodigo() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Consola general de WorshipFlow — panorama de TODAS las iglesias + 4 acciones de soporte puntuales.
// Alcance acotado a propósito (decisión de Eldin, 2026-09-30): nada de ver canciones/eventos/
// mensajes de ninguna iglesia, solo lo operativo para poder ayudar cuando alguien se queda trabado
// (el mismo tipo de ayuda que OnStage le dio a Eldin una vez reactivando su cuenta). Solo entra quien
// soy_super_admin() confirma como tal — ver AuthGate.jsx, que ni siquiera deja llegar hasta acá si no.
export default function PlataformaAdmin({ onExit }) {
  const [cargando, setCargando] = useState(true);
  const [iglesias, setIglesias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [codigo, setCodigo] = useState("");
  const [busyId, setBusyId] = useState(null); // id de la iglesia con una acción en curso, para desactivar sus botones nada más

  const cargar = () => {
    setCargando(true);
    Promise.all([
      supabase.from("iglesias").select("id, nombre, slug, activa, created_at").order("created_at"),
      supabase.from("usuarios").select("id, nombre, email, rol, iglesia_id"),
      supabase.from("plataforma_config").select("codigo_invitacion").eq("id", "default").maybeSingle(),
    ]).then(([igl, usr, conf]) => {
      setIglesias(igl.data || []);
      setUsuarios(usr.data || []);
      setCodigo(conf.data?.codigo_invitacion || "");
      setCargando(false);
    });
  };
  useEffect(cargar, []);

  const toggleActiva = async (igl) => {
    const verbo = igl.activa ? "desactivar" : "reactivar";
    if (!(await confirmDialog(`¿${verbo.charAt(0).toUpperCase() + verbo.slice(1)} "${igl.nombre}"? ${igl.activa ? "No se borra ningún dato, solo queda pausada." : ""}`, { textoConfirmar: verbo.charAt(0).toUpperCase() + verbo.slice(1) }))) return;
    setBusyId(igl.id);
    const { error } = await supabase.from("iglesias").update({ activa: !igl.activa }).eq("id", igl.id);
    setBusyId(null);
    if (error) { showToast("No se pudo cambiar: " + error.message, "error"); return; }
    showToast(`"${igl.nombre}" ${igl.activa ? "desactivada" : "reactivada"}.`, "info");
    cargar();
  };

  const forzarCierreSesion = async (igl) => {
    if (!(await confirmDialog(`¿Forzar el cierre de la sesión en vivo de "${igl.nombre}"? Úsalo solo si su propio administrador no pudo arreglarlo desde adentro.`, { textoConfirmar: "Forzar cierre" }))) return;
    setBusyId(igl.id);
    const { error } = await supabase.from("sesiones_en_vivo").update({
      evento_id: null, liderado_por: null, slide_actual: null, blanked: false, estilo_en_vivo: null, ad_hoc_label: null, libre: false,
    }).eq("iglesia_id", igl.id);
    setBusyId(null);
    if (error) { showToast("No se pudo cerrar la sesión: " + error.message, "error"); return; }
    showToast("Sesión en vivo cerrada.", "info");
  };

  const resetearPassword = async (usuario) => {
    const password = await promptDialog(`Nueva contraseña para ${usuario.nombre} (mínimo 6 caracteres):`, { esPassword: true, textoConfirmar: "Guardar" });
    if (!password) return;
    setBusyId(usuario.iglesia_id);
    try {
      await callUsersFunction("reiniciar-password", { id: usuario.id, password });
      showToast(`Contraseña de ${usuario.nombre} actualizada.`, "info");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const regenerarCodigo = async () => {
    if (!(await confirmDialog("¿Generar un código nuevo? El anterior deja de funcionar de inmediato — nadie más podrá crear una iglesia con él.", { textoConfirmar: "Generar nuevo" }))) return;
    const nuevo = generarCodigo();
    const { error } = await supabase.from("plataforma_config").update({ codigo_invitacion: nuevo }).eq("id", "default");
    if (error) { showToast("No se pudo cambiar el código: " + error.message, "error"); return; }
    setCodigo(nuevo);
    showToast("Código regenerado.", "info");
  };

  const copiarCodigo = () => {
    navigator.clipboard?.writeText(codigo).then(() => showToast("Código copiado.", "info")).catch(() => {});
  };

  return (
    <div style={{ padding: 20, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onExit} style={{ ...ghostBtn, padding: 8 }}><ArrowLeft size={16} /></button>
        <Shield size={18} color="var(--wf-brand-accent)" />
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600 }}>Consola general</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 18 }}>
        Panorama de todas las iglesias y acciones de soporte puntuales — no muestra canciones, eventos ni mensajes de ninguna.
      </div>

      {cargando ? (
        <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div>
      ) : (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 8, textTransform: "uppercase" }}>Código de invitación (?crear-iglesia)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input readOnly value={codigo} style={inputStyle} />
              <button onClick={copiarCodigo} style={ghostBtn}><Copy size={14} /></button>
              <button onClick={regenerarCodigo} style={ghostBtn}><RefreshCw size={14} /> Regenerar</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Sin este código, nadie puede crear una iglesia nueva, aunque tenga el enlace.</div>
          </div>

          {iglesias.map((igl) => {
            const equipo = usuarios.filter((u) => u.iglesia_id === igl.id);
            const admins = equipo.filter((u) => u.rol === "admin");
            const busy = busyId === igl.id;
            return (
              <div key={igl.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{igl.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--wf-faint)" }}>
                      {equipo.length} {equipo.length === 1 ? "usuario" : "usuarios"} · creada el {new Date(igl.created_at).toLocaleDateString("es-GT")}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0, background: igl.activa ? "#EAF6F1" : "#FDECEA", color: igl.activa ? "#1F8A73" : "#C23B32" }}>
                    {igl.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>

                {admins.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                    {admins.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "var(--wf-muted)" }}>{a.nombre} · {a.email}</span>
                        <button disabled={busy} onClick={() => resetearPassword(a)} style={{ ...ghostBtn, padding: "4px 8px", opacity: busy ? 0.5 : 1 }}><KeyRound size={12} /> Restablecer</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button disabled={busy} onClick={() => forzarCierreSesion(igl)} style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }}><Radio size={13} /> Forzar cierre de sesión en vivo</button>
                  <button disabled={busy} onClick={() => toggleActiva(igl)} style={{ ...(igl.activa ? dangerBtn : ghostBtn), opacity: busy ? 0.5 : 1 }}><Power size={13} /> {igl.activa ? "Desactivar" : "Reactivar"}</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
