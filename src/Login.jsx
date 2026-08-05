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
      </div>
    </div>
  );
}
