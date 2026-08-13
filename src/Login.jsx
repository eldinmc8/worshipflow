import { useState } from "react";
import { supabase } from "./lib/supabaseClient.js";

const inputStyle = { width: "100%", background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#16233A", outline: "none", boxSizing: "border-box" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer" };

// Ya no ofrece "crear cuenta de administrador" aquí — esa puerta de auto-registro solo tenía sentido
// antes de que existiera el primer admin de la iglesia; ahora todos entran con credenciales ya creadas
// desde Ajustes/Usuarios, para no dejar esa opción visible a cualquiera que abra la app.
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (error) setError("Correo o contraseña incorrectos.");
  };

  // Solo entra quien un administrador ya invitó (fila en "usuarios") — iniciar sesión con Google no abre
  // la puerta a cualquiera: AuthGate.jsx cierra la sesión de una si el correo de Google no tiene fila,
  // con un aviso explicando que hace falta una invitación. Esto solo sirve como atajo de acceso para
  // alguien que YA fue invitado y cuyo correo de Google coincide con el que se le invitó.
  const loginWithGoogle = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setError(error.message); setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", fontFamily: "'Poppins', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Poppins:wght@400;500;600;700&display=swap');`}</style>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "#FFFFFF", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 20 }}>
          <img src="/logo-iglesia.png" alt="Iglesia Jesús El Buen Pastor" style={{ width: 200, maxWidth: "100%", height: "auto" }} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 600, color: "#16324F" }}>JBP App</span>
        </div>

        <form onSubmit={submitLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="email" required placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Entrando…" : "Iniciar sesión"}</button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#DDE3ED" }} />
          <span style={{ fontSize: 11, color: "#8996A6", fontWeight: 600 }}>O</span>
          <div style={{ flex: 1, height: 1, background: "#DDE3ED" }} />
        </div>
        <button
          type="button" onClick={loginWithGoogle} disabled={loading}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, color: "#16233A", cursor: "pointer", opacity: loading ? 0.6 : 1 }}
        >
          <GoogleIcon /> Continuar con Google
        </button>
        <div style={{ fontSize: 11, color: "#8996A6", textAlign: "center", marginTop: 10 }}>Solo funciona si un administrador ya te invitó con este mismo correo.</div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.3C29.3 35.4 26.8 36 24 36c-5.3 0-9.6-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.3C40.5 36.4 44 30.9 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
