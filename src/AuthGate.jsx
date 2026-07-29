import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
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

  const esAdmin = perfil?.rol === "admin";

  return (
    <>
      {view === "app" && esAdmin && (
        <div style={{ position: "fixed", top: 8, right: 8, zIndex: 1000 }}>
          <button
            onClick={() => setView("usuarios")}
            style={{ fontSize: 11, fontWeight: 700, background: "#16324F", color: "#fff", border: "none", borderRadius: 20, padding: "6px 12px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
          >
            ⚙ Usuarios
          </button>
        </div>
      )}
      {view === "usuarios" && esAdmin ? (
        <UsersAdmin myEmail={session.user.email} onExit={() => setView("app")} />
      ) : (
        <PrototipoWorshipFlow userId={session.user.id} perfil={perfil} onGoToUsuarios={esAdmin ? () => setView("usuarios") : null} />
      )}
    </>
  );
}
