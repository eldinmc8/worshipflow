// @vitest-environment jsdom
// Caso real (2026-11-11): una persona invitada entraba bien en el celular, pero en una PC con el reloj
// adelantado le salía "Todavía no tienes acceso". La sesión se caía a media carga por la cadena de
// renovaciones de la llave, la lectura del perfil salía sin sesión y la app concluía "no invitado".
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

const estado = { sesionActual: null, respuestaPerfil: null, escuchar: null, cerrar: vi.fn(), llamadas: [] };
const llave = (iat) => `x.${btoa(JSON.stringify({ sub: "u1", iat, exp: iat + 3600 })).replace(/=+$/, "")}.y`;
const sesion = (iat = Math.floor(Date.now() / 1000)) => ({ access_token: llave(iat), user: { id: "u1", email: "a@b.c" } });

vi.mock("../lib/supabaseClient.js", () => {
  const consulta = { select: () => consulta, eq: () => consulta, single: () => Promise.resolve(estado.respuestaPerfil) };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: estado.sesionActual } }),
        onAuthStateChange: (fn) => { estado.escuchar = fn; return { data: { subscription: { unsubscribe() {} } } }; },
        signOut: (...a) => { estado.cerrar(...a); estado.sesionActual = null; estado.escuchar?.("SIGNED_OUT", null); return Promise.resolve({}); },
      },
      from: () => consulta,
      rpc: () => Promise.resolve({ data: false }),
    },
    callUsersFunction: (nombre) => { estado.llamadas.push(nombre); return Promise.resolve({}); },
  };
});
vi.mock("../Login.jsx", () => ({ default: () => <div>PANTALLA LOGIN</div> }));
vi.mock("../PrototipoWorshipFlow.jsx", () => ({ default: () => <div>APP ADENTRO</div> }));
vi.mock("../UsersAdmin.jsx", () => ({ default: () => null }));
vi.mock("../RolesAdmin.jsx", () => ({ default: () => null }));
vi.mock("../PlataformaAdmin.jsx", () => ({ default: () => null }));
vi.mock("../lib/notificaciones.js", () => ({ suscribirPush: vi.fn() }));
vi.mock("../lib/monitoreo.js", () => ({ identificarUsuario: vi.fn(), reportarError: vi.fn() }));

window.scrollTo = () => {};
afterEach(() => { cleanup(); estado.cerrar.mockClear(); estado.llamadas.length = 0; localStorage.clear(); });
const { default: AuthGate } = await import("../AuthGate.jsx");
const esperar = () => act(() => new Promise((r) => setTimeout(r, 20)));

describe("acceso con el reloj de la computadora corrido", () => {
  it("si la sesión se cayó a media lectura del perfil, NO dice 'no tienes acceso' ni descarta la cuenta", async () => {
    estado.sesionActual = sesion();
    estado.respuestaPerfil = { data: null, error: { code: "PGRST116", message: "0 rows" } };
    // La sesión se cae justo mientras se leía el perfil.
    const original = estado.respuestaPerfil;
    estado.respuestaPerfil = { then: (fn) => { estado.sesionActual = null; return Promise.resolve(original).then(fn); } };
    render(<AuthGate />);
    await esperar();
    expect(screen.queryByText("Todavía no tienes acceso")).toBeNull();
    expect(estado.llamadas).not.toContain("descartar-acceso-no-invitado");
  });

  it("una llave renovada con el reloj 2 horas adelantado: corta la sesión y explica cómo corregir la hora", async () => {
    estado.sesionActual = sesion();
    estado.respuestaPerfil = { data: { id: "u1", rol: "admin", perfil_completo: true, iglesias: { activa: true } }, error: null };
    render(<AuthGate />);
    await esperar();
    expect(screen.getByText("APP ADENTRO")).toBeTruthy();
    await act(async () => { estado.escuchar("TOKEN_REFRESHED", sesion(Math.floor(Date.now() / 1000) - 2 * 3600)); });
    await esperar();
    expect(screen.getByText("La fecha u hora de este equipo está mal")).toBeTruthy();
    expect(screen.getByText(/Tu reloj va 2 horas adelantada/)).toBeTruthy();
    expect(estado.cerrar).toHaveBeenCalledWith({ scope: "local" });
  });

  it("una renovación normal (reloj bien) no molesta", async () => {
    estado.sesionActual = sesion();
    estado.respuestaPerfil = { data: { id: "u1", rol: "admin", perfil_completo: true, iglesias: { activa: true } }, error: null };
    render(<AuthGate />);
    await esperar();
    await act(async () => { estado.escuchar("TOKEN_REFRESHED", sesion()); });
    await esperar();
    expect(screen.getByText("APP ADENTRO")).toBeTruthy();
    expect(estado.cerrar).not.toHaveBeenCalled();
  });

  it("alguien de verdad NO invitado (la base dice 'no hay fila' con su sesión activa) sigue viendo el aviso", async () => {
    estado.sesionActual = sesion();
    estado.respuestaPerfil = { data: null, error: { code: "PGRST116", message: "0 rows" } };
    render(<AuthGate />);
    await esperar();
    expect(screen.getByText("Todavía no tienes acceso")).toBeTruthy();
    expect(estado.llamadas).toContain("descartar-acceso-no-invitado");
  });

  it("otro error al leer el perfil (no 'no hay fila'): pide reintentar en vez de negar el acceso", async () => {
    estado.sesionActual = sesion();
    estado.respuestaPerfil = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
    render(<AuthGate />);
    await esperar();
    expect(screen.queryByText("Todavía no tienes acceso")).toBeNull();
    expect(screen.getByText("No pudimos cargar tu cuenta")).toBeTruthy();
    expect(estado.llamadas).not.toContain("descartar-acceso-no-invitado");
  });
});
