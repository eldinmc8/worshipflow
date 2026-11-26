import { useState } from "react";
import SelectorZonaHoraria from "./components/SelectorZonaHoraria.jsx";
import { zonaDelDispositivo } from "./lib/zonasHorarias.js";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import MarkCircle from "./MarkCircle.jsx";
import { validarPassword } from "./lib/passwordSegura.js";
import MedidorPassword from "./MedidorPassword.jsx";
import { useLanzamiento, fechaLanzamientoTexto } from "./lib/lanzamiento.js";
import { GoogleIcon } from "./Login.jsx";
import { guardarPedidoCrear, olvidarPedidoCrear } from "./lib/crearIglesiaGoogle.js";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const labelStyle = { fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4, display: "block" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer" };


// Alta de una iglesia NUEVA (?crear-iglesia). Desde el lanzamiento (2026-11-18) el registro es abierto: la página
// web y el inicio de sesión traen el botón "Crear mi iglesia". El código de invitación es opcional (Fundadoras y
// enlaces de la consola, ?crear-iglesia&codigo=...).
// Cuenta regresiva (2026-11-19): hasta el lanzamiento oficial (supabase/functions/_shared/lanzamiento.js) solo se
// crea iglesia CON código. Sin código se ve la cuenta regresiva; la función crear-iglesia lo vuelve a revisar.
export default function CrearIglesia() {
  // El enlace que copia Eldin desde la consola ya trae el código (?crear-iglesia&codigo=...).
  const [codigoInvitacion, setCodigoInvitacion] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("codigo") || ""; } catch { return ""; }
  });
  const [iglesiaNombre, setIglesiaNombre] = useState("");
  // Arranca con la zona de este dispositivo (quien crea la iglesia suele estar en ella).
  const [zonaHoraria, setZonaHoraria] = useState(() => zonaDelDispositivo() || "Etc/GMT+6");
  const [adminNombre, setAdminNombre] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const { lanzado, dias, horas, minutos, segundos } = useLanzamiento();
  const [tengoCodigo, setTengoCodigo] = useState(() => !!codigoInvitacion);

  const submit = async (e) => {
    e.preventDefault();
    const errPassword = validarPassword(adminPassword);
    if (errPassword) { setError(errPassword); return; }
    setLoading(true); setError("");
    try {
      await callUsersFunction("crear-iglesia", {
        codigo_invitacion: codigoInvitacion.trim(),
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

  // "Crear con Google" (2026-11-26): Google regresa a la dirección principal; AuthGate ve que no tiene iglesia y abre
  // el formulario corto (SinIglesia.jsx) con el código que haya escrito aquí. Ver lib/crearIglesiaGoogle.js.
  const crearConGoogle = async () => {
    if (!lanzado && !codigoInvitacion.trim()) { setError("Hasta el lanzamiento necesitas un código de invitación."); return; }
    setError("");
    guardarPedidoCrear(codigoInvitacion);
    const { error: errGoogle } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (errGoogle) { olvidarPedidoCrear(); setError(errGoogle.message); }
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

  if (!lanzado && !tengoCodigo) {
    const dos = (n) => String(n).padStart(2, "0");
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "var(--wf-font-ui)", padding: "40px 20px" }}>
        <div className="screen-enter" style={{ width: 400, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <MarkCircle size={72} />
          <span style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 18, fontWeight: 600, color: "var(--wf-heading)" }}>Muy pronto podrás crear tu iglesia</span>
          <div role="timer" style={{ display: "flex", gap: 6 }}>
            {[[dias, "días"], [dos(horas), "horas"], [dos(minutos), "min"], [dos(segundos), "seg"]].map(([n, t]) => (
              <div key={t} style={{ background: "#16324F", color: "#fff", borderRadius: 10, minWidth: 58, padding: "8px 6px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                <span style={{ fontSize: 11, opacity: 0.75 }}>{t}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: "var(--wf-muted)" }}>El lanzamiento oficial es el {fechaLanzamientoTexto()} (hora de Guatemala).</span>
          <a href="https://worshipflowapp.com/web/precios" style={{ ...primaryBtn, display: "block", textDecoration: "none", boxSizing: "border-box" }}>Ver planes y precios</a>
          <button type="button" onClick={() => setTengoCodigo(true)} style={{ background: "none", border: "none", color: "var(--wf-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Tengo un código de invitación</button>
          <a href={window.location.origin + "/"} style={{ fontSize: 13, color: "var(--wf-muted)" }}>Ya tengo cuenta: iniciar sesión</a>
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
          <span style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 17, fontWeight: 600, color: "var(--wf-heading)", textAlign: "center" }}>Crear mi iglesia en WorshipFlow</span>
          <span style={{ fontSize: 12, color: "var(--wf-muted)", textAlign: "center" }}>Quedas como administrador — luego invitas a tu equipo desde Ajustes.</span>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={labelStyle}>{lanzado ? "Código de invitación (opcional)" : "Código de invitación"}</span>
            <input required={!lanzado} placeholder={lanzado ? "Solo si te dimos uno" : "El que te dimos"} value={codigoInvitacion} onChange={(e) => setCodigoInvitacion(e.target.value)} style={inputStyle} />
          </div>
          <button type="button" onClick={crearConGoogle} disabled={loading} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" }}>
            <GoogleIcon /> Crear con Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
            <span style={{ fontSize: 11, color: "var(--wf-faint)", fontWeight: 600 }}>O CON CORREO Y CONTRASEÑA</span>
            <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
          </div>
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
          <div>
            <span style={labelStyle}>Tu correo</span>
            <input type="email" required placeholder="Correo" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={labelStyle}>Contraseña</span>
            <input type="password" required placeholder="Mínimo 8 caracteres, con letras y números" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={inputStyle} autoComplete="new-password" />
            <div style={{ marginTop: 8 }}><MedidorPassword password={adminPassword} /></div>
          </div>
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <div style={{ fontSize: 12, color: "var(--wf-muted)", textAlign: "center" }}>Empiezas en el plan Gratis y puedes probar 30 días el plan Iglesia completo.</div>
          <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Creando…" : "Crear mi iglesia"}</button>
          <a href={window.location.origin + "/"} style={{ fontSize: 13, color: "var(--wf-muted)", textAlign: "center" }}>Ya tengo cuenta: iniciar sesión</a>
        </form>
      </div>
    </div>
  );
}
