// @vitest-environment jsdom
// Unirse con el enlace de la iglesia (?unirse=CODIGO) + aprobación del líder, y "¿Olvidaste tu contraseña?".
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";

const estado = { sesion: null, perfil: null, escuchar: null, rpc: {}, llamadasRpc: [], signUp: null, reset: [], llamadas: [] };

vi.mock("../lib/supabaseClient.js", () => {
  const consulta = { select: () => consulta, eq: () => consulta, single: () => Promise.resolve(estado.perfil), maybeSingle: () => Promise.resolve({ data: null }) };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: estado.sesion } }),
        onAuthStateChange: (fn) => { estado.escuchar = fn; return { data: { subscription: { unsubscribe() {} } } }; },
        signOut: () => { estado.sesion = null; estado.escuchar?.("SIGNED_OUT", null); return Promise.resolve({}); },
        signUp: (args) => { estado.signUpArgs = args; return Promise.resolve(estado.signUp); },
        signInWithPassword: () => Promise.resolve({ error: null }),
        resetPasswordForEmail: (email, opts) => { estado.reset.push({ email, opts }); return Promise.resolve({ error: null }); },
      },
      from: () => consulta,
      rpc: (fn, args) => { estado.llamadasRpc.push({ fn, args }); const r = estado.rpc[fn]; return Promise.resolve({ data: typeof r === "function" ? r(args) : (r ?? null), error: null }); },
    },
    callUsersFunction: (nombre) => { estado.llamadas.push(nombre); return Promise.resolve({}); },
  };
});
vi.mock("../PrototipoWorshipFlow.jsx", () => ({ default: () => <div>APP ADENTRO</div> }));
vi.mock("../UsersAdmin.jsx", () => ({ default: () => null }));
vi.mock("../RolesAdmin.jsx", () => ({ default: () => null }));
vi.mock("../PlataformaAdmin.jsx", () => ({ default: () => null }));
vi.mock("../lib/notificaciones.js", () => ({ suscribirPush: vi.fn() }));
vi.mock("../lib/monitoreo.js", () => ({ identificarUsuario: vi.fn(), reportarError: vi.fn() }));

window.scrollTo = () => {};
const { default: AuthGate } = await import("../AuthGate.jsx");
const esperar = () => act(() => new Promise((r) => setTimeout(r, 20)));
const sinFila = { data: null, error: { code: "PGRST116", message: "0 rows" } };
const irA = (url) => window.history.replaceState(null, "", url);

beforeEach(() => {
  Object.assign(estado, { sesion: null, perfil: null, rpc: {}, llamadasRpc: [], signUp: null, reset: [], llamadas: [] });
});
afterEach(() => { cleanup(); localStorage.clear(); irA("/"); });

