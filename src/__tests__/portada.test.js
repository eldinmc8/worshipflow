import { describe, it, expect } from "vitest";
import { mostrarPortada, haySesionGuardada } from "../lib/portada.js";

const base = { hostname: "worshipflowapp.com", pathname: "/", search: "", hash: "", haySesion: false };

// Dominio propio (2026-11-13): sin sesión se ve la página web; con sesión, la app.
describe("portada en worshipflowapp.com", () => {
  it("sin sesión en / muestra la página web", () => {
    expect(mostrarPortada(base)).toBe(true);
    expect(mostrarPortada({ ...base, hostname: "www.worshipflowapp.com" })).toBe(true);
  });
  it("con sesión va directo a la app", () => {
    expect(mostrarPortada({ ...base, haySesion: true })).toBe(false);
  });
  it("la dirección vieja sigue abriendo la app", () => {
    expect(mostrarPortada({ ...base, hostname: "worshipflow-pearl.vercel.app" })).toBe(false);
    expect(mostrarPortada({ ...base, hostname: "localhost" })).toBe(false);
  });
  it("Entrar (?entrar) abre el inicio de sesión", () => {
    expect(mostrarPortada({ ...base, search: "?entrar" })).toBe(false);
  });
  it("al volver de Google se abre la app, no la portada", () => {
    expect(mostrarPortada({ ...base, search: "?code=abc" })).toBe(false);
    expect(mostrarPortada({ ...base, hash: "#access_token=x&refresh_token=y" })).toBe(false);
  });
  it("otras direcciones (pantallas, crear iglesia, /tv) no se tocan", () => {
    expect(mostrarPortada({ ...base, search: "?screen=publico" })).toBe(false);
    expect(mostrarPortada({ ...base, search: "?crear-iglesia&codigo=1" })).toBe(false);
    expect(mostrarPortada({ ...base, pathname: "/tv" })).toBe(false);
    expect(mostrarPortada({ ...base, pathname: "/p/mi-iglesia" })).toBe(false);
  });
});

function almacen(datos) {
  const claves = Object.keys(datos);
  return { length: claves.length, key: (i) => claves[i], getItem: (k) => datos[k] ?? null };
}

describe("haySesionGuardada", () => {
  it("detecta la sesión de Supabase", () => {
    expect(haySesionGuardada(almacen({ "sb-abcd-auth-token": "{...}" }))).toBe(true);
  });
  it("sin sesión devuelve falso", () => {
    expect(haySesionGuardada(almacen({ "wf-tema": "claro" }))).toBe(false);
  });
});
