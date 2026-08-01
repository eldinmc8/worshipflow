import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { suscribirPush } from "./lib/notificaciones.js";
import Login from "./Login.jsx";
import UsersAdmin from "./UsersAdmin.jsx";
import PrototipoWorshipFlow from "./PrototipoWorshipFlow.jsx";

// Puerta de acceso real: exige sesión de Supabase antes de mostrar la app. La app en sí ya es el
// prototipo completo (Canciones, Eventos, En vivo, Ministerios...), pero ahora leyendo y guardando
// en Supabase de verdad en vez de datos de ejemplo en memoria — ver src/lib/canciones.js y
// src/lib/eventos.js. "Usuarios" es la única pantalla aparte: es funcionalidad nueva que el
// prototipo nunca tuvo (ahí solo había un selector de rol simulado en Ajustes).
export default function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined: cargando · null: sin sesión · objeto: con sesión
  const [perfil, setPerfil] = useState(null); // fila de "usuarios" para la sesión actual
  const [view, setView] = useState("app"); // 'app' | 'usuarios'
  // Un enlace de invitación (o de recuperar contraseña, si se agrega luego) trae type=invite/recovery
  // en el hash de la URL — el cliente de Supabase ya deja la sesión activa solo con eso, pero la cuenta
  // todavía no tiene contraseña propia: hay que pedirla antes de dejar entrar a la app de una.
  const [needsPassword, setNeedsPassword] = useState(() => /type=(invite|recovery)/.test(window.location.hash));
  // Después de elegir contraseña por primera vez, se le pide activar el push antes de dejarla entrar
  // a la app — así los usuarios nuevos quedan con las notificaciones activadas casi de una, en vez de
  // tener que encontrar el botón en Ajustes por su cuenta (donde muchos nunca lo harían).
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  const [errorSesion, setErrorSesion] = useState("");
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session ?? null))
      .catch((e) => { setSession(null); setErrorSesion(e.message); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPerfil(null); return; }
    supabase.from("usuarios").select("*").eq("id", session.user.id).single()
      .then(({ data }) => setPerfil(data ?? null));
  }, [session]);

  // Ir a Usuarios empuja su propia entrada del historial ("usuarios-root") — así el botón/gesto
  // "atrás" regresa a la app en vez de salir de golpe. El propio WorshipFlowPrototype maneja sus
  // entradas "app-nav"; aquí solo nos importa distinguir "estamos en Usuarios" de "estamos en la app".
  useEffect(() => {
    const onPopState = (e) => {
      const screen = e.state?.screen;
      if (!screen) return;
      if (screen === "usuarios-root" || screen === "usuarios-profile") setView("usuarios");
      else if (screen === "app-root" || screen === "app-nav") setView("app");
    };
    window.addEventListener("popstate", onPopState);
    if (!window.history.state?.screen) {
      window.history.replaceState({ screen: "app-root" }, "");
    }
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (session === undefined) {
    // Antes esto se quedaba en blanco para siempre si getSession() fallaba (sin mensaje ni forma de
    // saber qué pasó) — ahora, pasados unos segundos sin respuesta, se ve al menos un aviso.
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", fontFamily: "'Poppins', sans-serif", fontSize: 13, color: "#8996A6", flexDirection: "column", gap: 8, padding: 20, textAlign: "center" }}>
        <div>Cargando…</div>
        {errorSesion && <div style={{ color: "#C23B32", maxWidth: 320 }}>No se pudo conectar: {errorSesion}</div>}
      </div>
    );
  }
  if (!session) return <Login />;

  if (needsPassword) {
    return (
      <SetPassword
        onDone={() => {
          window.history.replaceState(null, "", window.location.pathname); // limpia el token del hash de la URL
          setNeedsPassword(false);
          setShowPushPrompt(true);
        }}
      />
    );
  }

  if (showPushPrompt) {
    return <PushPrompt userId={session.user.id} onDone={() => setShowPushPrompt(false)} />;
  }

  const esAdmin = perfil?.rol === "admin";

  return view === "usuarios" && esAdmin ? (
    <UsersAdmin myEmail={session.user.email} onExit={() => window.history.back()} />
  ) : (
    <PrototipoWorshipFlow
      userId={session.user.id}
      perfil={perfil}
      onGoToUsuarios={esAdmin ? () => { window.history.pushState({ screen: "usuarios-root" }, ""); setView("usuarios"); } : null}
    />
  );
}

const inputStyle = { width: "100%", background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#16233A", outline: "none", boxSizing: "border-box" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer" };

// Pantalla que ve quien acaba de aceptar una invitación (o, más adelante, un enlace de "olvidé mi
// contraseña"): ya tiene sesión válida gracias al enlace, solo le falta elegir su propia contraseña.
function SetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onDone();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", fontFamily: "'Poppins', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Poppins:wght@400;500;600;700&display=swap');`}</style>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "#FFFFFF", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <img src="/logo-iglesia.png" alt="Iglesia Jesús El Buen Pastor" style={{ width: 180, maxWidth: "100%", height: "auto" }} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 600, color: "#16324F" }}>JBP App</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#16233A", marginBottom: 4 }}>¡Bienvenido/a!</div>
        <div style={{ fontSize: 12, color: "#64707F", marginBottom: 16 }}>Elige tu contraseña para terminar de activar tu cuenta.</div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="password" required placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <input type="password" required placeholder="Confirmar contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Guardando…" : "Guardar y entrar"}</button>
        </form>
      </div>
    </div>
  );
}

// Justo después de elegir contraseña por primera vez — antes de dejar entrar a la app — se le pide
// de una vez activar el push, con un botón bien visible (para que sea casi automático con un solo
// toque) y un "Ahora no" chico y discreto para quien de verdad no lo quiera en ese momento.
function PushPrompt({ userId, onDone }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activar = async () => {
    setLoading(true); setError("");
    try {
      await suscribirPush(userId);
      onDone();
    } catch (e) {
      setError(e.message || "No se pudo activar. Puedes intentarlo después desde Ajustes.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F6FA", fontFamily: "'Poppins', sans-serif" }}>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "#FFFFFF", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF6EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <span style={{ fontSize: 26 }}>🔔</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#16233A", marginBottom: 6 }}>Activa tus notificaciones</div>
        <div style={{ fontSize: 12, color: "#64707F", marginBottom: 18, lineHeight: 1.5 }}>Te avisamos cuando te asignen un encargo y antes de cada evento donde participes — así no se te pasa nada.</div>
        {error && <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 10 }}>{error}</div>}
        <button onClick={activar} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>{loading ? "Activando…" : "Activar notificaciones"}</button>
        <button onClick={onDone} disabled={loading} style={{ background: "none", border: "none", color: "#8996A6", fontSize: 12, cursor: "pointer", marginTop: 12, padding: 4 }}>Ahora no</button>
      </div>
    </div>
  );
}
