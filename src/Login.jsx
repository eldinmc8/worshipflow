import { useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import GenericMark from "./GenericMark.jsx";
import { useLanzamiento } from "./lib/lanzamiento.js";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer" };

// Los miembros entran con credenciales ya creadas desde Ajustes/Usuarios. Desde el lanzamiento (2026-11-18) hay un
// enlace "Crear mi iglesia gratis" (?crear-iglesia) para iglesias nuevas: el registro de iglesias es abierto.
export default function Login({ aviso = "" }) {
  const { lanzado } = useLanzamiento();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recuperando, setRecuperando] = useState(false);

  const submitLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) setError("Correo o contraseña incorrectos.");
  };

  // Con Google nadie ve una iglesia sin tener su fila en "usuarios": si el correo de Google no tiene fila,
  // AuthGate.jsx le ofrece crear su iglesia o pedir que lo inviten (SinIglesia.jsx, 2026-11-26),
  // con un aviso explicando que hace falta una invitación. Esto solo sirve como atajo de acceso para
  // alguien que YA fue invitado y cuyo correo de Google coincide con el que se le invitó.
  const loginWithGoogle = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setError(error.message); setLoading(false); }
  };

  if (recuperando) return <TarjetaAcceso><RecuperarPassword correoInicial={email} onVolver={() => setRecuperando(false)} /></TarjetaAcceso>;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Poppins:wght@400;500;600;700&display=swap');`}</style>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <GenericMark size={64} />
        </div>
        {aviso && <div style={{ background: "#FDF0E3", color: "#16324F", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{aviso}</div>}

        <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="email" required placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Entrando…" : "Iniciar sesión"}</button>
          <button type="button" onClick={() => setRecuperando(true)} style={enlaceBtn}>¿Olvidaste tu contraseña?</button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
          <span style={{ fontSize: 11, color: "var(--wf-faint)", fontWeight: 600 }}>O</span>
          <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
        </div>
        <button
          type="button" onClick={loginWithGoogle} disabled={loading}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", opacity: loading ? 0.6 : 1 }}
        >
          <GoogleIcon /> Continuar con Google
        </button>
        {/* Hasta el lanzamiento oficial (lib/lanzamiento.js) no se ofrece crear iglesia aquí. */}
        {lanzado && (
          <div style={{ fontSize: 13, color: "var(--wf-muted)", textAlign: "center", marginTop: 16 }}>
            ¿Tu iglesia aún no usa WorshipFlow?{" "}
            <a href="/?crear-iglesia" style={{ color: "#E8821E", fontWeight: 700, textDecoration: "none" }}>Crear mi iglesia gratis</a>
          </div>
        )}
        {!lanzado && <div style={{ fontSize: 11, color: "var(--wf-faint)", textAlign: "center", marginTop: 10 }}>Solo funciona si un administrador ya te invitó con este mismo correo.</div>}
      </div>
    </div>
  );
}

const enlaceBtn = { background: "none", border: "none", color: "var(--wf-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 4, alignSelf: "center" };

// Misma tarjeta centrada que el inicio de sesión, para pantallas sueltas de acceso.
export function TarjetaAcceso({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "var(--wf-font-ui)", padding: "20px 0" }}>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        {children}
      </div>
    </div>
  );
}

// "¿Olvidaste tu contraseña?" (2026-11-20): Supabase manda un correo con un enlace; al abrirlo la
// persona vuelve a la app con sesión y AuthGate le pide la contraseña nueva (SetPassword, modo
// recuperar). El mensaje de "listo" es el mismo exista o no la cuenta, para no revelar qué correos
// están registrados.
export function RecuperarPassword({ correoInicial = "", onVolver }) {
  const [correo, setCorreo] = useState(correoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), { redirectTo: `${window.location.origin}/` });
    setEnviando(false);
    // Demasiados intentos seguidos: eso sí se avisa. Cualquier otro caso se trata como enviado.
    if (error && /rate|too many|seconds/i.test(error.message || "")) { setError("Ya pediste un enlace hace poco. Espera un minuto e intenta de nuevo."); return; }
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>Revisa tu correo</div>
        <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 18 }}>
          Si <b>{correo.trim()}</b> tiene cuenta en WorshipFlow, te llegó un mensaje con un botón para elegir una contraseña nueva. Si no lo ves, busca en la carpeta de spam.
        </div>
        <button type="button" onClick={onVolver} style={primaryBtn}>Volver a iniciar sesión</button>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)" }}>¿Olvidaste tu contraseña?</div>
      <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 4 }}>Escribe tu correo y te mandamos un enlace para elegir una nueva.</div>
      <input type="email" required placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} style={inputStyle} autoFocus />
      {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
      <button type="submit" disabled={enviando} style={{ ...primaryBtn, opacity: enviando ? 0.6 : 1, marginTop: 4 }}>{enviando ? "Enviando…" : "Enviarme el enlace"}</button>
      <button type="button" onClick={onVolver} style={enlaceBtn}>Volver</button>
      <div style={{ fontSize: 11, color: "var(--wf-faint)", textAlign: "center" }}>¿Entras con Google? No necesitas contraseña: usa "Continuar con Google".</div>
    </form>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.3C29.3 35.4 26.8 36 24 36c-5.3 0-9.6-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.3C40.5 36.4 44 30.9 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
