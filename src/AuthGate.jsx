import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { suscribirPush } from "./lib/notificaciones.js";
import Login from "./Login.jsx";
import UsersAdmin from "./UsersAdmin.jsx";
import PrototipoWorshipFlow from "./PrototipoWorshipFlow.jsx";
import AppLogo from "./AppLogo.jsx";

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

  // Se enciende si alguien logra obtener una sesión válida de Supabase (típicamente iniciando con
  // Google) sin tener una fila en "usuarios" — o sea, sin que un administrador lo haya invitado antes.
  // El acceso sigue siendo de lista cerrada aunque se agregue "Continuar con Google": esa sesión se
  // cierra de una y se explica por qué, en vez de dejarlo entrar a la app sin rol.
  const [accessDenied, setAccessDenied] = useState(false);

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
      .then(({ data }) => {
        if (!data) {
          setAccessDenied(true);
          // Descarta de una la cuenta huérfana que Google acaba de crear en Auth (ver
          // descartar-acceso-no-invitado) — si no, un admin que después invite este mismo correo se
          // topa con "ya registrado" (ver crear-usuario/index.ts). Si falla (sin red, etc.) no importa:
          // ese Edge Function se auto-repara sola la próxima vez que un admin intente invitar.
          callUsersFunction("descartar-acceso-no-invitado", {}).catch(() => {}).finally(() => supabase.auth.signOut());
          return;
        }
        setPerfil(data);
      });
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
    // saber qué pasó) — ahora, pasados unos segundos sin respuesta, se ve al menos un aviso. El texto
    // técnico del error (errorSesion) queda solo en consola: a la iglesia se le muestra una tarjeta
    // igual de "de la app" que el resto de pantallas, no un error crudo de JavaScript.
    if (errorSesion) console.error("No se pudo conectar:", errorSesion);
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
        {!errorSesion ? (
          <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div>
        ) : (
          <div className="screen-enter" style={{ width: 320, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--wf-active-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <WifiOff size={22} color="#E8821E" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>Sin conexión</div>
            <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 18 }}>No pudimos conectar con el servidor. Revisa tu internet e intenta de nuevo.</div>
            <button onClick={() => window.location.reload()} style={primaryBtn}>Reintentar</button>
          </div>
        )}
      </div>
    );
  }
  if (accessDenied) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
        <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>Todavía no tienes acceso</div>
          <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 18 }}>Un administrador tiene que invitarte primero, con este mismo correo, desde Usuarios en la app.</div>
          <button onClick={() => setAccessDenied(false)} style={primaryBtn}>Volver</button>
        </div>
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

  // Un admin puede invitar solo con correo+rol, sin nombre — falta que la propia persona lo complete
  // antes de dejarla entrar a la app (ver Edge Function completar-perfil). Si entró con Google, se le
  // sugiere su nombre y foto de ahí de una vez; si no, escribe su nombre a mano y se queda sin foto
  // (las iniciales de respaldo se ven bien igual).
  if (perfil && !perfil.perfil_completo) {
    return (
      <CompleteProfile
        session={session}
        onDone={(actualizado) => { setPerfil(actualizado); setShowPushPrompt(true); }}
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

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
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

  // Ya tiene sesión válida (gracias al enlace de invitación) — vincular Google acá es más seguro que un
  // inicio de sesión "en frío" con signInWithOAuth: queda pegado a ESTA cuenta ya invitada, nunca crea
  // una cuenta nueva ni distinta. Google redirige fuera de la app y welcome vuelve con la sesión ya
  // vinculada — AuthGate detecta perfil_completo:false y muestra CompleteProfile con el nombre/foto de
  // Google ya sugeridos, sin que la persona tenga que inventar ni escribir una contraseña.
  const [googleLoading, setGoogleLoading] = useState(false);
  const continuarConGoogle = async () => {
    setGoogleLoading(true); setError("");
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Poppins:wght@400;500;600;700&display=swap');`}</style>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <AppLogo width={180} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 14, fontWeight: 600, color: "var(--wf-heading)" }}>JBP App</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wf-text)", marginBottom: 4 }}>¡Bienvenido/a!</div>
        <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 16 }}>Elige cómo quieres entrar de ahora en adelante.</div>

        <button
          type="button" onClick={continuarConGoogle} disabled={googleLoading || loading}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", opacity: googleLoading ? 0.6 : 1, marginBottom: 14 }}
        >
          <GoogleIcon /> {googleLoading ? "Redirigiendo…" : "Continuar con Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
          <span style={{ fontSize: 11, color: "var(--wf-faint)", fontWeight: 600 }}>O ELIGE UNA CONTRASEÑA</span>
          <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="password" required placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <input type="password" required placeholder="Confirmar contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={loading || googleLoading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Guardando…" : "Guardar y entrar"}</button>
        </form>
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

// Cuando un admin invita solo con correo+rol (sin nombre), esto es lo primero que ve la persona al
// entrar (después de elegir contraseña, si vino por invitación por correo). Si la sesión trae datos de
// Google (entró con "Continuar con Google" o los vinculó), se le sugiere su nombre y foto de ahí de
// una — nada más tiene que confirmar. Si no, escribe su nombre a mano y se queda sin foto.
function CompleteProfile({ session, onDone }) {
  const meta = session.user.user_metadata || {};
  const fotoGoogle = meta.avatar_url || meta.picture || "";
  const [nombre, setNombre] = useState(meta.full_name || meta.name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError("Escribe tu nombre."); return; }
    setLoading(true); setError("");
    try {
      const { usuario } = await callUsersFunction("completar-perfil", { nombre: nombre.trim(), foto_url: fotoGoogle || null });
      onDone(usuario);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif" }}>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {fotoGoogle ? (
            <img src={fotoGoogle} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <AppLogo width={140} />
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wf-text)", marginBottom: 4 }}>Ya casi — ¿cómo te llamas?</div>
        <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 16 }}>
          {fotoGoogle ? "Tomamos tu foto de Google — puedes ajustar tu nombre si hace falta." : "Este va a ser el nombre que vea el resto del equipo."}
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input required autoFocus placeholder="Tu nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>{loading ? "Guardando…" : "Continuar"}</button>
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif" }}>
      <div className="screen-enter" style={{ width: 360, maxWidth: "92vw", background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 8px 32px rgba(22,50,79,0.15)", padding: 28, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF6EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <span style={{ fontSize: 26 }}>🔔</span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 6 }}>Activa tus notificaciones</div>
        <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 18, lineHeight: 1.5 }}>Te avisamos cuando te asignen un encargo y antes de cada evento donde participes — así no se te pasa nada.</div>
        {error && <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 10 }}>{error}</div>}
        <button onClick={activar} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>{loading ? "Activando…" : "Activar notificaciones"}</button>
        <button onClick={onDone} disabled={loading} style={{ background: "none", border: "none", color: "var(--wf-faint)", fontSize: 12, cursor: "pointer", marginTop: 12, padding: 4 }}>Ahora no</button>
      </div>
    </div>
  );
}
