import { useState } from "react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import MarkCircle from "./MarkCircle.jsx";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const labelStyle = { fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4, display: "block" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer" };

// Zonas de ejemplo más comunes para una iglesia de habla hispana — no es una lista exhaustiva (la
// base acepta cualquier nombre IANA válido vía iglesias.zona_horaria), solo las más probables para
// no obligar a escribir un identificador técnico a mano el primer día.
const ZONAS = [
  { value: "Etc/GMT+6", label: "Guatemala / El Salvador / Honduras (UTC-6, sin horario de verano)" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Managua", label: "Nicaragua" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Bogota", label: "Colombia" },
  { value: "America/Lima", label: "Perú" },
];

// Puerta de alta para una iglesia NUEVA (Fase 4 del SaaS) — a propósito separada de Login.jsx y sin
// ningún enlace visible desde ahí: se llega acá solo con la URL exacta (?crear-iglesia), que por ahora
// Eldin comparte a mano con quien esté invitando a probar la app, no un botón público de "Registrarse"
// (decisión explícita, 2026-09-30 — mismo motivo por el que Login.jsx ya no ofrece auto-registro).
export default function CrearIglesia() {
  const [iglesiaNombre, setIglesiaNombre] = useState("");
  const [zonaHoraria, setZonaHoraria] = useState("Etc/GMT+6");
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await callUsersFunction("crear-iglesia", {
        iglesia_nombre: iglesiaNombre.trim(),
        zona_horaria: zonaHoraria,
        admin_nombre: adminNombre.trim(),
        admin_email: adminEmail.trim().toLowerCase(),
        admin_password: adminPassword,
      });
      // Inicia sesión de una con las mismas credenciales recién creadas, para no obligar a volver a
      // escribirlas en la pantalla normal de Login — mismo correo/contraseña que se acaban de mandar.
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: adminEmail.trim().toLowerCase(), password: adminPassword });
      if (loginError) { setListo(true); setLoading(false); return; } // la cuenta sí se creó -- solo falló el auto-login, entra a mano
      setListo(true);
      // AuthGate (montado en el mismo documento) toma la sesión nueva solo con recargar, sin tener
      // que duplicar acá su lógica de enrutamiento interno.
      setTimeout(() => { window.location.href = window.location.origin + window.location.pathname; }, 1200);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (listo) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
        <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>¡Tu iglesia ya está lista!</div>
          <div style={{ fontSize: 13, color: "var(--wf-muted)" }}>Entrando…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: "40px 20px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Poppins:wght@400;500;600;700&display=swap');`}</style>
      <div className="screen-enter" style={{ width: 400, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <MarkCircle size={80} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: "var(--wf-heading)", textAlign: "center" }}>Crear mi iglesia en WorshipFlow</span>
          <span style={{ fontSize: 12, color: "var(--wf-muted)", textAlign: "center" }}>Quedas como administrador — luego invitas a tu equipo desde Ajustes.</span>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>Nombre de la iglesia</span>
            <input required placeholder="Ej. Iglesia Fe y Esperanza" value={iglesiaNombre} onChange={(e) => setIglesiaNombre(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>Zona horaria</span>
            <select value={zonaHoraria} onChange={(e) => setZonaHoraria(e.target.value)} style={inputStyle}>
              {ZONAS.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Tu nombre</span>
            <input required placeholder="Ej. María López" value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>Tu correo</span>
            <input type="email" required placeholder="Correo" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>Contraseña</span>
            <input type="password" required placeholder="Mínimo 6 caracteres" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={inputStyle} />
          </div>
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Creando…" : "Crear mi iglesia"}</button>
        </form>
      </div>
    </div>
  );
}
