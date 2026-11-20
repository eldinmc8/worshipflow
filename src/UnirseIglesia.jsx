import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient.js";
import { validarPassword } from "./lib/passwordSegura.js";
import MedidorPassword from "./MedidorPassword.jsx";
import GenericMark from "./GenericMark.jsx";
import { TarjetaAcceso, RecuperarPassword, GoogleIcon } from "./Login.jsx";
import { iglesiaPorCodigo, guardarCodigo, olvidarCodigo } from "./lib/unirse.js";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const primaryBtn = { width: "100%", background: "#E8821E", border: "none", borderRadius: 8, padding: "11px", fontSize: 14, fontWeight: 700, color: "#16324F", cursor: "pointer" };
const enlaceBtn = { background: "none", border: "none", color: "var(--wf-muted)", fontSize: 13, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", padding: 4, alignSelf: "center" };
const googleBtn = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };

function Separador() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
      <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
      <span style={{ fontSize: 11, color: "var(--wf-faint)", fontWeight: 600 }}>O</span>
      <div style={{ flex: 1, height: 1, background: "var(--wf-divider)" }} />
    </div>
  );
}

// Lo que ve quien abre el enlace para unirse (?unirse=CODIGO) sin haber iniciado sesión: crea su cuenta
// (o entra con la que ya tiene) y AuthGate manda la solicitud al líder apenas hay sesión.
export default function UnirseIglesia({ codigo }) {
  const [iglesia, setIglesia] = useState(undefined); // undefined: cargando · null: enlace inválido
  const [modo, setModo] = useState("registro"); // registro | entrar | recuperar | revisaCorreo
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let vigente = true;
    guardarCodigo(codigo);
    iglesiaPorCodigo(codigo)
      .then((ig) => { if (!vigente) return; setIglesia(ig); if (!ig) olvidarCodigo(); })
      .catch(() => { if (vigente) setIglesia(null); });
    return () => { vigente = false; };
  }, [codigo]);

  const volverAqui = `${window.location.origin}/?unirse=${codigo}`;

  const registrarme = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError("Escribe tu nombre."); return; }
    { const err = validarPassword(password); if (err) { setError(err); return; } }
    setCargando(true); setError("");
    const email = correo.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre: nombre.trim(), codigo_union: codigo }, emailRedirectTo: volverAqui },
    });
    setCargando(false);
    // Correo ya registrado: según cómo esté Supabase, llega como error o como una cuenta sin identidades.
    const yaExiste = (error && /already|registered|exists/i.test(error.message || "")) || (!error && data?.user && data.user.identities?.length === 0);
    if (yaExiste) {
      setModo("entrar"); setPassword("");
      setAviso("Ese correo ya tiene cuenta. Entra con tu contraseña y enviamos tu solicitud.");
      return;
    }
    if (error) { setError(error.message); return; }
    // Con sesión, AuthGate sigue solo. Sin sesión, Supabase pide confirmar el correo primero.
    if (!data?.session) setModo("revisaCorreo");
  };

  const entrar = async (e) => {
    e.preventDefault();
    setCargando(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password });
    setCargando(false);
    if (error) setError("Correo o contraseña incorrectos.");
  };

  const conGoogle = async () => {
    setCargando(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: volverAqui } });
    if (error) { setError(error.message); setCargando(false); }
  };

  if (iglesia === undefined) {
    return <TarjetaAcceso><div style={{ fontSize: 13, color: "var(--wf-faint)", textAlign: "center" }}>Cargando…</div></TarjetaAcceso>;
  }
  if (iglesia === null) {
    return (
      <TarjetaAcceso>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>Este enlace ya no funciona</div>
          <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 18 }}>Pídele al líder de tu iglesia el enlace nuevo para unirte.</div>
          <a href="/" style={{ ...primaryBtn, display: "block", textDecoration: "none", boxSizing: "border-box" }}>Ir a iniciar sesión</a>
        </div>
      </TarjetaAcceso>
    );
  }
  if (modo === "recuperar") {
    return <TarjetaAcceso><RecuperarPassword correoInicial={correo} onVolver={() => setModo("entrar")} /></TarjetaAcceso>;
  }
  if (modo === "revisaCorreo") {
    return (
      <TarjetaAcceso>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>Confirma tu correo</div>
          <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5 }}>
            Te mandamos un mensaje a <b>{correo.trim()}</b>. Toca el botón del correo y tu solicitud para unirte a <b>{iglesia.nombre}</b> le llegará al líder. Si no lo ves, busca en spam.
          </div>
        </div>
      </TarjetaAcceso>
    );
  }

  const encabezado = (
    <div style={{ textAlign: "center", marginBottom: 18 }}>
      {iglesia.logo_url
        ? <img src={iglesia.logo_url} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 12, marginBottom: 8 }} />
        : <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><GenericMark size={56} /></div>}
      <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>Unirte a</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--wf-text)", letterSpacing: "-0.01em" }}>{iglesia.nombre}</div>
    </div>
  );

  return (
    <TarjetaAcceso>
      {encabezado}
      <button type="button" onClick={conGoogle} disabled={cargando} style={{ ...googleBtn, opacity: cargando ? 0.6 : 1 }}>
        <GoogleIcon /> Continuar con Google
      </button>
      <Separador />
      {aviso && <div style={{ fontSize: 12.5, color: "var(--wf-text)", background: "var(--wf-active-bg)", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>{aviso}</div>}
      {modo === "registro" ? (
        <form onSubmit={registrarme} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input required placeholder="Tu nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} autoComplete="name" />
          <input type="email" required placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} style={inputStyle} autoComplete="email" />
          <input type="password" required placeholder="Elige una contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoComplete="new-password" />
          <MedidorPassword password={password} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={cargando} style={{ ...primaryBtn, opacity: cargando ? 0.6 : 1, marginTop: 4 }}>{cargando ? "Creando tu cuenta…" : "Pedir unirme"}</button>
          <button type="button" onClick={() => { setModo("entrar"); setError(""); }} style={enlaceBtn}>Ya tengo cuenta</button>
        </form>
      ) : (
        <form onSubmit={entrar} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="email" required placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)} style={inputStyle} autoComplete="email" />
          <input type="password" required placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoComplete="current-password" />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={cargando} style={{ ...primaryBtn, opacity: cargando ? 0.6 : 1, marginTop: 4 }}>{cargando ? "Entrando…" : "Entrar y pedir unirme"}</button>
          <button type="button" onClick={() => { setModo("recuperar"); setError(""); }} style={enlaceBtn}>¿Olvidaste tu contraseña?</button>
          <button type="button" onClick={() => { setModo("registro"); setError(""); setAviso(""); }} style={enlaceBtn}>Crear una cuenta nueva</button>
        </form>
      )}
      <div style={{ fontSize: 11, color: "var(--wf-faint)", textAlign: "center", marginTop: 12 }}>El líder de la iglesia tiene que aprobar tu solicitud antes de que puedas entrar.</div>
    </TarjetaAcceso>
  );
}