describe("enlace para unirse", () => {
  it("sin sesión, el enlace muestra el nombre de la iglesia y el registro", async () => {
    irA("/?unirse=abc123def0");
    estado.rpc.wf_iglesia_por_codigo = [{ nombre: "Iglesia Betel", logo_url: null }];
    render(<AuthGate />);
    await esperar();
    expect(screen.getByText("Iglesia Betel")).toBeTruthy();
    expect(screen.getByText("Pedir unirme")).toBeTruthy();
    expect(localStorage.getItem("worshipflow_codigo_unirse")).toBe("abc123def0");
  });

  it("un enlace que ya no sirve lo dice claro", async () => {
    irA("/?unirse=viejo12345");
    estado.rpc.wf_iglesia_por_codigo = [];
    render(<AuthGate />);
    await esperar();
    expect(screen.getByText("Este enlace ya no funciona")).toBeTruthy();
  });

  it("al registrarse guarda el nombre y el código en la cuenta; si hay que confirmar correo, lo avisa", async () => {
    irA("/?unirse=abc123def0");
    estado.rpc.wf_iglesia_por_codigo = [{ nombre: "Iglesia Betel" }];
    estado.signUp = { data: { user: { id: "n1", identities: [{}] }, session: null }, error: null };
    render(<AuthGate />);
    await esperar();
    fireEvent.change(screen.getByPlaceholderText("Tu nombre y apellido"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByPlaceholderText("Correo"), { target: { value: "Ana@Correo.com" } });
    fireEvent.change(screen.getByPlaceholderText("Elige una contraseña"), { target: { value: "Alabanza2026" } });
    fireEvent.click(screen.getByText("Pedir unirme"));
    await esperar();
    expect(estado.signUpArgs.email).toBe("ana@correo.com");
    expect(estado.signUpArgs.options.data).toEqual({ nombre: "Ana Pérez", codigo_union: "abc123def0" });
    expect(screen.getByText("Confirma tu correo")).toBeTruthy();
  });

  it("si el correo ya tiene cuenta, pasa a iniciar sesión", async () => {
    irA("/?unirse=abc123def0");
    estado.rpc.wf_iglesia_por_codigo = [{ nombre: "Iglesia Betel" }];
    estado.signUp = { data: { user: { id: "n1", identities: [] }, session: null }, error: null };
    render(<AuthGate />);
    await esperar();
    fireEvent.change(screen.getByPlaceholderText("Tu nombre y apellido"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("Correo"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByPlaceholderText("Elige una contraseña"), { target: { value: "Alabanza2026" } });
    fireEvent.click(screen.getByText("Pedir unirme"));
    await esperar();
    expect(screen.getByText(/Ese correo ya tiene cuenta/)).toBeTruthy();
    expect(screen.getByText("Entrar y pedir unirme")).toBeTruthy();
  });

  it("con sesión y sin ser miembro, manda la solicitud y muestra la espera (sin descartar la cuenta)", async () => {
    localStorage.setItem("worshipflow_codigo_unirse", "abc123def0");
    estado.sesion = { user: { id: "n1", email: "a@b.com", user_metadata: { full_name: "Ana de Google" } } };
    estado.perfil = sinFila;
    estado.rpc.wf_mi_solicitud = null;
    estado.rpc.wf_solicitar_ingreso = { estado: "pendiente", iglesia: "Iglesia Betel" };
    render(<AuthGate />);
    await esperar(); await esperar();
    expect(estado.llamadasRpc.find((l) => l.fn === "wf_solicitar_ingreso").args).toEqual({ p_codigo: "abc123def0", p_nombre: "Ana de Google" });
    expect(screen.getByText("Tu solicitud está en espera")).toBeTruthy();
    expect(screen.queryByText("Todavía no tienes acceso")).toBeNull();
    expect(estado.llamadas).not.toContain("descartar-acceso-no-invitado");
    expect(localStorage.getItem("worshipflow_codigo_unirse")).toBeNull();
  });

  it("al aprobarse, entra a la app desde la pantalla de espera", async () => {
    estado.sesion = { user: { id: "n1", email: "a@b.com" } };
    estado.perfil = sinFila;
    estado.rpc.wf_mi_solicitud = { estado: "pendiente", iglesia: "Iglesia Betel" };
    render(<AuthGate />);
    await esperar(); await esperar();
    expect(screen.getByText("Tu solicitud está en espera")).toBeTruthy();
    estado.perfil = { data: { id: "n1", rol: "miembro", perfil_completo: true, iglesias: { nombre: "Iglesia Betel", activa: true } }, error: null };
    fireEvent.click(screen.getByText("Revisar de nuevo"));
    await esperar(); await esperar();
    expect(screen.queryByText("Tu solicitud está en espera")).toBeNull();
  });

  it("rechazada: lo dice, sin botón de revisar", async () => {
    estado.sesion = { user: { id: "n1", email: "a@b.com" } };
    estado.perfil = sinFila;
    estado.rpc.wf_mi_solicitud = { estado: "rechazada", iglesia: "Iglesia Betel" };
    render(<AuthGate />);
    await esperar(); await esperar();
    expect(screen.getByText("Tu solicitud no fue aceptada")).toBeTruthy();
    expect(screen.queryByText("Revisar de nuevo")).toBeNull();
  });

  it("sin enlace ni solicitud, sigue igual que antes: no tiene acceso", async () => {
    estado.sesion = { user: { id: "n1", email: "a@b.com" } };
    estado.perfil = sinFila;
    render(<AuthGate />);
    await esperar(); await esperar();
    expect(screen.getByText("Todavía no tienes acceso")).toBeTruthy();
  });
});

describe("¿Olvidaste tu contraseña?", () => {
  it("manda el enlace al correo y vuelve a la app", async () => {
    render(<AuthGate />);
    await esperar();
    fireEvent.click(screen.getByText("¿Olvidaste tu contraseña?"));
    fireEvent.change(screen.getByPlaceholderText("Correo"), { target: { value: "Pastor@Iglesia.com " } });
    fireEvent.click(screen.getByText("Enviarme el enlace"));
    await esperar();
    expect(estado.reset).toEqual([{ email: "pastor@iglesia.com", opts: { redirectTo: `${window.location.origin}/` } }]);
    expect(screen.getByText("Revisa tu correo")).toBeTruthy();
  });

  it("al volver con el enlace del correo, pide solo la contraseña nueva", async () => {
    estado.sesion = { user: { id: "u1", email: "a@b.com" } };
    estado.perfil = { data: { id: "u1", rol: "miembro", perfil_completo: true, iglesias: { nombre: "X", activa: true } }, error: null };
    render(<AuthGate />);
    await esperar();
    act(() => estado.escuchar("PASSWORD_RECOVERY", estado.sesion));
    await esperar();
    expect(screen.getByText("Elige tu contraseña nueva")).toBeTruthy();
    expect(screen.queryByText("Continuar con Google")).toBeNull();
  });
});
