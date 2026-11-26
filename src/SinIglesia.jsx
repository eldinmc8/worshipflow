import { useState } from "react";
import SelectorZonaHoraria from "./components/SelectorZonaHoraria.jsx";
import { zonaDelDispositivo } from "./lib/zonasHorarias.js";
import { callUsersFunction } from "./lib/supabaseClient.js";
import MarkCircle from "./MarkCircle.jsx";
import { useLanzamiento, fechaLanzamientoTexto } from "./lib/lanzamiento.js";
import { nombreSugerido, olvidarPedidoCrear } from "./lib/crearIglesiaGoogle.js";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const labelStyle = { fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4, display: "block" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer", fontFamily: "inherit" };
const segundoBtn = { ...primaryBtn, background: "var(--wf-card)", border: "1px solid var(--wf-border)", color: "var(--wf-text)", fontWeight: 600 };
const enlaceBtn = { background: "none", border: "none", color: "var(--wf-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 4, alignSelf: "center" };
const tarjeta = { width: 400, maxWidth: "100%", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 24, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 };

// Entró con Google (u otra cuenta) y su correo no está en ninguna iglesia (2026-11-26). Antes se le decía "Todavía
// no tienes acceso" y se borraba la cuenta; ahora elige: crear su iglesia (queda de administrador, en Gratis) o, si
// lo invitaron, se le explica cómo pedir el acceso. Ver lib/crearIglesiaGoogle.js y la función crear-iglesia.
export default function SinIglesia({ session, codigoInicial = "", abrirCrear = false, onCreada, onSalir }) {
  const email = session?.user?.email || "";
  const [modo, setModo] = useState(abrirCrear ? "crear" : "elegir"); // elegir | crear | invitado
  const [iglesiaNombre, setIglesiaNombre] = useState("");
  const [zonaHoraria, setZonaHoraria] = useState(() => zonaDelDispositivo() || "Etc/GMT+6");
  const [adminNombre, setAdminNombre] = useState(() => nombreSugerido(session?.user));
  const [codigo, setCodigo] = useState(codigoInicial);
  const [verCodigo, setVerCodigo] = useState(!!codigoInicial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const { lanzado } = useLanzamiento();
  const pideCodigo = !lanzado; // antes del lanzamiento solo se crea con código de invitación

  const crear = async (e) => {
    e.preventDefault();
    if (!iglesiaNombre.trim()) { setError("Escribe el nombre de la iglesia."); return; }
    if (!adminNombre.trim()) { setError("Escribe tu nombre."); return; }
    if (pideCodigo && !codigo.trim()) { setError("Hasta el lanzamiento necesitas un código de invitación."); return; }
    setCargando(true); setError("");
    try {
      await callUsersFunction("crear-iglesia", {
        con_sesion: true,
        codigo_invitacion: codigo.trim(),
        iglesia_nombre: iglesiaNombre.trim(),
        zona_horaria: zonaHoraria,
        admin_nombre: adminNombre.trim(),
      });
      olvidarPedidoCrear();
      onCreada();
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  };

  const salir = () => { olvidarPedidoCrear(); onSalir(); };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "var(--wf-font-ui)", padding: "32px 16px", boxSizing: "border-box" }}>
      <div className="screen-enter" style={tarjeta}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
          <MarkCircle size={64} />
          <span style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 17, fontWeight: 600, color: "var(--wf-heading)" }}>
            {modo === "crear" ? "Crear mi iglesia" : modo === "invitado" ? "Pide tu acceso" : "Bienvenido a WorshipFlow"}
          </span>
          {email && <span style={{ fontSize: 12.5, color: "var(--wf-muted)", wordBreak: "break-all" }}>{email}</span>}
        </div>

        {modo === "elegir" && (
          <>
            <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, textAlign: "center" }}>
              Este correo todavía no está en ninguna iglesia. ¿Qué quieres hacer?
            </div>
            <button type="button" onClick={() => setModo("crear")} style={primaryBtn}>Crear mi iglesia</button>
            <button type="button" onClick={() => setModo("invitado")} style={segundoBtn}>Quiero entrar a la iglesia donde sirvo</button>
            <button type="button" onClick={salir} style={enlaceBtn}>Usar otra cuenta</button>
          </>
        )}

        {modo === "invitado" && (
          <>
            <div style={{ fontSize: 13, color: "var(--wf-text)", lineHeight: 1.55 }}>
              Pídele al administrador de tu iglesia una de estas dos cosas:
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--wf-muted)" }}>
                <li style={{ marginBottom: 6 }}>Que te invite desde <b>Ajustes → Miembros</b> con este mismo correo.</li>
                <li>O que te mande el <b>enlace para unirte</b> a la iglesia y lo abras aquí.</li>
              </ul>
            </div>
            <button type="button" onClick={salir} style={primaryBtn}>Entendido, salir</button>
            <button type="button" onClick={() => setModo("elegir")} style={enlaceBtn}>Volver</button>
          </>
        )}

        {modo === "crear" && (
          <form onSubmit={crear} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 12.5, color: "var(--wf-muted)", textAlign: "center", lineHeight: 1.5 }}>
              Quedas como administrador. Después invitas a tu equipo desde Ajustes.
            </span>
            {pideCodigo && (
              <div style={{ fontSize: 12.5, color: "var(--wf-text)", background: "var(--wf-bg)", borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
                El registro abre el {fechaLanzamientoTexto()} (hora de Guatemala). Hasta entonces solo se puede con un código de invitación.
              </div>
            )}
            <div>
              <span style={labelStyle}>Nombre de la iglesia</span>
              <input required placeholder="Ej. Iglesia Fe y Esperanza" value={iglesiaNombre} onChange={(e) => setIglesiaNombre(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <span style={labelStyle}>Zona horaria</span>
              <SelectorZonaHoraria value={zonaHoraria} onChange={setZonaHoraria} estiloCampo={inputStyle} />
            </div>
            <div>
              <span style={labelStyle}>Tu nombre</span>
              <input required placeholder="Ej. María López" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} style={inputStyle} />
            </div>
            {pideCodigo || verCodigo ? (
              <div>
                <span style={labelStyle}>{pideCodigo ? "Código de invitación" : "Código de invitación (opcional)"}</span>
                <input required={pideCodigo} placeholder={pideCodigo ? "El que te dimos" : "Solo si te dimos uno"} value={codigo} onChange={(e) => setCodigo(e.target.value)} style={inputStyle} />
              </div>
            ) : (
              <button type="button" onClick={() => setVerCodigo(true)} style={enlaceBtn}>Tengo un código de invitación</button>
            )}
            {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
            {!pideCodigo && <div style={{ fontSize: 12, color: "var(--wf-muted)", textAlign: "center" }}>Empiezas en el plan Gratis y puedes probar 30 días el plan Iglesia completo.</div>}
            <button type="submit" disabled={cargando} style={{ ...primaryBtn, opacity: cargando ? 0.6 : 1 }}>{cargando ? "Creando…" : "Crear mi iglesia"}</button>
            <button type="button" onClick={() => (abrirCrear ? salir() : setModo("elegir"))} style={enlaceBtn}>{abrirCrear ? "Cancelar" : "Volver"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