// Pantalla de espera: tiene cuenta y pidió entrar, pero el líder todavía no la aprueba (o la rechazó).
// Revisa sola cada 20 segundos; al aprobarse, AuthGate encuentra su perfil y entra.
export function EsperandoAprobacion({ solicitud, onRevisar, onSalir }) {
  const rechazada = solicitud?.estado === "rechazada";
  useEffect(() => {
    if (rechazada) return undefined;
    const t = setInterval(onRevisar, 20000);
    return () => clearInterval(t);
  }, [rechazada, onRevisar]);
  return (
    <TarjetaAcceso>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><GenericMark size={52} /></div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)", marginBottom: 8 }}>
          {rechazada ? "Tu solicitud no fue aceptada" : "Tu solicitud está en espera"}
        </div>
        <div style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, marginBottom: 18 }}>
          {rechazada
            ? <>El líder de <b>{solicitud.iglesia}</b> no aprobó tu solicitud. Si crees que es un error, habla con él o ella.</>
            : <>Tu solicitud ya le aparece al líder de <b>{solicitud?.iglesia}</b>. En cuanto te apruebe, entras a la app desde aquí mismo.</>}
        </div>
        {!rechazada && <button type="button" onClick={onRevisar} style={primaryBtn}>Revisar de nuevo</button>}
        <button type="button" onClick={onSalir} style={{ ...primaryBtn, background: "transparent", color: "var(--wf-muted)", marginTop: 6 }}>Cerrar sesión</button>
      </div>
    </TarjetaAcceso>
  );
}
